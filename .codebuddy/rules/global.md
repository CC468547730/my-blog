---
description: 
alwaysApply: true
enabled: true
updatedAt: 2026-05-29T01:11:41.234Z
provider: 
---

# CoreMall 商城系统开发规范文档 v0.8

**文档版本**: v0.9
**更新时间**: 2026-01-30
**适用项目**: CoreMall 智能商城系统
**项目性质**: 大型响应式IDC商城网站 + CMS + 各类工具模块
**开发模式**: Django5原生模板开发 + DRF接口未来用于多端
**部署方式**: Docker + Docker Compose（9容器编排:web + nginx + postgresql + redis + celery-worker + celery-beat + channels + pgbouncer + wrangler）
**开发环境说明**: 详见 `.rules/dev-environment.md`
**项目架构**: 事件驱动、服务层、模块解耦、异步处理  
**目标定位**: 中国本土化WHMCS平替，计划开源商业化运营

## 一、AI规则与角色定位
读取规则文档:
`.rules/AI-ev-Working-Rules.md`

## 二、项目概况与技术架构

### 2.1 技术栈规范

#### 后端技术栈
- **Python**: 3.14+
- **Django**: 5.2+
- **DRF**: 3.16+ (Django REST Framework)
- **数据库**: PostgreSQL 18+ (已部署docker)
- **缓存**: Redis 7.4+ (已部署docker)
- **任务队列**: Celery 5.5+ (已部署docker)

#### 前端技术栈
- **模板引擎**: Django Template Language (DTL)  
- **UI框架**: Vuexy HTML付费模板  
- **JavaScript**: ES6+ (原生JavaScript + 适量jQuery)  
- **CSS框架**: Bootstrap 5 (Vuexy内置)  

#### 部署技术栈
- **容器化**: Docker + Docker Compose（9容器编排::web + nginx + postgresql + redis + celery-worker + celery-beat + channels + wrangle + pgbouncer）
- **Web服务器**: Nginx
- **应用服务器**: Gunicorn

#### Django规范
DRY（不重复代码）
MTV 分层（Model-View-Template）
薄视图、厚服务 / 模型
单一职责（文件 / 模块只做一件事）
约定优于配置
松耦合、高内聚
安全优先（防 XSS/CSRF/SQL 注入）
可复用性（Mixin / 装饰器 / 工具类）
数据校验前置（Form/Serializer）
数据库抽象（ORM 优先，不写原生 SQL）
views和services层分离，views层负责处理HTTP请求和响应，services层负责业务逻辑和数据操作,分拆多个文件,每个文件负责一个功能模块,行数控制在300行以下

#### 命名规范
当出现组合单词命名时:只有浏览器路径用`-`（中横线）,其余一律用下划线`_`

## 三、混合开发模式规范 🔥

### 3.1 当前开发策略

**核心理念**: 遵循MVP敏捷开发原则，优先使用传统Django开发模式，保持代码简洁和开发效率

#### 开发策略分阶段
```
第一阶段(当前): 传统Django开发 → 快速原型和功能实现
    ↓
第二阶段(未来): API完善 → 逐步引入前后端分离
    ↓
第三阶段(长远): 多端支持 → 移动端APP和其他客户端
```

#### 当前阶段技术原则
- **简化优先**: 避免过早引入复杂架构，专注核心功能实现
- **传统Django**: 使用Django视图 + 模板的传统开发模式
- **表单处理**: 使用Django Form和传统表单提交
- **JavaScript**: 仅在必要的交互功能中使用，避免复杂状态管理
- **API保留**: 已安装的DRF保持不变，为未来扩展做准备

#### 数据处理策略
- **静态数据/初始数据**: 继续使用传统Django视图传递到模板
- **动态数据/交互数据**: 使用JavaScript ajax 进行处理
- **表单提交**: 根据复杂度选择传统表单提交或API调用
- **基于SEO角度**:由于本项目前台页面重度需要SEO

