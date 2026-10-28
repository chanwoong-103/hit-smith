/* ═══════════════════════════════════════════════════════════════════
   === VIEW (표시) ===
   DOM 조작 · 렌더 · 애니메이션 · Phaser 캔버스. 이후 렌더 개편은
   여기만 만진다. 게임 상태를 바꾸는 코드는 이 아래에 두지 않는다.
   ═══════════════════════════════════════════════════════════════════ */
/* ══ 026 — 플랫폼 어댑터 (PLAT) ═══════════════════════════════════════════
   **게임 코드는 SDK 를 직접 부르지 않는다.** 이 객체 넷만 부른다:
   `PLAT.adsOn` · `PLAT.rewarded()` · `PLAT.playStart()` · `PLAT.playStop()`.
   SDK 가 없으면 전부 무동작이고 `adsOn=false` 라 **광고가 없는 곳에는 광고
   보상도 없다** — 026 §0 이 고친 결함이 그것이다(그 전까지 `#ad` 는 광고도
   횟수 제한도 없이 충전을 가득 채웠다. 스핀이 무한이었다).

   ⚠ 이 줄들은 **node 하네스에서도 eval 된다**(tools/harness.js 가 스크립트를
     통째로 돌린다). 거기엔 `location`·`window`·`document.head` 가 전부 없다 —
     그래서 바깥 세계를 만지는 자리는 전부 `typeof` 로 가린다. 하나라도 빠지면
     smoke·days 가 ReferenceError 로 죽는다. */
const CG_SDK='https://sdk.crazygames.com/crazygames-sdk-v3.js';
// 사이트락(허용 도메인) 목록과 **같은 목록**이다. 027 제출 때 실제 목록으로 맞출 것.
// ⚠ 이 목록이 틀리면 SDK 가 영영 안 실려 광고 수익이 조용히 0 이 된다.
const CG_HOSTS=['crazygames.com','crazygames.co.uk','1001juegos.com'];
// Basic Launch(QA) 동안 CrazyGames 는 광고를 꺼 둔다. SDK 에는 「광고가 켜졌는가」를
// 묻는 수단이 없다 — `ad.hasAdblock()` 은 차단기만 본다. 그래서 상수 한 줄이다.
// **Full Launch 로 넘어갈 때 028 이 이 한 줄만 true 로 바꾼다.**
const ADS_LIVE=false;
// 충전 광고 상한 (026 §4 — 값의 근거는 `node tools/days.js --ads` 결과표).
const AD_COOL=25*60*1000, AD_DAY=3;
// 재굴림 광고 쿨다운. 재굴림은 착지당 2회 상한이 이미 있어 상한은 더 안 둔다 —
// 남은 위험은 «보상 하나에 광고 둘»로 읽히는 연쇄뿐이라 그것만 막는다.
const DAD_COOL=30*1000;
/* ══ 037 — GameDistribution(GD) ═══════════════════════════════════════════
   CrazyGames 가 품질로 반려해(028) 같은 빌드를 개방형 포털에 올린다. **CG 경로는
   한 줄도 안 바뀐다** — 아래는 전부 «또 하나의 백엔드»이고, 어느 쪽도 아닌 곳
   (Pages·로컬)에서는 두 경로 모두 첫 줄에서 돌아가 **외부 요청이 0** 이다.
   ⚠ 공식 위키에서 확인한 것만 쓴다(추측 금지):
     · 준비 이벤트는 **`SDK_READY`** — SDK Events 표의 「When the SDK is ready.」
     · 보상형은 `preloadAd('rewarded')` → `showAd('rewarded')`, 그리고 **보상은
       `SDK_REWARDED_WATCH_COMPLETE` 에서만** 준다. 위키가 showAd 의 reject 에
       대해 「Please don't give reward here.」라고 못박는다.
     · 전면(미드롤/프리롤)은 인자 없는 `showAd()`.
     · 포털의 Rewarded 플래그가 꺼져 있으면 보상형 요청 자체가 안 된다 — 그래서
       버튼의 존재 조건은 `adsOn` 이 아니라 **`rewardOn`**(②-b)이다. */
const GD_SDK='https://html5.api.gamedistribution.com/main.min.js';
const GD_ID='0ac9b15c90f241d2a672c48aebc1078e';
const GD_HOSTS=['gamedistribution.com'];      // 하위 도메인 포함 (revision.gamedistribution.com)
// 미드롤 자체 하한. SDK 의 빈도 제한과 **별개**로 둔다 — 같은 버튼 연타로 광고가
// 연쇄되는 것만 막는 자물쇠다(G3).
const MID_COOL=3*60*1000;
let midAt=0;
let dadAt=0, dadReady=()=>false;        // 던전 블록이 진짜 술어로 갈아 끼운다

