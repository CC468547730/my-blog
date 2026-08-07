---
description: 
alwaysApply: true
enabled: true
updatedAt: 2026-05-29T01:08:22.594Z
provider: 
---

# 规则：应用结构与模块化

**版本**: v1.0  
**更新时间**: 2025-11-21  
**适用范围**: 所有Django应用（apps）  
**核心理念**: 事件驱动 + 服务层 + 模块解耦

---

## 一、核心原则

### 1.1 必须遵守的原则

1. **Services层是必须的** - 所有业务逻辑都在services中
2. **Signals层是必须的** - 关键业务节点都发送Signal
3. **Queries层是必须的** - 跨模块查询都有queries
4. **Views层是可选的** - 仅用于PC端模板渲染
5. **API层是可选的** - 仅用于DRF接口
6. **urls/**: 路由层（目录形式）
7. **forms/**: 后台表单层（目录形式）
8. **目录拆分是强制的** - services/、signals/、queries/、views/、urls/、forms/都使用目录形式

### 1.2 设计目标

- ✅ 模块间解耦
- ✅ 业务逻辑集中
- ✅ 易于测试
- ✅ 易于复用
- ✅ 支持事件驱动
- ✅ 支持插件化

### 1.3 相关规则

- `services-layer-development-specifications.md`（Services层开发规范）
- `signals-usage-specifications.md`（Signals使用规范）
- `queries-service-specifications.md`（Queries查询服务规范）
- `inter-module-communication-specifications.md`（模块间通讯规范）

---

## 二、标准应用结构（强制目录拆分）

### 2.1 核心目录结构

> 完整应用目录结构以 `.rules/project-structure.md` 为准，本节仅展示与模块化强相关的核心目录。

```
apps/应用名/
├── models.py                 # 数据模型（必须）
├── services/                 # 业务逻辑层（必须 - 目录形式）
├── signals/                  # 信号定义（必须 - 目录形式）
├── queries/                  # 查询服务（必须 - 目录形式）
├── views/                    # PC端视图（可选 - 目录形式）
├── api/v1/                   # API接口（可选 - 目录形式）
└── tests/                    # 单元测试（必须 - 目录形式）
```

### 2.2 目录拆分说明

| 目录 | 形式 | 说明 |
|------|------|------|
| **services/** | 强制目录 | 业务逻辑层，按功能拆分 |
| **signals/** | 强制目录 | 信号定义，按功能拆分 |
| **queries/** | 强制目录 | 查询服务，按功能拆分 |
| **views/** | 强制目录 | PC端视图，按功能拆分 |
| **api/v1/** | 强制目录 | API接口，按功能拆分 |
| **tests/** | 强制目录 | 单元测试，按功能拆分 |

---

## 三、各层职责定义

### 3.1 Services层（业务逻辑层）

**职责**：
- 实现所有业务逻辑
- 与views、api解耦
- 可独立测试
- 发送关键业务的Signals

**特点**：
- 不依赖request对象
- 接收原始数据，返回模型或字典
- 可被views、api、celery任务调用

**示例**：具体写法见 `services-layer-development-specifications.md` 中的示例。

### 3.2 Signals层（事件驱动层）

**职责**：
- 定义关键业务事件
- 实现模块间通讯
- 解耦模块依赖

**特点**：
- 在services中发送
- 在其他模块中订阅
- 支持异步处理

**示例**：具体写法见 `signals-usage-specifications.md` 中的示例。

### 3.3 Queries层（查询服务层）

**职责**：
- 聚合跨模块数据
- 集中管理对外依赖
- 解决模块间耦合

**特点**：
- 只读操作
- 返回数据字典或模型
- 可被任何地方调用

**示例**：具体写法见 `queries-service-specifications.md` 中的示例。

### 3.4 Views层（视图层）

**职责**：
- 处理HTTP请求
- 调用services获取数据
- 渲染模板

**特点**：
- 不包含业务逻辑
- 调用services处理业务
- 只负责HTTP处理

### 3.5 API层（接口层）

**职责**：
- 提供DRF接口
- 序列化数据
- 处理API请求

**特点**：
- 调用services处理业务
- 使用serializers序列化
- 返回JSON数据

---

## 四、跨应用协作规范

### 4.1 通过Services交互

- 需要**同步获取结果**时优先选择
- 在调用方直接调用目标应用的 Service 方法
- 典型场景：下单后立即调用支付 Service 完成支付
- 示例代码见 `inter-module-communication-specifications.md` 中 Services 小节

### 4.2 通过Signals通讯

- 适合事件驱动、一个事件有多个订阅方的场景
- 在 Service 中发送 Signal，在其他应用中通过 handler 订阅
- 可结合 Celery 做异步处理，避免阻塞主流程
- 示例代码见 `inter-module-communication-specifications.md` 与 `signals-usage-specifications.md`

### 4.3 通过Queries查询

- 访问其他应用数据且为**只读**场景
- 通过 Queries 聚合跨模块数据，统一做性能优化与缓存
- 示例代码见 `inter-module-communication-specifications.md` 与 `queries-service-specifications.md`

### 4.4 禁止的做法

- ❌ 跨应用直接导入 models 操作数据库
- ❌ 跨应用直接调用 views
- ❌ 在 views / API 中编写业务逻辑
- ❌ 在 Signals handler 中编写复杂业务（应下沉到 Services）

---

## 五、命名规范

### 5.1 文件命名

| 类型 | 命名规范 | 示例 |
|------|--------|------|
| 服务文件 | `[功能]_service.py` | `order_service.py` |
| 信号文件 | `[功能]_signals.py` | `order_signals.py` |
| 查询文件 | `[功能]_queries.py` | `order_queries.py` |
| 视图文件 | `[功能].py` | `list.py`, `detail.py` |
| 测试文件 | `test_[模块].py` | `test_services.py` |

### 5.2 类命名

| 类型 | 命名规范 | 示例 |
|------|--------|------|
| 服务类 | `[功能]Service` | `OrderService` |
| 查询类 | `[功能]Queries` | `OrderQueries` |
| 视图类 | `[功能]View` | `OrderListView` |

### 5.3 函数命名

| 类型 | 命名规范 | 示例 |
|------|--------|------|
| 服务方法 | `[动词]_[对象]` | `create_order` |
| 查询方法 | `get_[对象]` | `get_user_with_orders` |
| 视图函数 | `[对象]_[动词]` | `order_list` |

---

## 六、代码审查要点

> 通用的项目级检查见 `code-review-checklist.md`，本节只强调与应用结构相关的关键点。

- [ ] 是否按本规范拆分了 services / signals / queries / views / api / tests 目录？
- [ ] 是否存在跨应用直接操作 models 的情况？
- [ ] 业务逻辑是否集中在 Services，而非分散在 views / API / handlers 中？
- [ ] 关键业务节点是否通过 Signals 或统一的 Services 方法对外暴露？

---

## 七、常见问题解答

### Q1: 为什么 services、signals、queries 都要使用目录形式？

**A**: 为了统一结构、支撑复杂业务增长，并方便团队协作与代码审查。

### Q2: 什么时候应该创建新的 service 文件？

**A**: 当功能相对独立、文件过大（约 300 行以上）或存在清晰业务边界时。

### Q3: 如何避免循环依赖？

**A**: 优先通过 Signals 解耦、使用 Queries 聚合数据，避免跨应用直接导入。

---

**版本历史**：
- v1.0 (2025-11-21): 初始版本，强制目录拆分