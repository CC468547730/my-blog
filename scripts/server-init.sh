#!/usr/bin/env bash
#
# 服务器一键初始化脚本（Ubuntu / Debian 系）
# 用途：为 GitHub Actions 自动部署准备目标服务器环境
# 使用方法：
#   1. 将本脚本与本地公钥 id_ed25519.pub 一同上传到服务器（或手动替换下方 PUBKEY 变量）
#   2. 以 root 或具有 sudo 权限的用户执行： bash server-init.sh
#   3. 执行完成后，在 GitHub 仓库配置 Secrets（见脚本末尾说明）
#
# 注意（权限划分说明）：
#   - 【初始化阶段】本脚本仅需由 root（或具 sudo 权限用户）执行一次，
#     用于安装 Docker / Nginx、创建部署用户、注入公钥、生成 .env、配置防火墙。
#   - 【部署阶段】脚本运行完成后，GitHub Actions 通过 appleboy/ssh-action
#     以 deploy 用户（非 root）登录，使用你本地的私钥拉取镜像并运行容器，
#     全程不使用 root 权限部署业务。
#   - 本脚本会创建 deploy 用户并加入 docker 组，使其可无 sudo 执行 docker 命令
#   - 部署公钥已内置在 PUBKEY 变量中，如需更换请替换该值

set -euo pipefail

# ====================== 可配置变量 ======================
DEPLOY_USER="deploy"
PROJECT_DIR="/home/${DEPLOY_USER}/my-blog"
# 站点域名（同时也写入 .env 的 ALLOWED_HOSTS）
DOMAIN="linkuphub.top"
# 本地公钥内容（由 scripts/gen_ssh_key 流程生成，已内置）
PUBKEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIJCYuoMuJDFscfWfN/pTYo4r0zbwlF7oAngu3SLj8YIg github-actions-deploy"
# ==================== 结束可配置变量 ====================

echo "==> [1/7] 更新系统并安装基础依赖"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg lsb-release openssh-server ufw

echo "==> [2/7] 安装 Docker Engine 与 Docker Compose 插件"
# 若已安装则跳过
if ! command -v docker >/dev/null 2>&1; then
    install -m 0755 -d /etc/apt/keyrings
    # 使用腾讯云镜像源（国内可用，避免 download.docker.com 被重置）
    curl -fsSL https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://mirrors.cloud.tencent.com/docker-ce/linux/ubuntu ${CODENAME} stable" > /etc/apt/sources.list.d/docker.list
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

# PostgreSQL 数据库配置（采用宿主机原生 PostgreSQL，不依赖 Docker 镜像，
# 因服务器网络无法访问 Docker Hub 拉取 postgres 镜像）
# host.docker.internal 通过 compose 的 extra_hosts 映射到宿主机网关，
# 使 web 容器能访问宿主机上的 PostgreSQL 服务
DB_NAME=myblog
DB_USER=myblog_user
DB_PASSWORD=MyBlog_Passw0rd
DATABASE_URL=postgresql://myblog_user:MyBlog_Passw0rd@host.docker.internal:5432/myblog
EOF
chown -R "${DEPLOY_USER}:" "${PROJECT_DIR}"
echo "    已生成 .env，ALLOWED_HOSTS 已预填 ${DOMAIN}"

echo "==> [5.5/7] 安装宿主机原生 PostgreSQL 并初始化数据库"
# 采用腾讯云内网 apt 源（已验证可用），避免访问 Docker Hub 拉取 postgres 镜像
if ! command -v psql >/dev/null 2>&1; then
    apt-get install -y postgresql postgresql-contrib
fi
systemctl enable --now postgresql
PGVER=$(ls /etc/postgresql/)
# 若数据库/用户不存在则创建（幂等，重跑脚本不报错）
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='myblog_user'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE USER myblog_user WITH PASSWORD 'MyBlog_Passw0rd';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='myblog'" | grep -q 1 || \
    sudo -u postgres psql -c "CREATE DATABASE myblog OWNER myblog_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE myblog TO myblog_user;"
