#!/usr/bin/env bash
#
# 服务器一键初始化脚本（Ubuntu / Debian 系）
# 用途：为 GitHub Actions 自动部署准备目标服务器环境
# 使用方法：
#   1. 将本脚本与本地公钥 id_ed25519.pub 一同上传到服务器（或手动替换下方 PUBKEY 变量）
#   2. 以 root 或具有 sudo 权限的用户执行： bash server-init.sh
#   3. 执行完成后，在 GitHub 仓库配置 Secrets（见脚本末尾说明）
#
# 注意：
#   - 本脚本会创建 deploy 用户并加入 docker 组，使其可执行 docker 命令
#   - GitHub Actions 通过 appleboy/ssh-action 以 deploy 用户登录，使用你本地的私钥
#   - 公部署公钥已内置在 PUBKEY 变量中，如需更换请替换该值

set -euo pipefail

# ====================== 可配置变量 ======================
DEPLOY_USER="deploy"
PROJECT_DIR="/home/${DEPLOY_USER}/my-blog"
# 站点域名（同时也写入 .env 的 ALLOWED_HOSTS）
DOMAIN="linkuphub.top"
# 本地公钥内容（由 scripts/gen_ssh_key 流程生成，已内置）
PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBETdIovlAwmNwqUDoO6vphjDytH9TgJupNsfwlylbWg 46884@DESKTOP-5P8DV1N"
# ==================== 结束可配置变量 ====================

echo "==> [1/7] 更新系统并安装基础依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release openssh-server ufw

echo "==> [2/7] 安装 Docker Engine 与 Docker Compose 插件"
# 若已安装则跳过
if ! command -v docker >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    DISTRO=$(. /etc/os-release && echo "$ID")
    CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${DISTRO} ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
else
    echo "    Docker 已存在，跳过安装"
fi

echo "==> [3/7] 创建部署用户 ${DEPLOY_USER}"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "${DEPLOY_USER}"
fi
# 加入 docker 组，使其可无 sudo 执行 docker
usermod -aG docker "${DEPLOY_USER}"

echo "==> [4/7] 配置 ${DEPLOY_USER} 的 SSH 公钥（用于 GitHub Actions 登录）"
USER_HOME="/home/${DEPLOY_USER}"
install -d -m 700 "${USER_HOME}/.ssh"
echo "${PUBKEY}" >> "${USER_HOME}/.ssh/authorized_keys"
chmod 600 "${USER_HOME}/.ssh/authorized_keys"
chown -R "${DEPLOY_USER}:" "${USER_HOME}/.ssh"
# 确保 SSH 服务允许公钥登录
sed -i 's/^#*PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
systemctl enable --now ssh
systemctl restart ssh

echo "==> [5/7] 创建项目目录与 .env 模板"
install -d -m 755 "${PROJECT_DIR}"
# 生成随机 SECRET_KEY（Django 要求）
RANDOM_SECRET=$(python3 -c "import secrets,string; print(''.join(secrets.choice(string.ascii_letters+string.digits+'!@#%^&*(-_=+)') for _ in range(50)))" 2>/dev/null || openssl rand -base64 50 | tr -dc 'a-zA-Z0-9!@#%^&*(-_=+)' | head -c 50)
cat > "${PROJECT_DIR}/.env" <<EOF
# 该文件由 server-init.sh 生成，供 docker-compose.yml 注入容器环境变量
SECRET_KEY=${RANDOM_SECRET}
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,${DOMAIN},www.${DOMAIN}
EOF
chown -R "${DEPLOY_USER}:" "${PROJECT_DIR}"
echo "    已生成 .env，ALLOWED_HOSTS 已预填 ${DOMAIN}"

echo "==> [6/7] 安装 Nginx 并写入站点配置（反向代理到 Django 容器）"
apt-get install -y nginx
# 写入站点配置：80 端口，静态文件直出，动态请求反代到 127.0.0.1:8000
cat > /etc/nginx/sites-available/myblog <<NGINX_EOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    # 用户上传文件
    location /media/ {
        alias ${PROJECT_DIR}/data/media/;
        expires 30d;
        access_log off;
    }

    # 收集的静态文件
    location /static/ {
        alias ${PROJECT_DIR}/data/staticfiles/;
        expires 30d;
        access_log off;
    }

    # 反向代理到 gunicorn(Django 容器)
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_redirect off;
        proxy_connect_timeout 60s;
        proxy_read_timeout 60s;
    }

    client_max_body_size 10m;
}
NGINX_EOF
# 启用站点、禁用默认页
ln -sf /etc/nginx/sites-available/myblog /etc/nginx/sites-enabled/myblog
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable --now nginx

echo "==> [7/7] 配置防火墙（UFW），仅开放必要端口"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP
ufw allow 443/tcp       # HTTPS（后续 certbot 使用）
ufw --force enable
echo "    防火墙已启用，开放端口：22/80/443"

echo ""
echo "============================ 部署初始化完成 ============================"
echo "部署用户      : ${DEPLOY_USER}"
echo "项目目录      : ${PROJECT_DIR}"
echo "站点域名      : ${DOMAIN}"
echo "Docker 状态   : $(systemctl is-active docker)"
echo "Nginx 状态    : $(systemctl is-active nginx)"
echo "UFW 状态      : $(ufw status | head -1)"
echo ""
echo "接下来请在 GitHub 仓库配置以下 Secrets（Settings → Secrets and variables → Actions）："
echo "  GHCR_TOKEN         = 具有 write:packages / read:packages / workflow 权限的 PAT"
echo "  SSH_HOST           = 本服务器的公网 IP 或域名"
echo "  SSH_USER           = ${DEPLOY_USER}"
echo "  SSH_PRIVATE_KEY    = 你本地的私钥内容（C:\\Users\\46884\\.ssh\\id_ed25519 文件全文）"
echo ""
echo "DNS 提醒：请将域名 ${DOMAIN} 的 A 记录指向本服务器公网 IP。"
echo "随后向 main 分支推送一次代码，即可触发 CD 自动部署。"
echo "======================================================================="
