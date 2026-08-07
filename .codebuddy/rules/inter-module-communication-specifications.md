---
description: 
alwaysApply: true
enabled: true
updatedAt: 2026-05-29T01:11:50.842Z
provider: 
---

# 规则：模块间通讯规范

**版本**: v1.0  
**更新时间**: 2025-11-21  
**适用范围**: 所有跨模块交互  
**核心理念**: 解耦、异步、事件驱动

---

## 一、模块间通讯的三种方式

### 1.1 方式1：通过Services调用

**适用场景**：
- 需要同步获取结果
- 需要立即处理
- 业务流程紧密相关

**示例**：具体代码示例见 `services-layer-development-specifications.md` 中的跨模块调用小节。

### 1.2 方式2：通过Signals通讯

**适用场景**：
- 需要异步处理
- 模块间松耦合
- 一个事件多个响应

**示例**：具体代码示例见 `signals-usage-specifications.md` 中的订单创建信号示例。

### 1.3 方式3：通过Queries查询

**适用场景**：
- 需要查询其他模块的数据
- 只读操作
- 聚合多个模块的数据

**示例**：具体代码示例见 `queries-service-specifications.md` 与各应用 Queries 文件中的用法。

---

## 二、通讯方式的选择

### 2.1 决策树

```
需要通讯吗？
├─ 是 → 需要同步结果吗？
│  ├─ 是 → 使用Services调用
│  └─ 否 → 需要查询数据吗？
│     ├─ 是 → 使用Queries查询
│     └─ 否 → 使用Signals通讯
└─ 否 → 不需要通讯
```

### 2.2 通讯方式对比

| 方式 | 同步/异步 | 耦合度 | 适用场景 |
|------|---------|--------|--------|
| **Services** | 同步 | 高 | 业务流程紧密 |
| **Signals** | 异步 | 低 | 事件驱动 |
| **Queries** | 同步 | 中 | 数据查询 |

---

## 三、通讯规范

### 3.1 Services调用规范

**✅ 正确做法**：
```python
# 1. 导入服务
from apps.payments.services.payment_service import PaymentService

# 2. 调用服务方法
payment = PaymentService.process_payment(
    order_id=order.id,
    amount=order.total_amount
)

# 3. 处理异常
try:
    payment = PaymentService.process_payment(...)
except Exception as e:
    logger.error(f"支付失败: {str(e)}")
    raise
```

**❌ 错误做法**：
```python
# 不要直接导入models
from apps.payments.models import Payment
Payment.objects.create(...)

# 不要跨应用直接调用views
from apps.payments.views import payment_view

# 不要在views中写业务逻辑
def create_order_view(request):
    order = Order.objects.create(...)  # 业务逻辑不应该在这里
```

### 3.2 Signals通讯规范

**✅ 正确做法**：
```python
# 1. 定义Signal
from django.dispatch import Signal
order_created = Signal()

# 2. 在services中发送
order_created.send(sender=OrderService, order=order)

# 3. 在其他模块中订阅
@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    pass

# 4. 在apps.py中注册
class NotificationsConfig(AppConfig):
    def ready(self):
        import apps.notifications.handlers
```

**❌ 错误做法**：
```python
# 不要在views中发送Signal
def create_order_view(request):
    order_created.send(...)

# 不要在Signal中发送相同的Signal（循环）
@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    order_created.send(...)

# 不要忘记注册handlers
# 如果没有在apps.py中注册，handlers不会被调用
```

### 3.3 Queries查询规范

**✅ 正确做法**：
```python
# 1. 导入queries
from apps.users.queries.user_queries import UserQueries

# 2. 调用查询方法
user_data = UserQueries.get_user_with_orders(user_id)

# 3. 使用返回的数据
return render(request, 'template.html', {'user': user_data})
```

**❌ 错误做法**：
```python
# 不要直接导入models进行复杂查询
from apps.users.models import User
user = User.objects.prefetch_related('orders').get(id=user_id)

# 不要在views中写复杂的查询逻辑
def user_view(request):
    user = User.objects.get(id=request.user.id)
    orders = Order.objects.filter(user_id=user.id)
    # 这些逻辑应该在queries中

# 不要返回QuerySet
class UserQueries:
    @staticmethod
    def get_users():
        return User.objects.all()  # 错误
```

---

## 四、避免循环依赖

### 4.1 循环依赖的危害

```
模块A → 模块B → 模块A（循环）
```

**危害**：
- ❌ 导入错误
- ❌ 难以测试
- ❌ 难以维护

### 4.2 避免循环依赖的方法

**方法1：使用Signals解耦**
```python
# ❌ 循环依赖
# apps/orders/services/order_service.py
from apps.notifications.services.notification_service import NotificationService

class OrderService:
    @staticmethod
    def create_order(user_id, items):
        order = Order.objects.create(user_id=user_id)
        NotificationService.send_notification(...)  # 直接调用

# apps/notifications/services/notification_service.py
from apps.orders.services.order_service import OrderService

class NotificationService:
    @staticmethod
    def send_notification(...):
        # 可能需要调用OrderService

# ✅ 使用Signals解耦
# apps/orders/services/order_service.py
from apps.orders.signals.order_signals import order_created

class OrderService:
    @staticmethod
    def create_order(user_id, items):
        order = Order.objects.create(user_id=user_id)
        order_created.send(sender=OrderService, order=order)

# apps/notifications/handlers.py
@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    send_notification(...)
```

**方法2：使用Queries查询**
```python
# ❌ 循环依赖
# apps/orders/queries/order_queries.py
from apps.users.queries.user_queries import UserQueries

class OrderQueries:
    @staticmethod
    def get_order_with_user(order_id):
        order = Order.objects.get(id=order_id)
        user_data = UserQueries.get_user_profile_data(order.user_id)

# apps/users/queries/user_queries.py
from apps.orders.queries.order_queries import OrderQueries

class UserQueries:
    @staticmethod
    def get_user_with_orders(user_id):
        user = User.objects.get(id=user_id)
        orders = OrderQueries.get_user_orders(user_id)

# ✅ 避免循环依赖
# 只在一个方向上依赖
# apps/orders/queries/order_queries.py
class OrderQueries:
    @staticmethod
    def get_order_with_user(order_id):
        order = Order.objects.select_related('user').get(id=order_id)
        return order

# apps/users/queries/user_queries.py
class UserQueries:
    @staticmethod
    def get_user_with_orders(user_id):
        user = User.objects.prefetch_related('orders').get(id=user_id)
        return user
```

---

## 五、通讯的性能优化

### 5.1 异步处理

```python
# apps/orders/services/order_service.py
from celery import shared_task

class OrderService:
    @staticmethod
    def create_order(user_id, items):
        order = Order.objects.create(user_id=user_id)
        
        # 异步处理耗时操作
        process_order_async.delay(order.id)
        
        return order

@shared_task
def process_order_async(order_id):
    """异步处理订单"""
    order = Order.objects.get(id=order_id)
    # 耗时操作
```

### 5.2 缓存策略

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
            }
            cache.set(cache_key, user_data, 3600)
        
        return user_data
```

---

## 六、代码审查清单

- [ ] 是否有跨模块直接导入models？
- [ ] 是否有循环依赖？
- [ ] 是否使用了正确的通讯方式？
- [ ] 是否有异常处理？
- [ ] 是否有性能问题？
- [ ] 是否有单元测试？

---

**版本历史**：
- v1.0 (2025-11-21): 初始版本