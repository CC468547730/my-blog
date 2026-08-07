---
description: 写Queries时
alwaysApply: false
enabled: true
updatedAt: 2026-05-29T01:13:36.986Z
provider: 
---

# 规则：Queries查询服务规范

**版本**: v1.0  
**更新时间**: 2025-11-21  
**适用范围**: 所有Queries相关代码  
**核心理念**: 跨模块查询集中、解决耦合、易于维护

---

## 一、Queries的定义

### 1.1 什么是Queries

Queries是查询服务层，用于聚合跨模块数据和集中管理对外依赖。它是解决模块间耦合的关键机制。

### 1.2 Queries的特点

- ✅ 只读操作
- ✅ 聚合跨模块数据
- ✅ 集中管理对外依赖
- ✅ 易于缓存
- ✅ 易于测试

### 1.3 Queries的职责

- 聚合跨模块数据
- 集中管理对外依赖
- 提供统一的查询接口
- 优化数据库查询

---

## 二、Queries的设计

### 2.1 目录结构

```
apps/应用名/queries/
├── __init__.py
├── order_queries.py      # 订单查询
├── user_queries.py       # 用户查询
└── product_queries.py    # 产品查询
```

### 2.2 查询类设计

```python
# apps/users/queries/user_queries.py
from django.db.models import Prefetch
from apps.users.models import User
from apps.orders.models import Order

class UserQueries:
    """用户查询服务"""
    
    @staticmethod
    def get_user_with_orders(user_id):
        """获取用户及其订单"""
        user = User.objects.prefetch_related(
            Prefetch('orders', queryset=Order.objects.all())
        ).get(id=user_id)
        return user
    
    @staticmethod
    def get_user_profile_data(user_id):
        """获取用户资料数据"""
        user = User.objects.get(id=user_id)
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'orders_count': user.orders.count(),
        }
```

### 2.3 查询命名规范

| 类型 | 命名规范 | 示例 |
|------|--------|------|
| 查询类 | `[对象]Queries` | `UserQueries` |
| 查询方法 | `get_[对象]_[描述]` | `get_user_with_orders` |
| 查询文件 | `[对象]_queries.py` | `user_queries.py` |

---

## 三、Queries的使用规范

### 3.1 何时创建Queries

**应该创建Queries的场景**：
- ✅ 需要聚合多个模块的数据
- ✅ 需要跨模块查询
- ✅ 需要复杂的数据组合
- ✅ 需要频繁使用的查询

**不需要创建Queries的场景**：
- ❌ 简单的单模块查询
- ❌ 只查询单个模型
- ❌ 不需要跨模块的查询

### 3.2 在Views中使用Queries

```python
# apps/users/views/profile.py
from django.shortcuts import render
from apps.users.queries.user_queries import UserQueries

def user_profile_view(request):
    """用户资料视图"""
    user_data = UserQueries.get_user_profile_data(request.user.id)
    return render(request, 'users/profile.html', {'user': user_data})
```

### 3.3 在API中使用Queries

```python
# apps/users/api/v1/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.users.queries.user_queries import UserQueries

class UserProfileAPIView(APIView):
    def get(self, request):
        """获取用户资料API"""
        user_data = UserQueries.get_user_profile_data(request.user.id)
        return Response(user_data)
```

### 3.4 在Services中使用Queries

```python
# apps/orders/services/order_service.py
from apps.users.queries.user_queries import UserQueries

class OrderService:
    @staticmethod
    def create_order_with_user_info(user_id, items):
        """创建订单并获取用户信息"""
        # 获取用户信息
        user_data = UserQueries.get_user_profile_data(user_id)
        
        # 创建订单
        order = Order.objects.create(user_id=user_id)
        
        return order, user_data
```

---

## 四、Queries的最佳实践

### 4.1 避免N+1查询

```python
# ❌ 错误做法 - N+1查询
class OrderQueries:
    @staticmethod
    def get_orders_with_items(user_id):
        orders = Order.objects.filter(user_id=user_id)
        result = []
        for order in orders:
            items = order.items.all()  # N+1查询
            result.append({
                'order': order,
                'items': items
            })
        return result

# ✅ 正确做法 - 使用prefetch_related
class OrderQueries:
    @staticmethod
    def get_orders_with_items(user_id):
        orders = Order.objects.filter(
            user_id=user_id
        ).prefetch_related('items')
        return orders
```

### 4.2 返回值设计

```python
# ✅ 正确做法 - 返回字典或模型
class UserQueries:
    @staticmethod
    def get_user_profile_data(user_id):
        """返回字典"""
        user = User.objects.get(id=user_id)
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
        }
    
    @staticmethod
    def get_user_with_orders(user_id):
        """返回模型"""
        user = User.objects.prefetch_related('orders').get(id=user_id)
        return user

# ❌ 错误做法 - 返回QuerySet
class UserQueries:
    @staticmethod
    def get_users():
        return User.objects.all()  # 不要返回QuerySet
```

