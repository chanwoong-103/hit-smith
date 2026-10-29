/* ══════════════════════════════════════════════════════════════════════════
   049 §2⑥ — 박자. 모루 밑 메트로놈 + 판정 게이지.

   **이번엔 보이고 판정하는 것까지다 — 판정이 게임에 주는 이득은 0.**
   그래서 이 절은 `S` 를 한 글자도 안 쓰고 CORE 를 안 부른다(검사 R5 가 그것을 잰다).
   R2b 가 여기에 보상(피버·「대장장이의 감!」·불씨)을 붙인다.

   ⚠ 049 2차 ④ 로 **시계는 하나다**(아래 `rhyNow`·`rhyRef`·`rhySlide` 의 긴 주석).
     그리고 재는 자는 `performance.now()` 하나 — 곡(`ctx.currentTime`)은 **기준**으로만
     쓰고, 그 기준 쪽으로 프레임마다 박의 0.4%씩 민다. 1차처럼 갈아타면 그 프레임에
     바늘이 튀고(~104ms), 오디오 시계로 직접 그리면 프레임마다 떨린다(6.4%).
   ⚠ 탭 시각은 `PointerEvent.timeStamp`(= `performance` 기준)로 온다 — 재는 자가
     그것 하나이므로 변환이 없다.
   ⚠ **판정은 릴 멈춤을 막지 않는다.** 어느 판정이든 탭은 그 릴을 세운다.
   ══════════════════════════════════════════════════════════════════════════ */
const RHY_BPM=120.15, RHY_BPM_FEVER=160.25;         // 051 ③ — 피버 곡은 더 빠른 박자
let RHY_BEAT=60/RHY_BPM;                            // 0.49938 초 · 피버 중엔 0.37441 초
const RHY_PERFECT=45, RHY_GREAT=90, RHY_GOOD=140;   // ms
const RHY_TICKS=6;                                  // 게이지에 남기는 눈금 수
const RHY_CAL_N=8;                                  // 「맞춰 보기」가 받는 탭 수
const RHY={ origin:null, clock:'perf', beat:0, phase:0, edge:-1, raf:null,
            last:{grade:'', ms:0}, counts:{perfect:0,great:0,good:0,miss:0},
            combo:0, best:0, ticks:[], bpm:RHY_BPM,
            offset:0, lat:0, cal:null, calDone:null, calTaps:null };  // 051 ① — 보정(ms) · 출력 지연(초)

/* ══ 051 ① — 박자 보정. **박은 «들리는» 시각에 있다** ═════════════════════════
   049 검증 실측: 바늘이 들리는 박보다 **≈37ms 앞섰다.** 까닭은 둘이다.
     ⑴ `ctx.currentTime` 에 예약한 소리는 그 시각에 **나가기 시작**할 뿐이고,
        스피커에서 **들리기까지** 기기만큼 더 걸린다 — `ctx.outputLatency` 다.
     ⑵ 사람의 기기(블루투스 이어폰 수백 ms)는 우리가 알 길이 없다 — 그래서 사람이
        직접 맞추는 자리(`hs.offset`)를 둔다.
   그래서 박 기준점에 **출력 지연 + 사람 보정**을 더한다. 바늘과 판정이 같은
   기준점을 쓰므로 둘이 **함께** 밀린다(한쪽만 밀면 「보이는 박에 쳤는데 아쉬움」이 된다).
   ⚠ 보정은 **음악이 들릴 때만** 뜻이 있다. 음악이 없으면 바늘 자신이 기준이라
     격자를 통째로 밀어도 보이는 것이 없다(판정도 같이 밀리니 결과가 같다).
   ⚠ `hs.offset` 은 `localStorage` 다 — 세이브 `S` 에 넣지 않는다(저장 형식 불변). */
