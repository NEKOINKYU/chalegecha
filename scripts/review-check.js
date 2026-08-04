#!/usr/bin/env node
/**
 * lunar-app 提交前校验（鹰眼标准）
 * 覆盖「四关」：
 *   1) 语法关   node --check data.js + 内联 JS
 *   2) 实跑关   jsdom 加载页面、注入出生信息、实跑 render，捕获白屏/运行时崩溃（D1 API误用 / D3 闭包 / D4 未实跑）
 *   3) 字典键关 前瞻校验 ZODIAC_SUMMARY / ZODIAC_FORTUNE 键必须 = getSign() 短名集（D2 字典键不一致）
 *              + GUA_SIMPLE 键必须 = GUA64 卦名全集（D2 类：起卦白话说错/为空）
 *   4) 人工 review：脚本不管，留给人
 * 退出码 0=通过, 1=有缺陷（pre-commit 钩子据此拦截）
 */
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

function loadJsdom() {
  const cands = [
    'jsdom',
    '/Users/nekoinkyu/.workbuddy/binaries/node/workspace/node_modules/jsdom',
  ];
  for (const c of cands) { try { return require(c); } catch (e) {} }
  throw new Error('jsdom 未找到，请设置 NODE_PATH 或安装 jsdom');
}
const { JSDOM, VirtualConsole } = loadJsdom();

// ROOT 默认取项目根(lunar-app)；可通过 REVIEW_ROOT 指向副本做有效性验证（不碰仓库本体）
const ROOT = process.env.REVIEW_ROOT ? path.resolve(process.env.REVIEW_ROOT) : path.resolve(__dirname, '..');
const errors = [];

// ---------- 1. 语法关 ----------
function syntaxCheck() {
  const dataFile = path.join(ROOT, 'data.js');
  try { cp.execSync(`node --check "${dataFile}"`, { stdio: 'pipe' }); }
  catch (e) { errors.push('[语法] data.js: ' + (e.stderr?.toString() || e.message)); }

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const tmp = '/tmp/_inline_check.js';
  fs.writeFileSync(tmp, inline.join('\n'));
  try { cp.execSync(`node --check "${tmp}"`, { stdio: 'pipe' }); }
  catch (e) { errors.push('[语法] 内联JS: ' + (e.stderr?.toString() || e.message)); }
}

// ---------- 2. 字典键一致性关 (D2) ----------
function zodiacKeyCheck() {
  const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const short = ['水瓶', '双鱼', '白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯'];
  for (const name of ['ZODIAC_SUMMARY', 'ZODIAC_FORTUNE']) {
    const m = src.match(new RegExp(name + '\\s*=\\s*\\{([\\s\\S]*?)\\n\\s*\\};'));
    if (!m) continue; // 字典不存在则跳过（v1.82.03 无这些字典）
    const keys = [...m[1].matchAll(/^\s*['"]?([^'":\s]+)['"]?\s*:/gm)].map(x => x[1]);
    const bad = keys.filter(k => !short.includes(k));
    if (bad.length) errors.push(`[D2] ${name} 键与 getSign 短名不一致: ${bad.join(', ')}（应用短名如'巨蟹'而非'巨蟹座'）`);
    const miss = short.filter(s => !keys.includes(s));
    if (miss.length) errors.push(`[D2] ${name} 缺星座键: ${miss.join(', ')}`);
  }
}

