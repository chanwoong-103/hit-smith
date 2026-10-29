/* ══ 033 — 자동 정리 ══════════════════════════════════════════════════════
   방치하면 **5.3초**에 대기열 10칸이 차서 자동 제련이 선다(032 검증 실측). `days.js`
   의 `doSpins()` 는 처음부터 「뽑을 때마다 `power()` 로 비교해 장착하거나 판다」를
   전제로 곡선을 쟀다 — 게임만 5초마다 사람 손을 요구하고 있었다. 그 한 칸을 대신
   눌러 주는 것이 전부다.

   ⚠ **판정도 보상도 새로 만들지 않는다.** 비교는 `power()` 하나(`days.js`·`#cmp` 와
     같은 함수), 장착·판매는 수동 버튼이 부르는 `resolve()` 그대로다. 그래서 골드·
     토큰·천장·자동 판매 규칙이 수동과 한 푼도 다를 수 없다 — **다른 길이 없다.**
   ⚠ `resolve()` 는 CORE 이고 끝에서 `openCmp()` 를 부른다. 사람이 누른 흐름에서는
     그게 맞다(고른 뒤 다음 것을 이어서 본다). 자동에는 아니다 — 팝업이 혼자 열리고,
     그러면 아래 「팝업 존중」 때문에 자동 정리가 그 자리에서 영영 멈춘다. CORE 를
     고치지 않고 **부르기 전 상태로 되돌린다**(열려 있지 않았으면 닫는다).
   ⚠ 등급이 2 이상 떨어지는 교체는 `resolve('equip')` 안에서 `confirm()` 을 띄운다.
     방치 중에 대화상자가 뜨면 게임이 통째로 멈춘다(브라우저가 스크립트를 세운다).
     `nw.wn` 을 몰래 세워 경고를 죽이지 않는다 — 그건 **사람이 손으로 누를 때** 뜰
     경고를 영구히 없애는 짓이다. 025 의 승천 호출이 쓰는 방식을 **그대로** 쓴다:
     부르는 동안만 `globalThis.confirm` 을 바꿔 끼고 `finally` 로 되돌린다. 판정은
     여전히 `power()` 하나다 — 「오르면 장착」에 예외를 두지 않는다.
   ⚠ 한 틱에 **대기열 한 칸만**. 연출·판정문이 한꺼번에 쏟아지지 않게.
   ⚠⚠ 장착은 칸을 **안 비운다** — `resolve('equip')` 은 밀려난 이전 장비를 대기열 맨
     앞에 도로 넣는다(원칙 8: 판매만이 대기열을 줄인다). 그래서 지시서가 적은 대로
     **밀려난 이전 장비는 그 자리에서 판다.** 둘은 한 칸에 대한 한 번의 정리다 —
     들어온 것 하나가 자리를 잡고, 나간 것 하나가 칸을 비운다. 쪼개서 다음 틱으로
     미루면 그 틱의 스핀이 「가득」으로 막힌다(실측: 100틱에 5회). */
function autoResolve(){
  if(!autoResOn()) return;                                // 041 ①
  if(S.queue.length<qmax()) return;                       // 막히는 순간에만 손댄다
  const cmp=document.getElementById('cmp');
  if(cmp && cmp.classList.contains('on')) return;         // 사람이 고르는 중이다
  const nw=S.queue[0]; if(!nw) return;
  const old=S.equip[nw.part]||null;
  const up=power({...S.equip,[nw.part]:nw})>power(S.equip);
  const act=up?'equip':'sell';
  const tag=it=>t('msg.item',t('part.'+it.part),t('ui.grade',it.g),ROMAN[it.lv||1]);
  const nwTag=tag(nw), oldTag=old?tag(old):'', gold0=S.gold;
  // 025 의 승천 호출과 **같은 방식**: 부르는 동안만 confirm 을 바꿔 끼고 finally 로 되돌린다.
  const c0=globalThis.confirm;
  let sold=false;
  try{
    globalThis.confirm=()=>true;
    resolve(act);                                         // ← 수동 버튼과 같은 함수
    if(act==='equip' && old && S.queue[0]===old){ resolve('sell'); sold=true; }
  } finally { globalThis.confirm=c0; }
  if(cmp) cmp.classList.remove('on');                     // resolve() 끝의 openCmp() 되돌리기
  const m=document.getElementById('msg');
  m.innerHTML = act==='equip'
    ? t('msg.sorted.equip',nwTag)+(sold?t('msg.sorted.sold',oldTag)+ciGold()+fmt(S.gold-gold0):'')
    : t('msg.sorted.sell',nwTag)+ciGold()+fmt(S.gold-gold0);
  m.className='';
}

/* 034: 정적 HTML 의 글자를 한 번에 갈아 끼운다. `data-s` 한 바퀴가 전부다 —
   글자마다 id 를 붙이거나 innerHTML 을 다시 짜지 않는다. HTML 안의 한국어는
   **원문 그대로 남겨 둔다**: 표에서 키가 빠지면 그 자리가 키 이름으로 바뀌어
   검사가 잡고, 스크립트가 죽어도 한국어 화면은 그대로 보인다.
   ⚠ 테크 버튼이 이미 `data-t`(테크 키)를 쓰고 있다 — 그래서 이 속성은 `data-s` 다. */
