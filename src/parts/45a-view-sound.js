/* ══════════════════════════════════════════════════════════════════════════
   049 §2 — 소리.  **소리는 관찰자다**(040 원칙).

   CORE 에 소리 호출을 한 줄도 심지 않는다. 릴 사건은 VIEW 의 릴 상태 기계가, 전투는
   `VIEW.counters`·`S` 의 **변화**가 알려 준다. 그래서 이 절을 통째로 지워도 게임은
   한 글자도 안 달라진다 — 소리가 규칙을 만들지 않는다는 뜻이다.

   ⚠ node 하네스에는 `AudioContext`·`document`·`window` 가 없다. 바깥 세계를 만지는
     줄은 전부 `typeof` 로 가린다 — 041 ④ 에서 이걸 빠뜨려 `days.js` 가 죽고 md5 가
     빈 출력로 바뀐 적이 있다.
   ⚠ **첫 화면에는 아무것도 안 부른다.** 첫 사람 입력에서 `AudioContext` 를 만들고
     묶음을 싣는다(§2①). 자동재생 정책상 그 전에는 소리를 낼 수도 없다.
   ══════════════════════════════════════════════════════════════════════════ */
const SND={
  ctx:null, master:null, mGain:null, sGain:null,
  buf:{},                    // 키 → AudioBuffer
  packs:{sfx:'none', forge:'none', fever:'none'},  // 051 ③ — 피버 곡 묶음이 더해졌다
  bgm:'none', bgmSrc:null, loopLen:0, loopAt:0,   // loopAt = 반복이 시작된 ctx 시각
  track:'forge', mGain2:null, bgmSrc2:null,       // 051 ③ — 지금 도는 곡 · 겹쳐 넘기는 쪽
  music:true, sfx:true, cgMute:false,
  played:{}, skipped:0, dropped:0, lat:0,
  live:0, lastAt:{}, ascAt:[],
  boot:false,
};
/* ══ 049 — **소리는 게임의 난수를 먹지 않는다** ══════════════════════════
   피치 흔들림에 `Math.random()` 을 쓰면 효과음 한 번이 난수열을 한 칸 밀어 **장비
   등급이 달라진다.** 검사 R5(같은 시드에서 완벽만 친 판과 아쉬움만 친 판이 같은가)가
   그것을 잡았다 — 등급이 `[8,1,1,6,…]` 대 `[1,2,7,1,…]` 로 갈렸다.
   「소리는 관찰자다」(040)는 **난수에도** 걸린다. 소리는 제 난수를 쓴다. */
let sfxSeed=0x5EED049;
function sfxRnd(){ sfxSeed=(sfxSeed*1103515245+12345)&0x7fffffff; return sfxSeed/0x7fffffff; }
const SND_MAX=12;                      // 동시 발음 상한 — 넘으면 버린다(dropped++)
const SND_LOOP_LEN=127.840;            // 대장간 곡 반복 길이(초) · ±5ms 를 검사로 못박는다
const SND_BGM_VOL=0.35;

/* 저장은 `localStorage` 의 `hs.snd` 다 — **세이브 `S` 에 넣지 않는다**(저장 형식 불변). */
function sndLoadPrefs(){
  try{ const v=localStorage.getItem('hs.snd');
    if(typeof v==='string'&&v.length>=2){ SND.music=v[0]==='1'; SND.sfx=v[1]==='1'; }
  }catch(e){}
}
function sndSavePrefs(){
  try{ localStorage.setItem('hs.snd',(SND.music?'1':'0')+(SND.sfx?'1':'0')); }catch(e){}
}
/* CrazyGames 의 `muteAudio` 는 **게임 내 설정보다 우선한다**(SDK 문서). 그래서 켜져
   있는 동안에는 `#snd` 를 눌러도 소리가 안 난다 — 아래 `sndOnMusic`·`sndOnSfx` 가 못이다. */
