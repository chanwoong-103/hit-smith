/* ══════════════════════════════════════════════════════════════════════════
   048 §2③ — 릴을 **진짜 슬롯처럼** 돌린다 (VIEW 전용)

   047 의 가림막(`?` 덮개)이 하던 일을 **돌아가는 릴**이 대신한다. 「누를 때마다
   하나씩 선다」는 047 §2⑤ 의 상태 기계 그대로다 — 타격 = 멈춤. 바뀌는 것은 그
   사이에 사람이 **보는 것**뿐이고, CORE 와의 산술은 한 글자도 안 움직인다.

   ⚠ **픽셀을 재지 않는다.** 띠는 창 높이의 300%, 칸 하나가 정확히 ⅓ 이고 위치는
     `translateY(u×33.333%)` 로만 준다. 그래서 `pos` 의 단위가 **칸**이다 — 창
     크기·배율·회전이 바뀌어도 다시 잴 것이 없다(009 「치수는 정지 상태에서」가
     걸리는 자리를 아예 안 만든다).
   ⚠ 띠는 **칸 셋**뿐이다(위·가운데·아래). 한 칸을 지날 때마다 문양만 갈아 끼운다
     (`img.src` 교체 — 스프라이트는 이미 캐시다). 12칸짜리 긴 띠를 만들면 릴마다
     DOM 이 12개씩 늘고 soak 의 DOM 수가 그만큼 뛴다.
   ⚠ **결과를 미리 흘리지 않는다.** CORE 는 420ms 에 `drawReel()` 로 결과를 쓰고
     맞은 칸에 `.hit` 를 단다. 돌고 있는 릴에서는 그것을 **받아만 두고**(`want`)
     화면에는 안 쓴다. `.hit` 의 생김새도 `.done`(= 선 릴)일 때만 든다 — 안 그러면
     첫 타에 테두리가 먼저 빛나서 「세 번 두드리면 하나」가 깨진다(047 K5).
   ⚠ **도는 동안만 rAF 가 돈다.** 다 서면 루프를 스스로 끊는다(원칙 1 · 011 절전).
     `__view.perf.reelFrames` 가 그것을 말한다 — 쉬는 릴은 프레임을 안 먹는다.
   ⚠ reducedMotion 이면 띠가 **안 흐른다**. 지금의 `heat`(칸이 달아오름)만 돌고
     탭에 바로 선다 — 튕김·셰이크 없음.
   ══════════════════════════════════════════════════════════════════════════ */
const SYMN=6;                                  // 문양 = 장비 부위 6종 (원칙 7 — 도박 문양 아님)
const symAbove=s=>(s+SYMN-1)%SYMN;             // 띠는 아래로 흐른다 → 위에서 들어오는 문양
const REEL_GAP=120;                            // 차례로 서는 간격 (한꺼번에 서면 슬롯이 아니다)
/* 멈춤 감속 (120~220ms · 릴마다 다르게). ⚠ **커지는 순서여야 한다.** 차례로 세우는
   간격은 「서기 시작하는」 시각 기준인데, 사람이 보는 것은 「다 선」 시각이다. 뒤 릴이
   더 빨리 서면 그 차이만큼 둘이 겹쳐 보인다 — 실측: [150,185,135] 로 두니 둘째와
   셋째가 **70ms 차**로 거의 같이 섰다(S3b 가 그것을 울었다). 커지는 순서면 다 선
   시각의 간격이 REEL_GAP 이상으로 **보장**된다. */
