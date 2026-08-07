---
description: 写url时
alwaysApply: false
enabled: true
updatedAt: 2026-05-29T01:12:48.344Z
provider: 
---

# CoreMall 项目 URLs 规范化改造方案

**文档版本**: v1.0  
**创建日期**: 2025-11-27  
**适用范围**: 全项目所有应用模块  


## 二、标准结构规范

### 2.1 标准目录结构

#### 前后台分离模块（推荐）
```
apps/模块名/
├── urls/
│   ├── __init__.py           # 主入口
│   ├── frontend_urls.py      # 前台路由
│   └── backend_urls.py       # 后台路由
```

#### 仅前台模块
```
apps/模块名/
├── urls/
│   ├── __init__.py           # 主入口
│   └── frontend_urls.py      # 前台路由
```

#### 仅后台模块
```
apps/模块名/
├── urls/
│   ├── __init__.py           # 主入口
│   └── backend_urls.py       # 后台路由
```

### 2.2 文件模板

#### `urls/__init__.py` 模板
```python
# -*- coding: utf-8 -*-
"""
{模块名}模块 - URL路由主入口

本模块采用目录结构组织URL路由：
- frontend_urls.py: 前台路由
- backend_urls.py: 后台路由

作者：开发者
创建时间：YYYY-MM-DD
"""
from django.urls import path, include

app_name = '{模块名}'

urlpatterns = [
    # 前台路由
    path('', include('apps.{模块名}.urls.frontend_urls')),
]
```

#### `urls/frontend_urls.py` 模板
```python
# -*- coding: utf-8 -*-
"""
{模块名}模块 - 前台URL路由配置

功能说明：
- 功能1
- 功能2

作者：开发者
创建时间：YYYY-MM-DD
"""
from django.urls import path

from apps.{模块名}.views.frontend import (
    # 导入视图
)

urlpatterns = [
    # 路由定义
]
```

#### `urls/backend_urls.py` 模板
```python
# -*- coding: utf-8 -*-
"""
{模块名}模块 - 后台URL路由配置

功能说明：
- 功能1
- 功能2

权限要求：
- 所有后台路由都需要管理员权限

作者：开发者
创建时间：YYYY-MM-DD
"""
from django.urls import path

from apps.{模块名}.views.backend import (
    # 导入视图
)

urlpatterns = [
    # 路由定义
]
```