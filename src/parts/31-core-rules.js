/* ══ 데이터 ══ */
// id 는 곧 SVG 심볼 이름이다 (#s-<id>-<실루엣 단계>). 이모지 아이콘은 없다.
const PARTS=[
  {id:'weapon',nm:'무기'},{id:'head',nm:'모자'},
  {id:'body',nm:'상의'},{id:'legs',nm:'하의'},
  {id:'hands',nm:'장갑'},{id:'feet',nm:'신발'}];
const GC=['','var(--g1)','var(--g2)','var(--g3)','var(--g4)','var(--g5)',
  'var(--g6)','var(--g7)','var(--g8)','var(--g9)','var(--g10)',
  'var(--g11)','var(--g12)','var(--g13)','var(--g14)','var(--g15)'];
const GMAX=15;
// 승천해도 등급 상한 곡선은 매번 똑같이 5등급부터. 오르는 건 장비 기본 수치와 릴 개수뿐.
const cap=()=>Math.min(GMAX,5+Math.floor(S.lv/2));
const capLvMax=()=>(GMAX-5)*2;                        // 상한이 다 열리는 제련 등급 = 20
const nextCapAt=()=>(Math.floor(S.lv/2)+1)*2;
const REELS=()=>Math.min(5,3+S.star);
/* 051 §2② — 천장을 **피버로 대체**한다. 문턱은 옛 천장과 같은 값에서 출발하지만
   채우는 쪽이 바뀌었다: 돌린 횟수가 아니라 **손 판정**이다(`feverAdd`).
   ⚠ 값이 아니라 **뜻**이 바뀐 것이다 — `S.pity` 는 이제 피버 게이지다(새 필드 0개). */
const FEVER_MAX=()=>20*REELS();   // 게이지 상한 (051 §5 로 정한 시작점)
const FEVER_MS=15000;             // 피버 길이
const FEVER_FILL={perfect:3, great:2, good:1, miss:0};
const feverOn=()=>Date.now()<(S.feverUntil||0);
const feverLeft=()=>Math.max(0,(S.feverUntil||0)-Date.now());
/* VIEW 의 박자 판정이 손 탭마다 부르는 **유일한 입구**(051 §2②).
   견습생 타격은 이 길을 지나지 않는다 — 그래서 자동은 게이지를 못 채운다(검사 F1).
   피버 중에는 안 채운다(겹치지 않게). 돌려주는 값은 채운 뒤의 게이지다. */
function feverAdd(grade){
  if(feverOn()) return S.pity|0;
  const add=FEVER_FILL[grade]||0;
  if(!add) return S.pity|0;
  S.pity=Math.min(FEVER_MAX(), (S.pity|0)+add);
  return S.pity;
}
const starMul=()=>Math.pow(4,S.star);
const optMul=()=>1+S.star*0.6;      // 별마다 옵션 수치 상한이 오른다
// 대기창은 제련 7단계마다, 승천마다 1칸씩 늘어난다.
const qmax=()=>10+Math.floor(S.lv/7)+S.star;
const ASC_LV=()=>capLvMax()+8;                        // 승천 가능 제련 등급 = 28
// 승천의 실질 관문은 웨이브다. 별마다 12씩 오른다 — 승천 보상(x4 = 약 +12웨이브)보다
// 낮게 잡아야 별이 쌓여도 영영 막히지 않는다.
const ASC_WAVE=()=>100+S.star*12;
const lines=g=>g<=2?1:g<=6?2:g<=10?3:4;

// 9등급 이상만 붙는 각인. tick 에서 한 줄로 처리되는 것만 넣음.
const SP={
  exec:{nm:'처형',   d:'적 체력 25% 이하에 피해 ×1.8'},
  rage:{nm:'광폭',   d:'내 체력 50% 이하에 피해 ×1.5'},
  regen:{nm:'재생',  d:'초당 최대 체력 2% 회복'},
  pierce:{nm:'관통', d:'맞지 않는 피해 옵션도 절반 적용'}};
const SPKEYS=Object.keys(SP);