function rhyOutLat(){
  try{
    const c=SND.ctx; if(!c) return 0;
    const o=c.outputLatency; if(typeof o==='number'&&isFinite(o)&&o>0) return o;
    const b=c.baseLatency;   if(typeof b==='number'&&isFinite(b)&&b>0) return b;
  }catch(e){}
  return 0;
}
function rhyLoadOffset(){
  try{ const v=localStorage.getItem('hs.offset');
    if(v!==null){ const n=parseInt(v,10); if(isFinite(n)) RHY.offset=Math.max(-200,Math.min(200,n)); }
  }catch(e){}
}
function rhySaveOffset(){
  try{ localStorage.setItem('hs.offset',String(RHY.offset|0)); }catch(e){}
}
/* 「맞춰 보기」 — 박에 맞춰 여덟 번 치면 **평균 시차**를 보정값에 더한다.
   늦게 친 사람(시차 +)은 격자를 그만큼 뒤로 밀어야 그 탭이 완벽이 된다. */
function rhyCalStart(){
  RHY.cal=[]; rhyOffsetUI(); rhyView();
}
/* 여덟 번의 **중앙값**을 쓴다(2차 ④). 평균은 튀는 한 탭에 끌려간다 — 검증 실측으로
   한 탭이 30ms 를 끌고 갔다. 중앙값은 그 한 탭을 그냥 버린다.
   결과 글자도 `#msg` 가 아니라 **정보 팝업의 그 줄 옆**(`#offdone`)에 남긴다 —
   `#msg` 는 다음 제련 글자가 곧 덮는다(0.25초 뒤 틱). */
const rhyMed=a=>{ const b=a.slice().sort((x,y)=>x-y), n=b.length;
  return n?(n%2?b[(n-1)/2]:(b[n/2-1]+b[n/2])/2):0; };
function rhyCalTap(d){
  if(!RHY.cal) return;
  RHY.cal.push(d);
  if(RHY.cal.length>=RHY_CAL_N){
    const mid=rhyMed(RHY.cal);
    RHY.offset=Math.max(-200,Math.min(200,Math.round((RHY.offset+mid)/10)*10));
    RHY.calDone=RHY.offset; RHY.calTaps=RHY.cal.slice(); RHY.cal=null;
    rhySaveOffset(); rhyOffsetUI();
  }
  rhyOffsetUI();
}
function rhyOffsetUI(){
  try{
    const r=document.getElementById('offrange'); if(r&&+r.value!==RHY.offset) r.value=String(RHY.offset);
    const lb=document.getElementById('offtxt');
    if(lb) lb.textContent = RHY.cal ? t('ui.offsetCalN',RHY_CAL_N-RHY.cal.length) : t('ui.offset',RHY.offset);
    const b=document.getElementById('offcal');
    if(b) b.className = RHY.cal ? 'hot' : '';
    // 2차 ④ — 맞춘 결과는 그 줄 옆에 남는다(슬라이더를 움직이면 사라진다)
    const dn=document.getElementById('offdone');
    if(dn){ const on=(RHY.calDone!==null&&RHY.calDone!==undefined&&!RHY.cal);
      dn.textContent = on ? t('msg.offsetSet',RHY.calDone) : '';
      dn.className = on ? 'num hot' : 'dim'; }
  }catch(e){}
}

/* ⚠ 049 2차 ④ — **시계 하나로 그린다.** 바늘·판정은 늘 성능 시계(`performance.now`)로
     세고, 곡(오디오 시계)은 **기준**으로만 쓴다. 1차는 음악이 돌면 오디오 시계로
     **갈아탔다** — 그래서 두 가지가 났다:
       ⑴ 갈아타는 그 프레임에 바늘이 튀었다(검증 세션 실측 ~104ms).
       ⑵ `ctx.currentTime` 은 렌더 블록 단위로 ~10ms씩 **뛴다**. 그것으로 직접 그리면
          바늘이 프레임마다 떨린다(2차 실측: 한 프레임 6.4% · 한계 5%).
     그리고 음악을 **끈** 사람도 갈아탔다(버퍼는 무음으로 돌기 때문에).
     그래서: 성능 시계로 매끄럽게 그리고, 곡과의 차이는 프레임마다 박의 0.4%(≈2ms)
     씩만 **밀어서** 따라간다(`rhySlide` — 느린 위상 추적). 뛰는 값을 평균 내어
     받으므로 바늘이 안 떨리고, 오디오·성능 두 시계의 **속도 차이도 계속 흡수**된다
     (1차의 한 번 박기와 달리 2분 뒤에도 안 밀린다 — R1).
   `RHY.clock` 의 뜻: `'audio'` = 곡에 물려 있다 · `'perf'` = 맞출 곡이 없어 혼자 돈다. */