const REEL_DUR=[140,160,175,190,205];
const REEL_DUR_TENSE=500;                      // 리치 — 마지막 릴만 길게
const REEL_PEND_MS=420;                        // 첫 릴: 결과가 정해지기까지 = CORE 의 420ms
const REEL_REST_MS=10000;                      // 손도 견습생도 10초 안 닿으면 쉰다
/* ══ 048 2차 ① — 「보고 있을 때만 천천히 돈다」 ══════════════════════════
   사용자 결정(2026-10-23). 1차의 제안 ③ 에 대한 답이다: 주기 사이에 릴을 계속
   돌리는 「끌어들이는 회전」은 원칙 1(절전)과 부딪히는데, **조건을 붙이면** 그
   비용이 사람이 보고 있는 동안으로 한정된다.
     · 마무리 뒤 1.5초는 **결과에 서 있는다** — 사람이 읽는 시간이다(`#msg` 도 그대로).
     · 그 뒤 보통 회전의 1/6 로 천천히 돈다. **잔상 없음 · 띠만 흐른다.**
     · 탭이 보이고(`!document.hidden`) **마지막 사람 입력 뒤 30초 안**일 때만.
       그 밖에는 지금의 `rest` — rAF 를 끊는다(S5).
     · 고정된 릴은 안 돈다. reducedMotion 이면 아예 없다.
   ⚠ 「사람 입력」은 **탭·키**다. 견습생 타격은 아니다 — 견습생만 도는 판에서는
     견습생 주기가 릴을 돌리므로 따로 돌 이유가 없고, 돌면 그건 방치 중 상시
     애니메이션이라 원칙 1 위반이다.
   ⚠ 도는 동안에는 `.done` 을 뗀다 — CORE 가 단 `.hit` 테두리가 **지금 창에 있는
     문양과 다른 것**을 가리키게 되기 때문이다. 그래서 1.5초를 먼저 준다. */
const REEL_DRIFT_WAIT=1500;                    // 결과를 읽는 시간
const REEL_IDLE_MS=30000;                      // 마지막 사람 입력 뒤 이만큼만
const REEL_DRIFT_DIV=6;                        // 보통 회전의 1/6
const REEL_V=[15,13.4,16.6,14.2,15.8];         // 칸/초 — 똑같이 돌면 기계처럼 안 보인다
const REEL_V_TENSE=4.5;                        // 리치: 느리게 돌며 빛난다
const REEL_PHASE=[0,.37,.71,.19,.53];          // 처음 위상도 흩어 둔다
const REEL_MIN_TRAVEL=2.2;                     // 멈출 때 최소 이만큼은 더 지나간다(칸)
// ease-out-back — 기준선을 **살짝 지나쳤다가 튕겨 돌아온다**(§2③).
const BACK_C1=1.70158, BACK_C3=BACK_C1+1;
const backOut=u=>1+BACK_C3*Math.pow(u-1,3)+BACK_C1*Math.pow(u-1,2);

const RL=[];                 // 릴 하나당 상태 하나 (아래 reelSync 가 길이를 맞춘다)
let reelRaf=null, reelLastAt=0, reelFrames=0;
let reelHumanAt=0, reelStillAt=0;   // 048 2차 ① — 마지막 사람 입력 · 마지막 릴이 선 때
// 사람이 만졌다. 탭(장면·문양 칸·「+N」)과 키가 여기를 지난다 — 견습생은 안 지난다.
function reelTouch(){
  reelHumanAt=Date.now();
  // 049 §2① — **첫 사람 입력**에서 소리를 켠다. 첫 화면에는 아무것도 안 부른다.
  try{ if(!SND.boot) sndBoot(); }catch(e){}
  try{ rhyLoop(); }catch(e){}            // 049 §2⑥ — 바늘은 사람이 볼 때만 돈다
}
const reelRed=()=>{ try{ return !!(globalThis.__view&&globalThis.__view.reducedMotion); }catch(e){ return false; } };
const reelHidden=()=>{ try{ return typeof document!=='undefined' && !!document.hidden; }catch(e){ return false; } };
function reelEls(){ try{ return [...document.querySelectorAll('#reels .reel')]; }catch(e){ return []; } }

