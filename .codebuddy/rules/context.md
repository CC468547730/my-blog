---
description: 
alwaysApply: true
enabled: true
updatedAt: 2026-05-29T01:10:54.741Z
provider: 
---

- 使用简体中文进行交互沟通；
- 进行开发前必要时建议审视一遍整体的项目目录文件结构；
- 开发与修改中，使用最小改动方式,尽可能不要破坏已完成开发的部分，避免影响效果和降低开发效率；   
- 前端django模板已经完成了，在开发时尽可能不要自己写css和js，请根据vuexy的规范去设计和尽可能最大化引入和复用它的样式，必要时查询vuexy文档和本地的vuexy参考库；  
- 如果不得已需要自己写css和js，请不要直接修改vuexy的样式，请先检查本页的css和js后，再直接在网页底部写入css和js进行覆盖叠加，方便调试；  
- 可以在开发中查看'data/logs'运行日志和报错日志；  
- 项目开发理念: Django5原生模板开发规则保持不变，如果需要ajax调用 DRF 接口，但仍使用 Session 认证和需要携带 CSRF 令牌。
- **所有代码必须严格使用绝对导入，禁止任何形式的相对导入**，以保证代码一致性、可维护性和可读性。

## 开发环境说明
- 当前开发主机环境为 **Windows**，命令行以 PowerShell 为主；
- 核心服务通过Docker + Docker Compose（9容器编排:web + nginx + postgresql + redis + celery-worker + celery-beat + channels + pgbouncer + wrangler）；
- 本地开发时优先使用 Docker 编排环境，确保与线上部署拓扑保持一致；
- 更详细的环境与运行方式说明请参考 `.rules/dev-environment.md`。

## 后台模板开发
- 本项目使用自开发dashboard，并不使用django自带的admin，所以请不需要考虑django admin的使用和相关问题；
- 制作新页面和调整dashboard页面时，需要同步更新侧边栏导航sidbar.yaml(参考其他模块的sidbar.yaml)， 需要相应展开下拉菜单以及高亮显示对应的菜单项;
- 后台所有页面的url要基于这个原则：一级页面目录为：'/dashboard/',以此类推：'/dashboard/一级页面目录/二级页面目录/最多四级'
多个单词请用横杠连接，例如：/dashboard/extensions/product-extensions/

## 模块开发核心原则
参考文档
  - `.rules\application-structure-and-modularization.md` 定义了:
    - 应用程序的目录结构和模块化原则；
    - 服务层、信号层、查询层、视图层、路由层、表单层的目录组织；
    - 目录拆分的强制要求；
  - `.rules\apps-development-order.md` 定义了:
    - 应用程序的开发顺序和依赖关系；
  - `.rules\project-structure.md` 定义了:
    - 项目的目录结构和组织原则；

## 模板标签注意事项
- 注意：Django模板免多层嵌套结构导致Django模板引擎变量解析递归错误：{% with %}标签内使用{% elif %}。避免复杂条件判断，避免多重嵌套，会增加了模板解析复杂性；
- '__class__.__name__'，这在Django模板中是不允许的，因为变量和属性不能以下划线开头；
- Django模板中没有 {% break %} 标签，这是无效的语法，谨慎使用；
- 该项目是双会话机制，要考虑到权限问题,现有的视图函数支持 @admin_required 和 @admin_required() 两种调用方式，装饰器已经过重构- 以正确处理类视图和函数视图的参数传递。request.is_admin_authenticated() 方法是通过中间件绑定到 request 对象上的。对于类视图，使用 @method_decorator(admin_required, name='dispatch') 模式。

## 测试与修复规则
- PowerShell不支持&&语法,请用`;`,提供给用户执行的powershell等命令,不要换行,powershell命令用`;`连接,需要单行可执行;
- 由于开发环境是中文环境，优先编写Python文件脚本执行，使用PowerShell的命令操作代码文件与模板，因为会破坏了UTF-8编码导致乱码问题，避免shell脚本,目前环境权限问题，不能完美执行；
- 编辑器IDE的linter不理解Django模板语法可能会报错，有可能不是真正的语法错误，不要频繁去修复这些linter错误；
- 每完成一个调整(编辑文档除外)后，运行 `e:/Project/coremall/venv/Scripts/Activate.ps1; cd core;python manage.py check` 验证，避免django服务器无法启动；
- 当开发或调整某个url页面内容后，本项目支持playwright MCP,请Chrome浏览器里测试打开一次，可分析页面状态情况,并且查看`data\logs\debug.log`和`data\logs\error.log`是否出现报错；

## 常见问题与修复经验
- 诊断方法：系统性检查权限装饰器、代码错误、字段名错误
- 修复策略：移除静默重定向装饰器，添加手动权限检查和友好错误提示
- 验证流程：使用测试脚本验证，然后通过playwaright mcp chrome浏览器确认
- 图标风格统一采用Tabler Icons格式：图标使用的是 'icon-base ti tabler-图标名' 的格式;
- 注意static目录在data目录内(data目录与core目录同级)；

## 每次新开发或调整模块时,涉及到页面URL的新增或变动则:
开发完成后,需要检查下面三个位置的链接数量和顺序,进行补齐和对齐:
`/dashboard/overview/`页面对应<模块名>中的:overview内的导航card链接;
模块概览页`/dashboard/<模块名>/`页面中的:快捷导航card链接;
模块侧边栏`core\apps\<模块名>\sidebar.yaml`文件中的:导航链接;
注意:常规的curd页面的url一般是在列表中,不需要加入其中.

## 每次完成开发或修改任务后:
- 必须总结本次的关键经验教训;
- 编写详细的报告，报告的存档位置和文件命名规范请参考`docs/开发指南/docs规范/文档规范_双轨制管理_v1.0.md`
- 报告内应包含：分析、开发或修改方案、测试结果、代码新增/变更、新增或修改的URL等说明
- 提供本次的开发或修改总结、并且提出你的对本次开发或修改的建议、以及下一步可选的开发、优化建议；
- 每次沟通如发现新问题及时提出;