### 3.2 JavaScript使用原则

#### 当前阶段JavaScript规范
- **最小化使用**: 仅在必要的交互功能中使用JavaScript
- **避免复杂状态管理**: 不引入复杂的前端状态管理库
- **优先传统表单**: 表单提交优先使用传统Django表单处理
- **简单交互**: 仅用于UI增强，如模态框、下拉菜单等基础交互

#### 推荐的JavaScript使用场景
```javascript
// ✅ 推荐：简单的UI交互
function toggleModal(modalId) {
    $('#' + modalId).modal('toggle');
}

// ✅ 推荐：表单验证增强
function validateForm(formId) {
    // 简单的客户端验证
}

// ❌ 避免：复杂的API调用和状态管理
// 当前阶段不使用复杂的异步数据处理
```


## 四、目录结构与组织规范

### 4.1 项目整体结构示例

**核心理念**: 代码与数据分离，便于 Docker 部署和数据持久化

> 完整、全局性的项目目录结构（唯一真源）见：`.rules/project-structure.md`

**关键特点**：
- ✅ **代码与数据分离**: core/ 包含代码，data/ 包含数据
- ✅ **Docker 友好**: 便于容器化部署和数据持久化
- ✅ **易于扩展**: 新应用直接添加到 apps/ 目录
- ✅ **清晰的职责**: 每个目录有明确的用途

### 4.2 应用内部结构规范

#### 标准应用app结构示例
请查阅文档`.rules\project-structure.md`

### 4.3 测试目录规范
- **全局测试**: `core/tests/` - 存放跨应用的集成测试
- **应用测试**: `core/apps/<应用名>/tests/` - 存放该应用的单元测试
- **测试脚本**: 优先编写Python测试文件，避免shell脚本

## 五、前端开发规范

### 5.1 Vuexy模板使用规范

#### 基本原则
- **严禁修改Vuexy原始文件**: 保持 `data/static/themes/backend/default/vuexy/` 和 `data/static/themes/frontend/default/vuexy/` 目录不变
- **遵循Django模板规范**: 使用 `{% static %}` 标签引用静态资源
- **风格一致性**: 严格按照Vuexy模板规则样式构建页面
- **最大化复用**: 优先使用Vuexy样式库的代码元素
- **自定义文件分离**: 自定义CSS/JS 放在 `custom/` 目录，不修改 `vuexy/` 目录

#### 自定义CSS/JS规范
```html
<!-- 错误做法：直接在页面内写样式 -->
<style>
.custom-class { color: red; }
</style>

<!-- 正确做法：引入自定义文件 -->
{% load static %}
<!-- 引入 Vuexy 样式 -->
<link rel="stylesheet" href="{% static 'themes/backend/default/vuexy/css/core.css' %}">
<!-- 引入自定义样式 -->
<link rel="stylesheet" href="{% static 'themes/backend/default/custom/css/custom.css' %}">
<!-- 引入自定义脚本 -->
<script src="{% static 'themes/backend/default/custom/js/custom.js' %}"></script>
```

#### 页面布局参考
- **基础页面**: 使用 `starter-vertical-menu-template-no-customizer`
- **复杂页面**: 参考 `vertical-menu-template-no-customizer`
- **前台页面**: 参考 `front-pages-no-customizer`
- **参考库位置**: `vuexy/` 目录（只读参考）

### 5.2 JavaScript开发规范

#### 代码组织
```javascript
// 1. 全局配置 2. 工具函数 3. API调用 4. 页面初始化
const API_BASE_URL = '/api/v1/';
async function updateUserAvatar(avatarId) { /* 核心逻辑 */ }
$(document).ready(function() { /* 初始化 */ });

// 错误处理规范
try {
  const result = await callAPI('/api/v1/users/avatar/update/', 'POST', {avatar_id: avatarId});
  showToast('更新成功', 'success');
} catch (error) {
  console.error('失败:', error);
  showToast('失败: ' + error.message, 'error');
}
```