/* 창 안의 세 칸(`img`)을 집어 둔다. 캔버스가 없는 판(하네스)에서는 `img` 가 없다. */
function reelImgs(el){ try{ return [...el.querySelectorAll('.sy img.px')]; }catch(e){ return []; } }
function reelPutSyms(r){
  const im=r.im; if(!im||im.length!==3) return;
  const c=r.sym, tri=[symAbove(c),c,(c+1)%SYMN];
  for(let k=0;k<3;k++){
    const u=spriteURL(PARTS[tri[k]].id,0,r.sc);
    if(u && im[k] && im[k].getAttribute('src')!==u) im[k].setAttribute('src',u);
  }
}
/* 릴 하나를 **선 상태**로 그린다. `drawReel()` 이 정지 중일 때 부르는 자리다. */
function reelBuild(el,sym){
  const sc=REEL_SCALE();
  el.innerHTML=`<i class="fl"></i><i class="sk"></i>`
    + `<span class="win"><span class="strip">`
    + [symAbove(sym),sym,(sym+1)%SYMN].map(s=>`<span class="sy">${icoPix(PARTS[s].id,0,sc)}</span>`).join('')
    + `</span><i class="pay"></i></span>`
    + `<div class="nm">${t('part.'+PARTS[sym].id)}</div>`;
  return sc;
}
function reelIndexOf(el){ const ks=reelEls(); return ks.indexOf(el); }
/* RL 의 길이를 지금 릴 수에 맞춘다(승천으로 릴이 늘 때). */
function reelSync(){
  const ks=reelEls();
  while(RL.length>ks.length) RL.pop();
  for(let i=0;i<ks.length;i++){
    const p=(ks[i].dataset&&ks[i].dataset.p!=null)?+ks[i].dataset.p:0;
    if(!RL[i] || RL[i].el!==ks[i])
      RL[i]={st:'rest', pos:0, sym:p, sym0:p, v:0, want:null, tens:false,
             t0:0, dur:0, p0:0, T:0, sc:REEL_SCALE(), im:reelImgs(ks[i]), el:ks[i]};
    if(!RL[i].im.length) RL[i].im=reelImgs(ks[i]);
    // 처음 보는 칸에도 `.done` 을 단다 — 안 그러면 선 릴의 `.hit` 가 안 보인다.
    if(!ks[i].classList||!ks[i].classList.contains('done')) reelClass(RL[i]);
  }
  return ks;
}
function reelShow(r){
  if(!r.el) return;
  const st=r.el.querySelector&&r.el.querySelector('.strip');
  if(!st||!st.style) return;
  const w=Math.floor(r.pos), u=r.pos-w, s=((r.sym0+5*w)%SYMN+SYMN)%SYMN;
  if(s!==r.sym){ r.sym=s; reelPutSyms(r); }
  st.style.transform='translateY('+(u*(100/3)).toFixed(3)+'%)';
}
function reelClass(r){
  const e=r.el; if(!e||!e.classList) return;
  const roll=(r.st==='spin'||r.st==='slow'||r.st==='queued'||r.st==='land');
  const dr=(r.st==='drift');                        // 048 2차 ① — 천천히 도는 중
  e.classList.toggle('rolling',roll);
  e.classList.toggle('drifting',dr);
  e.classList.toggle('tense',!!r.tens && roll);
  e.classList.toggle('done',!roll && !dr);          // `.hit` 의 생김새는 **선** 릴에만 든다
  reelMark();
}
/* 048 §2③ — 「`#msg` 는 **마지막 릴이 선 뒤에** 보인다」. 마무리(`fgFinish`)는 마지막
   타가 들어온 순간에 나는데, 릴은 그 뒤로도 0.12초 간격 × 감속만큼 더 선다 —
   그 사이에 글이 먼저 떴다(K4 실측: 마무리 시각에 상태 [stopped,stopped,land]).
   `FG.veiled` 를 늘리면 자동 정리·대기열 수까지 늦춰지므로(K6) **글만** 늦춘다. */
/* ══ 049 F4 — 「맞는다」는 **둘이 같은 문양으로 섰을 때부터** ══════════════
   048 은 `.reel.done.hit` 하나로 켰다. CORE 는 420ms 에 맞은 칸 **전부**에 `.hit` 를
   달아 두므로, 첫 릴이 서는 순간 그 한 칸이 곧바로 빛난다 — 아직 아무것도 안 맞았는데
   「맞는다」가 먼저 켜지는 것이다(048 검증 제안). 선 칸 중 `.hit` 가 **둘 이상**일
   때만 부모에 `data-match` 를 달고, 생김새는 그 안에서만 든다.
   ⚠ 세는 것은 **선 칸**뿐이다 — 아직 도는 칸의 `.hit` 를 세면 결과가 샌다(047 K5). */