function rhyPerf(){
  return (typeof performance==='object'&&performance.now)?performance.now()/1000:Date.now()/1000;
}
function rhyNow(){ return rhyPerf(); }               // 그리는 시계는 늘 이것 하나다
/* 곡이 **들리게** 돌면 그 박에 맞는 기준점을 성능 시계 자로 바꿔 돌려준다.
   음악을 껐으면(`sndOnMusic()` 거짓) `null` — 맞출 곡이 없다. */
function rhyRef(){
  try{
    if(sndOnMusic() && SND.ctx && SND.ctx.state==='running' && SND.bgm!=='none' && SND.loopAt){
      RHY.lat=rhyOutLat();
      // 051 ① — 반복이 **들리기 시작하는** 시각이 박 0 이다(+ 사람 보정)
      return rhyPerf() - (SND.ctx.currentTime - SND.loopAt) + RHY.lat + RHY.offset/1000;
    }
  }catch(e){}
  return null;
}
let RHY_SLIDE=RHY_BEAT*0.004;                        // 한 프레임에 밀 수 있는 최대(초)
let RHY_FRAME_CAP=RHY_BEAT*0.048;                    // 한 프레임에 바늘이 갈 수 있는 몫
/* 051 ③ — 박자 격자를 갈아탄다(평소 120.15 ↔ 피버 160.25).
   ⚠ 박 길이만 바꾸면 그 프레임에 **위상이 튄다**(phase = t/박). 그래서 지금 위상을
     그대로 이어 붙인다 — 049 2차 ④ 가 시계를 갈아탈 때 한 것과 같은 수다.
     곡과의 어긋남은 그 뒤 `rhySlide` 가 프레임마다 조금씩 민다. */
function rhyGrid(bpm){
  if(Math.abs(RHY.bpm-bpm)<1e-9) return;
  const ph=(typeof RHY.phase==='number')?RHY.phase:0;
  RHY.bpm=bpm; RHY_BEAT=60/bpm;
  RHY_SLIDE=RHY_BEAT*0.004; RHY_FRAME_CAP=RHY_BEAT*0.048;
  RHY.origin=rhyPerf()-ph*RHY_BEAT;                  // 위상 이어 붙이기
  RHY.edge=-1; rhyView();
}
function rhyOrigin(){
  if(RHY.origin===null) RHY.origin=rhyPerf();
  return RHY.origin;
}
/* 곡 쪽으로 **조금씩** 민다. 프레임마다 한 번(8ms 안에 두 번 부르면 뒤는 무시).
   ⚠ 0.4%(2ms)는 넉넉히 잡은 값이다. 60fps 한 프레임이 이미 박의 3.3%(16.7ms)를
     먹으므로, 미는 몫까지 더해도 5% 아래로 남는다. 반 박을 당기는 데 2초쯤 걸리지만
     그 2초는 **32초 도입부 안**이라 곡의 박이 아직 안 들린다. 미는 동안에도 바늘과
     판정은 **같은 기준점**이라 「바늘에 맞춰 친 탭」은 그대로 완벽이다. */