// ---------- 3. 字典键一致性关 (D2，起卦) ----------
function guaKeyCheck() {
  const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const gua64 = [...src.matchAll(/'(\d\d)'\s*:\s*\['([^']+)'/g)].map(m => m[2]); // GUA64 卦名
  if (!gua64.length) { errors.push('[D2] 未解析到 GUA64 卦名'); return; }
  const m = src.match(/GUA_SIMPLE\s*:\s*\{([\s\S]*?)\n\};/);
  if (!m) { errors.push('[D2] 未找到 GUA_SIMPLE 字典'); return; }
  const keys = [...m[1].matchAll(/'([^']+)'\s*:/g)].map(x => x[1]);
  const set64 = new Set(gua64), setK = new Set(keys);
  const bad = [...setK].filter(k => !set64.has(k));
  const miss = [...set64].filter(k => !setK.has(k));
  if (bad.length) errors.push(`[D2] GUA_SIMPLE 有 ${bad.length} 个键不在 GUA64: ${bad.slice(0,8).join(', ')}${bad.length>8?'…':''}`);
  if (miss.length) errors.push(`[D2] GUA_SIMPLE 缺 ${miss.length} 个卦: ${miss.slice(0,8).join(', ')}${miss.length>8?'…':''}`);
  // 每项须含 yj/sx/aq/sy/xw 五字段
  const rows = [...m[1].matchAll(/'([^']+)'\s*:\s*\{([^}]*)\}/g)];
  for (const r of rows) {
    const need = ['yj','sx','aq','sy','xw'];
    const lack = need.filter(f => !new RegExp('\\b'+f+':').test(r[2]));
    if (lack.length) errors.push(`[D2] GUA_SIMPLE['${r[1]}'] 缺字段: ${lack.join(',')}`);
  }
}

// ---------- 4. 实跑渲染关 ----------
function loadDom() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script[\s\S]*?<\/script>/g, ''); // 去掉所有 script，手动有序 eval
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => {
    const msg = e.message || '';
    if (/ENOTFOUND|copilot\.tencent|Failed to load|Network/i.test(msg)) return; // 忽略网络噪音
    if (/Not implemented: Window's (scrollTo|scrollIntoView)/i.test(msg)) return; // 忽略 jsdom 未实现的滚动 API 噪音（真实浏览器正常）
    errors.push('[jsdom] ' + (e.detail?.stack || msg));
  });
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    url: 'http://localhost/',
    virtualConsole: vc,
  });
  const { window } = dom;
  window.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
  window.cancelAnimationFrame = id => clearTimeout(id);

  const dataJs = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  const lunarJs = fs.readFileSync(path.join(ROOT, 'lunar.js'), 'utf8');
  const celJs = fs.readFileSync(path.join(ROOT, 'lib/celestine.js'), 'utf8');
  const inline = [...fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  try {
    window.eval(dataJs);
    window.eval(lunarJs);
    window.eval(celJs);
    for (const s of inline) window.eval(s);
  } catch (e) { errors.push('[eval] ' + (e.stack || e.message)); }
  return window;
}

function fillAndRun(window, birth) {
  const set = (id, val) => { const el = window.document.getElementById(id); if (el) el.value = (val ?? ''); };
  set('birthYear', birth.y);
  set('birthMonth', birth.m);
  set('birthDay', birth.d);
  set('birthHour', birth.h);
  set('birthGender', birth.gender);
  set('birthLat', birth.lat);
  set('birthLng', birth.lng);
  set('birthTz', birth.tz ?? 8);
  try { window.runCalc(); }
  catch (e) { errors.push('[runCalc] ' + (e.stack || e.message)); }
}

