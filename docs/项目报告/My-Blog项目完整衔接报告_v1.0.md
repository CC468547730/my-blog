# My-Blog 项目完整衔接报告（v1.0）

> 文档版本：v1.0
> 生成日期：2026-08-13
> 适用对象：新加入项目的开发者
> 文档定位：架构总览 + 功能清单 + 核心逻辑 + URL 清单 + 开发/运维指引 + 待办事项

---

## 一、项目概况

My-Blog 是一个基于 **Django 5 + 传统 MTV 模板开发** 的个人/技术博客系统，包含文章发布、分类标签、评论审核、自定义后台 Dashboard，以及一个**纯前端办公室工具箱（AI助理页）**。

| 维度 | 说明 |
|------|------|
| 后端框架 | Django 5.0+（传统模板渲染，未使用 DRF） |
| 前端 | Django 模板 + Bootstrap 5 + 原生 JS + 少量 jQuery |
| 数据库 | SQLite（本地）/ PostgreSQL（生产，经 `DATABASE_URL` 自动切换） |
| 部署 | 双轨：Nginx + Gunicorn + systemd（主推，见 `DEPLOY.md`）/ Docker Compose（可选） |
| 认证 | Django 内置 Session 认证 + 双会话机制（前台用户 / 后台管理员会话隔离） |
| CI/CD | GitHub Actions（`.github/workflows/ci.yml` + `deploy.yml`） |

---

## 二、目录结构与核心模块

```
My-Blog/
├── manage.py                  # Django 入口
├── myblog/                    # 项目配置包
│   ├── settings.py            # 全局配置（DATABASE_URL 切换、HTTPS 反代、日志）
│   ├── urls.py                # 根路由（accounts/ + blog/）
│   └── wsgi.py / asgi.py
├── blog/                      # 主应用（博客 + 助理工具箱）
│   ├── models.py              # Category / Tag / Article / Comment
│   ├── views.py               # 视图层（薄视图，约 41 个视图/类）
│   ├── urls.py                # 路由（app_name='blog'，54 条）
│   ├── forms.py               # CommentForm（服务端校验）
│   ├── comment_service.py     # 评论服务层（薄服务）
│   ├── context_processors.py  # 全局注入待审核评论数
│   └── templates/blog/        # 模板（含 assistant.html 工具箱）
├── users/                     # 用户应用（注册 / 登录 / 登出）
│   ├── views.py               # RegisterView / CustomLoginView / CustomLogoutView
│   └── urls.py                # app_name='users'（register / login / logout）
├── static/                    # 静态资源（js/ 含 qrcode.min.js、marked.min.js、assistant.js）
├── templates/                 # 全局基础模板
├── docs/                      # 文档（运维指南、本报告）
├── requirements.txt           # 依赖清单
├── Dockerfile / docker-compose.yml / entrypoint.sh
└── .github/workflows/         # CI/CD
```

---

## 三、数据模型（blog/models.py）

| 模型 | 关键字段 | 说明 |
|------|---------|------|
| `Category` | name, slug, description, order | 文章分类 |
| `Tag` | name, slug | 文章标签 |
| `Article` | title, slug, content(markdown), category, tags, author, status, created_at | 文章主体，支持 Markdown |
| `Comment` | article, author_name, content, status, created_at | 评论，状态常量 `PENDING/APPROVED/REJECTED`，复合索引 `idx_comment_art_status` |

表名约定：`db_table` 使用 `blog_xxx`（如 `blog_comments`）。

---

## 四、权限与认证体系

| 装饰器 | 位置 | 规则 |
|--------|------|------|
| `@login_required` | Django 内置 | 任意已登录用户（用于 PDF 转 Word 等） |
| `staff_required` | `blog/views.py` | 需 `is_staff`，否则 403（后台管理） |
| `admin_required` | `blog/views.py` | 需 `is_superuser`（用户管理、评论审核） |

- `LOGIN_URL = 'users:login'`，未登录访问受保护视图跳转登录页。
- 前台文章页评论提交：`comment_create` 仅 `POST` + CSRF 保护。
- 双会话：前台用户与后台管理员会话隔离（中间件绑定 `request.is_admin_authenticated()`）。

---

## 五、核心功能与 URL 清单

### 5.1 前台（无需登录，除评论提交）
| URL | 视图 | 说明 |
|-----|------|------|
| `/` | ArticleListView | 文章列表（分页每页 5 篇） |
| `/article/<pk>/` | ArticleDetailView | 文章详情（Markdown 渲染） |
| `/article/<pk>/edit/` `/delete/` | 类视图 | 仅作者 |
| `/category/<pk or slug>/` | CategoryView | 分类筛选 |
| `/tag/<pk or slug>/` | TagView | 标签筛选 |
| `/article/<pk>/comment/` | comment_create | 提交评论（POST，CSRF） |
| `/assistant/` | assistant_view | AI 助理工具箱（纯前端，无需登录） |

