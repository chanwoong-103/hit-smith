/* ══ 047 §2⑤ — 「세 번 두드리면 하나」 ══════════════════════════════════
   CORE 의 `spin()` 은 **한 번만** 부른다(첫 타). 결과는 그 순간 정해지고 420ms
   뒤 CORE 가 화면에 쓴다. VIEW 는 그 결과를 **타격 수만큼만 드러낸다.**

   ⚠ 가림막은 **부모 속성**이다(`#forge[data-shown]`·`[data-veiled]`). 자식 클래스로
     걸면 안 된다 — CORE 가 `#msg.className=` 로 통째로 덮고 `.reel` 의 클래스를
     붙였다 뗀다(047 §1 ②④). 부모 속성은 CORE 가 한 번도 안 만진다.
   ⚠ CORE 와의 산술은 안 바뀐다: 한 장비 = `spin()` 1회 = 충전 1. 달라지는 것은
     「쌓인 충전을 견습생이 비우는 속도」 하나다(§2⑤ 끝 — 검사 K3). */
const FORGE_IDLE_MS=1500, FORGE_IDLE_STEP=250, APPRENTICE_MS=500;
const FG={ need:0, struck:0, shown:0, veiled:false, settled:false, qHeld:0, lastHitAt:0,
           strikes:{hand:0, apprentice:0, idle:0}, made:0,
           blocked:{charge:0, queue:0}, idleFinish:0,
           rush:false, rushOn:0,                         // 047 2차 — 견습생 서두름
           free:false,                                   // 048 §2① — 이 주기가 공짜인가
           /* 048 2차 ③ — **손이 연 주기 수**. R3(영원의 불씨)가 「손으로 만든 장비 수에
              비례해 승천 보너스」를 얹을 때 쓸 계수기다. ⚠ `S` 에는 안 넣는다 —
              저장 형식을 바꾸는 것은 R3 몫이고, 여기서 넣으면 048 이 저장 형식을
              건드린 것이 된다(§3 「저장 형식」). 이번 접속 동안만 센다. */
           handMade:0,
           /* 049 F2 — 이 주기를 **자동 제련이 열었는가**. 자동 주기는 릴을 굴리지 않는다
              (아래 reelsStart). 손이 중간에 섞이면 그 순간 거짓이 되고 굴리기 시작한다. */
           autoCycle:false };
/* ══ 048 §2⑦ — 릴의 검증 창구 ══════════════════════════════════════════
   **노출되지 않는 연출은 완료로 인정하지 않는다**(CLAUDE.md). 릴은 캔버스가
   아니라 DOM 이지만 「지금 어느 상태인가」는 클래스만으로는 못 읽는다 —
   `spin`/`slow`/`queued` 가 화면에서 똑같이 「돈다」로 보이기 때문이다. */
try{
  Object.defineProperty(FG,'reels',{enumerable:true,configurable:true,
    get(){ return RL.map(r=>({state:r.st, sym:r.sym, tense:!!r.tens})); }});
  Object.defineProperty(FG,'tension',{enumerable:true,configurable:true,
    get(){ return RL.some(r=>!!r.tens); }});
  Object.defineProperty(FG,'apprOn',{enumerable:true,configurable:true,
    get(){ try{ return apprOn(); }catch(e){ return false; } }});
}catch(e){}
/* ══ 047 2차 §제안② — 「밀린 일이 많으면 견습생이 서두른다」 ═══════════════
   1차의 견습생은 500ms 에 **한 타**라 한 장비에 `REELS()`×0.5초가 들었다. 그러면
   **짧게 접속하는 사람만 느려진다**: 자리를 비운 동안 충전이 상한 600 까지 차는데
   10분 접속으로는 300개밖에 못 써서 나머지가 버려진다. CLAUDE.md 의 반려 기준
   「접속 시간과 도달 일수가 무관할 것」에 걸린다(계획 판정 2026-10-16).

   고치는 법: 충전이 밀려 있으면 **한 박(500ms)에 그 주기의 남은 타격을 전부** 친다.
   정착 전 타격은 쌓였다가 정착 순간 반영되므로(K2) **한 장비 ≈ 한 박** = 041 자동과
   같은 속도가 된다. 충전이 평상시로 돌아오면 다시 한 박 한 타다 — 그 구간의 병목은
   충전 회복(6초에 1)이라 박자가 하루 총량을 안 바꾼다.
   ⚠ 250ms 틱 안에서 `0.5/REELS()` 초 간격을 만들려 하지 말 것 — 틱 해상도보다 잘다.
     **박마다 몰아 치고**, 연출만 60ms 로 흩는다.
   ⚠ 문턱이 둘인 이유: 하나면 경계(정확히 60)에서 매 틱 켜졌다 꺼진다. */