function reelMatchMark(){
  try{ const f=fgEl(); if(!f||!f.setAttribute) return;
    let n=0;
    for(const r of RL){ const e=r&&r.el;
      if(!e||!e.classList||!e.classList.contains('done')) continue;
      if(e.classList.contains('hit')) n++; }
    if(n>=2) f.setAttribute('data-match','1'); else f.removeAttribute('data-match');
  }catch(e){}
}
let sfxMadeSeen=0;
function reelMark(){
  reelMatchMark();
  const roll=RL.some(r=>r&&(r.st==='spin'||r.st==='slow'||r.st==='queued'||r.st==='land'));
  // 마지막 릴이 **선 그 순간**을 적는다 — 「마무리 뒤 1.5초」가 여기서부터다.
  if(!roll && reelWasRolling){ reelStillAt=Date.now();
    // 049 §2③ — 그 순간이 곧 「장비가 나왔다」다. 주기당 한 번만 낸다.
    try{ if(FG.made>sfxMadeSeen){ sfxMadeSeen=FG.made; sfxMade(); } }catch(e){} }
  reelWasRolling=roll;
  try{ const f=fgEl(); if(!f||!f.setAttribute) return;
    /* ⚠ 천천히 도는 것(`drift`)은 여기 **안 센다.** 「`#msg` 도 그대로」(2차 ①)라
       글을 숨기면 안 되고, `data-rolling` 은 글을 숨기는 못이다. */
    if(roll) f.setAttribute('data-rolling','1'); else f.removeAttribute('data-rolling');
  }catch(e){}
}
let reelWasRolling=false;
/* 결과가 나왔는가. CORE 는 420ms 뒤에 `drawReel()` 로 `dataset.p` 를 쓴다 —
   그 전의 `dataset.p` 는 **지난 주기의 문양**이라 그걸 보고 세우면 틀린 것에 선다. */
const reelReady=()=>(!FG.veiled || FG.settled);
/* 주기가 열릴 때 — 고정된 릴 말고 전부 돌린다. */
function reelsStart(){
  const ks=reelSync(); if(!ks.length) return;
  reelLastAt=0;
  /* ══ 049 F2 — **자동 제련 주기는 릴을 굴리지 않는다** ════════════════════
     048 의 자동은 손과 똑같이 굴리고 0.12초씩 차례로 세웠다. 그런데 서두름은 한 박
     (500ms)에 한 주기를 끝내므로 뒤쪽 칸이 서는 시각이 **다음 박보다 늦다** — 그래서
     칸이 「선 상태」를 거의 못 거치고 부위 글자가 안 보였다(실측: 자동 서두름 10초에
     칸별로 글자가 보인 시간 43 · 41 · 0 · 0 %, 네 칸 동시 0%).
     계획 판정(2026-10-24): 자동은 **박에 한 번 들썩**하고 정착하는 순간 **모든 칸이
     한꺼번에 «쾅»** 선다. 그 사이엔 **앞 결과와 글자가 그대로** 보인다.
     「하나에 하나」는 **손 탭의 규칙**이다 — 자동에 걸 이유가 없다. */
  /* ⚠ 앞 주기의 **차례 세우기가 아직 돌고 있을 수 있다**(릴이 많고 빨리 치면 흔하다).
     그대로 두면 그 릴들이 새 주기 동안 옛 결과로 서고, 새 주기의 `reelReveal()` 은
     「이미 섰다」며 건너뛴다 — 주기당 선 릴이 하나 모자라고 소리도 그만큼 샌다
     (실측: 3릴 10주기에 선 릴 20 · thud 4). 새 주기를 열기 전에 **끝낸다.** */
  reelFinishPending();
  if(FG.autoCycle){ reelNudgeAll(); return; }
  for(let i=0;i<ks.length;i++){
    const r=RL[i];
    if(i===S.lockIdx){ r.st='locked'; r.tens=false; reelClass(r); continue; }
    if(r.st==='land'||r.st==='slow'||r.st==='queued'||r.st==='spin'){ reelClass(r); continue; }
    /* 048 2차 ① — **천천히 돌던 릴은 자리를 안 바꾼다.** `pos`·`sym0` 를 다시 박으면
       띠가 한 칸 튀어, 「돌고 있는데 탭하니 순간이동했다」로 보인다. 속도만 올린다. */
    if(r.st!=='drift'){ r.sym0=r.sym; r.pos=REEL_PHASE[i%REEL_PHASE.length]; }
    r.want=null; r.tens=false;
    r.v=REEL_V[i%REEL_V.length];
    r.st='spin';
    reelClass(r);
  }
  reelLoop();
}
/* 049 — 앞 주기에서 아직 서는 중인 릴을 그 자리에서 끝낸다(옛 결과 그대로). */
function reelFinishPending(){
  try{
    for(let i=0;i<RL.length;i++){
      const r=RL[i], e=r&&r.el; if(!e) continue;
      if(r.st!=='queued'&&r.st!=='land'&&r.st!=='slow') continue;
      const want=(e.dataset&&e.dataset.p!=null)?+e.dataset.p:null;
      if(want==null||isNaN(want)){ r.st='stopped'; reelClass(r); continue; }
      r.pos=0; r.sym0=want; r.sym=-1; r.st='stopped'; r.tens=false;
      reelShow(r); reelLabel(r); reelClass(r);
      try{ sfxReelStop(i); }catch(x){}
    }
  }catch(e){}
}
/* 049 F2 — 박에 한 번 **들썩**. 칸은 선 채로 있고 짧게 흔들릴 뿐이다(굴리지 않는다). */
function reelNudgeAll(){
  try{
    for(let i=0;i<RL.length;i++){
      const r=RL[i], e=r&&r.el; if(!e||!e.classList) continue;
      if(r.st==='locked') continue;
      if(r.st==='rest') { r.st='stopped'; reelClass(r); }   // 쉬고 있었으면 깨워만 둔다
      e.classList.remove('nudge'); void e.offsetWidth; e.classList.add('nudge');
      setTimeout(()=>{ try{ e.classList.remove('nudge'); }catch(x){} },180);
    }
  }catch(e){}
}
/* 049 F2 — 정착하는 순간 **모든 칸이 새 결과로 한꺼번에** 선다. 굴리지 않았으므로
   내려앉을 길이 없다 — 그 자리에서 문양만 바뀌고 한 번 «쾅» 한다. */