// cap = 1강화당 최대 수치(%). axis: dps/sur/eco
const OPT={
  crit  :{nm:'치명타 확률',cap:2.4,axis:'dps'},
  cdmg  :{nm:'치명타 피해',cap:9.0,axis:'dps'},
  aspd  :{nm:'공격 속도',  cap:3.2,axis:'dps'},
  dbl   :{nm:'더블 어택',  cap:2.0,axis:'dps'},
  melee :{nm:'근접 피해',  cap:5.0,axis:'dps'},
  ranged:{nm:'원거리 피해',cap:5.0,axis:'dps'},
  hp    :{nm:'체력',      cap:7.0,axis:'sur'},
  block :{nm:'블록 확률',  cap:2.6,axis:'sur'},
  leech :{nm:'생명력 흡수',cap:1.8,axis:'sur'},
  gold  :{nm:'골드 획득',  cap:9.0,axis:'eco'}};
const OPTKEYS=Object.keys(OPT);

/* ══ 상태 ══ */
// 새 게임의 상수 기본값. 자체 점검이 "저장값"이 아니라 이 반환값으로 초기 조건을
// 검사하기 때문에 함수로 뽑아 둔다 (세이브가 있어도 점검이 통과해야 한다).
// 032: 첫 화로는 **가득 찬 채로** 시작한다(시작 충전 30 → 600). `days.js` 의 페이싱
//   곡선이 이미 「첫날 = 가득 찬 화로 600 + 접속 중 300」을 전제로 측정돼 있었고,
//   게임만 그 전제보다 570스핀 인색했다. 기존 세이브는 손대지 않는다 — 아래 불러오기
//   줄은 그대로이고, 저장된 `charge` 가 있으면 그 값이 그대로 쓰인다.
//   ⚠ 여기에 `CHG_MAX()` 를 부를 수는 없다. `CHG_MAX` → `T` → `S` → `newState()` 로
//     한 바퀴 돌아오는데, 이 함수는 바로 아랫줄(`const S = … || newState()`)에서
//     **`CHG_MAX` 의 const 선언보다 먼저** 불린다(TDZ). 정의 순서를 옮기려면 `S` 까지
//     끌어올려야 해서 CORE 를 크게 흔든다 — 그래서 숫자를 박는다. 테크 0 인 새
//     세이브에서 `CHG_MAX() = 600 + T('cap')*30 = 600` 이라 두 값은 같다.
//     `CHG_MAX` 의 기본값 600 을 고치면 **이 줄도 같이 고칠 것.**
function newState(){ return {
  wave:1,gold:0,tok:2,lv:0,star:0,charge:600,queue:[],asell:Array(15).fill(false),
  equip:{},lockIdx:-1,auto:false,autoRes:true,t:Date.now(),          // 033: 자동 정리 기본 켜짐
  dust:0,tech:{},tk:2,tkDay:'',pos:0,best:0}; }
const S=JSON.parse(localStorage.getItem('forge')||'null')||newState();
S.star=S.star||0; S.pity=S.pity||0; S.peak=S.peak||0; S.top=S.top||0; S.dust=S.dust||0; S.tech=S.tech||{}; S.pos=S.pos||0; S.best=S.best||0;
/* 051 §2② — 피버는 **오프라인 동안 흐르지 않는다.** 돌아오면 남은 시간이 아니라
   «끝난 것»으로 본다(방치로 2연 보장을 쌓아 두는 길을 막는다 — 게이지는 손만의 것이다).
   옛 세이브에는 이 필드가 없다. `S.pity` 는 그대로 쓰되 **뜻만** 피버 게이지로 바뀐다. */
S.feverUntil=0;
/* 051 2차 ③ — 옛 세이브의 **천장 횟수**가 피버 게이지로 넘어오면 안 된다.
   단위가 다르다(옛 천장은 «스핀 수», 새 게이지는 «판정 점수») — 그대로 두면 손을
   한 번도 안 댄 사람에게 특별 주문이 한 번 열린다(검증 제안 3). 불러올 때 **한 번**
   0 으로 하고 바꿨다는 표시(`S.fv`)를 남긴다 — 이미 바꾼 세이브는 다시 안 건드린다
   (사람이 모은 게이지를 뺏지 않는다). 새 세이브는 `S.pity` 가 이미 0 이라 표시만 붙는다. */