const RUSH_ON=60, RUSH_OFF=30, RUSH_GAP=60;
// 047 3차 ③ — 고정은 길게 누르기. 0.45초는 계획 판정이 정한 값이다.
const LOCK_HOLD_MS=450;
/* ⚠ 박은 **고정 격자**에 묶는다. 처음엔 「친 시각 + 500ms」로 잡았는데, 250ms 틱이
   격자점을 1ms 차이로 놓치면 그 박이 **한 틱(250ms) 통째로 밀린다** — 실측에서
   장비 사이 간격이 중앙 505ms 인데 최대 763ms, 평균 590ms 이 나왔고 그만큼(−12%)
   041 보다 느렸다(041 은 매 틱 `spin()` 을 시도해 500ms 에 정확히 붙는다).
   여유를 반 틱 두고 **다음 격자점으로 전진**하면 한 박을 놓쳐도 다음 박이 당겨져
   따라붙으므로, 길게 보면 정확히 500ms 에 하나다. */
const BEAT_SLACK=130;
function fgRushCheck(){
  if(!FG.rush){ if(S.charge>=RUSH_ON){ FG.rush=true; FG.rushOn++; } }
  else if(S.charge<RUSH_OFF){ FG.rush=false; }
}
/* 한 박. 평상시엔 한 타, 서두름이면 그 주기를 **한 박 안에 끝낸다**. */
function fgBeat(){
  strike('apprentice');
  if(!FG.rush || !FG.veiled) return;
  let left=Math.max(0, FG.need-FG.struck);
  if(left<=0 || typeof setTimeout!=='function') return;
  const step=()=>{ if(!FG.veiled) return;      // 그 사이 마무리됐으면 그만둔다
    strike('apprentice');
    if(FG.veiled && --left>0) setTimeout(step, RUSH_GAP); };
  setTimeout(step, RUSH_GAP);
}
let fgQAt=0, fgIdleT=null, fgRaf=null, fgBeatAt=0, fgPending=null;   // 3차 ②: fgPrevSpinning 은 상태 판정으로 바뀌며 없어졌다

function fgEl(){ try{ return document.getElementById('forge'); }catch(e){ return null; } }
/* 대기열 띠의 점 — 대기 장비 하나당 등급색 점 하나. **빈 칸도 점으로 자리를
   지킨다**(띠 높이가 틱마다 안 변하게 · 검사 L3). 가려진 동안 보류분은 안 보인다.
   `fresh` 는 마무리 순간 새 점 하나가 한 번 반짝이는 것(§2⑤-7 — 날아가는 카드는 R2). */
/* ══ 047 3차 ⑤ — 점은 **띠 안에 다 들어간다** ════════════════════════════
   2차까지는 점 줄이 `overflow:hidden` 이라 좁은 칸에서 **조용히 잘렸다**
   (검증 F 실측: 800×450 ko 승천0 14/14 에서 점 11개만 보임 · en 12 · 360×640 13).
   「대기 장비 하나당 점 하나」가 거짓이 되는데 화면에는 아무 표시도 없다.

   고치는 법 둘: ⑴ 칸에 맞춰 **점을 줄인다**(7px → 최소 4px, 간격도 같이).
   ⑵ 4px 로도 안 들어가면 **마지막 자리를 「+N」**으로 바꾼다. 어느 쪽이든
   **보이는 점 수 + N = 실제 대기 수**가 늘 성립한다 — 잘려 사라지는 점은 없다. */
