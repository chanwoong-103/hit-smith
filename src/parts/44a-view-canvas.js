/* ══ 2D 캔버스 렌더 (007 뼈대 · 008 타격 연출 · 017 에서 Phaser 제거) ══ */
// **캔버스가 두 겹인 이유** (008 에서 실측으로 드러난 구조적 제약):
// 007 은 캔버스를 z-index:-1 로 본문 뒤에 깔았다. 배경(§1)은 그래야 패널 대비가
// 안 깨진다. 그런데 불티·바운스(§3)를 같은 캔버스에 그리면 **불투명한 DOM 패널
// 뒤로 가려져 한 픽셀도 안 보인다** (008 첫 구현에서 스크린샷으로 확인했다).
// 캔버스 한 장으로는 "배경은 뒤 · 불티는 앞"을 동시에 만족할 수 없다. 그래서:
//   #stage (z-index:-1) : 페이지 배경 · 가운데 패널 바탕 · 화로 창 · 모루 · 셰이크
//   #fx    (z-index: 2) : 불티 · 바운스  (pointer-events:none 이라 클릭은 통과)
// **010 판정: 합치지 않는다.** 세로 3단으로 중앙 영역이 열렸지만, 그 안에 있는
// 릴·온도계·압력계가 전부 DOM 이라 겹침 순서는 그대로다 — 불티는 그 DOM 위에,
// 배경은 그 아래에 있어야 한다. 한 겹으로 만들려면 릴까지 캔버스로 옮겨야 하고,
// 그러면 checklist 의 선택자 검사가 통째로 죽는다(CLAUDE.md: 죽은 항목은 지우지 말
// 것). 008 실측대로 프레임 비용의 주인은 층 수가 아니라 재그리기였고 009가 그걸
// 걷어냈으므로, 합치는 이득도 없다. 두 겹을 유지한다.
//
// 기존 250ms 틱이 여전히 진실의 원천이다. 렌더 층은 그리기만 하고 게임 상태를
// 건드리지 않는다 (이중 틱 금지).
//
// **017: Phaser 를 걷어냈다.** 실제로 쓰던 API 는 Game·AUTO·Scale.RESIZE 넷뿐이라
// (013b 실측) vendor 1.14MB 가 아래 rAF 루프 두 개로 대체된다. 화면은 007 때와
// 같은 원칙으로 **한 픽셀도 달라지지 않게** 옮겼다 — 예외는 방사 그라디언트
// 하나뿐이고, 그것도 옛 타원 스택의 누적 알파 곡선을 그대로 옮겼다.
//
// __view : 캔버스 층의 유일한 검증 창구. **여기 노출되지 않는 연출은 완료로
// 인정하지 않는다** (CLAUDE.md 검증 세션 절).

// ── 색 (docs/ART-DIRECTION.md 6색에서만 고른다) ──────────────────
// 무쇠와 숯은 둘 다 어둡지만 **색기가 반대**다 (무쇠=푸른 기, 숯=갈색 기).
// 한 겹으로 뭉개면 평범한 다크 UI가 된다 — 배경을 캔버스로 옮기면서 이 두 겹을
// 세로로 갈라 둔다: 위는 금속(무쇠), 아래로 갈수록 숯불 바닥(숯).
// 밝기 단계는 새 색을 만들지 않고 **알파로만** 낸다.
const C_IRON  = 0x23262B;   // 무쇠 — 식은 강철, 푸른 기가 도는 회색
const C_CHAR  = 0x14100E;   // 숯   — 숯불 바닥, 갈색 기. 가장 낮은 배경·화로 안쪽
const C_HOT   = 0xE2622A;   // 열철 — 작업 온도의 쇠. 화로 발광
const C_WHITE = 0xFFD9A0;   // 백열 — 정점 순간에만 (정렬 성공)
const C_BRASS = 0xB08D4F;   // 놋쇠 — 부속 금속
// 담금질물(#4A6B72)은 별가루·무한의 층 전용이라 008 연출에는 쓰지 않는다.