/* ══ 049 2차 ① — 광고 막이 서고 내리는 **그 자리에서 소리도 재운다** ══════════
   1차는 `sndGate()` 를 **250ms 틱과 `visibilitychange`** 에서만 불렀다. 그런데 틱은
   맨 앞 `if(PLAT.paused) return;`(026) 에서 돌아가므로 **광고 중에는 `sndGate()` 에
   영영 안 닿는다** — 효과음은 안 나지만 **이미 돌던 배경음악이 계속 나왔다**
   (검증 실측: `PLAT.paused` 참인데 `ctx` running · 오디오 시계 5.692 → 6.191).
   CrazyGames 요건이자 GD 필수 규칙(§2④)이라 결함이다.
   `adWall(on)` 은 CG 보상형(`adStarted`)·GD `SDK_GAME_PAUSE/START`·미드롤이 **전부**
   지나는 한 자리다. 세 길을 따로 고치지 않고 여기 한 줄로 모은다.
   ⚠ 부르는 쪽은 모두 `PLAT.paused` 를 **먼저** 세우고 `adWall()` 을 부른다 — 그래서
     `sndGate()` 가 보는 깃발이 맞다. */
const adWall=on=>{
  try{ sndGate(); }catch(e){}
  if(typeof document==='undefined') return;
  const e=document.getElementById('adwall'); if(e&&e.classList) e.classList.toggle('on',!!on); };
/* PLAT → __view 거울. **광고가 도는 동안에도 맞아야** 하므로 renderFast(250ms)에
   기대지 않고 광고의 시작·끝에서 직접 부른다 — 250ms 뒤에 보면 광고는 이미 끝나
   있고, 그러면 「광고 중에 멈췄는가」를 아무도 증명할 수 없다. */
function platSync(){
  try{ sndGate(); }catch(e){}     // 049 2차 ① — 멈춤이 세워지는 자리 둘째
  const V=globalThis.__view; if(!V||!V.plat) return; const p=V.plat;
  p.env=PLAT.env; p.ready=PLAT.ready; p.adsOn=PLAT.adsOn; p.paused=PLAT.paused;
  p.blocked=PLAT.blocked; p.ads=PLAT.ads; p.done=PLAT.done; p.failed=PLAT.failed;
  p.adLeft=Math.max(0,adLeft()); p.adReady=adOK(); p.dadReady=dadReady(); p.err=PLAT.err;
  p.rewardOn=PLAT.rewardOn; p.mids=PLAT.mids; p.midDone=PLAT.midDone;   // 037 ⑥
}