#### 错误处理规范
```javascript
try {
    const result = await callAPI('/api/v1/users/avatar/update/', 'POST', {
        avatar_id: avatarId
    });
    
    // 成功处理
    showToast('头像更新成功', 'success');
    
} catch (error) {
    // 错误处理
    console.error('头像更新失败:', error);
    showToast('头像更新失败: ' + error.message, 'error');
}
```

## 六、后端开发规范

### 6.1 Django应用设计规范

#### 模型设计要求
```python
class UserProfile(models.Model):
    """用户资料模型"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, verbose_name="用户")
    nickname = models.CharField(max_length=50, blank=True, verbose_name="昵称")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间", db_index=True)
    
    class Meta:
        verbose_name = "用户资料"
        verbose_name_plural = "用户资料"
        db_table = 'users_profile'
```

#### 视图拆分原则
- **单一职责**: 每个视图文件仅负责一个功能模块
- **类视图优先**: 复杂逻辑使用类视图，简单逻辑可保留函数视图
- **权限控制**: 统一使用装饰器或Mixin进行权限验证

#### 权限装饰器规范
```python
from apps.utils.decorators import admin_required, dual_session_required

@admin_required
def admin_user_list(request):
    """后台用户列表"""
    pass

@dual_session_required
def user_profile_edit(request):
    """用户资料编辑(支持双会话)"""
    pass
```

### 6.2 DRF API开发规范

#### 序列化器设计
```python
from rest_framework import serializers
from django.contrib.auth.models import User

class UserProfileSerializer(serializers.ModelSerializer):
    """用户资料序列化器"""
    
    class Meta:
        model = UserProfile
        fields = ['nickname', 'email', 'phone', 'avatar_id']
        
    def validate_nickname(self, value):
        """昵称验证"""
        if len(value) < 2:
            raise serializers.ValidationError("昵称至少2个字符")
        return value
```

#### API视图设计
```python
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

class UserAvatarUpdateView(APIView):
    """用户头像更新API"""
    
    def post(self, request):
        """更新用户头像"""
        try:
            serializer = AvatarUpdateSerializer(data=request.data)
            if serializer.is_valid():
                # 业务逻辑处理
                result = self.update_avatar(request.user, serializer.validated_data)
                
                return Response({
                    'success': True,
                    'message': '头像更新成功',
                    'data': result
                })
            else:
                return Response({
                    'success': False,
                    'message': '参数验证失败',
                    'errors': serializer.errors
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            # 记录错误日志
            logger.error(f"头像更新失败: {str(e)}", extra={
                'user_id': request.user.id,
                'request_data': request.data
            })
            
            return Response({
                'success': False,
                'message': '服务器内部错误'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
```

## 七、数据库设计规范

### 7.1 数据库配置

#### 本地开发环境配置（venv）
```python
# settings.py - 本地开发环境
# 使用 PostgreSQL，通过 dj-database-url 自动解析
import dj_database_url

DATABASE_URL = os.environ.get('DATABASE_URL')
# 本地 venv: postgresql://coremall_user:coremall_password@localhost:5432/coremall

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# PostgreSQL 通常不需要额外 charset 配置，UTF-8 为默认
```

#### Docker 容器环境配置
```python
# settings.py - Docker 环境
# 自动从环境变量读取数据库配置
DATABASE_URL = os.environ.get('DATABASE_URL')
# Docker: postgresql://coremall_user:coremall_password@postgres:5432/coremall

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        conn_health_checks=True,
    )
}

# PostgreSQL 通常不需要额外 charset 配置，UTF-8 为默认
```

