/* ==========================================================================
   助理 / 工具箱页面交互逻辑（从 assistant.html 的 <script> 拆分，不修改任何 Vuexy 原始文件）
   变量与函数命名严格沿用原模板，与 HTML 中的 id/onclick 一一对应；
   末尾追加本次优化：搜索过滤、分组导航、记住上次使用、记账环形图、JSON 错误定位。
   ========================================================================== */

// ===================== 通用工具函数 =====================

// 切换工具面板
document.getElementById('toolNav').addEventListener('click', function (e) {
    const btn = e.target.closest('button[data-tool]');
    if (!btn) return;
    document.querySelectorAll('#toolNav button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.tool).classList.add('active');
    // 记住上次使用的工具
    try { localStorage.setItem('office_tool_last', btn.dataset.tool); } catch (err) {}
});

// 复制文本到剪贴板（兼容旧浏览器）
function copyText(elId) {
    const el = document.getElementById(elId);
    const text = el.value !== undefined ? el.value : el.textContent;
    if (!text) { showToast('没有可复制的内容'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板')).catch(() => fallbackCopy(text));
    } else {
        fallbackCopy(text);
    }
}
function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast('已复制到剪贴板'); }
    catch (e) { showToast('复制失败，请手动复制'); }
    document.body.removeChild(ta);
}

// 货币格式化：千分位 + 2 位小数
function fmtMoney(n) {
    if (n === null || n === undefined || isNaN(n)) return '--';
    const val = Number(n);
    return '¥' + val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// 提示气泡
let toastTimer;
function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// UTF-8 安全的 Base64 编解码
function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
function base64ToUtf8(b64) {
    return decodeURIComponent(escape(atob(b64)));
}

// ===================== 1. 时间戳转换 =====================
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function fmtDate(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
}
function tickNow() {
    const now = new Date();
    document.getElementById('time-now').textContent = fmtDate(now);
    const tsSec = Math.floor(now.getTime() / 1000);
    document.getElementById('time-now-ts').value = tsSec;
}
tickNow();
setInterval(tickNow, 1000);

function tsToDate() {
    const raw = document.getElementById('ts-input').value.trim();
    const out = document.getElementById('ts-result');
    if (!raw) { out.textContent = '请输入时间戳'; return; }
    const num = Number(raw);
    if (!Number.isFinite(num)) { out.textContent = '时间戳必须为数字'; return; }
    // 自动判定：10 位为秒，13 位为毫秒
    let ms = num;
    if (raw.length <= 11) ms = num * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) { out.textContent = '时间戳超出有效范围'; return; }
    out.textContent = fmtDate(d) + '  （' + d.toISOString() + '）';
}

// ===================== 2. 字数统计 =====================
function countWords() {
    const text = document.getElementById('count-input').value;
    const chars = text.length;
    const noSpace = text.replace(/\s/g, '').length;
    const lines = text === '' ? 0 : text.split(/\n/).length;
    // 英文按空格分词，中文逐字计
    const enWords = (text.match(/[A-Za-z0-9]+/g) || []).length;
    const cnChars = (text.match(/[一-龥]/g) || []).length;
    const words = enWords + cnChars;
    document.getElementById('stat-chars').textContent = chars;
    document.getElementById('stat-nospace').textContent = noSpace;
    document.getElementById('stat-words').textContent = words;
    document.getElementById('stat-lines').textContent = lines;
}

// ===================== 3. JSON 格式化（含错误定位） =====================
function jsonFormat() {
    const out = document.getElementById('json-output');
    const raw = document.getElementById('json-input').value.trim();
    const errLine = document.getElementById('json-err-line');
    if (errLine) errLine.textContent = '';
    if (!raw) { out.textContent = '请输入 JSON'; return; }
    try {
        const obj = JSON.parse(raw);
        out.textContent = JSON.stringify(obj, null, 4);
    } catch (e) {
        out.textContent = '解析失败：' + e.message;
        // 部分运行环境会在 message 中提供 position，据此推算行列定位
        const m = /position\s+(\d+)/.exec(e.message) || /at position (\d+)/.exec(e.message);
        if (m && errLine) {
            const pos = Number(m[1]);
            const before = raw.slice(0, pos);
            const line = before.split('\n').length;
            const col = pos - before.lastIndexOf('\n');
            errLine.textContent = '大致位置：第 ' + line + ' 行，第 ' + col + ' 列';
        }
    }
}
function jsonMinify() {
    const out = document.getElementById('json-output');
    const raw = document.getElementById('json-input').value.trim();
    const errLine = document.getElementById('json-err-line');
    if (errLine) errLine.textContent = '';
    if (!raw) { out.textContent = '请输入 JSON'; return; }
    try {
        const obj = JSON.parse(raw);
        out.textContent = JSON.stringify(obj);
    } catch (e) {
        out.textContent = '解析失败：' + e.message;
    }
}

// ===================== 4. 颜色转换 =====================
function hexToRgb(hex) {
    hex = hex.replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length !== 6 || /[^0-9a-fA-F]/.test(hex)) return null;
    return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
    };
}
function rgbToHex(r, g, b) {
    const h = x => pad2(x.toString(16));
    return '#' + h(r) + h(g) + h(b);
}
function pad2(s) { return s.length === 1 ? '0' + s : s; }
function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            default: h = (r - g) / d + 4;
        }
        h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
function hslToRgb(h, s, l) {
    s /= 100; l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}
function updatePreview(hex) {
    const prev = document.getElementById('color-preview');
    prev.style.background = hex;
    prev.textContent = hex.toUpperCase();
}
// source: 'hex'（默认）/'rgb'/'hsl' 表示用户正在编辑的输入框
function colorSync(source) {
    const hexEl = document.getElementById('hex-input');
    const rgbEl = document.getElementById('rgb-input');
    const hslEl = document.getElementById('hsl-input');
    if (source === 'rgb') {
        const m = rgbEl.value.match(/(\d+)\D+(\d+)\D+(\d+)/);
        if (!m) return;
        const r = +m[1], g = +m[2], b = +m[3];
        const hex = rgbToHex(r, g, b);
        hexEl.value = hex;
        const hsl = rgbToHsl(r, g, b);
        hslEl.value = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
        updatePreview(hex);
    } else if (source === 'hsl') {
        const m = hslEl.value.match(/(\d+)\D+(\d+)\D+(\d+)/);
        if (!m) return;
        const rgb = hslToRgb(+m[1], +m[2], +m[3]);
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
        hexEl.value = hex;
        rgbEl.value = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
        updatePreview(hex);
    } else {
        const rgb = hexToRgb(hexEl.value);
        if (!rgb) { showToast('请输入合法的十六进制颜色，如 #3b82f6'); return; }
        rgbEl.value = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')';
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        hslEl.value = 'hsl(' + hsl.h + ', ' + hsl.s + '%, ' + hsl.l + '%)';
        updatePreview(rgbToHex(rgb.r, rgb.g, rgb.b));
    }
}