function reelSlamAll(){
  try{
    for(let i=0;i<RL.length;i++){
      const r=RL[i], e=r&&r.el; if(!e) continue;
      if(r.st==='locked') continue;
      const want=(e.dataset&&e.dataset.p!=null)?+e.dataset.p:null;
      if(want==null||isNaN(want)) continue;
      r.pos=0; r.sym0=want; r.sym=-1; r.st='stopped'; r.tens=false;
      reelShow(r); reelLabel(r); reelClass(r);
      if(!reelRed()&&e.classList){ e.classList.remove('slam'); void e.offsetWidth; e.classList.add('slam');
        setTimeout(()=>{ try{ e.classList.remove('slam'); }catch(x){} },380); }
    }
    reelMatchMark();
    try{ sfxSlam(); }catch(e){}
  }catch(e){}
}
/* 047 의 「드러난 문양 수」를 릴로 옮긴 것 — 앞에서 n 개가 **서 있어야 한다.**
   정착 순간 세 타가 한꺼번에 반영돼도 한 번에 서지 않는다: 0.12초씩 벌려 세운다. */
function reelReveal(n){
  const ks=reelSync(); if(!ks.length) return;
  // 049 F2 — 자동 주기: 차례 세우기가 없다. 정착하면 한꺼번에 «쾅».
  if(FG.autoCycle){ if(reelReady()) reelSlamAll(); return; }
  const now=Date.now();
  for(let i=0;i<n && i<ks.length;i++){
    const r=RL[i];
    /* ⚠ `slow`(결과를 기다리며 감속 중)는 **건너뛰지 않는다.** 건너뛰면 그 릴이
       스스로 내려앉고, 그 시각이 차례 세우기의 격자 밖이라 둘째 릴과 겹쳐 선다
       (실측: 정착 순간 첫째와 둘째가 16ms 차). 세우는 시각은 **여기 한 곳**이
       정한다 — `queued` 로 찍어 두 번 잡히지 않게 한다. */
    if(!r||r.st==='stopped'||r.st==='locked'||r.st==='land'||r.st==='queued') continue;
    /* ══ 049 F1 — 격자는 **한꺼번에 풀리는 묶음에만** 쓴다 ════════════════════
       048 은 `max(now, reelLastAt+REEL_GAP)` 로 **언제나** 0.12초 격자에 실었다.
       그런데 `reelLastAt` 은 한 번 현재보다 앞서면 계속 앞선 채로 간다 — 그러면
       그 뒤의 탭은 **탭 시각이 아니라 격자**에 실린다. 릴이 5개면 격자가 훨씬 멀리
       달아난다(실측 380×820·릴5·탭 180ms 간격: 탭 0·233·467·697·935ms 인데
       선 릴 650·799·932·1065·1214ms — 130ms 기관총이 탭과 따로 돈다. 사람 눈에는
       「한 번에 두 개씩 선다」로 보인다 — 사용자 피드백 §0 이 그것이다).
       고치는 법: 격자는 **아직 서는 중인 릴이 있을 때만** 민다. 묶음(정착 순간 한꺼번에
       풀리는 쌓인 타)은 예전 그대로 0.12초씩 벌어지고, 혼자 온 탭은 **그 자리에서** 선다. */
    const pend=RL.some(x=>x&&(x.st==='queued'||x.st==='land'));
    const at=pend?Math.max(now, reelLastAt+REEL_GAP):now;
    reelLastAt=at;
    r.st='queued'; reelClass(r);
    const d=at-now;
    if(d<=0) reelLandList([i]);
    else if(typeof setTimeout==='function') setTimeout(()=>{ try{ reelLandList([i]); }catch(e){} }, d);
    else reelLandList([i]);
  }
  reelLoop();
}
/* 250ms 틱의 안전망 — rAF 가 멈춘 판·숨은 탭에서도 릴이 결과를 보인다. */
function reelPump(){
  try{
    // 숨은 탭: 그 자리에 세운 **뒤에도** 아래 판정을 지난다 — 그래야 `rest` 로 내려간다.
    if(reelHidden()){ reelSnapAll(); reelIdleCheck(); return; }
    if(FG.veiled) reelReveal(Math.max(FG.shown,1));
    /* rAF 가 안 도는 판에서 돌고 있는 릴이 남으면 그 자리에 세운다.
       ⚠ **주기 밖이라고 무조건 세우면 안 된다** — 마무리 뒤 0.12초 간격으로
         차례로 서는 중일 수 있고, 그걸 틱이 덮치면 한꺼번에 서 버린다(S3). */
    if(reelRaf===null && RL.some(r=>r&&(r.st==='spin'||r.st==='slow'||r.st==='queued'||r.st==='land')))
      reelSnapAll();
    reelIdleCheck();
  }catch(e){}
}
/* 이 릴을 세워 달라 — **릴 목록을 받는다.** 046 §7-d(R3)의 「바깥 두 릴이 한 탭에
   같이 «쾅» 선다」가 이 함수를 그대로 쓴다. 048 에서 부르는 곳은 한 칸짜리뿐이다. */