function rhySlide(){
  const now=rhyPerf();
  const dt=(RHY._slid===undefined)?0.016:(now-RHY._slid);
  if(dt<0.008) return;                               // 한 프레임에 한 번
  RHY._slid=now;
  const want=rhyRef();
  RHY.clock=(want===null)?'perf':'audio';
  RHY._want=want;
  if(want===null){ RHY._hold=0; return; }
  rhyOrigin();
  /* 이 프레임의 몫 — **실제로 흐른 시간**이 이미 한 프레임 몫(박의 4.8%)을 먹었으면
     밀지 않는다. 그래야 rAF 가 밀린 프레임에서 바늘이 더 건너뛰지 않는다.
     다만 느린 기기(30fps)에서 영영 못 맞추면 안 되니, 30프레임을 내리 쉬었으면 한 번은 민다. */
  let step=Math.min(RHY_SLIDE, Math.max(0, RHY_FRAME_CAP-dt));
  if(step<=0){ RHY._hold=(RHY._hold||0)+1; if(RHY._hold<30) return; step=RHY_SLIDE; }
  RHY._hold=0;
  let d=(want-RHY.origin)%RHY_BEAT;                  // 박 하나 안의 차이로 접는다
  if(d>RHY_BEAT/2) d-=RHY_BEAT; else if(d<-RHY_BEAT/2) d+=RHY_BEAT;
  RHY.origin += (Math.abs(d)<=step) ? d : (d>0?step:-step);
}
function rhyPhase(now){
  const t=now-rhyOrigin();
  const b=Math.floor(t/RHY_BEAT);
  return {beat:b, phase:t/RHY_BEAT-b};
}
/* 사람의 탭 시각(초). `PointerEvent.timeStamp` 가 곧 성능 시계다 — 이제 바꿀 일이 없다
   (1차는 `getOutputTimestamp()` 로 오디오 시계에 옮겼다. 시계가 하나뿐이니 그 변환도,
   변환이 실패할 때의 어림짐작도 사라졌다). */
function rhyTapTime(ev){
  return (ev&&typeof ev.timeStamp==='number'&&ev.timeStamp>0) ? ev.timeStamp/1000 : rhyPerf();
}
/* 손 탭 하나를 판정한다. **견습생 타격은 여기 안 온다**(검사 R3). */
function rhyJudge(ev){
  try{
    const now=rhyTapTime(ev);
    const p=rhyPhase(now);
    // 가장 가까운 박까지의 시차(ms). phase 0.5 를 넘으면 다음 박이 가깝다.
    const d=(p.phase<=0.5?p.phase:p.phase-1)*RHY_BEAT*1000;
    const a=Math.abs(d);
    const g = a<=RHY_PERFECT?'perfect' : a<=RHY_GREAT?'great' : a<=RHY_GOOD?'good' : 'miss';
    RHY.counts[g]++;
    RHY.last={grade:g, ms:+d.toFixed(1)};
    if(g==='miss') RHY.combo=0;
    else { RHY.combo++; if(RHY.combo>RHY.best) RHY.best=RHY.combo; }
    // 이른 탭은 왼쪽, 늦은 탭은 오른쪽. RHY_GOOD 을 반폭으로 잡아 자리를 낸다.
    RHY.ticks.push({x:Math.max(-1,Math.min(1,d/RHY_GOOD)), g});
    while(RHY.ticks.length>RHY_TICKS) RHY.ticks.shift();
    rhyPaintTicks(); rhyShowJudge(g);
    rhyCalTap(d);                       // 051 ① — 「맞춰 보기」 중이면 시차를 모은다
    feverTap(g);                        // 051 ② — 손 판정만 게이지를 채운다
    rhyView();
  }catch(e){}
}
const RHY_COL={perfect:'#dfb96f', great:'var(--ember)', good:'#e9eef5', miss:'#6b7686'};
function rhyPaintTicks(){
  try{
    const box=document.getElementById('beatticks'); if(!box) return;
    const n=RHY.ticks.length;
    if(box.children.length!==n){ box.innerHTML='';
      for(let i=0;i<n;i++) box.appendChild(document.createElement('i')); }
    for(let i=0;i<n;i++){
      const t=RHY.ticks[i], e=box.children[i];
      e.style.left=(50+t.x*28)+'%';
      e.style.background=RHY_COL[t.g]||'#fff';
      e.style.opacity=String(0.18+0.82*((i+1)/n));     // 앞의 것은 흐리게 남는다
    }
  }catch(e){}
}
function rhyShowJudge(g){
  try{
    const e=document.getElementById('beatjudge'); if(!e) return;
    e.textContent=t('judge.'+g)+(RHY.combo>=2?(' '+t('judge.combo',RHY.combo)):'');
    e.style.color=RHY_COL[g]||'#fff';
    e.classList.remove('on'); void e.offsetWidth; e.classList.add('on');
  }catch(e){}
}
/* 바늘. 한 박에 **한 번** 좌↔우를 건넌다 — 끝에 닿는 순간이 곧 박이다
   (한 박에 왕복시키면 끝에 두 번 닿아 박이 두 배로 보인다). */
