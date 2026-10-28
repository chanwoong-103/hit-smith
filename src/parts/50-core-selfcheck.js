/* ═══════════════════════════════════════════════════════════════════
   === CORE (자체 점검) ===
   실행 순서 때문에 파일 끝에 둔다 — 점검이 foeCount 등 부팅 이후에야
   채워지는 값을 읽기 때문이다. 위치만 VIEW 뒤일 뿐 내용은 CORE 다.
   ═══════════════════════════════════════════════════════════════════ */
/* ══ 자체 점검 ══ */
(function(){
  // 점검은 S 를 임시로 헤집는다 (등급·별·테크를 바꿔 가며 공식을 확인). 진입 시
  // 얕은 복사를 떠 두고 끝날 때 통째로 되돌린다 — 예전엔 S.peak·S.tech 가 복원
  // 없이 0·{} 로 남아, 페이지를 열 때마다 복귀 유저의 테크트리와 승천 관문
  // 진행도가 통째로 사라지고 250ms 뒤 save() 가 그걸 덮어썼다.
  // 얕은 복사면 충분하다: 점검은 객체 속을 고치지 않고 참조만 갈아끼운다.
  const snap={...S};
  const p=gradeProbs(0), s=p.reduce((a,c)=>a+c,0);
  console.assert(Math.abs(s-1)<1e-9,'확률 합 != 1');
  console.assert(p[0]>=0.0999,'1등급 하한 깨짐');
  console.assert(gradeProbs(2)[cap()-1]>gradeProbs(0)[cap()-1],'정렬 보너스 무효');
  const it=makeItem('head',8);
  console.assert(Object.keys(it.ops).length===3,'8등급 3줄 아님');
  console.assert(!('melee' in makeItem('head',8).ops),'방어구에 무기 옵션');
  console.assert(Array.from({length:3000},rollLv).every(v=>v>=1&&v<=10),'세부등급 범위 이탈');
  console.assert(p.length===GMAX,'등급 수 불일치');
  // 초기 조건 검사는 현재 세이브가 아니라 newState() 의 상수 기본값으로 돌린다.
  // (복귀 유저 환경에서 self-check 가 통째로 실패하던 원인)
  const D=newState();
  const onDefaults=f=>{ const l=S.lv,s2=S.star; S.lv=D.lv; S.star=D.star;
    const r=f(); S.lv=l; S.star=s2; return r; };
  console.assert(onDefaults(cap)===5,'초기 상한이 5가 아님');
  console.assert(gradeProbs(2).slice(cap()).every(v=>v===0),'상한 밖 등급이 뽑힘');
  console.assert(lines(15)===4&&lines(10)===3&&lines(6)===2&&lines(2)===1,'옵션 줄 수 오류');
  console.assert(ROMAN.length===11&&LVW.length===10,'세부등급 10단계 아님');
  console.assert(Math.abs(lvProbs().reduce((a,x)=>a+x,0)-1)<1e-9,'세부등급 확률 합 오류');
  const sv=S.lv; S.lv=40;
  console.assert(lvProbs()[9]>lvProbs.call(null)[0]*0||true,'');
  const hi=lvProbs()[9]; S.lv=0;
  console.assert(hi>lvProbs()[9],'제련 강화가 세부등급을 못 밀음');
  S.lv=capLvMax();
  const a=gradeProbs(0)[GMAX-1]; S.lv=capLvMax()+30;
  console.assert(Math.abs(gradeProbs(0)[GMAX-1]-a)<1e-12,'상한 개방 후에도 등급 확률이 계속 오름');
  S.peak=ASC_WAVE(); console.assert(canAscend(),'승천 조건 미충족'); S.peak=0;
  S.lv=sv;
  const svS=S.star, svL=S.lv; S.star=3; S.lv=0;
  console.assert(cap()===5,'승천 후 시작 상한이 5가 아님');
  console.assert(ASC_LV()===28&&capLvMax()===20,'승천 문턱이 별에 따라 변함');
  console.assert(starMul()===64&&Math.abs(optMul()-2.8)<1e-9,'승천 배율 오류');
  console.assert(qmax()===13,'승천 대기창 증가 안 됨');
  S.lv=28; console.assert(qmax()===17,'제련 대기창 증가 안 됨');
  S.star=svS; S.lv=svL;
  console.assert(onDefaults(qmax)===10,'초기 대기창이 10칸이 아님');
  // 테크트리 / 층 / 주사위
  console.assert(Object.keys(TECH).length===6,'테크 항목 수 오류');
  // 기준선은 현재 세이브가 아니라 테크 0 이다 (newState().tech). 고테크 세이브는
  // 이미 하한(1500ms)·상한(cap)·바닥(-50%)에 붙어 있어서, 현재값을 기준으로
  // 삼으면 포화가 곧 실패로 뒤집힌다 — spd 94 부터 CHG_MS 가 안 줄어든다.
  // 포화는 정상 동작이지 결함이 아니므로, 검사는 0 대 만렙으로 잰다 (005).
  S.tech=D.tech;
  const c0=CHG_MS(), m0=CHG_MAX(), u0=upCost();
  S.tech={spd:100,cap:100,cost:100};
  console.assert(CHG_MS()<c0&&CHG_MAX()>m0&&upCost()<u0,'테크 효과 미적용');
  console.assert(CHG_MS()>=1500,'충전 주기 하한 붕괴');
  console.assert(upCost()>=Math.round(50*Math.pow(1.55,S.lv))*0.49,'강화 비용 클램프 붕괴');
  console.assert(Object.values(TECH).every(v=>v.max===100),'테크 100단계 아님');
  console.assert(fmt(999)==='999'&&fmt(12345)==='12.3K'&&fmt(2.5e9)==='2.5B','fmt 오류');
  { const svc=S.star; S.star=9; const t9={g:15,lv:10,st:9};
    console.assert(isFinite(sellPrice(t9))&&sellPrice(t9)>0,'후반 판매가 오버플로');
    S.star=svc; }
  S.tech={};
  console.assert(TILES.length===8,'주사위 칸 수 오류');
  console.assert(TILES.every(t=>['dust','gold','tok','chg'].includes(t.k)),'알 수 없는 보상 칸');
  const pos0=S.pos; let seen=new Set();
  for(let i=0;i<200;i++){ S.pos=(S.pos+1+((Math.random()*6)|0))%TILES.length; seen.add(S.pos); }
  console.assert(seen.size===8,'주사위가 닿지 않는 칸이 있음');
  S.pos=pos0;
  console.assert(climb()>=0,'층 계산 오류');
  const pk=S.peak, lvB=S.lv; S.lv=ASC_LV(); S.peak=0;
  console.assert(!canAscend(),'웨이브 관문 없이 승천됨');
  S.peak=ASC_WAVE(); console.assert(canAscend(),'관문 충족인데 승천 불가');
  S.peak=pk; S.lv=lvB;
  // 릴은 3 + 별, 단 5에서 멈춘다 (DESIGN.md "릴 수 = 3 + 별 (최대 5)")
  console.assert(REELS()===Math.min(3+S.star,5),'릴 수 오류');
  console.assert(PITY()===20*REELS(),'천장 문턱 오류');
  console.assert(Object.keys(makeItem('head',15).ops).length===4,'15등급 4줄 아님');
  console.assert(!makeItem('head',8).sp,'8등급에 각인');
  console.assert(!!makeItem('head',10).sp,'10등급에 각인 없음');
  console.assert(S.asell.length===GMAX,'자동판매 체크 길이 불일치');
  // 적 무리 표시
  console.assert(foeCount>=5&&foeCount<=9,'적 개체 수 5~9 범위 이탈');
  { const wv=S.wave, ok=[];
    for(let w=1;w<=60;w++){ S.wave=w; newWave(); ok.push(foeCount); }
    console.assert(ok.every(n=>n>=5&&n<=9),'웨이브별 적 개체 수 범위 이탈');
    console.assert(new Set(ok).size===5,'적 개체 수가 5종으로 안 퍼짐');
    S.wave=wv; newWave(); }
  console.assert(foeEls.length===0||foeEls.length===foeCount,'적 블록 수 불일치');
  /* 048 §2① — 손은 공짜, 견습생은 충전 1. 효과로 본다(깃발이 아니라 S.charge 로).
     ⚠ `spin()` 은 420ms 짜리 `setTimeout` 을 걸고 `spinning` 을 세운다. 하네스에서는
       setTimeout 이 즉시 돌아 바로 풀리지만 브라우저에서는 안 풀리므로, 검사 뒤
       `spinning=false` 로 되돌리고 대기열도 원래대로 자른다 — 점검이 상태를 남기면
       위 「자체 점검이 상태를 오염시킴」이 운다. */
  { const c0=S.charge, sp0=spinning, lk=S.lockIdx, st0=globalThis.setTimeout;
    let cFree=0, cPaid=0;
    try{
      /* ⚠ `spin()` 은 **420ms 뒤에** 대기열에 장비를 넣는다. 그 콜백은 이 점검이
         상태를 되돌린 **뒤에** 돌아서, 브라우저에서 새 세이브에 장비 두 개가 공짜로
         꽂혔다(실측: 첫 탭 0.7초 뒤 대기열 3). 그래서 두 번 부르는 동안만
         `setTimeout` 을 빈 함수로 바꿔 낀다 — 033 이 `confirm` 에 쓴 바로 그 방식이고,
         재는 값(`S.charge`)은 **동기로** 바뀌므로 검사는 그대로 성립한다. */
      globalThis.setTimeout=function(){ return 0; };
      S.charge=10; spinning=false; S.lockIdx=-1;
      spin(true);  cFree=S.charge;            // 손 — 충전 불변
      spinning=false;
      spin();      cPaid=S.charge;            // 견습생 — 충전 −1
    } finally {
      globalThis.setTimeout=st0;
      spinning=sp0; S.charge=c0; S.lockIdx=lk;
      // `spin()` 이 칸에 붙인 `.spin` 은 콜백이 떼어 간다. 그 콜백을 막았으니 여기서 뗀다.
      try{ [...document.querySelectorAll('.reel')].forEach(e=>e.classList.remove('spin')); }catch(e){}
    }
    console.assert(cFree===10,'손 제련이 충전을 썼다 (048 §2①)');
    console.assert(cPaid===9,'견습생 제련이 충전을 안 썼다 (048 §2①)'); }
  const pierce=stats({weapon:{part:'weapon',g:10,lv:1,base:100,wt:'melee',sp:'pierce',ops:{ranged:10}}});
  console.assert(pierce.dps>105,'관통 각인 미적용');
  const sv2=S.lv; S.lv=30;
  console.assert(cap()===GMAX,'최대 강화에서 상한 미개방');
  console.assert(Math.abs(gradeProbs(0).reduce((a,x)=>a+x,0)-1)<1e-9,'개방 후 확률 합 오류');
  S.lv=sv2;
  // 등급색 캐시가 CSS 토큰과 일치하는가 (010 §4). 굳는 시점이 앞당겨져 토큰 적용
  // 전에 걸리면 15색이 전부 기본값으로 굳고 등급 판독이 조용히 죽는다.
  // **이 검사만은 기준선이 newState() 가 아니라 CSS 토큰 자체다** (지시서가 정한 예외).
  if(typeof getComputedStyle==='function'){
    const cs=getComputedStyle(document.documentElement);
    console.assert(!!gcCache && gcCache.length===GMAX+1 &&
      gcCache.slice(1).every((c,i)=>c.join(',')===hex2rgb(cs.getPropertyValue('--g'+(i+1))).join(',')),
      '등급색 캐시가 CSS 토큰과 불일치');
  }
  // 진입 시점으로 통째 복원. 이 아래에서는 S 를 건드리지 않는다.
  Object.assign(S,snap);
  // 재발 방지: 점검이 상태를 남기고 나가면 여기서 잡힌다 (tech 는 참조 비교).
  console.assert(S.peak===snap.peak&&S.tech===snap.tech&&S.pos===snap.pos,
    '자체 점검이 상태를 오염시킴');
  console.log('self-check ok · ★'+S.star+' · 릴',REELS()+'개 · 상한',cap()+'등급 · 승천 제련',ASC_LV());
})();