function checkScenario(name, birth) {
  const window = loadDom();
  fillAndRun(window, birth);
  return new Promise(res => {
    setTimeout(() => {
      const app = window.document.getElementById('app');
      const txt = app ? app.textContent : '';
      if (/推算出错了/.test(txt)) {
        const sub = (txt.match(/推算出错了([\s\S]*?)$/) || [])[1] || '';
        errors.push(`[D1/D4] 场景「${name}」render 抛异常(白屏): ${sub.trim().slice(0, 120)}`);
      }
      // D3: 模拟点击运势 tab（未来重做后存在，提前拦闭包崩溃）
      try { if (window.switchFortune) window.switchFortune('week'); }
      catch (e) { errors.push(`[D3] 场景「${name}」switchFortune 闭包崩溃: ${e.message}`); }
      if (!/今日|黄历/.test(txt)) errors.push(`[marker] 场景「${name}」未渲染今日模块`);
      // 回归：带出生信息时「我的今日」应把宜忌修正直接并入「适合做/不适合做」，不得再单列「黄历忌「/黄历宜「」冗长说明
      if (/黄历忌「|黄历宜「/.test(txt)) errors.push(`[回归] 场景「${name}」仍渲染黄历宜忌修正冗长说明(应并入适合做/不适合做两行)`);
      // 回归：rerun 入口(改信息/换个日期再算)必须常驻在 tab-panel 之外、且位于各面板之后(内容底部)，
      //        切到命盘/星盘滚到底仍可点；不能放到 tabs 下方顶部(本末倒置)
      const rb = window.document.querySelector('.rerun-bar');
      if (!rb) {
        errors.push(`[回归] 场景「${name}」未渲染常驻 rerun 入口(改信息/换个日期再算)`);
      } else if (rb.closest('.tab-panel')) {
        errors.push(`[回归] 场景「${name}」rerun 入口仍嵌在 tab-panel 内(切到命盘/星盘时不可见)`);
      } else {
        const panels = window.document.querySelectorAll('.tab-panel');
        const lastPanel = panels[panels.length - 1];
        if (lastPanel && (rb.compareDocumentPosition(lastPanel) & window.Node.DOCUMENT_POSITION_FOLLOWING)) {
          errors.push(`[回归] 场景「${name}」rerun 入口排在面板之前(应置于各 Tab 内容底部，滚动到底才出现)`);
        }
      }
      res();
    }, 700);
  });
}

// 首页/第二页(main)-无出生信息：直接 render()（enterApp 无存档分支的原语）。
// 新设计：第二页为纯个人视图（我的今日 / 命盘 / 星盘），无出生信息时只出「我的今日」个人化占位，
// 不重复首屏通用黄历/吃什么/起卦(起卦仅在首屏 peek 的 checkPeek 场景已覆盖)，不泄露命盘/星盘。
function checkHome(name) {
  const window = loadDom();
  try { window.render(); }
  catch (e) { errors.push(`[D1/D4] 场景「${name}」无出生信息 render 抛异常(白屏): ${(e.stack||e.message).slice(0,120)}`); }
  return new Promise(res => {
    setTimeout(() => {
      const app = window.document.getElementById('app');
      const txt = app ? app.textContent : '';
      if (/推算出错了/.test(txt)) {
        const sub = (txt.match(/推算出错了([\s\S]*?)$/)||[])[1]||'';
        errors.push(`[D1/D4] 场景「${name}」无出生信息 render 崩溃(白屏): ${sub.trim().slice(0,120)}`);
      }
      if (!/今日|黄历/.test(txt)) errors.push(`[marker] 场景「${name}」无出生信息未渲染「我的今日」`);
      if (!/专属你的今日指引|填左侧出生信息/.test(txt)) errors.push(`[marker] 场景「${name}」无出生信息未渲染个人化占位(应提示填出生信息)`);
      if (/命盘/.test(txt)) errors.push(`[D5] 场景「${name}」无出生信息却出现命盘 tab(应推算后才解锁)`);
      if (/星盘/.test(txt)) errors.push(`[D5] 场景「${name}」无出生信息却出现星盘 tab(应推算后才解锁)`);
      res();
    }, 500);
  });
}