function rhyFrame(){
  try{
    const now=rhyNow();
    rhyOrigin(); rhySlide();                  // 049 2차 ④ — 프레임마다 한 번만 민다
    const p=rhyPhase(now);
    RHY.beat=p.beat; RHY.phase=p.phase;
    const red=reelRed();
    const n=document.getElementById('beatneedle'), bar=document.getElementById('beat');
    if(bar){
      if(!red && n){
        const x=(p.beat%2===0)?p.phase:(1-p.phase);
        n.style.left=(2+x*96)+'%';
      }
      if(p.beat!==RHY.edge){                        // 박이 바뀌는 그 순간
        RHY.edge=p.beat;
        bar.classList.remove('edge'); void bar.offsetWidth; bar.classList.add('edge');
        if(typeof setTimeout==='function') setTimeout(()=>{ try{ bar.classList.remove('edge'); }catch(e){} },90);
        const d=document.getElementById('beatdot');
        if(red&&d){ d.classList.add('on');
          if(typeof setTimeout==='function') setTimeout(()=>{ try{ d.classList.remove('on'); }catch(e){} },120); }
      }
    }
    rhyView();
  }catch(e){}
}
/* 돌 때만 돈다 — 048 2차 ① 과 **같은 규칙**이다(보고 있고, 30초 안에 만졌을 때).
   제련 탭이 아니면 아예 안 돈다. 그래서 유휴 duty 가 048 과 같다(검사 R6). */
function rhyShould(){
  try{
    if(typeof document==='undefined'||document.hidden) return false;
    const pane=document.getElementById('tabForge');
    if(!pane||!pane.classList||!pane.classList.contains('on')) return false;
    return (Date.now()-(reelHumanAt||0))<REEL_IDLE_MS;
  }catch(e){ return false; }
}
function rhyLoop(){
  if(typeof requestAnimationFrame!=='function') return;
  if(RHY.raf!==null) return;
  const step=()=>{
    if(!rhyShould()){ RHY.raf=null; rhyView(); return; }
    rhyFrame();
    RHY.raf=requestAnimationFrame(step);
  };
  RHY.raf=requestAnimationFrame(step);
}
function rhyView(){
  const V=globalThis.__view; if(!V) return;
  /* ⚠ `beat` 는 049 가 낸 대로 **박 번호**다(이름을 바꾸면 049 검사가 조용히 엉뚱한
     값을 읽는다). 박 길이는 새 키 `beatMs` 로 낸다. */
  V.rhythm={bpm:RHY.bpm, beat:RHY.beat, beatMs:+(RHY_BEAT*1000).toFixed(2), clock:RHY.clock,
    phase:+RHY.phase.toFixed(4),
    last:{grade:RHY.last.grade, ms:RHY.last.ms},
    counts:RHY.counts, combo:RHY.combo, best:RHY.best,
    running:RHY.raf!==null, sliding:!(RHY._want===null||RHY._want===undefined),
    // 051 ① — 보정의 내역을 **효과로** 낸다: 격자가 실제로 얼마나 밀렸는지(ms)
    offset:RHY.offset, lat:+(RHY.lat*1000).toFixed(1), shift:+(RHY.lat*1000+RHY.offset).toFixed(1),
    cal:RHY.cal?RHY.cal.length:-1,
    calDone:(RHY.calDone===null||RHY.calDone===undefined)?null:RHY.calDone,
    calTaps:RHY.calTaps?RHY.calTaps.slice():null,
    window:{perfect:RHY_PERFECT, great:RHY_GREAT, good:RHY_GOOD}};
}
rhyLoadOffset();
rhyView();