function reelLandList(idxs){
  for(const i of idxs){
    const r=RL[i]; if(!r) continue;
    if(r.st==='stopped'||r.st==='locked') continue;
    const el=r.el, want=(el&&el.dataset&&el.dataset.p!=null)?+el.dataset.p:null;
    // 아직 결과가 안 정해졌다(첫 릴의 420ms) → **감속만** 한다. 정착하면 내려앉는다.
    if(!reelReady() || want==null || isNaN(want)){ r.st='slow'; reelClass(r); continue; }
    if(reelRed()){ r.pos=0; r.sym0=want; r.sym=-1; r.st='stopped'; r.tens=false;
                   reelShow(r); reelLabel(r); reelClass(r); continue; }
    // 몇 칸을 더 지나야 그 문양이 기준선에 오는가 (k ≡ 현재−목표 mod 6)
    const w=Math.floor(r.pos), cur=((r.sym0+5*w)%SYMN+SYMN)%SYMN;
    let k=((cur-want)%SYMN+SYMN)%SYMN;
    let T=(w+k)-r.pos;                       // 목표까지의 거리(칸)
    while(T<REEL_MIN_TRAVEL) T+=SYMN;        // 너무 가까우면 한 바퀴 더 — 「섰다」가 보이게
    r.p0=r.pos; r.T=T; r.t0=(typeof performance==='object'&&performance.now)?performance.now():Date.now();
    r.dur=r.tens?REEL_DUR_TENSE:REEL_DUR[i%REEL_DUR.length];
    r.st='land'; reelClass(r);
  }
  reelLoop();
}
function reelLabel(r){
  try{ const n=r.el.querySelector('.nm');
    if(n) n.textContent=t('part.'+PARTS[r.sym].id); }catch(e){}
}
/* 048 2차 ① — 고정이 걸리거나 풀리면 **릴 상태도 따라간다.** `lockHold()` 는 지금까지
   CSS 클래스만 토글했는데, 그러면 고정된 칸의 `RL[i].st` 가 `stopped` 로 남아 천천히
   돌기 시작한다(실측 [drift,**drift**,stopped] — 고정한 칸이 돌았다). */