#### Docker Compose PostgreSQL 配置
```yaml
# docker-compose.yml
postgres:
  image: postgres:18.1
  container_name: coremall_postgresql
  environment:
    POSTGRES_DB: coremall
    POSTGRES_USER: coremall_user
    POSTGRES_PASSWORD: coremall_password
  ports:
    - "5432:5432"
  volumes:
    - ./data/postgresql:/var/lib/postgresql
```

### 7.2 模型设计规范

#### 字段定义要求
- 所有字段必须声明`verbose_name`（中文语义）
- 大表（记录数>10万）必须添加必要索引
- 外键字段添加`db_index=True`
- 时间字段添加索引用于排序和筛选

#### 敏感数据处理
```python
from django.contrib.auth.hashers import make_password, check_password

class SecurityQuestion(models.Model):
    """安全问题模型"""
    answer_hash = models.CharField(
        max_length=128, 
        verbose_name="答案哈希值"
    )
    
    def set_answer(self, raw_answer):
        """设置答案（加密存储）"""
        self.answer_hash = make_password(raw_answer)
        
    def check_answer(self, raw_answer):
        """验证答案"""
        return check_password(raw_answer, self.answer_hash)
```

## 八、安全与性能规范

### 8.1 安全规范

#### 认证与权限
- **会话认证**: 使用Django内置SessionAuthentication
- **双会话支持**: 前台用户和后台管理员会话隔离
- **权限控制**: 基于装饰器的细粒度权限控制
- **CSRF保护**: 所有表单和API请求强制CSRF验证

#### 输入验证
```python
from django import forms
from django.core.validators import RegexValidator

class UserProfileForm(forms.ModelForm):
    """用户资料表单"""
    phone = forms.CharField(
        validators=[RegexValidator(r'^1[3-9]\d{9}$', '请输入有效的手机号')],
        required=False
    )
    
    def clean_nickname(self):
        """昵称验证"""
        nickname = self.cleaned_data.get('nickname')
        if nickname and len(nickname) < 2:
            raise forms.ValidationError('昵称至少2个字符')
        return nickname
```

#### API安全
```python
# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour'
    }
}
```

### 8.2 性能优化

#### 数据库查询优化
```python
# 预加载相关对象
users = User.objects.select_related('userprofile').all()

# 预加载多对多关系
posts = Post.objects.prefetch_related('tags').all()

# 只查询需要的字段
users = User.objects.only('username', 'email').all()
```

#### 缓存策略
```python
from django.core.cache import cache

def get_user_avatar_list():
    """获取用户头像列表（带缓存）"""
    cache_key = 'user_avatar_list'
    avatar_list = cache.get(cache_key)
    
    if avatar_list is None:
        avatar_list = list(range(1, 21))  # 1-20头像ID
        cache.set(cache_key, avatar_list, 3600)  # 缓存1小时
        
    return avatar_list
```

#### 前端性能优化
```html
<!-- 图片懒加载 -->
<img src="{% static 'themes/backend/default/img/avatars/1.png' %}" 
     loading="lazy" 
     alt="用户头像">

<!-- 资源预加载 -->
<link rel="preload" href="{% static 'themes/backend/default/css/core.css' %}" as="style">
```

## 九、测试与质量保证

### 9.1 测试规范

#### 单元测试要求
```python
from django.test import TestCase
from django.contrib.auth.models import User

class UserProfileTestCase(TestCase):
    """用户资料测试用例"""
    
    def setUp(self):
        """测试数据准备"""
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
    
    def test_profile_creation(self):
        """测试用户资料创建"""
        profile = UserProfile.objects.create(
            user=self.user,
            nickname='测试用户'
        )
        self.assertEqual(profile.nickname, '测试用户')
        
    def test_avatar_update_api(self):
        """测试头像更新API"""
        self.client.login(username='testuser', password='testpass123')
        response = self.client.post('/api/v1/users/avatar/update/', {
            'avatar_id': 5
        })
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['success'])
```

