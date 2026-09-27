// 일 단위 페이싱 시뮬레이션. 목표 곡선은 docs/BALANCE.md 참고.
// 실행: node tools/days.js
//
// 고정 시드다. 같은 forge.html 이면 출력이 바이트 단위로 같아야 한다 —
// 검증 세션은 변경 전후 출력을 diff 해서 회귀를 가린다.
require('./harness')(`

// ── 시드형 PRNG (mulberry32, 인라인 4줄 · 의존성 없음) ──
function mulberry32(a){ return function(){
  a=a+0x6D2B79F5|0;
  let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t;
  return ((t^t>>>14)>>>0)/4294967296; }; }
const SEEDS=[0x5EED0001,0x5EED0002,0x5EED0003];   // 상수로 박은 시드 3개
const seed=i=>{ Math.random=mulberry32(SEEDS[i]); };

function reach(eq){
  const st=stats(eq); let w=1;
  while(w<3000){
    const hp=120*Math.pow(1.12,w-1), d=9*Math.pow(1.115,w-1);
    if(hp/Math.max(st.dps,1e-9) > st.hp/Math.max(d-st.dps*st.leech/100,1e-9)) break;
    w++;
  }
  return w;
}
function towerFloor(eq){
  const st=stats(eq); let f=0;
  while(f<999){
    const hp=200*Math.pow(1.16,f), d=11*Math.pow(1.15,f);
    if(hp/Math.max(st.dps,1e-9) > st.hp/Math.max(d-st.dps*st.leech/100,1e-9)) break;
    f++;
  }
  return f;
}
function doSpins(n, eq, acc){
  for(let i=0;i<n;i++){
    const c={}; let mx=1, part=0; const R=REELS(), res=[];
    for(let r=0;r<R;r++){const v=(Math.random()*6)|0;res.push(v);c[v]=(c[v]||0)+1;if(c[v]>mx){mx=c[v];part=v;}}
    if(mx===1) part=res[0];
    const it=makeItem(PARTS[part].id, rollGrade(mx-1));
    const cur=eq[it.part];
    if(power({...eq,[it.part]:it})>power(eq)){ if(cur) acc.gold+=sellPrice(cur); eq[it.part]=it; }
    else acc.gold+=sellPrice(it);
  }
}
function play(days, activeMin, log, adsPerDay){
  // ⚠ adsPerDay 는 026 이 더한 **선택 인자**다. 안 주면 0 이고, 아래 한 줄이
  //   통째로 건너뛰어 난수 소비도 결과도 예전과 완전히 같다 —
  //   그래서 이 파일의 «기본 출력»은 바이트 단위로 보존된다.
  const ads = adsPerDay|0;
  S.star=0; S.lv=0; S.tech={}; S.dust=0; S.peak=0;
  let eq={}, acc={gold:0}, wave=1, hits={};
  for(let d=1; d<=days; d++){
    // 밤새 충전 (상한에 걸림)
    let spins = Math.min(CHG_MAX(), (24*3600*1000-activeMin*60*1000)/CHG_MS());
    // 접속 중 실시간 충전
    spins += activeMin*60*1000/CHG_MS();
    // 026: 충전 광고 한 번 = 충전을 가득 채우고 30분 1.5배속. 가득 채우기는
    //      최대 CHG_MAX() 스핀이고, 배속은 그 30분 동안 절반만큼을 더 준다.
    //      **최대로 보는 유저**의 상한선이다 — 실제 유저는 이보다 적게 본다.
    if(ads) spins += ads*(CHG_MAX() + 0.5*30*60*1000/CHG_MS());
    doSpins(Math.floor(spins), eq, acc);
    // 웨이브 클리어 골드 (접속 중에만 전투가 돈다고 가정)
    wave=Math.max(wave,reach(eq));
    acc.gold += Math.round(4*Math.pow(1.10,Math.min(wave,400)-1)*(1+T('gold')*0.02)) * (activeMin*60/3);
    // 제련 강화
    while(acc.gold>=upCost() && S.lv<28){ acc.gold-=upCost(); S.lv++; }
    // 티켓 2장 -> 층 -> 주사위 (별가루 기대 배율 ~1.6, 8칸 중 3칸이 별가루)
    const f=towerFloor(eq);
    S.dust += 2 * f * 1.6 * (3/8) + 2*f*0;
    S.dust += 2 * f * 0.8;   // 평균화
    // 테크 강화: 싼 것부터
    let guard=0;
    while(guard++<500){
      const ks=Object.keys(TECH).filter(k=>T(k)<TECH[k].max).sort((a,b)=>techCost(a)-techCost(b));
      if(!ks.length||S.dust<techCost(ks[0])) break;
      S.dust-=techCost(ks[0]); S.tech[ks[0]]=T(ks[0])+1;
    }
    // 도달 기록은 승천 리셋 **앞에서** 한다. 곡선표의 의미는 "웨이브 N에 처음
    // 닿은 날"이고, 리셋 전의 wave 가 그날 실제로 닿은 값이다. 뒤에서 재면
    // 처음 닿은 날이 곧 승천하는 날일 때 그 도달이 통째로 유실돼, 스핀이 더
    // 많은 쪽이 더 늦게 기록되는 역전이 난다 (003 검증에서 실측).
    for(const t of [30,50,75,100,150,200,250,300]) if(!hits[t]&&wave>=t) hits[t]=d;
    // 승천
    S.peak=Math.max(S.peak||0,wave);
    if(cap()===GMAX && S.lv>=ASC_LV() && S.peak>=ASC_WAVE()){ eq={}; S.lv=0; S.star++; wave=1; S.peak=0; }
    if(log&&(d<=7||d%15===0)) console.log('  D'+String(d).padStart(3),
      '웨이브',String(wave).padStart(4),' 제련',String(S.lv).padStart(2),
      ' ★'+S.star,' 별가루',Math.round(S.dust).toLocaleString().padStart(7),
      ' 하루스핀',Math.floor(spins),' 층',towerFloor(eq),' 테크',Object.values(S.tech).reduce((a,c)=>a+c,0)+'/300');
  }
  return hits;
}

console.log('');
console.log('=== 하루 접속 30분 · 90일 (시드 0) ===');
seed(0); play(90,30,true);

console.log('');
console.log('목표 웨이브 도달일 (고정 시드 3개 평균)');
console.log('  접속시간   w30   w50   w75  w100  w150  w200');
for(const m of [10,30,60,120]){
  const agg={};
  // 접속시간마다 같은 시드 3개를 다시 깐다 — 행끼리 난수를 공유해야
  // "접속시간 무관성" 비교가 노이즈가 아니라 실제 차이를 본다.
  for(let r=0;r<3;r++){ seed(r); const hh=play(120,m,false);
    for(const k in hh) agg[k]=(agg[k]||0)+hh[k]/3; }
  console.log('  '+String(m+'분').padStart(6),
    [30,50,75,100,150,200].map(t=>agg[t]?String(Math.round(agg[t])+'일').padStart(6):'   ─').join(''));
}
console.log('');
console.log('충전 상한 진단: 상한', CHG_MAX(), '· 주기', CHG_MS()/1000+'초',
  '→ 완충까지', (CHG_MAX()*CHG_MS()/60000).toFixed(1)+'분');

/* ══════════════════════════════════════════════════════════════════════════
   025 1단계 계측 — **--measure 를 줄 때만 돈다.** (025 판정 ⑤)

   ⚠ **기본 출력에 한 바이트도 섞이면 안 된다.** node tools/days.js 의 출력 md5
     81a6288ee480f80cc9a6c014de4e1826 은 026·027 이 「CORE 를 안 건드렸다」의
     불변식으로 쓰는 값이다. 계측을 기본으로 켜 두면 그 불변식이 사라진다.
   ⚠ 그리고 느리다 — 계측을 켜면 1분 34초 → 8분대가 된다(§0 자기검산이 원본
     play() 를 12회 더 돌리고 §4 가 36회를 더 돌린다). 026 의 --ads 와 같은 규약이다.

   실행: node tools/days.js --measure   (--ads 와 같이 줘도 된다)
   ══════════════════════════════════════════════════════════════════════════ */
if(typeof process!=='undefined' && process.argv.indexOf('--measure')>-1){
  /* ══════════════════════════════════════════════════════════════════════════
     025 1단계 — 계측만. 게임 수식도 원본 play() 도 한 줄 안 건드린다.
     계측용 쌍둥이 playM() 을 따로 둔다.

     playM() 은 하루의 스핀을 조각으로 나눠 흘리지만,
       ⑴ doSpins 의 난수 소비 횟수·순서가 같고
       ⑵ 하루 중에 S.lv·S.tech 를 올리지 않는다 (rollGrade 가 S.lv 를 읽는다)
     므로 원본과 **완전히 같은 결과**여야 한다. §0 이 그것을 기계로 확인한다.

     ⚠ 이 절은 1단계(측정) 전용이라 시간이 든다. 원본 출력(위)은 그대로다.
     ══════════════════════════════════════════════════════════════════════════ */

  const SL = 48;                      // 하루를 48조각(30분) 으로 본다
  const TECHMAX = Object.keys(TECH).length * TECH.spd.max;     // 6 × 100 = 600

  // upCost() 를 「가상의 제련 등급」으로 부를 수 있게 푼 것. 값은 upCost() 와 같다.
  const costAt = lv => Math.round(50*Math.pow(1.55,lv)*Math.max(0.5,1-T('cost')*0.005));
  const lvAfter = (lv0, gold) => { let lv=lv0, g=gold;
    while(lv<ASC_LV() && g>=costAt(lv)){ g-=costAt(lv); lv++; } return lv; };

  function playM(days, activeMin, opt){
    opt = opt||{};
    const delay = opt.delay|0, slices = opt.slices||SL;
    S.star=0; S.lv=0; S.tech={}; S.dust=0; S.peak=0;
    let eq={}, acc={gold:0}, wave=1, hits={};
    const R={ cyc:[], tech50:null, techEnd:0, bestWave:0, mismatch:0, nullGate:0,
              dustAll:0, dustSpent:0 };
    let cycStart=0, cycDust=0, openRun=0, openGate=null, openGateE=null;

    for(let d=1; d<=days; d++){
      let spins = Math.min(CHG_MAX(), (24*3600*1000-activeMin*60*1000)/CHG_MS());
      spins += activeMin*60*1000/CHG_MS();
      const N=Math.floor(spins);
      const lv0=S.lv, g0=acc.gold, waveIn=wave, starIn=S.star, peakIn=S.peak||0;

      // 하루를 조각으로 흘리며 (누적 판매골드, 그 시점 도달 웨이브) 를 적는다.
      const tr=[];
      for(let s=0;s<slices;s++){
        const a=Math.floor(N*s/slices), b=Math.floor(N*(s+1)/slices);
        doSpins(b-a, eq, acc);
        tr.push({ f:(s+1)/slices, gs:acc.gold-g0, w:reach(eq) });
      }

      // ── 여기부터 원본 play() 와 **같은 순서·같은 식** ──────────────────────
      wave=Math.max(wave,reach(eq));
      const wg = Math.round(4*Math.pow(1.10,Math.min(wave,400)-1)*(1+T('gold')*0.02)) * (activeMin*60/3);
      acc.gold += wg;
      while(acc.gold>=upCost() && S.lv<28){ acc.gold-=upCost(); S.lv++; }

      // ── 관문 셋이 「그날 몇 시에」 열렸는가 (추정) ─────────────────────────
      //    ⚠ 테크 갱신 **앞에서** 잰다 — 하루 안의 upCost() 는 아직 어제 테크다.
      //    전투 골드는 두 모형으로 잰다: 균일(A, 기본) / 하루 끝에 몰림(B, 상한).
      const ascW=ASC_WAVE();
      const gsAt = fr => { let g=0; for(const t of tr) if(t.f<=fr+1e-9) g=t.gs; return g; };
      const mk = endGold => {
        const gAt  = fr => g0 + gsAt(fr) + wg*(endGold ? (fr>=1-1e-9?1:0) : fr);
        const lvAt = fr => lvAfter(lv0, gAt(fr));
        const pkAt = fr => { let w=Math.max(peakIn,waveIn);
                             for(const t of tr) if(t.f<=fr+1e-9) w=Math.max(w,t.w); return w; };
        const first = p => { if(p(0)) return 0; for(const t of tr) if(p(t.f)) return t.f; return null; };
        return { cap:first(fr=>Math.min(GMAX,5+Math.floor(lvAt(fr)/2))>=GMAX),
                 lv :first(fr=>lvAt(fr)>=ASC_LV()),
                 pk :first(fr=>pkAt(fr)>=ascW),
                 ok :lvAt(1)===S.lv };
      };
      const A=mk(false), B=mk(true);
      if(!A.ok) R.mismatch++;                            // §0 자기검산
      const gateOf = X => Math.max(X.cap==null?1:X.cap, X.lv==null?1:X.lv, X.pk==null?1:X.pk);

      const f=towerFloor(eq);
      const dustGain = 2*f*1.6*(3/8) + 2*f*0 + 2*f*0.8;
      S.dust += dustGain; cycDust += dustGain; R.dustAll += dustGain;
      let guard=0;
      while(guard++<500){
        const ks=Object.keys(TECH).filter(k=>T(k)<TECH[k].max).sort((a,b)=>techCost(a)-techCost(b));
        if(!ks.length||S.dust<techCost(ks[0])) break;
        S.dust-=techCost(ks[0]); R.dustSpent+=techCost(ks[0]); S.tech[ks[0]]=T(ks[0])+1;
      }
      for(const t of [30,50,75,100,150,200,250,300]) if(!hits[t]&&wave>=t) hits[t]=d;
      S.peak=Math.max(S.peak||0,wave);
      R.bestWave=Math.max(R.bestWave,wave);
      R.techEnd=Object.values(S.tech).reduce((a,c)=>a+c,0);
      if(R.tech50===null && R.techEnd>=TECHMAX/2) R.tech50=d;

      // ── 승천. delay=0 이면 원본과 같은 «탐욕적 승천» ───────────────────────
      const open = (cap()===GMAX && S.lv>=ASC_LV() && S.peak>=ascW);
      if(open){
        if(openGate===null){
          if(A.cap===null||A.lv===null||A.pk===null) R.nullGate++;
          openGate=gateOf(A); openGateE=gateOf(B);
        }
        openRun++;
      } else { openRun=0; openGate=null; openGateE=null; }

      if(open && openRun>delay){
        R.cyc.push({ star:starIn, day:d, len:d-cycStart,
                     tailH : 24*(openRun-1) + 24*(1-openGate),
                     tailHE: 24*(openRun-1) + 24*(1-openGateE),
                     openAtH: 24*openGate, dust:cycDust, peak:S.peak, gate:ascW,
                     gCap:A.cap, gLv:A.lv, gPk:A.pk });
        eq={}; S.lv=0; S.star++; wave=1; S.peak=0;
        cycStart=d; cycDust=0; openRun=0; openGate=null; openGateE=null;
      }
    }
    R.hits=hits; R.star=S.star;
    return R;
  }

  const pad=(s,n)=>String(s).padStart(n);
  const f1=x=>x.toFixed(1);
  const MINS=[10,30,60,120];
  const BANDS=[['★0~5',0,5],['★6~10',6,10],['★11~20',11,20],['★21+',21,999]];

  console.log('');
  console.log('══════════ 025 1단계 계측 (측정만 · src/forge.html 무수정) ══════════');

  /* ── 한 번만 돌리고 전부 재활용한다 (12회 × 120일) ───────────────────────── */
  const MEAS={};
  for(const m of MINS){ MEAS[m]=[]; for(let r=0;r<3;r++){ seed(r); MEAS[m].push(playM(120,m,{})); } }

  /* ── §0 자기검산 ─────────────────────────────────────────────────────────── */
  console.log('');
  console.log('§0 자기검산 — 계측 쌍둥이 playM(탐욕) 이 원본 play() 와 같은 플레이인가');
  {
    let same=0; const bad=[]; let mis=0, nul=0;
    for(const m of MINS) for(let r=0;r<3;r++){
      seed(r); const a=JSON.stringify(play(120,m,false));
      const b=JSON.stringify(MEAS[m][r].hits);
      mis+=MEAS[m][r].mismatch; nul+=MEAS[m][r].nullGate;
      if(a===b) same++; else bad.push(m+'분/시드'+r+': '+a+' vs '+b);
    }
    console.log('  도달일 표 일치 '+same+'/12 · 제련 등급 재구성 불일치 '+mis+'일 · 관문 시각 미검출 '+nul+'회');
    bad.slice(0,3).forEach(r=>console.log('    ⚠ '+r));
    console.log('  → 12/12·0·0 이면 아래 수치는 «원본과 같은 플레이» 위에서 잰 것이다.');
  }

  /* ── §1 죽은 꼬리 ────────────────────────────────────────────────────────── */
  console.log('');
  console.log('§1 죽은 꼬리 — 승천 관문이 다 열린 뒤 실제 승천까지 (추정)');
  console.log('  가정 ① 그날 스핀이 24시간에 균일하게 흐른다');
  console.log('  가정 ② 전투 골드도 균일하게 들어온다  (뒤집은 상한은 맨 아래 민감도)');
  console.log('  가정 ③ 승천 시점 = 그날 끝 (days.js 의 판정 시점. 「다음 접속」의 대용)');
  console.log('  해상도 30분(하루 48조각) · 관문 셋 중 «가장 늦게» 열린 것이 기준');
  console.log('');
  console.log('  접속   구간     주기     꼬리      꼬리/주기   관문 열린 시각   주기수');
  for(const m of MINS){
    const bag={}; BANDS.forEach(b=>bag[b[0]]={t:0,c:0,len:0,open:0});
    for(let r=0;r<3;r++) for(const c of MEAS[m][r].cyc){
      const k=BANDS.find(x=>c.star>=x[1]&&c.star<=x[2])[0];
      bag[k].t+=c.tailH; bag[k].len+=c.len*24; bag[k].open+=c.openAtH; bag[k].c++; }
    for(const [nm] of BANDS){ const b=bag[nm]; if(!b.c) continue;
      console.log('  '+pad(m+'분',5)+' '+pad(nm,7)+' '+pad(f1(b.len/b.c/24)+'일',6)
        +' '+pad(f1(b.t/b.c)+'시간',9)+'  '+pad(f1(b.t/b.len*100)+'%',8)
        +'  '+pad(f1(b.open/b.c)+'시',8)+'  '+pad(b.c,6)); }
  }
  console.log('');
  console.log('  접속시간별 전체 평균 (120일 · 시드 3개)');
  for(const m of MINS){
    let t=0,c=0,len=0,te=0;
    for(let r=0;r<3;r++) for(const y of MEAS[m][r].cyc){ t+=y.tailH; te+=y.tailHE; len+=y.len*24; c++; }
    console.log('    '+pad(m+'분',5)+'  주기 '+pad(f1(len/c/24)+'일',6)
      +' · 꼬리 '+pad(f1(t/c)+'시간',9)+' · 비율 '+pad(f1(t/len*100)+'%',7)
      +'   [민감도 B(골드 몰림): '+pad(f1(te/c)+'시간',9)+' · '+pad(f1(te/len*100)+'%',7)+']');
  }
  console.log('');
  console.log('  민감도 — 가정 ③ 을 푼다. 「하루에 몇 번 게임을 여는가」별 꼬리');
  console.log('    관문이 열린 시각은 실측값이고, 승천은 그 뒤 첫 접속에서 일어난다고 본다.');
  console.log('    접속   24h마다(가정③)   12h마다     6h마다     3h마다     1h마다');
  for(const m of MINS){
    const line=[24,12,6,3,1].map(I=>{
      let s=0,c=0;
      for(let r=0;r<3;r++) for(const y of MEAS[m][r].cyc){
        const t=y.openAtH; s+= I*Math.ceil(t/I - 1e-9) - t; c++; }
      return pad(f1(s/c)+'시간',11);
    }).join('');
    console.log('    '+pad(m+'분',5)+'   '+line);
  }

  /* ── §2 승천 주기 실측 ───────────────────────────────────────────────────── */
  console.log('');
  console.log('§2 승천 주기 실측 — BALANCE.md 「첫 승천 5일, 이후 2~3일」 대조');
  console.log('  ★      30분    10분    60분   120분    마지막으로 열린 관문(30분)');
  {
    const by={}; for(const m of MINS){ by[m]={};
      for(let r=0;r<3;r++) for(const c of MEAS[m][r].cyc) (by[m][c.star]=by[m][c.star]||[]).push(c); }
    const lastOf=c=>{ const v=[['상한',c.gCap],['제련',c.gLv],['웨이브',c.gPk]]
        .map(([n,x])=>[n,x==null?1:x]), mx=Math.max(...v.map(x=>x[1]));
      return v.filter(x=>x[1]===mx).map(x=>x[0]).join('+'); };
    const av=a=>a&&a.length?f1(a.reduce((p,q)=>p+q.len,0)/a.length):'─';
    for(const s of Object.keys(by[30]).map(Number).sort((a,b)=>a-b)){
      if(s>10 && s%5) continue;                        // ★11+ 은 5칸마다
      const t={}; (by[30][s]||[]).forEach(c=>{const k=lastOf(c); t[k]=(t[k]||0)+1;});
      console.log('  '+pad('★'+s,4)+pad(av(by[30][s]),8)+pad(av(by[10][s]),8)
        +pad(av(by[60][s]),8)+pad(av(by[120][s]),8)+'    '
        +Object.entries(t).sort((p,q)=>q[1]-p[1]).map(([k,v])=>k+'×'+v).join(' '));
    }
    const all=[]; for(let r=0;r<3;r++) all.push(...MEAS[30][r].cyc);
    console.log('  첫 승천 '+f1(all.filter(c=>c.star===0).reduce((p,q)=>p+q.len,0)/3)+'일'
      +' · ★1 이후 평균 '+f1(all.filter(c=>c.star>0).reduce((p,q)=>p+q.len,0)/all.filter(c=>c.star>0).length)+'일'
      +' · 120일차 ★'+f1(MEAS[30].reduce((p,q)=>p+q.star,0)/3));
  }

  /* ── §3 별가루 수입 구조 ─────────────────────────────────────────────────── */
  console.log('');
  console.log('§3 별가루 수입 구조 — 무한의 층(티켓 2장/일)이 유일한 수입원');
  console.log('  접속   구간     주기당 층 별가루   하루 평균   주기 길이   승천 시 S.peak   관문(100+★×12)');
  for(const m of MINS){
    const bag={}; BANDS.forEach(b=>bag[b[0]]={d:0,c:0,len:0,pk:0,gt:0});
    for(let r=0;r<3;r++) for(const c of MEAS[m][r].cyc){
      const k=BANDS.find(x=>c.star>=x[1]&&c.star<=x[2])[0];
      bag[k].d+=c.dust; bag[k].len+=c.len; bag[k].pk+=c.peak; bag[k].gt+=c.gate; bag[k].c++; }
    for(const [nm] of BANDS){ const b=bag[nm]; if(!b.c) continue;
      console.log('  '+pad(m+'분',5)+' '+pad(nm,7)+' '+pad(Math.round(b.d/b.c).toLocaleString(),14)
        +'  '+pad(Math.round(b.d/b.len).toLocaleString(),10)+'  '+pad(f1(b.len/b.c)+'일',8)
        +'  '+pad(Math.round(b.pk/b.c),14)+'  '+pad(Math.round(b.gt/b.c),14)); }
  }
  console.log('');
  console.log('  테크 진도 (총 '+TECHMAX+'단계 = 6갈래×100)');
  console.log('    접속   절반(300단계)   120일차 단계   120일 누적 획득   누적 소비');
  for(const m of MINS){
    const h=MEAS[m].map(R=>R.tech50), e=MEAS[m].map(R=>R.techEnd),
          g=MEAS[m].map(R=>R.dustAll), s=MEAS[m].map(R=>R.dustSpent);
    const av=a=>a.every(x=>x!=null)?Math.round(a.reduce((p,q)=>p+q,0)/a.length):null;
    console.log('    '+pad(m+'분',5)+pad(av(h)==null?'120일내 미도달':av(h)+'일',16)
      +pad(av(e)+'단계',14)+pad(av(g).toLocaleString(),18)+pad(av(s).toLocaleString(),12));
  }
  { let tot=0; for(const k of Object.keys(TECH)) for(let l=0;l<TECH[k].max;l++) tot+=Math.round(8*Math.pow(1.09,l));
    let half=0, n=0;
    for(const k of Object.keys(TECH)) for(let l=0;l<TECH[k].max/2;l++){ half+=Math.round(8*Math.pow(1.09,l)); n++; }
    console.log('    테크 총비용 '+tot.toLocaleString()+' 별가루 · 전 항목 절반(각 50단계, '+n+'단계) '+half.toLocaleString()); }

  /* ── §4 탐욕적 승천이 최적인가 ───────────────────────────────────────────── */
  console.log('');
  console.log('§4 승천을 미루면 이득인가 — 90일차 비교 (보상 없음 · 시드 3개 평균)');
  console.log('  미루는 정책: 관문이 열린 뒤 n일을 더 보내고 승천한다');
  console.log('  접속   미룸   최고웨이브   90일차 ★   테크단계   승천횟수');
  for(const m of [10,30,120]){
    for(const dl of [0,1,2,3]){
      let bw=0,st=0,tc=0,nc=0;
      for(let r=0;r<3;r++){ seed(r); const R=playM(90,m,{delay:dl,slices:1});
        bw+=R.bestWave; st+=R.star; tc+=R.techEnd; nc+=R.cyc.length; }
      console.log('  '+pad(m+'분',5)+pad(dl+'일',6)+pad(Math.round(bw/3),12)
        +pad(f1(st/3),11)+pad(Math.round(tc/3),11)+pad(f1(nc/3),10));
    }
  }
  console.log('');
  console.log('══════════ 025 1단계 계측 끝 ══════════');
}

/* ══════════════════════════════════════════════════════════════════════════
   026 — 충전 광고 상한을 숫자로 정하는 절. **--ads 를 줄 때만 돈다.**
   기본 출력에 한 바이트도 섞이면 안 된다(026 §4) — 그래서 통째로 이 안에 있다.

   모형: 「최대로 보는 유저」의 상한선이다. 하루에 AD_DAY 번을 전부 보고, 매번
   충전이 바닥일 때 봐서 CHG_MAX() 를 통째로 받는다고 본다. 쿨다운(AD_COOL)은
   한 자리에서 연달아 보는 것만 막으므로 **하루 총량에는 AD_DAY 만 걸린다.**
   실제 유저는 이보다 적게 본다 — 즉 아래 단축률은 **상한**이다.
   ══════════════════════════════════════════════════════════════════════════ */
if(typeof process!=='undefined' && process.argv.indexOf('--ads')>-1){
  const W=[30,50,75,100,150,200];
  const run=(m,ads)=>{ const agg={};
    for(let r=0;r<3;r++){ seed(r); const hh=play(120,m,false,ads);
      for(const k in hh) agg[k]=(agg[k]||0)+hh[k]/3; }
    return agg; };
  console.log('');
  console.log('══════════ 026 --ads — 충전 광고가 페이싱을 얼마나 당기는가 ══════════');
  // ⚠ CHG_MAX() 는 S.tech 를 읽는다. 이 절은 025 계측 **뒤에** 도는데 그때 S 에는
  //   만렙 테크가 남아 있어, 그냥 찍으면 «상한 2130» 같은 엉뚱한 수가 나온다
  //   (play() 는 매 호출에서 S.tech 를 비우므로 표 자체는 멀쩡하다 — 머리말만 거짓말한다).
  const cleanMax=(()=>{ const t=S.tech; S.tech={}; const v=CHG_MAX(); S.tech=t; return v; })();
  console.log('  게임의 상수: AD_DAY='+AD_DAY+'회/일 · AD_COOL='+(AD_COOL/60000)+'분'
    +' · 충전 상한 '+cleanMax+'(테크 0) ~ '+CHG_MAX()+'(테크 만렙)');
  console.log('  문턱(026 §4): **w200 도달일이 무광고 대비 10~25% 단축**');
  console.log('');
  for(const m of [10,30,60,120]){
    console.log('  ── 하루 접속 '+m+'분 ──');
    console.log('     광고/일   w30   w50   w75  w100  w150  w200   w200 단축');
    const base=run(m,0);
    for(const n of [0,1,2,3,4]){
      const a=n===0?base:run(m,n);
      const cut=(base[200]&&a[200])?(1-a[200]/base[200])*100:null;
      console.log('     '+String(n+'회').padStart(6)
        +W.map(t=>a[t]?String(Math.round(a[t])+'일').padStart(6):'   ─').join('')
        +'   '+(cut===null?'    ─':(cut.toFixed(1)+'%').padStart(9))
        +(n===AD_DAY?'   ← 지금 상수':''));
    }
    console.log('');
  }
  console.log('  ⚠ 무광고 행(0회)은 **Pages 빌드 그대로**다 — 위 기본 출력의 밴드와');
  console.log('    같은 수가 나와야 한다. 다르면 play() 의 선택 인자가 샌 것이다.');
  console.log('');
  console.log('  ── 026 §0 대조: «상한도 광고도 없던 옛 버튼» 모사 (60일 · 30분) ──');
  console.log('     고치기 전의 #ad 는 아무 때나 눌려 충전을 가득 채웠다. 그 극단을 같이 잰다.');
  console.log('     광고/일    하루스핀    w100  w150  w200  w250  w300');
  for(const n of [0,3,20,60]){
    const agg={}; let sp=0;
    for(let r=0;r<3;r++){ seed(r); const hh=play(60,30,false,n);
      for(const k in hh) agg[k]=(agg[k]||0)+hh[k]/3; }
    // 하루 스핀은 식으로 그대로 낸다 (테크 0 기준 — 첫날의 값)
    sp=Math.round(Math.min(cleanMax,(24*3600*1000-30*60*1000)/6000)+30*60*1000/6000
        + n*(cleanMax+0.5*30*60*1000/6000));
    console.log('     '+String(n+'회').padStart(6)+String(sp.toLocaleString()).padStart(12)
      +[100,150,200,250,300].map(t=>agg[t]?String(Math.round(agg[t])+'일').padStart(6):'   ─').join(''));
  }
  console.log('     → 하루 스핀을 수십 배로 늘려도 도달일이 거의 안 움직인다.');
  console.log('       **스핀은 이 게임의 병목이 아니다** — 승천 주기와 테크가 병목이다.');
  console.log('══════════ 026 --ads 끝 ══════════');
}

`);