if(!S.fv){ S.pity=0; S.fv=1; }
// 033: 옛 세이브에는 이 필드가 없다 → 켜짐으로 본다. `||` 가 아니라 `??` 인 이유는
// **끈 사람의 `false` 를 덮지 않기 위해서**다(`false||true` 는 true 가 된다).
S.autoRes = S.autoRes ?? true;
// 티켓은 하루 2장. 날짜만 비교하면 끝이라 서버가 필요 없다.
const today=()=>new Date().toISOString().slice(0,10);
if(S.tkDay!==today()){ S.tkDay=today(); S.tk=2; }
while(!S.asell||S.asell.length<15) S.asell=(S.asell||[]).concat(false);   // 구버전 세이브 호환
// 테크트리: 별가루로 올리는 6갈래. 항목당 최대 50단계, 한 단계는 작게.
const TECH={
  spd  :{nm:'충전 속도',   d:'주기 -0.8%',   max:100},
  cap  :{nm:'저장 한도',   d:'충전 +30칸',   max:100},
  sell :{nm:'판매 금액',   d:'+1.5%',        max:100},
  cost :{nm:'강화 비용',   d:'-0.5%',        max:100},
  gold :{nm:'골드 획득',   d:'+1.5%',        max:100},
  align:{nm:'정렬 보정',   d:'일치 +0.25%',  max:100}};
const T=k=>S.tech[k]||0;
const techCost=k=>Math.round(8*Math.pow(1.09,T(k)));
const CHG_MS=()=>Math.max(1500,6000*(1-T('spd')*0.008));
const CHG_MAX=()=>600+T('cap')*30;

/* ══ 확률 ══ */
// 정렬 보너스 b(0/1/2) + 제련등급 lv 만큼 상위등급 가중치 상승. 1등급은 10% 하한 유지.
// 열린 등급 안에서만 분포. 상한이 열릴 때마다 곡선 전체가 위로 밀린다.
const BASEW=[40,25,15,10,5,3,1.5,.6,.2,.06,.02,.007,.002,.0006,.00015];
function gradeProbs(b){
  // 상한이 다 열린 뒤에는 제련 강화가 등급 확률을 더 밀지 않는다. 이후로는 세부등급만 오른다.
  const c=cap(), k=1+b*0.55+Math.min(S.lv,capLvMax())*0.045;
  let w=BASEW.slice(0,c).map((v,i)=>v*Math.pow(k,i)), s=w.reduce((a,x)=>a+x,0);
  let p=w.map(v=>v/s);
  if(p[0]<0.10){ const r=(1-0.10)/(1-p[0]); p=p.map(v=>v*r); p[0]=0.10; }
  while(p.length<GMAX) p.push(0);
  return p;
}
function rollGrade(b){
  const p=gradeProbs(b); let r=Math.random();
  for(let i=0;i<GMAX;i++){ r-=p[i]; if(r<=0) return i+1; }
  return 1;
}
const rnd=a=>a[Math.floor(Math.random()*a.length)];
// 큰 수 표기: 만 단위까지는 그대로, 그 위는 K/M/B/T, 그 위는 지수
function fmt(n){ n=Math.floor(n);
  if(n<1e4) return n.toLocaleString();
  const u=['','K','M','B','T','Qa','Qi']; let i=0;
  while(n>=1000&&i<u.length-1){n/=1000;i++;}
  return n>=1000?n.toExponential(1):(n>=100?n.toFixed(0):n.toFixed(1))+u[i];
}