const sndOnMusic=()=>SND.music && !SND.cgMute;
const sndOnSfx  =()=>SND.sfx   && !SND.cgMute;

function sndState(){
  if(!SND.ctx) return 'none';
  try{ return SND.ctx.state==='running'?'running':'suspended'; }catch(e){ return 'none'; }
}
/* `__view.sfx` — **깃발이 아니라 효과**를 낸다(026 AD6 교훈). `played` 는 실제로
   소리 노드를 만들어 예약한 수다. */
function sndView(){
  const V=globalThis.__view; if(!V) return;
  V.sfx={ctx:sndState(), music:SND.music, sfx:SND.sfx, cgMute:SND.cgMute,
    packs:{sfx:SND.packs.sfx, forge:SND.packs.forge, fever:SND.packs.fever},
    bgm:SND.bgm, track:SND.track, loopLen:+SND.loopLen.toFixed(4),
    played:SND.played, skipped:SND.skipped, dropped:SND.dropped,
    lat:+SND.lat.toFixed(2), live:SND.live, ascAt:SND.ascAt};
  /* 051 ② — 피버의 창구. **깃발이 아니라 효과**다: 게이지는 `S.pity`(손 판정이 채운
     양) · 남은 시간은 `S.feverUntil` 에서 나온 ms · `last` 는 마지막 제련의 정렬 수다. */
  try{ V.fever={gauge:S.pity|0, max:FEVER_MAX(), on:feverOn(), left:feverLeft(),
    ms:FEVER_MS, fill:FEVER_FILL, track:SND.track,
    last:{best:(typeof fgLastBest!=='undefined')?fgLastBest:0,
          special:(typeof fgLastSpecial!=='undefined')?!!fgLastSpecial:false,
          grade:(typeof fgLastGrade!=='undefined')?fgLastGrade:0},
    pillars:V.counters?V.counters.pillar||0:0}; }catch(e){}
}

/* ── 묶음 싣기 — `<script src>` 는 `file://` 에서도 된다(§2①) ─────────────── */
function sndPack(name){
  return new Promise(res=>{
    try{
      if(SND.packs[name]==='ready'||SND.packs[name]==='loading') return res(false);
      SND.packs[name]='loading'; sndView();
      const sc=document.createElement('script');
      sc.src='audio/pack-'+name+'.js';
      sc.onload=()=>{ sndDecodePack(name).then(()=>res(true)); };
      sc.onerror=()=>{ SND.packs[name]='none'; sndView(); res(false); };
      document.head.appendChild(sc);
    }catch(e){ SND.packs[name]='none'; res(false); }
  });
}
function b64buf(b64){
  const bin=atob(b64), n=bin.length, u=new Uint8Array(n);
  for(let i=0;i<n;i++) u[i]=bin.charCodeAt(i);
  return u.buffer;
}
async function sndDecodePack(name){
  const H=(typeof window!=='undefined')?window.HS_AUDIO:null;
  if(!H||!SND.ctx){ SND.packs[name]='none'; sndView(); return; }
  const keys=Object.keys(H).filter(k=>H[k]);
  for(const k of keys){
    try{
      const ab=b64buf(H[k]);
      // 끝나면 base64 문자열을 놓아 준다 — 2.6MB 짜리가 그대로 남으면 아깝다(§2①).
      H[k]=null;
      SND.buf[k]=await SND.ctx.decodeAudioData(ab);
    }catch(e){}
  }
  SND.packs[name]='ready'; sndView();
  if(name==='forge') sndBgmStart();
  /* 051 ③ — 피버 곡이 **피버가 이미 돌고 있는 중에** 도착했으면 그 자리에서 갈아탄다.
     게이지가 70% 를 지나는 것을 틱이 못 본 판(게이지가 한 번에 찬 판)에서도
     곡이 바뀌게 하는 안전망이다. 늦게라도 바뀌는 것이 영영 안 바뀌는 것보다 낫다. */
  if(name==='fever' && typeof feverOn==='function' && feverOn()){
    try{ bgmSwitch('fever'); if(typeof rhyGrid==='function') rhyGrid(RHY_BPM_FEVER); }catch(e){}
  }
}