const QDOT_MAX=7, QDOT_MIN=4, QDOT_GAP_MAX=3, QDOT_GAP_MIN=2;
/* 047 4차 — 「+N」 글자 폭을 **먼저** 잰다 ═══════════════════════════════
   3차는 자리 수를 「모두 점」이라고 보고 센 뒤 **마지막 한 자리만 글자로 바꿨다.**
   글자는 점보다 서너 배 넓어(「+35」≈20px vs 점 4px) 그만큼 띠 밖으로 밀렸고
   `overflow:hidden` 이 그것을 잘랐다 — 3차 검증 실측: ★20 이상에서 「+N」이 나온
   **모든 칸**이 잘렸고, 「+3」(실제 +35)처럼 **틀린 수**로 읽혔다. 조용히 사라지는
   것을 막으려고 넣은 글자가 조용히 거짓말을 하고 있었다.

   4차: 그 순간의 N 으로 **글자 폭을 재서 먼저 떼고**, 남은 폭으로 점 수를 정한다.
   N 은 점 수에 달렸고 점 수는 글자 폭에 달렸으므로 몇 번 돌려 수렴시킨다(자릿수가
   바뀌는 경계에서만 한 번 더 돈다 — 보통 2회면 끝난다).
   ⚠ 점이 다 들어가면 **글자를 아예 안 쓴다**(자리도 안 만든다). */