const PLAT={
  env:'none',        // none | local | crazygames | disabled | gamedistribution
  ready:false,       // SDK.init()(CG) / SDK_READY(GD) 까지 끝났는가
  adsOn:false,       // 광고 장치가 도는가 (GD 에서는 미드롤·프리롤이 이것만 본다)
  rewardOn:false,    // **보상형이 실제로 준비됐는가** — 광고 버튼 둘의 존재 조건(037 ②-b)
  gd:null,           // GD 의 `gdsdk` (CG 의 `sdk` 와 서로 배타)
  rewardHit:false,   // 이번 요청에서 SDK_REWARDED_WATCH_COMPLETE 를 받았는가
  mids:0, midDone:0, // 미드롤 요청 / 끝남 (검증 창구)
  paused:false,      // 광고가 도는 동안 true. 입력막·무대·250ms 틱이 전부 이걸 본다
  blocked:false,     // SDK 스크립트가 안 실렸다(차단기 포함) — SDK 없는 환경과 같이 돈다
  err:'', sdk:null,
  ads:0, done:0, failed:0,                      // 요청 / 완주 / 실패 (검증 창구)
  playStart(){ try{ if(this.sdk) this.sdk.game.gameplayStart(); }catch(e){} },
  playStop(){  try{ if(this.sdk) this.sdk.game.gameplayStop();  }catch(e){} },
  // 끝까지 본 경우에만 true. 오류·중단은 false 이고, 그때 게임은 **그대로 이어진다**.
  rewarded(){
    if(this.paused) return Promise.resolve(false);
    if(this.gd) return this.rewardedGD();                    // 037 — GD 분기
    if(!this.adsOn||!this.sdk) return Promise.resolve(false);
    this.ads++;
    return new Promise(res=>{
      let shut=false;
      const end=ok=>{ if(shut) return; shut=true;
        this.paused=false; adWall(false);
        if(ok) this.done++; else this.failed++;
        this.playStart(); platSync();
        if(typeof globalThis.__canvasWake==='function') globalThis.__canvasWake(600);
        res(ok); };
      // 콜백이 영영 안 오는 경우의 보루. 정상 경로는 위 `shut` 이 막는다.
      const t=setTimeout(()=>end(false),90*1000);
      const fin=ok=>{ clearTimeout(t); end(ok); };
      try{
        this.sdk.ad.requestAd('rewarded',{
          adStarted:()=>{ this.paused=true; adWall(true); this.playStop(); platSync(); },
          adFinished:()=>fin(true),
          adError:()=>fin(false) });
      }catch(e){ this.err=String((e&&e.message)||e); fin(false); }
    });
  },
  /* 037 ② — GD 보상형. **보상 판단은 이벤트 하나로만** 한다.
     `showAd('rewarded')` 의 promise 는 「광고 절차가 끝났다」만 알린다 — 위키가
     reject 에 대해 「Please don't give reward here.」라고 적고, resolve 도 보상을
     뜻하지 않는다. 그래서 `rewardHit`(= SDK_REWARDED_WATCH_COMPLETE 를 받았다)만
     본다. 반환 계약·상한·보상 내용은 026 그대로다. */
  rewardedGD(){
    if(!this.rewardOn) return Promise.resolve(false);
    this.ads++; this.rewardHit=false;
    return new Promise(res=>{
      let shut=false;
      const end=ok=>{ if(shut) return; shut=true;
        this.paused=false; adWall(false);
        if(ok) this.done++; else this.failed++;
        platSync();
        if(typeof globalThis.__canvasWake==='function') globalThis.__canvasWake(600);
        res(ok); };
      const t=setTimeout(()=>end(false),90*1000);     // 콜백이 영영 안 오는 경우의 보루
      const fin=()=>{ clearTimeout(t); end(this.rewardHit===true); };
      try{ const r=this.gd.showAd('rewarded'); 
        if(r&&r.then) r.then(fin,fin); else fin(); }
      catch(e){ this.err=String((e&&e.message)||e); clearTimeout(t); end(false); }
    });
  },
  /* 037 ③ — 미드롤/프리롤. **보상이 없다.** GD 가 아니면 즉시 끝나는 무동작이라
     CG·Pages 에서는 부르는 자리가 있어도 아무 일도 안 일어난다. */
  midroll(){
    if(!this.gd||this.paused) return Promise.resolve(false);
    if(Date.now() < midAt+MID_COOL) return Promise.resolve(false);   // 연타 자물쇠(G3)
    midAt=Date.now(); this.mids++;
    return new Promise(res=>{
      let shut=false;
      const end=()=>{ if(shut) return; shut=true; this.midDone++;
        this.paused=false; adWall(false); platSync();
        if(typeof globalThis.__canvasWake==='function') globalThis.__canvasWake(600);
        res(true); };
      const t=setTimeout(end,90*1000);
      const fin=()=>{ clearTimeout(t); end(); };
      try{ const r=this.gd.showAd(); if(r&&r.then) r.then(fin,fin); else fin(); }
      catch(e){ this.err=String((e&&e.message)||e); fin(); }
    });
  }
};

/* SDK 는 **CrazyGames 호스트와 `?cg=1` 에서만** 동적으로 싣는다.
   Pages·로컬 파일에서는 이 함수가 첫 줄에서 돌아가므로 **외부 요청이 0 이다**
   (022 배포 확인 항목 「네트워크 탭 외부 요청 0건」이 계속 통과해야 한다).
   ⚠ SDK 문서는 `<head>` 에 **정적으로** 넣으라고 적고 동적 삽입은 언급이 없다.
     `?cg=1` 로 init 까지 도는지 확인한 결과를 지시서 「구현 결과」에 적는다. */
