// 浏览器从后台缓存恢复时强制刷新（解决手机"关了再开内容不变"）—— 延迟300ms避免闪烁
window.addEventListener('pageshow',function(e){ if(e.persisted) setTimeout(()=>location.reload(), 300); });
const D = window.DATA;
const GAN = D.GAN_WUXING, ZHI = D.ZHI_CANG, SHENG = D.SHENG, KE = D.KE, WUXING_TEXT = D.WUXING_TEXT;
const ELEM_TO_WUXING = {'火':'火','土':'土','风':'木','水':'水'};

/* ================= 星座 ================= */
function getSign(month, day){
  const m=month, d=day;
  if((m==1&&d>=20)||(m==2&&d<=18))return '水瓶';
  if((m==2&&d>=19)||(m==3&&d<=20))return '双鱼';
  if((m==3&&d>=21)||(m==4&&d<=19))return '白羊';
  if((m==4&&d>=20)||(m==5&&d<=20))return '金牛';
  if((m==5&&d>=21)||(m==6&&d<=21))return '双子';
  if((m==6&&d>=22)||(m==7&&d<=22))return '巨蟹';
  if((m==7&&d>=23)||(m==8&&d<=22))return '狮子';
  if((m==8&&d>=23)||(m==9&&d<=22))return '处女';
  if((m==9&&d>=23)||(m==10&&d<=23))return '天秤';
  if((m==10&&d>=24)||(m==11&&d<=22))return '天蝎';
  if((m==11&&d>=23)||(m==12&&d<=21))return '射手';
  return '摩羯';
}

/* ================= 八字解析 ================= */
function parseFourPillars(str){
  return str.trim().split(/\s+/).filter(Boolean).map(p=>p.includes('未知') ? null : p);
}
function countWuxing(pillars){
  const c = {木:0,火:0,土:0,金:0,水:0};
  pillars.forEach(p=>{
    if(!p) return;
    const g = GAN[p.charAt(0)], z = ZHI[p.charAt(1)];
    if(g && g in c) c[g]++;
    if(z && z in c) c[z]++;
  });
  return c;
}
function missingWuxing(c){ return Object.keys(c).filter(k=>c[k]===0); }
function strengthScore(pillars, dayGan){
  const me = GAN[dayGan];
  let score = 0;
  pillars.filter(Boolean).forEach((p,idx)=>{
    const g = GAN[p.charAt(0)], z = ZHI[p.charAt(1)];
    if(g===me || SHENG[g]===me) score += D.STRENGTH.gan_same_sheng;
    else score += D.STRENGTH.gan_other;
    if(idx===1 && z){
      if(z===me || SHENG[z]===me) score += D.STRENGTH.month_bonus;
      else score -= Math.abs(D.STRENGTH.month_penalty);
    } else if(z){
      if(z===me || SHENG[z]===me) score += D.STRENGTH.zhi_bonus;
      else score += D.STRENGTH.zhi_penalty;
    }
  });
  return score;
}
function deriveYongShen(pillars, dayGan, score){
  const me = GAN[dayGan];
  const strong = score > 0;
  const keMe = KE[me];
  const woSheng = SHENG[me];
  const woKe = Object.keys(KE).find(k=>KE[k]===me);
  const shengMe = Object.keys(SHENG).find(k=>SHENG[k]===me);
  let xi=[], ji=[];
  if(strong){
    xi = [...new Set([keMe, woSheng, woKe].filter(w=>w&&w!==me))];
    ji = [...new Set([shengMe, me].filter(Boolean))];
  } else {
    xi = [...new Set([shengMe, me].filter(Boolean))];
    ji = [...new Set([keMe, woKe, woSheng].filter(w=>w&&w!==me))];
  }
  const desc = strong
    ? `身强（日主得令得势）→ 喜【${xi.join('、')}】平衡，忌【${ji.join('、')}】助旺`
    : `身弱（日主失令失势）→ 喜【${xi.join('、')}】生扶，忌【${ji.join('、')}】再克泄`;
  return {strong, xi, ji, score, desc};
}
function getShenSha(pillars){
  const out = [];
  if(pillars.length<4 || pillars.some(p=>!p)) return out;
  const dayGan = pillars[2].charAt(0);
  const zhis = pillars.map(p=>p.charAt(1));            // [年支,月支,日支,时支]
  const yearZhi = zhis[0], monthZhi = zhis[1], dayZhi = zhis[2];
  const PN = ['年','月','日','时'];
  const idxZhi = t => zhis.findIndex(z => z === t);          // 按地支找所在柱
  const idxAny = t => pillars.findIndex(p => p.indexOf(t) >= 0); // 按干或支找所在柱
  const add = (base, idx) => { if(idx>=0) out.push({base, label: base+'·'+PN[idx]}); };
  let i;
  // —— 日主派（以日干为基），落在日支/时支 ——
  if((i = zhis.findIndex(z => (D.TIAN_YI[dayGan]||[]).includes(z))) >= 0) add('天乙贵人', i);
  if((i = [2,3].find(k => zhis[k] === D.WEN_CHANG[dayGan])) !== undefined) add('文昌贵人', i);
  if((i = [2,3].find(k => zhis[k] === D.YANG_REN[dayGan]))  !== undefined) add('羊刃', i);
  if((i = [2,3].find(k => zhis[k] === D.LU_SHEN[dayGan]))   !== undefined) add('禄神', i);
  if((i = [2,3].find(k => zhis[k] === D.FU_XING[dayGan]))   !== undefined) add('福星贵人', i);
  if((i = [2,3].find(k => zhis[k] === D.GUO_YIN[dayGan]))   !== undefined) add('国印贵人', i);
  if((i = [2,3].find(k => zhis[k] === D.JIN_YU[dayGan]))    !== undefined) add('金舆', i);
  if((i = zhis.findIndex(z => (D.TAI_JI[dayGan]||[]).includes(z))) >= 0) add('太极贵人', i);
  // —— 月支派（月令）——
  if((i = idxAny(D.TIAN_DE[monthZhi])) >= 0) add('天德', i);
  if((i = idxAny(D.YUE_DE[monthZhi]))  >= 0) add('月德', i);
  // —— 年支三方派（仅年支）——
  if((i = idxZhi(D.GU_CHEN[yearZhi])) >= 0) add('孤辰', i);
  if((i = idxZhi(D.GUA_SU[yearZhi]))  >= 0) add('寡宿', i);
  // —— 将星仅主派（年支三合中神）——
  if((i = idxZhi(D.JIANG_XING[yearZhi])) >= 0) add('将星', i);
  // —— 三合局派 / 婚姻派：年支 + 日支 两派都算 ——
  const twin = (dict, base) => {
    if((i = idxZhi(dict[yearZhi])) >= 0) add(base, i);
    if((i = idxZhi(dict[dayZhi]))  >= 0) add(base, i);
  };
  twin(D.TAO_HUA,  '桃花');
  twin(D.YI_MA,    '驿马');
  twin(D.HUA_GAI,  '华盖');
  twin(D.JIE_SHA,  '劫煞');
  twin(D.WANG_SHEN,'亡神');
  twin(D.ZAI_SHA,  '灾煞');
  twin(D.HONG_LUAN,'红鸾');
  twin(D.TIAN_XI,  '天喜');
  // —— 空亡：日柱旬空，逐柱标（落在哪柱，哪柱空）——
  const ZS = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
  const gN = '甲乙丙丁戊己庚辛壬癸'.indexOf(dayGan)+1;
  const zN = ZS.indexOf(dayZhi)+1;
  const headZ = ((zN-(gN-1)-1)%12+12)%12+1;          // 旬首支(1-based)
  const inXun = new Set(); for(let k=0;k<10;k++) inXun.add((headZ-1+k)%12+1);
  const kong = ZS.filter((_,idx)=>!inXun.has(idx+1));
  zhis.forEach((z,idx)=>{ if(kong.includes(z)) add('空亡', idx); });
  // 三合局两派（年支+日支）若年支与日支同属一个三合局（如申/子皆申子辰），
  // 会算出同一个目标地支、落在同一柱 → 生成两个完全相同的标签。本属同一桩事实，
  // 去重避免折叠区出现「一模一样的两个」。落在不同柱（不同含义）的则各自保留。
  const seen = new Set();
  return out.filter(o => { const k = o.base + '|' + o.label; if (seen.has(k)) return false; seen.add(k); return true; });
}
// 命盘顶部「一眼读懂你」：基于日主五行 + 身强/身弱，生成几句话的情绪价值总结
function buildPersonaSummary(bazi, ys){
  if(!bazi || !bazi.me) return '';
  const me = bazi.me;            // 日主五行：木火土金水
  const strong = !!(ys && ys.strong);
  const CORE = {
    木: '你是一个像树一样的人——根扎得稳，向上生长是你的本能。你有自己的节奏，不轻易被旁人带偏，认定的方向就慢慢长上去。',
    火: '你是一个像光一样的人——热情、明亮、主动。你一站出来就有温度，能把气氛和点子都点亮，是那种让人想靠近的人。',
    土: '你是一个像大地一样的人——稳、厚、靠得住。你不急不躁，能接住事也能接住人，是朋友心里“有你在就踏实”的那一个。',
    金: '你是一个像精金一样的人——清、利、有棱角。你讲原则、利落、不拖泥带水，认定的对错分得很清，也敢做决定。',
    水: '你是一个像水一样的人——灵、活、懂变通。你脑子转得快，适应力强，深浅都藏得住，遇着沟坎也能绕过去。'
  };
  const sLine = strong
    ? '你骨子里有主见、有冲劲，认定的事能自己扛、自己推，是那种“交给我就行”的人。'
    : '你心思细、感知力强，更懂得借势与相处，柔里带韧——不硬碰硬，却也从不真的认输。';
  const xiName = (ys && ys.xi && ys.xi.length) ? ys.xi.map(wx).join('、') : '自己';
  const cLine = strong
    ? `你最舒服的样子，是给自己留一点余地、别逼太满——${xiName}是你的补给，松一松反而更顺。`
    : `你最舒服的样子，是被懂你的人托着、安心做自己——${xiName}是你的补给，往那上面靠一靠就稳了。`;
  return `${CORE[me]||''}${sLine}${cLine}`;
}
function evalAgainstYongShen(wx, ys){
  if(!wx || !ys || !ys.xi.length) return {delta:0, rel:''};
  let delta=0, rel='';
  if(ys.xi.includes(wx)){ delta=10; rel=`${wx}（喜用，得助）`; }
  else if(ys.ji.includes(wx)){ delta=-10; rel=`${wx}（忌神，不利）`; }
  else {
    const xi0 = ys.xi[0];
    if(SHENG[wx]===xi0){ delta=8; rel=`${wx}生${xi0}（生助用神）`; }
    else if(KE[wx]===xi0){ delta=-8; rel=`${wx}克${xi0}（克用神）`; }
    else if(SHENG[xi0]===wx){ delta=2; rel=`${wx}泄${xi0}（耗用神）`; }
    else { delta=0; rel=`${wx}（中性）`; }
  }
  return {delta, rel};
}

/* ================= 周易：梅花易数时间起卦 + 六曜 ================= */
const ZHI_ORDER = {'子':1,'丑':2,'寅':3,'卯':4,'辰':5,'巳':6,'午':7,'未':8,'申':9,'酉':10,'戌':11,'亥':12};
/* 八卦二进制（从下往上，阳1阴0）→ 数字（乾1兑2离3震4巽5坎6艮7坤8） */
const GUA8_BITS = {'111':'1','110':'2','101':'3','100':'4','011':'5','010':'6','001':'7','000':'8'};
const GUA8_BITS_REV = {'1':'111','2':'110','3':'101','4':'100','5':'011','6':'010','7':'001','8':'000'};
/* 八卦五行：乾兑金，离火，震巽木，坎水，艮坤土 */
const GUA8_WX = {1:'金',2:'金',3:'火',4:'木',5:'木',6:'水',7:'土',8:'土'};
function guaCast(ganzhi, month, day, hourZhi){
  const yearZhi = ganzhi.charAt(1);          // 年支
  const yN = ZHI_ORDER[yearZhi]||0;
  const hN = hourZhi ? (ZHI_ORDER[hourZhi]||0) : 0;
  const up = ((yN + month + day) % 8) || 8;         // 上卦
  const down = ((yN + month + day + hN) % 8) || 8;  // 下卦
  const moving = ((yN + month + day + hN) % 6) || 6; // 动爻 1-6
  return {up, down, moving};
}
function flipGua(num, bitIdx){ // bitIdx 1-3 从下往上
  const bits = GUA8_BITS_REV[String(num)].split('');
  bits[bitIdx-1] = bits[bitIdx-1]==='1' ? '0' : '1';
  return GUA8_BITS[bits.join('')];
}
function getGuaInfo(ganzhi, month, day, hourZhi){
  const {up, down, moving} = guaCast(ganzhi, month, day, hourZhi);
  const key = String(down)+String(up);
  const base = D.GUA64[key] || [D.GUA8_NAME[down]+'/'+D.GUA8_NAME[up], '卦象'];
  // 变卦：动爻位翻转
  let nDown = down, nUp = up;
  if(moving <= 3) nDown = flipGua(down, moving);
  else nUp = flipGua(up, moving-3);
  const bian = D.GUA64[String(nDown)+String(nUp)] || null;
  return {
    baseName: base[0], baseDesc: base[1],
    moving,
    upSym: D.GUA8_NAME[up], downSym: D.GUA8_NAME[down],
    bianName: bian ? bian[0] : null, bianDesc: bian ? bian[1] : null,
    up, down
  };
}
const LIUYAO_EXPLAIN = {
  '大安':['诸事皆宜，所求皆得','吉'],
  '赤口':['口舌是非，诸事小心','凶'],
  '先胜':['凡事皆吉，午后尤佳','吉'],
  '友引':['早晚不利，午间吉','平'],
  '先负':['早吉晚凶，午前为吉','平'],
  '佛灭':['大凶之日，诸事不宜','凶']
};

