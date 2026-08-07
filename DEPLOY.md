# My-Blog 部署文档（非 Docker 方式）

本文档面向 **Linux 服务器**（含 1Panel 环境），从 0 到 1 部署 My-Blog。
部署架构：`Nginx` 反代 + 静态文件直出 → `gunicorn` → `Django`(sqlite)。
不依赖 Docker 容器。

---

## 0. 架构与文件清单

| 组件 | 作用 |
|------|------|
| Nginx | 对外暴露 80/443，直出静态文件，反代动态请求 |
| gunicorn | WSGI 服务，运行 Django 应用 |
| Django | 博客应用，sqlite 数据库 |
| systemd | 进程托管，开机自启 + 崩溃重启 |

项目已附带的部署文件：

| 文件 | 说明 |
|------|------|
| `requirements.txt` | 依赖（含 gunicorn） |
| `start.sh` | Linux 一键启动脚本（迁移 + collectstatic + gunicorn） |
| `start.bat` | Windows 启动脚本（演示用） |
| `myblog.service` | systemd 服务单元 |
| `myblog.nginx.conf` | Nginx 反代 + 静态直出配置 |

约定路径：**项目根目录 = `/opt/my-blog`**。若不同，请同步修改 `start.sh`、`myblog.service`、`myblog.nginx.conf` 中的路径。

---

## 1. 准备服务器环境

系统：Ubuntu 20.04+ / Debian 11+（其他发行版同理）。

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Python 与 pip、venv、Nginx
sudo apt install -y python3 python3-pip python3-venv nginx
```

确认 Python 版本 ≥ 3.10：
```bash
python3 --version
```

---

## 2. 上传项目到服务器

方式 A：git 拉取（推荐）
```bash
git clone <你的仓库地址> /opt/my-blog
cd /opt/my-blog
```

方式 B：本地打包上传（scp / 1Panel 文件管理）
```bash
# 本地（PowerShell）打包
cd d:/pytproject/My-Blog
Compress-Archive -Path . -DestinationPath myblog.zip
# 用 scp 或 1Panel 上传到服务器 /opt/my-blog 并解压
```

> 注意：`.gitignore` 已忽略 `db.sqlite3`、`__pycache__`、`generated-images` 等；
> 上传后需在服务器执行迁移重新生成数据库，无需携带本地 db。

---

## 3. 创建虚拟环境与安装依赖

```bash
cd /opt/my-blog
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

安装完成后验证 Django 版本应为 5.2.x：
```bash
python manage.py --version
```

---

## 4. 配置环境变量（必做）

生产环境必须设置以下三项（项目 settings 已支持读取）：

| 变量 | 说明 | 示例 |
|------|------|------|
| `DEBUG` | 必须为 `False` | `False` |
| `SECRET_KEY` | 随机长字符串，切勿用默认值 | 见下生成命令 |
| `ALLOWED_HOSTS` | 允许访问的域名/IP，逗号分隔 | `blog.example.com,1.2.3.4` |

生成强密钥：
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(50))"
```

**集中管理建议**：在 `myblog.service` 的 `[Service]` 段用 `Environment=` 写入（见第 6 步），
同时把 `start.sh` 里的 `export` 行删掉，避免重复。

---

## 5. 首次初始化（迁移 + 静态文件）

激活虚拟环境后执行：
```bash
cd /opt/my-blog
source venv/bin/activate
python manage.py migrate --noinput          # 建表
python manage.py collectstatic --noinput     # 收集静态到 staticfiles/
python manage.py createsuperuser            # 创建后台管理员（可选）
```

---

## 6. 配置 systemd 开机自启

编辑 `myblog.service`，至少修改三处：
- `WorkingDirectory`：项目路径
- `User` / `Group`：运行用户（如 `www`，需对 `db.sqlite3`、`media/`、`staticfiles/` 有写权限）
- `Environment`：填入真实 `SECRET_KEY` 与 `ALLOWED_HOSTS`

```bash
# 赋予脚本执行权限
chmod +x /opt/my-blog/start.sh