function reelLockSync(){
  const ks=reelSync();
  for(let i=0;i<ks.length;i++){
    const r=RL[i]; if(!r) continue;
    if(i===S.lockIdx){ if(r.st!=='locked'){ r.st='locked'; reelClass(r); } }
    else if(r.st==='locked'){ r.st='stopped'; reelClass(r); }
  }
}
/* 「리치」 — 선 릴이 전부 같은 문양이고 남은 릴이 하나면 그 릴이 느려지며 빛난다.
   ⚠ **목표 문양은 안 본다.** 이미 선 것만 보고 정한다 — 결과를 미리 아는 연출은
     연출이 아니라 누설이다. 결과는 CORE 가 이미 정했고 이 함수는 그것을 모른다. */
function reelTension(){
  const ks=reelSync(); let done=[], left=[];
  for(let i=0;i<ks.length;i++){
    const r=RL[i];
    if(r.st==='stopped'||r.st==='locked') done.push(r.sym);
    else left.push(i);
  }
  const same=done.length>=2 && done.every(s=>s===done[0]);
  for(const i of left){ const r=RL[i];
    const on=same && left.length===1 && (r.st==='spin'||r.st==='slow');
    if(on===r.tens) continue;
    r.tens=on; if(on) r.v=REEL_V_TENSE; else r.v=REEL_V[i%REEL_V.length];
    reelClass(r);
  }
}
/* 한 프레임. 도는 릴이 하나도 없으면 스스로 끊는다. */
function reelStep(now){
  let live=false, moved=false;
  for(let i=0;i<RL.length;i++){
    const r=RL[i]; if(!r||!r.el) continue;
    if(r.st==='spin'||r.st==='queued'||r.st==='drift'){
      if(reelRed()) continue;                       // 흐르지 않는다 — 루프도 안 산다
      r.pos+=r.v*(1/60); reelShow(r); live=true; moved=true; }
    else if(r.st==='slow'){
      // 결과를 기다리는 동안의 감속 — REEL_PEND_MS 에 걸쳐 바닥 속도까지 내려간다
      // 세우는 시각은 `reelReveal()` 한 곳이 정한다 — 여기서 스스로 내려앉지 않는다.
      if(reelRed()) continue;
      r.v=Math.max(r.v*0.955, 3.2); r.pos+=r.v*(1/60); reelShow(r); moved=true; live=true;
    }
    else if(r.st==='land'){
      const u=Math.min(1,(now-r.t0)/Math.max(1,r.dur));
      r.pos=r.p0+r.T*backOut(u); reelShow(r); moved=true;
      if(u>=1){ r.pos=r.p0+r.T; reelShow(r); r.st='stopped'; r.tens=false;
                reelLabel(r); reelClass(r); reelHitFlash(r); reelTension();
                try{ sfxReelStop(i); }catch(e){} }
      else live=true;
    }
  }
  if(moved){ reelFrames++;
    // 쉬는 릴이 **진짜** 쉬는지는 이 수가 말한다(011 절전과 같은 창구).
    try{ const V=globalThis.__view; if(V&&V.perf) V.perf.reelFrames=reelFrames; }catch(e){} }
  return live;
}
function reelLoop(){
  if(typeof requestAnimationFrame!=='function') return;
  if(reelRaf!==null) return;
  const tick=()=>{
    const now=(typeof performance==='object'&&performance.now)?performance.now():Date.now();
    const live=reelStep(now);
    if(!live || reelHidden()){ reelRaf=null; if(reelHidden()) reelSnapAll(); return; }
    reelRaf=requestAnimationFrame(tick);
  };
  reelRaf=requestAnimationFrame(tick);
}
/* 탭이 숨거나 rAF 가 멈춘 판 — 그 자리에서 결과로 내려앉힌다(047 3차 ② 와 같은 결).
   화면이 멈춘 채 주기만 끝나 「돌고 있는 릴에 옛 문양」이 남는 것을 막는다. */