/* ================= 生肖关系 ================= */
function shengxiaoRelation(mySx, yearSx){
  if(mySx === yearSx) return ['本命年（值太岁）','宜守不宜冲，多拜太岁求稳','mid-t'];
  if(D.SHENGXIAO_LIUCHONG[mySx] === yearSx) return ['冲太岁','变动之年，大事缓办，谨慎出行','bad-t'];
  if(D.SHENGXIAO_LIUHE[mySx] === yearSx) return ['六合太岁','贵人相助之年，合作宜成','good-t'];
  if(D.SHENGXIAO_SANHE[mySx] === yearSx) return ['三合太岁','运势顺遂，宜把握机会','good-t'];
  return ['平太岁','按部就班，稳中求进','mid-t'];
}

/* ================= 主渲染 ================= */
/* ============ 定制线条图标（替代系统 emoji，小巧精致 / 单文件 / 跟随主题） ============ */
const ICON = {
  today:'<rect x="3.5" y="5" width="17" height="15" rx="2.6"/><path d="M3.5 9.2h17"/><path d="M8 3.2v3.2M16 3.2v3.2"/>',
  ming:'<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4a8.6 8.6 0 0 1 0 17.2 4.3 4.3 0 0 1 0-8.6 4.3 4.3 0 0 0 0-8.6z"/><circle cx="12" cy="7.7" r="1.3"/><circle cx="12" cy="16.3" r="1.3"/>',
  xing:'<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-22 12 12)"/><path d="M19 4.5l.9 2.1 2.1.9-2.1.9L19 11l-.9-2.1L16 7.5l2.1-.9z"/>',
  me:'<circle cx="12" cy="8" r="3.2"/><path d="M5.4 19a6.6 6.6 0 0 1 13.2 0"/>',
  talk:'<path d="M5 4.6h14a1.6 1.6 0 0 1 1.6 1.6v7.2a1.6 1.6 0 0 1-1.6 1.6H10l-3.8 3v-3H5A1.6 1.6 0 0 1 3.4 13.4V6.2A1.6 1.6 0 0 1 5 4.6z"/>',
  food:'<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8.5 7.6c0-1 .8-1.4.8-2.6M12 7.6c0-1 .8-1.4.8-2.6M15.5 7.6c0-1 .8-1.4.8-2.6"/>',
  gua:'<path d="M12 6.2c-2-1.1-4-1.1-6 0v11.6c2-1.1 4-1.1 6 0 2-1.1 4-1.1 6 0V6.2c-2-1.1-4-1.1-6 0z"/><path d="M12 6.2v11.6"/>',
  dress:'<path d="M8.6 4.4 12 6.4l3.4-2 3.4 3-2.6 2.3L15.6 8v10.4H8.4V8L7.8 9.7 5.2 7.4z"/>',
  clock:'<circle cx="12" cy="12" r="8.4"/><path d="M12 7.2V12l3.2 2"/>',
  compass:'<circle cx="12" cy="12" r="8.4"/><path d="M12 7.4l2 4.6-2 4.6-2-4.6z"/>',
  scale:'<path d="M12 4v16M6 7.5h12M6 7.5 3 13h6zM18 7.5 15 13h6z"/>',
  sun:'<circle cx="12" cy="12" r="3.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2 2M16.8 16.8l2 2M18.8 5.2l-2 2M7.2 16.8l-2 2"/>',
  moon:'<path d="M15.8 4.2A8 8 0 1 0 19.8 16 6.4 6.4 0 0 1 15.8 4.2z"/>',
  asc:'<path d="M12 19V5.5M6.5 11 12 5.5 17.5 11"/>',
  warn:'<path d="M12 3.4 21 19.2H3z"/><path d="M12 9v4.6M12 16.4v.2"/>',
  pin:'<path d="M12 21s6.8-6.2 6.8-11.6A6.8 6.8 0 1 0 5.2 9.4C5.2 14.8 12 21 12 21z"/><circle cx="12" cy="9.4" r="2.4"/>',
  globe:'<circle cx="12" cy="12" r="8.4"/><path d="M3.6 12h16.8M12 3.6c2.8 2.8 2.8 14 0 16.8M12 3.6c-2.8 2.8-2.8 14 0 16.8"/>',
  pencil:'<path d="M4 20l.9-3.4L16 5.5l3.5 3.5L8.4 19.1z"/><path d="M14.5 7 17 9.5"/>',
  dice:'<rect x="4.5" y="4.5" width="15" height="15" rx="3.2"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="12" cy="15" r="1.2"/>',
  folder:'<path d="M3.5 6.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z"/>',
  arrow:'<path d="M4.5 12h14M13 6.5 19 12l-6 5.5"/>',
  bolt:'<path d="M13 3 5.5 13H11l-1 8 8-10.5H12z"/>',
  save:'<path d="M4.5 4.5h13l3 3v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 19.5v-13A1.5 1.5 0 0 1 4.5 4.5z"/><path d="M8 4.5v5h7V4.5M8 20v-6h8v6"/>',
  refresh:'<path d="M5 12a7 7 0 0 1 12-5l1.8 1.8M19 12a7 7 0 0 1-12 5L5.2 15.2"/><path d="M19 4v5h-5M5 20v-5h5"/>',
  taiji:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18 4.5 4.5 0 0 1 0-9 4.5 4.5 0 0 0 0-9z"/><circle cx="12" cy="7.5" r="1.4"/><circle cx="12" cy="16.5" r="1.4"/>',
  sparkle:'<path d="M12 3.2l1.9 5.3L19 10.4l-5.1 1.9L12 17.6l-1.9-5.3L5 10.4l5.1-1.9z"/><path d="M18.5 3.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z"/>',
  lock:'<rect x="5" y="10.5" width="14" height="9.5" rx="2.2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/><circle cx="12" cy="15" r="1.3"/>'
};
const EMOJI_MAP = {
  '📅':'today','🔮':'ming','🌟':'xing','👤':'me','🗣':'talk','🍜':'food','📖':'gua','👕':'dress',
  '⏰':'clock','🧭':'compass','⚖️':'scale','☀️':'sun','🌙':'moon','⬆️':'asc','⚠️':'warn','📍':'pin',
  '🌍':'globe','✏️':'pencil','🎲':'dice','📂':'folder','📁':'folder','➜':'arrow','⚡':'bolt','💾':'save',
  '🔄':'refresh','☯':'taiji','✨':'sparkle','📿':'gua'
};
function icon(name, size){
  size = size || 17;
  const inner = ICON[name] || '';
  return '<svg class="ic" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+inner+'</svg>';
}
function deEmoji(s){
  if(!s) return s;
  for(const e in EMOJI_MAP){ if(s.indexOf(e) >= 0) s = s.split(e).join(icon(EMOJI_MAP[e])); }
  return s;
}
/* ---- 推算时刻选择器：年/月/日/时/分 直选，默认今天此刻，支持「时间未知」 ---- */
function syncDayOptions(preserve){
  const y=+document.getElementById('selYear').value, m=+document.getElementById('selMonth').value;
  const max = (y && m) ? new Date(y, m, 0).getDate() : 31;
  const sel=document.getElementById('selDay');
  let cur = (preserve!=null) ? preserve : (+sel.value||1);
  if(cur<1 || cur>max) cur = Math.min(Math.max(cur,1), max);
  let html=''; for(let i=1;i<=max;i++) html+=`<option value="${i}">${i}日</option>`;
  sel.innerHTML=html; sel.value=cur;
}
function fillDtNow(){
  const now=new Date();
  const y=now.getFullYear(), m=now.getMonth()+1, d=now.getDate(), h=now.getHours(), mi=now.getMinutes();
  const ySel=document.getElementById('selYear'), mSel=document.getElementById('selMonth'),
        hSel=document.getElementById('selHour'), miSel=document.getElementById('selMin');
  let yh=''; for(let yy=2100; yy>=1900; yy--) yh+=`<option value="${yy}"${yy===y?' selected':''}>${yy}年</option>`;
  ySel.innerHTML=yh;
  let mh=''; for(let mm=1; mm<=12; mm++) mh+=`<option value="${mm}"${mm===m?' selected':''}>${mm}月</option>`;
  mSel.innerHTML=mh;
  let hh=''; for(let x=0;x<24;x++) hh+=`<option value="${x}"${x===h?' selected':''}>${x}时</option>`;
  hSel.innerHTML=hh;
  let mih=''; for(let x=0;x<60;x++) mih+=`<option value="${x}"${x===mi?' selected':''}>${x}分</option>`;
  miSel.innerHTML=mih;
  document.getElementById('chkUnknown').checked=false;
  syncDayOptions(d);
}
function onDtChange(){
  const unk=document.getElementById('chkUnknown').checked;
  syncDayOptions();                                   // 年/月变动时钳制日范围
  document.getElementById('selHour').disabled=unk;
  document.getElementById('selMin').disabled=unk;
  const main=document.getElementById('main');
  if(main && !main.classList.contains('hidden')){ try{ render(); }catch(e){ showPlaceholder(null); } }
  else { markDirty(); }
}

