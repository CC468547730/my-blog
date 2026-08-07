---
description: 写Services层时
alwaysApply: false
enabled: true
updatedAt: 2026-05-29T01:13:09.404Z
provider: 
---

# 规则：Services层开发规范

**版本**: v1.0  
**更新时间**: 2025-11-21  
**适用范围**: 所有Services层代码  
**核心理念**: 业务逻辑集中、易于测试、易于复用

---

## 一、Services层的定义

### 1.1 什么是Services层

Services层是应用的业务逻辑层，包含所有与业务相关的操作。它是views、api、celery任务的共同依赖，确保业务逻辑的一致性。

### 1.2 Services层的特点

- ✅ 不依赖request对象
- ✅ 接收原始数据，返回模型或字典
- ✅ 可独立测试
- ✅ 可被任何地方调用（views、api、celery、signals）
- ✅ 发送关键业务的Signals

### 1.3 Services层的职责

- 实现业务逻辑
- 调用models进行数据操作
- 发送Signals通知其他模块
- 调用其他services完成复杂业务
- 处理业务异常

---

## 二、Services层的结构

### 2.1 目录结构

```
apps/应用名/services/
├── __init__.py
├── base_service.py       # 基础服务类
├── order_service.py      # 订单服务
├── payment_service.py    # 支付服务
└── notification_service.py
```

### 2.2 文件拆分原则

| 原则 | 说明 |
|------|------|
| **单一职责** | 每个service文件只负责一个功能 |
| **文件大小** | 每个文件不超过300行代码 |
| **业务边界** | 按业务功能拆分，不按技术拆分 |
| **命名清晰** | 文件名清晰表达功能 |

### 2.3 基础服务类

```python
# apps/orders/services/base_service.py
from django.db import transaction
import logging

logger = logging.getLogger(__name__)

class BaseService:
    """基础服务类"""
    
    @staticmethod
    @transaction.atomic
    def execute_with_transaction(func, *args, **kwargs):
        """在事务中执行操作"""
        try:
            result = func(*args, **kwargs)
            return result
        except Exception as e:
            logger.error(f"Service执行失败: {str(e)}", exc_info=True)
            raise
    
    @staticmethod
    def handle_error(error_msg, error_code=None):
        """统一的错误处理"""
        logger.error(error_msg)
        raise Exception(f"{error_code}: {error_msg}")
```

---

## 三、Services层的设计模式

### 3.1 基本结构

```python
# apps/orders/services/order_service.py
from django.db import transaction
from apps.orders.models import Order
from apps.orders.signals.order_signals import order_created
from .base_service import BaseService

class OrderService(BaseService):
    """订单服务"""
    
    @staticmethod
    @transaction.atomic
    def create_order(user_id, items):
        """
        创建订单
        
        Args:
            user_id: 用户ID
            items: 订单项列表
            
        Returns:
            Order: 创建的订单对象
            
        Raises:
            ValueError: 参数验证失败
        """
        # 1. 验证
        if not user_id or not items:
            raise ValueError("用户ID和订单项不能为空")
        
        # 2. 创建
        order = Order.objects.create(user_id=user_id)
        
        # 3. 发送Signal
        order_created.send(sender=OrderService, order=order)
        
        # 4. 返回结果
        return order
    
    @staticmethod
    def update_order_status(order_id, status):
        """更新订单状态"""
        order = Order.objects.get(id=order_id)
        order.status = status
        order.save()
        return order
```

### 3.2 调用其他Services

```python
# apps/orders/services/order_service.py
from apps.payments.services.payment_service import PaymentService

class OrderService:
    @staticmethod
    def create_and_pay_order(user_id, items, payment_method):
        """创建订单并支付"""
        # 1. 创建订单
        order = OrderService.create_order(user_id, items)
        
        # 2. 调用支付服务
        payment = PaymentService.process_payment(
            order_id=order.id,
            amount=order.total_amount,
            method=payment_method
        )
        
        return order, payment
```

### 3.3 错误处理

```python
# ✅ 正确做法
class OrderService:
    @staticmethod
    def create_order(user_id, items):
        try:
            # 业务逻辑
            order = Order.objects.create(user_id=user_id)
            return order
        except Exception as e:
            logger.error(f"创建订单失败: {str(e)}", exc_info=True)
            raise  # 让调用者处理异常

# ❌ 错误做法
class OrderService:
    @staticmethod
    def create_order(user_id, items):
        try:
            order = Order.objects.create(user_id=user_id)
            return order
        except Exception:
            return None  # 不要吞掉异常
```

---

## 四、Services层的使用规范

### 4.1 在Views中使用Services