// 首屏-无出生信息：验证「首次访问即出今日黄历+今日吃什么+起卦、无需推算」（本次需求核心）
function checkPeek(name) {
  const window = loadDom();
  try { window.renderHomePeek(); }
  catch (e) { errors.push(`[D1/D4] 场景「${name}」首屏 renderHomePeek 抛异常: ${(e.stack||e.message).slice(0,120)}`); }
  return new Promise(res => {
    setTimeout(() => {
      const box = window.document.getElementById('introCards');
      const txt = box ? box.textContent : '';
      if (/加载失败/.test(txt)) errors.push(`[D1/D4] 场景「${name}」首屏三卡渲染失败(降级提示)`);
      if (!/今日黄历/.test(txt)) errors.push(`[marker] 场景「${name}」首屏未渲染今日黄历`);
      if (!/今天想吃什么/.test(txt)) errors.push(`[marker] 场景「${name}」首屏未渲染今日吃什么`);
      if (!/起卦/.test(txt)) errors.push(`[marker] 场景「${name}」首屏未渲染起卦`);
      if (/命盘/.test(txt)) errors.push(`[D5] 场景「${name}」首屏无出生信息却出现命盘`);
      if (/星盘/.test(txt)) errors.push(`[D5] 场景「${name}」首屏无出生信息却出现星盘`);
      try {
        if (window.rollGua) {
          // 首屏起卦默认空状态：先验证有入口按钮，点击后才出心意（不再要求加载即出卦）
          const btn = window.document.getElementById('introRollBtn');
          if (!btn) errors.push(`[marker] 场景「${name}」首屏起卦入口按钮(introRollBtn)缺失`);
          window.rollGua('introGuaBox');
          const gtxt = (window.document.getElementById('introGuaBox')||{}).textContent || '';
          if (!/意境/.test(gtxt)) errors.push(`[D2/运行时] 场景「${name}」首屏起卦点击后未渲染意境`);
        }
      } catch (e) { errors.push(`[D1] 场景「${name}」首屏起卦抛异常: ${e.message}`); }
      res();
    }, 450);
  });
}

// 随机名人库回归：每个 CELEBS 条目填表后都应能出个人化内容。
// 年份≤1900 会令 render() 的 hasBirth=(y>1900) 闸门失效 → 「我的今日/命盘/星盘」降级成占位（表现：点推算后信息出不来）。
// 本检查拦住「重新混入古人」这类回归。
// 注意：runCalc 异步(420ms 后 render)，需逐条 await 后再断言，且逐条串行避免渲染互相覆盖。
async function checkCelebs(name) {
  const window = loadDom();
  const celebs = (window.DATA && window.DATA.CELEBS) || [];
  if (!celebs.length) { errors.push(`[回归] ${name}: 未找到 CELEBS 库`); return; }
  for (const c of celebs) {
    fillAndRun(window, { y: c.y, m: c.m, d: c.d, h: c.h, gender: c.gender, lat: c.lat, lng: c.lng, tz: c.tz });
    await new Promise(res => setTimeout(res, 500)); // 等 runCalc 的 420ms 渲染完成
    const app = window.document.getElementById('app');
    const txt = app ? app.textContent : '';
    if (/推算出错了/.test(txt)) { errors.push(`[回归] ${name}: 名人「${c.name}」(${c.y}) 点推算后崩溃`); continue; }
    if (/正在排盘/.test(txt)) { errors.push(`[回归] ${name}: 名人「${c.name}」(${c.y}) 渲染未完成(异步时序)`); continue; }
    // 年份>1900 且月日齐全 → canBazi 为真 → 「我的今日」应出现个人块「今日对你」
    if (c.y > 1900 && c.m && c.d && !/今日对你/.test(txt)) {
      errors.push(`[回归] ${name}: 名人「${c.name}」(${c.y}) 未出个人化内容(可能 y≤1900 触发降级)`);
    }
    // 命盘/星盘断言：名人 y>1900 且月日齐全 → 命盘应出八字、星盘应按「午时/成都」估算出图（不得仍占位）
    if (c.y > 1900 && c.m && c.d) {
      const mingPanel = window.document.querySelector('.tab-panel[data-tab="ming"]');
      const xingPanel = window.document.querySelector('.tab-panel[data-tab="xing"]');
      const mingTxt = mingPanel ? mingPanel.textContent : '';
      const xingTxt = xingPanel ? xingPanel.textContent : '';
      if (!/日主|喜用神/.test(mingTxt)) errors.push(`[回归] ${name}: 名人「${c.name}」命盘未渲染八字(日主/喜用神缺失)`);
      if (/还差出生信息/.test(xingTxt)) errors.push(`[回归] ${name}: 名人「${c.name}」星盘仍占位(时辰缺失应按午时估算出图)`);
      if (/星盘计算出错/.test(xingTxt)) errors.push(`[回归] ${name}: 名人「${c.name}」星盘计算抛错: ${(xingTxt.match(/星盘计算出错：([^\n]+)/)||[])[1]||''}`);
      if (!/太阳座|星盘|上升/.test(xingTxt)) errors.push(`[回归] ${name}: 名人「${c.name}」星盘无内容`);
    }
  }
}

