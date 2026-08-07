---
description: 
alwaysApply: true
enabled: true
updatedAt: 2026-05-29T01:07:49.323Z
provider: 
---

# Django 绝对导入规范


## 核心原则  
**所有代码必须严格使用绝对导入，禁止任何形式的相对导入**，以保证代码一致性、可维护性和可读性。


## 一、强制规范  

### 1. 禁止相对导入  
严禁使用任何以 `.` 或 `..` 开头的相对导入：  
```python
# ❌ 禁止
from .models import User        # 单级相对导入
from ..forms import ProductForm # 多级相对导入
from . import views             # 相对导入变体
```

### 2. 必须使用绝对导入  
所有导入必须以项目根路径为起点，明确完整路径：  
```python
# ✅ 正确
from apps.users.models import User          # 应用内导入
from apps.products.forms import ProductForm # 跨应用导入
from apps.toolbox.utils.views import Helper # 嵌套模块导入
```


## 二、导入顺序规范（遵循PEP 8）  

### 1. 分组顺序（组间空行分隔）  
1. **标准库导入**（如 `os`、`datetime`）  
2. **Django核心导入**（如 `django.db`、`django.views`）  
3. **第三方库导入**（如 `requests`、`rest_framework`）  
4. **项目应用导入**（如 `apps.xxx`）  

### 2. 同组内排序  
- 按字母顺序排列  
- `import` 在前，`from ... import` 在后  
- 同一模块的多对象导入合并为一行  

```python
# ✅ 正确示例
import logging
import os
from datetime import datetime

from django.db import models
from django.shortcuts import render

import requests
from rest_framework.views import APIView

from apps.users.models import User
from apps.products.services import ProductService
```


## 三、特殊情况处理  

### 1. 通配符导入  
仅允许在 **视图导出文件（如 `views/__init__.py`）** 中使用，且需添加注释说明原因：  
```python
# ✅ 允许（视图导出）
# apps/users/views/__init__.py
# 导出所有视图，简化外部导入
from apps.users.views.auth import *
from apps.users.views.profile import *
```

### 2. 延迟导入  
函数/方法内的延迟导入也必须使用绝对导入：  
```python
# ✅ 正确
def get_orders():
    from apps.orders.models import Order  # 绝对导入
    return Order.objects.all()
```

### 3. 循环导入处理  
优先方案：  
1. 重构模块结构（拆分共享代码）  
2. 使用延迟导入（函数内导入）  
3. 类型注解用字符串形式（`from typing import TYPE_CHECKING`）  


## 四、验证与检查  

### 1. 提交前验证  
```bash
# 验证导入规范
python core/tests/verify_imports.py --all

# 检测循环导入
python core/tests/detect_circular_imports.py --all
```

### 2. 代码审查要点  
- 无相对导入  
- 导入顺序符合分组规则  
- 通配符导入仅在允许场景使用  
- 无循环导入  


## 五、总结核心  
1. 必须使用绝对导入（`from apps.xxx...`），禁止相对导入（`.`, `..`）  
2. 导入顺序：标准库 → Django → 第三方 → 项目应用  
3. 提交前必须通过自动化验证  
4. 代码审查强制检查导入规范  

**记住：绝对导入，绝对清晰；相对导入，相对混乱。**