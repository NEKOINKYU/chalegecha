# lunar-app 代码审查标准（鹰眼标准）

> 目标：**在缺陷到达生产环境（CloudStudio 部署）之前拦截**。
> 核心教训：语法正确（`node --check` 通过）≠ 能运行。v1.83.01 三个真实事故全是“能跑过语法、跑不起来”的坑。
> 适用：lunar-app 纯静态 PWA（index.html + data.js + lunar.js + lib/celestine.js）。

---

## 一、提交前必过「四关」（每次 commit 前逐项确认）

| 关卡 | 做什么 | 拦什么 |
|---|---|---|
| 1. 语法关 | `node --check data.js` + 抽取 index.html 内联 JS 跑 `node --check` | 低级语法错误 |
| 2. 实跑关 | `node scripts/review-check.js`（jsdom 实跑 render） | 运行时崩溃 / 白屏 |
| 3. 字典键关 | 脚本自动校验 `D.ZODIAC_*` 键与 `getSign()` 短名集**双向一致** | 静默取 undefined 整块空白 |
| 4. 人工 review | 自审 + 列出改动点给用户确认 | 逻辑/文案/位置问题 |

> 第 2、3 关已自动化进 `scripts/review-check.js`，并由 `pre-commit` 钩子强制执行，非零退出直接阻断提交。

---

## 二、lunar-app 高频缺陷清单（来自 v1.83.01 真实事故）

### D1. 第三方库 API 误用 —— 高危，直接白屏
- **现象**：`TypeError: bc.getBaZiNaYin is not a function` → render 进命盘分支即抛异常 → 整页红色「推算出错了」。
- **根因**：`getBaZiNaYin` 挂在 `Lunar` 类（`birthSolar.getLunar().getBaZiNaYin()`），而 `bc` 是 `EightChar` 实例，根本没有该方法。
- **规则**：
  - 凡调用 `lunar.js` / `celestine.js` 的方法，**先在 node 里 `typeof obj.method === 'function'` 验证方法归属**，禁止凭记忆/猜测调 API。
  - 拿到对象后查原型（grep `prototype.methodName` / 类名）确认方法到底挂在哪个类。
  - 八字相关：`bc = birthSolar.getLunar().getEightChar()`（EightChar），纳音在 `birthSolar.getLunar()`（Lunar）。

### D2. 字典键不一致 —— 最隐蔽，静默失败
- **现象**：`D.ZODIAC_SUMMARY['巨蟹座']` 但 `getSign()` 返回 `'巨蟹'`（短名）→ 取到 `undefined` → 星座总结 / 运势整块空白，不报错但功能废了。
- **规则**：
  - **统一约定**：`D.ZODIAC_*` 字典**一律用 `getSign()` 返回的短名做键**（巨蟹 / 双鱼 / 白羊 …），UI 显示时再加「座」字（`sc + '座'`）。
  - 凡 `D.X[key]` 访问，`key` 的来源（getSign 返回值集）必须与字典定义键集**双向 ⊆**：字典键 ⊆ 短名集，且短名集 ⊆ 字典键。
  - 新增任何「按某 key 取属性」的字典，必须在定义处注释「键来源 = getSign() 短名」。
  - 校验脚本（D3 关）自动扫 `ZODIAC_SUMMARY` / `ZODIAC_FORTUNE` 键做一致性断言。

### D3. 闭包 / 作用域陷阱 —— 交互时才崩
- **现象**：`userSign` 写在 `render()` 内 `const`，被全局 `onclick` 的 `switchFortune` 引用 → 用户点击运势 tab 才报 `userSign is not defined`，首屏不崩、点了才白。
- **规则**：
  - 被事件处理器 / `onclick`（渲染后**异步**调用）引用的变量，必须是**模块级 `let`**，不得是函数内 `const`。
  - 凡是定义在 `render()` / 某函数内、又被全局函数或事件引用的变量 → 提为模块级。
  - 自查：grep 全局函数里用到的变量，确认它们不是某个函数局部的 `const` / `let`。

### D4. 未实跑校验 —— 根因放大剂
- **规则**：`node --check` 只查语法。每次改动必须**实跑 render** 确认：① 不抛异常 ② 错误兜底文案「推算出错了」不出现 ③ 关键 marker（今日 / 命盘 / 星盘 按填的信息）存在。
- 自动化：直接跑 `node scripts/review-check.js`，它用 jsdom 注入多组出生信息、捕获 window error / unhandledRejection / render 异常。

### D5. 个性化门控一致性
- **规则**：`canBazi`(年+月+日) / `canSign`(月+日) / `canChart`(年+月+日+时+经纬度) 的判定逻辑在**全部使用点一致**；改一处要全局搜使用点逐个核对（曾出现 `hasBirth` vs `canBazi` 混用导致年份-only 崩溃）。

---

## 三、审查流程（每次改动）

1. **自审**：过「四关」+ 对照缺陷清单 D1–D5 逐条核对改动点。
2. **实跑**：`node scripts/review-check.js` 必须 0 错误（pre-commit 钩子也会再拦一次）。
3. **确认**：列出改动点 + 本地预览（`http://127.0.0.1:8080/`）给用户过目。
4. **提交**：`git commit`（钩子兜底）；遵循「git 是死规矩」每步必 commit。
5. **部署**：仅用户满意后 `workbuddy_cloudstudio_deploy`，不在试错期反复上线。

---

## 四、回滚纪律（屎山治理）

- 线上发现崩溃：**先 `git reset --hard <上一个稳定 commit>`，在干净基础上按本标准重做**，不就地打补丁、不累堆屎山。
- 大改版若一次引入多 bug：果断回退到改版前稳定版，再「一次一块」规范重做（用户明确：不要一次性改那么多）。
- 未提交但有价值的临时修复：回退前先 `git stash` 保底，确认不要了再 `git stash drop`。

---

## 五、检查清单（commit 前贴脸自问）

- [ ] `node --check data.js` 通过？内联 JS 通过？
- [ ] `node scripts/review-check.js` 0 错误？
- [ ] 动了 lunar.js / celestine.js 的 API？→ 验证过方法真实存在且归属正确（D1）？
- [ ] 新增 / 修改了按 key 取属性的字典？→ 键与 getSign 短名双向一致（D2）？
- [ ] 改了被 onclick / 事件引用的变量？→ 提为模块级 let（D3）？
- [ ] 动了 canBazi / canSign / canChart？→ 全部使用点一致（D5）？
- [ ] 本地预览肉眼过一遍（今日 / 命盘 / 星盘 三板块）？