/* ── 켜기 — **첫 사람 입력**에서 한 번 ──────────────────────────────────── */
function sndBoot(){
  if(SND.boot) return; SND.boot=true;
  try{
    const AC=(typeof AudioContext!=='undefined')?AudioContext
            :(typeof webkitAudioContext!=='undefined')?webkitAudioContext:null;
    if(!AC||typeof document==='undefined') return;
    SND.ctx=new AC();
    SND.master=SND.ctx.createGain(); SND.master.gain.value=1; SND.master.connect(SND.ctx.destination);
    SND.mGain=SND.ctx.createGain(); SND.mGain.gain.value=0; SND.mGain.connect(SND.master);
    SND.sGain=SND.ctx.createGain(); SND.sGain.gain.value=1; SND.sGain.connect(SND.master);
    sndView();
    /* ══ 049 2차 ③ — **첫 주기를 지킨다** ═══════════════════════════════════
       1차는 첫 입력에서 `sfx`(0.8MB) 에 이어 **곧바로 `forge`(2.6MB)** 를 실었다.
       base64 를 풀고 디코딩하는 동안 메인 스레드가 막혀 **rAF 가 밀렸고**, 그래서
       첫 주기에서 릴 멈춤 둘이 34ms·15ms 로 붙는 판이 났다(검증 ② 의 「새 흔들림」).
       첫 주기는 사람이 이 게임을 처음 보는 자리다 — 거기서 손맛이 흔들리면 안 된다.
       그래서 배경음악 묶음은 **첫 주기가 정착한 뒤** 한가한 틈에 싣는다. */
    sndPack('sfx');
    sndForgeLater();
  }catch(e){ SND.ctx=null; sndView(); }
}

/* 049 2차 ③ — 배경음악 묶음을 **첫 주기가 끝난 뒤 · 한가한 틈에** 싣는다.
   ⚠ 「첫 주기 정착」은 `FG.made` 가 처음 오르는 때다. 그 전에 손을 떼도 마무리가
     주기를 끝내므로(047 ⑤-8) 영영 안 실리는 일은 없다. 그래도 보루로 8초를 둔다.
   ⚠ `requestIdleCallback` 이 없는 브라우저(사파리 계열)에서는 1초 뒤 `setTimeout`. */
let sndForgeArmed=false;
function sndForgeLater(){
  if(sndForgeArmed) return; sndForgeArmed=true;
  const go=()=>{ try{ sndPack('forge'); }catch(e){} };
  const idle=()=>{ try{
      if(typeof requestIdleCallback==='function') requestIdleCallback(go,{timeout:2000});
      else if(typeof setTimeout==='function') setTimeout(go,1000);
      else go();
    }catch(e){ go(); } };
  if(typeof setTimeout!=='function'){ go(); return; }
  const made0=(typeof FG==='object'&&FG)?FG.made:0;
  let waited=0;
  const tick=()=>{
    waited+=120;
    const done=(typeof FG==='object'&&FG&&FG.made>made0);
    if(done || waited>=8000){ idle(); return; }
    setTimeout(tick,120);
  };
  setTimeout(tick,120);
}

/* ── 한 소리 ─────────────────────────────────────────────────────────────
   `gap` 은 「이 키를 N ms 안에 다시 내지 않는다」 — 전투 소리처럼 쏟아지는 것에만 건다.
   **탭 효과음에는 걸지 않는다**: 사람이 친 만큼 소리가 나야 한다(§2③). */
