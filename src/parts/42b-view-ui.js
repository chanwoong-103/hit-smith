/* ══ 배선 ══ */
const reels=document.getElementById('reels');
function buildReels(){
  reels.innerHTML='';
  const made=[];
  for(let i=0;i<REELS();i++){
    const d=document.createElement('div'); d.className='reel';
    /* ══ 047 3차 ③④ — 문양 칸 탭은 **언제나 치기**, 고정은 **길게 누르기** ══
       2차까지는 주기 밖에서 문양 칸을 누르면 고정 토큰을 썼다. 그런데 세로에서
       모루 장면의 **20~38% 가 문양 칸**이고(검증 D) 380×820·800×450 승천 0 에서는
       **장면 한가운데 점이 문양 칸**이다 — 처음 하는 사람이 가운데를 누르면 첫 손이
       치기가 아니라 고정이 된다(새 세이브 토큰 2개). 계획 판정: **짧은 탭은 언제나
       치기**, 고정은 0.45초 길게 누르기로 옮긴다. 048(진짜 슬롯 릴)도 같은 규칙이다.
       ④ 정착 전 420ms 안의 탭도 치기다 — 옛 처리기 첫 줄의 `if(spinning) return;`
       이 그것을 삼켰다(검증 E). `strike()` 가 쌓아 두었다가 정착 순간 반영한다(⑤-2).
       ⚠ 주기 **안**에서는 길게 누르기 타이머를 아예 안 건다 — 결과가 이미 정해진
         뒤의 고정은 토큰만 버린다. 그래서 주기 안의 긴 누름은 뗄 때 한 타가 된다. */
    const lockHold=()=>{
      if(S.lockIdx===i){S.lockIdx=-1; S.tok++;}   // 해제하면 토큰 환불
      else if(S.tok>0){ S.tok--; S.lockIdx=i; lockPart=+d.dataset.p; }
      else return;                                // 토큰이 없으면 아무 일도 없다
      [...reels.children].forEach((e,j)=>e.classList.toggle('lock',j===S.lockIdx));
      try{ reelLockSync(); }catch(e){}          // 048 2차 ① — 고정된 릴은 안 돈다
      d.classList.remove('held'); void d.offsetWidth; d.classList.add('held');
      render();
    };
    let hT=null, held=false;
    /* ══ 049 F5 — 미끄러진 탭을 삼키지 않는다 ══════════════════════════════
       실측(진짜 터치): 칸 위에서 손가락이 6·12px 미끄러지면 `<img>` 네이티브 드래그가
       `pointerup` 을 삼켜 **그 탭이 통째로 사라졌고**(손타격 0회), 20px 이 넘으면
       브라우저가 제스처로 **가로채 `pointercancel`** 을 보내 역시 사라졌다.
       폰 엄지는 거의 늘 몇 px 미끄러진다 — 「가끔 안 먹는다」가 이것이다.
       고치는 법 셋: ⑴ 그림을 못 끌게(`icoPix` 의 `draggable="false"`),
       ⑵ 누르는 자리에 `touch-action:manipulation`(CSS), ⑶ 여기 — **포인터를 칸에
       붙잡고**(`setPointerCapture`) 가로채이더라도 **짧은 누름은 치기로 센다.**
       ⚠ `pointercancel` 과 `pointerleave` 를 가른다: 가로채임은 「사람은 탭했다」이고,
         칸을 벗어난 것은 아니다(붙잡아 두면 벗어나는 일 자체가 거의 없다). */
    let downAt=0;
    const hStart=e=>{ held=false; downAt=Date.now(); reelTouch();
      try{ if(e&&e.pointerId!=null&&d.setPointerCapture) d.setPointerCapture(e.pointerId); }catch(x){}
      if(hT){ clearTimeout(hT); hT=null; }
      if(FG.veiled) return;                       // 주기 안에서는 고정이 없다
      hT=setTimeout(()=>{ hT=null; held=true; lockHold(); }, LOCK_HOLD_MS); };
    const hEnd=e=>{ if(hT){ clearTimeout(hT); hT=null; }
      // 049 §2⑥ — 판정은 **이 사건의 시각**으로 잰다(틱이 아니라).
      if(!held){ strikeAt(e); strike('hand'); strikeAt(null); } held=false; };
    // 브라우저가 제스처로 가로챘다 — 사람은 **탭한 것**이다. 길게 누르기가 이미
    // 걸렸으면(고정) 아무 일도 없다. 길면 탭이 아니므로 LOCK_HOLD_MS 로 자른다.
    const hSteal=()=>{ if(hT){ clearTimeout(hT); hT=null; }
      if(!held && Date.now()-downAt < LOCK_HOLD_MS) strike('hand');
      held=false; };
    const hCancel=()=>{ if(hT){ clearTimeout(hT); hT=null; } held=false; };
    if(typeof d.addEventListener==='function' && typeof PointerEvent!=='undefined'){
      d.addEventListener('pointerdown',hStart);
      d.addEventListener('pointerup',hEnd);
      d.addEventListener('pointerleave',hCancel);
      d.addEventListener('pointercancel',hSteal);
      // 길게 눌러 글자가 잡히거나 맥락 메뉴가 뜨면 고정이 「눌린 느낌」을 잃는다
      d.addEventListener('contextmenu',e=>e.preventDefault());
    } else {
      d.onclick=()=>strike('hand');               // 포인터 이벤트가 없는 판(하네스 등)
    }
    reels.appendChild(d); made.push(d);
  }
  // 그리기는 **다 붙인 뒤**. 하나만 붙은 상태에서 재면 칸이 아니라 줄 전체 폭이
  // 나와서 REEL_SCALE() 이 한 단계 크게 잡힌다.
  made.forEach((d,i)=>drawReel(d,i%6,false));
  try{ reelSync(); }catch(e){}            // 048 — 릴 상태 배열을 새 칸에 맞춘다
  // 048 §2⑥ — 잃은 말은 `title` 이 든다(047 이 세운 이 화면의 기본 규약).
  try{ reels.title=t('ui.reelTip'); }catch(e){}
}
// 등급색 15종을 **여기서 한 번** 굳힌다 (010 §4). 스타일시트는 <head> 에서 이미
// 적용됐고, 아래 buildReels() 가 첫 스프라이트를 굽기 **전**이라는 것이 요점이다.
primeGrades();
buildReels();