function render(){
  const y=parseInt(document.getElementById('birthYear').value)||0;
  const m=parseInt(document.getElementById('birthMonth').value)||0;
  const d=parseInt(document.getElementById('birthDay').value)||0;
  const h=parseInt(document.getElementById('birthHour').value)||-1;
  const gSel=document.getElementById('birthGender').value;
  const gender = gSel==='' ? -1 : parseInt(gSel);
  const latV = document.getElementById('birthLat').value;
  const lngV = document.getElementById('birthLng').value;
  const lat = latV==='' ? null : parseFloat(latV);
  const lng = lngV==='' ? null : parseFloat(lngV);
  const tzV = document.getElementById('birthTz').value;
  const tz = tzV==='' ? 8 : parseInt(tzV);
  const tY=parseInt(document.getElementById('selYear').value)||0;
  const tM=parseInt(document.getElementById('selMonth').value)||0;
  const tD=parseInt(document.getElementById('selDay').value)||0;
  const timeUnknown=document.getElementById('chkUnknown').checked;
  const target=(tY&&tM&&tD)?`${tY}-${String(tM).padStart(2,'0')}-${String(tD).padStart(2,'0')}`:'';
  const hasBirth = y>1900;
  const anyBirth = y>1900 || m>0 || d>0 || h>=0 || lat!=null || lng!=null;
  const canBazi = y>1900 && m>0 && d>0;            // 年+月+日 足够排八字（时辰可选）
  const canSign = m>0 && d>0;                       // 星座只需月日（无需年份）
  const canChart = y>1900 && m>0 && d>0;            // 星盘：年月日齐全即可（时辰/经纬度缺失时按午时/成都估算，见下方降级提示）
  if(!anyBirth && currentTab!=='today') currentTab='today';
  const provTxt = document.getElementById('birthProv').selectedOptions[0] ? document.getElementById('birthProv').selectedOptions[0].textContent : '';
  const cityTxt = document.getElementById('birthCity').selectedOptions[0] ? document.getElementById('birthCity').selectedOptions[0].textContent : '';
  const areaTxt = document.getElementById('birthArea').selectedOptions[0] ? document.getElementById('birthArea').selectedOptions[0].textContent : '';
  const worldTxt = document.getElementById('birthWorldCity').selectedOptions[0] ? document.getElementById('birthWorldCity').selectedOptions[0].textContent : '';
  const regionTxt = (document.getElementById('birthCountry').value==='world')
    ? (worldTxt || '（未选）')
    : [provTxt,cityTxt,areaTxt].filter(t=>t && t!=='省' && t!=='市' && t!=='区/县').join(' / ');
  const birthBits = [];
  if(y>1900) birthBits.push('出生年 '+y);
  if(m>0) birthBits.push('出生月 '+m+'月');
  if(d>0) birthBits.push('出生日 '+d+'日');
  if(h>=0) birthBits.push('出生时辰 '+['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][h/2]+'时');
  if(regionTxt) birthBits.push('出生地 '+regionTxt);
  const birthInfoText = birthBits.length ? '已填：'+birthBits.join(' · ') : '（什么都没填）';

  const solar = target ? Solar.fromYmd(parseInt(target.slice(0,4)),parseInt(target.slice(5,7)),parseInt(target.slice(8,10))) : Solar.fromDate(new Date());
  const L = solar.getLunar();
  const th = timeUnknown ? 12 : (parseInt(document.getElementById('selHour').value)||12); // 推算时刻小时（未知时按午时占位，仅时辰卡跳过）
  const tmin = timeUnknown ? 0 : (parseInt(document.getElementById('selMin').value)||0);   // 推算时刻分钟

  const todayStr = solar.toYmd()+' '+solar.getWeekInChinese();
  const lunarStr = L.toString();
  const eightChar = L.getEightChar().toString();
  const sign = getSign(solar.getMonth(), solar.getDay());
  const shengXiao = L.getYearShengXiao();
  const sig = D.SIGNS[sign];
  // 用户太阳星座（填了出生信息用出生星座；否则用当天星座）
  const userSign = canSign ? getSign(m,d) : (hasBirth ? (()=>{ try{ return Solar.fromYmdHms(y,m,d,h>=0?h:12,0,0).getXingZuo(); }catch(e){ return sign; } })() : sign);
  const uSig = D.SIGNS[userSign] || sig;
  const sd = signDaily(GAN[L.getDayGan()], ELEM_TO_WUXING[uSig.element]); // 星座当日动态

  const yi = L.getDayYi(); const ji = L.getDayJi();
  const pengZu = L.getPengZuGan()+'；'+L.getPengZuZhi();
  const chong = L.getDayChongDesc(); const naYin = L.getDayNaYin();
  const tianShen = L.getDayTianShen(); const jiShen = L.getDayJiShen(); const xiongSha = L.getDayXiongSha();
  const xiPos = L.getDayPositionXiDesc();

  /* ---- 时辰宜忌（让推算时刻的小时真正参与，不再只是死变量） ---- */
  let hourHtml;
  if(timeUnknown){
    hourHtml = `<div class="card hour-card">
    <h2>⏰ 推算时刻 · 时间未知</h2>
    <div class="mini-detail">未指定具体时刻，时辰宜忌暂不显示（按日推算的其它内容不受影响）。</div>
  </div>`;
  } else {
    const p2 = n => String(n).padStart(2,'0');
    const GAN_NAMES = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
    const ZHI_NAMES = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    const HOUR_RANGE = ['23-1','1-3','3-5','5-7','7-9','9-11','11-13','13-15','15-17','17-19','19-21','21-23'];
    const zhiIdx = (Math.floor((th+1)/2)) % 12;            // 23-0→子,1-2→丑…15-16→申(即17点前)
    const hourZhi = ZHI_NAMES[zhiIdx];
    const hourWx = ZHI[hourZhi];                            // 时支五行（复用 ZHI_CANG）
    const dayGanName = L.getDayGan();                       // 推算日干名
    const dayWx = GAN[dayGanName];                          // 日干五行
    const hourGanIdx = (([0,2,4,6,8][GAN_NAMES.indexOf(dayGanName)%5]) + zhiIdx) % 10; // 五鼠遁
    const hourGanZhi = GAN_NAMES[hourGanIdx] + hourZhi;
    let hourLuck='平', hourLuckCls='mid', hourLuckTip='时辰与日主比和，平稳无冲，宜按部就班。';
    if(hourWx!==dayWx){
      if(SHENG[hourWx]===dayWx){ hourLuck='吉'; hourLuckCls='good'; hourLuckTip='时辰生扶日主，得时助力，宜推进要事。'; }
      else if(SHENG[dayWx]===hourWx){ hourLuck='小耗'; hourLuckCls='mid'; hourLuckTip='日主生时辰，稍泄气，宜守成、忌强出头。'; }
      else if(KE[hourWx]===dayWx){ hourLuck='凶'; hourLuckCls='bad'; hourLuckTip='时辰克日主，阻力明显，宜稳守、忌冒进。'; }
      else if(KE[dayWx]===hourWx){ hourLuck='耗'; hourLuckCls='mid'; hourLuckTip='日主克时辰，费力稍多，宜务实、忌空耗。'; }
    }
    const hourYiJi = (D.HOUR_YI_JI && D.HOUR_YI_JI[hourZhi]) || {yi:[],ji:[],tip:''};
    const hourCls = hourLuckCls==='good'?'sb-strong':hourLuckCls==='bad'?'sb-weak':'';
    hourHtml = `
  <div class="card hour-card">
    <h2>⏰ 推算时刻 · ${hourZhi}时（${HOUR_RANGE[zhiIdx]}点 · ${p2(th)}:${p2(tmin)}）</h2>
    <div class="mini-detail" style="margin-bottom:6px">时辰干支 <b>${hourGanZhi}</b>　日主 <b>${dayGanName}</b>（${dayWx}）与时辰（${hourWx}）相<span class="strong-badge ${hourCls}" style="cursor:pointer" onclick="showWordTip(event,'时辰吉凶')">${hourLuck}</span></div>
    <div class="th-row" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div class="th-yi"><span class="th-yj-lab y">宜</span>${fmtWords(hourYiJi.yi,6)}</div>
      <div class="th-ji"><span class="th-yj-lab n">忌</span>${fmtWords(hourYiJi.ji,6)}</div>
    </div>
    <div class="mini-detail" style="margin-top:6px">${escHtml(hourYiJi.tip||'')}　${hourLuckTip}</div>
    ${xiPos?`<div class="mini-detail" style="margin-top:4px">喜神方位：<b>${escHtml(xiPos)}</b></div>`:''}
  </div>`;
  }
  const liuYao = L.getLiuYao();

  /* ---- 八字个性化 ---- */
  let bazi = null, ys = null, daYun = null, shensha = [], shenshaMain = [], shenshaRest = [], chengGu = null, baziScore = 60, signScore = 60, dayunScore = 60;
  if(canBazi){
    const birthSolar = (h>=0) ? Solar.fromYmdHms(y,m,d,h,0,0) : Solar.fromYmdHms(y,m,d,12,0,0);
    const bc = birthSolar.getLunar().getEightChar();
    let str = bc.toString();
    if(h<0){
      const parts = str.trim().split(/\s+/).filter(Boolean);
      if(parts.length===4) str = parts.slice(0,3).join(' ')+' 时辰未知';
    }
    const pillars = parseFourPillars(str);
    const fullPillars = pillars.every(Boolean);
    const wuxing = countWuxing(pillars);
    const dayGan = bc.getDayGan();
    const dayZhi = bc.getDayZhi();
    const me = GAN[dayGan];
    const score = strengthScore(pillars, dayGan);
    ys = deriveYongShen(pillars, dayGan, score);
    shensha = getShenSha(pillars);
    const MAIN_SHENSHA = ['天乙贵人','文昌贵人','羊刃','禄神','将星','桃花']; // 主6：一眼可见
    shenshaMain = shensha.filter(o=>MAIN_SHENSHA.includes(o.base));
    shenshaRest = shensha.filter(o=>!MAIN_SHENSHA.includes(o.base));
    bazi = {
      str, wuxing, dayGan, dayZhi, me, score, hourUnknown: h<0,
      taiYuan: fullPillars ? bc.getTaiYuan() : null,
      mingGong: fullPillars ? bc.getMingGong() : null,
      shenGong: fullPillars ? bc.getShenGong() : null,
    };
    const todayW = GAN[L.getDayGan()];
    const ev = evalAgainstYongShen(todayW, ys);
    baziScore = Math.round(Math.max(20, Math.min(95, 60 + ev.delta*2.2)));
    // 袁天罡称骨（需时辰）
    if(h>=0){ try{ chengGu = calcChengGu(birthSolar.getLunar(), h); }catch(e){} }
    if(gender>=0 && h>=0){
      try{
        const yun = bc.getYun(gender);
        const dys = yun.getDaYun();
        const age = solar.getYear() - y;
        let cur = null;
        for(let i=0;i<dys.length;i++){
          if(i===dys.length-1 || age < dys[i+1].getStartAge()){ cur=dys[i]; break; }
        }
        if(cur){
          const dyW = GAN[cur.getGanZhi().charAt(0)];
          const ev2 = evalAgainstYongShen(dyW, ys);
          dayunScore = Math.max(20, Math.min(95, Math.round(60 + ev2.delta*1.6)));
          daYun = {gz: cur.getGanZhi(), startAge: cur.getStartAge(), startYear: cur.getStartYear(), wx: dyW, rel: ev2.rel, score: dayunScore};
        }
      }catch(e){ daYun = null; }
    }
    const signElem = ELEM_TO_WUXING[sig.element];
    if(signElem===me) signScore += 10;
    else if(SHENG[signElem]===me) signScore += 8;
    else if(KE[signElem]===me) signScore -= 8;
    signScore = Math.max(20, Math.min(95, signScore));
  } else {
    signScore += 6;
  }

  /* ---- 融合评分 ---- */
  let huali = 60 + yi.length*2 - ji.length*4;
  huali = Math.max(10, Math.min(95, huali));
  const total = Math.round(huali*0.4 + baziScore*0.3 + signScore*0.2 + dayunScore*0.1);
  let verdict='', vClass='mid';
  if(total>=75){verdict='大吉 · 顺势而为，宜行动';vClass='good';}
  else if(total>=60){verdict='中吉 · 平稳推进，抓重点';vClass='mid';}
  else if(total>=45){verdict='小凶 · 宜守不宜攻';vClass='mid';}
  else {verdict='凶 · 谨慎行事，宜静不宜动';vClass='bad';}

  let fusionWhy;
  if(canBazi && ys){
    const todayW = GAN[L.getDayGan()];
    const ev = evalAgainstYongShen(todayW, ys);
    fusionWhy =
      `黄历：宜${fmtWords(yi,4)}，忌${fmtWords(ji,4)}；` +
      `八字：日主${bazi.me}${bazi.dayGan}${bazi.dayZhi}，${ys.desc}；当日【${todayW}】${ev.rel}${ev.delta>=8?'，做事顺用神，宜推进':(ev.delta<=-8?'，逆用神，宜守':'，中平日')}；` +
      (daYun?`大运【${colorGZ(daYun.gz)}】${daYun.rel}；`:'') +
      `星座：${sign}（${sig.element}）。综合${verdict.split('·')[0]}。`;
  } else if(hasBirth){
    fusionWhy = `黄历：宜${fmtWords(yi,4)}，忌${fmtWords(ji,4)}；星座：${sign}。未填性别/时辰，八字用神与大运维度未参与（补全更准）。`;
  } else {
    fusionWhy = `黄历：宜${fmtWords(yi,4)}，忌${fmtWords(ji,4)}；星座：${sign}（${sig.element}）——${sig.today[0]}。未填出生信息，八字/星盘/周易未参与（填了更准）。`;
  }

  /* ---- 每日一卦（梅花易数时间起卦） ---- */
  /* 四维/卦象等由按钮或联动触发；此处不再自动起卦 */
  const lyEx = LIUYAO_EXPLAIN[liuYao] || ['','平'];

  /* 四维宜忌：当前版本不展示，计算保留以备复用 */

  /* ---- 穿衣颜色 ---- */
  const todayW = GAN[L.getDayGan()];
  const todayC = D.WUXING_COLORS[todayW];
  let dressHtml = '';
  if(ys && ys.xi.length){
    const xi0 = D.WUXING_COLORS[ys.xi[0]];
    const evD = evalAgainstYongShen(todayW, ys);
    dressHtml = `
      <div class="kv">
        <div><b>主推（用神 ${ys.xi[0]} 色系）：</b>${xi0.name} ${xi0.colors.map(c=>`<span class="color-chip" style="background:${c}"></span>`).join('')}<br><span class="mini-detail">${xi0.tip}</span></div>
        <div style="margin-top:6px"><b>今日（${todayW}日）：</b>${todayC.name} ${todayC.colors.map(c=>`<span class="color-chip" style="background:${c}"></span>`).join('')} —— ${evD.delta>=8?'今日五行正合你，放心穿':(evD.delta<=-8?'今日五行犯忌，建议避开此色系':(evD.delta>=0?'今日五行中平，可作点缀':'略泄气，少穿'))}</div>
        ${ys.ji.length?`<div style="margin-top:6px"><b>避开（忌神 ${ys.ji.join('、')} 色系）：</b>${ys.ji.map(j=>{const c=D.WUXING_COLORS[j]; return c?c.name:j;}).join('、')}</div>`:''}
        <div style="margin-top:6px"><b>星座幸运色：</b><span style="color:${sig.color[0]}">■ ${sig.color[0]}</span> <span style="color:${sig.color[1]}">■ ${sig.color[1]}</span></div>
      </div>`;
  } else {
    dressHtml = `<div class="kv"><div><b>今日（${todayW}日）幸运色：</b>${todayC.name} ${todayC.colors.map(c=>`<span class="color-chip" style="background:${c}"></span>`).join('')}<br><span class="mini-detail">未填出生信息——按今日黄历五行推荐；填了信息会换成更贴合你个人的色系。</span></div></div>`;
  }

  /* ---- 星盘（celestine） ---- */
  const EN_SIGN = {Aries:'白羊',Taurus:'金牛',Gemini:'双子',Cancer:'巨蟹',Leo:'狮子',Virgo:'处女',Libra:'天秤',Scorpio:'天蝎',Sagittarius:'射手',Capricorn:'摩羯',Aquarius:'水瓶',Pisces:'双鱼'};
  const getSignCN = (fmt)=>{ const mm=(fmt||'').match(/([A-Z][a-z]+)$/); return mm?EN_SIGN[mm[1]]:null; };
  let astroHtml = '';
  if(canChart && typeof Celestine !== 'undefined'){
    try{
      const hh = h>=0 ? h : 12;
      const chart = Celestine.calculateChart({year:y, month:m, day:d, hour:hh, minute:0, second:0, timezone:tz, latitude:lat!=null?lat:30.67, longitude:lng!=null?lng:104.06});
      // 三要素：太阳（lunar）/月亮/上升（celestine）
      let tri = '';
      try{
        const sunCN = Solar.fromYmdHms(y,m,d,hh,0,0).getXingZuo();
        const moonP = (chart.planets||[]).find(p=>p.name==='Moon');
        const moonCN = moonP ? getSignCN(moonP.formatted) : null;
        let ascCN = null;
        if(lat!=null && lng!=null) ascCN = getSignCN(chart.angles.ascendant.formatted);
        tri = `<div class="astro-tri">
          ☀️ 太阳座 <span class="yw" data-w="${escHtml(sunCN)}座·太阳" onclick="showWordTip(event,this)">${sunCN}座</span>
          ${moonCN?`· 🌙 月亮 <span class="yw" data-w="${escHtml(moonCN)}座·月亮" onclick="showWordTip(event,this)">${moonCN}座</span>`:''}
          · ⬆️ 上升 ${ascCN?`<span class="yw" data-w="${escHtml(ascCN)}座·上升" onclick="showWordTip(event,this)">${ascCN}座</span>`:'—（选出生地后显示）'}
        </div>`;
      }catch(e){}
      const PLANET_CN = {Sun:'太阳',Moon:'月亮',Mercury:'水星',Venus:'金星',Mars:'火星',Jupiter:'木星',Saturn:'土星',Uranus:'天王星',Neptune:'海王星',Pluto:'冥王星',Chiron:'凯龙星'};
      const ASPECT_CN = {conjunction:'合',opposition:'冲',trine:'拱',square:'刑',sextile:'六合',quincunx:'梅花'};
      let planets = (chart.planets||[]).filter(p=>PLANET_CN[p.name]);
      let items = planets.slice(0,10).map(p=>{ const sc=getSignCN(p.formatted); return `<div class="astro-item"><b>${PLANET_CN[p.name]||p.name}</b>${sc?' · <b style="color:var(--accent)">'+sc+'座</b>':''}<br>${p.formatted}</div>`; }).join('');
      let angles = '';
      if(lat!=null && lng!=null){
        angles = `<div class="kv" style="margin-top:8px"><b><span class="yw" onclick="showWordTip(event,'上升星座')">上升</span>：</b>${chart.angles.ascendant.formatted}　<b><span class="yw" onclick="showWordTip(event,'中天')">中天</span>：</b>${chart.angles.midheaven.formatted}</div>`;
      } else {
        angles = `<div class="mini-detail" style="margin-top:8px">未填出生地经纬度——已按成都坐标估算（<span class="yw" onclick="showWordTip(event,'上升星座')">上升</span>/宫位会随出生地变化，选城市或填经纬度更准）。</div>`;
      }
      const aspects = (chart.aspects.all||[]).filter(a=>PLANET_CN[a.body1]&&PLANET_CN[a.body2]).slice(0,8)
        .map(a=>`${PLANET_CN[a.body1]} <span class="yw" data-w="${escHtml(ASPECT_CN[a.type]||a.type)}" onclick="showWordTip(event,this)">${ASPECT_CN[a.type]||a.type}</span> ${PLANET_CN[a.body2]}`).join(' · ');
      astroHtml = `
        ${tri}
        ${angles}
        <div class="astro-grid" style="margin-top:8px">${items}</div>
        ${aspects?`<div style="margin-top:10px"><b style="font-size:12px;color:var(--gold)">主要相位（前8）：</b><div class="aspect-line">${aspects}</div></div>`:''}
        ${h<0?`<div class="mini-detail" style="margin-top:6px">⚠️ 时辰未知，星盘按午时估算，上升星座不准——补时辰后更准。</div>`:''}`;
    }catch(e){
      astroHtml = `<div class="mini-detail">星盘计算出错：${e.message}</div>`;
    }
  } else if(canChart){
    astroHtml = `<div class="mini-detail">星盘引擎未加载（lib/celestine.js 缺失）。</div>`;
  }

  /* ---- 星座日运（celestine.js 真实天象 + 模板引擎） ---- */
  let horoscopeHtml = '';
  if(canChart && typeof Celestine !== 'undefined'){
    try{
      horoscopeHtml = renderHoroscope(userSign);
    }catch(e){}
  } else if(typeof Celestine === 'undefined'){
    // 没加载celestine就降级
  }

  /* ---- 鸡汤（本地随机 + 联网 hitokoto） ---- */
  const localQuote = D.QUOTES[Math.floor(Math.random()*D.QUOTES.length)];

  /* ---- 白话解读参数 ---- */
  const dressXiName = ys && ys.xi.length ? D.WUXING_COLORS[ys.xi[0]].name.replace('系','') : '中性';
  // 真随机：每次推算重新抽「一件小事」（去掉按天固定的 daySeed）
  const smallThing = D.SMALL_THINGS[Math.floor(Math.random()*D.SMALL_THINGS.length)];
  // 「今天想吃什么」结合命理：喜用神首选 > 当日日干五行；无信息退回随机池
  const foodWX = (hasBirth && ys && ys.xi && ys.xi.length) ? ys.xi[0] : GAN[L.getDayGan()];
  curFoodWX = foodWX;
  const foodPool = (D.FOOD_BY_WX && D.FOOD_BY_WX[foodWX] && D.FOOD_BY_WX[foodWX].length) ? D.FOOD_BY_WX[foodWX] : (D.FOODS||['随便吃点']);
  const todayFood = foodPool[Math.floor(Math.random()*foodPool.length)];
  const foodTip = (D.FOOD_WX_TIP && D.FOOD_WX_TIP[foodWX]) ? `（今日五行喜【${foodWX}】——${D.FOOD_WX_TIP[foodWX]}）` : '';
  const plain = buildPlain(verdict, total, yi, ji, hasBirth&&ys?evalAgainstYongShen(GAN[L.getDayGan()],ys):{delta:0}, sig, dressXiName, daYun, smallThing);

  /* ---- 个人化宜忌：用神修正黄历宜忌，直接并入「宜/忌」，不再单列冗长修正说明 ---- */
  const pYJ = (canBazi && ys) ? personalYiJi(yi, ji, ys) : {pYi:(yi||[]), pJi:(ji||[])};

  // 综合分算法说明（点击弹窗用）
  const scoreMainWhy = `综合分由四个维度加权融合：<br>• 黄历（宜忌） ${huali} × 0.4 = ${(huali*0.4).toFixed(1)}<br>• 八字用神 ${baziScore} × 0.3 = ${(baziScore*0.3).toFixed(1)}<br>• 星座 ${signScore} × 0.2 = ${(signScore*0.2).toFixed(1)}<br>• 大运 ${dayunScore} × 0.1 = ${(dayunScore*0.1).toFixed(1)}<br>加总 ≈ <b>${total}</b> 分（四舍五入）。${canBazi&&ys?'已填出生信息，启用八字/大运维度；':'未填出生信息，八字/大运按中性参与；'}填得越全越准。`;
  const app = document.getElementById('app');
  const __H = `
  <nav class="tabs">
    <button class="tab-btn active" data-tab="today" onclick="switchTab('today')">${icon('today')}我的今日</button>
    ${anyBirth?`<button class="tab-btn" data-tab="ming" onclick="switchTab('ming')">${icon('ming')}命盘</button>`:''}
    ${anyBirth?`<button class="tab-btn" data-tab="xing" onclick="switchTab('xing')">${icon('xing')}星盘</button>`:''}
  </nav>
  <div class="tab-panel active" data-tab="today">

  <!-- ===== 我的今日（个人向：用神/个人历/今日对你，不与首页通用黄历重复） ===== -->
  ${canBazi && ys ? `
  <div class="card today-hero">
    <h2>🔮 我的今日</h2>
    <div class="eight-char" style="margin-top:4px;justify-content:flex-start;padding-left:0">${colorBazi(bazi.str)}</div>
    <div class="th-row" style="margin-top:8px"><span class="th-label">今日对你</span><span class="mini-detail">今日<b style="color:var(--accent)">${wx(GAN[L.getDayGan()])}</b>日「<b style="color:var(--accent)">${evalAgainstYongShen(GAN[L.getDayGan()],ys).rel||'中性'}</b>」</span></div>

    <div class="th-top">
      <div class="th-score" data-title="个人综合分怎么算" data-body="${escHtml(scoreMainWhy)}" onclick="showScoreInfo(this)" role="button" title="点击查看打分规则"><div class="th-num">${total}</div><div class="th-unit">综合分</div></div>
      <div class="th-main">
        <div class="th-verdict ${vClass}">${verdict}</div>
        <div class="th-date">${todayStr}</div>
      </div>
    </div>

    <div class="th-row" style="flex-direction:column;align-items:flex-start;gap:6px">
      <div class="th-yi"><span class="th-yj-lab y">宜</span>${fmtWords(pYJ.pYi,3)}</div>
      <div class="th-ji"><span class="th-yj-lab n">忌</span>${fmtWords(pYJ.pJi,3)}</div>
    </div>
    <div class="mini-detail" style="margin-top:4px">点词语可看大白话解释</div>

    <div class="th-row" style="margin-top:8px"><span class="th-label">幸运色</span>${dressHtml}</div>

    <div id="quoteText" class="th-quote"></div>
  </div>
  ` : `
  <div class="card today-hero">
    <h2>🔮 我的今日</h2>
    <div class="ph-icon"><span class="ic">${icon('ming')}</span></div>
    <div class="ph-sub" style="text-align:center">填左侧出生信息，生成专属你的今日指引（用神 · 个人历 · 今日对你）。</div>
  </div>
  `}

  ${hourHtml}
  </div>
  ${anyBirth?`
  <div class="tab-panel" data-tab="ming">
  ${canBazi && bazi ? `
  <div class="card persona-card">
    <div class="persona-kicker">✨ 一眼读懂你</div>
    <div class="persona-text">${buildPersonaSummary(bazi, ys)}</div>
    <div class="persona-foot">日主 <b>${bazi.dayGan}${bazi.dayZhi}</b>（${bazi.me}）· ${ys.strong?'身强':'身弱'}，往下滑就能看到完整的你 ↓</div>
  </div>
  ` : `
  <div class="card persona-card persona-card--empty">
    <div class="persona-kicker">✨ 一眼读懂你</div>
    <div class="persona-text">补全出生年份和时辰，我就能告诉你「你是一个什么样的人」。</div>
  </div>
  `}
  <div class="card">
    <h2>🔮 我的八字 ${canBazi?'('+y+'-'+m+'-'+d+(h>=0?' '+['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][h/2]+'时':' 时辰未知')+')':''}</h2>
    ${canBazi && bazi ? `
      <div class="eight-char">${colorBazi(bazi.str)}</div>
      <div class="kv" style="margin-top:8px">
        <div><b><span class="yw" onclick="showWordTip(event,'日主')">日主</span>：</b>${bazi.dayGan}${bazi.dayZhi}（${bazi.me}）<span class="strong-badge ${ys.strong?'sb-strong':'sb-weak'}" style="cursor:pointer" onclick="showWordTip(event,'强弱分')">${ys.strong?'身强':'身弱'} · 强弱分${bazi.score>0?'+':''}${bazi.score}</span></div>
        <div><b><span class="yw" onclick="showWordTip(event,'喜用神')">喜用神</span>：</b>${ys.xi.map(wx).join('、')}　<b><span class="yw" onclick="showWordTip(event,'忌神')">忌神</span>：</b>${ys.ji.map(wx).join('、')}</div>
        <div><b><span class="yw" onclick="showWordTip(event,'五行分布')">五行分布</span>：</b>${Object.entries(bazi.wuxing).map(([k,v])=>`${wx(k)}${v}`).join(' · ')}　<b>缺：</b>${missingWuxing(bazi.wuxing).map(wx).join('、')||'无'}</div>
        ${chengGu?`<div><b><span class="yw" onclick="showWordTip(event,'袁天罡称骨')">袁天罡称骨</span>：</b><span class="cg-weight" onclick="var p=document.getElementById('cgPoem'); if(p){p.hidden=!p.hidden; this.classList.toggle('open');}" role="button" tabindex="0">⚖️ ${chengGu.cn}<span class="cg-caret">▾</span></span><span class="cg-baihua">：${escHtml(D.CHENG_GU.baihua[chengGu.cn]||'')}</span>${chengGu.poem?`<div class="cg-poem" id="cgPoem" hidden>${escHtml(chengGu.poem)}</div>`:''}</div>`:(canBazi?`<div><b><span class="yw" onclick="showWordTip(event,'袁天罡称骨')">袁天罡称骨</span>：</b><span class="mini-detail">需出生时辰才能称骨</span></div>`:'')}
        ${shensha.length?`
        <div><b><span class="yw" onclick="showWordTip(event,'神煞')">神煞</span>：</b>${shenshaMain.map(o=>{const k=D.SHENSHA_KIND[o.base]||'中';const cls=k==='吉'?'good':k==='凶'?'bad':'mid';return `<span class="shensha sk-${cls}"><b class="sk-tag">${k}</b>${escHtml(o.label)}</span>`;}).join('')} <span class="mini-detail">（后缀·年/月/日/时 指所在/基准地支，同一神煞落不同柱含义不同）</span></div>
        <div class="sk-mean-list">${shenshaMain.map(o=>`<div class="sk-mean"><b>${escHtml(o.label)}</b>：${escHtml(D.ASTRO_DICT[o.base]||'命理中的小彩蛋——有的旺你一把，有的提醒你悠着点')}</div>`).join('')}</div>
        ${shenshaRest.length?`
        <details class="shensha-all">
          <summary>查看全部神煞（${shenshaRest.length}）</summary>
          ${['吉','中','凶'].map(kind=>{
            const grp = shenshaRest.filter(o=>(D.SHENSHA_KIND[o.base]||'中')===kind);
            if(!grp.length) return '';
            return `<div class="sk-group">
              <div class="sk-group-title"><span class="shensha sk-${kind==='吉'?'good':kind==='凶'?'bad':'mid'}"><b class="sk-tag">${kind}</b></span> ${kind==='吉'?'吉神':kind==='凶'?'凶煞':'中性'}</div>
              ${grp.map(o=>{const c2=D.SHENSHA_KIND[o.base]||'中';const cl2=c2==='吉'?'good':c2==='凶'?'bad':'mid';return `<span class="shensha sk-${cl2}"><b class="sk-tag">${c2}</b>${escHtml(o.label)}</span>`;}).join('')}
              <div class="sk-mean-list">${grp.map(o=>`<div class="sk-mean"><b>${escHtml(o.label)}</b>：${escHtml(D.ASTRO_DICT[o.base]||'')}</div>`).join('')}</div>
            </div>`;
          }).join('')}
        </details>`:''}
        `:''}
        ${daYun?`<div><b><span class="yw" onclick="showWordTip(event,'大运')">当前大运</span>：</b>${colorGZ(daYun.gz)}（${daYun.startAge}岁 · ${daYun.startYear}年起）· ${daYun.rel}</div>`:''}
        ${bazi.taiYuan?`<div class="mini-detail"><span class="yw" onclick="showWordTip(event,'胎元')">胎元</span> ${bazi.taiYuan} · <span class="yw" onclick="showWordTip(event,'命宫')">命宫</span> ${bazi.mingGong} · <span class="yw" onclick="showWordTip(event,'身宫')">身宫</span> ${bazi.shenGong}</div>`:''}
      </div>
    ` : `<div class="mini-detail">还差出生信息，排不出完整八字。${birthInfoText}　八字需出生年 / 月 / 日（年份最关键，月日干支都靠它推算）。</div>`}
  </div>
  </div>
  `:''}

  ${anyBirth?`
  <div class="tab-panel" data-tab="xing">
  <!-- 今日指引（一览，置顶） -->
  <div class="card">
    <h2>✨ ${userSign}座 · 今日指引</h2>
    ${canSign?`
    <div class="horoscope">
      <div><b><span class="yw" data-w="${escHtml(uSig.element)}象" onclick="showWordTip(event,this)">${uSig.element}象</span>元素：</b>${uSig.element}（→五行${ELEM_TO_WUXING[uSig.element]}）　<b><span class="yw" onclick="showWordTip(event,'幸运色')">幸运色</span>：</b><span style="color:${uSig.color[0]}">■</span> <span style="color:${uSig.color[1]}">■</span></div>
      <div style="margin-top:8px"><b>适合：</b>${uSig.like}</div>
      <div><b>避免：</b>${uSig.avoid}</div>
      <div style="margin-top:8px"><b>今日：</b>${uSig.today[0]}；${uSig.today[1]}</div>
      <div style="margin-top:8px"><b>五行视角：</b>今日${wx(GAN[L.getDayGan()])}日对你（${uSig.element}象）「<span class="${sd.cls}">${sd.rel}</span>」——${sd.tip}</div>
    </div>
    `:`<div class="mini-detail">填出生月日（无需年份）即可看你的星座今日指引。${birthInfoText}</div>`}
  </div>

  <!-- 星座运势 -->
  ${horoscopeHtml?`<div class="card" style="border-left:3px solid var(--accent)"><h2>🔮 ${userSign}座 · 星座运势</h2>
    <div style="display:flex;gap:6px;margin-bottom:12px">
      <button class="tab-btn small" data-hs="week" onclick="switchHoroscopePeriod('week','${userSign}')">周运</button>
      <button class="tab-btn small" data-hs="month" onclick="switchHoroscopePeriod('month','${userSign}')">月运</button>
      <button class="tab-btn small" data-hs="year" onclick="switchHoroscopePeriod('year','${userSign}')">年运</button>
    </div>
    ${horoscopeHtml}
    <div id="hsExtra"></div>
  </div>`:''}

  <!-- 星盘 -->
  <div class="card">
    <h2>🌟 星盘（celestine 引擎）${canChart?'· '+y+'-'+m+'-'+d:''}</h2>
    ${astroHtml || `<div class="mini-detail">还差出生信息，暂时排不出完整星盘。${birthInfoText}　完整星盘需：出生年 / 月 / 日 / 时 + 出生地经纬度。</div>`}
  </div>
  </div>
  `:''}

  ${hasRun?`<div class="rerun-bar"><button class="btn btn-go rerun" onclick="var f=document.querySelector('.form-wrap'); if(f){f.scrollIntoView({behavior:'smooth'});}">↑ 改信息 / 换个日期再算</button></div>`:''}

  `;
  app.innerHTML = deEmoji(__H);

  // 今日一言：仅用本地语料，不联网（避免向第三方泄露访问者 IP、去除外部依赖与供应链风险）
  const qEl = document.getElementById('quoteText');
  if(qEl && D.QUOTES && D.QUOTES.length){
    qEl.textContent = D.QUOTES[Math.floor(Math.random()*D.QUOTES.length)];
  }
  switchTab(currentTab);   // 进入结果时按当前 Tab 展示 + 交错淡入
}

/* ================= 宜忌词/术语点击释义 ================= */
function fmtWords(arr, max, dict){
  const d = dict || D.YIJI_DICT;
  const blocked = D.YIJI_OBSOLETE || new Set();
  const a = (arr||[]).filter(w=>!blocked.has(w)).slice(0, max||4);
  return a.length ? a.map(w=>`<span class="yw" data-w="${escHtml(w)}" onclick="showWordTip(event,this)">${escHtml(w)}</span>`).join('、') : '无';
}
function escHtml(s){
  return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/* 五行字符配色：木火土金水 按属性上色（水蓝·木绿·土棕·火红·金白） */
function wx(ch){
  if('木火土金水'.indexOf(ch) < 0) return escHtml(ch);
  return `<span style="color:${WUXING_TEXT[ch]};font-weight:700">${ch}</span>`;
}
/* 八字8字配色：每柱 干(天干五行)+支(地支五行) 各自属性色，上方标年/月/日/时 */
function colorBazi(str){
  const pillars = str.trim().split(/\s+/).filter(Boolean);
  const labels = ['年','月','日','时'];
  return pillars.map((p,i)=>{
    if(p.indexOf('未知')>=0) return `<span class="pillar"><span class="pl">${labels[i]||''}</span><span class="pz" style="color:var(--sub);font-size:14px">${escHtml(p)}</span></span>`;
    const g = p.charAt(0), z = p.charAt(1);
    const gc = WUXING_TEXT[GAN[g]] || 'var(--ink)';
    const zc = WUXING_TEXT[ZHI[z]] || 'var(--ink)';
    return `<span class="pillar"><span class="pl">${labels[i]||''}</span><b style="color:${gc}">${escHtml(g)}</b><b style="color:${zc};margin-left:1px">${escHtml(z)}</b></span>`;
  }).join('');
}
function colorBaziMini(str){
  if(!str) return '';
  const s = str.replace(/\s+/g,''); // 去空格
  const parts = s.match(/.{1,2}/g) || [];
  return parts.map(p=>{
    const g=p.charAt(0), z=p.charAt(1)||'';
    const gc=WUXING_TEXT[GAN[g]]||'var(--ink)';
    const zc=z&&WUXING_TEXT[ZHI[z]]?WUXING_TEXT[ZHI[z]]:'var(--ink)';
    return `<b style="color:${gc}">${escHtml(g)}</b><b style="color:${zc}">${escHtml(z)}</b>`;
  }).join(' ');
}
function colorBaziSingle(str){
  if(!str) return '';
  const s = str.replace(/\s+/g,'');
  if(s.length<8) return escHtml(s);
  const gans=[], zhis=[];
  for(let i=0;i<s.length;i+=2){ gans.push(s[i]); zhis.push(s[i+1]||''); }
  const c=(c,isGan)=>{
    const wx = isGan ? (GAN[c]||'') : (ZHI[c]||'');
    return WUXING_TEXT[wx]||'var(--ink)';
  };
  return gans.map((g,i)=>`<b style="color:${c(g,true)}">${escHtml(g)}</b>`).join(' ') +
    '<br>' + zhis.map((z,i)=>`<b style="color:${c(z,false)}">${escHtml(z)}</b>`).join(' ');
}
/* 干支（无标签行内）配色：用于「大运」等单组干支，按天干/地支五行属性上色 */
function colorGZ(gz){
  if(!gz) return '';
  return gz.split('').map(c=>{
    const w = GAN[c] || ZHI[c];
    if(w && WUXING_TEXT[w]) return `<b style="color:${WUXING_TEXT[w]}">${escHtml(c)}</b>`;
    return escHtml(c);
  }).join('');
}
function showWordTip(e, arg){
  if(e && e.stopPropagation){ e.stopPropagation(); e.preventDefault(); }
  // 兼容两种调用：传元素(fmtWords) 或 传字符串(命盘/星盘模板)
  var el = null, w = '';
  if(arg && arg.getBoundingClientRect){ el = arg; w = el.getAttribute('data-w') || ''; }
  else { w = String(arg||''); el = (e && e.currentTarget) || (e && e.target && e.target.closest ? e.target.closest('.yw') : null); }
  if(!el){ return; }
  if(!w){ w = el.getAttribute('data-w') || el.textContent.slice(0,8); }
  // 已展开→收起
  if(el.classList.contains('yw-open')){ closeWordDetail(el); return; }
  // 收掉其他展开
  document.querySelectorAll('.yw-open').forEach(function(x){ closeWordDetail(x); });
  var d = D.YIJI_DICT[w] || D.ASTRO_DICT[w] || '';
  if(!d && D.CHENG_GU && D.CHENG_GU.poems[w]) d = '袁天罡称骨批语：' + D.CHENG_GU.poems[w];
  var div = document.createElement('div');
  div.className = 'yw-detail';
  div.innerHTML = '<b>' + escHtml(w) + '</b> ' + (d || '这个词有点冷门，按字面理解差不多就行～');
  div.onclick = function(ev){ ev.stopPropagation(); closeWordDetail(el); };

  // 手机端：改为底部弹层，避免内联展开把整页往下推
  var isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:640px)').matches;
  if(isMobile){
    var bd = document.createElement('div');
    bd.className = 'yw-backdrop';
    bd.onclick = function(){ closeWordDetail(el); };
    document.body.appendChild(bd);
    document.body.appendChild(div);
    el._ywSheet = div;
    el._ywBackdrop = bd;
    var slideIn = function(){ div.classList.add('show'); };
    if(window.requestAnimationFrame) window.requestAnimationFrame(slideIn); else slideIn();
  } else {
    // 桌面端：内联展开（标签内的词展开到整行，不挤在同一条 flex 里）
    var parent = el.parentElement;
    if(parent && parent.classList.contains('tag')){ parent.after(div); el._ywParent = parent; }
    else { el.after(div); }
  }
  el.classList.add('yw-open');
  var onScroll = function(){ if(el.classList.contains('yw-open')) closeWordDetail(el); };
  window.addEventListener('scroll', onScroll, {passive:true, once:true});
}
function closeWordDetail(el){
  if(!el) return;
  // 手机端底部弹层：从 body 移除（先下滑再移除，配合过渡动画）
  if(el._ywSheet){
    var sheet = el._ywSheet;
    if(el._ywBackdrop && el._ywBackdrop.parentNode) el._ywBackdrop.remove();
    sheet.classList.remove('show');
    var s = sheet;
    setTimeout(function(){ if(s.parentNode) s.remove(); }, 220);
    el._ywSheet = null;
    el._ywBackdrop = null;
  } else {
    // 桌面端：移除内联展开块
    var parent = el._ywParent || el;
    var nxt = parent.nextElementSibling;
    if(nxt && nxt.classList.contains('yw-detail')) nxt.remove();
    el._ywParent = null;
  }
  el.classList.remove('yw-open');
}

/* ================= 袁天罡称骨 ================= */
const CN2N = {'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
function parseLiang(s){
  let liang=0, qian=0;
  const m = (s||'').match(/([一二三四五六七八九])两/); if(m) liang = CN2N[m[1]];
  const q = (s||'').match(/([一二三四五六七八九])钱/); if(q) qian = CN2N[q[1]];
  return liang + qian/10;
}
function liangToCN(v){
  const CN = ['零','一','二','三','四','五','六','七','八','九','十'];
  const liang = Math.floor(v), qian = Math.round((v-liang)*10);
  return CN[liang]+'两'+(qian?CN[qian]:''); // 判词 key 格式：四两六 / 四两
}
function calcChengGu(birthLunar, hour){
  if(hour<0) return null;
  const yGz = birthLunar.getYearInGanZhi();
  const mm = birthLunar.getMonth(), dd = birthLunar.getDay();
  const hz = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'][Math.floor(hour/2)];
  const w = parseLiang(D.CHENG_GU.year[yGz]) + parseLiang(D.CHENG_GU.month[mm])
          + parseLiang(D.CHENG_GU.day[dd]) + parseLiang(D.CHENG_GU.hour[hz]);
  const cn = liangToCN(w);
  return {cn, poem: D.CHENG_GU.poems[cn] || ''};
}
// 点页面其他地方时，收起所有展开的关键词解释
document.addEventListener('click', function(e){
  if(!e.target.closest('.yw') && !e.target.closest('.yw-detail')){
    document.querySelectorAll('.yw-open').forEach(function(el){ closeWordDetail(el); });
  }
});

/* ================= 星座当日动态判断（当日五行 vs 星座元素五行） ================= */
function signDaily(todayW, signElem){
  if(!todayW || !signElem) return {rel:'', tip:'', cls:'mid-t'};
  if(todayW===signElem) return {rel:'同气比和', tip:'今天状态在线，顺着星座喜好行事', cls:'good-t'};
  if(SHENG[todayW]===signElem) return {rel:'当日生你（得助）', tip:'今天有助力，顺势而为', cls:'good-t'};
  if(KE[todayW]===signElem) return {rel:'当日克你（受压）', tip:'今天宜收敛，别硬碰硬', cls:'bad-t'};
  if(SHENG[signElem]===todayW) return {rel:'你生日（耗泄）', tip:'今天适合付出输出，别勉强自己', cls:'mid-t'};
  return {rel:'你克当日（得势）', tip:'今天你有主动权，抓住机会', cls:'good-t'};
}
/* ================= 个人化宜忌：用神修正黄历宜忌，直接给出「宜/忌」清单 ================= */
function personalYiJi(yi, ji, ys){
  if(!ys || !ys.xi.length) return {pYi:(yi||[]).slice(), pJi:(ji||[]).slice()};
  const pYi = [], pJi = [];
  // 黄历忌：五行合喜用神 → 你其实能做 → 归宜；否则 → 忌
  (ji||[]).forEach(w=>{
    const el = D.YIJI_WUXING[w];
    if(el && ys.xi.includes(el)) pYi.push(w); else pJi.push(w);
  });
  // 黄历宜：五行撞忌神 → 你最好避 → 归忌；否则 → 宜
  (yi||[]).forEach(w=>{
    const el = D.YIJI_WUXING[w];
    if(el && ys.ji.includes(el)) pJi.push(w); else pYi.push(w);
  });
  return {pYi, pJi};
}

function buildPlain(verdict, total, yi, ji, ev, sig, dressName, daYun, smallThing){
  const jx = verdict.split('·')[0].trim();
  let s = `今天整体<b>${jx}</b>（综合 ${total} 分）。`;
  // 宜做什么（宜忌词可点击释义；传空数组则 fmtWords 返回「无」，此处跳过避免空白【无】）
  const yiWords = fmtWords(yi,3);
  const yiOk = yiWords && yiWords!=='无';
  if(ev.delta>=8) s += yiOk ? `今日五行正合你的用神，做事得助——适合推进【${yiWords}】这类事。` : `今日五行正合你的用神，做事得助。`;
  else if(ev.delta<=-8) s += yiOk ? `今日五行与你相克，宜守不宜进；真要做事，可挑【${yiWords}】中轻缓的来。` : `今日五行与你相克，宜守不宜进。`;
  else s += yiOk ? `今天五行中平，按黄历【${yiWords}】行事即可。` : `今天五行中平。`;
  // 注意 + 穿衣
  const jiWords = fmtWords(ji,3);
  const jiOk = jiWords && jiWords!=='无';
  if(jiOk) s += `今天要避开【${jiWords}】${daYun?`；当前大运${colorGZ(daYun.gz)}${daYun.rel}`:''}。`;
  else if(daYun) s += `当前大运${colorGZ(daYun.gz)}${daYun.rel}。`;
  s += `穿衣宜${dressName}色系。`;
  // 一件小事（治愈向）
  if(smallThing) s += `<br>✨ 今天可以做的一件小事：<b>${smallThing}</b>`;
  return s;
}

/* ================= 地区联动选择（国→省→市→区；经纬度时区仅后台记录，不展示） ================= */
function lockRegion(lat, lng, tz){
  document.getElementById('birthLat').value = lat;
  document.getElementById('birthLng').value = lng;
  document.getElementById('birthTz').value = tz;
}
function pickCountry(){
  const c = document.getElementById('birthCountry').value;
  const cnRow = ['birthProv','birthCity','birthArea'];
  const wd = document.getElementById('birthWorldCity');
  if(c==='cn'){ cnRow.forEach(id=>document.getElementById(id).style.display=''); wd.style.display='none'; }
  else if(c==='world'){ cnRow.forEach(id=>document.getElementById(id).style.display='none'); wd.style.display=''; }
  else { cnRow.forEach(id=>document.getElementById(id).style.display=''); wd.style.display='none'; }
}
function pickProv(){
  const pIdx = document.getElementById('birthProv').value;
  const citySel = document.getElementById('birthCity'), areaSel = document.getElementById('birthArea');
  citySel.innerHTML = '<option value="">市</option>'; areaSel.innerHTML = '<option value="">区/县</option>';
  if(pIdx==='') return;
  const prov = D.CITIES_CN[parseInt(pIdx)];
  // 直辖市/特别行政区：市下拉直接列区县，隐藏「区/县」下拉
  const isMu = prov.cities.length>3 && prov.cities.every(c=>/区|县$/.test(c.c));
  areaSel.style.display = isMu ? 'none' : '';
  prov.cities.forEach((c,i)=>{ citySel.add(new Option(c.c, i)); });
}
function pickCity2(){
  const pIdx = document.getElementById('birthProv').value, cIdx = document.getElementById('birthCity').value;
  const areaSel = document.getElementById('birthArea');
  areaSel.innerHTML = '<option value="">区/县</option>';
  if(pIdx==='' || cIdx==='') return;
  const city = D.CITIES_CN[parseInt(pIdx)].cities[parseInt(cIdx)];
  if(city.areas && city.areas.length){
    city.areas.forEach((a,i)=>{ areaSel.add(new Option(a.a, i)); });
  } else {
    lockRegion(city.lat, city.lng, 8); // 无区县，直接锁市
    markDirty();
  }
}
function pickArea(){
  const pIdx = document.getElementById('birthProv').value, cIdx = document.getElementById('birthCity').value, aIdx = document.getElementById('birthArea').value;
  if(pIdx==='' || cIdx==='' || aIdx==='') return;
  const area = D.CITIES_CN[parseInt(pIdx)].cities[parseInt(cIdx)].areas[parseInt(aIdx)];
  lockRegion(area.lat, area.lng, 8);
  markDirty();
}
function pickWorldCity(){
  const idx = document.getElementById('birthWorldCity').value;
  if(idx==='') return;
  const c = D.CITIES_WORLD[parseInt(idx)];
  lockRegion(c.lat, c.lng, c.tz);
  const note = document.getElementById('exampleNote');
  note.style.display = 'block';
  note.innerHTML = deEmoji(`📍 已选：<b>${escHtml(c.c)}</b>（${escHtml(c.country)}${c.dst?'，实行夏令时（夏半年约差1小时，对星盘影响很小）':''}）。`);
  markDirty();
}
function lockCustom(lat, lng, tz){
  lockRegion(lat, lng, tz);
}
function rerollFood(targetId){
  const pool = (D.FOOD_BY_WX && D.FOOD_BY_WX[curFoodWX] && D.FOOD_BY_WX[curFoodWX].length) ? D.FOOD_BY_WX[curFoodWX] : (D.FOODS||['随便吃点']);
  const box = document.getElementById(targetId || 'foodBox');
  if(box) box.textContent = pool[Math.floor(Math.random()*pool.length)];
}
function guaSvg(down, up, moving){
  const bits = GUA8_BITS_REV[String(down)] + GUA8_BITS_REV[String(up)];
  let svg = `<svg width="52" height="96" viewBox="0 0 52 96" style="vertical-align:middle">`;
  for(let i=0;i<6;i++){
    const y = 90 - i*15;
    const yang = bits[i]==='1';
    const isMoving = (i+1)===moving;
    const color = isMoving ? '#b3402a' : '#b8860b';
    if(yang){ svg += `<rect x="2" y="${y}" width="48" height="6" rx="3" fill="${color}"/>`; }
    else { svg += `<rect x="2" y="${y}" width="21" height="6" rx="3" fill="${color}"/><rect x="29" y="${y}" width="21" height="6" rx="3" fill="${color}"/>`; }
  }
  svg += `</svg>`;
  return svg;
}
/* 当日固定卦：按日期种子确定性起卦（同一天不变），作为「今日一屏」里的今日卦 */
function dayGua(dateStr){
  let seed = 0;
  const s = dateStr || new Date().toISOString().slice(0,10);
  for(let i=0;i<s.length;i++){ seed = (seed*31 + s.charCodeAt(i)) >>> 0; }
  const up = (seed % 8) + 1;
  const down = ((seed>>3) % 8) + 1;
  const moving = ((seed>>6) % 6) + 1;
  const base = D.GUA64[String(down)+String(up)] || ['未知卦','卦象不明'];
  const guaGood = /吉|宜|利|升|成|泰|益|大有|丰|谦|复|同人/.test(base[1]);
  const guaBad = /凶|慎|忌|困|讼|蹇|剥|否|明夷|难|无妄/.test(base[1]);
  const jx = guaGood?'偏吉':guaBad?'偏谨慎':'中平';
  return `<div class="th-gua-in"><span class="th-gua-label">📿 今日卦</span> <span class="th-gua-name">${guaSvg(down,up,moving)} ${base[0]}</span> <span class="th-gua-jx ${guaGood?'good-t':guaBad?'bad-t':'mid-t'}">${jx}</span> <span class="th-gua-desc">${base[1].split('，')[0]}</span></div>`;
}


function rollGua(targetId){
  // 随机起卦：上卦/下卦/动爻 全随机（每次点击都不同，供娱乐参考）
  const up = 1+Math.floor(Math.random()*8);
  const down = 1+Math.floor(Math.random()*8);
  const moving = 1+Math.floor(Math.random()*6);
  const base = D.GUA64[String(down)+String(up)] || ['未知卦','卦象不明'];
  let nD=down, nU=up;
  if(moving<=3) nD=flipGua(down, moving); else nU=flipGua(up, moving-3);
  const bian = D.GUA64[String(nD)+String(nU)] || null;
  const g = {baseName:base[0], baseDesc:base[1], moving, down, up, nD, nU, bianName:bian?bian[0]:null, bianDesc:bian?bian[1]:null};
  const guaGood = /吉|宜|利|升|成|泰|益|大有|丰|谦|复|同人/.test(g.baseDesc);
  const guaBad = /凶|慎|忌|困|讼|蹇|剥|否|明夷|难|无妄/.test(g.baseDesc);
  const jx = guaGood?'偏吉':guaBad?'偏谨慎':'中平';
  const bianGood = /吉|宜|利|升|成|泰|益|大有|丰|谦|复|同人/.test(g.bianDesc||'');
  const bianBad = /凶|慎|忌|困|讼|蹇|剥|否|明夷|难|无妄/.test(g.bianDesc||'');
  const bianJx = bianGood?'偏吉':bianBad?'偏谨慎':'中平';
  const sim = (D.GUA_SIMPLE && D.GUA_SIMPLE[g.baseName]) ? D.GUA_SIMPLE[g.baseName] : null;
  const box = document.getElementById(targetId || 'guaBox');
  if(box) box.innerHTML = deEmoji(`
    <div class="gua-display">
      <div class="gua-box">
        <div class="g-name">${guaSvg(g.down,g.up,g.moving)} ${g.baseName}</div>
        <div class="g-jx ${guaGood?'good-t':guaBad?'bad-t':'mid-t'}">${jx}</div>
        <div class="g-desc">${g.baseDesc}</div>
        <div class="mini-detail" style="margin-top:4px">动爻：第${g.moving}爻（红色）</div>
      </div>
      ${g.bianName?`<div class="gua-arrow">➜</div>
      <div class="gua-box">
        <div class="g-name">${guaSvg(g.nD, g.nU, 0)} ${g.bianName}</div>
        <div class="g-jx ${bianGood?'good-t':bianBad?'bad-t':'mid-t'}">${bianJx}</div>
        <div class="g-desc">${g.bianDesc}</div>
        <div class="mini-detail" style="margin-top:4px">变卦（第${g.moving}爻动而变）</div>
      </div>`:''}
    </div>
    ${sim?`
    <div class="gua-simple">
      ${sim.yj?`<div class="gs-row"><span class="gs-k">意境</span><span class="gs-v">${sim.yj}</span></div>`:''}
      ${sim.sx?`<div class="gs-row"><span class="gs-k">属性</span><span class="gs-v">${sim.sx}</span></div>`:''}
      ${sim.aq?`<div class="gs-row"><span class="gs-k">爱情</span><span class="gs-v">${sim.aq}</span></div>`:''}
      ${sim.sy?`<div class="gs-row"><span class="gs-k">事业</span><span class="gs-v">${sim.sy}</span></div>`:''}
      ${sim.xw?`<div class="gs-row"><span class="gs-k">寻物</span><span class="gs-v">${sim.xw}</span></div>`:''}
    </div>`:`<div class="mini-detail" style="margin-top:8px">（这卦太冷门了，还没写解释，全靠自己悟 🙏）</div>`}
    <div class="mini-detail" style="margin-top:8px">⚡ 本次为<b>随机起卦</b>（每点一次都不一样，纯娱乐参考）。</div>`);
  const btn = document.getElementById((targetId==='introGuaBox')?'introRollBtn':'funRollBtn');
  if(btn) btn.textContent = '🎲 再起一卦';
}
/* 清空起卦结果 */
function clearGua(boxId, btnId){
  const box=document.getElementById(boxId);
  const btn=document.getElementById(btnId);
  if(box){ box.innerHTML='<div class="gua-empty" style="text-align:center;font-size:13px;color:var(--sub)">点上方按钮，起一卦看看今日玄机 ☯</div>'; }
  if(btn) btn.textContent='🎲 起一卦';
}

/* ============ 首屏预览：今日黄历 + 今日吃什么 + 起卦（不填出生信息也能看） ============ */
function renderHomePeek(){
  const box = document.getElementById('introCards');
  if(!box) return;
  try{
    const t = new Date();
    const solar = Solar.fromDate(t);
    const L = solar.getLunar();
    const lunarStr = L.toString();
    const baziArr = L.getEightChar().toString().trim().split(/\s+/).filter(Boolean);
    const baziStr = baziArr.length===4 ? `年 ${baziArr[0]}　月 ${baziArr[1]}　日 ${baziArr[2]}　时 ${baziArr[3]}` : baziArr.join(' ');
    const shengXiao = L.getYearShengXiao();
    const sign = getSign(solar.getMonth(), solar.getDay());
    const sig = D.SIGNS[sign];
    const yi = L.getDayYi(); const ji = L.getDayJi();
    const todayW = GAN[L.getDayGan()];
    const todayC = D.WUXING_COLORS[todayW];
    const todayStr = solar.toYmd()+' '+solar.getWeekInChinese();
    // 综合分（仅黄历，无八字个性化）
    let huali = 60 + yi.length*2 - ji.length*4; huali = Math.max(10, Math.min(95, huali));
    const total = Math.round(huali);
    let verdict='', vClass='mid';
    if(total>=75){verdict='大吉 · 顺势而为，宜行动';vClass='good';}
    else if(total>=60){verdict='中吉 · 平稳推进，抓重点';vClass='mid';}
    else if(total>=45){verdict='小凶 · 宜守不宜攻';vClass='mid';}
    else {verdict='凶 · 谨慎行事，宜静不宜动';vClass='bad';}
    const smallThing = D.SMALL_THINGS[Math.floor(Math.random()*D.SMALL_THINGS.length)];
    // 首屏解读：下面已有「综合分+吉凶」「宜/忌两行」「幸运色」，故只保留「今天做的一件小事」，避免重复
    const plain = smallThing ? `✨ 今天可以做的一件小事：<b>${smallThing}</b>` : '';
    // 综合分算法说明（点击弹窗用）
    const yiN = yi.length, jiN = ji.length;
    const rawH = 60 + yiN*2 - jiN*4;
    const clampedH = Math.max(10, Math.min(95, rawH));
    const scoreHomeWhy = `基础分 60，每一条「宜」+2、每一条「忌」−4，再夹在 10~95 之间。<br>今日宜 ${yiN} 条、忌 ${jiN} 条 → 60 + ${yiN}×2 − ${jiN}×4 = ${rawH}，夹到 ${clampedH}，四舍五入得 <b>${total}</b> 分。`;
    const dressHtml = `<div class="kv"><div><b>今日（${todayW}日）幸运色：</b>${todayC.name} ${todayC.colors.map(c=>`<span class="color-chip" style="background:${c}"></span>`).join('')}</div></div>`;
    curFoodWX = todayW;
    box.innerHTML = deEmoji(`
      <div class="card today-hero">
        <h2>📅 今日黄历</h2>
        <div class="bazi-line">今日八字　${baziStr}</div>
        <div class="lunar-line hl">${lunarStr} · ${shengXiao}年 · ${sign}座</div>
        <div class="th-top">
          <div class="th-score" data-title="今日黄历 · 综合分怎么算" data-body="${escHtml(scoreHomeWhy)}" onclick="showScoreInfo(this)" role="button" title="点击查看打分规则"><div class="th-num">${total}</div><div class="th-unit">综合分</div></div>
          <div class="th-main">
            <div class="th-verdict ${vClass}">${verdict}</div>
            <div class="th-date">${todayStr}</div>
          </div>
        </div>
        <div class="th-yi"><span class="th-yj-lab y">宜</span>${fmtWords(yi,3)}</div>
        <div class="th-ji"><span class="th-yj-lab n">忌</span>${fmtWords(ji,3)}</div>
        <div class="th-row"><span class="th-label">幸运色</span>${dressHtml}</div>
        <div class="th-plain">${plain}</div>
      </div>
    `);
  }catch(err){
    box.innerHTML = `<div class="card"><div class="ph-title">今日内容加载失败</div><div class="ph-sub">${escHtml(err && err.message || err)}</div></div>`;
  }
}

/* 正文页：今天想吃什么 + 随机音乐（并排）+ 起一卦（下方单独行） */
function renderFunCards(){
  const box = document.getElementById('funCards');
  if(!box) return;
  const foodWX = curFoodWX || '火';
  const foodPool = (D.FOOD_BY_WX && D.FOOD_BY_WX[foodWX] && D.FOOD_BY_WX[foodWX].length) ? D.FOOD_BY_WX[foodWX] : (D.FOODS||['随便吃点']);
  const todayFood = foodPool[Math.floor(Math.random()*foodPool.length)];
  const foodTip = (D.FOOD_WX_TIP && D.FOOD_WX_TIP[foodWX]) ? `（今日五行喜【${foodWX}】——${D.FOOD_WX_TIP[foodWX]}）` : '';
  const musicPool = (D.MUSIC_BY_WX && D.MUSIC_BY_WX[foodWX] && D.MUSIC_BY_WX[foodWX].length) ? D.MUSIC_BY_WX[foodWX] : (D.MUSIC_BY_WX&&D.MUSIC_BY_WX.default||['随心听']);
  const todayMusic = musicPool[Math.floor(Math.random()*musicPool.length)];
  const musicParts = todayMusic.split('，');
  const musicStyle = musicParts[0]||'随心听';
  const musicDesc = musicParts[1]||'';
  const musicTip = (D.MUSIC_WX_TIP && D.MUSIC_WX_TIP[foodWX]) ? `（${D.MUSIC_WX_TIP[foodWX]}）` : '';
  box.innerHTML = deEmoji(`
    <div class="cards-row" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px">
      <div class="card" style="flex:1;min-width:200px;border-left:3px solid var(--accent)">
        <h2>🍜 今天想吃什么</h2>
        <div class="plain-text" id="funFoodBox" style="font-size:18px;text-align:center;padding:10px;font-weight:600;color:var(--ink)">${todayFood}</div>
        <div class="mini-detail" style="text-align:center;margin-top:2px">${foodTip}</div>
        <div style="text-align:center;margin-top:8px"><button class="btn btn-ghost" onclick="rerollFood('funFoodBox')" style="font-size:12px">🎲 换一个</button></div>
      </div>
      <div class="card" style="flex:1;min-width:200px">
        <h2>🎵 今天想听什么</h2>
        <div id="funMusicBox" style="text-align:center;padding:10px">
          <div style="font-size:18px;font-weight:700;color:var(--ink);line-height:1.4;margin-bottom:4px">${escHtml(musicStyle)}</div>
          <div style="font-size:13px;color:var(--sub);line-height:1.6">${escHtml(musicDesc)}</div>
        </div>
        <div class="mini-detail" style="text-align:center;margin-top:2px">${musicTip}</div>
        <div style="text-align:center;margin-top:8px"><button class="btn btn-ghost" onclick="rerollMusic('funMusicBox')" style="font-size:12px">🎲 换一个</button></div>
      </div>
    </div>
    <div class="card" style="border-left:3px solid var(--wx-${foodWX})">
      <h2>📿 起一卦</h2>
      <p class="mini-detail">随机起卦，看<b>意境</b>与<b>属性</b>，给爱情/事业/寻物一句小提示（纯娱乐，别较真）。</p>
      <div style="text-align:center;margin:6px 0">
        <button class="btn" id="funRollBtn" onclick="rollGua('funGuaBox')" style="font-size:13px">🎲 起一卦</button>
        <button class="btn btn-clear" onclick="clearGua('funGuaBox','funRollBtn')" style="font-size:13px;padding:7px 14px;margin-left:6px">清空</button>
      </div>
      <div id="funGuaBox" class="gua-empty" style="text-align:center;font-size:13px;color:var(--sub)">点上方按钮，起一卦看看今日玄机 ☯</div>
    </div>
  `);
  box.style.display = '';
}

/* 换一首音乐推荐 */
function rerollMusic(boxId){
  const box = document.getElementById(boxId);
  if(!box) return;
  const wx = curFoodWX || '火';
  const pool = (D.MUSIC_BY_WX && D.MUSIC_BY_WX[wx] && D.MUSIC_BY_WX[wx].length) ? D.MUSIC_BY_WX[wx] : (D.MUSIC_BY_WX&&D.MUSIC_BY_WX.default||['随心听']);
  const s = pool[Math.floor(Math.random()*pool.length)];
  const parts = s.split('，');
  box.innerHTML = `<div style="font-size:18px;font-weight:700;color:var(--ink);line-height:1.4;margin-bottom:4px">${escHtml(parts[0]||'随心听')}</div><div style="font-size:13px;color:var(--sub);line-height:1.6">${escHtml(parts[1]||'')}</div>`;
}

/* ============ 推算触发：填信息 → 点按钮才算 ============ */
let hasRun = false;      // 是否已经推算过
let curFoodWX = null;    // 当前「今天想吃什么」所选五行（reroll 沿用）
let dirty  = false;      // 表单改过但还没重算
let currentTab = 'today';// 当前显示的 Tab

/* Tab 切换：切换 active + 卡片交错淡入（适中动画） */
function switchTab(name){
  currentTab = name;
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.dataset.tab===name));
  document.querySelectorAll('.tab-btn').forEach(b=>{ b.classList.toggle('active', b.dataset.tab===name); });
  const panel = [...document.querySelectorAll('.tab-panel')].find(p=>p.dataset.tab===name);
  if(panel){
    panel.querySelectorAll('.card').forEach((c,i)=>{
      c.style.animation = 'none'; void c.offsetWidth;   // 重置动画
      c.style.animation = `fadeUp .5s ${i*70}ms cubic-bezier(.2,0,0,1) both`;
    });
  }
}

function showPlaceholder(savedInfo){
  hasRun = false;
  const goBtn = document.getElementById('goBtn');
  if(goBtn){ goBtn.innerHTML = icon('ming')+'开始推算'; goBtn.classList.remove('rerun'); }
  const dt = document.getElementById('dirtyTip'); if(dt) dt.style.display='none';
  const __P = `
  <div class="ph fade-in">
    <div class="ph-icon">☯</div>
    <div class="ph-title">填好上面的信息，点【🔮 开始推算】</div>
    <div class="ph-sub">
      不点按钮不会自动算——你可以慢慢挑年月日、时辰、出生地，全部选完再一次性出结果。<br>
      时辰不记得也能算；不填出生信息也可以只看当天黄历。
    </div>
    <div class="ph-steps">
      <span class="ph-step">① 出生年月日时</span>
      <span class="ph-step">② 性别</span>
      <span class="ph-step">③ 出生地（国→省→市→区）</span>
      <span class="ph-step">④ 推算日期</span>
      <span class="ph-step">⑤ 点开始推算</span>
    </div>
    ${savedInfo?`<div><div class="ph-saved">💾 已恢复你上次填的信息：${savedInfo} —— 直接点【开始推算】即可</div></div>`:''}
  </div>`;
  document.getElementById('app').innerHTML = deEmoji(__P);
}

// 表单变动：只提示，不自动推算
function markDirty(){
  saveBirth();
  if(!hasRun) return;              // 还没算过 → 保持占位引导，不打扰
  dirty = true;
  const dt = document.getElementById('dirtyTip');
  if(dt){ dt.style.display='block'; dt.innerHTML = deEmoji('✏️ 信息已修改，点【🔄 重新推算】刷新结果。'); }
  const goBtn = document.getElementById('goBtn');
  if(goBtn){ goBtn.innerHTML = icon('refresh')+'重新推算'; goBtn.classList.add('rerun'); }
}

function runCalc(){
  saveBirth();
  const goBtn = document.getElementById('goBtn');
  const y = parseInt(document.getElementById('birthYear').value)||0;
  const m = parseInt(document.getElementById('birthMonth').value)||0;
  const d = parseInt(document.getElementById('birthDay').value)||0;
  // 年月日不齐 → 提醒（仍可只看黄历）
  if(y>1900 && (!m || !d)){
    const dt = document.getElementById('dirtyTip');
    dt.style.display='block';
    dt.innerHTML = deEmoji('⚠️ 出生「月」或「日」还没选，八字/星盘算不准。请补全后再点推算（或点【清空】只看当天黄历）。');
    return;
  }
  document.getElementById('dirtyTip').style.display='none';
  if(goBtn){ goBtn.disabled = true; goBtn.textContent = '推算中…'; }
  document.getElementById('app').innerHTML =
    deEmoji(`<div class="ph calc"><div class="cd">☯</div><div class="ct">正在排盘：八字 · 用神 · 星盘 · 黄历 · 卦象…</div></div>`);
  setTimeout(()=>{
    currentTab = 'today';   // 重算后回到最上面第一个 Tab（我的今日），而非停留在命盘/星盘
    hasRun = true; dirty = false;   // 先置「已推算」标记，render 才会渲染常驻的 rerun 入口（改信息/换个日期再算）
    try{ render(); }catch(err){
      document.getElementById('app').innerHTML =
        deEmoji(`<div class="ph"><div class="ph-icon">⚠️</div><div class="ph-title">推算出错了</div><div class="ph-sub">${escHtml(err && err.message || err)}</div></div>`);
    }
    const app = document.getElementById('app');
    app.classList.remove('fade-in'); void app.offsetWidth; app.classList.add('fade-in');
    if(goBtn){ goBtn.disabled = false; goBtn.innerHTML = icon('refresh')+'重新推算'; goBtn.classList.add('rerun'); }
    // 重算后稳稳滚回结果区最上面（#app 顶），扣除 sticky topbar + tabs 高度避免遮挡
    const stickyH = 110; // topbar ~60px + tabs ~50px
    window.scrollTo({top: Math.max(0, window.scrollY + app.getBoundingClientRect().top - stickyH), behavior:'smooth'});
  }, 420);
}

/* ================= 表单工具 ================= */
function fillExample(){
  const c = D.CELEBS[Math.floor(Math.random()*D.CELEBS.length)];
  document.getElementById('birthYear').value = c.y;
  document.getElementById('birthMonth').value = c.m;
  document.getElementById('birthDay').value = c.d;
  document.getElementById('birthHour').value = c.h==null ? '' : c.h;
  document.getElementById('birthGender').value = c.gender;
  lockCustom(c.lat, c.lng, c.tz);
  // 地区恢复到「可手动编辑」状态：重建省列表，清空市/区，保留名人经纬度用于推算
  const provSel = document.getElementById('birthProv');
  provSel.innerHTML = '<option value="">省</option>';
  D.CITIES_CN.forEach((p,i)=>{ provSel.add(new Option(p.p, i)); });
  document.getElementById('birthCity').innerHTML = '<option value="">市</option>';
  document.getElementById('birthArea').innerHTML = '<option value="">区/县</option>';
  document.getElementById('birthArea').style.display = '';
  document.getElementById('birthCountry').value = '';
  document.getElementById('birthWorldCity').value = '';
  pickCountry();   // 同步显示：显示省/市/区，隐藏全球城市
  const note = document.getElementById('exampleNote');
  note.style.display = 'block';
  note.innerHTML = deEmoji(`🎲 已填入示例：<b>${escHtml(c.name)}</b>（${escHtml(c.note)}，${c.y}-${c.m}-${c.d} 生于 ${c.tz>0?'+':''}${c.tz} 时区）。公开资料多无精确出生时辰，已按「时辰未知」处理（星盘/大运会降级并提示）。`);
  saveBirth();
  if(hasRun){ markDirty(); } else { note.innerHTML += ' 点【开始推算】看结果。'; }
}
function clearBirth(){
  ['birthYear','birthMonth','birthDay','birthHour','birthGender','birthCountry','birthLat','birthLng','birthTz'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('birthTz').value = 8;
  // 重建省/全球城市列表（不能真清空选项，否则之后无法手动选地区）
  const provSel = document.getElementById('birthProv');
  provSel.innerHTML = '<option value="">省</option>';
  D.CITIES_CN.forEach((p,i)=>{ provSel.add(new Option(p.p, i)); });
  document.getElementById('birthCity').innerHTML = '<option value="">市</option>';
  document.getElementById('birthArea').innerHTML = '<option value="">区/县</option>';
  document.getElementById('birthArea').style.display = '';
  const wcSel = document.getElementById('birthWorldCity');
  wcSel.innerHTML = '<option value="">选择城市</option>';
  D.CITIES_WORLD.forEach((c,i)=>{ wcSel.add(new Option(c.c+' · '+c.country, i)); });
  wcSel.value = '';
  pickCountry();
  document.getElementById('exampleNote').style.display = 'none';
  localStorage.removeItem('zlhy_birth_v3');
  showPlaceholder(null);
}
function saveBirth(){
  const v = {
    y: document.getElementById('birthYear').value,
    m: document.getElementById('birthMonth').value,
    d: document.getElementById('birthDay').value,
    h: document.getElementById('birthHour').value,
    g: document.getElementById('birthGender').value,
    lat: document.getElementById('birthLat').value,
    lng: document.getElementById('birthLng').value,
    tz: document.getElementById('birthTz').value,
    country: document.getElementById('birthCountry').value,
    prov: document.getElementById('birthProv').value,
    city: document.getElementById('birthCity').value,
    area: document.getElementById('birthArea').value,
    wcity: document.getElementById('birthWorldCity').value
  };
  try{ localStorage.setItem('zlhy_birth_v3', JSON.stringify(v)); }catch(e){}
}

/* ========== 初始化 ========== */
(function init(){
  // 每次页面加载强制清空 #app，防止浏览器缓存残留旧渲染内容
  const appEl = document.getElementById('app'); if(appEl) appEl.innerHTML = '';
  // 把带 data-icon 的静态元素（Tab / 表单摘要 / 示例按钮）注入定制线条图标
  document.querySelectorAll('[data-icon]').forEach(el=>{
    const n=el.getAttribute('data-icon');
    if(n) el.insertAdjacentHTML('afterbegin', icon(n));
  });
  const ySel=document.getElementById('birthYear');
  ySel.add(new Option('年',''));
  for(let i=2026;i>=1930;i--){ ySel.add(new Option(i+'年',i)); }
  const mSel=document.getElementById('birthMonth');
  mSel.add(new Option('月',''));
  for(let i=1;i<=12;i++){ mSel.add(new Option(i+'月',i)); }
  const dSel=document.getElementById('birthDay');
  dSel.add(new Option('日',''));
  for(let i=1;i<=31;i++){ dSel.add(new Option(i+'日',i)); }
  // 省下拉（中国三级联动）
  const provSel=document.getElementById('birthProv');
  provSel.innerHTML='<option value="">省</option>';
  D.CITIES_CN.forEach((p,i)=>{ provSel.add(new Option(p.p, i)); });
  // 全球城市下拉
  const wcSel=document.getElementById('birthWorldCity');
  wcSel.innerHTML='<option value="">选择城市</option>';
  D.CITIES_WORLD.forEach((c,i)=>{ wcSel.add(new Option(c.c+' · '+c.country, i)); });
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem('zlhy_birth_v3')||'null'); }catch(e){}
  if(saved && saved.y){ ySel.value=saved.y; mSel.value=saved.m; dSel.value=saved.d;
    document.getElementById('birthHour').value=saved.h||'';
    document.getElementById('birthGender').value=saved.g||'';
    if(saved.lat){ document.getElementById('birthLat').value=saved.lat;
      document.getElementById('birthLng').value=saved.lng||'';
      document.getElementById('birthTz').value=saved.tz||8; }
    if(saved.country){ document.getElementById('birthCountry').value=saved.country; pickCountry(); }
    if(saved.country==='cn' && saved.prov){ provSel.value=saved.prov; pickProv();
      if(saved.city){ document.getElementById('birthCity').value=saved.city; pickCity2(); }
      if(saved.city && saved.area){ document.getElementById('birthArea').value=saved.area; pickArea(); }
    }
    if(saved.country==='world' && saved.wcity){ document.getElementById('birthWorldCity').value=saved.wcity; pickWorldCity(); }
  }
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  fillDtNow();   // 推算时刻选择器默认今天此刻
  // 首屏三卡：今日黄历 + 今日吃什么 + 起卦（不填出生信息也能看，进入 main 前先渲染）
  try{ renderHomePeek(); }catch(e){}
  const v2=document.getElementById('ver2'); if(v2) v2.textContent = (D.VERSION||'').split(' · ')[0];

  // 出生信息表单：默认展开；点击 summary 平滑收起/展开（动画由 .collapsed 类驱动，不依赖 details[open] 原生显隐）
  const fd=document.getElementById('formDetails');
  if(fd){
    fd.open = true; // 始终 open，避免原生 <details> 直接 display:none 导致动画失效
    const sum = fd.querySelector('summary');
    const hint = sum ? sum.querySelector('.mini-detail') : null;
    if(sum){
      sum.addEventListener('click', e=>{
        e.preventDefault(); // 阻止原生 toggle，改用 class 驱动动画
        const collapsed = fd.classList.toggle('collapsed');
        if(hint) hint.textContent = collapsed ? '点击展开' : '点击收起';
      });
    }
  }
  try{
    const t=new Date();
    const sl=Solar.fromDate(t).getLunar();
    const td=document.getElementById('topDate');
    if(td) td.textContent = `${t.getMonth()+1}月${t.getDate()}日 · 农历${sl.getMonthInChinese()}月${sl.getDayInChinese()}`;
  }catch(e){}

  // 出生信息变动 → 只记录/提示，不自动重算
  ['birthYear','birthMonth','birthDay','birthHour','birthGender','birthCountry',
   'birthProv','birthCity','birthArea','birthWorldCity']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.addEventListener('change', markDirty); });
  // 推算时刻选择器变动 → 正文内即时刷新（不用再点「开始推算」）
  ['selYear','selMonth','selDay','selHour','selMin','chkUnknown'].forEach(id=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('change', onDtChange);
  });
  // 回车 = 开始推算（仅正文页内）
  document.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const m=document.getElementById('main'); if(m && !m.classList.contains('hidden')) runCalc(); } });

  // 首屏（.intro）是产品落地页，每次打开都先展示；点击标题「查了个查」后才进入正文

  // ===== 版本更新检测 =====
  // 每 10 分钟检测一次服务器上 version.txt，发现新版本就显示刷新提示
  const CUR_VER = (D.VERSION||'').split(' · ')[0];
  const upBanner = document.getElementById('updateBanner');
  const upVerText = document.getElementById('updateVerText');
  const upIcon = document.getElementById('updateIcon');
  if(upIcon) upIcon.innerHTML = icon('refresh',16);
  function checkUpdate(){
    fetch('version.txt?'+Date.now(), {cache:'no-store'})
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(txt => {
        const v = txt.trim();
        if(v && v !== CUR_VER && upBanner && upVerText){
          upVerText.textContent = v;
          upBanner.classList.remove('hidden');
        }
      })
      .catch(() => {}); // 网络不通：静默，不影响使用
  }
  setTimeout(() => { try{checkUpdate()}catch(e){}; setInterval(()=>{try{checkUpdate()}catch(e){}}, 600000); }, 5000);
})();