function sfx(key,opt){
  opt=opt||{};
  try{
    if(!SND.ctx||!sndOnSfx()){ SND.skipped++; return 0; }
    if(SND.ctx.state!=='running'){ SND.skipped++; return 0; }
    const b=SND.buf[key]; if(!b){ SND.skipped++; return 0; }
    const now=SND.ctx.currentTime;
    if(opt.gap){ const t=SND.lastAt[key]||-1e9;
      if((now-t)*1000<opt.gap){ SND.skipped++; return 0; } }
    if(SND.live>=SND_MAX){ SND.dropped++; return 0; }
    SND.lastAt[key]=now;
    const src=SND.ctx.createBufferSource(); src.buffer=b;
    if(opt.rate) src.playbackRate.value=opt.rate;
    const g=SND.ctx.createGain(); g.gain.value=(opt.vol==null?1:opt.vol);
    src.connect(g); g.connect(SND.sGain);
    const at=now+(opt.at||0);
    src.start(at);
    SND.live++; src.onended=()=>{ SND.live=Math.max(0,SND.live-1); };
    SND.played[key]=(SND.played[key]||0)+1;
    sndView();
    return at;
  }catch(e){ return 0; }
}
// 040 의 합성 둘 — 파일이 없는 소리는 즉석에서 만든다(에셋을 늘리지 않는다).
function sfxTone(kind){
  try{
    if(!SND.ctx||!sndOnSfx()||SND.ctx.state!=='running'){ SND.skipped++; return; }
    if(SND.live>=SND_MAX){ SND.dropped++; return; }
    const t=SND.ctx.currentTime, o=SND.ctx.createOscillator(), g=SND.ctx.createGain();
    const hit=(kind==='hit');
    o.type=hit?'square':'sawtooth';
    o.frequency.setValueAtTime(hit?420:220,t);
    o.frequency.exponentialRampToValueAtTime(hit?260:90,t+(hit?0.07:0.28));
    g.gain.setValueAtTime(hit?0.25:0.3,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+(hit?0.09:0.32));
    o.connect(g); g.connect(SND.sGain); o.start(t); o.stop(t+(hit?0.1:0.34));
    SND.live++; o.onended=()=>{ SND.live=Math.max(0,SND.live-1); };
    SND.played[kind]=(SND.played[kind]||0)+1; sndView();
  }catch(e){}
}

/* ── 배경음악 — 도입 한 번 → 반복 무한(예약) ────────────────────────────── */
function sndBgmStart(){
  try{
    if(!SND.ctx||!SND.buf['bgm-loop']) return;
    // 양 끝 0 샘플을 **잘라** 반복 길이를 맞춘다 — 그 몇 ms 가 「뚝」 소리가 된다(§2②).
    SND.loopLen=sndTrim(SND.buf['bgm-loop']);
    const t0=SND.ctx.currentTime+0.06;
    const intro=SND.buf['bgm-intro'];
    let at=t0;
    if(intro){ const s=SND.ctx.createBufferSource(); s.buffer=intro;
      s.connect(SND.mGain); s.start(t0); at=t0+intro.duration; SND.bgm='intro'; }
    const l=SND.ctx.createBufferSource(); l.buffer=SND.buf['bgm-loop'];
    l.loop=true; l.loopStart=SND.trimA; l.loopEnd=SND.trimB;
    l.connect(SND.mGain); l.start(at,SND.trimA);
    SND.bgmSrc=l; SND.loopAt=at;
    if(!intro) SND.bgm='loop';
    else if(typeof setTimeout==='function')
      setTimeout(()=>{ SND.bgm='loop'; sndView(); }, Math.max(0,(at-SND.ctx.currentTime)*1000));
    // 1초 페이드인
    SND.mGain.gain.setValueAtTime(0.0001,t0);
    SND.mGain.gain.exponentialRampToValueAtTime(sndOnMusic()?SND_BGM_VOL:0.0001,t0+1);
    sndView();
  }catch(e){}
}
/* 양 끝의 **무음**을 찾아 반복 구간을 정한다. 0 이 아니라 아주 작은 값까지 무음으로 본다
   (mp3 디코딩은 정확히 0 을 잘 안 준다). 못 찾으면 통째로 쓴다. */
