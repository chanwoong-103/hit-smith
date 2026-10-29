// 017: Phaser 를 걷어냈다. 남은 것은 브라우저 2D 캔버스뿐이다.
// **브라우저 판별은 requestAnimationFrame 으로 한다** — 옛 `typeof Phaser` 자리다.
// node 하네스(tools/harness.js)에는 rAF 도 실제 캔버스도 없으므로 이 블록을 통째로
// 건너뛴다. 하네스는 CORE 검사용이고 화면은 검사 대상이 아니다(011 이 SVG 폴백을
// 지울 때 세운 규약과 같다).
if(typeof requestAnimationFrame!=='undefined' && typeof document!=='undefined'
   && document.getElementById('stage')){
  // 화면 좌표를 재는 대상. 캔버스는 고정(fixed)이라 스크롤하면 어긋나므로
  // 매 프레임 사각형을 확인하고 **바뀐 프레임에만** 다시 그린다.
  const rectOf=id=>{ const e=document.getElementById(id); if(!e) return null;
    const r=e.getBoundingClientRect();
    return {x:r.left, y:r.top, w:r.width, h:r.height}; };
  const same=(a,b)=>a&&b&&Math.abs(a.x-b.x)<.5&&Math.abs(a.y-b.y)<.5&&
                    Math.abs(a.w-b.w)<.5&&Math.abs(a.h-b.h)<.5;
  // 0xRRGGBB → 캔버스 색 문자열. 팔레트 상수(C_IRON…)는 그대로 두고 여기서만 푼다.
  const hex=c=>'#'+c.toString(16).padStart(6,'0');
  const rgba=(c,a)=>`rgba(${c>>16&255},${c>>8&255},${c&255},${a})`;

  const mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  VIEW.reducedMotion = !!(mq && mq.matches);
  if(mq && mq.addEventListener) mq.addEventListener('change',e=>{ VIEW.reducedMotion=e.matches; });

  /* ── 두 겹의 캔버스 ─────────────────────────────────────────────────
     Phaser 가 해 주던 일은 이것이 전부였다: 부모에 <canvas> 를 만들고, 화면
     크기로 맞추고, rAF 를 돌린다. 실제로 쓰던 API 도 Game·AUTO·Scale.RESIZE
     넷뿐이었다(013b 실측). 그래서 아래 30줄이 vendor 1.14MB 을 대신한다.
     ⚠ **해상도는 CSS 픽셀 1:1 로 둔다.** Phaser 3 도 그랬다. devicePixelRatio 로
     올리면 선이 또렷해지는데, 그것이 곧 "화면이 달라졌다"이고 017 의 성공 조건과
     정면으로 부딪힌다. 제안 절에 적어 올렸다. */
  function mkLayer(id){
    const h=document.getElementById(id); if(!h) return null;
    const c=document.createElement('canvas');
    c.style.width='100%'; c.style.height='100%';   // 부모는 position:fixed;inset:0
    h.appendChild(c);
    return {el:c, ctx:c.getContext('2d')};
  }
  const L_BG=mkLayer('stage'), L_FX=mkLayer('fx');

  let CW=0, CH=0;                       // 캔버스 CSS 크기 (= __view.canvas)
  let bgCan=null, bgCtx=null;           // 배경을 구워 두는 오프스크린
  let pnCan=null, pnCtx=null;           // 가운데 패널을 구워 두는 오프스크린
  let rF=null, rH=null, rV=null;        // #forge · #hearth · #focus 사각형
  let shakeUntil=0, shakeAmp=0;         // 카메라 셰이크

  /* ⚠ 009~010 을 두 세션 잡아먹은 RenderTexture 함정 둘이 **여기엔 존재하지 않는다.**
       ① 원점: 2D 캔버스는 언제나 좌상단 기준이다. setOrigin 이라는 개념이 없다.
       ② 크기 변경: `canvas.width=w` 는 버퍼를 새로 잡고 지울 뿐, 그 뒤의 그리기가
          망가지지 않는다. destroy/재생성이 필요 없어 makeBg·panelRT 두 함수가
          아래 두 줄로 줄었다. 013b 가 이관 근거로 든 자리가 이것이다. */
  const sizeCan=(c,w,h)=>{ if(c.width!==w||c.height!==h){ c.width=w; c.height=h; } return c; };

  /* ── 방사 그라디언트 (017 의 유일한 그림 변경) ──────────────────────
     008 이 잔광을 타원 26장(배경)·12장(화로)으로 만든 이유는 Phaser Graphics 에
     방사 그라디언트가 **없어서**였다. 2D 캔버스에는 있다.
     **곡선은 새로 고르지 않고 옛 스택의 누적 알파를 그대로 옮긴다** — 017 의
     성공 조건이 "눈에 보이는 변화 0"이기 때문이다. 층 t 의 알파가 a/N·(1−.35t)
     이고 반지름 r 인 점은 t≥r 인 층 전부에 덮이므로
        A(r) = a·∫ᵣ¹(1−.35t)dt = a·[(1−r) − .175(1−r²)]
     캔버스 방사 그라디언트는 원형뿐이라 세로만 눌러 타원으로 만든다. */
  function glow(g,cx,cy,rx,ry,a,N,dy){
    // ⚠ 화로 잔광의 타원 12장은 **동심이 아니었다** — 중심이 base−.08h·t 로 t 와
    //   함께 움직였다. 즉 전체가 (cx,cy) 를 중심으로 한 **닮음 확대** 족이고,
    //   캔버스 방사 그라디언트의 두 원이 그리는 것이 정확히 그 닮음이다. 끝 원을
    //   (0,dy,rx) 로 두면 층 t 가 재현된다. dy 를 빼면 동심 = 배경 잔광 26장.
    //   동심으로 놨을 때 모루 아래가 최대 13 밝았다(실측).
    // ⚠ 알파는 **합이 아니라 곱**으로 쌓인다. ∫ 근사(a·[(1−r)−.175(1−r²)])는
    //   화로처럼 층 알파가 굵으면 중앙에서 .495 vs 실제 .393 으로 크게 빗나가고,
    //   가장자리에서는 층 수가 적어(ceil) 반대로 모자란다. 그래서 옛 스택의
    //   합성을 그대로 계산해 스톱으로 옮긴다 — 층 j 의 고른 구간 한가운데에 찍는다.
    // 탭이 숨으면 #hearth 가 0×0 이라 rx·ry 가 0 이 되고 k=0/0=NaN 이 된다 —
    // createRadialGradient 는 비유한값에 예외를 던진다(017 검증에서 pageerror 로
    // 잡혔다). 옛 fillEllipse 는 0 크기를 조용히 넘겼으므로 여기서 막는다.
    if(!(rx>0)||!(ry>0)) return;
    const k=ry/rx, off=(dy||0)/k;
    const gr=g.createRadialGradient(0,0,0, 0,off,rx);
    //   층 j..N 이 덮는 구간은 r∈((j−1)/N, j/N] 이므로 스톱은 그 **한가운데**에
    //   찍는다. (j+.5)/N 로 한 칸 밀었더니 전 구간이 10 밝게 나왔다(실측).
    for(let j=1;j<=N;j++){ let keep=1;
      for(let i=j;i<=N;i++) keep*=1-a/N*(1-.35*i/N);
      gr.addColorStop((j-.5)/N, rgba(C_HOT, 1-keep)); }
    g.save(); g.translate(cx,cy); g.scale(1,k);
    g.fillStyle=gr; g.beginPath(); g.arc(0,off,rx,0,Math.PI*2); g.fill();
    g.restore();
  }

  // 배경: 무쇠 두 겹 + 아래쪽 화로 잔광 (§1, body CSS 에서 008 이 이관한 것).
  function drawBg(){
    if(!bgCan) return;
    const w=CW, h=CH, g=bgCtx;
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h);
    // 위쪽은 무쇠(푸른 기), 아래로 내려가며 숯(갈색 기)으로 넘어간다.
    g.fillStyle=hex(C_CHAR); g.fillRect(0,0,w,h);
    const lg=g.createLinearGradient(0,0,0,h*.62);
    lg.addColorStop(0,hex(C_IRON)); lg.addColorStop(1,hex(C_CHAR));
    g.fillStyle=lg; g.fillRect(0,0,w,h*.62);
    glow(g, w*.5, h*1.06, w*1.25*.68, h*.52*.68, .15, 26);   // ← 옛 타원 26장
    VIEW.perf.bgBakes++;
  }

  // 가운데 패널 바탕 + 화로 창 + 모루 (§2). 패널 크기 그대로 굽는다 —
  // 화면 크기로 잡으면 프레임마다 화면 한 장을 더 칠하게 된다(009 실측).
  function bakePanel(){
    const w=Math.max(1,Math.ceil(rF.w)), h=Math.max(1,Math.ceil(rF.h));
    if(!pnCan){ pnCan=document.createElement('canvas'); pnCtx=pnCan.getContext('2d'); }
    sizeCan(pnCan,w,h);
    const g=pnCtx, ox=rF.x, oy=rF.y;      // 오프스크린 안은 패널 좌상단 기준 좌표
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,w,h);
    const lg=g.createLinearGradient(0,0,0,rF.h);
    lg.addColorStop(0,hex(C_IRON)); lg.addColorStop(1,hex(C_CHAR));
    g.fillStyle=lg; g.fillRect(0,0,rF.w,rF.h);
    if(rH){
      const hx=rH.x-ox, hy=rH.y-oy, cx=hx+rH.w/2, base=hy+rH.h;
      /* 047 §2③ — 숯·잔광이 화로 창이 아니라 **장면 전체**에 깔린다(`rH` = 장면). */
      g.fillStyle=hex(C_CHAR); g.fillRect(hx,hy,rH.w,rH.h);
      glow(g, cx, base, rH.w*.46, rH.h*.525, .6, 12, -rH.h*.08);  // ← 옛 타원 12장
      /* 047 §2③ — 모루를 **키운다**: 폭 `min(장면 폭 × 0.55, 300px)`, 장면 바닥
         가운데. 새 그림·새 색은 없다(R5 몫) — 같은 도형을 크게 그릴 뿐이다.
         ⚠ `rH` 는 이제 **장면(`#forge`)** 이다(sync 참고). 옛 `rH` 는 화로 창이라
           모루가 그 안에 갇혀 작았다. */
      const aw=Math.min(rH.w*.55,300), ah=Math.max(20,Math.min(rH.h*.22,86));
      const ay=base-6, T=ay-ah, L=cx-aw/2, R=cx+aw/2;
      VIEW.anvil={x:ox+cx, y:oy+T};                            // 연출 발원점(화면 좌표)
      /* ⚠ 몸통·받침을 숯(`C_CHAR`)으로 칠하면 **안 보인다** — 옛 모루는 밝은 화로
         창 «안»에 있어서 숯 실루엣이 읽혔는데, 047 은 장면 바닥(역시 숯)에 앉는다.
         화면으로 확인했다(모루가 상판 한 줄로만 보였다). 철색으로 올린다 —
         새 색을 만들지 않고 이미 쓰는 `C_IRON` 을 어둡게 깐 것이다. */
      g.fillStyle=rgba(C_IRON,.72);
      g.fillRect(cx-aw*.19, T+ah*.34, aw*.38, ah*.52);         // 몸통
      g.fillRect(cx-aw*.30, ay-ah*.16, aw*.60, ah*.16);        // 받침
      g.fillStyle=hex(C_IRON);
      g.fillRect(L, T, aw, ah*.30);                            // 상판
      g.beginPath(); g.moveTo(R,T);                            // 뿔
      g.lineTo(R+aw*.16, T+ah*.15); g.lineTo(R, T+ah*.30); g.closePath(); g.fill();
      // 윗면은 새 회색을 만들지 않고 화로 불빛을 받게 한다 (알파로만 밝힌다)
      g.fillStyle=rgba(C_HOT,.35); g.fillRect(L, T, aw, ah*.07);
    } else VIEW.anvil=null;
    VIEW.perf.panelBakes++;
  }


  /* ══ 전투 무대 (013) ══════════════════════════════════════════════
     "모험을 떠난다"를 만드는 자리다. 규칙은 ART-DIRECTION 「전투 무대」 그대로:

     ① **평소에는 멈춰 있다.** 웨이브를 클리어하는 순간에만 배경이 옆으로 흐른다.
        상시 스크롤은 011 의 절전을 통째로 무효로 만든다 — 방치형에서 배터리는
        곧 체류 시간이다. 그래서 이동은 사건(웨이브 전환) 하나에만 붙는다.
     ② **3층 패럴랙스**를 소수의 타일 반복으로 만든다 (손그림 12장).
     ③ **구간은 팔레트 스왑**이다. 지형을 새로 그리지 않는다.

     층마다 **한 장씩 구워 두고**(009·011 규약) 프레임당 drawImage 세 번으로 끝낸다.
     띠 너비를 「무대 폭 + 4타일」로 잡는 이유: 네 장이 한 주기라 4타일마다 무늬가
     반복되므로, 그만큼 여유를 두면 **스크롤이 아무리 진행돼도 다시 굽지 않는다.** */
  const STAGE_PARA=[0.25, 0.55, 1.00];    // 먼 산이 가장 느리다
  const TRAVEL_MS=420, TRAVEL_PX=176;     // 짧고 분명하게 (길면 방치 시간을 이동이 먹는다)
  const STAGE_KEYS=['far','mid','near'];
  let rA=null;                            // #arena 사각형
  let stLay=[], stScale=0, stSeg=-1, stW=0, stH=0, stGround=0;
  let scrollX=0, travFrom=0, travTo=0, travUntil=0;
  const foeCan={};                        // 구간·배율당 몹·용사 캔버스 한 벌

  // 스프라이트의 실제 바닥 행 — 발을 지면선에 맞추려면 이것이 필요하다.
  function lastRow(px,W,H){
    for(let y=H-1;y>=0;y--) for(let x=0;x<W;x++)
      if(px.charCodeAt(y*W+x)!==46) return y;
    return H-1;
  }
  function foeSprite(kind,tier,ms,seg,white){
    const k=kind+'|'+tier+'|'+ms+(white?'|w':'');
    if(foeCan[k]) return foeCan[k];
    const px = kind==='hero' ? SPR_HERO : kind==='heroAtk' ? SPR_HERO_ATK
             : (SPR_MOB[kind]||SPR_MOB.melee)[tier-1];
    // 번쩍임(018)은 같은 그림을 **백열 한 색으로** 구운 판이다 — 프레임을 그리지
    // 않는다는 규약 그대로고, 팔레트만 갈아 끼우면 되므로 한 장도 늘지 않는다.
    const P = white ? [null,HOT_WHITE,HOT_WHITE,HOT_WHITE,HOT_WHITE]
            : (kind==='hero'||kind==='heroAtk') ? heroPalette(seg) : mobPalette(seg);
    const cv=document.createElement('canvas');
    cv.width=SPR_UNIT*ms; cv.height=SPR_UNIT*ms;
    if(!paintPX(cv.getContext('2d'),px,SPR_SIZE,SPR_SIZE,P,ms*SPR_FIT,0,0)) return null;
    cv.__bot=lastRow(px,SPR_SIZE,SPR_SIZE);   // **칸** 인덱스다 — 화면으로 옮길 때 SPR_FIT 을 곱한다
    return (foeCan[k]=cv);
  }
  // 무기 궤적은 **012 의 장비 스프라이트를 그대로 태운다**(ART-DIRECTION).
  // 등급이 오르면 궤적의 그림이 바뀌므로 장비를 바꾼 보람이 전투에서 보인다.
  function weaponSprite(g,ms){
    const k='wpn|'+(g|0)+'|'+ms;
    if(foeCan[k]) return foeCan[k];
    const px=SPR.weapon[(g?TIER(g):2)-1];
    const cv=document.createElement('canvas');
    cv.width=SPR_UNIT*ms; cv.height=SPR_UNIT*ms;
    if(!paintPX(cv.getContext('2d'),px,SPR_SIZE,SPR_SIZE,gradePalette(g),ms*SPR_FIT,0,0)) return null;
    return (foeCan[k]=cv);
  }

  /* ══ 전투 모션 (018) ══════════════════════════════════════════════
     ART-DIRECTION 「전투 모션」: **타격감은 프레임 수가 아니라 타이밍에서 나온다.**
       ① 예비-타격-복귀 — 예비는 길게, 타격은 짧게, 복귀는 천천히. translate 뿐이다.
       ② hitstop      — 맞는 순간 양쪽을 **완전히 멈춘다**. 더하는 게 아니라 빼는 기법.
       ③ 번쩍임        — 백열 한 색으로 구운 같은 그림을 2프레임 얹는다.
       ④ 소멸          — 그림이 아니다. 위로 튀었다 아래로 꺼지며 불티가 흩어진다.
     넷 다 `__view.counters` 에 나온다. 추가 손그림은 용사 공격 포즈 1장뿐이다. */
  const ATK_WIND=150, ATK_HIT=70, ATK_BACK=180;   // 예비 · 타격 · 복귀
  const ATK_LAND=ATK_WIND+ATK_HIT, ATK_ALL=ATK_LAND+ATK_BACK;
  const ATK_PULL=6, ATK_PUSH=13;                  // 셀 단위 (배율을 곱한다)
  const HITSTOP_MS=50;      // 3프레임
  const FLASH_MS=34;        // 2프레임
  const DIE_MS=320;
  const DIE_LOG=32;         // `motion.dieOrder` 상한 — 검증 창구지 로그가 아니다
  // §3 개체 간격 — 고정 픽셀이 아니라 **무대 폭에서 파생**한다.
  const STAGE_X0=0.27, STAGE_SPAN=0.72, MOB_GAP=0.14;
  const MOB_INK=0.88;       // 스프라이트 24칸 중 실제로 칠해진 폭의 비율(경계상자)
  let atkT=-1, atkGrade=0, atkLanded=false;
  let stopUntil=0, flashUntil=0;
  const dying=[];           // {slot,kind,tier,t}

  /* ⚠ 개체 수가 곧 남은 체력이다 (DESIGN.md: 전체 체력 / 개체 수). 붙어서 하나로
     보이면 그 정보가 죽는다 — 013 검증이 「근접 9마리가 뭉쳤다」고 지적한 자리다.
     간격을 고정 픽셀로 주면 마리 수가 바뀔 때 다시 뭉치므로 무대 폭에서 파생하고,
     폭이 모자라면 **배율을 한 단계 낮춘다**(배율은 정수여야 한다 — 012). */
  function mobLayout(){
    const n=foeCount|0;
    const span=rA.w*STAGE_SPAN;
    // 필요한 폭은 **칸 폭이 아니라 잉크 폭**으로 잰다. 스프라이트는 24칸 중 21칸만
    // 칠해져 있어(경계상자) 칸으로 재면 필요 이상으로 배율을 낮춘다 — 처음에 그렇게
    // 잡았더니 380 에서 5마리일 때도 배율 1 로 떨어졌다.
    const need=m=>{ const ink=SPR_UNIT*m*MOB_INK;
      return (n-1)*(ink+Math.max(3,ink*MOB_GAP)) + SPR_UNIT*m; };
    let ms=Math.max(1,stScale-1);
    while(ms>1 && need(ms) > span) ms--;
    const step=n>1 ? (span-SPR_UNIT*ms)/(n-1) : 0;
    return {n, ms, x0:rA.x+rA.w*STAGE_X0, step, gap:step-SPR_UNIT*ms*MOB_INK};
  }
  const heroDX=ms=>{
    if(atkT<0) return 0;
    // reduced-motion 에서는 예비·복귀를 줄인다 (008 규칙 유지).
    if(VIEW.reducedMotion)
      return atkT<ATK_LAND ? 0 : ATK_PUSH*ms*.5*(1-Math.min(1,(atkT-ATK_LAND)/ATK_BACK));
    if(atkT<ATK_WIND) return -ATK_PULL*ms*ezOut(atkT/ATK_WIND);          // 예비: 천천히 뒤로
    if(atkT<ATK_LAND){ const t=(atkT-ATK_WIND)/ATK_HIT;                   // 타격: 빠르게 앞으로
      return -ATK_PULL*ms + (ATK_PULL+ATK_PUSH)*ms*t*t; }
    return ATK_PUSH*ms*(1-ezOut((atkT-ATK_LAND)/ATK_BACK));               // 복귀: 천천히
  };
  function stepMotion(dt){
    // hitstop — **무대의 시간이 흐르지 않는다.** 용사도 몹도 소멸도 그 자리에 선다.
    if(nowMs()<stopUntil) return;
    if(atkT>=0){
      atkT+=dt;
      if(!atkLanded && atkT>=ATK_LAND){        // 궤적이 닿는 순간
        atkLanded=true;
        if(!VIEW.reducedMotion){ stopUntil=nowMs()+HITSTOP_MS; VIEW.counters.hitstop++; }
        flashUntil=nowMs()+(VIEW.reducedMotion?FLASH_MS:HITSTOP_MS+FLASH_MS);
        VIEW.counters.flash++;
      }
      if(atkT>=ATK_ALL){ atkT=-1; atkLanded=false; }
    }
    for(let i=dying.length-1;i>=0;i--){ dying[i].t+=dt; if(dying[i].t>=DIE_MS) dying.splice(i,1); }
  }
  // 개체 하나가 사라지는 순간 (CORE 의 체력 계산은 건드리지 않는다 — 소멸 시점은
  // drawFoes 가 이미 정한 그대로다). 008 의 불티 예산 안에서 몇 알만 흩는다.
  // 019 §2: **슬롯 배열을 받는다.** 같은 틱에 죽은 것들은 한 다발이다 — 깨움 창도
  // 불티 예산도 한 번만 선다. 숫자 하나로 부르던 옛 호출도 그대로 받는다.
  globalThis.__foeDie=slots=>{
    if(!rA || !stLay.length) return;
    if(hidden()){ VIEW.perf.hiddenSkips++; return; }   // 안 보이는 소멸은 그리지 않는다
    const list=Array.isArray(slots)?slots:[slots];
    if(!list.length) return;
    const L=mobLayout(), ground=rA.y+stGround;
    const tier=Math.max(1,Math.min(3,1+Math.floor((S.wave-1)/25)));
    // 불티는 **다발 전체의 예산**을 나눠 쓴다. 마리마다 6알이면 9마리에서 54알이
    // 되어 앞 겹이 그만큼 오래 살아 있는다 — 자리는 마리마다 지키되 알 수를 나눈다.
    const budget=VIEW.reducedMotion?2:Math.min(12, 5+list.length);
    const per=Math.max(1, Math.round(budget/list.length));
    for(const slot of list){
      const kind = foeKind==='mix' ? (slot%2?'ranged':'melee') : foeKind;
      dying.push({slot, kind, tier, t:0});
      VIEW.counters.dissolve++;
      // 021 — **소멸 순서를 검증 창구에 낸다.** 이 값이 없어서 101개 검사 중
      // 아무도 「먼 쪽부터 죽는다」를 못 잡았다. 길이는 묶어 둔다(누수 금지).
      VIEW.motion.dieOrder.push(slot);
      if(VIEW.motion.dieOrder.length>DIE_LOG) VIEW.motion.dieOrder.shift();
      emit(per, L.x0+L.step*slot+SPR_UNIT*L.ms/2, ground-8*L.ms, .45);   // 짧게 사는 불티
    }
    // 깨우는 창은 **실제로 도는 시간에 맞춘다.** 처음에 앞 겹을 1,220ms 깨웠더니
    // 유휴 가동률이 앞 겹만 35.6% 로 뛰었다(불티는 320ms 면 다 꺼진다).
    canvasWake(DIE_MS+80, DIE_MS+90);
  };
  function bakeStage(){
    stLay=[];
    if(!rA || rA.w<8 || rA.h<8) return;
    // 배율은 정수다 (012 규약 — 소수 배율은 픽셀을 뭉갠다).
    const s=Math.max(1,Math.min(3,Math.floor(rA.h/26)));
    const seg=segOf(S.wave), w=Math.ceil(rA.w)+TILE_W*4*s, h=TILE_H*s;
    const G=Math.round(rA.h-8*s);        // 지면선 — 근경 흙 두께가 8행이다
    for(let i=0;i<3;i++){
      const cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      const cx=cv.getContext('2d'), P=stagePalette(seg,i);
      const tiles=SPR_TILE[STAGE_KEYS[i]], tw=TILE_W*s;
      for(let t=0; t*tw<w; t++) paintPX(cx,tiles[t%4],TILE_W,TILE_H,P,s,t*tw,0);
      // 층의 지평선이 위에서부터 먼 산 → 중경 → 근경 순으로 내려와야 원근이 산다.
      // 각 층 타일의 「가장자리 높이」(먼 17행 · 중경 15행 · 근경 16행)를 기준으로
      // 지면선 G 에서 거꾸로 올려 놓는다. 처음에 0.30h 로 잡았더니 중경 지평선이
      // 근경보다 **아래**로 내려가 원근이 뒤집혔다.
      stLay.push({can:cv, para:STAGE_PARA[i], per:tw*4,
        y: i===0 ? G-17*s-8*s : i===1 ? G-15*s-3*s : G-16*s});
    }
    // 몹·용사 캐시는 **구간·배율당 한 벌**이다. 구간이 바뀌면 통째로 비운다 —
    // 안 비우면 웨이브가 오를수록 캔버스가 쌓인다(soak.js 가 보는 누수).
    if(seg!==stSeg || s!==stScale) for(const k in foeCan) delete foeCan[k];
    stScale=s; stSeg=seg; stW=Math.ceil(rA.w); stH=Math.ceil(rA.h);
    // 근경 타일의 윗면은 16행이다 (SPR_TILE 주석) — 거기가 지면선이다.
    stGround = stLay[2].y + 16*s;   // = G
    VIEW.perf.bgBakes++;    // 무대 띠도 배경 오프스크린이다 — P2 가 방치 중 재굽기를 잡는다
  }
  // 이동은 웨이브 전환 사건에만 붙는다. 진행은 프레임에서 시간으로 푼다.
  function stepTravel(){
    if(!travUntil) return;
    const left=travUntil-nowMs();
    if(left<=0){ scrollX=travTo; travUntil=0; return; }
    scrollX = travFrom + (travTo-travFrom)*ezOut(1-left/TRAVEL_MS);
  }
  /* ══ 051 ④ — 체력 막대를 **머리 위로** (046 §7-e) ════════════════════════
     **캔버스는 자리만 낸다. 막대 자체는 DOM 이다.**
     ⚠ 처음엔 캔버스에 그렸다가 되물렀다 — 캔버스는 사건이 없으면 320ms 뒤에 **잠든다**
       (011 절전). 그러면 CORE 가 `#fill` 에 계속 쓰는 동안 막대가 **얼어붙는다**
       (실측: 틱 뒤 CORE 31.7% 인데 그려진 앞 겹은 66.8%). 막대를 위해 캔버스를
       250ms마다 깨우면 유휴 가동률이 통째로 무너진다(원칙 1 · soak 의 duty).
       DOM 막대는 CSS 전환이 두 겹의 지연을 공짜로 주고, 캔버스는 계속 잘 수 있다.
     그래서 여기서 하는 일은 **머리 꼭지의 좌표를 재서 내놓는 것**뿐이다
     (`__view.stage.hp`). 자리에 놓는 것은 `renderFast()` → `hpPlace()` 다. */
  const HP_H=4, HP_GAP=4;
  function hpGeom(L,ground,topFoe,topHero,heroX,heroW){
    const out={h:HP_H, gap:HP_GAP};
    const n=L.n;
    if(n>0 && isFinite(topFoe)){
      const w=Math.max(24,Math.round(L.step*(n-1)+SPR_UNIT*L.ms));
      out.foe={x:Math.round(L.x0), y:Math.round(topFoe-HP_GAP-HP_H), w, h:HP_H, top:Math.round(topFoe)};
    }
    if(isFinite(topHero)){
      const hw=Math.max(18,Math.round(heroW||SPR_UNIT*L.ms));
      out.hero={x:Math.round(heroX), y:Math.round(topHero-HP_GAP-HP_H), w:hw, h:HP_H, top:Math.round(topHero)};
    }
    /* 051 2차 ② — **기하가 바뀐 그 프레임에** 막대를 옮긴다.
       1차는 자리를 250ms 틱에서만 옮겨서, 몹 수 6↔8 로 배율이 뛰는 순간부터 다음
       틱까지 막대가 옛 자리에 남아 **머리를 덮었다**(검증 실측 768×1024 14.6% 프레임).
       ⚠ 바뀌지 않은 프레임에서는 **아무것도 안 한다** — DOM 쓰기가 바뀔 때만이라
         절전(011)과 soak 의 duty 가 그대로다. */
    const prev=VIEW.stage.hp;
    const same=(a,b)=>(!a&&!b)||(!!a&&!!b&&a.x===b.x&&a.y===b.y&&a.w===b.w);
    /* 051 2차 ① — 뒤 겹의 걸음은 **깨어 있는 이 프레임**에서 딛는다(전용 rAF 루프를
       두면 전투 중 영영 안 멈춰 soak 의 「완전히 섰다」가 깨진다 — 42a 의 긴 주석). */
    if(typeof hpTick==='function') hpTick();
    if(prev && same(prev.foe,out.foe) && same(prev.hero,out.hero)) return;
    if(prev&&prev.v) out.v=prev.v;
    VIEW.stage.hp=out;
    if(typeof hpPlace==='function') hpPlace();
  }

  function drawArena(g){
    if(!rA || !stLay.length) return;
    g.save();
    g.beginPath(); g.rect(rA.x,rA.y,rA.w,rA.h); g.clip();
    for(const L of stLay){
      const off=((scrollX*L.para)%L.per+L.per)%L.per;   // 4타일 주기로 되감는다
      g.drawImage(L.can, Math.round(rA.x-off), Math.round(rA.y+L.y));
    }
    const L=mobLayout(), ms=L.ms, ground=rA.y+stGround;
    const now=nowMs(), stopping=now<stopUntil, flashing=now<flashUntil;
    // ── 용사: 그림 두 장(대기·공격)과 translate 뿐이다 (018) ──
    // 등급·부위는 여전히 반영하지 않는다 — 반영하면 부위×단계×포즈로 손그림이
    // 폭발한다(ART-DIRECTION). 바뀌는 것은 자세와 **손에 실린 무기 그림**이다.
    const swinging = atkT>=ATK_WIND*0.6 && atkT<ATK_ALL;
    const hero=foeSprite(swinging?'heroAtk':'hero',1,ms,stSeg);
    const hx=rA.x+rA.w*0.05+heroDX(ms);
    let topHero=Infinity, heroW=0;
    if(hero){ const hy=Math.round(ground-(hero.__bot+1)*ms*SPR_FIT);
      g.drawImage(hero, Math.round(hx), hy);
      topHero=hy; heroW=hero.width; }          // 051 ④ — 막대를 이 위에 둔다
    // ── 무기 궤적: 012 장비 스프라이트를 태운다. 잔상 3장, 회전 없음 ──
    // 회전시키면 픽셀이 보간돼 뭉갠다(ART-DIRECTION 안티에일리어싱 금지). 대신
    // 같은 그림을 호를 따라 몇 장 겹쳐 알파로 흘린다.
    const trail = atkT>=ATK_WIND && atkT<ATK_LAND+70;
    if(trail){
      const wg=(S.equip&&S.equip.weapon)?S.equip.weapon.g:0;
      const wv=weaponSprite(wg,ms);
      if(wv){
        const t=Math.min(1,(atkT-ATK_WIND)/(ATK_HIT+70));
        for(let k=0;k<3;k++){
          const u=Math.max(0,t-k*0.16);
          g.globalAlpha=Math.max(0,(1-k*0.3)*(1-t*0.85));
          g.drawImage(wv, Math.round(hx+(11+20*u)*ms),
                          Math.round(ground-(15+5*Math.sin(u*Math.PI))*ms));
        }
        g.globalAlpha=1;
      }
    }
    // ── 몹 — 개체 수·종류·생존은 전부 CORE 가 정한 값을 읽는다(이중 틱 금지) ──
    const n=L.n, alive=(n&&foeMax) ? Math.max(0,Math.min(n,Math.round(foeHP/foeMax*n))) : n;
    const tier=Math.max(1,Math.min(3,1+Math.floor((S.wave-1)/25)));
    const slide=Math.max(0, travTo-scrollX);          // 이동 중엔 오른쪽에서 들어온다
    const mobX=i=>L.x0+L.step*i+slide;
    const cut=deadCut(n,alive);
    let topFoe=Infinity;
    for(let i=0;i<n;i++){
      if(i<cut) continue;                             // 처치된 개체는 사라진다 (001 규약)
                                                      // 021: 앞쪽(용사 쪽)부터 비워진다
      // 혼합 웨이브의 홀짝은 #mob 블록과 **같은 규칙**이다 — 둘이 어긋나면 안 된다.
      const kind = foeKind==='mix' ? (i%2?'ranged':'melee') : foeKind;
      // 번쩍임은 맨 앞(맞는) 개체에만. 같은 그림의 백열 판이라 손그림이 안 는다.
      // ⚠ **맨 앞 = 인덱스 0 이 아니라 «살아 있는 가장 왼쪽»(= `cut`, `stage.nearest`)다.**
      //   021 이 앞쪽부터 비우기 시작하면서 인덱스 0 이 빈칸이 됐고, 그대로 두면
      //   **허공이 번쩍인다** — 021 이 낸 회귀다. 018 의 의도는 처음부터 「맞는 개체는
      //   용사에게 가장 가까운 것」이었으므로 이 줄은 연출의 **변경이 아니라 복구**다.
      //   타이밍·지속시간·진폭(FLASH_MS·HITSTOP_MS·ATK_*)은 한 글자도 안 건드린다.
      const cv=foeSprite(kind,tier,ms,stSeg, flashing && i===cut); if(!cv) continue;
      const my=Math.round(ground-(cv.__bot+1)*ms*SPR_FIT);
      g.drawImage(cv, Math.round(mobX(i)), my);
      if(my<topFoe) topFoe=my;                 // 051 ④ — 무리에서 가장 높은 머리
    }
    // ── 소멸: 위로 튀었다 아래로 꺼진다 (001 foedie 와 같은 규약) ──
    for(const d of dying){
      const cv=foeSprite(d.kind,d.tier,ms,stSeg); if(!cv) continue;
      const u=Math.min(1,d.t/DIE_MS);
      const rise=Math.sin(Math.min(1,u*1.7)*Math.PI)*9*ms, sink=u*u*7*ms, sc=1-0.32*u;
      g.globalAlpha=Math.max(0,1-u*u);
      g.drawImage(cv, Math.round(mobX(d.slot)+cv.width*(1-sc)/2),
                      Math.round(ground-(cv.__bot+1)*ms*SPR_FIT-rise+sink),
                      Math.round(cv.width*sc), Math.round(cv.height*sc));
      g.globalAlpha=1;
    }
    // 051 ④ — 막대의 **자리**만 낸다(그리는 것은 DOM). 다 죽은 프레임은 지면 기준.
    hpGeom(L, ground, isFinite(topFoe)?topFoe:(ground-SPR_UNIT*ms*SPR_FIT),
           topHero, hx, heroW);
    g.restore();
    VIEW.stage.scale=stScale; VIEW.stage.seg=stSeg; VIEW.stage.scrollX=Math.round(scrollX);
    VIEW.stage.moving=!!travUntil; VIEW.stage.mobs=n; VIEW.stage.alive=alive;
    VIEW.stage.kind=foeKind; VIEW.stage.tier=tier; VIEW.stage.hero=!!hero;
    VIEW.stage.ground=Math.round(stGround); VIEW.stage.rect=rA?{...rA}:null;
    // 배치를 그대로 낸다 — 검사가 좌표식을 박아 두면 배치가 바뀌는 순간 조용히
    // 엉뚱한 자리를 재게 된다(018 에서 ST2 가 실제로 그랬다).
    VIEW.stage.mobScale=ms; VIEW.stage.mobStep=Math.round(L.step);
    VIEW.stage.mobX0=Math.round(L.x0); VIEW.stage.gap=Math.round(L.gap);
    // 021 — 어디까지 비었는지. `deadCut` 앞쪽이 죽은 자리다(용사 쪽).
    VIEW.stage.deadCut=cut; VIEW.stage.nearest=cut<n?cut:-1;
    VIEW.motion.attacking=atkT>=0; VIEW.motion.hitstop=stopping;
    VIEW.motion.atkPhase = atkT<0 ? '' : atkT<ATK_WIND ? 'wind' : atkT<ATK_LAND ? 'hit' : 'back';
    VIEW.motion.flashing=flashing; VIEW.motion.dying=dying.length;
    VIEW.motion.pose=swinging?'attack':'idle'; VIEW.motion.trail=!!trail;
    VIEW.motion.reduced=!!VIEW.reducedMotion;
  }

  // 캔버스 크기 추적 (Phaser 의 Scale.RESIZE 자리). 부모가 position:fixed;inset:0
  // 이라 부모 크기 = 화면 크기다. 버퍼를 다시 잡으면 내용이 지워지므로 다시 굽는다.
  function fit(){
    const h=document.getElementById('stage'); if(!h||!L_BG) return;
    const w=Math.max(1,h.clientWidth|0), ht=Math.max(1,h.clientHeight|0);
    if(w===CW && ht===CH) return;
    CW=w; CH=ht;
    sizeCan(L_BG.el,w,ht); if(L_FX) sizeCan(L_FX.el,w,ht);
    VIEW.canvas={w:CW,h:CH};
    if(!bgCan){ bgCan=document.createElement('canvas'); bgCtx=bgCan.getContext('2d'); }
    sizeCan(bgCan,w,ht);
    drawBg();
    rF=rH=rV=null;                 // 패널을 그 크기로 다시 굽게 한다
    canvasWake(600);
  }

  function sync(){
    // 무대는 #hud 안이라 스크롤과 무관하다 — 크기·구간이 달라질 때만 다시 굽는다.
    const nA=rectOf('arena');
    if(nA && (!rA || !same(nA,rA) || segOf(S.wave)!==stSeg)){ rA=nA; bakeStage(); canvasWake(); }
    /* 047: 모루는 이제 **장면 전체**(`#forge`)에 앉는다. 옛 `rH` 는 화로 창이었고
       거기에 맞춰 모루가 작았다(§2③ 「모루를 키운다」). 장면 사각형을 넘긴다. */
    const nF=rectOf('scene'), nH=rectOf('forge'), nV=rectOf('scene');
    // 각 줄의 실제 치수를 검증 창구에 낸다 (캔버스는 Playwright 가 못 읽는다).
    const rHud=rectOf('hud'), rAr=rectOf('arena'), rOp=rectOf('openrow'), rDk=rectOf('dock');
    VIEW.layout.hud=rHud?Math.round(rHud.h):0;
    VIEW.layout.arena=rAr?Math.round(rAr.h):0;
    VIEW.layout.scene=nF?Math.round(nF.h):0;
    VIEW.layout.openrow=rOp?Math.round(rOp.h):0;
    VIEW.layout.dock=rDk?Math.round(rDk.h):0;
    try{ const se=document.scrollingElement||document.documentElement;
      VIEW.layout.scroll=Math.max(0,se.scrollHeight-se.clientHeight);
      VIEW.layout.orientation=(innerWidth>innerHeight)?'landscape':'portrait';
    }catch(e){}
    if(same(nF,rF)&&same(nH,rH)&&same(nV,rV)) return;
    canvasWake();                  // 기하가 움직였다 — 안정될 때까지 더 돈다
    rV=nV;
    const sizeSame = rF&&nF&&Math.abs(nF.w-rF.w)<.5&&Math.abs(nF.h-rF.h)<.5
                  && rH&&nH&&Math.abs(nH.w-rH.w)<.5&&Math.abs(nH.h-rH.h)<.5;
    const dx = sizeSame ? nF.x-rF.x : 0, dy = sizeSame ? nF.y-rF.y : 0;
    rF=nF; rH=nH;
    if(!rF){ VIEW.anvil=null; return; }
    // 스크롤 = 크기 그대로, 위치만 이동. **다시 굽지 않는다** — 그리는 좌표만
    // 달라지므로 Phaser 때의 setPosition·setCrop 두 호출조차 필요 없다.
    if(sizeSame){
      if(VIEW.anvil){ VIEW.anvil={x:VIEW.anvil.x+dx, y:VIEW.anvil.y+dy}; }
      VIEW.perf.moves++;
      return;
    }
    bakePanel();                   // 여기부터가 진짜 재굽기 — 크기가 바뀐 프레임에만
  }

  // 뒤 겹 합성: 배경 한 장 + 패널 한 장. 캔버스는 DOM 처럼 overflow 로 잘리지
  // 않으므로 중앙 창(#focus) 밖은 ctx.clip() 으로 잘라 낸다 (옛 setCrop 자리).
  function drawStage(){
    const g=L_BG&&L_BG.ctx; if(!g) return;
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,CW,CH);
    g.save();
    if(nowMs()<shakeUntil)         // ① 카메라 셰이크 — 뒤 겹 전체가 흔들린다
      g.translate((Math.random()*2-1)*CW*shakeAmp, (Math.random()*2-1)*CH*shakeAmp);
    if(bgCan) g.drawImage(bgCan,0,0);
    stepTravel(); stepMotion(bgDT()); drawArena(g);   // 무대(013) + 모션(018)
    if(pnCan && rF && rF.w>=1 && rF.h>=1){
      g.save();
      if(rV){
        const top=Math.max(0, rV.y-rF.y), bot=Math.min(rF.h,(rV.y+rV.h)-rF.y);
        g.beginPath(); g.rect(rF.x, rF.y+top, rF.w, Math.max(0,bot-top)); g.clip();
      }
      g.drawImage(pnCan, rF.x, rF.y);
      g.restore();
    }
    g.restore();
  }

  /* ── 앞 겹: 불티 · 바운스 (DOM 위) ────────────────────────────────── */
  const P=[];                      // 불티. 상한은 §4 의 FX_MAX_PARTICLES.
  let bounce=null;                 // 획득 장비 하나. 겹치지 않게 항상 하나뿐이다.
  /* 051 ⑤ — 등급 빛기둥. 모루에서 0.8초 솟는다. 하나뿐이고 덮어쓴다(누적 금지).
     reducedMotion 이면 기둥 대신 **테두리 번쩍 한 번**이다(아래 `pillar.red`). */
  let pillar=null;
  const PILLAR_MS=800;
  const ezOut=t=>1-(1-t)*(1-t);    // Quad.easeOut
  const B_UP=FX_BOUNCE_MS*.45;     // 올라가는 시간 (yoyo 라 내려오는 데 같은 시간)

  // lifeK: 수명 배수. 018 의 소멸 불티는 짧게 산다 — 불티가 오래 살수록 앞 겹을
  // 그만큼 오래 깨워 둬야 해서 유휴 가동률이 그대로 따라 오른다(실측 35.6%).
  function emit(n,x,y,lifeK){
    for(let i=0;i<n && P.length<FX_MAX_PARTICLES;i++){
      const ang=(200+Math.random()*140)*Math.PI/180, sp=40+Math.random()*170;
      P.push({x, y, vx:Math.cos(ang)*sp, vy:Math.sin(ang)*sp,
        t:0, life:(280+Math.random()*440)*(lifeK||1),
        c:Math.random()<.5?C_WHITE:C_HOT});   // 백열은 정점 순간에만
    }
  }
  function stepFx(dt){
    const s=dt/1000;
    for(let i=P.length-1;i>=0;i--){ const p=P[i];
      p.t+=dt; if(p.t>=p.life){ P.splice(i,1); continue; }
      p.vy+=520*s; p.x+=p.vx*s; p.y+=p.vy*s;   // gravityY 520
    }
    if(pillar){ pillar.t+=dt; if(pillar.t>=PILLAR_MS) pillar=null; }
    if(bounce){ const b=bounce; b.t+=dt;
      if(b.red){ b.a=Math.max(0,1-b.t/180); b.off=0; if(b.t>=180) bounce=null; }
      else if(b.t<B_UP){        b.off=-b.dy*ezOut(b.t/B_UP); }
      else if(b.t<B_UP*2){      b.off=-b.dy*ezOut(1-(b.t-B_UP)/B_UP); }
      else { b.off=0; b.a=Math.max(0,1-(b.t-B_UP*2)/140); if(b.t>=B_UP*2+140) bounce=null; }
    }
  }
  function drawFx(){
    const g=L_FX&&L_FX.ctx; if(!g) return;
    g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,CW,CH);
    if(bounce){                                   // 바운스가 아래, 불티가 위
      const b=bounce;
      g.globalAlpha=b.a; g.fillStyle=hex(b.col);
      g.beginPath();               // roundRect 가 없는 옛 브라우저는 각진 사각형으로
      if(g.roundRect) g.roundRect(b.x-7, b.y+b.off-7, 14, 14, 3);
      else g.rect(b.x-7, b.y+b.off-7, 14, 14);
      g.fill();
      g.globalAlpha=1;
    }
    /* 051 ⑤ — 빛기둥. 등급색 세로 띠가 모루에서 솟아 흐려진다.
       ⚠ 등급색은 CSS 토큰이 원본이다(`gradeRGB`) — 캔버스 상수에 새 색을 안 만든다. */
    if(pillar && !pillar.red){
      const u=Math.min(1,pillar.t/PILLAR_MS);
      const h=(CH*0.55)*ezOut(Math.min(1,u*1.6));          // 위로 솟는다
      const a=(1-u)*(1-u)*0.85;                            // 끝까지 흐려진다
      const w=Math.max(6,Math.round(22*(1-u*0.45)));
      const c=pillar.col;
      g.globalCompositeOperation='lighter';
      const gr=g.createLinearGradient(0,pillar.y-h,0,pillar.y);
      gr.addColorStop(0,'rgba('+c[0]+','+c[1]+','+c[2]+',0)');
      gr.addColorStop(1,'rgba('+c[0]+','+c[1]+','+c[2]+','+a.toFixed(3)+')');
      g.fillStyle=gr; g.fillRect(pillar.x-w/2, pillar.y-h, w, h);
      g.globalCompositeOperation='source-over';
    }
    g.globalCompositeOperation='lighter';         // blendMode:'ADD'
    for(const p of P){ const k=1-p.t/p.life;      // alpha 1→0 · scale .9→0
      g.globalAlpha=k; g.fillStyle=hex(p.c);
      g.beginPath(); g.arc(p.x, p.y, 3*.9*k, 0, Math.PI*2); g.fill();
    }
    g.globalAlpha=1; g.globalCompositeOperation='source-over';
  }

  /* ══ 절전 (011 §1 · 017 에서 rAF 직접 제어로) ══════════════════════
     방치형은 화면을 몇 시간 켜 두는 물건이다. **바뀌지 않는 화면을 매 프레임
     다시 합성하는 것 자체가 설계 오류**고, 그 값은 배터리와 발열로 돌아온다.
     그래서 기본 상태가 잠든 것이고, 캔버스가 실제로 달라지는 사건에만 깨운다.

     루프가 자면 sync() 가 멈춘다 — 즉 **깨우는 자리를 빠뜨리면 캔버스가 어긋난
     채 멈춘다.** 그래서 깨우는 조건을 추측이 아니라 사건으로 못박는다:
       ① #forge·#hearth·#focus 의 **크기** → ResizeObserver
       ② #focus 의 **스크롤 위치**(패널이 움직이고 크롭이 바뀐다) → scroll
       ③ 창 크기 → resize
     여기에 연출(hitFx)과 사람의 입력을 더한다.
     **두 겹을 따로 재운다** — 뒤 겹에서 움직이는 것은 셰이크(150ms)뿐이고
     불티·바운스는 전부 앞 겹이다. 한 덩어리로 재우면 불티가 다 죽을 때까지
     뒤 겹까지 같이 돈다.
     ⚠ `__game`·`__gameFx` 의 `loop{running,wake,sleep}` 모양은 **계약이다** —
        checklist P1 이 바닥값을 재려고 이 셋을 직접 부른다. Phaser 를 걷어내도
        같은 모양을 유지한다(죽은 검사를 만들지 않는다). */
  const nowMs=()=>(typeof performance!=='undefined'&&performance.now)?performance.now():Date.now();
  /* 019 §2 — **안 보이는 화면의 연출은 값이 0이다.**
     방치형의 진짜 방치는 대개 탭이 뒤에 있는 상태다. 브라우저가 rAF 를 늦추기는
     하지만 **그것에 기대지 않는다** — 늦추는 정도는 브라우저·전원 상태마다 다르고,
     늦춰도 합성은 그대로 일어난다. 숨으면 두 겹을 재우고 깨우는 길을 막는다.
     ⚠ CORE 의 250ms 틱과 저장은 건드리지 않는다. 멈추는 것은 **그리는 일**뿐이다. */
  // 026: 019 의 술어를 **재사용**한다. 광고 중 무대 정지는 「탭이 숨은 것」과
  //      완전히 같은 처리라 새 경로를 만들 이유가 없다 — 두 겹 다 잠든다.
  const hidden=()=>(typeof document!=='undefined' && document.hidden===true)
                   || PLAT.paused===true;
  let wakeBgUntil=0, wakeFxUntil=0, lastFxT=0;
  function mkLoop(step){
    let id=0, running=false;
    const frame=()=>{ if(!running) return; id=requestAnimationFrame(frame); step(); };
    return { get running(){ return running; },
      wake(){ if(running) return; running=true; id=requestAnimationFrame(frame); },
      sleep(){ if(!running) return; running=false;
        if(id) cancelAnimationFrame(id); id=0; } };
  }
  let lastBgT=0;
  const bgDT=()=>{ const t=nowMs(), d=lastBgT?Math.min(64,t-lastBgT):16; lastBgT=t; return d; };
  function bgFrame(){
    // 루프가 돈다 = 살아 있다. 밖에서 loop.wake() 를 부른 경우(P1 이 그렇게 한다)
    // 여기서 깃발을 현실에 맞춘다 — 안 그러면 영영 다시 못 잔다.
    if(VIEW.perf.sleeping) VIEW.perf.sleeping=false;
    if(hidden()){ __game.loop.sleep(); markSlept(); lastBgT=0; return; }
    fit(); sync(); drawStage();
    VIEW.perf.frames++;                       // 013 §0 — 실제로 그린 프레임
    if(bgIdle()){ __game.loop.sleep(); markSlept(); lastBgT=0; }
  }
  function fxFrame(){
    if(VIEW.perf.sleeping) VIEW.perf.sleeping=false;
    if(hidden()){ __gameFx.loop.sleep(); markSlept(); lastFxT=0; return; }
    const t=nowMs(), dt=lastFxT?Math.min(64,t-lastFxT):16; lastFxT=t;
    // hitstop 은 **화면 전체**가 멈추는 것이다 — 불티만 계속 날면 멈춘 느낌이 깨진다.
    stepFx(t<stopUntil?0:dt); drawFx();
    VIEW.perf.framesFx++;                     // 013 §0
    VIEW.alive.particles=P.length;
    VIEW.alive.tweens=(bounce?1:0)+(pillar?1:0);
    if(fxIdle()){ __gameFx.loop.sleep(); markSlept(); lastFxT=0; }
  }
  globalThis.__game  ={loop:mkLoop(bgFrame), engine:'canvas2d'};
  globalThis.__gameFx={loop:mkLoop(fxFrame), engine:'canvas2d'};

  function canvasWake(ms,fxMs){
    // 숨은 동안에는 **깨우는 길 자체가 막힌다.** 창을 쌓아 두지도 않는다 —
    // 돌아오는 순간 어차피 한 번 깨워 다시 그리므로 밀린 창은 값이 없다.
    if(hidden()){ VIEW.perf.hidden=true; VIEW.perf.hiddenSkips++; return; }
    const t=nowMs(), a=ms||SLEEP_IDLE_MS, b=(fxMs===undefined)?a:fxMs;
    wakeBgUntil=Math.max(wakeBgUntil,t+a); wakeFxUntil=Math.max(wakeFxUntil,t+b);
    if(VIEW.perf.sleeping){ VIEW.perf.sleeping=false; VIEW.perf.wakes++; }
    __game.loop.wake(); __gameFx.loop.wake();
  }
  // 도는 것이 있으면 안 재운다 — 자면 그 자리에서 얼어붙는다.
  const bgIdle=()=>nowMs()>=wakeBgUntil && nowMs()>=shakeUntil && !travUntil
    && atkT<0 && !dying.length && nowMs()>=stopUntil;   // 018 모션도 붙잡는다
  const fxIdle=()=>nowMs()>=wakeFxUntil && P.length===0 && !bounce && !pillar;
  // `sleeping` 은 **둘 다 잠들었을 때**만 참이다 (검증이 "화면이 완전히 멈췄다"를
  // 이 한 값으로 읽을 수 있게).
  function markSlept(){
    const both=!__game.loop.running && !__gameFx.loop.running;
    if(both && !VIEW.perf.sleeping){ VIEW.perf.sleeping=true; VIEW.perf.sleeps++; }
  }
  globalThis.__canvasWake=canvasWake;     // 검증용 (지연 없이 깨는지 직접 부를 수 있게)

  /* ── 탭이 숨으면 접는다 / 돌아오면 한 번 깨운다 (019 §2) ──
     숨는 순간 **도는 것을 전부 버린다**: 이동은 끝점으로 스냅하고, 공격·소멸·
     불티·바운스는 버린다. 시간만 얼려 두면 돌아왔을 때 몇 분 전 동작이 이어져
     재생되는 꼴이 된다 — 안 보이는 동안 일어난 일은 연출로서 이미 끝난 것이다.
     ⚠ 이 자리는 CORE 의 `visibilitychange`(저장)와 **별개의 리스너**다. CORE 는
       손대지 않는다. */
  // ⚠ `document` 에 건다. visibilitychange 는 document 에서 나 window 로 **거슬러
  //    올라오는** 사건이라 둘 다 받지만, 나는 자리에 거는 쪽이 한 겹 덜 믿는다.
  document.addEventListener('visibilitychange',()=>{
    // 026: CrazyGames 는 「쉬는 동안」을 알고 싶어 한다. 탭이 숨으면 stop,
    //      돌아오면 start. 광고 쪽 start/stop 은 PLAT.rewarded() 가 따로 부른다.
    PLAT[document.hidden?'playStop':'playStart']();
    VIEW.perf.hidden=hidden();
    if(!hidden()){ canvasWake(600); return; }
    wakeBgUntil=0; wakeFxUntil=0; shakeUntil=0; stopUntil=0; flashUntil=0;
    atkT=-1; atkLanded=false; dying.length=0; P.length=0; bounce=null;
    VIEW.motion.dieOrder.length=0;               // 021 — 안 보이는 동안의 순서는 값이 없다
    if(travUntil){ scrollX=travTo; travUntil=0; }
    VIEW.alive.particles=0; VIEW.alive.tweens=0;
    __game.loop.sleep(); __gameFx.loop.sleep(); markSlept();
  });

  // 던전 보상 불티 (019 §1). **008 의 파티클을 그대로 쓴다** — 새 파티클 시스템을
  // 만들지 않는다. 상한도 008 것 그대로다(1회 분출 상한 · 동시 생존 상한).
  globalThis.__fxBurst=(n,x,y,lifeK)=>{
    if(hidden()){ VIEW.perf.hiddenSkips++; return 0; }
    const m=Math.max(1,Math.min(FX_BURST_CAP, n|0));
    emit(m,x,y,lifeK); VIEW.lastBurst=m; VIEW.counters.burst++;
    canvasWake(SLEEP_IDLE_MS, 900);
    return m;
  };

  /* 047 §2⑤-1 — 매 타의 짧은 셰이크. **기존 셰이크를 그대로 꺼내 쓴다**(새 연출
     금지 · R2 몫): `hitFx` 가 쓰는 `shakeUntil`/`shakeAmp` 와 같은 둘이고,
     세기만 정렬 연출보다 약하게 잡는다. 0 을 주면 아무 일도 안 한다(reducedMotion). */
  /* 047 §2⑤-5 — 미뤄 둔 정렬 연출을 마무리가 꺼내 쓸 수 있게 내보낸다.
     `hitFx` 자체는 이 IIFE 안이라 바깥에서 안 보인다. */
  globalThis.__hitFx=(hits,grade)=>hitFx(hits,grade);
  globalThis.__shake=(k)=>{
    if(hidden()){ VIEW.perf.hiddenSkips++; return 0; }
    const q=Math.max(0,Math.min(10,k|0)); if(!q) return 0;
    shakeUntil=nowMs()+FX_SHAKE_MS;
    shakeAmp=FX_SHAKE_MIN*(q/3);
    VIEW.counters.shake++;
    canvasWake(FX_SHAKE_MS+120, 900);
    return q;
  };

  // 깨우는 자리들. 전부 수동적이라 자는 동안에도 살아 있다.
  if(typeof ResizeObserver!=='undefined'){
    const ro=new ResizeObserver(()=>canvasWake());
    ['forge','hearth','scene'].forEach(id=>{
      const e=document.getElementById(id); if(e) ro.observe(e); });
  }
  ['focus','manage'].forEach(id=>{
    const e=document.getElementById(id);
    if(e) e.addEventListener('scroll',()=>canvasWake(),{passive:true});
  });
  addEventListener('scroll',()=>canvasWake(),{passive:true});
  addEventListener('resize',()=>canvasWake(600));
  // 사람이 만지면 무조건 깬다 (입력 지연 0). 실제로 캔버스가 안 바뀌면
  // SLEEP_IDLE_MS 뒤에 도로 잠든다.
  ['pointerdown','keydown','wheel','touchstart'].forEach(t=>
    addEventListener(t,()=>canvasWake(),{passive:true}));

  /* ── 타격 연출 3종 (§3) ── */
  function hitFx(hits,grade){
    // 019 §2 — 숨은 탭에서는 연출을 아예 시작하지 않는다. 자동 제련은 뒤에서도
    // 계속 돌지만(CORE 틱), 그 정렬의 셰이크·불티·모션은 아무도 보지 않는다.
    if(hidden()){ VIEW.perf.hiddenSkips++; return; }
    // 뒤 겹은 셰이크(150ms)만 돌면 되고, 앞 겹은 바운스(380ms)와 불티(수명 최대
    // 720ms)를 끝내야 한다. 이 뒤에도 살아 있는 것이 있으면 fxIdle() 이 붙잡는다.
    canvasWake(FX_SHAKE_MS+200, 1200);
    const red=VIEW.reducedMotion, an=VIEW.anvil;
    const power=Math.min(1,(hits-2)/3*.6 + Math.min(grade,15)/15*.4);

    // ① 카메라 셰이크 — 뒤 겹(모루·화로·배경)이 흔들린다. reduced 면 걸지 않는다.
    if(!red){
      shakeUntil=nowMs()+FX_SHAKE_MS;
      shakeAmp=FX_SHAKE_MIN+(FX_SHAKE_MAX-FX_SHAKE_MIN)*power;
      VIEW.counters.shake++;
    }
    if(!an) return;

    // ② 불티 — 상한 두 겹: 1회 분출 상한과 동시 생존 상한(emit 안)
    let n = red ? FX_BURST_REDUCED
                : Math.round(FX_BURST_BASE + (hits-2)*FX_BURST_PER_HIT + grade*FX_BURST_PER_G);
    n = Math.max(1, Math.min(FX_BURST_CAP, n));
    emit(n, an.x, an.y);
    VIEW.lastBurst=n; VIEW.counters.burst++;

    // ③ 전투 모션 (018) — 정렬이 곧 한 방이다. 예비-타격-복귀가 여기서 시작하고,
    //    닿는 순간 stepMotion 이 hitstop 과 번쩍임을 건다.
    atkT=0; atkLanded=false; atkGrade=grade;
    VIEW.counters.attack++;

    // ③ 바운스 — 획득 장비가 모루에서 튀어오른다. 하나만 두고 덮어써
    //    누적되지 않게 한다(옛 killTweensOf 자리).
    bounce={x:an.x, y:an.y, off:0, a:1, t:0, red,
      col: grade>=11?C_WHITE : grade>=6?C_BRASS : C_IRON,
      dy: 38+18*power};
    VIEW.counters.bounce++;
  }
  globalThis.__hitFx=hitFx;            // 검증용 (checklist·임시 스크립트가 직접 부른다)

  /* 051 ⑤ — 등급 빛기둥. 등급 ≥10 이나 특별 주문에서 선다(부르는 곳은 45a `feverMade`).
     reducedMotion 이면 기둥을 띄우지 않고 **모루 테두리를 한 번 번쩍**인다(CSS `.pulse`).
     ⚠ 카운터만으로 완료를 주장하지 않는다 — 검사는 캔버스 **픽셀**로 본다(CLAUDE.md 009). */
  globalThis.__pillar=(grade)=>{
    if(hidden()){ VIEW.perf.hiddenSkips++; return 0; }
    const g=Math.max(1,Math.min(GMAX,grade|0));
    const an=VIEW.anvil; if(!an) return 0;
    const red=!!VIEW.reducedMotion;
    pillar={x:an.x, y:an.y+6, t:0, red, col:(typeof gradeRGB==='function')?gradeRGB(g):[255,217,160], g};
    VIEW.counters.pillar=(VIEW.counters.pillar||0)+1;
    if(red){ try{ const e=document.getElementById('forge');
      if(e&&e.classList){ e.classList.remove('pulse'); void e.offsetWidth; e.classList.add('pulse');
        if(typeof setTimeout==='function') setTimeout(()=>{ try{ e.classList.remove('pulse'); }catch(x){} },420); } }catch(x){} }
    canvasWake(PILLAR_MS+120, PILLAR_MS+160);
    return g;
  };

  /* ── 부팅 ── */
  VIEW.scene='forge'; VIEW.sceneFx='fx'; VIEW.background='canvas';
  const fEl=document.getElementById('forge');
  VIEW.overlay={visible:!!fEl&&getComputedStyle(fEl).display!=='none'};
  fit(); sync();
  VIEW.ready=true;
  canvasWake();

  /* ── 웨이브 전환 감지 (013) ──
     newWave() 는 CORE 라 손댈 수 없다. 대신 그것이 매번 다시 쓰는 #foes 라벨을
     본다 — 008 의 `.reel` 클래스 관찰과 같은 종류의 이음매다. 첫 newWave() 는
     이 블록보다 먼저 돌므로 부팅에서는 이동이 걸리지 않는다. */
  const foesEl=document.getElementById('foes');
  if(foesEl && typeof MutationObserver!=='undefined'){
    let lastFoes=foesEl.textContent;
    new MutationObserver(()=>{
      const t=foesEl.textContent;
      if(t===lastFoes) return; lastFoes=t;
      dying.length=0;                              // 옛 배치의 소멸 잔상은 버린다 (018)
      // ⚠ 생존 기준선도 함께 리셋한다. 안 하면 새 웨이브의 개체 수가 옛 값보다
      //   적을 때 **소멸이 헛돌거나 빠진다** (018 검증에서 9→5 인데 2번만 돌았다).
      lastAlive=-1;
      travFrom=scrollX; travTo=scrollX+TRAVEL_PX; travUntil=nowMs()+TRAVEL_MS;
      if(segOf(S.wave)!==stSeg) bakeStage();      // 구간이 바뀌면 팔레트를 갈아 끼운다
      canvasWake(TRAVEL_MS+240);
    }).observe(foesEl,{childList:true,characterData:true,subtree:true});
  }

  // ── 정렬 순간 감지 (CORE 를 건드리지 않는 유일한 이음매) ──
  // spin() 은 CORE 라 손댈 수 없다. 대신 CORE 가 릴에 붙이는 .spin/.hit 클래스를
  // 본다. MutationObserver 콜백은 스핀 콜백이 **끝난 뒤** 한 번만 돌아서
  // (같은 태스크의 변경이 한 콜백으로 묶인다) 그때는 S.queue 까지 갱신돼 있다.
  const reels=document.getElementById('reels');
  if(reels && typeof MutationObserver!=='undefined'){
    let qAtSpin=0;
    /* 047 3차 ① — `attributeOldValue` 를 켠다. 옛 감시는 「지금 `hit` 이 있는가」로
       봤는데, 그러면 **이미 `hit` 인 칸에 다른 클래스가 붙기만 해도** 정렬로 읽는다.
       마무리에서 `fgPaint()` 가 `.echo`(이은 고리)를 붙이는 순간이 정확히 그것이라
       연출이 **두 번** 났다(검증 K5b: attack·bounce 0→2). `hit` 이 **새로 붙은**
       변화에만 반응한다 — 041 부터 있던 「결과가 남은 동안 고정/해제하면 연출이
       한 번 더」도 같은 원인이라 같이 사라진다. */
    new MutationObserver(muts=>{
      let started=false, hit=false;
      for(const m of muts){ const c=m.target.classList; if(!c) continue;
        const had=/(^|\s)hit(\s|$)/.test(m.oldValue||'');
        if(c.contains('spin')) started=true;
        if(c.contains('hit') && !had) hit=true; }
      if(started) qAtSpin=S.queue.length;          // 스핀 시작: 대기열 길이 기억
      if(!hit) return;
      const hits=document.querySelectorAll('.reel.hit').length;
      if(hits<2) return;                           // 정렬 실패는 연출 없음
      /* 047 §2⑤-5 — **정착이 아니라 «드러남» 에 묶는다.** CORE 는 420ms 뒤
         (=첫 타 직후) `.reel.hit` 를 다는데, 그때 터뜨리면 아직 두 번 더 쳐야 할
         결과가 첫 타에서 새어 나간다(검사 K5). 가려져 있으면 **미뤄 두었다가**
         마무리가 꺼낸다. 가림막이 없는 판(가려지지 않은 경로)에서는 예전 그대로. */
      const g = S.queue.length>qAtSpin ? (S.queue[S.queue.length-1].g||0) : 0;
      if(FG.veiled){ fgPending={hits,g}; return; }
      hitFx(hits,g);
    }).observe(reels,{subtree:true,attributes:true,attributeFilter:['class'],attributeOldValue:true});
  }
}