// ---------- 神煞标注回归：标题可点解释 + 每项吉/中/凶徽标不得静默删除 ----------
function checkShenShaLabel() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const data = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  for (const c of ['sk-good', 'sk-bad', 'sk-mid']) {
    if (!html.includes(c)) errors.push(`[回归] 神煞分类徽标 CSS 缺失: .${c}`);
  }
  if (!html.includes('sk-mean-list')) errors.push('[回归] 神煞含义常驻列表(.sk-mean-list)缺失——内容释义未标注');
  if (!html.includes('sk-mean')) errors.push('[回归] 神煞含义条目(.sk-mean)缺失——内容释义未标注');
  if (!data.includes('SHENSHA_KIND')) errors.push('[回归] data.js 缺少 SHENSHA_KIND 神煞吉凶分类表');
  for (const k of ['天乙贵人','文昌贵人','禄神','将星','桃花','羊刃']) {
    if (!new RegExp(`'${k}':'(吉|中|凶)'`).test(data)) errors.push(`[回归] SHENSHA_KIND 未给「${k}」标注吉/中/凶`);
  }
  if (!/SHENSHA_KIND\[s\]/.test(html)) errors.push('[回归] 命盘神煞渲染未读取 SHENSHA_KIND 分类(内容标注丢失)');
  if (!/onclick="showWordTip\(event,'神煞'\)"/.test(html)) errors.push('[回归] 神煞标题未改为可点解释的统一标注样式');
}

// 神煞含义必须常驻可见(无需点击)：含义已在下方 .sk-mean-list 直接渲染；
// 同时神煞胶囊/释义词不再可点(含义已常驻，点按为冗余虚假入口)，断言 .shensha 无 onclick、释义词 <b> 无 onclick。
async function checkShenShaMeaning(name) {
  const window = loadDom();
  fillAndRun(window, { y: 1990, m: 6, d: 15, h: 12, gender: '男', lat: 30.67, lng: 104.06, tz: 8 });
  await new Promise(res => setTimeout(res, 500)); // 等 runCalc 的 420ms 渲染完成
  const app = window.document.getElementById('app');
  const list = app && app.querySelector('.sk-mean-list');
  if (!list) { errors.push(`[回归] ${name}: 未渲染神煞含义常驻列表(.sk-mean-list)——含义不可见`); return; }
  const txt = list.textContent || '';
  const caps = Array.from(app.querySelectorAll('.shensha'));
  if (!caps.length) { errors.push(`[回归] ${name}: 未渲染任何神煞胶囊——无法验证含义常驻`); return; }
  // 不写死具体神煞(不同出生算出不同神煞)：断言「出现的每个神煞都在常驻列表里有对应解释」
  for (const c of caps) {
    const w = (c.textContent || '').replace(/^(吉|中|凶)/, '').trim(); // 去掉徽标字
    if (!w) continue;
    if (!txt.includes(w)) errors.push(`[回归] ${name}: 神煞「${w}」已渲染胶囊但常驻含义列表缺失其解释(点按取消后必须常驻)`);
  }
  const capsule = app.querySelector('.shensha');
  if (capsule && capsule.getAttribute('onclick')) errors.push(`[回归] ${name}: 神煞胶囊仍带 onclick(应为常驻释义，删除虚假可点入口)`);
  if (list.querySelector('b[onclick]')) errors.push(`[回归] ${name}: 神煞释义词仍带 onclick(冗余点击)`);
}