function sndTrim(b){
  try{
    const d=b.getChannelData(0), n=d.length, sr=b.sampleRate, eps=1e-4;
    let a=0, z=n-1;
    while(a<n && Math.abs(d[a])<eps) a++;
    while(z>a && Math.abs(d[z])<eps) z--;
    SND.trimA=a/sr; SND.trimB=(z+1)/sr;
    return SND.trimB-SND.trimA;
  }catch(e){ SND.trimA=0; SND.trimB=b.duration; return b.duration; }
}
function bgmGain(v,sec){
  try{ if(!SND.ctx||!SND.mGain) return;
    const t=SND.ctx.currentTime;
    SND.mGain.gain.cancelScheduledValues(t);
    SND.mGain.gain.setValueAtTime(Math.max(0.0001,SND.mGain.gain.value),t);
    SND.mGain.gain.exponentialRampToValueAtTime(Math.max(0.0001,v),t+(sec||0.4));
  }catch(e){}
}
/* ══ 051 ③ — 곡 갈아타기(대장간 ↔ 피버) ═══════════════════════════════════
   046 §7-b′ 대로 **2초 겹쳐** 넘긴다. 쓰는 수는 가장 싼 것이다:
   같은 `master` 밑에 **두 번째 음악 게인**(`mGain2`)을 만들어, 새 곡을 거기서 올리고
   옛 곡을 같은 2초에 내린다. 끝나면 옛 노드를 세워 버리고 둘을 맞바꾼다.
   ⚠ 박자 격자는 **새 곡의 반복 시작 시각**에 붙는다(`SND.loopAt` 을 새로 쓴다) —
     그러면 `rhyRef()` 가 그대로 새 박을 따라간다(049 2차 ④ 의 느린 추적).
   ⚠ 묶음이 아직 안 실렸으면 **아무것도 안 한다**(소리가 없을 뿐 게임은 그대로다).
   ⚠ `name` 은 'forge' | 'fever'. 돌려주는 값은 **실제로 갈아탄 곡**이다. */
function bgmSwitch(name){
  try{
    if(!SND.ctx||!SND.master) return SND.track;
    const key = name==='fever' ? 'bgm-fever-loop' : 'bgm-loop';
    const buf = SND.buf[key];
    if(!buf || SND.track===name) return SND.track;
    const t0=SND.ctx.currentTime+0.02, XF=2.0;
    // 새 곡 — 두 번째 게인에서 0 → 목표로 2초 동안 오른다
    const g=SND.ctx.createGain(); g.gain.setValueAtTime(0.0001,t0); g.connect(SND.master);
    const a=sndTrim(buf);                       // 이음매를 잘라 반복 구간을 잡는다
    const l=SND.ctx.createBufferSource(); l.buffer=buf;
    l.loop=true; l.loopStart=SND.trimA; l.loopEnd=SND.trimB;
    l.connect(g); l.start(t0,SND.trimA);
    g.gain.exponentialRampToValueAtTime(sndOnMusic()?SND_BGM_VOL:0.0001,t0+XF);
    // 옛 곡 — 같은 2초에 내리고 끝나면 세운다
    const oldG=SND.mGain, oldSrc=SND.bgmSrc;
    if(oldG){ oldG.gain.cancelScheduledValues(t0);
      oldG.gain.setValueAtTime(Math.max(0.0001,oldG.gain.value),t0);
      oldG.gain.exponentialRampToValueAtTime(0.0001,t0+XF); }
    if(oldSrc&&typeof setTimeout==='function')
      setTimeout(()=>{ try{ oldSrc.stop(); }catch(e){} try{ if(oldG) oldG.disconnect(); }catch(e){} },(XF+0.3)*1000);
    SND.mGain=g; SND.bgmSrc=l; SND.loopLen=a; SND.loopAt=t0;
    SND.track=name; SND.bgm='loop';
    sndView();
    return name;
  }catch(e){ return SND.track; }
}
/* 피버가 열렸다 — 효과음 한 방 뒤 **다음 마디**에서 곡과 박자를 갈아탄다.
   마디 = 네 박(046 §7-b′ 의 「마디 경계」). 박자 격자는 소리와 **같이** 바뀐다. */