(function platInit(){
  if(typeof location==='undefined'||typeof document==='undefined') return;
  if(!document.head||!document.createElement) return;
  const h=String(location.hostname||'').toLowerCase();
  const onCG=CG_HOSTS.some(d=>h===d||h.endsWith('.'+d));
  const forced=/[?&]cg=1(&|$)/.test(String(location.search||''));
  if(!onCG&&!forced) return;                    // ← 여기서 끝난다. 외부 요청 0.
  const sc=document.createElement('script');
  sc.src=CG_SDK; sc.async=true;
  // 차단기에 막혀도 **유저를 막지 않는다**(CrazyGames 요건). SDK 없는 환경과 똑같이 돈다.
  sc.onerror=()=>{ PLAT.blocked=true; };
  sc.onload=function(){
    const SDK=(typeof window!=='undefined'&&window.CrazyGames)?window.CrazyGames.SDK:null;
    if(!SDK){ PLAT.blocked=true; return; }
    // init 은 비동기이고, 끝나기 전에는 SDK 를 쓸 수 없다(문서).
    Promise.resolve().then(()=>SDK.init()).then(()=>{
      PLAT.sdk=SDK; PLAT.ready=true; PLAT.env=SDK.environment||'unknown';
      // `local`(localhost) 에서는 SDK 가 광고 대신 시연 오버레이를 띄운다 — 그걸로 흐름을 본다.
      PLAT.adsOn=(PLAT.env==='crazygames'&&ADS_LIVE)||PLAT.env==='local';
      PLAT.rewardOn=PLAT.adsOn;        // 037 ②-b: CG 는 지금처럼 하나로 둔다
      PLAT.playStart();
      try{ sndCgWatch(SDK); }catch(e){}     // 049 §2④ — muteAudio(문서 확인한 이름)
      renderFast();
    }).catch(e=>{ PLAT.ready=false; PLAT.adsOn=false;
      PLAT.err=String((e&&e.message)||e); });
  };
  document.head.appendChild(sc);
})();

/* ══ 037 ①④ — GameDistribution 백엔드 ════════════════════════════════════
   **GD 호스트이거나 `?gd=1` 일 때만** 싣는다. CG 판정이 먼저이고 둘은 서로 배타다
   (`PLAT.sdk` 가 이미 있으면 여기 오지 않는다 — 아래 첫 줄이 그것을 본다).
   ⚠ `GD_OPTIONS` 는 스크립트를 넣기 **전에** 둔다(위키 지시). 순서가 뒤집히면
     SDK 가 자기 설정을 못 보고 조용히 기본값으로 돈다. */
(function gdInit(){
  if(typeof location==='undefined'||typeof document==='undefined') return;
  if(!document.head||!document.createElement) return;
  const h=String(location.hostname||'').toLowerCase();
  const onCG=CG_HOSTS.some(d=>h===d||h.endsWith('.'+d));
  if(onCG||/[?&]cg=1(&|$)/.test(String(location.search||''))) return;   // CG 우선
  const onGD=GD_HOSTS.some(d=>h===d||h.endsWith('.'+d));
  const forced=/[?&]gd=1(&|$)/.test(String(location.search||''));
  if(!onGD&&!forced) return;                     // ← 여기서 끝난다. 외부 요청 0.
  PLAT.env='gamedistribution';                   // 막(④)은 SDK 와 **무관하게** 뜬다
  gdStartShow();

  if(typeof window!=='undefined') window.GD_OPTIONS={
    gameId:GD_ID,
    onEvent:function(e){
      const n=e&&e.name;
      if(n==='SDK_READY'){
        PLAT.gd=(typeof window!=='undefined')?window.gdsdk:null;
        PLAT.ready=true; PLAT.adsOn=true;        // 미드롤·프리롤은 여기서부터 돈다
        platSync(); try{ renderFast(); }catch(x){}
        gdPreload();
      }
      else if(n==='SDK_GAME_PAUSE'){ PLAT.paused=true;  adWall(true);  platSync(); }
      else if(n==='SDK_GAME_START'){ PLAT.paused=false; adWall(false); platSync();
        if(typeof globalThis.__canvasWake==='function') globalThis.__canvasWake(600); }
      // **보상의 유일한 근거.** 아래 한 줄 말고 보상을 주는 자리는 없다.
      else if(n==='SDK_REWARDED_WATCH_COMPLETE'){ PLAT.rewardHit=true; }
      else if(n==='SDK_ERROR'){ PLAT.err=String((e&&e.message)||'SDK_ERROR'); }
    }
  };
  const sc=document.createElement('script');
  sc.src=GD_SDK; sc.async=true;
  sc.onerror=()=>{ PLAT.blocked=true; };          // 차단기여도 게임은 그대로
  document.head.appendChild(sc);
})();
/* ②-b — 보상형 버튼은 **보상형이 실제로 준비된 뒤에만** 존재한다.
   첫 업로드는 포털 플래그가 꺼진 채다(0단계 3번). 그때 버튼이 보이면 「누르면
   매번 실패」가 되고, 그것이 026 §0 이 막은 바로 그 결함이다. */