// 袁天罡称骨白话化回归：data.js 须有 baihua 对照表(条数==poems)，命盘须常驻渲染 .cg-baihua(原文诗体保留、白话替代「点击看批语」)
function checkChengGuBaihua() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const data = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
  if (!/CHENG_GU\s*:\s*\{[\s\S]*baihua\s*:/.test(data)) errors.push('[回归] data.js CHENG_GU 缺少 baihua 白话对照表(称骨批语白话化丢失)');
  if (!html.includes('cg-baihua')) errors.push('[回归] 命盘称骨未渲染白话常驻块(.cg-baihua)');
  if (!/CHENG_GU\.baihua\[chengGu\.cn\]/.test(html)) errors.push('[回归] 命盘称骨渲染未读取 CHENG_GU.baihua(白话未显示)');
  const poems = (data.match(/poems\s*:\s*\{([\s\S]*?)\n  \}/) || [,''])[1];
  const baihua = (data.match(/baihua\s*:\s*\{([\s\S]*?)\n  \}/) || [,''])[1];
  const pCount = (poems.match(/'/g) || []).length / 2;
  const bCount = (baihua.match(/'/g) || []).length / 2;
  if (pCount !== bCount) errors.push(`[回归] 称骨 baihua(${bCount}条) 与 poems(${pCount}条) 数量不一致——有重量缺白话`);
}

async function checkChengGuBaihuaRender(name) {
  const window = loadDom();
  fillAndRun(window, { y: 1990, m: 6, d: 15, h: 12, gender: '男', lat: 30.67, lng: 104.06, tz: 8 });
  await new Promise(res => setTimeout(res, 500)); // 等 runCalc 的 420ms 渲染完成
  const app = window.document.getElementById('app');
  const bh = app && app.querySelector('.cg-baihua');
  if (!bh) { errors.push(`[回归] ${name}: 未渲染称骨白话常驻块(.cg-baihua)——白话不可见`); return; }
  const t = (bh.textContent || '').trim();
  if (t.length < 8) errors.push(`[回归] ${name}: 称骨白话内容过短(${t.length}字)，可能未渲染`);
}

(async () => {
  syntaxCheck();
  zodiacKeyCheck();
  guaKeyCheck();
  checkShenShaLabel();
  await checkShenShaMeaning('神煞含义常驻');
  checkChengGuBaihua();
  await checkChengGuBaihuaRender('称骨白话');
  // 首屏-无出生信息：验证「首次访问即出今日黄历+今日吃什么+起卦、无需推算」（本次需求核心）
  await checkPeek('首屏-无出生信息');
  // 首页-无出生信息：验证「进首页即出今日黄历+今日吃什么+起卦、无需推算」(本次需求核心)
  await checkHome('首页-无出生信息');
  // 三场景覆盖：用户生日(双鱼,完整) / 原 bug 星座(巨蟹,完整) / 仅月日
  await checkScenario('双鱼-完整', { y: 2002, m: 2, d: 19, h: 12, gender: 1, lat: 30.57, lng: 104.07, tz: 8 });
  await checkScenario('巨蟹-完整', { y: 1990, m: 7, d: 1, h: 10, gender: 0, lat: 31.23, lng: 121.47, tz: 8 });
  await checkScenario('仅月日', { m: 5, d: 15 });
  // 随机名人库回归：每个 CELEBS 条目填表后都应出个人化内容(拦「混入年份≤1900 导致信息出不来」)
  await checkCelebs('随机名人库');

  if (errors.length) {
    console.log(`❌ review-check 未通过，发现 ${errors.length} 处缺陷：`);
    errors.forEach(e => console.log('  - ' + e));
    process.exit(1);
  } else {
    console.log('✅ review-check 通过：语法 / 实跑渲染 / 字典键一致性 均无缺陷');
    process.exit(0);
  }
})();