#### API测试规范
```python
from rest_framework.test import APITestCase
from rest_framework import status

class UserAPITestCase(APITestCase):
    """用户API测试用例"""
    
    def test_avatar_update(self):
        """测试头像更新API"""
        url = '/api/v1/users/avatar/update/'
        data = {'avatar_id': 3}
        
        response = self.client.post(url, data, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
```

### 9.2 代码质量要求

#### 代码格式化
```bash
# 安装代码格式化工具
pip install black isort flake8

# 格式化代码
black .
isort .
flake8 .
```

#### 文档注释规范
```python
def update_user_avatar(user, avatar_id):
    """
    更新用户头像
    
    Args:
        user (User): 用户对象
        avatar_id (int): 头像ID (1-20)
        
    Returns:
        dict: 更新结果
        
    Raises:
        ValueError: 当avatar_id不在有效范围内时
    """
    if not 1 <= avatar_id <= 20:
        raise ValueError("头像ID必须在1-20范围内")
        
    # 更新逻辑
    pass
```

## 十、部署与运维规范

### 10.1 Docker容器化

#### Dockerfile示例（Web 应用）
```dockerfile
FROM python:3.14-slim

# 设置环境变量
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    DJANGO_SETTINGS_MODULE=config.settings

# 设置工作目录
WORKDIR /app

# 安装系统依赖（包括 C++ 编译器、图像库、FFI 库等）
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    libpq-dev \
    pkg-config \
    libjpeg-dev \
    libpng-dev \
    libfreetype6-dev \
    zlib1g-dev \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# 复制requirements.txt并安装Python依赖
COPY core/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 安装额外的生产依赖
RUN pip install --no-cache-dir psycopg[binary] redis gunicorn

# 复制项目代码
COPY core .

# 创建必要的目录
RUN mkdir -p logs staticfiles media

# 设置权限
RUN chmod +x manage.py

# 暴露端口
EXPOSE 8000

# 启动命令
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "300", "config.wsgi:application"]
```

**关键特点**：
- ✅ **环境变量**: 设置生产环境配置
- ✅ **依赖管理**: 分离基础和额外依赖
- ✅ **多进程**: 使用 3 个 Gunicorn workers
- ✅ **超时设置**: 300 秒超时用于长时间操作
- ✅ **系统依赖**: 包含图像处理和 FFI 库支持

#### docker-compose.yml（9容器编排）

**关键配置**：
- ✅ **9容器编排**: Docker + Docker Compose（9容器编排::web + nginx + postgresql + redis + celery-worker + celery-beat + channels + wrangle + pgbouncer）
- ✅ **数据持久化**: 挂载 `./data` 目录到容器
- ✅ **代码与数据分离**: 便于升级和备份
- ✅ **健康检查**: 每个容器都配置了健康检查
- ✅ **网络隔离**: 使用自定义网络 `coremall_network`
- ✅ **环境变量**: 完整的数据库、Redis、Celery 配置

### 10.2 环境变量管理

#### .env文件示例（本地开发）
```env
# Django配置
DEBUG=True
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1

# 数据库配置（本地 venv）
DATABASE_URL=postgresql://coremall_user:coremall_password@localhost:5432/coremall

# Redis配置（本地）
REDIS_CACHE_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# 邮件配置
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-email-password
```

#### Docker 环境变量配置
```env
# Django配置
DEBUG=False
SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=localhost,127.0.0.1,yourdomain.com

# 数据库配置（Docker 容器）
DATABASE_URL=postgresql://coremall_user:coremall_password@postgres:5432/coremall

# Redis配置（Docker 容器）
REDIS_CACHE_URL=redis://redis:6380/0
CELERY_BROKER_URL=redis://redis:6380/1
CELERY_RESULT_BACKEND=redis://redis:6380/2
CELERY_TIMEZONE=UTC

# 邮件配置
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@example.com
EMAIL_HOST_PASSWORD=your-email-password
```

### 10.3 日志配置