// ===================== 5. 密码生成 =====================
function genPass() {
    const len = +document.getElementById('pass-len').value;
    const lower = document.getElementById('opt-lower').checked;
    const upper = document.getElementById('opt-upper').checked;
    const num = document.getElementById('opt-num').checked;
    const sym = document.getElementById('opt-sym').checked;
    const out = document.getElementById('pass-output');
    const sets = [];
    if (lower) sets.push('abcdefghijklmnopqrstuvwxyz');
    if (upper) sets.push('ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    if (num) sets.push('0123456789');
    if (sym) sets.push('!@#$%^&*()-_=+[]{};:,.?/');
    if (sets.length === 0) { out.textContent = '请至少选择一种字符类型'; return; }
    const all = sets.join('');
    // 使用加密安全随机数
    const arr = new Uint32Array(len);
    crypto.getRandomValues(arr);
    let pwd = '';
    for (let i = 0; i < len; i++) pwd += all[arr[i] % all.length];
    out.textContent = pwd;
    calcStrength(pwd);
}
function calcStrength(pwd) {
    let score = 0;
    if (pwd.length >= 8) score += 25;
    if (pwd.length >= 16) score += 15;
    if (/[a-z]/.test(pwd)) score += 15;
    if (/[A-Z]/.test(pwd)) score += 15;
    if (/\d/.test(pwd)) score += 15;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 15;
    score = Math.min(score, 100);
    const fill = document.getElementById('pass-strength');
    const txt = document.getElementById('pass-strength-txt');
    fill.style.width = score + '%';
    if (score > 70) { fill.style.background = '#16a34a'; txt.textContent = '强度：强'; }
    else if (score > 40) { fill.style.background = '#f59e0b'; txt.textContent = '强度：中'; }
    else { fill.style.background = '#dc2626'; txt.textContent = '强度：弱'; }
}

// ===================== 6. Base64 =====================
function b64Encode() {
    const raw = document.getElementById('b64-input').value;
    const out = document.getElementById('b64-output');
    try { out.textContent = utf8ToBase64(raw); }
    catch (e) { out.textContent = '编码失败：' + e.message; }
}
function b64Decode() {
    // 解码对象为结果框中的内容（即编码产物），而非原始输入框
    const raw = document.getElementById('b64-output').textContent.trim();
    const out = document.getElementById('b64-output');
    if (!raw || raw === '等待操作…') {
        out.textContent = '请先编码或粘贴 Base64 到结果框再解码';
        return;
    }
    try { out.textContent = base64ToUtf8(raw); }
    catch (e) { out.textContent = '解码失败：不是合法的 Base64 字符串'; }
}

// ===================== 7. Markdown 预览（marked 本地优先，失败兜底纯文本） =====================
function mdPreview() {
    const src = document.getElementById('md-input').value;
    const out = document.getElementById('md-output');
    if (!src.trim()) { out.textContent = ''; showToast('请输入 Markdown 内容'); return; }
    if (typeof marked !== 'undefined' && marked.parse) {
        try { out.innerHTML = marked.parse(src); return; }
        catch (e) { /* 异常则回退纯文本 */ }
    }
    // 兜底：保留换行的纯文本（离线/CDN 失败仍可用）
    out.textContent = src;
}

// ===================== 8. 年会抽奖 =====================
let lotteryTimer = null;
let winners = [];           // 已抽出名单（用于去重）
let awardWinners = {};      // 按奖项索引存储的中奖者：{ 0: ['甲'], 1: ['乙','丙'], ... }
let drawnNames = new Set(); // 全局已中奖人集合（不允许跨奖项重复）
let isDrawing = false;      // 抽奖动画锁，防止快速重复点击导致超编/重复
let awardConfig = [         // 奖项分级配置
    { name: '一等奖', count: 1 },
    { name: '二等奖', count: 2 },
    { name: '三等奖', count: 3 }
];
function parseNames(raw) {
    return raw.split(/[\n,，、]+/).map(s => s.trim()).filter(Boolean);
}
function playSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        o.start(); o.stop(ctx.currentTime + 0.3);
    } catch (e) {}
}
// 渲染奖项分级配置行
function renderAwardConfig() {
    const box = document.getElementById('lucky-awards');
    box.innerHTML = '';
    awardConfig.forEach((a, idx) => {
        const row = document.createElement('div');
        row.className = 'award-row';
        row.innerHTML =
            '<div class="award-name"><input class="form-control" value="' + a.name + '" onchange="awardConfig[' + idx + '].name=this.value"></div>' +
            '<div class="award-num"><input class="form-control" type="number" min="1" value="' + a.count + '" onchange="awardConfig[' + idx + '].count=Math.max(1,parseInt(this.value)||1)"></div>' +
            '<button type="button" class="award-del" onclick="awardConfig.splice(' + idx + ',1);renderAwardConfig()">×</button>';
        box.appendChild(row);
    });
}
function luckyAddAward() {
    awardConfig.push({ name: '新奖项', count: 1 });
    renderAwardConfig();
}
// 找到当前应该抽取的奖项索引：按顺序找到第一个未满员的奖项
function findCurrentAwardIndex() {
    for (let idx = 0; idx < awardConfig.length; idx++) {
        const list = awardWinners[idx] || [];
        if (list.length < awardConfig[idx].count) return idx;
    }
    return -1;
}
// 渲染中奖名单：每个奖项只展示自己的中奖者
function renderLuckyResult() {
    const resultBox = document.getElementById('lucky-result');
    let html = '';
    awardConfig.forEach((a, idx) => {
        const picked = awardWinners[idx] || [];
        html += '<div class="award-group"><div class="award-title"><span class="award-badge">' + a.name + '</span>(' + picked.length + '/' + a.count + ')</div>' +
            picked.map(w => '<span class="win-item">' + w + '</span>').join('') + '</div>';
    });
    resultBox.innerHTML = html || '暂无';
}
// 设置「开始抽奖」按钮的禁用状态与显示文字
function setDrawButton(disabled) {
    const btn = document.getElementById('lucky-draw-btn');
    if (!btn) return;
    btn.disabled = disabled;
    if (disabled) {
        btn.classList.add('disabled');
        btn.innerText = '抽奖中...';
    } else {
        btn.classList.remove('disabled');
        btn.innerText = '开始抽奖';
    }
}
function luckyDraw() {
    // 防止快速重复点击导致多个抽奖流程并行，进而超编或重复
    if (isDrawing) {
        showToast('正在抽奖中，请稍候');
        return;
    }
    const names = parseNames(document.getElementById('lucky-input').value);
    const allowRepeat = document.getElementById('lucky-allow-repeat').checked;
    const stage = document.getElementById('lucky-stage');
    // 在未勾选"允许重复中奖"时，已中过任何奖项的人均不可再参与
    const pool = allowRepeat ? names.slice() : names.filter(n => !drawnNames.has(n));
    if (!pool.length) {
        stage.innerHTML = '<span class="lucky-placeholder">没有可抽取的人</span>';
        showToast(allowRepeat ? '候选名单为空' : '候选名单为空或所有人都已中过奖');
        return;
    }
    // 确定本次抽取哪个奖项
    const awardIdx = findCurrentAwardIndex();
    if (awardIdx === -1) {
        stage.innerHTML = '<span class="lucky-placeholder">所有奖项已抽满</span>';
        showToast('所有奖项已抽满');
        return;
    }
    isDrawing = true;
    setDrawButton(true);
    let i = 0;
    if (lotteryTimer) clearInterval(lotteryTimer);
    lotteryTimer = setInterval(() => {
        stage.innerHTML = '<span class="lucky-name">' + pool[i % pool.length] + '</span>';
        i++;
    }, 60);
    const duration = parseInt(document.getElementById('lucky-duration').value, 10) || 3;
    setTimeout(() => {
        clearInterval(lotteryTimer);
        lotteryTimer = null;
        const winner = pool[Math.floor(Math.random() * pool.length)];
        stage.innerHTML = '<span class="lucky-name win">' + winner + '</span>';
        // 将中奖者归入对应奖项，并加入全局已中奖集合
        if (!awardWinners[awardIdx]) awardWinners[awardIdx] = [];
        awardWinners[awardIdx].push(winner);
        if (!allowRepeat) drawnNames.add(winner);
        // 兼容旧逻辑：仍向 winners 追加，便于其他可能依赖 winners 的代码
        winners.push(winner);
        renderLuckyResult();
        isDrawing = false;
        setDrawButton(false);
        if (document.getElementById('lucky-sound').checked) playSound();
    }, duration * 1000);
}
function luckyReset() {
    if (lotteryTimer) clearInterval(lotteryTimer);
    lotteryTimer = null;
    isDrawing = false;
    setDrawButton(false);
    winners = [];
    awardWinners = {};
    drawnNames = new Set();
    document.getElementById('lucky-stage').innerHTML = '<span class="lucky-placeholder">点击「开始抽奖」揭晓幸运儿</span>';
    document.getElementById('lucky-result').innerHTML = '暂无';
}
function copyLuckyResult() {
    const txt = document.getElementById('lucky-result').innerText;
    if (!txt || txt === '暂无') { showToast('暂无可复制的中奖名单'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(() => showToast('中奖名单已复制')).catch(() => showToast('复制失败'));
    } else {
        showToast('当前环境不支持自动复制');
    }
}

// ===================== 9. 二维码生成器 =====================
function genQR() {
    const text = document.getElementById('qr-input').value;
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!text.trim()) { showToast('请输入二维码内容'); return; }
    try {
        new QRCode(canvas, { text: text, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    } catch (e) {
        showToast('二维码生成失败');
    }
}
function downloadQR() {
    const canvas = document.getElementById('qr-canvas');
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qrcode.png';
    a.click();
}

// ===================== 10. 工作日 / 请假天数计算 =====================
function calcWorkday() {
    const start = document.getElementById('wd-start').value;
    const end = document.getElementById('wd-end').value;
    if (!start || !end) { showToast('请选择起止日期'); return; }
    const s = new Date(start), e = new Date(end);
    if (s > e) { showToast('结束日期需晚于开始日期'); return; }
    let total = 0, work = 0, weekend = 0;
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        total++;
        const day = d.getDay();
        if (day === 0 || day === 6) weekend++; else work++;
    }
    document.getElementById('wd-total').textContent = total;
    document.getElementById('wd-work').textContent = work;
    document.getElementById('wd-weekend').textContent = weekend;
}

// ===================== 11. 贷款月供计算器（等额本息/本金 + 提前还款模拟） =====================
let baseLoan = null;
let loanDetailRows = [];
function calcLoan() {
    const P = parseFloat(document.getElementById('loan-principal').value);
    const annual = parseFloat(document.getElementById('loan-rate').value);
    const months = parseInt(document.getElementById('loan-months').value, 10);
    const type = document.getElementById('loan-type').value;
    if (!(P > 0) || !(annual > 0) || !(months > 0)) { showToast('请填写有效的贷款本金、年利率与期限'); return; }
    const n = months;
    const r = annual / 100 / 12;
    // 等额本息：每月固定还款额
    const epFixed = r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
    const epTotal = epFixed * n;
    const epInterest = epTotal - P;
    // 等额本金：每月本金固定，利息递减
    const principalPerMonth = P / n;
    const ppFirst = principalPerMonth + P * r; // 首月月供（最高）
    let ppInterestSum = 0;
    for (let i = 0; i < n; i++) ppInterestSum += (P - principalPerMonth * i) * r;
    const ppTotal = P + ppInterestSum;

    document.getElementById('loan-ep-first').textContent = fmtMoney(epFixed);
    document.getElementById('loan-ep-fixed').textContent = fmtMoney(epFixed);
    document.getElementById('loan-ep-interest').textContent = fmtMoney(epInterest);
    document.getElementById('loan-ep-total').textContent = fmtMoney(epTotal);
    document.getElementById('loan-pp-first').textContent = fmtMoney(ppFirst);
    document.getElementById('loan-pp-interest').textContent = fmtMoney(ppInterestSum);
    document.getElementById('loan-pp-total').textContent = fmtMoney(ppTotal);

    // 保存原始参数，供提前还款模拟复用
    baseLoan = { P: P, n: n, r: r, type: type };
    document.getElementById('prepay-result').innerHTML = '';

    // 生成所选方式的每月明细
    loanDetailRows = buildLoanSchedule(P, n, r, type);
    renderLoanDetail(loanDetailRows);
}
// 生成逐期还款计划
// n：生成多少期；totalN：用于等额本息月供公式的总期数（部分分段时需传原总期数）
function buildLoanSchedule(P, n, r, type, startRemain, totalN) {
    const rows = [];
    const payN = (typeof totalN === 'number') ? totalN : n;
    let remain = (typeof startRemain === 'number') ? startRemain : P;
    for (let i = 1; i <= n; i++) {
        let principal, interest, payment;
        if (type === 'principal') {
            // 等额本金
            principal = P / payN;
            interest = remain * r;
            payment = principal + interest;
            remain -= principal;
        } else {
            // 等额本息
            payment = r === 0 ? P / payN : P * r * Math.pow(1 + r, payN) / (Math.pow(1 + r, payN) - 1);
            interest = remain * r;
            principal = payment - interest;
            remain -= principal;
            if (remain < 0.005) remain = 0; // 末期/浮点误差清零
        }
        rows.push({
            period: i,
            payment: payment,
            principal: principal,
            interest: interest,
            remain: Math.max(remain, 0)
        });
    }
    return rows;
}
// 多次提前还款事件列表（叠加模拟）：{after, prepay, mode}
let prepayEvents = [];
// 基于原计划 + 多个提前还款事件，逐期生成完整还款计划（支持叠加与混合模式）
function buildScheduleWithEvents(P, n, r, type, events) {
    const evs = events.slice().sort((a, b) => a.after - b.after);
    const rows = [];
    let principal = P;
    let period = 0;
    // 等额本息固定月供（基于原总期数，叠加提前还款后“期限缩短”模式保持此月供）
    const fixedPayment = (type === 'principal') ? null
        : (r === 0 ? P / n : P * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
    // 等额本金每月本金（基于原总期数）
    let principalPerMonth = (type === 'principal') ? P / n : null;
    // 当前月供（等额本息用，可被“月供减少”模式修改）
    let curPayment = fixedPayment;
    let evIdx = 0;
    let safety = 0;
    while (principal > 0.005 && safety < 10000) {
        safety++;
        period++;
        let ev = null;
        if (evIdx < evs.length && period === evs[evIdx].after) ev = evs[evIdx];
        let pay, princ, intr;
        if (type === 'principal') {
            princ = principalPerMonth;
            intr = principal * r;
            pay = princ + intr;
            if (princ > principal) princ = principal;
            principal -= princ;
        } else {
            pay = curPayment;
            intr = principal * r;
            princ = pay - intr;
            if (princ > principal) { princ = principal; pay = princ + intr; }
            principal -= princ;
        }
        rows.push({ period, payment: pay, principal: princ, interest: intr, remain: Math.max(principal, 0) });
        // 本期触发提前还款，处理后决定后续方式
        if (ev) {
            principal -= ev.prepay;
            if (principal < 0) principal = 0;
            if (principal <= 0.005) break; // 提前结清
            const remainMonths = Math.max(n - ev.after, 1);
            if (type === 'principal') {
                principalPerMonth = principal / remainMonths; // 本金重新均摊，期限缩短
            } else if (ev.mode === 'term') {
                curPayment = fixedPayment; // 月供基本不变，期限缩短
            } else {
                curPayment = r === 0 ? principal / remainMonths
                    : principal * r * Math.pow(1 + r, remainMonths) / (Math.pow(1 + r, remainMonths) - 1);
            }
            evIdx++;
        }
    }
    return rows;
}
// 叠加一次提前还款模拟
function simulatePrepay() {
    if (!baseLoan) { showToast('请先点击「计算」生成原计划'); return; }
    const after = parseInt(document.getElementById('prepay-after').value, 10);
    const prepay = parseFloat(document.getElementById('prepay-amount').value);
    const mode = document.getElementById('prepay-mode').value;
    if (!(after > 0) || !(prepay > 0)) { showToast('请填写有效的「期数」与「提前还款金额」'); return; }
    const { P, n, r, type } = baseLoan;
    if (after >= n) { showToast('还款期数需小于总期数'); return; }
    // 不能重复在同一期叠加（避免逻辑冲突），且需晚于已有事件期数
    if (prepayEvents.some(e => e.after === after)) { showToast('第 ' + after + ' 期已设置过提前还款，请换一期或清空后重设'); return; }
    if (prepayEvents.length && after <= prepayEvents[prepayEvents.length - 1].after) {
        showToast('新增提前还款的期数需大于已设置的第 ' + prepayEvents[prepayEvents.length - 1].after + ' 期'); return;
    }
    // 估算该期剩余本金是否足够扣减（基于当前已叠加事件推算）
    const preview = buildScheduleWithEvents(P, n, r, type, prepayEvents.concat([{ after, prepay, mode }]));
    const triggerRow = preview.find(x => x.period === after);
    if (!triggerRow || (triggerRow.remain - prepay) <= 0) { showToast('提前还款金额已超过该期剩余本金，无需模拟'); return; }
    prepayEvents.push({ after, prepay, mode });
    applyPrepaySchedule();
    showToast('已叠加第 ' + after + ' 期提前还款（共 ' + prepayEvents.length + ' 次）');
}
// 根据 prepayEvents 重算并渲染明细与对比
function applyPrepaySchedule() {
    const { P, n, r, type } = baseLoan;
    const allRows = buildScheduleWithEvents(P, n, r, type, prepayEvents);
    loanDetailRows = allRows;
    renderLoanDetail(allRows);
    // 原计划总利息
    const oldRows = buildLoanSchedule(P, n, r, type);
    const oldTotalInterest = oldRows.reduce((s, x) => s + x.interest, 0);
    const newTotalInterest = allRows.reduce((s, x) => s + x.interest, 0);
    const savedInterest = oldTotalInterest - newTotalInterest;
    const totalPrepay = prepayEvents.reduce((s, e) => s + e.prepay, 0);
    // 叠加事件明细
    const evHtml = prepayEvents.map((e, i) =>
        '<span class="pp-ev">第' + e.after + '期 · ' + fmtMoney(e.prepay) + ' · ' + (e.mode === 'term' ? '缩短期限' : '减少月供') + '</span>'
    ).join('');
    document.getElementById('prepay-result').innerHTML =
        '<div class="pp-card"><div class="pp-title">提前还款后对比（共 ' + prepayEvents.length + ' 次）</div>' +
        '<div class="pp-row"><span>累计提前还款</span><b>' + fmtMoney(totalPrepay) + '</b></div>' +
        '<div class="pp-row"><span>新还款总期数</span><b>' + allRows.length + ' 期（原 ' + n + ' 期）</b></div>' +
        '<div class="pp-row"><span>节省利息</span><b class="amt-in">' + fmtMoney(savedInterest) + '</b></div>' +
        '<div class="pp-row"><span>新总利息</span><b>' + fmtMoney(newTotalInterest) + '</b></div>' +
        '<div class="pp-evs">' + evHtml + '</div></div>';
    document.getElementById('prepay-hint').textContent = '已叠加 ' + prepayEvents.length + ' 次提前还款，可继续叠加或点击「清空模拟」还原。';
}
// 清空所有提前还款模拟，还原原计划
function resetPrepay() {
    if (!baseLoan) { showToast('请先点击「计算」生成原计划'); return; }
    prepayEvents = [];
    loanDetailRows = buildLoanSchedule(baseLoan.P, baseLoan.n, baseLoan.r, baseLoan.type);
    renderLoanDetail(loanDetailRows);
    document.getElementById('prepay-result').innerHTML = '';
    document.getElementById('prepay-hint').textContent = '';
    showToast('已还原原计划');
}
function renderLoanDetail(rows) {
    const tbody = document.querySelector('#loan-detail tbody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="text-muted">点击「计算」后显示</td></tr>'; return; }
    tbody.innerHTML = rows.map(row =>
        '<tr><td>' + row.period + '</td>' +
        '<td class="num">' + fmtMoney(row.payment) + '</td>' +
        '<td class="num">' + fmtMoney(row.principal) + '</td>' +
        '<td class="num">' + fmtMoney(row.interest) + '</td>' +
        '<td class="num">' + fmtMoney(row.remain) + '</td></tr>'
    ).join('');
}
// 导出贷款明细为 CSV
function exportLoanCSV() {
    if (!loanDetailRows.length) { showToast('请先点击「计算」生成明细'); return; }
    const typeName = document.getElementById('loan-type').value === 'principal' ? '等额本金' : '等额本息';
    const header = ['期数', '月供(元)', '本金(元)', '利息(元)', '剩余本金(元)', '还款方式'];
    const rows = loanDetailRows.map(row => [
        row.period, row.payment.toFixed(2), row.principal.toFixed(2),
        row.interest.toFixed(2), row.remain.toFixed(2), typeName
    ]);
    const csv = [header].concat(rows).map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '贷款还款明细_' + typeName + '_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出明细 CSV');
}

// ===================== 12. 简易记账本（localStorage 本地持久化） =====================
const LEDGER_KEY = 'office_ledger_v1';
function loadLedger() {
    try { return JSON.parse(localStorage.getItem(LEDGER_KEY)) || []; }
    catch (err) { return []; }
}
function saveLedger(list) {
    try { localStorage.setItem(LEDGER_KEY, JSON.stringify(list)); }
    catch (err) { showToast('保存失败：本地存储不可用'); }
}
// 兼容历史数据：补全 type/note/date/cat/ym 字段
function normalizeLedgerItem(it) {
    let ym = it.ym;
    if (!ym && it.date) {
        const m = it.date.match(/(\d{4})[/-](\d{1,2})/);
        if (m) ym = m[1] + '-' + String(parseInt(m[2], 10)).padStart(2, '0');
    }
    return {
        type: it.type || 'out',
        amount: Number(it.amount) || 0,
        note: it.note || '',
        date: it.date || new Date().toLocaleDateString('zh-CN'),
        cat: it.cat || '其他',
        ym: ym || new Date().toISOString().slice(0, 7)
    };
}
function renderLedger() {
    const list = loadLedger().map(normalizeLedgerItem);
    window._ledger = list;
    const ul = document.getElementById('lg-list');
    ul.innerHTML = '';
    let sumIn = 0, sumOut = 0;
    list.forEach((it, idx) => {
        if (it.type === 'in') sumIn += it.amount; else sumOut += it.amount;
        const li = document.createElement('li');
        const right = document.createElement('span');
        right.className = it.type === 'in' ? 'amt-in' : 'amt-out';
        right.textContent = (it.type === 'in' ? '+' : '-') + fmtMoney(it.amount);
        // 编辑按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'del edit-btn';
        editBtn.textContent = '编辑';
        editBtn.setAttribute('onclick', 'openLedgerEdit(' + idx + ')');
        right.appendChild(editBtn);
        // 删除按钮
        const del = document.createElement('button');
        del.className = 'del';
        del.textContent = '×';
        del.setAttribute('onclick', 'delLedger(' + idx + ')');
        right.appendChild(del);
        li.innerHTML = '<span><span class="cat-tag">' + it.cat + '</span>' + (it.note || '未备注') + ' · ' + it.date + '</span>';
        li.appendChild(right);
        ul.appendChild(li);
    });
    document.getElementById('lg-in').textContent = fmtMoney(sumIn);
    document.getElementById('lg-out').textContent = fmtMoney(sumOut);
    document.getElementById('lg-bal').textContent = fmtMoney(sumIn - sumOut);
    renderLedgerMonth(list);
    // 用最新全量列表驱动月份筛选下拉，并联动类别汇总
    window._ledger = list;
    populateLedgerMonthFilter(list);
    const sel = document.getElementById('lg-month-filter').value;
    renderLedgerCat(list, sel || null);   // 按类别汇总（支持月份联动）
    renderLedgerChart(list, sel || null); // 本次新增：类别环形图
}
// 月份联动筛选：根据下拉选择重新渲染类别汇总
function filterLedgerByMonth() {
    const sel = document.getElementById('lg-month-filter').value;
    const list = window._ledger || [];
    renderLedgerCat(list, sel || null);
    renderLedgerChart(list, sel || null);
}
// 填充月份筛选下拉（去重、按时间倒序）
function populateLedgerMonthFilter(list) {
    const sel = document.getElementById('lg-month-filter');
    const prev = sel.value;
    const months = Array.from(new Set(list.map(it => it.ym || '未知月份'))).sort().reverse();
    sel.innerHTML = '<option value="">全部月份</option>' +
        months.map(m => '<option value="' + m + '">' + (m === '未知月份' ? '未知月份' : m + ' 月') + '</option>').join('');
    // 尽量保留原选择
    sel.value = months.indexOf(prev) >= 0 ? prev : '';
}
// 按月汇总统计（按 YYYY-MM 分组）
function renderLedgerMonth(list) {
    const box = document.getElementById('lg-month');
    const groups = {};
    list.forEach(it => {
        const ym = it.ym || '未知月份';
        if (!groups[ym]) groups[ym] = { in: 0, out: 0 };
        if (it.type === 'in') groups[ym].in += it.amount; else groups[ym].out += it.amount;
    });
    const months = Object.keys(groups).sort().reverse();
    if (!months.length) { box.innerHTML = '<span class="text-muted">暂无数据</span>'; return; }
    box.innerHTML = months.map(ym => {
        const g = groups[ym];
        return '<div class="month-card"><div class="month-name">' + ym + '</div>' +
            '<div class="month-row"><span>收入</span><b class="amt-in">' + fmtMoney(g.in) + '</b></div>' +
            '<div class="month-row"><span>支出</span><b class="amt-out">' + fmtMoney(g.out) + '</b></div>' +
            '<div class="month-row"><span>结余</span><b>' + fmtMoney(g.in - g.out) + '</b></div></div>';
    }).join('');
}
// 按类别汇总（仅支出，展示占比条形）；ym 非空时按月份联动筛选
function renderLedgerCat(list, ym) {
    const box = document.getElementById('lg-cat');
    const groups = {};
    let totalOut = 0;
    list.forEach(it => {
        if (it.type === 'out' && (!ym || (it.ym || '未知月份') === ym)) {
            groups[it.cat] = (groups[it.cat] || 0) + it.amount;
            totalOut += it.amount;
        }
    });
    const cats = Object.keys(groups).sort((a, b) => groups[b] - groups[a]);
    const scope = ym ? ('（' + (ym === '未知月份' ? '未知月份' : ym + ' 月') + '）') : '';
    if (!cats.length) { box.innerHTML = '<span class="text-muted">暂无支出数据</span>'; return; }
    box.innerHTML = cats.map(cat => {
        const amt = groups[cat];
        const pct = totalOut > 0 ? (amt / totalOut * 100) : 0;
        return '<div class="cat-row"><div class="cat-head"><span class="cat-name">' + cat + '</span>' +
            '<span class="cat-amt">' + fmtMoney(amt) + ' · ' + pct.toFixed(1) + '%</span></div>' +
            '<div class="cat-bar"><i style="width:' + pct.toFixed(1) + '%"></i></div></div>';
    }).join('') + '<div class="cat-total">支出合计' + scope + '：' + fmtMoney(totalOut) + '</div>';
}
// 本次新增：支出类别环形图（手写 SVG，零依赖）
const LEDGER_COLORS = ['#4f46e5', '#16a34a', '#f59e0b', '#dc2626', '#0ea5e9', '#8b5cf6', '#ec4899', '#14b8a6'];
function renderLedgerChart(list, ym) {
    const box = document.getElementById('lg-chart');
    if (!box) return;
    box.innerHTML = '';
    const groups = {};
    let totalOut = 0;
    list.forEach(it => {
        if (it.type === 'out' && (!ym || (it.ym || '未知月份') === ym)) {
            groups[it.cat] = (groups[it.cat] || 0) + it.amount;
            totalOut += it.amount;
        }
    });
    const entries = Object.entries(groups).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return;
    const size = 160, cx = size / 2, cy = size / 2, r = 60, sw = 22;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    let start = -Math.PI / 2;
    entries.forEach(([cat, val], idx) => {
        const angle = val / totalOut * Math.PI * 2;
        const end = start + angle;
        const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
        const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
        const large = angle > Math.PI ? 1 : 0;
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', LEDGER_COLORS[idx % LEDGER_COLORS.length]);
        path.setAttribute('stroke-width', sw);
        svg.appendChild(path);
        start = end;
    });
    const t1 = document.createElementNS(ns, 'text');
    t1.setAttribute('x', cx); t1.setAttribute('y', cy - 4);
    t1.setAttribute('text-anchor', 'middle'); t1.setAttribute('font-size', '12');
    t1.setAttribute('fill', '#6b7280'); t1.textContent = '支出';
    svg.appendChild(t1);
    const t2 = document.createElementNS(ns, 'text');
    t2.setAttribute('x', cx); t2.setAttribute('y', cy + 14);
    t2.setAttribute('text-anchor', 'middle'); t2.setAttribute('font-size', '14');
    t2.setAttribute('font-weight', '700'); t2.setAttribute('fill', '#1f2430');
    t2.textContent = fmtMoney(totalOut);
    svg.appendChild(t2);
    box.appendChild(svg);
    const legend = document.createElement('div');
    legend.className = 'chart-legend';
    entries.forEach(([cat, val], idx) => {
        const pct = totalOut ? (val / totalOut * 100).toFixed(1) : '0';
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = '<span class="dot" style="background:' + LEDGER_COLORS[idx % LEDGER_COLORS.length] + '"></span>' +
            '<span>' + cat + '　' + fmtMoney(val) + '（' + pct + '%）</span>';
        legend.appendChild(row);
    });
    box.appendChild(legend);
}
function addLedger() {
    const type = document.getElementById('lg-type').value;
    const cat = document.getElementById('lg-cat-select').value;
    const amount = parseFloat(document.getElementById('lg-amount').value);
    const note = document.getElementById('lg-note').value.trim();
    if (!(amount > 0)) { showToast('请输入有效金额'); return; }
    const now = new Date();
    const list = loadLedger().map(normalizeLedgerItem);
    list.unshift({
        type, cat, amount, note,
        date: now.toLocaleDateString('zh-CN'),
        ym: now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
    });
    saveLedger(list);
    renderLedger();
    document.getElementById('lg-amount').value = '';
    document.getElementById('lg-note').value = '';
    showToast('已记录');
}
// 打开编辑模态框
function openLedgerEdit(idx) {
    const list = window._ledger || loadLedger().map(normalizeLedgerItem);
    const it = list[idx];
    if (!it) return;
    document.getElementById('edit-idx').value = idx;
    document.getElementById('edit-type').value = it.type;
    document.getElementById('edit-cat').value = it.cat;
    document.getElementById('edit-amount').value = it.amount;
    document.getElementById('edit-date').value = toISODate(it.date);
    document.getElementById('edit-note').value = it.note;
    const modal = new bootstrap.Modal(document.getElementById('ledgerEditModal'));
    modal.show();
}
function saveLedgerEdit() {
    const idx = parseInt(document.getElementById('edit-idx').value, 10);
    const type = document.getElementById('edit-type').value;
    const cat = document.getElementById('edit-cat').value;
    const amount = parseFloat(document.getElementById('edit-amount').value);
    const date = document.getElementById('edit-date').value;
    const note = document.getElementById('edit-note').value.trim();
    if (!(amount > 0)) { showToast('请输入有效金额'); return; }
    const list = loadLedger().map(normalizeLedgerItem);
    if (!list[idx]) return;
    const ym = date ? date.slice(0, 7) : list[idx].ym;
    list[idx] = { type, cat, amount, note, date: date || list[idx].date, ym: ym };
    saveLedger(list);
    renderLedger();
    bootstrap.Modal.getInstance(document.getElementById('ledgerEditModal')).hide();
    showToast('已保存修改');
}
// 将 '2026/8/9' 或 '2026-08-09' 转为 input[type=date] 需要的 YYYY-MM-DD
function toISODate(str) {
    if (!str) return '';
    const m = str.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (m) return m[1] + '-' + String(parseInt(m[2], 10)).padStart(2, '0') + '-' + String(parseInt(m[3], 10)).padStart(2, '0');
    return str.length >= 10 ? str.slice(0, 10) : '';
}
function delLedger(idx) {
    const list = loadLedger().map(normalizeLedgerItem);
    list.splice(idx, 1);
    saveLedger(list);
    renderLedger();
}
function clearLedger() {
    if (!confirm('确定清空全部记账记录？')) return;
    localStorage.removeItem(LEDGER_KEY);
    renderLedger();
    showToast('已清空');
}
// 导出记账记录为 CSV（含 BOM 头，Excel 中文不乱码）
function exportLedgerCSV() {
    const list = loadLedger().map(normalizeLedgerItem);
    if (!list.length) { showToast('暂无记账数据可导出'); return; }
    const header = ['日期', '月份', '类型', '类别', '金额', '备注'];
    const rows = list.map(it => [
        it.date || '',
        it.ym || '',
        it.type === 'in' ? '收入' : '支出',
        it.cat,
        it.amount,
        (it.note || '').replace(/,/g, '，')
    ]);
    const csv = [header].concat(rows).map(r => r.join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '记账本_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(url);
    showToast('已导出 CSV');
}

// ===================== 12. 数据图表（纯前端零依赖 SVG 可视化） =====================
// 颜色板，与记账本环形图保持一致，支持 8 类数据
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b'];

// 解析输入：支持「标签,数值」每行，或带表头的 CSV（取首列标签、首数值列）
function parseChartData(raw) {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    // 判断首行是否为表头（含非数字列名且第二行像数据）
    let start = 0;
    const first = lines[0].split(/[,，\t]/).map(s => s.trim());
    if (lines.length > 1) {
        const second = lines[1].split(/[,，\t]/).map(s => s.trim());
        const firstHasNum = parseFloat(first[first.length - 1]) === parseFloat(first[first.length - 1]);
        const secondHasNum = parseFloat(second[second.length - 1]) === parseFloat(second[second.length - 1]);
        if (!firstHasNum && secondHasNum) start = 1; // 首行视为表头
    }
    const data = [];
    for (let i = start; i < lines.length; i++) {
        const parts = lines[i].split(/[,，\t]/).map(s => s.trim());
        if (parts.length < 2) continue;
        const label = parts[0];
        // 取最后一个数值字段（兼容 CSV 多列）
        const val = parseFloat(parts[parts.length - 1].replace(/[^0-9.\-]/g, ''));
        if (label && !isNaN(val)) data.push({ label, value: val });
    }
    return data;
}

// 转义 SVG 文本中的特殊字符，防止渲染异常
function escSVG(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

// 主入口：解析 + 按类型绘制
function renderChart() {
    const raw = document.getElementById('chart-input').value;
    const type = document.getElementById('chart-type').value;
    const box = document.getElementById('chart-output');
    const data = parseChartData(raw);
    if (data.length === 0) {
        box.innerHTML = '<span class="text-muted">未识别到有效数据，请按「标签,数值」每行一行的格式输入</span>';
        return;
    }
    let svg = '';
    if (type === 'bar') svg = buildBarSVG(data);
    else if (type === 'line') svg = buildLineSVG(data);
    else if (type === 'pie') svg = buildPieSVG(data, false);
    else svg = buildPieSVG(data, true);
    box.innerHTML = svg;
}

// 柱状图
function buildBarSVG(data) {
    const W = 560, H = 320, padL = 50, padB = 60, padT = 20, padR = 20;
    const max = Math.max(...data.map(d => d.value), 0.0001);
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = data.length;
    const gap = innerW / n;
    const bw = Math.min(46, gap * 0.6);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;
    // 网格 + Y 轴刻度
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
        const y = padT + innerH * i / ticks;
        const v = max * (1 - i / ticks);
        s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid"/>`;
        s += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="axis">${fmtNum(v)}</text>`;
    }
    data.forEach((d, i) => {
        const h = innerH * (d.value / max);
        const x = padL + gap * i + (gap - bw) / 2;
        const y = padT + innerH - h;
        s += `<rect x="${x}" y="${y}" width="${bw}" height="${h}" rx="3" fill="${CHART_COLORS[i % CHART_COLORS.length]}"><title>${escSVG(d.label)}: ${fmtNum(d.value)}</title></rect>`;
        s += `<text x="${x + bw / 2}" y="${y - 6}" text-anchor="middle" class="axis">${fmtNum(d.value)}</text>`;
        s += `<text x="${x + bw / 2}" y="${H - padB + 18}" text-anchor="middle" class="axis lbl">${escSVG(d.label)}</text>`;
    });
    s += `</svg>`;
    return s;
}

// 折线图
function buildLineSVG(data) {
    const W = 560, H = 320, padL = 50, padB = 60, padT = 20, padR = 20;
    const max = Math.max(...data.map(d => d.value), 0.0001);
    const innerW = W - padL - padR, innerH = H - padT - padB;
    const n = data.length;
    const stepX = n > 1 ? innerW / (n - 1) : 0;
    const pts = data.map((d, i) => {
        const x = padL + stepX * i;
        const y = padT + innerH * (1 - d.value / max);
        return { x, y, d };
    });
    let s = `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
        const y = padT + innerH * i / ticks;
        const v = max * (1 - i / ticks);
        s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" class="grid"/>`;
        s += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end" class="axis">${fmtNum(v)}</text>`;
    }
    // 路径
    const path = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(' ');
    s += `<path d="${path}" fill="none" stroke="#3b82f6" stroke-width="2.5"/>`;
    pts.forEach(p => {
        s += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#3b82f6"><title>${escSVG(p.d.label)}: ${fmtNum(p.d.value)}</title></circle>`;
        s += `<text x="${p.x}" y="${p.y - 10}" text-anchor="middle" class="axis">${fmtNum(p.d.value)}</text>`;
        s += `<text x="${p.x}" y="${H - padB + 18}" text-anchor="middle" class="axis lbl">${escSVG(p.d.label)}</text>`;
    });
    s += `</svg>`;
    return s;
}

// 饼图 / 环形图（donut=true 为环形）
function buildPieSVG(data, donut) {
    const total = data.reduce((a, d) => a + Math.max(0, d.value), 0);
    if (total <= 0) return '<span class="text-muted">数值合计需大于 0</span>';
    const cx = 180, cy = 170, R = 130, r = donut ? 70 : 0;
    const showPct = document.getElementById('chart-percent').checked;
    let s = `<svg viewBox="0 0 560 340" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;
    let ang = -Math.PI / 2;
    data.forEach((d, i) => {
        const frac = Math.max(0, d.value) / total;
        const a2 = ang + frac * Math.PI * 2;
        const large = frac > 0.5 ? 1 : 0;
        const x1 = cx + R * Math.cos(ang), y1 = cy + R * Math.sin(ang);
        const x2 = cx + R * Math.cos(a2), y2 = cy + R * Math.sin(a2);
        const color = CHART_COLORS[i % CHART_COLORS.length];
        if (donut) {
            const xi1 = cx + r * Math.cos(ang), yi1 = cy + r * Math.sin(ang);
            const xi2 = cx + r * Math.cos(a2), yi2 = cy + r * Math.sin(a2);
            s += `<path d="M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${xi2} ${yi2} A${r} ${r} 0 ${large} 0 ${xi1} ${yi1} Z" fill="${color}"><title>${escSVG(d.label)}: ${fmtNum(d.value)}</title></path>`;
        } else {
            s += `<path d="M${cx} ${cy} L${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} Z" fill="${color}"><title>${escSVG(d.label)}: ${fmtNum(d.value)}</title></path>`;
        }
        // 图例（右侧）
        const ly = 40 + i * 28;
        s += `<rect x="360" y="${ly - 12}" width="14" height="14" rx="2" fill="${color}"/>`;
        s += `<text x="382" y="${ly}" class="axis">${escSVG(d.label)}</text>`;
        s += `<text x="540" y="${ly}" text-anchor="end" class="axis">${fmtNum(d.value)}${showPct ? ' (' + (frac * 100).toFixed(1) + '%)' : ''}</text>`;
        ang = a2;
    });
    s += `</svg>`;
    return s;
}

// 数字格式化：保留两位、去无效 0
function fmtNum(v) {
    if (Math.abs(v) >= 1000) return v.toLocaleString('zh-CN', { maximumFractionDigits: 1 });
    return (Math.round(v * 100) / 100).toString();
}

// 下载当前图表为 SVG 文件（仅前端，不联网）
function downloadChartSVG() {
    const box = document.getElementById('chart-output');
    const svg = box.querySelector('svg');
    if (!svg) { showToast('请先生成图表'); return; }
    const clone = svg.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n' + clone.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '图表_' + new Date().toISOString().slice(0, 10) + '.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('已下载 SVG');
}

// ===================== 13. 暗色模式切换 =====================
// 主题的实际设置逻辑统一由 base.html 提供的 window.setTheme 处理（含 localStorage 持久化），
// 此处不再重复实现 applyTheme，避免与全站实现冲突、也避免引用不存在的元素导致报错。
// 本函数仅负责：切换主题 + 同步本页按钮的图标与文案（#themeToggle / #themeLabel 已在 assistant.html 中真实存在）。
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    // 调用 base.html 的全局主题设置函数（已处理 data-theme 与 localStorage）
    if (typeof window.setTheme === 'function') {
        window.setTheme(next);
    } else {
        // 兜底：极少数未加载 base.html 脚本的场景，直接设置属性
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('office_tool_theme', next); } catch (e) {}
    }
    syncThemeButton(next);
}

// 同步主题切换按钮的图标与文案（仅在元素存在时操作，杜绝 null 赋值报错）
function syncThemeButton(theme) {
    const label = document.getElementById('themeLabel');
    const ico = document.querySelector('#themeToggle i');
    if (label) label.textContent = theme === 'dark' ? '暗色' : '亮色';
    if (ico) ico.className = theme === 'dark' ? 'bi bi-moon-stars' : 'bi bi-sun';
}

// 初始化：根据当前 data-theme 同步按钮显示（主题已在 base.html 渲染前应用，避免闪烁）
(function initThemeButton() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    syncThemeButton(cur);
})();

// ===================== 初始化 =====================
colorSync();
mdPreview();
renderAwardConfig();  // 渲染奖项分级配置行
renderLedger();       // 渲染已有记账记录

// 本次新增：进入页面时恢复上次使用的工具
(function restoreLastTool() {
    try {
        const last = localStorage.getItem('office_tool_last');
        if (last) {
            const btn = document.querySelector('#toolNav button[data-tool="' + last + '"]');
            if (btn) btn.click();
        }
    } catch (e) {}
})();

/* ==========================================================================
   本次新增：工具搜索过滤（中文别名匹配）
   ========================================================================== */
(function initToolSearch() {
    const search = document.getElementById('toolSearch');
    if (!search) return;
    search.addEventListener('input', function (e) {
        const kw = e.target.value.trim().toLowerCase();
        const nav = document.getElementById('toolNav');
        const buttons = nav.querySelectorAll('button[data-tool]');
        const labels = nav.querySelectorAll('.tool-group-label');
        const visibleGroups = new Set();
        buttons.forEach(btn => {
            const name = (btn.textContent + ' ' + (btn.dataset.alias || '')).toLowerCase();
            const hit = !kw || name.indexOf(kw) >= 0;
            btn.style.display = hit ? '' : 'none';
            if (hit) visibleGroups.add(btn.dataset.group);
        });
        labels.forEach(l => { l.style.display = visibleGroups.has(l.dataset.group) ? '' : 'none'; });
    });
})();
