---
name: server-initialization-guide
overview: 修复 server-init.sh（补充 Nginx 安装），修复 nginx.conf 路径，然后分步指导用户完成服务器初始化全流程。
todos:
  - id: fix-local-files
    content: 修复 server-init.sh（新增 Nginx 安装配置防火墙步骤）和 myblog.nginx.conf（修正域名和静态路径）
    status: completed
  - id: push-fixes
    content: 推送修复后的文件到 GitHub main 分支
    status: completed
    dependencies:
      - fix-local-files
  - id: ssh-connect
    content: 指导通过 SSH 连接服务器 root 用户
    status: completed
    dependencies:
      - push-fixes
  - id: upload-run-script
    content: 上传 server-init.sh 到服务器并以 root 执行，完成 Docker+Nginx+deploy 用户+SSH 公钥+.env 全流程初始化
    status: completed
    dependencies:
      - ssh-connect
  - id: config-dns-secrets-env
    content: 配置 DNS A 记录（linkuphub.top→服务器IP）、修改服务器 .env 中 ALLOWED_HOSTS、配置 GitHub 4 个 Secrets
    status: completed
    dependencies:
      - upload-run-script
  - id: trigger-deploy
    content: 向 main 推送触发 CI/CD，观察 GitHub Actions 流程并验证服务器部署结果
    status: completed
    dependencies:
      - config-dns-secrets-env
---

## 产品概述

将 My-Blog 项目从本地代码仓库完整部署到一台全新的 Ubuntu 24.04 服务器，域名 linkuphub.top，通过 GitHub Actions 实现 CI/CD 自动化：推送代码 → 自动检查测试 → 构建 Docker 镜像推送 GHCR → SSH 远程部署。此计划包含本地脚本修复、服务器初始化、GitHub Secrets 配置、DNS 解析和首次部署验证的全流程。

## 核心修复内容

1. **server-init.sh 补全 Nginx 安装**：新增一步自动安装 Nginx、生成站点配置文件、开放 80/443 防火墙端口
2. **myblog.nginx.conf 修正**：server_name 改为 linkuphub.top www.linkuphub.top，静态文件路径修正为 /home/deploy/my-blog/data/
3. **服务器逐项操作指导**：从 SSH 连接开始，上传脚本执行，调整 .env，配置 DNS，配置 GitHub Secrets，触发首次部署并验证

## 技术栈

- 服务器：Ubuntu 24.04 LTS
- 容器化：Docker Engine + Docker Compose Plugin
- 反向代理：Nginx（监听 80 → 代理 Gunicorn :8000）
- 应用容器：Python 3.12-slim / Gunicorn 3 workers
- CI/CD：GitHub Actions（ci.yml 检查 + deploy.yml 构建镜像推送 GHCR + appleboy/ssh-action 远程部署）
- 镜像仓库：GHCR（ghcr.io/cc468547730/my-blog）

## 实现方案

### 第一阶段：本地修复 & 推送

修改两个文件后 push 到 GitHub main 分支：

- `scripts/server-init.sh`：将原 6 步扩展为 7 步，新增 [6/7] Nginx 安装 + 配置 + 防火墙
- `myblog.nginx.conf`：修正 server_name 为域名、静态路径对齐实际部署目录

### 第二阶段：服务器初始化

用户在 PowerShell 通过 SSH 连接服务器 root 用户，上传 server-init.sh 并执行。脚本自动完成：

1. 系统更新 + 基础依赖
2. 安装 Docker Engine + Compose 插件
3. 创建 deploy 用户 + 加入 docker 组
4. 写入 SSH 公钥（实现 GitHub Actions 免密登录）
5. 创建项目目录 + 生成 .env（含随机 SECRET_KEY）
6. **新增**：安装 Nginx + 写入站点配置 + ufw 防火墙放行 80/443
7. 输出 Secrets 配置提示

### 第三阶段：DNS + Secrets + 首次部署

- DNS 添加 A 记录：linkuphub.top → 服务器 IP
- GitHub 仓库配置 4 个 Actions Secrets
- 修改服务器 .env 中 ALLOWED_HOSTS 为真实域名
- push 触发 CI → CD → 验证部署

## 关键修改说明

### server-init.sh 新增步骤 [6/7]

```
echo "==> [6/7] 安装 Nginx 并配置反向代理"
apt-get install -y nginx
# 写入站点配置（域名 + 静态路径已内嵌）
cat > /etc/nginx/sites-available/my-blog <<'NGINXCONF'
server {
    listen 80;
    server_name linkuphub.top www.linkuphub.top;
    location /media/  { alias /home/deploy/my-blog/data/media/; }
    location /static/ { alias /home/deploy/my-blog/data/staticfiles/; }
    location / { proxy_pass http://127.0.0.1:8000; ... }
}
NGINXCONF
ln -sf /etc/nginx/sites-available/my-blog /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
# 防火墙
ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 22/tcp
ufw --force enable
```

### myblog.nginx.conf 修正

- `server_name your-domain.com` → `server_name linkuphub.top www.linkuphub.top`
- `/opt/my-blog/media/` → `/home/deploy/my-blog/data/media/`
- `/opt/my-blog/staticfiles/` → `/home/deploy/my-blog/data/staticfiles/`

## 目录结构（仅展示变更文件）

```
d:/pytproject/My-Blog/
├── scripts/
│   └── server-init.sh        # [MODIFY] 新增步骤6 Nginx安装+配置+防火墙，步骤总数6→7
├── myblog.nginx.conf          # [MODIFY] server_name改为linkuphub.top，静态路径改为/home/deploy/my-blog/data/
```