let qdotProbe=null;
function qdotTextW(txt){
  try{
    if(!txt) return 0;
    const band=document.getElementById('qband'); if(!band) return 0;
    if(!qdotProbe || !qdotProbe.isConnected){
      qdotProbe=document.createElement('i');
      qdotProbe.className='qmore';          // `.more` 와 **같은 CSS** 를 받는다
      band.appendChild(qdotProbe);
    }
    qdotProbe.textContent=txt;
    return Math.ceil(qdotProbe.getBoundingClientRect().width);
  }catch(e){ return 0; }
}
function fgDots(flash){
  try{
    const box=document.getElementById('qdots'); if(!box) return;
    const seen=Math.max(0,S.queue.length-(FG.veiled?FG.qHeld:0)), cap=qmax();
    const avail=Math.floor(box.getBoundingClientRect().width)||0;
    let size=QDOT_MAX, gap=QDOT_GAP_MAX, dotN=cap, rest=0;
    if(avail>0){
      // ⑴ 점이 **다 들어가는** 가장 큰 크기를 찾는다. 찾으면 글자는 없다.
      let allFit=false;
      for(size=QDOT_MAX; size>=QDOT_MIN; size--){
        gap = size>=6 ? QDOT_GAP_MAX : QDOT_GAP_MIN;
        if(cap*size+(cap-1)*gap <= avail){ allFit=true; break; }
      }
      if(allFit){ dotN=cap; rest=0; }
      else{
        // ⑵ 다 안 들어간다 — 가장 작은 점으로 최대한 많이 보이게 하고 나머지는 글자가 든다.
        size=QDOT_MIN; gap=QDOT_GAP_MIN;
        dotN=Math.max(0, Math.floor((avail+gap)/(size+gap))-1);
        for(let k=0;k<6;k++){
          const n=Math.max(0, seen-dotN);
          const tw=n>0?qdotTextW('+'+n):0;              // **글자 폭을 먼저 뗀다**
          const budget=avail-(tw>0?tw+gap:0);
          let nd=Math.max(0, Math.floor((budget+gap)/(size+gap)));
          if(nd>cap) nd=cap;
          if(nd===dotN) break;
          dotN=nd;
        }
        rest=Math.max(0, seen-dotN);
        if(dotN>=cap){ dotN=cap; rest=0; }              // 글자가 0 이면 자리도 안 쓴다
      }
    }
    const slots=dotN+(rest>0?1:0);
    if(box.children.length!==slots || box.dataset.size!==String(size)){
      box.innerHTML=''; for(let i=0;i<slots;i++) box.appendChild(document.createElement('i'));
      box.dataset.size=String(size);
    }
    box.style.gap=gap+'px';
    for(let i=0;i<dotN;i++){
      const d=box.children[i], it=i<seen?S.queue[i]:null;
      d.className=it?'on':'';
      d.style.width=d.style.height=size+'px';
      d.style.color=it?(GC[it.g]||'var(--line)'):'';
      d.textContent='';
      if(flash && it && i===seen-1){ void d.offsetWidth; d.classList.add('fresh');
        setTimeout(()=>{ try{ d.classList.remove('fresh'); }catch(e){} },900); }
    }
    if(rest>0){
      // **보이는 점 + N = 실제 대기 수.** 이 자리는 위에서 폭을 떼 놓은 자리다.
      const more=box.children[slots-1];
      more.className='more';
      more.style.width=''; more.style.height=''; more.style.color='';
      more.textContent='+'+rest;
    }
  }catch(e){}
}
// 드러난 문양 수를 부모 속성 하나로 알린다. CSS 가 그 뒤의 칸을 덮는다.
function fgPaint(){
  const f=fgEl(); if(!f||!f.setAttribute) return;
  FG.shown = FG.settled ? Math.min(FG.struck,FG.need) : 0;
  f.setAttribute('data-shown', String(FG.veiled?FG.shown:FG.need));
  /* 048 §2③ — 「드러났다」가 곧 「섰다」다. 앞에서 n 개가 서야 한다고 릴에 알린다.
     첫 타(정착 전)는 `shown` 이 0 이지만 **첫 릴은 그 순간 감속을 시작한다.** */
  try{ reelReveal(FG.veiled?Math.max(FG.shown,1):FG.need); }catch(e){}
  if(FG.veiled) f.setAttribute('data-veiled','1'); else f.removeAttribute('data-veiled');
  /* ⑤-4 「이은 고리」 — 드러난 문양 가운데 앞 문양과 같은 칸을 강조한다. CSS 클래스
     하나뿐이고(새 연출 없음), **드러난 칸만** 본다(가려진 칸을 보면 결과가 샌다). */
  try{
    const ks=[...document.querySelectorAll('#reels .reel')];
    const lim=FG.veiled?FG.shown:ks.length;
    ks.forEach((e,i)=>{
      const on = i>0 && i<lim && e.dataset && ks[i-1].dataset
              && e.dataset.p!=null && e.dataset.p===ks[i-1].dataset.p;
      e.classList.toggle('echo',!!on);
    });
  }catch(e){}
}
// 못 쳤을 때의 거절 — 새 팝업·새 글자 없이 막대 하나를 깜빡인다(§2⑤-1).
function fgDeny(why){
  FG.blocked[why]=(FG.blocked[why]||0)+1;
  try{ sfx('sfx-tink'); }catch(e){}     // 049 §2③ — 막힌 탭도 손맛이 있어야 한다

  try{
    const el = why==='charge' ? document.getElementById('therm')
                              : document.getElementById('qband');
    if(!el||!el.classList) return;
    el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
    setTimeout(()=>{ try{ el.classList.remove('deny'); }catch(e){} }, 700);
  }catch(e){}
}
/* 049 §2⑥ — 탭 시각을 재려면 그 `PointerEvent` 가 필요하다. 서명을 바꾸지 않고
   (부르는 곳이 여럿이다) 직전 사건을 한 칸에 둔다 — 없으면 지금 시각으로 본다. */