### 4.3 缓存策略

```python
# apps/users/queries/user_queries.py
from django.core.cache import cache

class UserQueries:
    @staticmethod
    def get_user_profile_data(user_id):
        """获取用户资料数据（带缓存）"""
        cache_key = f'user_profile_{user_id}'
        user_data = cache.get(cache_key)
        
        if user_data is None:
            user = User.objects.get(id=user_id)
            user_data = {
                'id': user.id,
                'username': user.username,
                'email': user.email,
            }
            cache.set(cache_key, user_data, 3600)  # 缓存1小时
        
        return user_data
```

### 4.4 避免循环依赖

```python
# ❌ 错误做法 - 循环依赖
# apps/orders/queries/order_queries.py
from apps.users.queries.user_queries import UserQueries

class OrderQueries:
    @staticmethod
    def get_order_with_user(order_id):
        order = Order.objects.get(id=order_id)
        user_data = UserQueries.get_user_profile_data(order.user_id)
        return order, user_data

# apps/users/queries/user_queries.py
from apps.orders.queries.order_queries import OrderQueries

class UserQueries:
    @staticmethod
    def get_user_with_orders(user_id):
        user = User.objects.get(id=user_id)
        orders = OrderQueries.get_user_orders(user_id)
        return user, orders

# ✅ 正确做法 - 避免循环依赖
# 使用Signals或其他机制解耦
```

---

## 五、Queries的性能优化

### 5.1 使用select_related和prefetch_related

```python
# apps/orders/queries/order_queries.py
from django.db.models import Prefetch

class OrderQueries:
    @staticmethod
    def get_order_with_details(order_id):
        """获取订单及其详情"""
        order = Order.objects.select_related(
            'user'  # 一对一或外键
        ).prefetch_related(
            'items',  # 一对多或多对多
            Prefetch('items__product')
        ).get(id=order_id)
        return order
```

### 5.2 使用only和defer

```python
# ✅ 正确做法 - 只查询需要的字段
class UserQueries:
    @staticmethod
    def get_user_basic_info(user_id):
        """获取用户基本信息"""
        user = User.objects.only(
            'id', 'username', 'email'
        ).get(id=user_id)
        return user
```

### 5.3 使用values和values_list

```python
# ✅ 正确做法 - 返回字典或元组
class OrderQueries:
    @staticmethod
    def get_orders_summary(user_id):
        """获取订单摘要"""
        orders = Order.objects.filter(
            user_id=user_id
        ).values('id', 'status', 'total_amount')
        return list(orders)
```

---

## 六、Queries的测试

### 6.1 单元测试

```python
# apps/users/tests/test_queries.py
from django.test import TestCase
from apps.users.models import User
from apps.users.queries.user_queries import UserQueries

class UserQueriesTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create(
            username='testuser',
            email='test@example.com'
        )
    
    def test_get_user_profile_data(self):
        """测试获取用户资料数据"""
        user_data = UserQueries.get_user_profile_data(self.user.id)
        
        self.assertEqual(user_data['id'], self.user.id)
        self.assertEqual(user_data['username'], 'testuser')
        self.assertEqual(user_data['email'], 'test@example.com')
```

### 6.2 性能测试

```python
# apps/users/tests/test_queries.py
from django.test import TestCase
from django.test.utils import override_settings
from django.db import connection
from django.test.utils import CaptureQueriesContext

class UserQueriesPerformanceTestCase(TestCase):
    def test_no_n_plus_one_queries(self):
        """测试是否有N+1查询"""
        # 创建测试数据
        for i in range(10):
            User.objects.create(username=f'user{i}')
        
        # 检查查询数
        with CaptureQueriesContext(connection) as context:
            users = UserQueries.get_users_with_orders()
            list(users)  # 强制执行查询
        
        # 应该只有2个查询（1个users，1个orders）
        self.assertLess(len(context), 3)
```

---

## 七、常见问题简表

- Queries 与 Services 的核心区别：前者只读、聚合查询；后者包含业务逻辑，可改写数据。
- 适合创建 Queries 的场景：跨模块聚合、多次复用的复杂查询、需要统一优化/缓存的查询。
- 避免循环依赖：通过 Signals 解耦、避免跨模块直接导入 models，在 Queries 层集中管理对外依赖。

---

## 八、代码审查要点

> 更完整的通用审查项见 `code-review-checklist.md`，本节只保留与 Queries 相关的关键点。

- [ ] 复杂跨模块查询是否集中在 Queries 层实现？
- [ ] 是否使用 `select_related` / `prefetch_related` / `only` 等手段避免 N+1 查询和无用字段？
- [ ] Queries 的返回值是否清晰（模型或字典），而不是裸 QuerySet？
- [ ] 是否有合适的缓存策略？是否考虑缓存失效？
- [ ] 是否存在查询引起的循环依赖？
- [ ] 是否为关键查询编写了测试或性能验证？

---

**版本历史**：
- v1.0 (2025-11-21): 初始版本