// ── 연출 상수 (§4 성능 상한) ───────────────────────────────────────
const FX_MAX_PARTICLES = 64;    // 동시 생존 불티 상한. 방치형이라 상한이 곧 안전장치다.
const FX_BURST_BASE    = 6;     // 2연 기본 불티 수
const FX_BURST_PER_HIT = 5;     // 정렬 릴 1개당
const FX_BURST_PER_G   = 1.2;   // 등급 1당
const FX_BURST_CAP     = 34;    // 1회 분출 상한 (동시 상한과 별개)
const FX_BURST_REDUCED = 3;     // reduced-motion 일 때 고정 수
const FX_SHAKE_MS      = 150;
// 절전 (011 §1): 마지막 사건 뒤 이만큼 더 돌고 잠든다. 셰이크·바운스·불티가
// 끝났는지는 따로 확인하므로, 이 값은 "DOM 이 한 번 더 움직일 여유"다.
const SLEEP_IDLE_MS    = 320;
const FX_SHAKE_MIN     = 0.003, FX_SHAKE_MAX = 0.011;   // 카메라 셰이크 세기
const FX_BOUNCE_MS     = 380;

const VIEW={
  engine:'canvas2d', ready:false, scene:null,
  canvas:{w:0,h:0}, overlay:{visible:false},
  background:'css',                    // 008 에서 'canvas' 가 된다
  // 018 이 넷을 더한다. **노출되지 않는 연출은 완료로 인정하지 않는다**(CLAUDE.md).
  // 019 가 셋을 더한다 (던전 연출도 같은 규약을 따른다 — 노출 없으면 완료 아님).
  counters:{shake:0, burst:0, bounce:0, attack:0, hitstop:0, flash:0, dissolve:0,
    climb:0, dice:0, reward:0},
  limits:{particles:FX_MAX_PARTICLES, burstPerHit:FX_BURST_CAP},
  alive:{particles:0, tweens:0},       // 누적 방지 확인용 (§4)
  reducedMotion:false,
  lastBurst:0,                         // 직전 분출 개수 — reduced 축소가 눈에 보이게
  layers:{bg:'#stage', fx:'#fx'},      // 위 주석의 두 겹 구조
  // 무엇이 실려 있는지. count 는 **손그림 장수**다 (파생 개수가 아니다).
  sprites:{size:SPR_SIZE, count:18, palettes:15, scale:SPR_SCALE,
    // 손그림 총량의 내역. 상한을 표별로 따로 센다 (015: 장비 18 + 몹 6 + 용사 1 = 25).
    hand:{equip:18, mob:6, hero:2, tile:12, total:38},   // 018: 용사 공격 포즈 +1
    // 릴은 칸 폭에서 정수 배율을 고른다 (012). 검증이 실제로 고른 값을 볼 수 있게 낸다.
    get reelScale(){ return REEL_SCALE(); },
    // 등급 g → 실루엣 단계. 검증이 3단계 경계를 직접 확인할 수 있게 배열로 낸다.
    tierByGrade:[0,1,1,1,1,1,2,2,2,2,2,3,3,3,3,3]},
  // 몹·용사 (015). 무대는 013 이 만들지만, 그림이 실려 있다는 것은 지금 확인된다.
  mobs:{size:SPR_SIZE, axes:['melee','ranged'], tiers:3, count:6,
    fill:{melee:'solid', ranged:'hollow'}, hero:{count:1, edge:'bright'}},
  // 숫자 글리프 (010 §2). count 는 **손그림 글자 수**다. 17자를 넘기면 원칙 3 위반.
  glyphs:{cell:[5,7], count:17, chars:'0123456789+-×/%.,', scales:[2,3]},
  /* 047 R1 §2⑧ — 세로 우선 골격. 010 의 3단(`#hud`·`#focus`·`#manage`)을 대신한다.
     `scroll` 은 **0 이어야 한다**(L1 — 첫 화면에 스크롤 없음). 옛 `focus`·`manage`
     키는 겨눌 요소가 없어 지웠다 — 0 을 내는 죽은 창구는 검사를 조용히 통과시킨다. */
  layout:{tiers:['#hud','#arena','#scene','#openrow','#handles','#gearband','#qband','#tabs'],
    hud:0, arena:0, scene:0, openrow:0, dock:0, scroll:0, orientation:'portrait'},
  /* 047 §2⑤ — 「세 번 두드리면 하나」의 상태 창구. 검증이 효과로 재는 자리다. */
  get forge(){ return FG; },
  anvil:null,                          // 모루 화면 좌표 = 연출의 발원점
  // 전투 무대 (013). 캔버스는 Playwright 가 못 읽으므로 여기 없는 것은 검증 불가다.
  stage:{layers:3, tiles:12, tile:[TILE_W,TILE_H], scale:0, seg:-1, scrollX:0,
    moving:false, ground:0, mobs:0, alive:0, kind:'', tier:1, hero:false, rect:null,
    // 018 §3 — 개체 간격. 마리 수가 곧 남은 체력이라 붙으면 정보가 죽는다.
    mobScale:0, mobStep:0, mobX0:0, gap:0},
  // 전투 모션 (018). 지금 무엇이 도는 중인지 — 카운터와 짝이 되는 상태 창구다.
  motion:{attacking:false, atkPhase:'', hitstop:false, flashing:false, dying:0,
    pose:'idle', trail:false, reduced:false,
    // 021 — 사라진 슬롯을 **순서대로**. 낮은 인덱스가 용사에 가까운 쪽이다.
    // 같은 틱에 묶여 죽어도 담기는 순서는 가까운 쪽부터다.
    dieOrder:[]},
  // 던전 (019). 층 등반·주사위·보상이 지금 어디까지 왔는지. 그림은 013 타일 4장과
  // 015 몹 6장을 팔레트만 갈아 쓴 것이라 **손그림은 한 장도 늘지 않는다**.
  dungeon:{open:false, floor:0, best:0, seg:-1, tier:1, pos:0, landed:-1,
    rerolls:0, climbing:false, rolling:false, band:false, guard:false},
  // 재굽기가 정말 안 도는지 + **지금 자고 있는지** 보는 창구 (011 §1).
  // ⚠ 카운터는 "재웠다"만 말한다. "화면이 맞다"는 픽셀로 따로 봐야 한다
  //   (CLAUDE.md 검증 세션 절 — 009 가 이 구멍으로 통과했다).
  // ⚠ `frames`/`framesFx` = **실제로 그린 프레임 수** (013 §0). 017 이 Phaser 를
  //   걷어내며 `loop.frame` 이 사라져 011 이 세운 「루프 가동률(duty)」 이 NaN 이
  //   됐다(016 에서 뒤 겹 3.2% / 앞 겹 10.3% 를 주던 식). 두 겹을 따로 재우므로
  //   카운터도 따로 둔다 — duty = frames / (경과초 × 60).
  //   **성능 검사는 렌더 실패를 보상한다**(CLAUDE.md): 프레임 간격만 보면 "안 그려서
  //   빨라진" 빌드가 더 좋아 보인다. 이 둘이 그 구멍을 메우는 짝이다.
  //   `hidden`/`hiddenSkips` = 019 §2. 숨은 탭에서 **건너뛴 연출의 수**다 —
  //   "안 그렸다"를 카운터로 말해야 duty ≤ 2% 가 우연이 아님을 보일 수 있다.
  perf:{bgBakes:0, panelBakes:0, moves:0, sleeping:false, wakes:0, sleeps:0,
    frames:0, framesFx:0, hidden:false, hiddenSkips:0,
    reelFrames:0},                     // 048 §2⑦ — 릴이 실제로 움직인 프레임 수
  // 026 — **노출되지 않는 것은 완료로 인정하지 않는다**(CLAUDE.md). 광고는
  // 자동 검사가 눈으로 볼 수 없는 연출이라 여기 전부 내건다.
  /* 049 §2⑥ — 박자 창구. 실제 값은 rhyView() 가 채운다. */
  // ⚠ `RHY_BPM` 을 여기 쓰면 안 된다 — VIEW 가 먼저 만들어져 TDZ 다(실측: 하네스가
  //   「Cannot access 'RHY_BPM' before initialization」으로 죽어 smoke·days 가 통째로 멈췄다).
  //   부팅 직후 `rhyView()` 가 같은 값으로 덮는다.
  rhythm:{bpm:120.15, clock:'perf', beat:0, phase:0, last:{grade:'',ms:0},
    counts:{perfect:0,great:0,good:0,miss:0}, combo:0, best:0, running:false},
  // 049 §2⑤ — 소리 창구. 실제 값은 아래 sndView() 가 채운다(부팅 전에는 ctx:'none').
  sfx:{ctx:'none', music:true, sfx:true, packs:{sfx:'none',forge:'none'}, bgm:'none',
       loopLen:0, played:{}, skipped:0, dropped:0, lat:0},
  plat:{env:'none', ready:false, adsOn:false, paused:false, blocked:false,
    ads:0, done:0, failed:0, adLeft:0, adReady:false, dadReady:false, err:'',
    rewardOn:false, mids:0, midDone:0}                                  // 037 ⑥
};
globalThis.__view=VIEW;                // 브라우저에선 window.__view. node 검증에서도 안 죽는다.