function sndFeverStart(){
  try{
    sndFeverLater();        // 051 ③ — 아직 안 실렸으면 지금이라도(게이지가 한 번에 찬 판)
    sfx('sfx-fever-start');
    const wait=sndBarWait();
    const go=()=>{ bgmSwitch('fever'); if(typeof rhyGrid==='function') rhyGrid(RHY_BPM_FEVER); };
    if(typeof setTimeout==='function') setTimeout(go,wait); else go();
  }catch(e){}
}
function sndFeverEnd(){
  try{
    const go=()=>{ bgmSwitch('forge'); if(typeof rhyGrid==='function') rhyGrid(RHY_BPM); };
    if(typeof setTimeout==='function') setTimeout(go,sndBarWait()); else go();
  }catch(e){}
}
/* 다음 마디까지 남은 ms. 박자 격자를 읽는다(없으면 0 — 바로 넘긴다). */
function sndBarWait(){
  try{
    if(typeof RHY!=='object'||!RHY||typeof RHY_BEAT!=='number') return 0;
    const beatsIn=((RHY.beat%4)+4)%4 + (RHY.phase||0);
    return Math.max(0,(4-beatsIn)*RHY_BEAT*1000);
  }catch(e){ return 0; }
}
/* 피버 곡은 **게이지 70% 에서 미리** 싣는다(046 §7-b′ 의 불러오는 순서).
   2MB 를 피버가 열리는 순간에 집으면 그 몇 백 ms 가 첫 마디를 먹는다(049 ③ 교훈). */
function sndFeverLater(){
  try{ if(SND.packs.fever==='none') sndPack('fever'); }catch(e){}
}

/* ── 끄고 켜기 ───────────────────────────────────────────────────────────── */
function sndApply(){
  try{
    if(SND.mGain) bgmGain(sndOnMusic()?SND_BGM_VOL:0.0001,0.3);
    const sb=document.getElementById('snd');
    const on=(SND.music||SND.sfx)&&!SND.cgMute;
    if(sb){ sb.textContent=on?'🔊':'🔇'; sb.setAttribute('aria-pressed',on?'true':'false'); }
    const m=document.getElementById('sndMusic'), x=document.getElementById('sndSfx');
    if(m) m.className=sndOnMusic()?'hot':'';
    if(x) x.className=sndOnSfx()?'hot':'';
  }catch(e){}
  sndView();
}
/* 광고 중(`PLAT.paused`)·탭 숨김이면 **문맥을 재운다** — 깃발이 아니라 `ctx.suspend()` 다.
   돌아오면 `resume()` + 음악 1초 페이드인(§2④). */
function sndGate(){
  try{
    if(!SND.ctx) return;
    const stop=(typeof PLAT==='object'&&PLAT&&PLAT.paused)
            || (typeof document!=='undefined'&&document.hidden);
    if(stop && SND.ctx.state==='running') SND.ctx.suspend();
    else if(!stop && SND.ctx.state==='suspended'){
      SND.ctx.resume().then(()=>{ bgmGain(sndOnMusic()?SND_BGM_VOL:0.0001,1); }).catch(()=>{});
    }
    sndView();
  }catch(e){}
}
/* ══ 049 §2③ — **관찰자 배선**. 소리가 규칙을 만들지 않는다 ═══════════════
   릴 사건은 VIEW 의 릴 상태 기계가, 전투는 `VIEW.counters`·`S` 의 **변화**가 알려
   준다. CORE 에는 한 줄도 안 들어간다. */