/* ========== 星座日运引擎（celestine.js 真实天象 + 模板拼接） ========== */
const EN_SIGN_LIST = ['白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手','摩羯','水瓶','双鱼'];
const EN_SIGN_MAP = {Aries:'白羊',Taurus:'金牛',Gemini:'双子',Cancer:'巨蟹',Leo:'狮子',Virgo:'处女',Libra:'天秤',Scorpio:'天蝎',Sagittarius:'射手',Capricorn:'摩羯',Aquarius:'水瓶',Pisces:'双鱼'};

function getCurrentPlanets(){
  if(typeof Celestine === 'undefined') return null;
  const now = new Date();
  try{
    const chart = Celestine.calculateChart({
      year:now.getFullYear(), month:now.getMonth()+1, day:now.getDate(),
      hour:12, minute:0, second:0, timezone:8,
      latitude:30.67, longitude:104.06
    });
    const planets = {};
    (chart.planets||[]).forEach(p=>{
      const mm = (p.formatted||'').match(/([A-Z][a-z]+)$/);
      if(mm) planets[p.name] = EN_SIGN_MAP[mm[1]] || mm[1];
    });
    return planets;
  }catch(e){ return null; }
}

function renderHoroscope(userSign){
  const planets = getCurrentPlanets();
  if(!planets || !D.HOROSCOPE_PLANET_THEMES) return '';

  const themes = D.HOROSCOPE_PLANET_THEMES;
  const structure = D.HOROSCOPE_STRUCTURE || [];
  const opener = D.HOROSCOPE_OPENER || ['今日星象，'];

  // 对每个段落，挑一颗跟用户星座相关的行星来生成
  let html = '';
  html += `<div class="horoscope" style="font-size:14px;line-height:2.1">`;

  structure.forEach((sec, idx) => {
    // 从pool里选一颗行星，优先选落入用户星座的
    let picked = null, pickedPlanet = null;
    for(const pn of sec.pool){
      const t = themes[pn];
      if(!t) continue;
      // 检查这颗行星是否落入用户星座
      const inSign = planets[pn];
      if(inSign === userSign){
        picked = t.themes[userSign];
        pickedPlanet = pn;
        break;
      }
    }
    // 如果没找到落入的，就用落入的第一个pool行星的文案
    if(!picked){
      for(const pn of sec.pool){
        const t = themes[pn];
        if(!t) continue;
        const inSign = planets[pn];
        if(inSign && t.themes[inSign]){
          picked = t.themes[inSign];
          pickedPlanet = pn;
          break;
        }
      }
    }
    // 兜底：随机取
    if(!picked){
      const t = themes[sec.pool[0]];
      if(t){
        const keys = Object.keys(t.themes);
        picked = t.themes[keys[Math.floor(Math.random()*keys.length)]];
      }
    }

    if(picked){
      const label = sec.para;
      html += `<div style="margin-bottom:6px"><b>${label}</b>：${picked}</div>`;
    }
  });

  // 加一个当前天象速览
  const majorPlanets = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
  const transits = majorPlanets.filter(p=>planets[p]).map(p=>{
    const cn = {Sun:'太阳',Moon:'月亮',Mercury:'水星',Venus:'金星',Mars:'火星',Jupiter:'木星',Saturn:'土星'}[p]||p;
    return `${cn}在${planets[p]}座`;
  }).join('，');
  html += `<div class="mini-detail" style="margin-top:8px;border-top:1px dashed var(--line);padding-top:6px">📍 今日天象：${transits}</div>`;
  html += `</div>`;
  return html;
}