#### 多容器环境日志策略
```python
# settings.py - 日志配置（支持本地和 Docker 环境）
# 日志文件位置已迁移到 data/ 目录（Docker 数据持久化）

# 创建日志目录（使用 DATA_DIR，与 Docker 部署一致）
LOG_DIR = DATA_DIR / 'logs'
LOG_DIR.mkdir(parents=True, exist_ok=True)

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {process:d} {thread:d} {message}',
            'style': '{',
        },
        'simple': {
            'format': '{levelname} {message}',
            'style': '{',
        },
        'debug': {
            'format': '[{asctime}] {levelname} {name} {module}:{lineno} - {message}',
            'style': '{',
            'datefmt': '%Y-%m-%d %H:%M:%S',
        },
    },
    'filters': {
        'require_debug_true': {
            '()': 'django.utils.log.RequireDebugTrue',
        },
        'require_debug_false': {
            '()': 'django.utils.log.RequireDebugFalse',
        },
    },
    'handlers': {
        'console': {
            'level': 'DEBUG',
            'filters': ['require_debug_true'],
            'class': 'logging.StreamHandler',
            'formatter': 'debug',
        },
        'console_prod': {
            'level': 'INFO',
            'filters': ['require_debug_false'],
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
        'file_debug': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'debug.log',
            'maxBytes': 1024*1024*5,  # 5MB
            'backupCount': 5,
            'formatter': 'debug',
            'encoding': 'utf-8',
        },
        'file_error': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'error.log',
            'maxBytes': 1024*1024*5,  # 5MB
            'backupCount': 5,
            'formatter': 'verbose',
            'encoding': 'utf-8',
        },
        'file_sql': {
            'level': 'DEBUG',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': LOG_DIR / 'sql.log',
            'maxBytes': 1024*1024*10,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
            'encoding': 'utf-8',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console', 'console_prod', 'file_debug', 'file_error'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['file_sql'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'console_prod', 'file_error'],
            'level': 'DEBUG',
            'propagate': False,
        },
        '': {
            'handlers': ['console', 'file_debug'],
            'level': 'DEBUG' if DEBUG else 'INFO',
        },
    }
}
```


# 实时查看 data/logs 目录中的日志
tail -f data/logs/debug.log
tail -f data/logs/error.log
tail -f data/logs/sql.log
```

## 十一、开发流程与协作

### 11.1 Git工作流规范

#### 分支命名规范
- `main` - 主分支（生产环境）
- `stage` - 预发布分支（测试环境）
- `dev` - 本地开发分支
- `feature/模块名-功能名` - 功能分支
- `fix/模块名-问题描述` - 修复分支
- `hotfix/紧急修复描述` - 热修复分支

#### 提交信息规范
```
[模块名] 类型: 简短描述

详细描述（可选）

关联Issue: #123
```

示例：
```
[users] feat: 添加用户头像选择功能

- 实现20个预设头像选择
- 添加头像更新API
- 优化头像显示效果

关联Issue: #45
```

### 11.2 代码审查规范

#### 审查检查项
1. **功能正确性**: 代码是否实现了预期功能
2. **代码质量**: 是否遵循项目编码规范
3. **安全性**: 是否存在安全漏洞
4. **性能**: 是否存在性能问题
5. **测试覆盖**: 是否包含充分的测试用例

### 11.3 发布流程

#### 发布前检查清单
- [ ] 所有测试用例通过
- [ ] 代码格式化检查通过
- [ ] 安全扫描通过
- [ ] 性能测试通过
- [ ] 文档更新完成
- [ ] 数据库迁移脚本准备就绪

## 十二、特殊规范与注意事项

### 12.1 Windows开发环境适配

#### 终端命令规范
```powershell
# 错误做法（PowerShell不支持&&，“&&”不是此版本中的有效语句分隔符。）
cd core && python manage.py runserver