function makeItem(part,g){
  const n = lines(g);
  const pool=OPTKEYS.filter(k=>{
    if(part!=='weapon'&&(k==='melee'||k==='ranged')) return false;
    return true;});
  const picked=[]; 
  while(picked.length<n){ const k=rnd(pool); if(!picked.includes(k)) picked.push(k); }
  const it={part,g,lv:rollLv(),ops:{}};
  if(g>=9) it.sp=rnd(SPKEYS);
  if(part==='weapon') it.wt = Math.random()<0.5?'melee':'ranged';
  picked.forEach(k=>{ it.ops[k]=+(OPT[k].cap*optMul()*(0.4+Math.random()*0.6)*(1+(g-1)*0.28)*lvMul(it.lv)).toFixed(1); });
  // 등급당 x1.9. 적 체력이 지수로 늘기 때문에 장비도 지수여야 따라간다.
  it.base = Math.round((part==='weapon'?11:26)*Math.pow(1.9,g-1)*lvMul(it.lv)*starMul());
  it.st = S.star;
  return it;
}
// 등급 안의 세부등급 I~X. 제련 강화가 이 분포를 위로 민다.
const LVW=[34,22,15,10,7,5,3.4,2.2,1.2,.6];
function lvProbs(){
  const k=1+S.lv*0.055;
  let w=LVW.map((v,i)=>v*Math.pow(k,i)), s=w.reduce((a,c)=>a+c,0);
  return w.map(v=>v/s);
}
function rollLv(){ const p=lvProbs(); let r=Math.random();
  for(let i=0;i<10;i++){ r-=p[i]; if(r<=0) return i+1; } return 1; }
const lvMul=l=>1+(l-1)*0.07;
const ROMAN=['','I','II','III','IV','V','VI','VII','VIII','IX','X'];

/* ══ 스탯 ══ */
function stats(eq){
  let atk=5,hp=100,o={},sp={};
  for(const p in eq){ const it=eq[p]; if(!it) continue;
    if(p==='weapon') atk+=it.base; else hp+=it.base;
    if(it.sp) sp[it.sp]=true;
    for(const k in it.ops) o[k]=(o[k]||0)+it.ops[k]; }
  const wt = eq.weapon?eq.weapon.wt:null;
  // 무기 타입과 안 맞는 피해 옵션은 죽은 옵션. 관통 각인이 있으면 절반만 살아남는다.
  const on = wt==='melee' ? (o.melee||0) : wt==='ranged' ? (o.ranged||0) : 0;
  const off= wt==='melee' ? (o.ranged||0): wt==='ranged' ? (o.melee||0) : 0;
  const wb = on + (sp.pierce?off*0.5:0);
  const dps = atk*(1+wb/100)*(1+(o.crit||0)/100*(o.cdmg||0)/100)
              *(1+(o.aspd||0)/100)*(1+(o.dbl||0)/100);
  return {dps,hp:hp*(1+(o.hp||0)/100),block:Math.min(60,o.block||0),
          leech:(o.leech||0),gold:(o.gold||0),wt,o,sp};
}
const power=eq=>{const s=stats(eq);return Math.round(s.dps*Math.pow(s.hp/100,0.45));};

/* ══ 제련 ══ */
let spinning=false;
/* 048 §2① — 유일한 CORE 변경(두 줄). `free` 가 참이면 **충전을 안 쓴다.**
   손(`'hand'` · 손이 연 주기의 `'idle'` 마무리)이 `spin(true)` 로 부르고,
   견습생은 예전 그대로 `spin()` — 충전 1이다.
   ⚠ `free` 는 **대기열 상한을 풀지 않는다**(원칙 8 — 하나는 팔아야 전진).
     첫 승천 전에는 자동 정리가 없으므로(041) 손 제련은 10개마다 사람의 결정을 만난다.
   ⚠ `days.js` 기본 출력은 방치(견습생) 플레이를 재므로 md5 81a6288… 이 그대로다.
     손을 재는 것은 `days.js --manual` 이다(048 §5). */
