---
description: 写视图时
alwaysApply: false
enabled: true
updatedAt: 2026-05-29T01:12:39.599Z
provider: 
---

# Views 目录规则（精简版）

## 一、核心原则

采用 **功能域模块化 + 多级目录拆分** 策略，确保代码可维护性和团队协作效率。

## 二、视图拆分原则

### 2.1 单一职责

- 每个视图文件仅负责一个功能模块
- 示例：`auth.py` 只处理认证逻辑，`profile.py` 只处理资料逻辑

### 2.2 类视图优先

- 复杂逻辑使用类视图（如 `LoginView`）
- 简单逻辑可保留函数视图
- 使用 `@method_decorator(admin_required, name='dispatch')` 处理权限

### 2.3 URL 组织

```python
# apps/users/urls.py
from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('profile/', views.ProfileView.as_view(), name='profile'),
]
```

---

## 三、跨应用协作规范

### 3.1 接口隔离

- 应用间通过 `signals.py` 或 `services.py` 通信
- 避免直接导入其他应用的视图

### 3.2 共享模块

- 公共功能抽离为独立应用（如 `utils`、`attachments`）
- 示例：`attachments` 应用提供文件上传服务

---

## 四、注意事项

### 4.1 循环导入预防

- 使用延迟导入：`def my_view(): from users.views import ProfileView`
- 通过 URL 间接调用，避免直接导入

### 4.2 性能优化

- 视图中使用 `select_related`/`prefetch_related` 减少数据库查询
- 复杂逻辑异步处理（使用 Celery）