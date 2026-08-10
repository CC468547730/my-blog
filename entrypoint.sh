#!/bin/sh
set -e

echo "==> 等待数据库就绪"
# 仅当配置了 DATABASE_URL（PostgreSQL）时才等待连接；
# 本地使用 SQLite（无 DATABASE_URL）则跳过等待，直接迁移。
if [ -n "$DATABASE_URL" ]; then
  python - <<'PY'
import os
import time
import urllib.parse

from psycopg import connect
from psycopg.errors import OperationalError

url = urllib.parse.urlparse(os.environ["DATABASE_URL"])
kwargs = {
    "dbname": url.path.lstrip("/"),
    "user": url.username,
    "password": url.password,
    "host": url.hostname,
    "port": url.port or 5432,
}

for attempt in range(30):
    try:
        conn = connect(**kwargs)
        conn.close()
        print("    数据库已可连接")
        break
    except OperationalError as exc:
        print(f"    数据库暂未就绪（第 {attempt + 1}/30 次重试）：{exc}")
        time.sleep(2)
else:
    print("    错误：等待数据库超时，放弃启动")
    exit(1)
PY
else
  echo "    未配置 DATABASE_URL，使用本地 SQLite，跳过等待"
fi

echo "==> 执行数据库迁移"
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