function spin(free){
  if(spinning||(!free&&S.charge<1)||S.queue.length>=qmax()) return;
  spinning=true; if(!free) S.charge--;
  const els=[...document.querySelectorAll('.reel')];
  els.forEach((e,i)=>{ if(i!==S.lockIdx){e.classList.add('spin');e.classList.remove('hit');} });
  /* 051 §2② — 천장 분기가 **피버 분기**가 되었다.
     ⑴ 게이지가 가득이면 이 제련이 **특별 주문 제작**(전 릴 정렬 · 고정 토큰이 있으면
        그 부위 — 옛 천장과 같은 규칙이라 원칙 4 의 결정 ④ 가 그대로 산다).
     ⑵ 그 순간부터 `FEVER_MS` 동안은 **모든** 제련이 2연 이상 보장(손·견습생 둘 다).
     ⑶ 자연 전 릴 정렬이 게이지를 비우던 규칙은 **없앴다** — 게이지는 손만의 것이다. */
  const special = (S.pity|0)>=FEVER_MAX() && !feverOn();
  const inFever = feverOn();
  if(special){ S.pity=0; S.feverUntil=Date.now()+FEVER_MS; }
  const res = special
    ? Array(REELS()).fill(S.lockIdx>=0?lockPart:Math.floor(Math.random()*6))  // 특별 주문: 고정 릴이 있으면 그 부위로
    : Array.from({length:REELS()},(_,i)=> i===S.lockIdx?lockPart:Math.floor(Math.random()*6));
  // 정렬 보정: 굴린 뒤 확률적으로 릴 하나를 다른 릴에 맞춘다.
  if(Math.random()<T('align')*0.0025 && res.length>1){
    let a=0,b=1; while(a===b||a===S.lockIdx){a=(Math.random()*res.length)|0;b=(Math.random()*res.length)|0;}
    res[a]=res[b];
  }
  // 피버 중 2연 보장 — 이미 2연 이상이면 그대로 둔다(겹쳐 올리지 않는다).
  if(inFever && !special && res.length>1){
    const k={}; let mx=1; res.forEach(v=>{k[v]=(k[v]||0)+1; if(k[v]>mx) mx=k[v];});
    if(mx<2){
      let a=0,b=1; while(a===b||a===S.lockIdx){a=(Math.random()*res.length)|0;b=(Math.random()*res.length)|0;}
      res[a]=res[b];
    }
  }
  setTimeout(()=>{
    els.forEach((e,i)=>{e.classList.remove('spin');drawReel(e,res[i],i===S.lockIdx);});
    const cnt={}; res.forEach(v=>cnt[v]=(cnt[v]||0)+1);
    let best=1,part=res[Math.floor(Math.random()*res.length)];
    for(const v in cnt){ if(cnt[v]>best){best=cnt[v];part=+v;} }
    const b=best-1;                       // 2연=1, 3연=2, 4연=3, 5연=4
    if(b>0) els.forEach((e,i)=>{ if(res[i]===part) e.classList.add('hit'); });
    const it=makeItem(PARTS[part].id,rollGrade(b));
    fgLastBest=best; fgLastSpecial=special; fgLastGrade=it.g;
    const m=document.getElementById('msg');
    // 034 판정 ⓐ: 문자열 → t() 교체. 뽑힌 부위·등급·세부등급은 그대로다.
    const tag=t('msg.item',t('part.'+PARTS[part].id),t('ui.grade',it.g),ROMAN[it.lv]);
    if(S.asell[it.g-1]){                 // 자동 판매: 대기열을 거치지 않는다
      S.gold += sellPrice(it);
      m.innerHTML=t('msg.autosell',tag)+ciGold()+fmt(sellPrice(it)); m.className='';
    }else{
      S.queue.push(it);
      // 051 §2③ — 특별 주문과 «자연» 전 릴 정렬을 글자로 가른다(옛 `msg.pity` 는 안 쓴다).
      m.textContent = special?t('msg.special',tag)
                    : best===REELS()?t('msg.perfect',tag)
                    : b>=2?t('msg.match',best,tag) : b===1?t('msg.match2',tag) : tag;
      m.className = (special||b>=2)?'big':'';
    }
    S.lockIdx=-1; spinning=false; render();
  },420);
}
let lockPart=0;
/* 051 — 마지막 제련의 **결과**다. 검사(F4)와 연출(⑤ 빛기둥)이 읽는다 — 깃발이 아니라
   효과를 재게 하려고 둔다. 세이브 필드가 아니라 모듈 변수다(저장 형식 불변). */