function reelSnapAll(){
  for(let i=0;i<RL.length;i++){
    const r=RL[i]; if(!r||!r.el) continue;
    if(r.st==='stopped'||r.st==='locked'||r.st==='rest') continue;
    const want=(r.el.dataset&&r.el.dataset.p!=null)?+r.el.dataset.p:null;
    if(want==null||isNaN(want)) continue;
    r.pos=0; r.sym0=want; r.sym=-1; r.st='stopped'; r.tens=false;
    reelShow(r); reelLabel(r); reelClass(r);
  }
}
/* 맞은 칸: 선 그 순간에만 번쩍인다(CORE 가 단 `.hit` 는 `.done` 일 때만 보인다). */
function reelHitFlash(r){
  try{ if(!r.el.classList.contains('hit')) return;
    r.el.classList.remove('land'); void r.el.offsetWidth; r.el.classList.add('land');
    setTimeout(()=>{ try{ r.el.classList.remove('land'); }catch(e){} },420);
  }catch(e){}
}
/* ══ 048 2차 ① — 주기 밖의 릴이 「천천히 돈다 / 선다 / 쉰다」 중 어디인가.
   250ms 틱이 부른다. 세 상태의 뜻:
     `stopped` 결과에 서 있다(마무리 직후 1.5초 · 또는 돌 조건이 아닐 때)
     `drift`   천천히 돈다 — **사람이 보고 있고 30초 안에 만졌을 때만**
     `rest`    절전 — rAF 를 끊는다. 손도 견습생도 10초 안 닿았거나 조건 밖이다 */
function reelIdleCheck(){
  if(FG.veiled) return;
  /* ⚠ 마무리(`fgFinish`)는 마지막 **타**에 나는데 릴은 그 뒤로도 0.12초 간격으로 더
     선다(1차 ⑤-4). 그 사이는 `veiled` 가 이미 거짓이라, 이 줄이 없으면 **먼저 선 릴이
     주기가 끝나기도 전에 천천히 돌기 시작한다** — 실측 [drift,stopped,stopped].
     아직 서는 중인 릴이 하나라도 있으면 「마무리 뒤」가 아니다. */
  if(RL.some(r=>r&&(r.st==='spin'||r.st==='slow'||r.st==='queued'||r.st==='land'))) return;
  const now=Date.now();
  const human = now-(reelHumanAt||0);
  const still = now-(reelStillAt||0);
  const hit   = now-(FG.lastHitAt||0);
  // 돌 수 있는 조건 — 하나라도 어긋나면 안 돈다
  const may = !reelHidden() && !reelRed() && human<REEL_IDLE_MS;
  let drifting=false;
  for(let i=0;i<RL.length;i++){
    const r=RL[i]; if(!r) continue;
    if(r.st==='locked') continue;                 // 고정된 릴은 안 돈다
    if(r.st==='drift'){
      if(!may){ r.st='rest'; reelClass(r); } else drifting=true;
    } else if(r.st==='stopped'){
      if(may && still>=REEL_DRIFT_WAIT){          // 결과를 읽을 시간은 줬다
        r.st='drift'; r.v=REEL_V[i%REEL_V.length]/REEL_DRIFT_DIV; reelClass(r); drifting=true;
      } else if(!may && (reelHidden() || human>=REEL_IDLE_MS || hit>=REEL_REST_MS)){
        // 숨은 탭은 **즉시** 쉰다. 30초(사람 입력)·10초(아무 타격도 없음)는 그 다음 못이다.
        r.st='rest'; reelClass(r); }
    }
  }
  if(drifting) reelLoop();
}

