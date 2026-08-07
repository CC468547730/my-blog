@echo off
REM ============================================================
REM  My-Blog 启动脚本 (Windows, 不走 Docker)
REM  用法：直接双击，或在项目根目录执行 start.bat
REM ============================================================
cd /d %~dp0

REM ---------- 可修改的配置 ----------
set DEBUG=False
set SECRET_KEY=请换成一段随机长字符串，例如用 python -c "import secrets;print(secrets.token_urlsafe(50))"
set ALLOWED_HOSTS=localhost,127.0.0.1,你的服务器IP或域名
set BIND=0.0.0.0:8000
REM -----------------------------------

REM 若未激活虚拟环境，可取消下一行注释
REM call .\venv\Scripts\activate.bat

echo [1/3] 数据库迁移...
python manage.py migrate --noinput

echo [2/3] 收集静态文件...
python manage.py collectstatic --noinput

echo [3/3] 启动 gunicorn (%BIND%)...
gunicorn myblog.wsgi:application --bind %BIND% --workers 3 --timeout 60

pause