/* 切换运势时间尺度 */
let currentHsPeriod = null;
function switchHoroscopePeriod(period, sign){
  const extra = document.getElementById('hsExtra');
  if(!extra) return;

  // 点击已激活的标签 → 收起 extra（toggle），回到只看今日运
  if(currentHsPeriod === period){
    currentHsPeriod = null;
    document.querySelectorAll('[data-hs]').forEach(b=>b.classList.remove('active'));
    extra.innerHTML = '';
    return;
  }

  const dataMap = {
    week: D.HOROSCOPE_WEEKLY,
    month: D.HOROSCOPE_MONTHLY,
    year: D.HOROSCOPE_YEARLY
  };
  const pool = dataMap[period];
  if(!pool || !pool[sign]) return;

  currentHsPeriod = period;
  document.querySelectorAll('[data-hs]').forEach(b=>b.classList.toggle('active', b.dataset.hs===period));
  const d = pool[sign];
  let html = '<div class="horoscope" style="font-size:14px;line-height:2.1;margin-top:8px;border-top:1px dashed var(--line);padding-top:10px">';
  if(d.overview) html += `<div style="margin-bottom:8px"><b>📌 概览</b>：${d.overview}</div>`;
  if(d.love) html += `<div style="margin-bottom:6px"><b>💕 感情</b>：${d.love}</div>`;
  if(d.work) html += `<div style="margin-bottom:6px"><b>💼 工作/学业</b>：${d.work}</div>`;
  if(d.money) html += `<div style="margin-bottom:6px"><b>💰 财运</b>：${d.money}</div>`;
  if(d.tip) html += `<div class="mini-detail" style="margin-top:6px;padding-top:6px">💡 ${d.tip}</div>`;
  html += '</div>';
  extra.innerHTML = html;
  // 与星盘/Tab 一致的淡入，消除「瞬切」的生硬感（复用现有 .fade-in / fadeUp）
  extra.classList.remove('fade-in'); void extra.offsetWidth; extra.classList.add('fade-in');
}