let strikeEv=null;
function strikeAt(ev){ strikeEv=ev||null; }
/* 한 타. `src` = 'hand' | 'apprentice' | 'idle'. */
function strike(src){
  if(typeof PLAT==='object' && PLAT && PLAT.paused) return;
  // 048 2차 ① — 「사람 입력」은 탭·키다. 견습생·마무리 타격은 여기를 안 지난다.
  if(src==='hand'){ reelTouch();
    // 049 §2⑥ — **손 탭만** 판정한다. 견습생·마무리 타격은 판정하지 않는다(R3).
    try{ rhyJudge(strikeEv); }catch(e){} }
  if(!FG.veiled){
    /* 048 §2①④ — **이 주기가 공짜인가는 「처음 시작한 쪽」이 정한다.** 손이 열면
       공짜, 견습생이 열면 충전 1. 중간에 손이 섞여도 그 주기의 값은 안 바뀐다
       (`'idle'` 마무리는 주기 안에서만 나므로 여기를 지나지 않는다). */
    const free=(src==='hand');
    // 033 ②: 가득 + 정리 꺼짐이면 치는 대신 비교 팝업. 예전 그대로다.
    if(S.queue.length>=qmax() && !autoResOn()){ openCmp(); return; }
    if(!free && S.charge<1){ fgDeny('charge'); return; }   // 손은 충전을 안 본다
    if(S.queue.length>=qmax()){ fgDeny('queue'); return; } // 가득이면 손도 선다(원칙 8 · S2)
    fgQAt=S.queue.length;
    spin(free);
    // **시작했는지는 깃발이 아니라 `spinning` 으로 안다** — spin() 자신이
    // 조건을 다시 보고 아무 일도 안 할 수 있다.
    if(!spinning){ fgDeny((!free&&S.charge<1)?'charge':'queue'); return; }
    FG.free=free;
    FG.autoCycle=!free;                      // 049 F2 — 자동이 연 주기인가
    if(free) FG.handMade++;                  // 048 2차 ③ — 손이 연 주기 (R3 가 쓸 계수기)
    FG.veiled=true; FG.settled=false; FG.need=REELS(); FG.struck=1; FG.qHeld=0;
    try{ reelsStart(); }catch(e){}  // 048 — 릴이 돈다. 이 타가 곧 첫 멈춤이다.
    fgWatch();                      // 주기가 열릴 때만 감시를 켠다(위 ⚠)
  }else{
    FG.struck++;
    /* 049 F2 — **손이 섞이면 그 주기는 손의 것이다.** 자동으로 열린 주기라도 사람이
       치는 순간부터는 굴리고 차례로 세운다(판정 절: 「손이 섞인 주기는 지금처럼」). */
    if(src==='hand' && FG.autoCycle){ FG.autoCycle=false; try{ reelsStart(); }catch(e){} }
  }
  FG.strikes[src]=(FG.strikes[src]||0)+1;
  FG.lastHitAt=Date.now();
  fgBlow();                       // 매 타: 기존 불티 1회 + 짧은 셰이크
  fgPaint();
  if(FG.settled && FG.struck>=FG.need) fgFinish();
  else fgArmIdle();
}
/* 매 타의 손맛 — **기존** 불티·셰이크를 재사용한다(새 연출 금지 · R2 몫). */
function fgBlow(){
  try{
    const V=globalThis.__view, an=V&&V.anvil;
    if(typeof globalThis.__fxBurst==='function' && an)
      globalThis.__fxBurst(V&&V.reducedMotion?2:7, an.x, an.y, .55);
    if(typeof globalThis.__shake==='function') globalThis.__shake(V&&V.reducedMotion?0:3);
    if(typeof globalThis.__canvasWake==='function') globalThis.__canvasWake(420);
  }catch(e){}
}
/* ⑤-8 손 놓으면 마저 친다 — 주기가 영원히 걸려 있는 일은 없다. */
function fgArmIdle(){
  if(typeof setTimeout!=='function') return;
  if(fgIdleT) clearTimeout(fgIdleT);
  fgIdleT=setTimeout(function step(){
    if(!FG.veiled) return;
    FG.idleFinish++;
    const left=Math.max(0,FG.need-FG.struck);
    let i=0;
    const beat=()=>{ if(!FG.veiled) return;
      strike('idle');
      if(FG.veiled && ++i<left) setTimeout(beat,FORGE_IDLE_STEP); };
    beat();
  }, FORGE_IDLE_MS);
}
/* ⑤-7 마무리 — 남은 문양을 다 열고 `#msg` 를 보인다. */
function fgFinish(){
  if(fgIdleT){ clearTimeout(fgIdleT); fgIdleT=null; }
  FG.veiled=false; FG.settled=false; FG.qHeld=0; FG.struck=0; FG.shown=FG.need;
  FG.made++;
  fgPaint();
  // ⑤-5 미뤄 둔 정렬 연출을 **여기서** 꺼낸다 — 마지막 문양이 드러나는 순간이다.
  if(fgPending){ const q=fgPending; fgPending=null;
    // 048 §2③ — 기준선을 **등급색**으로 켠다. 색은 이미 만들어진 장비의 등급이고
    // 새 색표를 만들지 않는다(GC — 원칙: 등급색 15종은 한 곳에서만 난다).
    try{ const rs=document.getElementById('reels');
      if(rs&&rs.style&&q.g) rs.style.setProperty('--payc',GC[q.g]||'var(--ember)'); }catch(e){}
    try{ if(typeof globalThis.__hitFx==='function') globalThis.__hitFx(q.hits,q.g); }catch(e){} }
  try{ renderFast(); fgDots(true); }catch(e){}
}
/* ⑤-2 정착 감지 — `spinning` 참→거짓을 rAF 로 본다. 정착 전에 쌓인 타격은
   그 순간 한꺼번에 반영된다(빨리 세 번 친 사람도 결과가 맞다 · 검사 K2). */
