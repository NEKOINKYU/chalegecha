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
      // 起卦运行时冒烟：rollGua 不得抛错，且 GUA_SIMPLE 解析须渲染「意境」
      try {
        if (window.rollGua) {
          window.rollGua();
          const gtxt = (window.document.getElementById('guaBox') || {}).textContent || '';
          if (!/意境/.test(gtxt)) errors.push(`[D2/运行时] 场景「${name}」rollGua 未渲染意境(可能 GUA_SIMPLE 键不匹配或 rollGua 异常)`);
        }
      } catch (e) { errors.push(`[D1] 场景「${name}」rollGua 抛异常: ${e.message}`); }
      res();
    }, 700);
  });
}

// 首页/第二页(main)-无出生信息：直接 render()（enterApp 无存档分支的原语）。
// 新设计：第二页为纯个人视图，无出生信息时出「我的今日」个人化占位(提示填信息)+起卦，
// 不重复首屏通用黄历/吃什么(那些在首屏 peek 的 checkPeek 场景已覆盖)，不泄露命盘/星盘。
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
      if (!/起卦/.test(txt)) errors.push(`[marker] 场景「${name}」无出生信息未渲染起卦入口`);
      if (/命盘/.test(txt)) errors.push(`[D5] 场景「${name}」无出生信息却出现命盘 tab(应推算后才解锁)`);
      if (/星盘/.test(txt)) errors.push(`[D5] 场景「${name}」无出生信息却出现星盘 tab(应推算后才解锁)`);
      try {
        if (window.rollGua) { window.rollGua();
          const gtxt=(window.document.getElementById('guaBox')||{}).textContent||'';
          if(!/意境/.test(gtxt)) errors.push(`[D2/运行时] 场景「${name}」rollGua 未渲染意境`);
        }
      } catch(e){ errors.push(`[D1] 场景「${name}」rollGua 抛异常: ${e.message}`); }
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

(async () => {
  syntaxCheck();
  zodiacKeyCheck();
  guaKeyCheck();
  // 首屏-无出生信息：验证「首次访问即出今日黄历+今日吃什么+起卦、无需推算」（本次需求核心）
  await checkPeek('首屏-无出生信息');
  // 首页-无出生信息：验证「进首页即出今日黄历+今日吃什么+起卦、无需推算」(本次需求核心)
  await checkHome('首页-无出生信息');
  // 三场景覆盖：用户生日(双鱼,完整) / 原 bug 星座(巨蟹,完整) / 仅月日
  await checkScenario('双鱼-完整', { y: 2002, m: 2, d: 19, h: 12, gender: 1, lat: 30.57, lng: 104.07, tz: 8 });
  await checkScenario('巨蟹-完整', { y: 1990, m: 7, d: 1, h: 10, gender: 0, lat: 31.23, lng: 121.47, tz: 8 });
  await checkScenario('仅月日', { m: 5, d: 15 });

  if (errors.length) {
    console.log(`❌ review-check 未通过，发现 ${errors.length} 处缺陷：`);
    errors.forEach(e => console.log('  - ' + e));
    process.exit(1);
  } else {
    console.log('✅ review-check 通过：语法 / 实跑渲染 / 字典键一致性 均无缺陷');
    process.exit(0);
  }
})();