function i18nDom(){
  try{
    document.documentElement.lang=LANG;
    for(const e of document.querySelectorAll('[data-s]')) e.textContent=t(e.dataset.s);
    /* 041 ③ 2차 — `data-stitle` 은 **글자가 아니라 title**(마우스 올림)을 든다.
       짧게 줄인 안내 글자가 잃은 말을 폭 0 으로 되돌리는 자리다. `data-s` 와 같은
       한 바퀴 규약이라 다음에 쓸 자리가 생겨도 속성 하나로 끝난다. */
    for(const e of document.querySelectorAll('[data-stitle]')) e.title=t(e.dataset.stitle);
    document.title=t('doc.title');
  }catch(e){}
}
i18nDom();

// 오프라인 = 타임스탬프 델타 한 줄. 시뮬레이션 없음.
S.charge=Math.min(CHG_MAX(),S.charge+(Date.now()-S.t)/CHG_MS());
newWave(); render();
// 047 §2⑤ — 가림막의 첫 상태를 그린다. 정착 감지는 **주기가 열릴 때** 켜진다.
fgPaint();
try{ document.body.setAttribute('data-tab','forge'); }catch(e){}
setInterval(()=>{
  // 026: 광고가 도는 동안은 **게임이 진행되지 않는다** (CrazyGames 요건).
  // 충전도 자동 제련도 전투도 멈춘다 — 광고 길이만큼 시간이 얼어붙을 뿐이다.
  /* 049 2차 ① — **`return` 앞**이다. 이 줄이 뒤에 있으면 광고 중엔 영영 안 닿는다. */
  try{ sndGate(); }catch(e){}
  if(PLAT.paused) return;
  S.charge=Math.min(CHG_MAX(),S.charge+250/CHG_MS()*(boosted()?1.5:1));
  // 033: `autoResolve()` 는 `S.auto` 와 **무관**하게 돈다 — 손으로 제련하면서 정리만
  // 맡기는 판도 있다(사용자 판정). 스핀 **앞**에 둔다: 뒤에 두면 이번 틱의 스핀이
  // 「가득」으로 막힌 뒤에야 칸이 비어, 방치 30초에 막힌 스핀이 40회나 쌓였다(실측).
  // 앞에 두면 칸을 먼저 비우고 굴리므로 **막힌 스핀이 0** 이 된다.
  /* 047 §2⑤-6 — **가려진 동안에는 정리하지 않는다.** 아직 안 나온 장비를
     정리하면 안 된다(검사 K6). 가림막이 걷히는 순간 다음 틱이 바로 정리한다. */
  /* 047 3차 ② — **정착은 틱이 책임진다.** rAF 가 멈춘 판에서도 주기가 끝난다.
     견습생 박보다 먼저 둔다 — 이번 틱에 드러난 것을 이번 틱에 이어 칠 수 있게. */
  fgSettle();
  /* 048 §2③ — 릴의 안전망. rAF 가 멈춘 판·숨은 탭에서도 릴이 결과를 보이고,
     손도 견습생도 10초 안 닿으면 `rest` 로 내려 **프레임을 안 먹는다**(원칙 1). */
  reelPump();
  // 049 §2③④ — 소리는 **관찰자**다. 틱이 변화를 훑고, 광고·숨김이면 문맥을 재운다.
  sfxWatch(); sndGate();
  // 051 ③⑤ — 피버도 **관찰자**다. CORE 는 소리·연출을 한 줄도 부르지 않는다.
  feverWatch();
  if(autoResOn() && !FG.veiled) autoResolve();
  /* 047 §2⑤-9 — 자동은 `spin()` 을 부르지 않는다. **견습생이 박자로 친다**:
     500ms 마다 한 박(120 BPM — R2 에서 배경음악 박자와 맞춘다). 사람이 같이
     치면 그만큼 빨라진다. `S.auto` 의 저장·버튼·뜻은 그대로다.
     047 2차 — 한 박이 몇 타인지는 **서두름**이 정한다(위 `fgBeat`). */
  /* 048 §2② — `S.auto` 를 읽던 자리가 `apprOn()` 이 된다(저장값은 그대로). */
  if(apprOn()){ fgRushCheck();
    const nw=Date.now();
    if(!fgBeatAt) fgBeatAt=nw;
    if(nw-fgBeatAt>=APPRENTICE_MS-BEAT_SLACK){
      fgBeatAt += APPRENTICE_MS*Math.max(1,Math.floor((nw-fgBeatAt+BEAT_SLACK)/APPRENTICE_MS));
      fgBeat(); } }
  else if(FG.rush) FG.rush=false;         // 견습생을 끄면 서두름도 끝난다
  tick(); renderFast(); save(); },250);


