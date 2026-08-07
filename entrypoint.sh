#!/bin/sh
set -e

echo "==> 等待数据库文件就绪"
# SQLite 无需等待，直接执行迁移
python manage.py migrate --noinput

echo "==> 收集静态文件"
python manage.py collectstatic --noinput

echo "==> 启动 gunicorn"
exec gunicorn myblog.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 60 \
    --access-logfile - \
    --error-logfile -
