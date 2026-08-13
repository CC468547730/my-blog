#!/bin/sh
# ============================================================
# My-Blog 服务器一键部署脚本（Docker Compose 模式）
# 适用环境：已装 Docker + 宿主 PostgreSQL + Nginx 的 Linux 服务器
# 网络模式：host（容器直连宿主 127.0.0.1:5432 的 PostgreSQL）
# 镜像来源：服务器本地 build（my-blog:local），规避 GHCR 拉取超时
# 约定项目目录：/home/ubuntu/my-blog（与 myblog.nginx.conf 的 alias 一致）
# 说明：本脚本不在本地执行，仅上传到服务器后运行；不提交任何密钥。
# ============================================================

set -e

# ---------------------- 可配置变量 ----------------------
PROJECT_DIR="/home/ubuntu/my-blog"        # 项目根目录（ubuntu 用户，按需修改）
DOMAIN="linkuphub.top"                     # 主域名
WWW_DOMAIN="www.linkuphub.top"            # 带 www 域名
DB_NAME="myblog"
DB_USER="myblog_user"
DB_PASSWORD="MyBlog_Passw0rd"
PG_HOST="127.0.0.1"
PG_PORT="5432"
# --------------------------------------------------------

echo "==> [1/7] 进入项目目录：$PROJECT_DIR"
if [ ! -d "$PROJECT_DIR" ]; then
  echo "    项目目录不存在，尝试自动 git 克隆（需服务器已配置仓库访问权限）"
  mkdir -p "$(dirname "$PROJECT_DIR")"
  # 如未配置 SSH 部署密钥，请手动上传代码后再运行；此处克隆失败会中断并报错。
  git clone https://github.com/CC468547730/my-blog "$PROJECT_DIR" || { echo "错误：克隆失败，请手动上传代码到 $PROJECT_DIR"; exit 1; }
fi
cd "$PROJECT_DIR" || { echo "错误：无法进入项目目录 $PROJECT_DIR"; exit 1; }

# ---------------------- 可选：建库建用户 ----------------------
# 若宿主 PostgreSQL 尚未创建业务库，可取消下面注释并确保 psql 可用。
# 默认跳过（假设库已存在）；如需自动建库，将 SKIP_DB_INIT 设为 false。
SKIP_DB_INIT=true
if [ "$SKIP_DB_INIT" = "false" ]; then
  echo "==> [1.1] 初始化宿主 PostgreSQL 业务库（首次部署才需要）"
  # 使用宿主 postgres 超级用户执行；若密码认证失败请改用 sudo -u postgres psql
  PGPASSWORD="$DB_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    PGPASSWORD="$DB_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -c "CREATE DATABASE $DB_NAME;"
  PGPASSWORD="$DB_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
    PGPASSWORD="$DB_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
  PGPASSWORD="$DB_PASSWORD" psql -h "$PG_HOST" -p "$PG_PORT" -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
  echo "    业务库初始化完成"
fi

# ---------------------- 准备 .env ----------------------
echo "==> [2/7] 准备 .env（仅在不存在时从模板复制，避免覆盖真实密钥）"
if [ ! -f .env ]; then
  cp .env.example .env
  # 注入强随机 SECRET_KEY 并把域名写入 ALLOWED_HOSTS
  SECRET_KEY=$(python3 -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())")
  sed -i "s/^SECRET_KEY=.*/SECRET_KEY=$SECRET_KEY/" .env
  sed -i "s/^ALLOWED_HOSTS=.*/ALLOWED_HOSTS=localhost,127.0.0.1,$DOMAIN,$WWW_DOMAIN/" .env
  echo "    已生成 .env（SECRET_KEY 随机注入，ALLOWED_HOSTS 含域名）"
else
  echo "    .env 已存在，保留现有配置（不覆盖密钥）"
fi
grep -E '^SECRET_KEY=|^DEBUG=|^ALLOWED_HOSTS=' .env

# ---------------------- 构建并启动 ----------------------
echo "==> [3/7] 拉取最新代码并本地构建镜像（entrypoint 自动 migrate + collectstatic）"
git pull origin main || true
docker compose --env-file .env build --no-cache
docker compose --env-file .env up -d
docker compose ps

# ---------------------- 查看启动日志 ----------------------
echo "==> [4/7] 查看 web 容器启动日志（确认迁移/collectstatic/gunicorn 无报错）"
docker compose logs --tail=50 web

# ---------------------- 配置 Nginx ----------------------
echo "==> [5/7] 配置 Nginx 反代 + 静态直出（首次部署执行）"
if [ ! -L /etc/nginx/sites-enabled/myblog ]; then
  sudo cp myblog.nginx.conf /etc/nginx/sites-available/myblog
  sudo ln -sf /etc/nginx/sites-available/myblog /etc/nginx/sites-enabled/myblog
  sudo nginx -t && sudo systemctl reload nginx
  echo "    Nginx 配置已生效"
else
  echo "    Nginx 站点已存在，跳过（如需更新配置请手动 cp + reload）"
fi

# ---------------------- 启用 HTTPS ----------------------
echo "==> [6/7] 申请并启用 HTTPS（certbot）"
if ! command -v certbot >/dev/null 2>&1; then
  sudo apt install -y certbot python3-certbot-nginx
fi
sudo certbot --nginx -d "$DOMAIN" -d "$WWW_DOMAIN" || echo "    警告：certbot 失败，请手动处理证书（或域名未解析到本机）"

# ---------------------- 验证 ----------------------
echo "==> [7/7] 部署验证"
echo "    首页状态码："
curl -s -o /dev/null -w "      HTTP %{http_code}\n" "https://$DOMAIN/"
echo "    助理页状态码："
curl -s -o /dev/null -w "      HTTP %{http_code}\n" "https://$DOMAIN/assistant/"

echo "==> 部署脚本执行完毕。若状态码为 200 即成功；否则查看上方日志与 Nginx error.log。"