# 正确做法（分步执行）
cd core
python manage.py runserver
```

#### 路径处理
```python
# 使用pathlib处理路径（跨平台兼容）
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_ROOT = BASE_DIR / 'staticfiles'
```

### 12.2 开发调试规范
账号密码
`.rules\accounts-password.md`

#### 日志查看
```bash
# 查看实时日志（日志位置已迁移到 data/ 目录）
tail -f data/logs/debug.log

# 查看错误日志
tail -f data/logs/error.log

# 查看SQL日志
tail -f data/logs/sql.log
```

### 12.3 项目依赖更新维护

项目依赖文档位置 `core\requirements.txt` 
当需要安装新依赖时，必须在安装完成后，执行导出更新到 `core\requirements.txt`


### 12.4 API调试工具

#### DRF浏览器界面
- **访问地址**: `http://127.0.0.1:8008/api/v1/`
- **功能**: 直接在浏览器中测试API接口
#### Swagger文档
- **访问地址**: `http://127.0.0.1:8008/api/v1/docs/`
- **功能**: 完整的Swagger UI交互式文档和在线测试
#### API Schema
- **访问地址**: `http://127.0.0.1:8008/api/v1/schema/`
- **功能**: OpenAPI 3.0规范的JSON格式
- **访问地址**: `http://127.0.0.1:8008/api/v1/schema.json
- **功能**: JSON格式API schema
- **访问地址**: `http://127.0.0.1:8008/api/v1/schema.yaml`
- **功能**: YAML格式API schema
#### ReDoc美观文档界面
- **访问地址**: `http://127.0.0.1:8008/api/v1/redoc/`
- **功能**: ReDoc美观文档界面


## 十三、禁止事项

### 13.1 严格禁止
1. ❌ **直接修改Vuexy模板文件** - 保持原始文件不变
2. ❌ **硬编码敏感信息** - 使用环境变量管理
3. ❌ **绕过CSRF保护** - 所有表单必须包含CSRF token
4. ❌ **直接拼接SQL语句** - 必须使用Django ORM
5. ❌ **在生产环境启用DEBUG** - 安全风险
6. ❌ **跳过代码测试** - 每个功能必须有对应测试
7. ❌ **不要依赖系统默认编码** - 不要使用 GBK 或其他非 UTF-8 编码，本项目是UTF-8编码

### 13.2 不推荐做法
1. ⚠️ **在模板中编写复杂逻辑** - 应该在视图中处理
2. ⚠️ **使用过多的内联样式** - 应该使用CSS类
3. ⚠️ **忽略数据库索引** - 影响查询性能
4. ⚠️ **不处理异常** - 必须有适当的错误处理

## 十四、参考资源和API文档

`.rules\reference-documents-and-apis.md`

### 14.3 开发工具
- **数据库工具**: DBeaver, pgAdmin
- **API测试工具**: Postman, Insomnia
- **代码编辑器**: VS Code, PyCharm
- **版本控制**: Git, GitHub Desktop

---
## 十五、开发策略调整记录

### 版本历史
- **v0.8 (2025-11-21)**: 架构演进完成，引入事件驱动 + 服务层 + 模块解耦，强制目录拆分（services/、signals/、queries/、views/），更新应用结构规范
- **v0.7 (2025-11-09)**: Docker 容器化部署完成，6容器编排（PostgreSQL + Redis + Celery），更新数据库、部署、日志配置
- **v0.6 (2025-10-25)**: 更新 Docker 部署方案，代码与数据分离，更新目录结构和模板引入方式
- **v0.5 (2025-10-13)**: 定制新的目录和文档规范
- **v0.4 (2025-09-14)**: 调整为传统Django开发模式，强调敏捷开发原则，目前暂不使用DRF
- **v0.3 (2025-06-20)**: 初始混合开发模式规范
- **v0.3.1 (2025-06-21)**: 调整为传统Django开发模式，强调敏捷开发原则