function gdPreload(){
  if(!PLAT.gd||typeof PLAT.gd.preloadAd!=='function') return;
  let r; try{ r=PLAT.gd.preloadAd('rewarded'); }catch(e){ return; }
  if(!r||!r.then) return;
  r.then(()=>{ PLAT.rewardOn=true;  platSync(); try{ platUI(); }catch(x){} },
         ()=>{ PLAT.rewardOn=false; platSync(); try{ platUI(); }catch(x){}
               setTimeout(gdPreload,5*60*1000); });   // 플래그가 나중에 켜질 수 있다
}
/* ④ — 프리롤은 「사용자 입력 직후」여야 한다(GD 규칙). 그래서 GD 에서만 첫 화면
   위에 막 하나를 둔다. **CG·Pages·로컬에는 이 요소가 아예 없다** — CrazyGames 의
   「바로 게임플레이」 요건을 깨지 않기 위해서다. 한 세션에 한 번. */
let gdNoAd=false;
function gdStartShow(){
  if(document.getElementById('gdStart')) return;
  const w=document.createElement('div'); w.id='gdStart';
  const box=document.createElement('div');
  const h2=document.createElement('h2'); h2.textContent='Hit Smith';
  const b=document.createElement('button'); b.id='gdPlay'; b.className='primary';
  b.textContent=t('gd.play');
  box.appendChild(h2); box.appendChild(b); w.appendChild(box);
  const go=()=>{ b.disabled=true;
    const done=()=>{ const e=document.getElementById('gdStart'); if(e) e.remove(); };
    // SDK 가 안 실렸거나(차단기) 3초 안에 준비 신호가 없으면 **광고 없이** 들어간다.
    if(gdNoAd||!PLAT.gd||!PLAT.ready) { done(); return; }
    PLAT.midroll().then(done,done);
  };
  b.onclick=go;
  const put=()=>{ if(document.body) document.body.appendChild(w);
    else setTimeout(put,30); };
  put();
  setTimeout(()=>{ gdNoAd=!PLAT.ready; },3000);
}

/* 광고 버튼 둘의 존재·활성 상태는 **여기 한 곳에서만** 정한다.
   ⚠ `VIEW` 는 이 파일의 한참 아래에서 선언되는데 renderFast() 는 그 전에 한 번
     돈다(부팅 `render()`). 그래서 `VIEW` 를 직접 쓰지 않고 `globalThis.__view` 를
     가려서 본다 — 직접 쓰면 첫 호출이 TDZ 로 죽는다. */
/* 037 ⑤ — 광고가 실패로 끝났을 때 **한 줄**. 새 팝업을 만들지 않는다(029 에서 앞당김).
   보상형 두 자리(충전·재굴림)가 같은 줄을 쓴다. */
function adFailMsg(){
  const m=(typeof document!=='undefined')&&document.getElementById('msg');
  if(!m) return; m.textContent=t('ad.failed'); m.className='';
}
const adLeft=()=>{ if(S.adDay!==today()){ S.adDay=today(); S.adN=0; } return AD_DAY-(S.adN||0); };
const adOK=()=>PLAT.rewardOn && !PLAT.paused && adLeft()>0 && Date.now()>=(S.adAt||0)+AD_COOL;
function platUI(){
  const ad=document.getElementById('ad'), dad=document.getElementById('dad');
  // 광고가 없는 곳에서는 **버튼 자체가 없다.** 눌리는데 아무 일도 안 나는 버튼을
  // 두는 것이 CrazyGames 요건 위반이자 최악의 첫인상이다(026 §0·§5).
  // 037 ②-b: 존재 조건이 `adsOn` → **`rewardOn`** 으로 바뀐다. CG 에서는 둘이 같은
  // 값이라 026 의 동작이 그대로이고, GD 에서는 preload 가 성공한 뒤에만 나타난다.
  if(ad){ ad.style.display=PLAT.rewardOn?'':'none'; ad.disabled=!adOK(); }
  if(dad){ dad.style.display=PLAT.rewardOn?'':'none';
    dad.disabled=!(PLAT.rewardOn&&!PLAT.paused&&dadReady()); }
  platSync();
}

