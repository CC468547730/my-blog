# My-Blog

一个基于 Django 的个人博客项目，支持文章浏览、后台管理、用户系统，并带有品牌专属「助理」通道页、全局 Logo、分页越界可爱提示页等定制功能。

技术栈：Django 5.2 + SQLite + Gunicorn + Nginx（可纯 Nginx/systemd 部署，无需 Docker）。

---

## 目录结构

```
My-Blog/
├── blog/               # 博客主应用（视图、模板、静态）
├── users/             # 用户系统应用
├── myblog/            # 项目配置（settings / urls / wsgi）
├── static/            # 项目级静态文件（CSS、图片）
├── templates/         # 全局模板
├── db.sqlite3         # SQLite 数据库（本地开发）
├── requirements.txt   # Python 依赖
├── start.sh           # Linux 启动脚本
├── start.bat          # Windows 启动脚本
├── myblog.service     # systemd 服务单元
├── myblog.nginx.conf  # Nginx 反代 + 静态直出配置
├── DEPLOY.md          # 完整部署文档（非 Docker）
└── manage.py
```

---

## 本地开发

```bash
cd My-Blog
python -m venv venv
source venv/bin/activate        # Windows: .\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

访问 http://127.0.0.1:8000

---

## 生产部署（非 Docker，从 0 到 1）

完整版见 [DEPLOY.md](./DEPLOY.md)。要点如下：

### 架构
`Nginx`（反代 + 静态直出）→ `gunicorn` → `Django`（SQLite）

### 部署文件
| 文件 | 说明 |
|------|------|
| `requirements.txt` | 依赖（含 gunicorn） |
| `start.sh` | Linux 一键启动（迁移 + collectstatic + gunicorn） |
| `start.bat` | Windows 启动脚本（演示用） |
| `myblog.service` | systemd 服务单元（开机自启 + 崩溃重启） |
| `myblog.nginx.conf` | Nginx 反代 + 静态直出配置 |

约定项目路径：`/opt/my-blog`。

### 步骤概览

1. **准备环境**
   ```bash
   sudo apt update && sudo apt install -y python3 python3-venv nginx
   ```

2. **上传项目**到 `/opt/my-blog`（git 或打包上传）。

3. **虚拟环境 + 依赖**
   ```bash
   cd /opt/my-blog
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **环境变量**（必做，settings 已支持读取）
   - `DEBUG=False`
   - `SECRET_KEY`：用 `python3 -c "import secrets;print(secrets.token_urlsafe(50))"` 生成
   - `ALLOWED_HOSTS`：你的域名/IP，逗号分隔
   - 建议在 `myblog.service` 的 `Environment=` 中集中填写。

5. **初始化**
   ```bash
   python manage.py migrate --noinput
   python manage.py collectstatic --noinput
   python manage.py createsuperuser   # 可选
   ```

6. **systemd 自启**：改 `myblog.service` 的 `User`/`Group`/`Environment` 后
   ```bash
   chmod +x /opt/my-blog/start.sh
   sudo cp /opt/my-blog/myblog.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now myblog.service
   ```

7. **Nginx**：改 `myblog.nginx.conf` 的 `server_name` 与 `alias` 路径后
   ```bash
   sudo cp /opt/my-blog/myblog.nginx.conf /etc/nginx/conf.d/myblog.conf
   sudo nginx -t && sudo systemctl reload nginx
   ```

8. **（可选）HTTPS**：`sudo certbot --nginx -d 你的域名`，或使用 1Panel 申请证书。

### 1Panel 用户
可在「运行环境」托管 Python（启动命令 `gunicorn myblog.wsgi:application --bind 0.0.0.0:8000`），再建「反向代理」网站指向 `127.0.0.1:8000`，并在配置中补充 `/static/`、`/media/` 两段 location。详见 [DEPLOY.md](./DEPLOY.md) 第 9 章。

### 检查清单
- [ ] `DEBUG=False`、`SECRET_KEY`（非默认）、`ALLOWED_HOSTS` 已设
- [ ] `migrate` + `collectstatic` 已执行，`staticfiles/`、`media/` 可写
- [ ] `myblog.service` active(running)
- [ ] Nginx `nginx -t` 通过，域名解析到位，防火墙放行 80/443
- [ ] （推荐）已启用 HTTPS

---

## 自定义功能说明

- **全局 Logo**：前台导航、后台侧边栏、favicon 均使用 `static/img/logo.png`。
- **导航「助理」通道**：`/assistant/` 品牌专属页（深色星空 + 金色锁孔动画，纯 CSS）。
- **分页越界提示**：访问超出总页数的页码（如 `?page=999`）显示可爱插画提示页。
- **footer 用户名**：后台 footer 显示当前登录用户名。

---

## 许可证

个人项目，仅供学习使用。