let sfxClank=0, sfxTing=0, sfxThud=0;
function sfxReelStop(i){
  const r=RL[i]; if(!r) return;
  const prev=(i>0&&RL[i-1])?RL[i-1]:null;
  const stoodBefore=prev&&(prev.st==='stopped'||prev.st==='locked');
  const same=stoodBefore&&prev.sym===r.sym;
  // 탭 → 소리까지의 지연을 낸다(§2③ — 예약 기준 ≤30ms)
  const t=sfx(same?('sfx-ting-'+'abc'[(sfxTing++)%3])
                 :('sfx-clank-'+(((sfxClank++)%2)?'b':'a')),
    same?{}:{rate:1+(sfxRnd()*0.06-0.03)});          // 피치 ±3% — **제 난수**로(위 ⚠)
  if(t&&SND.ctx&&reelHumanAt) SND.lat=Math.max(0,(t-SND.ctx.currentTime)*1000);
  /* 「마지막 릴이 섰다 = 장비가 나왔다」는 **여기서 세지 않는다.** 이 함수가 도는
     순간의 상태를 훑으면 한 칸이 다른 길(스냅·자동)로 서 있을 때 새어 버린다
     (실측: 3릴 10주기에 thud 0 · clank 20). 전이를 이미 아는 곳은 `reelMark()` 다. */
}
function sfxSlam(){                                   // 자동의 «쾅» — 한 번에 선다
  try{ if(FG.made>=sfxMadeSeen){ sfxMadeSeen=FG.made+1; sfxMade(); } }catch(e){ sfxMade(); }
}
function sfxMade(){
  sfx('sfx-thud-'+(((sfxThud++)%2)?'b':'a'));
  try{
    const lit=document.querySelectorAll('#forge[data-match] .reel.done.hit').length;
    if(lit>=2) sfx('sfx-match',{at:0.07});
    const it=S.queue[S.queue.length-1];
    if(it&&(it.g||0)>=10) sfx('sfx-legend',{at:0.12});
  }catch(e){}
  feverMade();                        // 051 ⑤ — 빛기둥은 **드러난 그 순간**에 선다
}
/* ══ 051 ⑤ — 등급 빛기둥 · 특별 주문의 큰 셰이크 ══════════════════════════
   「드러난 그 순간」은 `sfxMade()` 가 서는 자리와 같다(마지막 릴이 선 순간 · 주기당
   한 번). CORE 가 남긴 `fgLastSpecial`·`fgLastGrade` 를 읽어 **효과만** 더한다.
   ⚠ 캔버스 연출은 `__pillar`·`__shake` 로만 부른다(44b 가 내보낸다) — 없으면 아무 일도
     없다(하네스·캔버스 없는 판). 글자는 CORE 가 이미 썼다(`msg.special`). */
function feverMade(){
  try{
    const sp=(typeof fgLastSpecial!=='undefined')&&fgLastSpecial;
    const g=(typeof fgLastGrade!=='undefined')?(fgLastGrade|0):0;
    if(sp){
      if(typeof __shake==='function') __shake(9);          // 큰 셰이크
      if(!(SND.buf['sfx-legend'])) sfx('sfx-ascend-riser',{at:0.02});
    }
    if(sp||g>=10){
      if(typeof __pillar==='function') __pillar(sp?15:g);  // 등급색 빛기둥
      if(sp) sfx('sfx-legend',{at:0.02});
    }
  }catch(e){}
}
/* 피버의 관찰자. 250ms 틱이 부른다(42c). CORE 는 소리·연출을 한 줄도 안 부른다. */
let fvOnSeen=false, fvPre=false;
function feverWatch(){
  try{
    const on=feverOn(), g=S.pity|0, mx=FEVER_MAX();
    // 046 §7-b′ 불러오는 순서 — 피버 곡은 **게이지 70%** 에서 미리 싣는다
    if(!fvPre && g>=mx*0.7){ fvPre=true; sndFeverLater(); }
    if(on&&!fvOnSeen){ fvOnSeen=true; sndFeverStart(); }
    else if(!on&&fvOnSeen){ fvOnSeen=false; sndFeverEnd(); }
    try{ if(typeof document!=='undefined'&&document.body)
      document.body.setAttribute('data-fever',on?'1':'0'); }catch(e){}
  }catch(e){}
}
/* 손 판정 하나가 게이지를 채운다 — `rhyJudge()` 가 부르는 **유일한 입구**(051 §2②).
   CORE 의 `feverAdd()` 를 그대로 부르고, 화면은 다음 틱의 `renderFast()` 가 그린다. */