### 5.2 后台 Dashboard（admin_required / staff_required）
`/dashboard/` 下含：首页、文章管理、分类管理、标签管理、用户管理（仅超管）、评论审核（`dashboard_comments/`、`moderate/`、`bulk-moderate/`）。

### 5.3 用户中心（users）
| URL | 视图 | 说明 |
|-----|------|------|
| `/accounts/register/` | RegisterView | 注册 |
| `/accounts/login/` | CustomLoginView | 登录（`LOGIN_URL`） |
| `/accounts/logout/` | CustomLogoutView | 登出 |

### 5.4 助理工具箱（assistant.html）
纯前端工具：时间戳、字数统计、JSON、颜色、密码、Base64、Markdown、年会抽奖、二维码、工作日、贷款月供、简易记账、数据图表；**后端工具：PDF 转 Word（需登录）**。

### 5.5 PDF 转 Word（本次新增 + 已增强）

| URL | 视图 | 方法 | 权限 |
|-----|------|------|------|
| `/assistant/pdf-to-word/` | `pdf_to_word_view` | POST | `@login_required` + `@require_POST` |

**功能增强（2026-08-13）**：
- **表格还原**：`pdfplumber.extract_tables()` 检测表格 → 还原为可编辑的 `docx` 表格（`Table Grid` 带边框样式），文字段落仍为普通段落，提升还原度。
- **ajax 交互**：前端 `assistant.js` 监听 `#pdfWordForm` submit，`preventDefault` 后使用 `XMLHttpRequest` 上传（`xhr.upload.onprogress` 实时进度条），成功以 `blob` 触发浏览器下载，失败将后端纯文本错误写入 `#pdfWordMsg`。
- **CSRF**：从表单隐藏域 `csrfmiddlewaretoken` 读取并随 `FormData` 发送，符合 Session 认证规范。
- **样式**：`assistant.css` 新增 `.progress` / `.progress-bar` / `.result-msg` 三类样式（成功绿、失败红）。
- **错误 JSON 化（2026-08-13 第二轮）**：后端失败分支统一返回 `application/json` 的 `{'success': false, 'message': '...'}`（HTTP 状态码保持 400/422/500）；成功分支仍为 `.docx` 二进制流下载（不包 JSON，避免下载破坏）。前端 `xhr.onload` 优先按 JSON 解析 `message`，回退纯文本。
- **图片型 PDF 优雅降级（2026-08-13 第二轮）**：若整篇 PDF 提取不到任何文字/表格（`has_content=False`），返回 `422 JSON` 明确提示"疑似图片型（扫描件）PDF，暂不支持 OCR"，不引入 OCR 重依赖（Poppler/Tesseract 系统库或 paddleocr/easyocr 大模型），保持部署轻量。
- **上传界面优化 + 宽度修复（2026-08-13 第三轮）**：
  - 上传区从原生 `<input type="file">` 改为 `.pdf-dropzone`（拖拽/点击/键盘 a11y）+ `.pdf-file-card`（已选文件预览卡片，含移除按钮）+ `.pdf-action-row`（独立操作行）。
  - 面板位置修复：将 `#panel-pdfword` 移入 `.tool-wrapper` 内部（受 `max-width: 880px` 约束），解决与各工具面板宽度不一致问题。
  - 涉及文件：`blog/templates/blog/assistant.html`、`static/js/assistant.js`、`static/css/assistant.css`；无新增 URL、无数据库迁移。
  - 详见：`docs/项目报告/PDF转Word上传界面优化开发报告_v1.1.md`。

---

## 六、开发/部署指引

1. **本地启动**：`python manage.py runserver`（默认 SQLite）。
2. **依赖安装**：`pip install -r requirements.txt`（新增 `pdfplumber`、`python-docx`）。
3. **生产部署**：详见 `DEPLOY.md`（Nginx + Gunicorn + systemd）；或 `docker-compose up -d`。
4. **数据库切换**：设 `DATABASE_URL` 环境变量即切 PostgreSQL，无需改代码。
5. **日志**：`data/logs/`（debug.log / error.log / sql.log）。

---

## 七、待办 / 可选优化

- [x] 助理页 PDF 转 Word 已完成：前端进度条 / 错误提示交互（ajax 上传 + 实时进度）。
- [x] PDF 转 Word 表格还原已完成（`pdfplumber.extract_tables()` → `docx` 表格）。
- [x] PDF 转 Word 上传界面优化 + 宽度修复已完成（拖拽区 + 文件卡片 + 面板移入 tool-wrapper，详见 v1.1 报告）。
- [ ] 评论审核可考虑异步通知（Celery，当前项目未启用）。
- [ ] 文章支持 Markdown，可补充目录生成、代码复制按钮。
- [ ] CI/CD 工作流已配置但未实际运行，建议接入仓库触发验证。

---

*报告生成遵循项目规范：详细中文注释、UTF-8 编码、异常中文日志、CSRF 保护。*
