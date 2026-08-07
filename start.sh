#!/usr/bin/env bash
# ============================================================
#  My-Blog 启动脚本 (Linux, 不走 Docker)
#  用法：chmod +x start.sh && ./start.sh
# ============================================================
set -e
cd "$(dirname "$0")"

# ---------- 可修改的配置 ----------
export DEBUG=False
export SECRET_KEY="请换成一段随机长字符串，例如用 python -c 'import secrets;print(secrets.token_urlsafe(50))'"
export ALLOWED_HOSTS="localhost,127.0.0.1,你的服务器IP或域名"
BIND="0.0.0.0:8000"
# -----------------------------------

# 若使用虚拟环境，取消下一行注释
# source ./venv/bin/activate

echo "[1/3] 数据库迁移..."
python manage.py migrate --noinput

echo "[2/3] 收集静态文件..."
python manage.py collectstatic --noinput

echo "[3/3] 启动 gunicorn ($BIND)..."
exec gunicorn myblog.wsgi:application --bind "$BIND" --workers 3 --timeout 60
