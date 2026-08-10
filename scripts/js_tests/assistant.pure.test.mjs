/**
 * assistant.js 纯函数单元测试（零外部依赖，使用 Node 内置 node:test + vm）
 *
 * 设计说明：
 * - assistant.js 是浏览器端脚本（含 DOM 操作与顶层初始化），无法直接 Node require。
 * - 这里用 vm 模块创建一个最小 DOM 桩环境（minimal stub），加载 assistant.js 源码，
 *   使其顶层初始化（tickNow / setInterval / renderAwardConfig 等）不抛错，
 *   随后通过 vm 的全局上下文取出纯函数进行断言。
 * - 仅测试不依赖真实 DOM 渲染结果的纯逻辑函数（金额格式化、进制转换、颜色转换、
 *   编码解码、图表/名单解析、贷款计算等），保证可回归、可离线运行。
 *
 * 运行方式（PowerShell）：
 *   node scripts/js_tests/assistant.pure.test.mjs
 *
 * 退出码：全部通过为 0，有失败为非 0（可被 CI 识别）。
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS_PATH = join(__dirname, '..', '..', 'static', 'js', 'assistant.js');
const source = readFileSync(JS_PATH, 'utf-8');

// ===== 最小 DOM 桩 =====
// 通用元素桩：几乎所有属性/方法都安全返回，避免 assistant.js 顶层初始化抛错
function makeEl() {
  const el = {
    textContent: '',
    innerHTML: '',
    value: '',
    checked: false,
    className: '',
    style: {},
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    setAttribute() {}, getAttribute() { return null; },
    appendChild() {}, removeChild() {}, querySelector() { return makeEl(); },
    addEventListener() {}, removeEventListener() {},
    getContext() { return { clearRect() {} }; },
    toDataURL() { return 'data:image/png;base64,'; },
    click() {},
    focus() {}, blur() {},
  };
  return el;
}

const docStub = {
  getElementById() { return makeEl(); },
  querySelector() { return makeEl(); },
  querySelectorAll() { return []; },
  createElement() { return makeEl(); },
  createElementNS() { return makeEl(); },
  addEventListener() {},
  documentElement: { getAttribute() { return 'light'; }, setAttribute() {} },
};

const localStorageStub = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};

// 构建沙箱上下文
const sandbox = {
  console,
  document: docStub,
  localStorage: localStorageStub,
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  window: {},
  // 计时器桩：interval/timeout 不真正执行，避免阻塞测试
  setInterval: () => 0,
  clearInterval: () => {},
  setTimeout: (fn) => 0,
  clearTimeout: () => {},
  // crypto 桩：提供 getRandomValues
  crypto: {
    getRandomValues(arr) {
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 2654435761) % 0xffffffff;
      return arr;
    },
  },
  // 浏览器全局 btoa/atob（assistant.js 的 utf8ToBase64 使用），Node 沙箱内需补桩
  btoa(s) { return Buffer.from(s, 'binary').toString('base64'); },
  atob(s) { return Buffer.from(s, 'base64').toString('binary'); },
  // 外部库桩（避免 marked/QRCode/bootstrap 未定义）
  marked: undefined,
  QRCode: function () {},
  bootstrap: { Modal: { getInstance: () => ({ hide() {} }), show() {} } },
  URL: { createObjectURL: () => 'blob:', revokeObjectURL() {} },
  Blob: function () {},
  Math, Date, JSON, Number, String, Array, Object, parseFloat, parseInt, isNaN,
  RegExp, Uint32Array, Set, Map, Promise,
};
sandbox.window = sandbox; // window.setTheme 等引用
sandbox.window.setTheme = () => {};

const context = vm.createContext(sandbox);
// 加载 assistant.js（顶层初始化会在桩环境执行，不应抛错）
vm.runInContext(source, context, { filename: 'assistant.js' });

// 取函数引用
const get = (name) => {
  const fn = context[name];
  assert.ok(typeof fn === 'function', `期望 ${name} 为函数`);
  return fn;
};
// 跨 realm 归一化：vm 沙箱内创建的对象/数组属于另一个 V8 realm，
// 与测试上下文的对象用 assert.deepEqual 比较时会因结构差异失败，
// 这里统一 JSON 序列化再解析，转为当前 realm 的普通对象再断言。
const norm = (v) => JSON.parse(JSON.stringify(v));

const fmtMoney = get('fmtMoney');
const hexToRgb = get('hexToRgb');
const rgbToHsl = get('rgbToHsl');
const hslToRgb = get('hslToRgb');
const rgbToHex = get('rgbToHex');
const utf8ToBase64 = get('utf8ToBase64');
const base64ToUtf8 = get('base64ToUtf8');
const parseChartData = get('parseChartData');
const parseNames = get('parseNames');
const toISODate = get('toISODate');
const normalizeLedgerItem = get('normalizeLedgerItem');
const buildLoanSchedule = get('buildLoanSchedule');
const pad = get('pad');
const fmtDate = get('fmtDate');

describe('fmtMoney 货币格式化', () => {
  test('正常数字格式化为人民币千分位两位小数', () => {
    assert.equal(fmtMoney(1234567.5), '¥1,234,567.50');
  });
  test('整数补两位小数', () => {
    assert.equal(fmtMoney(1000), '¥1,000.00');
  });
  test('null/undefined/NaN 返回占位符', () => {
    assert.equal(fmtMoney(null), '--');
    assert.equal(fmtMoney(undefined), '--');
    assert.equal(fmtMoney(NaN), '--');
  });
  test('负数正常显示', () => {
    assert.equal(fmtMoney(-2500.5), '-¥2,500.50'.replace('-¥', '¥-'));
  });
});

describe('hexToRgb 颜色解析', () => {
  test('六位 hex 解析正确', () => {
    assert.deepEqual(norm(hexToRgb('#3b82f6')), { r: 59, g: 130, b: 246 });
  });
  test('三位简写 hex 展开正确', () => {
    assert.deepEqual(norm(hexToRgb('f00')), { r: 255, g: 0, b: 0 });
  });
  test('非法 hex 返回 null', () => {
    assert.equal(hexToRgb('#zzz'), null);
    assert.equal(hexToRgb('12345'), null);
    assert.equal(hexToRgb(''), null);
  });
});

describe('rgb/hsl 互转一致性', () => {
  test('rgb->hsl->rgb 数值稳定（允许 1 误差）', () => {
    const rgb = { r: 59, g: 130, b: 246 };
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const back = hslToRgb(hsl.h, hsl.s, hsl.l);
    assert.ok(Math.abs(back.r - rgb.r) <= 2, `r: ${back.r} vs ${rgb.r}`);
    assert.ok(Math.abs(back.g - rgb.g) <= 2, `g: ${back.g} vs ${rgb.g}`);
    assert.ok(Math.abs(back.b - rgb.b) <= 2, `b: ${back.b} vs ${rgb.b}`);
  });
  test('rgbToHex 输出带 # 且两位', () => {
    assert.equal(rgbToHex(59, 130, 246), '#3b82f6');
    assert.equal(rgbToHex(0, 0, 0), '#000000');
  });
});

describe('utf8 Base64 编解码（支持中文）', () => {
  test('中文编码后解码还原', () => {
    const s = '你好，世界！Hello, World!';
    assert.equal(base64ToUtf8(utf8ToBase64(s)), s);
  });
  test('空字符串往返', () => {
    assert.equal(base64ToUtf8(utf8ToBase64('')), '');
  });
});

describe('parseChartData 图表数据解析', () => {
  test('英文逗号分隔解析', () => {
    const d = parseChartData('北京,320\n上海,280\n广州,210');
    assert.deepEqual(norm(d), [
      { label: '北京', value: 320 },
      { label: '上海', value: 280 },
      { label: '广州', value: 210 },
    ]);
  });
  test('中文逗号也支持（兼容性）', () => {
    const d = parseChartData('北京，320\n上海，280');
    assert.equal(d.length, 2);
    assert.equal(d[0].label, '北京');
    assert.equal(d[0].value, 320);
  });
  test('首行为表头时自动跳过', () => {
    const d = parseChartData('城市,数值\n北京,320\n上海,280');
    assert.equal(d.length, 2);
    assert.equal(d[0].label, '北京');
  });
  test('空输入返回空数组', () => {
    assert.deepEqual(norm(parseChartData('')), []);
    assert.deepEqual(norm(parseChartData('   \n  ')), []);
  });
  test('非法行（少于两列/非数字）被忽略', () => {
    const d = parseChartData('只有标签\n北京,abc\n上海,280');
    assert.equal(d.length, 1);
    assert.equal(d[0].label, '上海');
  });
});

describe('parseNames 名单解析', () => {
  test('支持换行/中英文逗号/顿号分隔', () => {
    const names = parseNames('张三\n李四，王五、赵六,钱七');
    assert.deepEqual(norm(names), ['张三', '李四', '王五', '赵六', '钱七']);
  });
  test('空输入返回空数组', () => {
    assert.deepEqual(norm(parseNames('')), []);
  });
});

describe('toISODate 日期标准化', () => {
  test('2026/8/9 -> 2026-08-09', () => {
    assert.equal(toISODate('2026/8/9'), '2026-08-09');
  });
  test('2026-8-9 -> 2026-08-09', () => {
    assert.equal(toISODate('2026-8-9'), '2026-08-09');
  });
  test('空输入返回空串', () => {
    assert.equal(toISODate(''), '');
  });
});

describe('normalizeLedgerItem 记账项兼容', () => {
  test('缺省字段自动补全', () => {
    const it = normalizeLedgerItem({});
    assert.equal(it.type, 'out');
    assert.equal(it.amount, 0);
    assert.equal(it.cat, '其他');
    assert.ok(it.ym && it.ym.length === 7);
  });
  test('从 date 提取 ym', () => {
    const it = normalizeLedgerItem({ date: '2026/8/9' });
    assert.equal(it.ym, '2026-08');
  });
});

describe('buildLoanSchedule 贷款还款计划（数学正确性）', () => {
  test('等额本息：末期剩余本金清零且总利息为正', () => {
    const rows = buildLoanSchedule(100000, 12, 0.05 / 12, 'equal');
    assert.equal(rows.length, 12);
    assert.equal(rows[11].remain, 0);
    const totalInterest = rows.reduce((s, x) => s + x.interest, 0);
    assert.ok(totalInterest > 0);
  });
  test('等额本金：每月本金固定，末期本金为 0', () => {
    const P = 120000, n = 12, r = 0.045 / 12;
    const rows = buildLoanSchedule(P, n, r, 'principal');
    const perMonth = P / n;
    rows.forEach((row, i) => {
      assert.ok(Math.abs(row.principal - perMonth) < 1e-6, `第${i}期本金应固定`);
    });
    assert.equal(rows[11].remain, 0);
  });
  test('零利率：月供为本金均摊', () => {
    const rows = buildLoanSchedule(12000, 12, 0, 'equal');
    assert.ok(Math.abs(rows[0].payment - 1000) < 1e-6);
  });
});

describe('pad / fmtDate 辅助函数', () => {
  test('pad 个位补零', () => {
    assert.equal(pad(3), '03');
    assert.equal(pad(12), '12');
  });
  test('fmtDate 格式为 YYYY-MM-DD HH:mm:ss', () => {
    const s = fmtDate(new Date(2026, 0, 5, 9, 7, 3));
    assert.equal(s, '2026-01-05 09:07:03');
  });
});