function feverTap(grade){
  try{ if(typeof feverAdd==='function') feverAdd(grade); }catch(e){}
}
/* 전투·웨이브 — 카운터와 `S` 의 **변화**만 본다. 250ms 틱이 부른다. */
let sfxSeen={dissolve:0, attack:0, wave:0, star:0, lv:0, tech:0};
function sfxWatch(){
  try{
    const V=globalThis.__view; if(!V||!SND.ctx) return;
    const c=V.counters||{};
    if((c.dissolve||0)>sfxSeen.dissolve){ sfxSeen.dissolve=c.dissolve;
      sfx('sfx-kill-'+((sfxSeen.dissolve%2)?'b':'a'),{vol:0.6,gap:120}); }
    if((c.attack||0)>sfxSeen.attack){ sfxSeen.attack=c.attack; sfxTone('hit'); }
    if(S.wave>sfxSeen.wave){ const back=false; sfxSeen.wave=S.wave; sfx('sfx-wave',{gap:3000}); }
    else if(S.wave<sfxSeen.wave){ sfxSeen.wave=S.wave; sfxTone('fail'); }
    if((S.star||0)>sfxSeen.star){ sfxSeen.star=S.star||0; sfxAscend(); }
    const tech=Object.values(S.tech||{}).reduce((a,c2)=>a+c2,0);
    if(tech>sfxSeen.tech){ sfxSeen.tech=tech; sfx('sfx-chime'); }
  }catch(e){}
}
/* 승천 — 곡을 −12dB 로 눌렀다가 라이저 → 파이널 → **도입부터** 다시 1.5초 페이드인.
   순서를 `__view.sfx.ascAt` 에 시각으로 적는다(A9 가 그것을 읽는다). */
function sfxAscend(){
  try{
    if(!SND.ctx) return;
    const t=SND.ctx.currentTime; SND.ascAt=[];
    bgmGain(SND_BGM_VOL*0.25,0.25);              SND.ascAt.push(['duck',+t.toFixed(3)]);
    const a=sfx('sfx-ascend-riser');             if(a) SND.ascAt.push(['riser',+a.toFixed(3)]);
    const b=sfx('sfx-final-strike',{at:4});      if(b) SND.ascAt.push(['final',+b.toFixed(3)]);
    if(typeof setTimeout==='function') setTimeout(()=>{
      try{ if(SND.bgmSrc){ SND.bgmSrc.stop(); SND.bgmSrc=null; }
        SND.bgm='none'; sndBgmStart();
        SND.ascAt.push(['bgm',+SND.ctx.currentTime.toFixed(3)]); sndView();
      }catch(e){}
    },4300);
    SND.bgm='duck'; sndView();
  }catch(e){}
}

/* CrazyGames 의 `muteAudio` — **SDK 문서에서 확인한 이름**이다(추측 아님):
   `SDK.game.settings.muteAudio` + `addSettingsChangeListener`. 문서가 「이 설정이
   게임 내 설정보다 우선한다」고 못박아, 켜져 있으면 `#snd` 로도 못 켠다. */
/* 저장해 둔 설정을 읽는다 — **SND 가 다 만들어진 뒤**여야 한다(위 ⚠). */
try{ sndLoadPrefs(); sndApply(); }catch(e){}