```python
# apps/orders/views/list.py
from django.shortcuts import render
from apps.orders.services.order_service import OrderService

def order_list_view(request):
    """订单列表视图"""
    try:
        # 调用service获取数据
        orders = OrderService.get_user_orders(request.user.id)
        return render(request, 'orders/list.html', {'orders': orders})
    except Exception as e:
        logger.error(f"获取订单列表失败: {str(e)}")
        return render(request, 'error.html', {'error': '获取订单失败'})
```

### 4.2 在API中使用Services

```python
# apps/orders/api/v1/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from apps.orders.services.order_service import OrderService

class OrderCreateAPIView(APIView):
    def post(self, request):
        """创建订单API"""
        try:
            order = OrderService.create_order(
                user_id=request.user.id,
                items=request.data.get('items')
            )
            return Response({'order_id': order.id})
        except Exception as e:
            return Response({'error': str(e)}, status=400)
```

### 4.3 在Celery任务中使用Services

```python
# apps/orders/tasks.py
from celery import shared_task
from apps.orders.services.order_service import OrderService

@shared_task
def process_order_payment(order_id):
    """处理订单支付"""
    try:
        order = OrderService.get_order(order_id)
        OrderService.process_payment(order)
    except Exception as e:
        logger.error(f"处理订单支付失败: {str(e)}")
```

---

## 五、Services层的性能优化

### 5.1 数据库查询优化

```python
# ❌ 错误做法 - N+1查询
class OrderService:
    @staticmethod
    def get_orders_with_items(user_id):
        orders = Order.objects.filter(user_id=user_id)
        for order in orders:
            items = order.items.all()  # N+1查询

# ✅ 正确做法 - 使用prefetch_related
class OrderService:
    @staticmethod
    def get_orders_with_items(user_id):
        orders = Order.objects.filter(
            user_id=user_id
        ).prefetch_related('items')
        return orders
```

### 5.2 缓存策略

```python
# apps/orders/services/order_service.py
from django.core.cache import cache

class OrderService:
    @staticmethod
    def get_order_stats(user_id):
        """获取订单统计（带缓存）"""
        cache_key = f'order_stats_{user_id}'
        stats = cache.get(cache_key)
        
        if stats is None:
            stats = {
                'total': Order.objects.filter(user_id=user_id).count(),
                'pending': Order.objects.filter(user_id=user_id, status='pending').count(),
            }
            cache.set(cache_key, stats, 3600)  # 缓存1小时
        
        return stats
```

### 5.3 批量操作

```python
# ✅ 正确做法 - 批量创建
class OrderService:
    @staticmethod
    def create_orders_batch(orders_data):
        """批量创建订单"""
        orders = [Order(**data) for data in orders_data]
        Order.objects.bulk_create(orders)
        return orders
```

---

## 六、Services层的测试

### 6.1 单元测试

```python
# apps/orders/tests/test_services.py
from django.test import TestCase
from apps.orders.services.order_service import OrderService
from apps.orders.models import Order

class OrderServiceTestCase(TestCase):
    def setUp(self):
        self.user_id = 1
    
    def test_create_order(self):
        """测试创建订单"""
        items = [{'product_id': 1, 'quantity': 2}]
        order = OrderService.create_order(self.user_id, items)
        
        self.assertIsNotNone(order.id)
        self.assertEqual(order.user_id, self.user_id)
    
    def test_create_order_with_invalid_data(self):
        """测试创建订单失败"""
        with self.assertRaises(ValueError):
            OrderService.create_order(None, [])
```

### 6.2 集成测试

```python
# apps/orders/tests/test_services.py
class OrderServiceIntegrationTestCase(TestCase):
    def test_create_and_pay_order(self):
        """测试创建订单并支付"""
        order, payment = OrderService.create_and_pay_order(
            user_id=1,
            items=[{'product_id': 1}],
            payment_method='credit_card'
        )
        
        self.assertIsNotNone(order.id)
        self.assertIsNotNone(payment.id)
```

---

## 七、代码审查要点

> 更完整的项目级审查项见 `code-review-checklist.md`，本节只保留 Services 相关的关键点。

- [ ] 业务逻辑是否全部下沉到 Services，而非分散在 views / API 中？
- [ ] Services 是否独立于 request，对外提供清晰、可测试的方法？
- [ ] 关键业务流程是否在合适的位置发送 Signals？
- [ ] 是否有明显的 N+1 查询或可通过 Queries 层抽象的查询？
- [ ] 是否为核心 Services 编写了单元测试？

---

**版本历史**：
- v1.0 (2025-11-21): 初始版本