/* 033 ②: 같은 버튼이 두 말을 한다. 가득 + 「정리」 끔 이면 **비교 팝업을 연다**
   (기존 `openCmp` — 새 팝업을 만들지 않는다). 그 밖에는 예전 그대로 `spin()`.
   `spin()` 자신이 가득일 때 아무 일도 안 하므로 이 분기는 «누를 수 있는 버튼이
   거짓말을 하지 않게» 하는 것뿐이다. */
/* 047 §2③⑤ — `#spin` 은 이제 장면 전체를 덮는 투명한 버튼이고, 누르는 것은
   `spin()` 이 아니라 **한 타**다. 033 ② 의 「가득 + 정리 꺼짐 → 비교 팝업」은
   `strike()` 안으로 옮겼다(거기가 주기 밖의 첫 갈림길이다). */
document.getElementById('spin').onclick=e=>{ strikeAt(e); strike('hand'); strikeAt(null); };
/* 키보드(데스크톱 포털) — 팝업이 안 열려 있을 때 Space/Enter 가 한 타다.
   버튼이 포커스를 들고 있으면 브라우저가 이미 click 을 내므로 두 번 치지 않게
   그 경우는 건너뛴다. */
if(typeof document.addEventListener==='function') document.addEventListener('keydown',e=>{
  if(e.key!==' ' && e.key!=='Enter' && e.key!=='Spacebar') return;
  if(e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  const op=document.querySelector('#pop.on,#cmp.on,#dice.on,#adwall.on');
  if(op) return;                                   // 팝업·광고 막이 열려 있으면 아니다
  const ae=document.activeElement;
  if(ae && ae!==document.body && (ae.tagName==='BUTTON'||ae.tagName==='INPUT')) return;
  e.preventDefault(); strike('hand');
});
document.getElementById('auto').onclick=()=>{S.auto=!S.auto;render();};
/* 033 ①-b: 「정리」는 켜고 끄는 버튼이고 `#auto` 와 **서로 독립**이다. 켜는 순간
   대기열이 이미 가득이면 다음 틱이 바로 한 칸을 정리한다. */
// 041 ②: 잠긴 동안에는 눌러도 아무 일도 없다(버튼 자체가 안 보이지만, 손잡이도 막는다).
document.getElementById('autores').onclick=()=>{
  if((S.star||0)<1) return;
  S.autoRes=!S.autoRes; render();
};
/* 048 2차 ④ — 「+N」은 `#qdots` 안이고 `#qdots` 는 `#open` **안**이라, 글자를 누르면
   이 처리기가 그대로 받는다(진짜 포인터로 확인 — 검사 S8). 코드는 0줄이고,
   `.more` 에 `pointer-events:none` 이 붙는 날 조용히 죽지 않게 검사로 못을 박았다.
   `reelTouch()` 는 2차 ① 의 「사람 입력」 표시다. */
document.getElementById('open').onclick=()=>{ reelTouch(); openCmp(); };
/* 049 §2④ — 소리 끄고 켜기. HUD 스피커는 **둘 다**, 팝업의 두 줄은 각각.
   ⚠ 누르는 것 자체가 사람 입력이라 `reelTouch()` 가 소리를 켠다 — 끈 채로 눌러도
     문맥은 생긴다(그래야 다시 켤 때 바로 난다). */
(function(){
  const sb=document.getElementById('snd');
  if(sb) sb.onclick=()=>{ reelTouch();
    const on=!((SND.music||SND.sfx)&&!SND.cgMute);
    SND.music=on; SND.sfx=on; sndSavePrefs(); sndApply(); sfx('sfx-tink'); };
  const m=document.getElementById('sndMusic');
  if(m) m.onclick=()=>{ reelTouch(); SND.music=!SND.music; sndSavePrefs(); sndApply(); };
  const x=document.getElementById('sndSfx');
  if(x) x.onclick=()=>{ reelTouch(); SND.sfx=!SND.sfx; sndSavePrefs(); sndApply(); sfx('sfx-tink'); };
  /* ⚠ `sndLoadPrefs()` 를 **여기서 부르면 안 된다** — `const SND` 는 파일 아래쪽에서
     만들어지고 그 전까지는 TDZ 라 `ReferenceError` 가 난다. try/catch 가 그것을
     조용히 삼켜서, 소리를 끄고 새로고침하면 다시 켜져 있었다(검사 A6 가 울었다).
     읽는 자리는 SND 블록 끝이다. */
  // 탭이 숨었다 돌아오는 순간은 틱을 기다리지 않는다
  if(typeof document.addEventListener==='function')
    document.addEventListener('visibilitychange',()=>{ try{ sndGate(); }catch(e){} });
})();
document.getElementById('cclose').onclick=()=>document.getElementById('cmp').classList.remove('on');
document.getElementById('cmp').onclick=e=>{ if(e.target.id==='cmp') e.target.classList.remove('on'); };
document.getElementById('bEquip').onclick=()=>resolve('equip');
document.getElementById('bSell').onclick=()=>resolve('sell');
// 광고 보상은 웨이브에 비례시키지 않는다. 후반 웨이브에서 지수로 터진다.
const boosted=()=>Date.now()<(S.boost||0);
// 026 §0: 여기가 공짜였다. 이제 **광고를 끝까지 본 경우에만** 보상이 나간다.
// 보상 내용(충전 가득 + 30분 1.5배속)은 한 글자도 안 바꿨다 — 앞에 광고가 설 뿐이다.
// 쿨다운·하루 횟수는 `S` 에 적는다(`S.boost` 와 같은 자리 · CORE 미변경).
document.getElementById('ad').onclick=()=>{
  if(!adOK()) return;
  PLAT.rewarded().then(ok=>{
    if(!ok){ platUI(); adFailMsg(); return; }    // 오류·중단 → 보상 없이 그대로 이어간다
    S.adN=(S.adN||0)+1; S.adAt=Date.now();
    S.charge=CHG_MAX(); S.boost=Date.now()+30*60*1000; render(); });
};
document.getElementById('up').onclick=()=>{ if(S.gold>=upCost()){S.gold-=upCost();S.lv++;render();} };

/* ══ 탭 (016) ══════════════════════════════════════════════════════
   라우터를 들이지 않는다. 주소·해시·history 를 건드리는 순간 뒤로가기가
   "게임에서 나가기"가 아니라 "탭 되돌리기"가 되고, 세이브 한 벌짜리 단일
   파일에 상태가 두 군데(S 와 URL) 생긴다. 여기서 필요한 것은 그게 아니라
   **보이는 판 하나를 바꾸는 일**뿐이다 — class 토글이면 끝이다. */
const TABS=['tabForge','tabTower','tabTech'];
const tabBtn=t=>document.getElementById('tb'+t.slice(3));
function showTab(id){
  const pane=document.getElementById(id);
  if(!pane) return;
  const bar=document.getElementById('tabs');
  // 탭바가 없는 동안(웨이브 10 전)에는 제련 말고 갈 곳이 없다
  if(id!=='tabForge' && bar && bar.style.display==='none') return;
  TABS.forEach(t=>{
    const p=document.getElementById(t), tb=tabBtn(t);
    if(p) p.classList.toggle('on',t===id);
    if(tb) tb.classList.toggle('on',t===id);
  });
  /* 047 §2② — 세로에서 다른 탭을 고르면 **모루 장면도 함께** 사라져야 한다.
     장면은 탭 판 밖에 있으므로(가로에서 왼쪽 칸이 남아야 하니까) 판의 `.on`
     만으로는 안 되고, `body` 에 지금 탭을 적어 CSS 가 세로에서만 숨긴다. */
  try{ document.body.setAttribute('data-tab', id.replace(/^tab/,'').toLowerCase()); }catch(e){}
  // 제련 탭이 들고 나면 #forge 기하가 통째로 생겼다 사라진다. 루프가 자고 있으면
  // sync() 가 안 돌아 패널 바탕이 어긋난 채 멈춘다 (011 의 「깨우는 자리」 규약).
  if(typeof globalThis.__canvasWake==='function') globalThis.__canvasWake(600);
}
TABS.forEach(t=>{ const b=tabBtn(t); if(b) b.onclick=()=>showTab(t); });

/* ══ 상세 팝업 (016) ══════════════════════════════════════════════
   통 하나(#pop)에 절 넷. 닫기 버튼과 배경 탭 둘 다로 닫힌다. */
// 027 B-3: `set` 을 뺐다. 절이 없어졌으므로 키도 없어야 한다 — 남겨 두면
// openPop('set') 이 «제목만 있고 내용이 없는 창»을 연다(그게 곧 거짓말이다).
// 047 §2④: `forge` 절 하나를 더한다 — 없어진 `#manage` 의 내용이 사는 자리다.
const POPS={odds:'pop.odds', stats:'pop.stats', asc:'pop.asc', forge:'ui.info'};   // 034: 값은 표의 키다
function openPop(k){
  Object.keys(POPS).forEach(n=>{
    const e=document.getElementById('pop'+n[0].toUpperCase()+n.slice(1));
    if(e) e.classList.toggle('on',n===k);
  });
  document.getElementById('ptitle').textContent=POPS[k]?t(POPS[k]):'';
  document.getElementById('pop').classList.add('on');
  renderFast();                                  // 전투력·웨이브·골드 줄을 최신으로
}
const closePop=()=>document.getElementById('pop').classList.remove('on');
document.getElementById('pclose').onclick=closePop;
document.getElementById('pop').onclick=e=>{ if(e.target.id==='pop') closePop(); };
document.getElementById('bOdds').onclick=()=>openPop('odds');
document.getElementById('bStats').onclick=()=>openPop('stats');
// 047 §2④ — 열기 줄의 ⓘ. 장비 띠의 칸을 눌러도 옵션 상세가 열린다(아래 render).
document.getElementById('bInfo').onclick=()=>openPop('forge');
// 승천 확인은 설정 팝업 위에 덧대지 않고 같은 통에서 절만 갈아 끼운다.
document.getElementById('asc').onclick=()=>openPop('asc');
// 확인은 이 팝업이 이미 받았다. ascend() 는 CORE 라 안의 confirm() 을 지울 수
// 없으므로, **이 호출 동안만** 통과시킨다 — 두 번 묻지 않기 위한 이음매다
// (008 의 MutationObserver 와 같은 종류: CORE 바이트는 그대로 둔다).
document.getElementById('ascGo').onclick=()=>{
  closePop();
  const c=globalThis.confirm;
  try{ globalThis.confirm=()=>true; ascend(); }
  finally{ globalThis.confirm=c; }
  showTab('tabForge');
  PLAT.midroll();        // 037 ③ — 승천 처리가 **끝난 뒤**. 광고는 결과를 바꾸지 않는다.
};

/* ══ 041 ① — 자동 정리의 **실효 판정 하나** ═══════════════════════════════
   저장값 `S.autoRes` 는 사람이 켜고 끈 선택이고(그대로 둔다), **지금 실제로 도는가**
   는 거기에 「첫 승천을 했는가」가 곱해진 것이다. 읽는 자리가 넷이라 식을 넷으로
   흩뜨리면 반드시 한 자리가 뒤처진다 — 한 함수로 모은다.
   ⚠ 승천 0회에서는 저장값이 true 여도 **자동 정리가 0회**여야 한다(U1). 그래서
     이 판정은 버튼의 보임새가 아니라 **도는 경로 네 곳 전부**가 쓴다. */
function autoResOn(){ return (S.star||0)>=1 && !!S.autoRes; }
// ③ 해금 한 줄을 **한 번만** 띄우기 위한 기억. 부팅 때의 별 수로 시작하므로
//   이미 승천한 세이브를 열어도 문구가 다시 뜨지 않는다.
let lastStar=(typeof S==='object'&&S)?(S.star||0):0;
/* ③ 2차 (제안 ① 판정) — 해금을 **버튼에서** 알린다. `#msg` 한 줄은 자동 제련이
   켜져 있으면 다음 제련 결과가 14~83ms 만에 덮는다(검증 실측). 붙잡는 것은 CORE 의
   `spin()` 을 건드려야 하므로, 눈이 가야 할 곳(「정리」 버튼 자체)을 세 번 반짝인다.
   ⚠ 하네스에는 `document`·`matchMedia` 가 없다 — 전부 막아 둔다(041 ④ 에서 이걸
     빠뜨려 `days.js` 가 죽고 md5 가 빈 출력로 바뀐 적이 있다). */