let fgLastBest=0, fgLastSpecial=false, fgLastGrade=0;

/* ══ 전투 ══ */
let foeHP=0,foeMax=0,pHP=0,foeKind='melee';

function newWave(){
  foeMax=120*Math.pow(1.12,S.wave-1); foeHP=foeMax;
  foeKind = S.wave%3===0?'ranged':(S.wave%3===1?'melee':'mix');
  pHP=stats(S.equip).hp;
  // 034 판정 ⓐ: 문자열 → t() 교체. 수식·분기·순서는 한 글자도 안 바뀌었다.
  document.getElementById('foes').textContent =
    t('foe.floor',S.wave,foeKind==='melee'?t('foe.melee'):foeKind==='ranged'?t('foe.ranged'):t('foe.mix'));
  buildFoes();
}
function tick(){
  const s=stats(S.equip); const hp0=pHP;
  let dmg=s.dps*0.25;
  if(s.sp.exec && foeHP/foeMax<=0.25) dmg*=1.8;
  if(s.sp.rage && pHP/s.hp<=0.50)     dmg*=1.5;
  foeHP -= dmg;
  const raw = 9*Math.pow(1.115,S.wave-1)*0.25;
  const isMelee = foeKind==='melee' || (foeKind==='mix'&&Math.random()<0.5);
  pHP -= isMelee ? raw*(1-s.block/100) : raw;   // 블록은 근접에만
  pHP += dmg*s.leech/100 + (s.sp.regen?s.hp*0.005:0);
  pHP = Math.min(s.hp,pHP);
  if(foeHP<=0){ S.peak=Math.max(S.peak||0,S.wave); S.top=Math.max(S.top||0,S.wave); S.gold += Math.round(4*Math.pow(1.10,S.wave-1)*(1+s.gold/100)*(1+T('gold')*0.015)); S.wave++; newWave(); }
  else if(pHP<=0){ S.wave=Math.max(1,S.wave-1); newWave(); }
  document.getElementById('fill').style.width=Math.max(0,foeHP/foeMax*100)+'%';
  const hpr=Math.max(0,pHP/s.hp*100)+'%', hf=document.getElementById('hpfill');
  hf.style.width=hpr; hf.classList.toggle('heal',pHP>hp0);
  document.getElementById('hpghost').style.width=hpr;
  drawFoes();
  document.getElementById('wv').textContent=S.wave;
}

const sellPrice=it=>Math.round(4*Math.pow(1.75,it.g-1)*lvMul(it.lv||1)*Math.pow(4,it.st||0)*(1+T('sell')*0.015));
// 교체: 새것을 끼고, 빠진 장비는 대기열 맨 앞으로. 실제로 껴보고 웨이브/능력치를
// 확인한 뒤 되돌리거나(다시 교체) 팔면 된다. 판매만이 대기열을 줄인다.
function resolve(action){
  const nw=S.queue[0]; if(!nw) return;
  const old=S.equip[nw.part]||null;
  if(action==='equip'){
    if(old && nw.g<=old.g-2 && !nw.wn){
      // 034: 문자열만 표로 옮긴다 — 조건·분기·순서는 한 글자도 안 바뀌었다.
      if(!confirm(t('swap.confirm',old.g,nw.g,old.g-nw.g))) return;
      nw.wn=1;   // 같은 장비로는 다시 묻지 않는다 (왕복 시 반복 경고 방지)
    }
    S.queue.shift();
    S.equip[nw.part]=nw;
    if(old) S.queue.unshift(old);
    // 팝업은 유지 — 카드가 뒤바뀐 상태로 다시 그려져서 그 자리에서 비교·되돌리기 가능
  }else{
    S.queue.shift();
    S.gold += sellPrice(nw);
    if(nw.g>=cap()-2) S.tok++;   // 상위 3등급을 팔 때만 토큰
  }
  // 033 판정 ⓑ — 여기 있던 `newWave();` 를 **지웠다**(CORE 한 줄, 사용자 승인).
  // 원래 의도는 「장비가 바뀌었으니 싸움을 다시 세운다」였는데, `tick()` 이 매 틱
  // `stats(S.equip)` 를 다시 읽고 `pHP` 를 `s.hp` 로 자르므로 **필요가 없었다.**
  // 있는 동안에는 자동 정리(033)가 거의 매 틱 `resolve()` 를 불러 적 체력이 계속
  // 원위치돼 웨이브가 서 있었다(실측: 2분 방치 newWave 246회 · 웨이브 1).
  // VIEW 에서 `foeHP`·`pHP` 를 떴다 되돌리는 편법은 쓰지 않는다 — 결함은 여기 있었다.
  render(); openCmp();
}