/* ========== 首页 ↔ 正文 切换 ========== */
function enterApp(){
  const intro=document.getElementById('intro');
  const main=document.getElementById('main');
  if(intro) intro.classList.add('hide');
  if(main){
    main.classList.remove('hidden');
    main.setAttribute('aria-hidden','false');
    main.classList.remove('fade-in-soft'); void main.offsetWidth; main.classList.add('fade-in-soft');
  }
  window.scrollTo({top:0,behavior:'auto'});
  setTimeout(()=>{ if(intro) intro.style.display='none'; }, 520);
  // 进正文：推算时刻选择器已在页面加载时默认今天此刻，这里仅在尚未初始化时兜底填充
  if(!document.getElementById('selYear').options.length) fillDtNow();
  try{ renderFunCards(); }catch(e){}
  let saved=null;
  try{ saved=JSON.parse(localStorage.getItem('zlhy_birth_v3')||'null'); }catch(e){}
  // 出生表单默认收起（首页以内容为主，想推算再展开）；有存档则展开
  const fd=document.getElementById('formDetails'); if(fd){ fd.open=true; fd.classList.remove('collapsed'); } // 进入正文：表单始终展开，用户自行点收起
  if(saved && saved.y){ runCalc(); }                                  // 有存档：直接进入个人排盘
  else { try{ render(); }catch(err){ showPlaceholder(null); } }       // 无存档：首页即出今日黄历+起卦+今日吃什么（无需推算）
}
/* 综合分说明弹窗 */
function showScoreInfo(title, body){
  if(title && title.getBoundingClientRect){            // 元素模式：动态值改走 data-* 属性，避免拼进 onclick 的 JS 字符串（防属性/JS 注入）
    const el = title;
    title = el.getAttribute('data-title') || '综合分说明';
    body  = el.getAttribute('data-body') || '';
  }
  const m=document.getElementById('scoreModal');
  if(!m) return;
  document.getElementById('scoreModalTitle').innerHTML=title||'综合分说明';
  document.getElementById('scoreModalBody').innerHTML=body||'';
  m.classList.add('show');
}
function hideScoreInfo(){
  const m=document.getElementById('scoreModal');
  if(m) m.classList.remove('show');
}
document.addEventListener('keydown', function(e){
  if(e.key==='Escape'){ const m=document.getElementById('scoreModal'); if(m&&m.classList.contains('show')) hideScoreInfo(); }
});
function enterIntro(){
  const intro=document.getElementById('intro');
  const main=document.getElementById('main');
  if(main){ main.classList.add('hidden'); main.setAttribute('aria-hidden','true'); }
  if(intro){ intro.style.display='flex'; void intro.offsetWidth; intro.classList.remove('hide'); }
  window.scrollTo({top:0,behavior:'auto'});
}

/* ========== 分享功能 ========== */
const SHARE_URL = 'https://chalegecha.pages.dev';
// 页面加载时预加载二维码图片
(function(){
  const img = document.getElementById('qrImg');
  if(img) img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(SHARE_URL)}`;
})();

function copyShareUrl(){
  const el = document.getElementById('shareCopied');
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(SHARE_URL).then(()=>{
      if(el){ el.classList.remove('hidden'); setTimeout(()=>el.classList.add('hidden'), 2000); }
    }).catch(()=>{ fallbackCopy(); });
  } else { fallbackCopy(); }
}
function fallbackCopy(){
  const ta = document.createElement('textarea');
  ta.value = SHARE_URL; ta.style.position='fixed'; ta.style.opacity='0';
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); const el=document.getElementById('shareCopied'); if(el){el.classList.remove('hidden');setTimeout(()=>el.classList.add('hidden'),2000);} }catch(e){}
  document.body.removeChild(ta);
}
function toggleQR(){
  const wrap = document.getElementById('qrWrap');
  if(!wrap) return;
  wrap.classList.toggle('hidden');
}
