# PDF 转 Word 上传界面优化开发报告（v1.1）

> 文档版本：v1.1
> 生成日期：2026-08-13
> 适用对象：项目开发者 / 维护者
> 文档定位：本次优化需求分析 + 方案选型 + 测试结果 + 代码变更明细 + 衔接说明
> 关联文档：`docs/项目报告/My-Blog项目完整衔接报告_v1.0.md`

---

## 一、需求分析

### 1.1 背景
PDF 转 Word 是助理工具箱（`/assistant/`）中唯一需要登录的后端工具。原上传交互使用原生 `<input type="file">` + 普通按钮，存在两个问题：

1. **交互体验弱**：无拖拽、无已选文件预览、无移除能力，用户无法直观确认所选文件。
2. **布局宽度不一致（用户截图反馈）**：PDF 转 Word 面板被放置在 `.tool-wrapper` 关闭标签之外，未受 `max-width: 880px` 约束，导致卡片宽度明显窄于其他工具面板，视觉不协调。

### 1.2 需求边界（用户原话）
- "优化 PDF 转 Word 的文件上传界面"
- "把建议执行一遍"（即执行端到端验证 + 后端回归测试 + 查看日志）
- "@截图 PDF 转 Word 与主体大小不一样，修改 PDF 转 Word 的文件上传框架大小与主体框架大小一致"

### 1.3 约束
- **最小改动原则**：不破坏已完成的转换下载逻辑（进度条 / 错误提示 / 表格还原 / 图片型 PDF 降级）。
- **绝对导入规范**：本次仅涉及前端（HTML/JS/CSS），无 Python 导入改动。
- **遵循项目规范**：UTF-8、详细中文注释、异常中文日志、CSRF 保护保持不变。

---

## 二、开发 / 修改方案选型

| 方案 | 说明 | 优缺点 | 结论 |
|------|------|--------|------|
| A. 仅 CSS 拉宽面板 | 给面板加独立 `max-width` 强行对齐 | 改动最小，但未解决交互体验，且破坏布局统一约束 | 否决 |
| B. 拖拽区 + 文件卡片 + 移入 tool-wrapper（推荐） | 重写上传区为 `.pdf-dropzone`（拖拽/点击/键盘 a11y）+ `.pdf-file-card` 预览 + 独立操作行；把面板 HTML 移回 `.tool-wrapper` 内 | 彻底解决宽度不一致，交互现代化，复用既有 `.tool-wrapper` 约束；改动集中在 3 个静态文件 | **采用** |
| C. 引入第三方上传组件 | 如 Dropzone.js | 增加依赖体积、需改打包流程（本项目无构建步骤） | 否决 |

**采用方案 B**，理由：与现有 `.tool-wrapper` 布局约束一致、零新增依赖、a11y 友好、向后兼容既有转换下载逻辑。

---

## 三、测试结果

### 3.1 端到端（Playwright MCP / Chrome）
- 工具箱页 `/assistant/` 打开正常，PDF 转 Word 面板宽度与其他面板一致（880px 约束生效）。
- 拖拽区渲染正常；通过浏览器内注入 `File` + `DataTransfer` 模拟选择，文件卡片正确渲染文件名与大小、出现"移除"按钮。
- 移除按钮可清空卡片、恢复拖拽区初始态。
- 合法 PDF 上传 → 后端返回 `.docx` 流 → 浏览器触发下载（文件名取自 `Content-Disposition`）。
- `data/logs/debug.log` 与 `error.log` 无新增报错。

### 3.2 后端回归测试（Django TestCase，脚本已清理）
验证 `pdf_to_word_view` 既有校验未被破坏，3 项全过：

| 用例 | 输入 | 预期 | 结果 |
|------|------|------|------|
| 合法 PDF 转换 | 含文字的 `.pdf`（SimpleUploadedFile） | 200 + `.docx` 下载 | PASS |
| 非 PDF 拒绝 | `.txt` 文件 | 400 + 错误 JSON | PASS |
| 无文件拒绝 | 空请求体 | 400 + 错误 JSON | PASS |