// 승천: 상한을 다 열고 제련을 더 올리면 전부 팔고 별 하나. 릴이 늘고 시작 상한이 오른다.
const canAscend=()=>cap()===GMAX && S.lv>=ASC_LV() && (S.peak||0)>=ASC_WAVE();
function ascend(){
  if(!canAscend()) return;
  const list=Object.values(S.equip).concat(S.queue);
  // 034: 문자열만 표로 옮긴다 — 조건·분기·순서는 한 글자도 안 바뀌었다.
  if(!confirm(t('asc.confirm',S.star+1,list.length,4**(S.star+1),
      (1+(S.star+1)*0.6).toFixed(1),qmax()+1)
    + (REELS()<5?t('asc.confirmReels',REELS(),REELS()+1):'') + t('asc.confirmGo'))) return;
  list.forEach(it=>S.gold+=sellPrice(it));
  S.equip={}; S.queue=[]; S.lv=0; S.star++; S.wave=1; S.peak=0; S.lockIdx=-1;
  buildReels(); newWave(); render();
}

let lastSave=0;
function save(force){
  if(!force && Date.now()-lastSave<3000) return;
  lastSave=Date.now();
  localStorage.setItem('forge',JSON.stringify({...S,t:Date.now()}));
}
addEventListener('pagehide',()=>save(true));
addEventListener('visibilitychange',()=>{ if(document.hidden) save(true); });

const upCost=()=>Math.round(50*Math.pow(1.55,S.lv)*Math.max(0.5,1-T('cost')*0.005));

/* ══ 무한의 층 ══ */
// 웨이브 전투를 그대로 재사용. 별도 밸런싱 없이 층수만 센다.
function climb(){
  const st=stats(S.equip); let f=0;
  while(f<999){
    const hp=200*Math.pow(1.16,f), dmg=11*Math.pow(1.15,f);
    if(hp/Math.max(st.dps,1e-9) > st.hp/Math.max(dmg-st.dps*st.leech/100,1e-9)) break;
    f++;
  }
  return f;
}

/* ══ 주사위 판 ══ */
// 8칸 순환. 보상은 도달 층수에 비례하므로 판 자체는 배율만 갖는다.
const TILES=[
  {n:'별가루',   k:'dust', m:1.0},
  {n:'골드',     k:'gold', m:1.0},
  {n:'고정 토큰',k:'tok',  m:3},
  {n:'별가루',   k:'dust', m:2.0},
  {n:'충전 가득',k:'chg',  m:0},
  {n:'별가루',   k:'dust', m:3.5},
  {n:'골드',     k:'gold', m:2.5},
  {n:'고정 토큰',k:'tok',  m:1}];
const tileAmt=t=> t.k==='dust' ? Math.max(1,Math.round(runFloor*t.m))
               : t.k==='gold' ? Math.round(upCost()*0.5*t.m)   // 강화 비용 기준이라 언제나 유의미, 절대 폭발 안 함
               : t.k==='tok'  ? t.m : 0;