# 安装服务
sudo cp /opt/my-blog/myblog.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable myblog.service
sudo systemctl start myblog.service
```

查看状态与日志：
```bash
sudo systemctl status myblog.service
sudo journalctl -u myblog.service -f
```

> 重启（代码更新后）：`sudo systemctl restart myblog.service`

---

## 7. 配置 Nginx 反向代理 + 静态直出

把 `myblog.nginx.conf` 中的 `server_name your-domain.com;` 改成你的域名/IP，
确认 `alias` 路径与项目一致，然后：

```bash
sudo cp /opt/my-blog/myblog.nginx.conf /etc/nginx/conf.d/myblog.conf
sudo nginx -t          # 测试配置语法
sudo systemctl reload nginx
```

关键点：
- `/media/` 直出 `MEDIA_ROOT`（`/opt/my-blog/media`）
- `/static/` 直出 `STATIC_ROOT`（`/opt/my-blog/staticfiles`）
- `location /` 反代到 `127.0.0.1:8000`（gunicorn）
- 已带 `X-Forwarded-Proto` 等头，Django 能正确识别协议

---

## 8. （可选）启用 HTTPS

1Panel 用户：在网站设置里「申请证书」并开启强制 HTTPS 即可。

纯 Nginx 用户用 certbot：
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```
certbot 会自动改写配置、开启 443 并配置强制跳转。

---

## 9. 1Panel 用户专用（图形化替代 6/7 步）

若使用 1Panel，可跳过手写 systemd / Nginx 文件，改用界面托管：

1. **运行环境**：应用商店 / 运行环境 → 新建 Python 环境，目录选 `/opt/my-blog`，
   启动命令 `gunicorn myblog.wsgi:application --bind 0.0.0.0:8000`，
   依赖文件 `requirements.txt`，环境变量填 `DEBUG/SECRET_KEY/ALLOWED_HOSTS`。
2. **网站**：创建网站 → 反向代理，主域名填你的域名，代理地址 `http://127.0.0.1:8000`。
3. 在网站「配置文件」中补充 `/media/` 与 `/static/` 两段 `location`（参考 `myblog.nginx.conf`）。
4. 申请 SSL 证书并开启强制 HTTPS。

---

## 10. 部署检查清单

- [ ] 项目在 `/opt/my-blog`，虚拟环境 `venv` 已建
- [ ] `pip install -r requirements.txt` 成功，含 gunicorn
- [ ] `DEBUG=False`、`SECRET_KEY`（非默认）、`ALLOWED_HOSTS` 已设置
- [ ] `migrate` 与 `collectstatic` 已执行
- [ ] `staticfiles/` 与 `media/` 目录存在且运行用户可写
- [ ] `myblog.service` 已 `enable` + `start`，`status` 为 active(running)
- [ ] Nginx 配置 `nginx -t` 通过并已 reload
- [ ] 域名解析到服务器 IP，防火墙/安全组放行 80/443
- [ ] （推荐）已启用 HTTPS

访问 `http://你的域名` 验证首页；后台入口通常是导航内的「后台」链接。

---

## 11. 常见问题

**访问报 400 / Bad Request**
`ALLOWED_HOSTS` 未包含当前域名/IP。改 service 的 `Environment` 或 start.sh 后重启服务。

**静态文件 404（DEBUG=False 时）**
没跑 `collectstatic`，或 Nginx 的 `/static/` alias 路径不对。重跑 `collectstatic` 并 reload nginx。

**上传图片 403 / 500**
`media/` 目录不存在或运行用户无写权限。建目录并 `chown` 给运行用户。

**PermissionError on db.sqlite3**
运行用户（如 `www`）对 `/opt/my-blog` 或 `db.sqlite3` 无写权限：
```bash
sudo chown -R www:www /opt/my-blog
```

**sqlite 并发写冲突**
个人博客访问量小无碍；多人高频写入建议后期迁移到 PostgreSQL。