> 说明：非 PDF 的前端预校验（扩展名 + 20MB）因 Chromium 运行时 `input.files` 赋值不可靠，端到端未能稳定复现，已由后端 Django 测试覆盖；前端预校验逻辑在 `assistant.js` 的 `validate()` 中保留。

### 3.3 Django check
`python manage.py check` → 0 错误、0 silenced（本次仅改前端，无系统层影响）。

---

## 四、代码新增 / 变更明细

### 4.1 `blog/templates/blog/assistant.html`
- **面板位置修复**：将 `#panel-pdfword` 从 `.tool-wrapper` 关闭标签（`</div>`）之后移入 `.tool-wrapper` 内（图表面板之后、`.tool-wrapper` 关闭标签之前），使其受 880px 约束。
- **上传区重写**：原生 `<input type="file">` 改为：
  - `.pdf-dropzone` 拖拽区（`id="pdfDropzone"`，含隐藏 file input + 说明文案）
  - `.pdf-file-card` 已选文件预览卡片（`id="pdfFileCard"`，含文件名/大小/移除按钮）
  - `.pdf-action-row` 独立操作行（转换按钮 + 提示信息 `#pdfWordMsg`）

### 4.2 `static/js/assistant.js`
重写 `bindPdfToWord` IIFE，新增：
- `validate(file)`：前端预校验扩展名（`.pdf`）与体积（≤20MB）。
- `renderFile(file)` / `clearFile()`：渲染/清空文件卡片。
- `handlePicked(file)`：统一处理点击/拖拽/键盘选择的文件。
- dropzone 事件监听：`click` / `keydown(Enter|Space)` / `dragover` / `dragleave` / `drop`。
- 下载文件名从响应头 `Content-Disposition` 解析（复用既有 `xhr.onload` 逻辑）。

### 4.3 `static/css/assistant.css`
新增样式（含暗色模式适配）：
- `.pdf-dropzone`（虚线边框、hover/active 态、dragover 高亮）
- `.pdf-file-card` / `.file-card-remove`（已选文件卡片 + 移除按钮）
- `.pdf-action-row`（操作行布局）

---

## 五、新增 / 修改的 URL 路由

**无新增 / 无修改。** 仍沿用既有路由：

| URL | 视图 | 方法 | 权限 |
|-----|------|------|------|
| `/assistant/pdf-to-word/` | `pdf_to_word_view` | POST | `@login_required` + `@require_POST` |

---

## 六、数据库迁移说明

**无数据库变更。** 本次仅修改前端静态资源与模板，不涉及任何 Model / Migration。

---

## 七、核心总结

- 通过"把面板移回 `.tool-wrapper` 内"一次性解决宽度不一致问题，根因是面板原先位于布局约束容器之外。
- 上传交互从原生 input 升级为拖拽 + 卡片预览，提升可用性且保持零依赖、零构建。
- 既有转换下载、进度、错误提示、表格还原、图片型 PDF 降级逻辑均未被破坏，后端 3 项测试全过，日志无报错。
- 测试脚本与样例文件已清理，不留临时产物。

---

## 八、本次开发优化建议

1. **面板位置规范**：未来新增工具面板时，务必置于 `.tool-wrapper` 内部，避免再次出现宽度不一致；建议在 `assistant.html` 顶部加注释说明该约束。
2. **前端预校验一致性**：`validate()` 的扩展名/体积校验与后端 `pdf_to_word_view` 的校验阈值（20MB / `.pdf`）应保持一致，建议将上限抽为前端常量并加注释，便于同步修改。

---

## 九、下一步可选开发 / 优化方向

- [ ] 拖拽区增加"多文件队列"支持（当前为单文件，转换一次即下载；如需批量可改为队列串行）。
- [ ] 图片型 PDF：评估是否引入轻量 OCR（如 `easyocr`）作为可选插件，保持默认关闭以不增重依赖。
- [ ] 助理页新增工具的"面板位置自查"清单，纳入交付前检查。
- [ ] 后端 `pdf_to_word_view` 可补充单元测试固化（已用临时脚本验证，建议沉淀为 `blog/tests/` 永久用例）。

---

*报告生成遵循项目规范：详细中文注释、UTF-8 编码、异常中文日志、CSRF 保护、最小改动原则。*
