---
description: 写Signals时
alwaysApply: false
enabled: true
updatedAt: 2026-05-29T01:13:19.414Z
provider: 
---

# 规则：Signals使用规范

**版本**: v1.0  
**更新时间**: 2025-11-21  
**适用范围**: 所有Signals相关代码  
**核心理念**: 事件驱动、模块解耦、异步处理

---

## 一、Signals的定义

### 1.1 什么是Signals

Signals是Django的事件系统，允许应用在特定事件发生时发送通知。在CoreMall中，Signals是实现事件驱动架构和模块解耦的基础。

### 1.2 Signals的特点

- ✅ 实现模块间的松耦合通讯
- ✅ 支持异步处理
- ✅ 易于扩展
- ✅ 易于测试

### 1.3 Signals的职责

- 定义关键业务事件
- 在services中发送Signal
- 在其他模块中订阅Signal
- 支持异步处理

---

## 二、Signals的设计

### 2.1 目录结构

```
apps/应用名/signals/
├── __init__.py
├── order_signals.py      # 订单相关信号
└── payment_signals.py    # 支付相关信号
```

### 2.2 信号定义规范

```python
# apps/orders/signals/order_signals.py
from django.dispatch import Signal

# 订单创建信号
order_created = Signal()

# 订单支付信号
order_paid = Signal()

# 订单发货信号
order_shipped = Signal()

# 订单完成信号
order_completed = Signal()
```

### 2.3 信号命名规范

| 类型 | 命名规范 | 示例 |
|------|--------|------|
| 信号名 | `[对象]_[动作]` | `order_created` |
| 信号文件 | `[功能]_signals.py` | `order_signals.py` |

---

## 三、Signals的使用规范

### 3.1 在Services中发送Signal

```python
# apps/orders/services/order_service.py
from django.db import transaction
from apps.orders.models import Order
from apps.orders.signals.order_signals import order_created

class OrderService:
    @staticmethod
    @transaction.atomic
    def create_order(user_id, items):
        """创建订单"""
        # 1. 创建订单
        order = Order.objects.create(user_id=user_id)
        
        # 2. 在关键业务节点发送Signal
        order_created.send(
            sender=OrderService,
            order=order,
            user_id=user_id
        )
        
        return order
```

### 3.2 在其他模块中订阅Signal

```python
# apps/notifications/handlers.py
from django.dispatch import receiver
from apps.orders.signals.order_signals import order_created

@receiver(order_created)
def notify_order_created(sender, order, user_id, **kwargs):
    """订阅order_created事件"""
    # 发送通知
    send_notification(user_id, f"订单 {order.id} 已创建")

# apps/notifications/apps.py
from django.apps import AppConfig

class NotificationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.notifications'
    
    def ready(self):
        # 在应用启动时注册handlers
        import apps.notifications.handlers
```

### 3.3 Signal参数规范

```python
# ✅ 正确做法 - 清晰的参数
order_created.send(
    sender=OrderService,
    order=order,
    user_id=user_id,
    total_amount=order.total_amount
)

# ❌ 错误做法 - 参数不清晰
order_created.send(sender=OrderService, data=order)
```

---

## 四、Signals的最佳实践

### 4.1 何时发送Signal

**应该发送Signal的场景**：
- ✅ 订单创建、支付、发货等关键业务事件
- ✅ 用户注册、登录等用户事件
- ✅ 产品上架、下架等产品事件
- ✅ 需要其他模块响应的事件

**不应该发送Signal的场景**：
- ❌ 简单的数据查询
- ❌ 不需要其他模块响应的操作
- ❌ 频繁发生的事件（如页面浏览）

### 4.2 Signal的同步 vs 异步

```python
# 同步处理（默认）
@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    """同步处理 - 立即执行"""
    update_inventory(order)

# 异步处理（使用Celery）
@receiver(order_created)
def handle_order_created_async(sender, order, **kwargs):
    """异步处理 - 使用Celery"""
    from apps.orders.tasks import process_order_async
    process_order_async.delay(order.id)
```

### 4.3 避免Signal循环

```python
# ❌ 错误做法 - 可能导致循环
@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    # 这里不要再发送order_created信号
    order_created.send(sender=OrderService, order=order)

# ✅ 正确做法 - 发送不同的信号
@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    # 发送不同的信号
    order_processing.send(sender=OrderService, order=order)
```

---

## 五、Signals的性能优化

### 5.1 使用dispatch_uid避免重复注册

```python
# ✅ 正确做法
@receiver(order_created, dispatch_uid='notify_order_created')
def notify_order_created(sender, order, **kwargs):
    pass

# ❌ 错误做法 - 可能导致重复注册
@receiver(order_created)
def notify_order_created(sender, order, **kwargs):
    pass
```

### 5.2 使用weak=False处理长期监听

```python
# 当需要长期监听时
@receiver(order_created, weak=False)
def handle_order_created(sender, order, **kwargs):
    pass
```

### 5.3 异步处理耗时操作

```python
# apps/notifications/handlers.py
from celery import shared_task

@receiver(order_created)
def handle_order_created(sender, order, **kwargs):
    """异步处理耗时操作"""
    send_notification_async.delay(order.id)

@shared_task
def send_notification_async(order_id):
    """异步发送通知"""
    order = Order.objects.get(id=order_id)
    # 耗时操作
    send_email(order.user.email, f"订单 {order.id} 已创建")
```

---

## 六、Signals的测试

### 6.1 单元测试

```python
# apps/orders/tests/test_signals.py
from django.test import TestCase
from django.dispatch import receiver
from apps.orders.models import Order
from apps.orders.signals.order_signals import order_created
from apps.orders.services.order_service import OrderService

class OrderSignalsTestCase(TestCase):
    def setUp(self):
        self.signal_received = False
        
        @receiver(order_created, dispatch_uid='test_receiver')
        def test_receiver(sender, order, **kwargs):
            self.signal_received = True
    
    def test_order_created_signal(self):
        """测试订单创建信号"""
        order = OrderService.create_order(user_id=1, items=[])
        self.assertTrue(self.signal_received)
```

### 6.2 集成测试

```python
# apps/notifications/tests/test_handlers.py
from django.test import TestCase
from apps.orders.services.order_service import OrderService
from apps.notifications.models import Notification

class NotificationHandlerTestCase(TestCase):
    def test_notification_created_on_order_created(self):
        """测试订单创建时是否创建通知"""
        order = OrderService.create_order(user_id=1, items=[])
        
        # 检查是否创建了通知
        notification = Notification.objects.filter(
            user_id=1,
            order_id=order.id
        ).first()
        
        self.assertIsNotNone(notification)
```

---

## 七、常见问题简表

- Signal 默认是同步执行的；如需异步，请在 handler 中使用 Celery 任务。
- 避免 Signal 循环：发送不同的 Signal、在 handler 中加条件判断、使用 `dispatch_uid`。
- 测试 Signal：注册测试专用 handler，断言其是否被触发以及产生的副作用。

---

## 八、代码审查要点

> 更完整的通用审查项见 `code-review-checklist.md`，本节只保留与 Signals 相关的关键点。

- [ ] 关键业务节点是否在 Services 中发送了适当的 Signal？
- [ ] 是否在 `apps.py` 中正确注册了 handlers，且使用了 `dispatch_uid`？
- [ ] 是否存在 Signal 循环或过于复杂的 handler 逻辑？
- [ ] 耗时操作是否通过 Celery 等方式异步处理？
- [ ] 是否为核心 Signal 场景编写了测试？

---

**版本历史**：
- v1.0 (2025-11-21): 初始版本