/* ══ 047 3차 ② — 정착 감지는 **상태**를 본다 (rAF 는 보조일 뿐) ═══════════
   2차까지는 `requestAnimationFrame` **에만** 기대 「`spinning` 이 참→거짓이 되는
   순간」을 잡았다. 그래서 rAF 가 멈추는 판(숨은 탭 · 화면 밖 iframe)에서는
   **주기가 가려진 채 영원히 서고 견습생이 아무것도 못 만들었다** — 검증 실측:
   rAF 를 멈춘 20초에 041 은 `spin()` 40회, 047 은 **0회**. §2⑤-8 「주기가 영원히
   걸려 있는 일은 없다」가 거기서 깨졌다.

   고치는 법은 «순간»을 «상태»로 바꾸는 것이다: 주기가 열려 있고(`veiled`)
   아직 정착 안 했고(`!settled`) `spinning` 이 거짓이면 — **어떻게 거기 왔든** —
   정착이다. 가장자리(이전 값)를 추적할 필요가 없다. 주기는 `spinning` 이 참일
   때만 열리므로(`strike()` 가 그렇게 연다) 이 식은 열자마자 참이 되지 않는다.

   그래서 **250ms 틱이 정착을 책임지고**, rAF 는 「250ms 를 기다리지 않고 빨리
   보이게」 하는 보조로만 남는다. 보조는 정착하는 순간 스스로 멈춘다 — 검증이
   짚은 「제련 중 rAF +51%」가 여기서 줄어든다(주기 내내가 아니라 420ms 만 돈다). */
function fgSettle(){
  if(!FG.veiled || FG.settled || spinning) return false;
  FG.settled=true;
  FG.qHeld=Math.max(0,S.queue.length-fgQAt);       // 자동 판매면 0
  fgPaint();
  if(FG.struck>=FG.need) fgFinish(); else { try{ renderFast(); }catch(e){} }
  return true;
}
function fgWatch(){
  if(typeof requestAnimationFrame!=='function') return;   // rAF 가 없어도 틱이 든다
  if(fgRaf!==null) return;                                // 이미 돌고 있다
  const loop=()=>{
    fgSettle();
    if(FG.settled || !FG.veiled){ fgRaf=null; return; }    // 할 일이 끝났다
    fgRaf=requestAnimationFrame(loop);
  };
  fgRaf=requestAnimationFrame(loop);
}

function popAutores(el){
  try{
    if(!el||!el.classList||typeof el.classList.add!=='function') return;
    const still=(typeof matchMedia==='function')
      && matchMedia('(prefers-reduced-motion:reduce)').matches;
    el.classList.remove('pop','popStill');
    void el.offsetWidth;            // 같은 판에서 다시 틀어도 처음부터
    el.classList.add(still?'popStill':'pop');
    setTimeout(()=>{ try{ el.classList.remove('pop','popStill'); }catch(e){} }, still?1200:1250);
  }catch(e){}
}