# 配置 pg_hba.conf 允许 127.0.0.1 / ::1 的 TCP md5 连接（Django 经 host.docker.internal 以 TCP 连入）
HBA=/etc/postgresql/$PGVER/main/pg_hba.conf
sed -i 's/^host.*all.*all.*127.0.0.1\/32.*trust/host    all    all    127.0.0.1\/32    md5/' "$HBA"
sed -i 's/^host.*all.*all.*::1\/128.*trust/host    all    all    ::1\/128    md5/' "$HBA"
# 兜底：若上一步未命中（原本是 peer/scram），强制追加 TCP md5 规则（去重）
grep -q "127.0.0.1/32    md5" "$HBA" || echo "host    all    all    127.0.0.1/32    md5" >> "$HBA"
grep -q "::1/128    md5" "$HBA" || echo "host    all    all    ::1/128    md5" >> "$HBA"
systemctl restart postgresql
# 验证 TCP 连接可用
PGPASSWORD='MyBlog_Passw0rd' psql -h 127.0.0.1 -U myblog_user -d myblog -c "SELECT 1;" >/dev/null 2>&1 \
    && echo "    PostgreSQL TCP 连接验证成功" \
    || echo "    [警告] PostgreSQL TCP 连接验证失败，请检查 pg_hba.conf"
chown -R "${DEPLOY_USER}:" "${PROJECT_DIR}"
echo "    已安装并初始化 PostgreSQL（库:myblog / 用户:myblog_user）"

echo "==> [5.6/7] 写入 docker-compose.yml（镜像来自 GHCR，由 CI 推送）"
# 说明：CD 部署脚本执行 `docker compose pull && up`，
# 因此服务器上必须存在 docker-compose.yml 与 .env 才能拉起容器。
# 镜像由 GitHub Actions 构建并推送至 ghcr.io，无需在服务器本地 build。
# 注意：数据库采用宿主机 PostgreSQL（非容器），故 compose 中不含 db 服务，
# web 服务通过 extra_hosts 的 host.docker.internal 访问宿主机 5432 端口。
cat > "${PROJECT_DIR}/docker-compose.yml" <<COMPOSE_EOF
services:
  web:
    image: ghcr.io/cc468547730/my-blog:latest
    container_name: my-blog
    ports:
      - "8000:8000"
    env_file:
      - .env
    environment:
      DEBUG: "False"
      SECRET_KEY: "\${SECRET_KEY}"
      ALLOWED_HOSTS: "localhost,127.0.0.1,${DOMAIN},www.${DOMAIN}"
      DATABASE_URL: "\${DATABASE_URL}"
    volumes:
      - ./data/staticfiles:/app/staticfiles
      - ./data/media:/app/media
    # 让容器可通过 host.docker.internal 访问宿主机服务（PostgreSQL 等）
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000')"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s
COMPOSE_EOF
chown -R "${DEPLOY_USER}:" "${PROJECT_DIR}"
echo "    已写入 docker-compose.yml（镜像源 ghcr.io/cc468547730/my-blog:latest，数据库走宿主机）"

echo "==> [5.7/7] 预创建 data/ 持久化目录（静态文件 / 上传文件）"
# 这些目录会被 docker-compose.yml 挂载到容器内，提前创建避免首次启动权限/缺失问题
# 注意：PostgreSQL 已改为宿主机原生安装，不再需要 data/postgres 目录
install -d -m 755 "${PROJECT_DIR}/data/staticfiles" "${PROJECT_DIR}/data/media"
chown -R "${DEPLOY_USER}:" "${PROJECT_DIR}/data"
echo "    已创建 data/{staticfiles,media} 持久化目录"

# 修复 Nginx(www-data) 访问静态文件权限：
# /home/deploy 默认权限为 750(drwxr-x---)，其他用户(含 www-data)无 traverse 权限，
# 会导致 Nginx 的 location /static/ 与 /media/ 全部返回 403 Forbidden。
# 给部署根目录链加上 o+x，使 www-data 可进入并读取静态/上传文件（不改变属主）。
chmod 755 "$(dirname "${PROJECT_DIR}")"
chmod -R 755 "${PROJECT_DIR}/data/staticfiles" "${PROJECT_DIR}/data/media"
echo "    已修复静态/上传目录遍历权限（避免 Nginx 403）"

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
# 说明：本机采用 Docker 部署，docker-compose 已将容器 8000 端口发布到宿主机 8000。
# Docker 会自行向 iptables 注入转发规则，因此对外只需开放 80/443（由宿主机 Nginx 反代），
# 无需对外暴露 8000；UFW 仅作为宿主机入站兜底策略。
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP（Nginx 对外提供）
ufw allow 443/tcp       # HTTPS（后续 certbot 使用）
ufw --force enable
echo "    防火墙已启用，开放端口：22/80/443（容器 8000 仅经 Nginx 反代，未对外暴露）"

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
echo "  SSH_PRIVATE_KEY    = 你本地的私钥内容（C:\\Users\\46884\\.ssh\\id_ed25519_deploy 文件全文）"
echo ""
echo "DNS 提醒：请将域名 ${DOMAIN} 的 A 记录指向本服务器公网 IP。"
echo "随后向 main 分支推送一次代码，即可触发 CD 自动部署。"
echo "======================================================================="
