# 034 — 영어 + 한국어 (화면 글자를 한 곳으로) · 무거운 변경 · 담당: 코딩 세션

상태: **구현 완료 — 검증 대기** (코딩 세션, 2026-10-02) — `src/forge.html` **락 해제**. 028(CrazyGames 제출) 앞 마지막 지시서.

## 사용자 판정 (2026-09-29)

> 영어 + 한국어. 브라우저 언어가 한국어면 한국어, 그 밖에는 영어.

## 왜

CrazyGames 는 전 세계 포털이다. 요건 문서가 영어를 **필수**로 적지는 않지만, 품질 기준에
「게임이 무엇인지 분명할 것(clear about what it is)」이 있고, 한국어만으로는 대부분의
플레이어가 버튼 하나 읽지 못한다. 첫 5초 안에 「제련」이 무엇인지 모르면 떠난다 —
033 이 막은 그 이탈이 글자에서 다시 난다.

## 변경할 것

### ① 글자 표 하나

- 화면에 나가는 **모든 글자**를 표 하나 `STR = { ko:{…}, en:{…} }` 와 조회 함수 `t(key, …)` 로 모은다.
  버튼·라벨·`#msg` 판정문·팝업 제목과 본문·자동 정리 문구·승천 문구·던전·테크 설명·
  옵션 이름·특성 설명(`SP[k].d`)·`<title>`·`<html lang>` 까지.
- **표는 CORE 맨 앞에 둔다(데이터만, 로직 없음).** CORE 안에도 사용자에게 보이는 글자가 있다 —
  `resolve()` 의 등급 하락 경고 `confirm()`, `ascend()` 의 확인문. 이 두 곳은 **문자열을
  `t()` 호출로 바꾸는 것만** 허용한다. 계산·분기·순서는 한 글자도 바꾸지 말 것.
  **`days.js` 기본 출력 md5 `81a6288…` 바이트 동일** — 표가 CORE 에 들어가도 출력은 같아야 한다.
- 먼저 **한국어 표를 지금 화면 그대로** 채운다. 그 상태에서 화면이 **한 글자도 안 바뀌어야**
  한다(ko 로 연 전·후 DOM 글자 대조 = 차이 0). 그다음 en 을 채운다.

### ② 언어 고르기

- `navigator.language` 가 `ko` 로 시작하면 ko, 아니면 en. 시험용으로 `?lang=en` / `?lang=ko` 가 이긴다.
- **설정 화면·언어 버튼은 만들지 않는다**(027 에서 설정을 걷었다 — 빈 설정은 거짓말이다).
- 세이브에 언어를 저장하지 않는다. 기기가 정한다.

### ③ 영어 문구 — 용어집을 지킬 것

코딩 세션이 초안을 쓰고 **「구현 결과」에 ko → en 전체 대조표**를 붙인다. 계획 세션이 표로 판정한다.

| 한국어 | 영어 | 비고 |
|---|---|---|
| 제련 (버튼) | Forge | 「제련 600」 → 「Forge 600」 |
| 자동 / 정리 | Auto / Sort | 정리 = 대기열 자동 정리 |
| 대기 N/10 | Queue N/10 | |
| 대기열 정리 | Sort queue | |
| 강화 · 제련 등급 | Upgrade · Forge level | |
| 등급 · 세부 등급 I~X | Grade · I~X | 로마 숫자 그대로 |
| 화로압 · 임계압 | Pressure · Critical | 천장 — 내부 명칭은 화면에 쓰지 않는다 |
| 고정 토큰 | Lock token | 「릴을 눌러 고정」 → 「Tap an item to lock」 |
| 화로 지피기 | Stoke the forge | 광고 버튼 |
| 승천 | Ascend | |
| 별가루 | Stardust | |
| 무한의 층 · 던전 · 층 | Endless Tower · Dungeon · Floor | |
| 테크 | Tech | |
| 웨이브 · 최고 | Wave · Best | |
| 전투력 | Power | |
| 근접 / 원거리 / 혼합 무리 | Melee / Ranged / Mixed pack | |
| 등급 확률표 · 옵션 수치 상세 | Grade odds · Stat details | |
| 자동 판매 | Auto-sell | |
| 재굴림 | Reroll | |

**영어 금지어 (원칙 7 — 사행성 용어 금지의 영어판):** `spin` · `slot` · `reel` · `jackpot` ·
`bet` · `gamble` · `lucky` · `casino` · `payout` · `win big`. 화면 글자에 하나도 없어야 한다.
(내부 변수명 `reels`·`spin()` 은 그대로 — 화면에 안 나간다.)
「릴」은 영어에서 `reel` 이 되기 쉽다 — **item** 으로 옮긴다. 금지어 검사가 이런 것을 잡으라고 있다.

부제 「터져라! 대장간」은 en 에서 **뺀다**(말장난이 번역되지 않는다). 제목은 둘 다 「Hit Smith」.

## 검사 — 두 언어 모두에서

- **ko 무변경**: ko 로 연 화면의 글자가 034 전과 **전부 같다**(DOM 텍스트 대조, 팝업 셋 포함).
- **en 한글 0자**: en 으로 연 화면(탭 셋·팝업 셋·던전 주사위·승천 가능 세이브)에서 한글 음절 0.
- **금지어 0**: en 화면 글자에서 위 목록 0건(단어 경계 기준).
- **표 누락 0**: `t()` 가 모르는 키를 받으면 키 이름이 화면에 나온다 — en·ko 모두에서 키 이름 노출 0.
- **넘침**: `TB8`(9크기)·`LG1`·`LG2`·`GR1`·가로 스크롤 0 을 **en 에서도** 돌린다. 영어는 한국어보다 길다 —
  넘치면 칸을 늘리지 말고 **짧은 말을 먼저 찾고**, 안 되면 보고.
- **변이**: 한 키를 en 표에서 지운 빌드 → 「표 누락」 이 운다. en 한 곳에 한글을 남긴 빌드 → 「en 한글 0자」 가 운다.

## 바꾸지 말 것

- CORE — 문자열 → `t()` 교체와 표 추가 말고는 일절. `days.js` 기본 출력 `81a6288…`.
- 배치·크기·색·글꼴 크기(031 의 11px). 026 광고 장치, 027 자리, 030·031 배치, 032 충전, 033 정리.
- 숫자 글리프(픽셀 숫자)와 등급색.

## 완료 조건

- smoke 19/19, self-check 0건, `node --check`, soak 0, checklist 전 항목(두 언어), 삭제 0.
- 위 「검사」 전부, 변이 둘.
- en·ko 각각 380×820 · 821×462 · 1216×684 화면.
- **ko → en 전체 대조표**(구현 결과에). 용량 보고.

## 구현 결과 (구현 세션 · 2026-09-30 시작 · **2026-10-02 판정 ⓐⓑⓒ 반영 완료**)

`src/forge.html` 248,705 → **263,345 B**(빌드 md5 `ee0d9b8a9c32403c8541dc5bc1ab1aa4`),
`devtools/checklist.js` 208,785 → **211,303 B**.
CORE 첫 절 17,385 → **30,533 B** — 늘어난 13,148 B 는 **전부 글자 표와 그 주석**이다.
**CORE 자체 점검 절 7,851 B 바이트 동일**, `node tools/days.js` md5 **`81a6288…` 그대로**.

### ① ko 무변경 — **글자 차이 0건**

지시서 순서대로 ko 를 먼저 세우고 대조했다. 두 빌드를 **같은 난수 씨앗**으로 열어
(안 그러면 뽑히는 장비가 달라 글자가 달라진다) 12가지 상태 × 세이브 2벌의
`innerText` 를 통째로 비교했다:

```
[ko] 상태 12종 × 세이브 2벌 — 글자 차이 0건 · 콘솔 0건
```

상태: 제련탭 · 대기열 가득(정리 끔) · 비교 팝업 · 팝업 셋(확률표·수치·승천) ·
탭 셋 · 던전 · 주사위판 · 자동 정리 판정문. 세이브는 평범(★2·제련6)과 승천 가능(제련28).

### ② 구조

- **표는 CORE 맨 앞**(`STR={ko,en}`) — 데이터만이다. 자리표는 `{0}`·`{1}` 이고,
  말의 **순서**가 언어마다 달라서(ko 「13등급」 ↔ en 「Grade 13」) 필요했다.
- `t()` 는 **모르는 키를 키 이름 그대로** 돌려준다. 빈칸으로 삼키면 빠진 자리가 안 보인다.
- 정적 HTML 은 `data-s="키"` 한 바퀴(`i18nDom()`)로 갈아 끼운다. HTML 안의 한국어
  원문은 **남겨 뒀다** — 표에서 키가 빠지면 키 이름이 드러나고, 스크립트가 죽어도
  화면은 한국어로 읽힌다. ⚠ 테크 버튼이 이미 `data-t`(테크 키)를 쓰고 있어 속성
  이름은 `data-s` 다(처음에 `data-t` 로 붙였다가 테크 버튼이 전부 키 이름으로 바뀌었다).
- 언어: `?lang=` → `navigator.language` → (둘 다 없으면) ko. **설정 버튼은 없다.**
  세이브에 언어를 저장하지 않는다. `navigator` 가 없는 하네스가 ko 로 떨어지는 것이
  `days.js` 기본 출력이 바이트 동일한 이유다.
- CORE 에서 손댄 것은 **허용된 `confirm()` 두 곳뿐**(문자열 → `t()`. 조건·분기·순서
  한 글자도 안 바뀌었다). 데이터 표(`PARTS`·`OPT`·`SP`·`TECH`·`TILES`)는 **한 바이트도
  안 건드렸다** — VIEW 가 `t('part.'+id)`·`t('opt.'+k)` 처럼 **id 로** 표를 찾는다.

### ③ 검사

| 검사 | ko | en |
|---|---|---|
| checklist 전 항목 | **122 통과 · 0 실패** | **122 통과 · 0 실패** |
| 금지어 0 (spin·slot·reel·jackpot·bet·gamble·lucky·casino·payout) | — | **PASS** |
| 표에서 빠진 키 노출 0 | PASS | **PASS** |
| 최소 글자 (380×820 · 821×462 · 1216×684) | 11px | **11px** |
| 가로 스크롤 | 없음 | **없음** |
| smoke · 자체 점검 · `node --check` | 19/19 · 0건 · OK | 같음 |

⚠ en 첫 판에서 `FL1`(번쩍임 자리)이 한 번 FAIL 했는데 **다시 돌리니 PASS** 했다.
번쩍임의 수명을 재는 시간 의존 항목이고 언어와 무관하다 — 붙잡아 두기 위해 적는다.

**checklist 를 두 언어로 돌릴 수 있게 고쳤다(삭제 0).** 페이지가 `navigator.language`
로 언어를 고르는데 Playwright 기본값이 `en-US` 라, **아무 것도 안 하면 검사가 통째로
영어판을 본다** — 한국어가 박힌 항목이 그 순간 조용히 뒤집힌다. `?lang=ko` 를 기본으로
박고 `--en` 을 더했다. 그리고 한국어를 박아 두었던 항목 **여덟**(3b·3b2·5c·6a·6b·
8b·8c·TB1·TB4·GR1)을 **페이지의 `t()` 로 같은 키를 풀어 견주도록** 바꿨다. 무르게 한
것이 아니라 **두 언어에서 같은 뜻을 지키게** 한 것이다. `TB7` 은 `POPS` 의 값이 이제
키라서 `t(POPS[k])` 와 견준다.

### ④ ko → en 전체 대조표 (키 153 · 계획 세션 판정용)

표에서 **자동으로 뽑았다**(손으로 옮겨 적으면 표와 갈라진다). `⏎` 는 줄바꿈이다.

| 키 | 한국어 | 영어 |
|---|---|---|
| `doc.title` | Hit Smith — 터져라! 대장간 | Hit Smith |
| `tab.forge` | 제련 | Forge |
| `tab.dungeon` | 던전 | Dungeon |
| `tab.tech` | 테크 | Tech |
| `part.weapon` | 무기 | Weapon |
| `part.head` | 모자 | Helm |
| `part.body` | 상의 | Armor |
| `part.legs` | 하의 | Greaves |
| `part.hands` | 장갑 | Gloves |
| `part.feet` | 신발 | Boots |
| `wt.melee` | 근접 | Melee |
| `wt.ranged` | 원거리 | Ranged |
| `sp.exec.nm` | 처형 | Execute |
| `sp.exec.d` | 적 체력 25% 이하에 피해 ×1.8 | ×1.8 damage below 25% enemy HP |
| `sp.rage.nm` | 광폭 | Frenzy |
| `sp.rage.d` | 내 체력 50% 이하에 피해 ×1.5 | ×1.5 damage below 50% own HP |
| `sp.regen.nm` | 재생 | Regen |
| `sp.regen.d` | 초당 최대 체력 2% 회복 | Restore 2% max HP per second |
| `sp.pierce.nm` | 관통 | Pierce |
| `sp.pierce.d` | 맞지 않는 피해 옵션도 절반 적용 | Mismatched damage stats count half |
| `sp.label` | 각인 | Rune |
| `opt.crit` | 치명타 확률 | Crit chance |
| `opt.crit.s` | 치명 | Crit |
| `opt.cdmg` | 치명타 피해 | Crit damage |
| `opt.cdmg.s` | 치명 | Crit |
| `opt.aspd` | 공격 속도 | Attack speed |
| `opt.aspd.s` | 공격 | Speed |
| `opt.dbl` | 더블 어택 | Double strike |
| `opt.dbl.s` | 더블 | Double |
| `opt.melee` | 근접 피해 | Melee damage |
| `opt.melee.s` | 근접 | Melee |
| `opt.ranged` | 원거리 피해 | Ranged damage |
| `opt.ranged.s` | 원거 | Ranged |
| `opt.hp` | 체력 | Health |
| `opt.hp.s` | 체력 | HP |
| `opt.block` | 블록 확률 | Block chance |
| `opt.block.s` | 블록 | Block |
| `opt.leech` | 생명력 흡수 | Lifesteal |
| `opt.leech.s` | 생명 | Leech |
| `opt.gold` | 골드 획득 | Gold gain |
| `opt.gold.s` | 골드 | Gold |
| `tech.spd.nm` | 충전 속도 | Charge rate |
| `tech.spd.d` | 주기 -0.8% | Cycle -0.8% |
| `tech.cap.nm` | 저장 한도 | Charge cap |
| `tech.cap.d` | 충전 +30칸 | Charge +30 |
| `tech.sell.nm` | 판매 금액 | Sell price |
| `tech.sell.d` | +1.5% | +1.5% |
| `tech.cost.nm` | 강화 비용 | Upgrade cost |
| `tech.cost.d` | -0.5% | -0.5% |
| `tech.gold.nm` | 골드 획득 | Gold gain |
| `tech.gold.d` | +1.5% | +1.5% |
| `tech.align.nm` | 정렬 보정 | Match bonus |
| `tech.align.d` | 일치 +0.25% | Match +0.25% |
| `tech.title` | 테크트리 | Tech tree |
| `tech.dust` | 별가루 | Stardust |
| `tech.done` | 완료 | Maxed |
| `tile.dust` | 별가루 | Stardust |
| `tile.gold` | 골드 | Gold |
| `tile.tok` | 고정 토큰 | Lock token |
| `tile.chg` | 충전 가득 | Full charge |
| `tile.full` | 가득 | Full |
| `ui.wave` | 웨이브 | Wave |
| `ui.best` | 최고 | Best |
| `ui.power` | 전투력 | Power |
| `ui.forge` | 제련 | Forge |
| `ui.auto` | 자동 | Auto |
| `ui.sort` | 정리 | Sort |
| `ui.ascend` | 승천 | Ascend |
| `ui.stoke` | 화로 지피기 — 충전 가득 + 배속 | Stoke the forge — full charge + speed |
| `ui.boost` | 1.5배속 {0}분 남음 | 1.5x speed, {0} min left |
| `ui.queue` | 대기 | Queue |
| `ui.lockHint` | 릴을 눌러 고정 | Tap an item to lock |
| `ui.forgeLv` | 제련 등급 | Forge level |
| `ui.upgrade` | 강화 | Upgrade |
| `ui.gear` | 장비 | Gear |
| `ui.grade` | {0}등급 | Grade {0} |
| `ui.base` | 기본 {0} | Base {0} |
| `ui.sortQueue` | 대기열 정리 | Sort queue |
| `ui.sortNow` | 정리하기 ({0}) | Sort now ({0}) |
| `ui.queueFull` | 대기 가득 — 정리해야 계속 제련 | Queue full — sort it to keep forging |
| `ui.stat` | 전투력 {0} · 웨이브 {1} ·  | Power {0} · Wave {1} ·  |
| `ui.pityFull` | ▣ 임계압 — 다음 제련은 전 릴 정렬 | ▣ Critical — next forge matches every item |
| `ui.pity` | 화로압 {0}/{1} | Pressure {0}/{1} |
| `ui.autosellHd` | 이 등급은 대기열을 거치지 않고 바로 판매 | These grades sell at once, skipping the queue |
| `msg.item` | {0} {1} {2} | {0} {1} {2} |
| `msg.autosell` | {0} — 자동 판매  | {0} — auto-sold  |
| `msg.pity` | ▣ 임계압 정렬 — {0} | ▣ Critical match — {0} |
| `msg.match` | ◆ {0}연 정렬 — {1} | ◆ {0} matched — {1} |
| `msg.match2` | ◇ 2연 — {0} | ◇ 2 matched — {0} |
| `msg.sorted.equip` | 자동 정리 — {0} 장착 | Sorted — {0} equipped |
| `msg.sorted.sold` |  · {0} 판매  |  · {0} sold  |
| `msg.sorted.sell` | 자동 정리 — {0} 판매  | Sorted — {0} sold  |
| `foe.floor` | {0}층 · {1} | Floor {0} · {1} |
| `foe.melee` | 근접 무리 | Melee pack |
| `foe.ranged` | 원거리 무리 | Ranged pack |
| `foe.mix` | 혼합 무리 | Mixed pack |
| `cmp.worn` | 착용 중 | Equipped |
| `cmp.queued` | 대기열 | In queue |
| `cmp.empty` | 비어 있음 | Empty |
| `cmp.delta` | 교체 시 전투력 | Power after swap |
| `cmp.sell` | 판매 | Sell |
| `cmp.swap` | 교체 | Swap |
| `cmp.equipTry` | 교체해서 껴보기 | Swap and try it |
| `cmp.equip` | 장착 | Equip |
| `cmp.left` | 남은 대기 | Queue left |
| `cmp.note` | 교체하면 빠진 장비가 맨 앞에 남습니다 | Swapping leaves the old piece at the front |
| `cmp.close` | 닫기 — 화면 확인 | Close — check the screen |
| `pop.odds` | 등급 확률표 | Grade odds |
| `pop.stats` | 옵션 수치 상세 | Stat details |
| `pop.asc` | 승천 | Ascend |
| `pop.close` | 닫기 | Close |
| `odds.base` | 기본 | Base |
| `odds.three` | 3연 | 3 matched |
| `odds.title` | {0}등급 {1}% | Grade {0} {1}% |
| `stats.atk` | 공격력 | Attack |
| `stats.hp` | 체력 | Health |
| `asc.capAll` | 모든 등급 개방 · 승천까지 제련  | All grades open · Ascend at forge  |
| `asc.needWave` | 승천까지  | Reach wave  |
| `asc.needWave2` | 웨이브 |  |
| `asc.reach` |  도달 필요 |  to ascend |
| `asc.curBest` | (현재 최고 {0}) | (best {0}) |
| `asc.banner` | 승천 ★{0} — 수치 ×{1} · 옵션 상한 ×{2} | Ascend ★{0} — stats ×{1} · stat cap ×{2} |
| `asc.reels` |  · 릴 {0}개 |  · {0} items |
| `asc.sellAll` | 장비 {0}개가 전부 팔리고 제련 등급이 0으로 돌아갑니다. | All {0} pieces are sold and forge level returns to 0. |
| `asc.again` | 등급 상한은 다시 5등급부터 — 같은 길을 더 강한 장비로 다시 오릅니다. | Grade cap starts at 5 again — the same climb with stronger gear. |
| `asc.gain` |  · 기본 수치 ×{0} |  · base stats ×{0} |
| `asc.gain2` |  · 옵션 상한 ×{0} · 대기창 {1}칸 |  · stat cap ×{0} · queue {1} |
| `asc.reels2` |  · 릴 {0}개 → {1}개 |  · items {0} → {1} |
| `asc.do` | 승천한다 | Ascend |
| `asc.confirm` | 승천 ★{0}⏎⏎장비 {1}개가 전부 팔리고 제련 등급이 0으로 돌아갑니다.⏎등급 상한은 다시 5등급부터 — 같은 길을 더 강한 장비로 다시 오릅니다.⏎⏎장비 기본 수치 ×{2}, 옵션 상한 ×{3}, 대기창 {4}칸 | Ascend ★{0}⏎⏎All {1} pieces are sold and forge level returns to 0.⏎Grade cap starts at 5 again — the same climb with stronger gear.⏎⏎Base stats ×{2}, stat cap ×{3}, queue {4} |
| `asc.confirmReels` | ⏎릴 {0}개 → {1}개 | ⏎Items {0} → {1} |
| `asc.confirmGo` | ⏎⏎계속할까요? | ⏎⏎Continue? |
| `swap.confirm` | {0}등급을 {1}등급으로 교체합니다.⏎{2}등급 낮습니다. 계속할까요? | Swapping grade {0} for grade {1}.⏎That is {2} grades lower. Continue? |
| `up.next` | 제련  | Forge  |
| `up.next2` |  강화 시  |  upgrades to open  |
| `up.next3` |  개방 |  |
| `up.canAsc` | 승천 가능 | Ready to ascend |
| `up.capAll` | 모든 등급 개방 · 세부등급 상승 중 · 제련  | All grades open · tiers rising · ascend at forge  |
| `up.needWave` | 승천까지  | Reach wave  |
| `up.needWave2` |  도달 필요 (현재 최고 {0}) |  to ascend (best {0}) |
| `tower.title` | 무한의 층 | Endless Tower |
| `tower.best` | 최고 {0}층 | Best floor {0} |
| `tower.unvisited` | 미답 | Unvisited |
| `tower.floor` | 층 | F |
| `tower.floor0` | 0층 | Floor 0 |
| `tower.challenge` | 도전 — 오른 층만큼 별가루 | Challenge — stardust by floor reached |
| `tower.reached` | {0}층 도달 — 주사위를 굴리세요 | Floor {0} reached — roll the dice |
| `dice.hint` | 주사위를 굴려 보상 칸을 정하세요 | Roll the dice to pick a reward |
| `dice.roll` | 굴리기 | Roll |
| `dice.reroll` | 재굴림 | Reroll |
| `dice.claim` | 보상 받기 | Claim |
| `dice.landed` | {0} {1} — 받거나 광고로 다시 굴리기 | {0} {1} — take it, or watch an ad to roll again |
| `dice.take` | {0} 받기 | Take {0} |

---

## 판정 ⓐⓑⓒ 반영 (구현 세션 · 2026-10-02)

빌드 md5 `9f805e49a017c1f44d490445e9deacb4` · `src/forge.html` 263,345 → **263,990 B**
(CORE 첫 절 30,533 → 30,711 B — 늘어난 178 B 는 `t()` 교체와 그 주석이다. **CORE 자체
점검 절 7,851 B 바이트 동일**, `node tools/days.js` md5 **`81a6288…` 그대로**).
`devtools/checklist.js` 211,303 → 211,545 B.

### ⓐ CORE 두 자리 — 문자열만 바뀌었다

| 자리 | 바뀐 것 |
|---|---|
| `newWave()` → `#foes` | `` `${S.wave}층 · …무리` `` → `t('foe.floor', S.wave, t('foe.melee'/'foe.ranged'/'foe.mix'))` |
| `spin()` 이름표 | `` `${PARTS[part].nm} ${it.g}등급 ${ROMAN[it.lv]}` `` → `t('msg.item', t('part.'+…), t('ui.grade',it.g), ROMAN[it.lv])` |
| `spin()` 자동 판매 | `t('msg.autosell',tag)+ciGold()+fmt(…)` |
| `spin()` 판정문 세 갈래 | `t('msg.pity'/'msg.match'/'msg.match2', …)` — **삼항 두 개의 순서 그대로** |

계산·분기·순서 **0 변경**. 뽑히는 부위·등급·세부등급을 정하는 코드는 건드리지 않았다.
`days.js` 기본 출력 md5 동일(하네스에 `navigator` 가 없어 LANG 이 ko 로 떨어진다).
덤으로 **VIEW 한 자리를 더 찾았다** — `climbFx()` 의 이른 반환 `floor+'층'`(층수가 0 이거나
모션을 줄인 판에서만 지나는 줄). 지난 훑기가 놓친 자리이고 같은 `t('tower.floor')` 로 고쳤다.

**en 최악 `#msg` 가 한 줄에 드는가** (판정 ⓐ 의 요구). 글자를 상자에 넣지 않고 **같은 글꼴의
떠 있는 span** 으로 실제 필요 폭을 쟀다(상자 안에서 재면 `scrollWidth` 가 상자 폭에 갇혀
전부 「딱 맞음」으로 보인다 — 처음에 그렇게 속았다):

| 문구 | ko 필요폭 | en 필요폭(줄이기 전 → 후) |
|---|---|---|
| ◆ N연 정렬 | 167px | 208px |
| ▣ 임계압 정렬 | 184px | 226px |
| 자동 판매 | 212px | 241px |
| **자동 정리(장착+판매)** | **363px** | **436px → 397px** |
| 자동 정리(판매) | 239px | 240px |

칸 폭은 380×820 **328px** · 800×450 **406px** · 821×462 **418px** · 1216×684 586px.
436px 는 800×450·821×462 에서 **두 줄로 넘쳤다**. 칸을 늘리지 않고 말을 줄였다:

```
Sorted — {0} equipped · {0} sold     (436px)
Sorted: kept {0} · sold {0}          (397px)   ← 채택
```

후보 여섯을 재서 고른 것이다(`Auto · kept …` 390px 가 더 짧았지만 「자동」 버튼과 말이
겹쳐서 버렸다). **800×450·821×462 에서 en 최악 문구가 한 줄**이 됐다.
⚠ 380×820 에서는 **ko 도 en 도 두 줄**이다(ko 363px · en 397px vs 칸 328px).
en 이 더 나빠진 것이 아니라 **033 의 두 항목 문구가 원래 그 크기에서 두 줄**이다 —
034 가 만든 것이 아니라 적어 둔다(제안 ⑸).

### ⓑ 「제련 600」 공백 복구 — 자리는 한 픽셀도 안 움직였다

033 이 `#spinlbl`·`#chg` 를 붙여 놓아 글자가 「제련600」이었다. `#spin` 의 flex `gap:7px`
이 **눈에만** 간격을 주고 글자에는 공백이 없다 — 복사하면 「제련600」이고 읽어 주는
기계도 그렇게 읽는다. 라벨 끝에 공백 하나를 둔다.

| | 글자 | 제련 줄 y | 대기열 줄 y | 버튼 폭 |
|---|---|---|---|---|
| ko 380×820 전 → 후 | `제련600` → **`제련 600`** | 458 → **458** | 504 → **504** | 205 → **205** |
| ko 800×450 전 → 후 | `제련600` → **`제련 600`** | 320 → **320** | 366 → **366** | 257 → **257** |
| ko 821×462 전 → 후 | `제련600` → **`제련 600`** | 326 → **326** | 372 → **372** | 265 → **265** |
| en 세 크기 | `Forge600` → **`Forge 600`** | 458·323·329 (불변) | 502·367·373 (불변) | 불변 |

⚠ **어제의 「ko 무변경 0건」은 이 회귀를 볼 수 없었다.** 대조에 `innerText` 를 썼는데,
flex 간격이 `innerText` 에서 **공백으로 들어온다** — 「제련600」과 「제련 600」이 같은
글자로 읽혔다. 자리(`y`)와 글자(`textContent`)를 따로 재는 이번 표가 그 눈먼 자리를
메운 것이고, 검사로 세울 것을 제안 ⑹에 올렸다.

### ⓒ 대조표 여섯 갈래 — 전부 반영

| 키 | 고친 en |
|---|---|
| `asc.reels` | ` · {0} per forge` |
| `asc.reels2` | ` · per forge {0} → {1}` |
| `asc.confirmReels` | `⏎Items per forge {0} → {1}` |
| `asc.capAll` · `up.capAll` | `… Ascend at Forge Lv ` · `… ascend at Forge Lv ` |
| `up.next` · `up.next2` · `up.next3` | `Forge Lv ` · ` opens ` · `` → 「Forge Lv 7 opens Grade 6」 |
| `cmp.close` | `Back to forge` |
| `sp.pierce.d` | `Off-type damage stats apply at half` |

여기에 ⓐ 에서 줄인 `msg.sorted.*` 세 키가 더 바뀌었다 — **합쳐서 13키**(아래 표에 표시).

### 검사 (두 언어)

| | ko | en |
|---|---|---|
| checklist 전 항목 | **122 통과 · 0 실패** | **122 통과 · 0 실패** |
| 화면 글자 대조(어제 빌드 대비) | **0건** | — |
| 한글 0자 · 금지어 0 · 키 노출 0 | — | **전부 PASS** |
| 최소 글자 / 가로 스크롤 (세 크기) | 11px / 없음 | 11px / 없음 |
| smoke · 자체 점검 · `node --check` · soak | 19/19 · 0건 · OK · **누수 없음** | 같음 |

en 에서 `V2`(무리 종류 표시)가 한 번 울었다 — 「근접\|원거리\|혼합」을 **한국어로 박아**
둔 항목이었다. `t('foe.*')` 셋 중 하나와 견주도록 고쳤다(무르게 한 것이 아니라 두 언어에서
같은 뜻을 지키게 한 것). 고친 뒤 ko 도 다시 돌려 122/0 을 확인했다.

### ko → en 전체 대조표 (키 153 · **바뀐 13키 표시**)

표에서 자동으로 다시 뽑았다.

| | 키 | 한국어 | 영어 |
|---|---|---|---|
|  | `doc.title` | Hit Smith — 터져라! 대장간 | Hit Smith |
|  | `tab.forge` | 제련 | Forge |
|  | `tab.dungeon` | 던전 | Dungeon |
|  | `tab.tech` | 테크 | Tech |
|  | `part.weapon` | 무기 | Weapon |
|  | `part.head` | 모자 | Helm |
|  | `part.body` | 상의 | Armor |
|  | `part.legs` | 하의 | Greaves |
|  | `part.hands` | 장갑 | Gloves |
|  | `part.feet` | 신발 | Boots |
|  | `wt.melee` | 근접 | Melee |
|  | `wt.ranged` | 원거리 | Ranged |
|  | `sp.exec.nm` | 처형 | Execute |
|  | `sp.exec.d` | 적 체력 25% 이하에 피해 ×1.8 | ×1.8 damage below 25% enemy HP |
|  | `sp.rage.nm` | 광폭 | Frenzy |
|  | `sp.rage.d` | 내 체력 50% 이하에 피해 ×1.5 | ×1.5 damage below 50% own HP |
|  | `sp.regen.nm` | 재생 | Regen |
|  | `sp.regen.d` | 초당 최대 체력 2% 회복 | Restore 2% max HP per second |
|  | `sp.pierce.nm` | 관통 | Pierce |
| **바뀜** | `sp.pierce.d` | 맞지 않는 피해 옵션도 절반 적용 | Off-type damage stats apply at half |
|  | `sp.label` | 각인 | Rune |
|  | `opt.crit` | 치명타 확률 | Crit chance |
|  | `opt.crit.s` | 치명 | Crit |
|  | `opt.cdmg` | 치명타 피해 | Crit damage |
|  | `opt.cdmg.s` | 치명 | Crit |
|  | `opt.aspd` | 공격 속도 | Attack speed |
|  | `opt.aspd.s` | 공격 | Speed |
|  | `opt.dbl` | 더블 어택 | Double strike |
|  | `opt.dbl.s` | 더블 | Double |
|  | `opt.melee` | 근접 피해 | Melee damage |
|  | `opt.melee.s` | 근접 | Melee |
|  | `opt.ranged` | 원거리 피해 | Ranged damage |
|  | `opt.ranged.s` | 원거 | Ranged |
|  | `opt.hp` | 체력 | Health |
|  | `opt.hp.s` | 체력 | HP |
|  | `opt.block` | 블록 확률 | Block chance |
|  | `opt.block.s` | 블록 | Block |
|  | `opt.leech` | 생명력 흡수 | Lifesteal |
|  | `opt.leech.s` | 생명 | Leech |
|  | `opt.gold` | 골드 획득 | Gold gain |
|  | `opt.gold.s` | 골드 | Gold |
|  | `tech.spd.nm` | 충전 속도 | Charge rate |
|  | `tech.spd.d` | 주기 -0.8% | Cycle -0.8% |
|  | `tech.cap.nm` | 저장 한도 | Charge cap |
|  | `tech.cap.d` | 충전 +30칸 | Charge +30 |
|  | `tech.sell.nm` | 판매 금액 | Sell price |
|  | `tech.sell.d` | +1.5% | +1.5% |
|  | `tech.cost.nm` | 강화 비용 | Upgrade cost |
|  | `tech.cost.d` | -0.5% | -0.5% |
|  | `tech.gold.nm` | 골드 획득 | Gold gain |
|  | `tech.gold.d` | +1.5% | +1.5% |
|  | `tech.align.nm` | 정렬 보정 | Match bonus |
|  | `tech.align.d` | 일치 +0.25% | Match +0.25% |
|  | `tech.title` | 테크트리 | Tech tree |
|  | `tech.dust` | 별가루 | Stardust |
|  | `tech.done` | 완료 | Maxed |
|  | `tile.dust` | 별가루 | Stardust |
|  | `tile.gold` | 골드 | Gold |
|  | `tile.tok` | 고정 토큰 | Lock token |
|  | `tile.chg` | 충전 가득 | Full charge |
|  | `tile.full` | 가득 | Full |
|  | `ui.wave` | 웨이브 | Wave |
|  | `ui.best` | 최고 | Best |
|  | `ui.power` | 전투력 | Power |
|  | `ui.forge` | 제련 | Forge |
|  | `ui.auto` | 자동 | Auto |
|  | `ui.sort` | 정리 | Sort |
|  | `ui.ascend` | 승천 | Ascend |
|  | `ui.stoke` | 화로 지피기 — 충전 가득 + 배속 | Stoke the forge — full charge + speed |
|  | `ui.boost` | 1.5배속 {0}분 남음 | 1.5x speed, {0} min left |
|  | `ui.queue` | 대기 | Queue |
|  | `ui.lockHint` | 릴을 눌러 고정 | Tap an item to lock |
|  | `ui.forgeLv` | 제련 등급 | Forge level |
|  | `ui.upgrade` | 강화 | Upgrade |
|  | `ui.gear` | 장비 | Gear |
|  | `ui.grade` | {0}등급 | Grade {0} |
|  | `ui.base` | 기본 {0} | Base {0} |
|  | `ui.sortQueue` | 대기열 정리 | Sort queue |
|  | `ui.sortNow` | 정리하기 ({0}) | Sort now ({0}) |
|  | `ui.queueFull` | 대기 가득 — 정리해야 계속 제련 | Queue full — sort it to keep forging |
|  | `ui.stat` | 전투력 {0} · 웨이브 {1} ·  | Power {0} · Wave {1} ·  |
|  | `ui.pityFull` | ▣ 임계압 — 다음 제련은 전 릴 정렬 | ▣ Critical — next forge matches every item |
|  | `ui.pity` | 화로압 {0}/{1} | Pressure {0}/{1} |
|  | `ui.autosellHd` | 이 등급은 대기열을 거치지 않고 바로 판매 | These grades sell at once, skipping the queue |
|  | `msg.item` | {0} {1} {2} | {0} {1} {2} |
|  | `msg.autosell` | {0} — 자동 판매  | {0} — auto-sold  |
|  | `msg.pity` | ▣ 임계압 정렬 — {0} | ▣ Critical match — {0} |
|  | `msg.match` | ◆ {0}연 정렬 — {1} | ◆ {0} matched — {1} |
|  | `msg.match2` | ◇ 2연 — {0} | ◇ 2 matched — {0} |
| **바뀜** | `msg.sorted.equip` | 자동 정리 — {0} 장착 | Sorted: kept {0} |
| **바뀜** | `msg.sorted.sold` |  · {0} 판매  |  · sold {0}  |
| **바뀜** | `msg.sorted.sell` | 자동 정리 — {0} 판매  | Sorted: sold {0}  |
|  | `foe.floor` | {0}층 · {1} | Floor {0} · {1} |
|  | `foe.melee` | 근접 무리 | Melee pack |
|  | `foe.ranged` | 원거리 무리 | Ranged pack |
|  | `foe.mix` | 혼합 무리 | Mixed pack |
|  | `cmp.worn` | 착용 중 | Equipped |
|  | `cmp.queued` | 대기열 | In queue |
|  | `cmp.empty` | 비어 있음 | Empty |
|  | `cmp.delta` | 교체 시 전투력 | Power after swap |
|  | `cmp.sell` | 판매 | Sell |
|  | `cmp.swap` | 교체 | Swap |
|  | `cmp.equipTry` | 교체해서 껴보기 | Swap and try it |
|  | `cmp.equip` | 장착 | Equip |
|  | `cmp.left` | 남은 대기 | Queue left |
|  | `cmp.note` | 교체하면 빠진 장비가 맨 앞에 남습니다 | Swapping leaves the old piece at the front |
| **바뀜** | `cmp.close` | 닫기 — 화면 확인 | Back to forge |
|  | `pop.odds` | 등급 확률표 | Grade odds |
|  | `pop.stats` | 옵션 수치 상세 | Stat details |
|  | `pop.asc` | 승천 | Ascend |
|  | `pop.close` | 닫기 | Close |
|  | `odds.base` | 기본 | Base |
|  | `odds.three` | 3연 | 3 matched |
|  | `odds.title` | {0}등급 {1}% | Grade {0} {1}% |
|  | `stats.atk` | 공격력 | Attack |
|  | `stats.hp` | 체력 | Health |
| **바뀜** | `asc.capAll` | 모든 등급 개방 · 승천까지 제련  | All grades open · Ascend at Forge Lv  |
|  | `asc.needWave` | 승천까지  | Reach wave  |
|  | `asc.needWave2` | 웨이브 |  |
|  | `asc.reach` |  도달 필요 |  to ascend |
|  | `asc.curBest` | (현재 최고 {0}) | (best {0}) |
|  | `asc.banner` | 승천 ★{0} — 수치 ×{1} · 옵션 상한 ×{2} | Ascend ★{0} — stats ×{1} · stat cap ×{2} |
| **바뀜** | `asc.reels` |  · 릴 {0}개 |  · {0} per forge |
|  | `asc.sellAll` | 장비 {0}개가 전부 팔리고 제련 등급이 0으로 돌아갑니다. | All {0} pieces are sold and forge level returns to 0. |
|  | `asc.again` | 등급 상한은 다시 5등급부터 — 같은 길을 더 강한 장비로 다시 오릅니다. | Grade cap starts at 5 again — the same climb with stronger gear. |
|  | `asc.gain` |  · 기본 수치 ×{0} |  · base stats ×{0} |
|  | `asc.gain2` |  · 옵션 상한 ×{0} · 대기창 {1}칸 |  · stat cap ×{0} · queue {1} |
| **바뀜** | `asc.reels2` |  · 릴 {0}개 → {1}개 |  · per forge {0} → {1} |
|  | `asc.do` | 승천한다 | Ascend |
|  | `asc.confirm` | 승천 ★{0}⏎⏎장비 {1}개가 전부 팔리고 제련 등급이 0으로 돌아갑니다.⏎등급 상한은 다시 5등급부터 — 같은 길을 더 강한 장비로 다시 오릅니다.⏎⏎장비 기본 수치 ×{2}, 옵션 상한 ×{3}, 대기창 {4}칸 | Ascend ★{0}⏎⏎All {1} pieces are sold and forge level returns to 0.⏎Grade cap starts at 5 again — the same climb with stronger gear.⏎⏎Base stats ×{2}, stat cap ×{3}, queue {4} |
| **바뀜** | `asc.confirmReels` | ⏎릴 {0}개 → {1}개 | ⏎Items per forge {0} → {1} |
|  | `asc.confirmGo` | ⏎⏎계속할까요? | ⏎⏎Continue? |
|  | `swap.confirm` | {0}등급을 {1}등급으로 교체합니다.⏎{2}등급 낮습니다. 계속할까요? | Swapping grade {0} for grade {1}.⏎That is {2} grades lower. Continue? |
| **바뀜** | `up.next` | 제련  | Forge Lv  |
| **바뀜** | `up.next2` |  강화 시  |  opens  |
| **바뀜** | `up.next3` |  개방 |  |
|  | `up.canAsc` | 승천 가능 | Ready to ascend |
| **바뀜** | `up.capAll` | 모든 등급 개방 · 세부등급 상승 중 · 제련  | All grades open · tiers rising · ascend at Forge Lv  |
|  | `up.needWave` | 승천까지  | Reach wave  |
|  | `up.needWave2` |  도달 필요 (현재 최고 {0}) |  to ascend (best {0}) |
|  | `tower.title` | 무한의 층 | Endless Tower |
|  | `tower.best` | 최고 {0}층 | Best floor {0} |
|  | `tower.unvisited` | 미답 | Unvisited |
|  | `tower.floor` | 층 | F |
|  | `tower.floor0` | 0층 | Floor 0 |
|  | `tower.challenge` | 도전 — 오른 층만큼 별가루 | Challenge — stardust by floor reached |
|  | `tower.reached` | {0}층 도달 — 주사위를 굴리세요 | Floor {0} reached — roll the dice |
|  | `dice.hint` | 주사위를 굴려 보상 칸을 정하세요 | Roll the dice to pick a reward |
|  | `dice.roll` | 굴리기 | Roll |
|  | `dice.reroll` | 재굴림 | Reroll |
|  | `dice.claim` | 보상 받기 | Claim |
|  | `dice.landed` | {0} {1} — 받거나 광고로 다시 굴리기 | {0} {1} — take it, or watch an ad to roll again |
|  | `dice.take` | {0} 받기 | Take {0} |

## 계획 세션 판정 (2026-10-01) — CORE 두 자리 승인 · 대조표 판정 · 빠진 절 복구

### ⓐ CORE 두 자리 승인

`newWave()` 의 `#foes` 한 줄, `spin()` 의 `#msg` 네 줄 — **문자열 → `t()` 교체만** 승인한다.
확인문 둘과 같은 종류다. 계산·분기·순서 0 변경, `days.js` 기본 출력 `81a6288…` 그대로.
지시서가 CORE 의 보이는 글자를 「둘」로 적은 것은 계획 세션이 실물을 안 훑은 탓이다
(CLAUDE.md 「지시서가 적은 사실도 산출물이다」의 또 한 사례).

⚠ **`#msg` 는 제련 패널 안이다 — 800×450 의 여유가 2px 이다.** en 최악 문구
(`◆ 5 matched — Greaves Grade 15 VIII`, `Sorted — … equipped · … sold`)가 **한 줄에 들어가는지**
800×450·821×462 에서 재고 적을 것. 넘치면 말을 줄인다(칸 늘리기 금지).

### ⓑ 「033 검증에서 넘어온 것」 절이 이 문서에서 사라졌다 — 복구한다

계획 세션이 2026-09-30 에 이 문서에 덧붙인 절이 **구현 결과를 적는 과정에서 덮였다.**
그래서 아래 첫 항목이 반영되지 않았다(ko 무변경 대조 0건 = 「제련600」 그대로라는 뜻).

- **「제련 600」 공백 복구.** 033 이 만든 회귀(「제련600」). ko 「제련 600」, en 「Forge 600」.
  ko 무변경 대조의 기준은 **9dbf474 화면에서 이 한 곳만 공백을 넣은 것**이다 — 이 한 곳 차이는 의도다.
- **800×450 제련 패널 여유 2px** — 위 ⓐ 의 `#msg` 확인이 이것이다.
- **「글자만 바뀌고 자리는 안 바뀐다」를 ko 에서 좌표로** — 제련 줄·대기열 줄 y 좌표 전·후 대조.

규칙으로 올렸다 → CLAUDE.md 「지시서에 적을 때는 그 순간의 파일에 덧붙여라」.

### ⓒ 대조표 판정 — 153 키 중 고칠 것 여섯 갈래

나머지는 **받는다.** 금지어 0, 톤 일관, 짧다.

| 키 | 지금 en | 고칠 en | 이유 |
|---|---|---|---|
| `asc.reels` | ` · {0} items` | ` · {0} per forge` | 「릴 수」= 한 번 제련에 뜨는 칸 수. 「items」만으로는 무엇의 개수인지 안 읽힌다 |
| `asc.reels2` | ` · items {0} → {1}` | ` · per forge {0} → {1}` | 같은 이유 |
| `asc.confirmReels` | `⏎Items {0} → {1}` | `⏎Items per forge {0} → {1}` | 같은 이유 |
| `asc.capAll` · `up.capAll` | `… ascend at forge ` | `… ascend at Forge Lv ` | 뒤에 숫자가 붙는다 — 「at forge 28」은 레벨인지 안 읽힌다 |
| `up.next` · `up.next2` · `up.next3` | `Forge ` · ` upgrades to open ` · `` | `Forge Lv ` · ` opens ` · `` | ko 「제련 N 강화 시 M등급 개방」 → 「Forge Lv 7 opens Grade 6」 |
| `cmp.close` | `Close — check the screen` | `Back to forge` | 직역이라 어색하다 |
| `sp.pierce.d` | `Mismatched damage stats count half` | `Off-type damage stats apply at half` | 근접/원거리 반대쪽 피해 옵션이라는 뜻 |

(참고: `opt.crit.s`·`opt.cdmg.s` 가 en 에서 둘 다 `Crit` 인 것은 ko 가 둘 다 「치명」인 것을 그대로 옮긴 것 —
034 범위 밖이다. 1.0 이후 후보로 둔다.)

## 제안 (구현하지 말고 여기에 적을 것)

1. **`t()` 를 안 거치고 화면에 글자를 쓰는 자리를 막는 검사가 없다.** 이번에는
   훑어서 찾았지만, 다음에 누가 한국어 리터럴을 새로 심으면 en 판에서만 조용히
   드러난다. 「en 으로 연 화면에 한글 0자」를 checklist 항목으로 세울 것 —
   이번 계측(`/tmp/v034en.js`)이 그대로 옮겨진다. 변이도 쉽다(en 표에서 키 하나 지우기).
2. **`?lang=` 를 읽는 자리가 언어와 광고 플래그 둘로 갈렸다.** 026 은 `?cg=1`,
   034 는 `?lang=`. 검사에서 `URL+'?cg=1'` 을 `&cg=1` 로 고쳤는데, 쿼리를 붙이는
   자리가 늘면 또 밟는다 — 작은 도우미 하나로 묶을 만하다.
3. **en 의 「Sort now (2)」·「Stoke the forge — full charge + speed」가 가장 긴 말이다.**
   지금은 안 넘치지만(아홉 크기 전부 통과) 여유가 크지 않다. 말을 더 붙일 일이 생기면
   이 둘부터 볼 것.
4. **부제 「터져라! 대장간」은 en 에서 뺐다**(지시서대로). ko 제목은 그대로다.
5. **자동 정리(장착+판매) 문구는 380×820 에서 ko·en 둘 다 두 줄이다**(ko 363px · en 397px
   vs 칸 328px). `#msg` 는 `height:18px` 라 둘째 줄이 아래 칸을 밀고 들어간다. 033 이
   한 틱에 두 항목을 적게 하면서 생긴 길이이고 034 가 만든 것이 아니다 — 세로에서
   무엇을 줄일지(이름표를 등급만으로? 판매액을 뺄까?)는 연출 쪽 판단이다.
6. **「글자는 같고 자리만 다른」 회귀를 보는 눈이 없었다.** 어제의 ko 무변경 대조가
   「제련600」을 통과시킨 이유는 `innerText` 가 flex 간격을 공백으로 넣어 주기 때문이다.
   화면 글자 검사는 `textContent`(진짜 글자)와 `innerText`(보이는 꼴)를 **둘 다** 봐야
   한다. checklist 에 「`#spin` 의 textContent 에 공백이 있다」 같은 못을 하나 박을 것.
7. **`?lang=ko` 를 검사가 못박은 뒤에도 `navigator.language` 경로는 아무도 안 본다.**
   기기 언어로 고르는 길이 진짜 제품 경로인데 검사는 늘 쿼리로 연다 — 「ko-KR 로 열면
   ko, fr-FR 로 열면 en」을 Playwright `locale` 로 한 번 보는 항목이 필요하다.


## 검증 기록
- (검증 세션이 기록 — **재작성 시 이 절을 지우지 말 것**)

### 034 구현 검증 — 합 (검증 세션 · 2026-10-02)

검사 대상 `src/forge.html` **263,990 B · md5 `9f805e49a017c1f44d490445e9deacb4`**
— 판정 ⓐⓑⓒ 반영분이 적은 그 md5 그대로다.

**얼려 두고 쟀다.** 사본 트리 `/tmp/p34` 에 `chmod -R a-w` 로 잠갔다. `md5sum` 을 실행
전·사이·뒤로 찍어 전부 `9f805e49…` 였고, 변이 셋은 모두 별도 사본 트리에서 만들었다.
기기 원본은 이 세션에서 한 번도 안 열렸다.

**이전 빌드 9dbf474** — `device_bash` 가 없어 기기에서 `git show` 를 못 돌렸다.
`.git` 의 느슨한 개체를 직접 풀어 꺼냈다(커밋 → 트리 → 블롭):
`src/forge.html` = **`e458488d…` 248,705 B**(= 033 빌드) · `devtools/checklist.js`
= **`67247a66…` 208,785 B**(= 033 검증에서 올린 122항목판). 둘 다 지난 검증의 사본과
md5 가 같다 — 이번 바이트 대조의 기준이다.

| 검사 | 결과 |
|---|---|
| `tools/smoke.js` | **19 통과 · 0 실패** · 자체 점검 `self-check ok · ★0 · 릴 3개 · 상한 5등급 · 승천 제련 28` |
| `tools/days.js` 기본 출력 | **md5 `81a6288ee480f80cc9a6c014de4e1826`**(1,854 B) — 표가 CORE 맨 앞에 들어가고도 그대로 |
| `node --check` | forge 인라인(208,304 B) OK · `days.js` 바깥(26,294 B) OK · `days.js` 템플릿 안쪽(20,183 B) OK · `checklist.js` OK |
| checklist (기기 배포본 `acd078a4…`) | **ko 122 통과 · 0 실패** / **en 122 통과 · 0 실패** |
| checklist (이번에 `I18N1`·`SPC1` 을 더하고 `5c` 를 조인 것) | **ko 124 통과 · 0 실패** / **en 124 통과 · 0 실패** |
| `devtools/soak.js` | **종료 코드 0 · 누수 없음** · 프로브 11종 전부 측정 · 콘솔 0건 · DOM 360 → **373**(`data-s` 래퍼 13개) 이 5분 내내 고정 · 힙 9.5MB 고정 |
| 용량 | forge 248,705 → **263,990 B** · checklist 208,785 → **211,545 B** · `docs/DESIGN.md` **8,479 B 그대로** |

#### ① CORE 변경이 「표 추가 + 문자열 → `t()` 교체」뿐인가 — **바이트로 닫았다**

구획 md5 대조(9dbf474 ↔ 034):

| 구획 | 9dbf474 | 034 | |
|---|---|---|---|
| CORE (로직) | 17,179 B | 30,505 B | +13,326 B |
| VIEW (표시) | 168,311 B | 169,353 B | +1,042 B |
| **CORE (자체 점검)** | 7,828 B `69af180d…` | 7,828 B **`69af180d…`** | **바이트 동일** ✅ |

(절대값이 보고의 17,385/30,711/7,851 과 다른 것은 배너를 어디서 자르냐는 관례 차이다 —
**증가분 +13,326 B 는 보고와 정확히 같다.**)

CORE 첫 절에서 **글자 표 블록(`글자 표 (034)` 주석 ~ `t()` 끝, 228줄 · 13,260 B)을 통째로
걷어낸 뒤** 9dbf474 의 CORE 첫 절과 diff 했다. 남은 차이는 **네 덩어리뿐**이고, 그것이
지시서·판정이 적은 자리와 정확히 일치한다:

| 자리 | 바뀐 줄 | 무엇이 |
|---|---|---|
| `spin()` | **4줄** | 이름표 `tag` · 자동 판매 `innerHTML` · 판정문 삼항 한 줄 (+ 주석 1줄) |
| `newWave()` → `#foes` | **1줄** | `t('foe.floor', …)` |
| `resolve()` `confirm()` | 1곳 | `t('swap.confirm', old.g, nw.g, old.g-nw.g)` |
| `ascend()` `confirm()` | 1곳 | `t('asc.confirm', …)` + `t('asc.confirmReels')` + `t('asc.confirmGo')` |

→ **confirm 둘 · `#foes` 1줄 · `#msg` 4줄.** 그 밖에는 **한 글자도 없다**(diff 가 끝났다).

**계산·분기·순서 0 변경**을 한 줄씩 확인했다:
- 이름표: `PARTS[part].nm` → `t('part.'+PARTS[part].id)` — **같은 `part` 색인**이고 `it.g`·`ROMAN[it.lv]` 그대로.
- 자동 판매: `S.gold += sellPrice(it)` 그대로, `sellPrice(it)` 호출 횟수도 전·후 2회로 같다.
- 판정문: `pityHit ? … : b>=2 ? … : b===1 ? … : tag` — **삼항 둘의 조건과 순서 그대로**.
- `#foes`: `melee → ranged → mix` 순서 그대로.
- 두 `confirm()`: 인자로 들어간 식(`old.g-nw.g`·`4**(S.star+1)`·`(1+(S.star+1)*0.6).toFixed(1)`·
  `qmax()+1`·`REELS()<5`)이 전·후 동일. `Math.random` 소비 횟수가 안 바뀌므로
  `days.js` 기본 출력이 바이트 동일하다 — **실측으로도 `81a6288…`**.
- 표는 **데이터만**이다(순수 객체 리터럴). `LANG`·`t()` 는 표 밖의 조회부이고,
  하네스에는 `navigator` 가 없어 `LANG='ko'` 로 떨어진다(소스 주석의 설명과 실측 일치).

#### ② ko 무변경 — 화면 글자 차이는 **「제련 600」 공백 한 곳뿐**, 자리는 **0건**

⚠ **첫 측정은 내가 틀렸다.** 형제 index 로 자리를 잡는 경로(`b#pw[0]`)로 견줬더니
수십 종의 「차이」가 나왔는데, 전부 **글자는 같고 구조만 바뀐** 자리였다 —
034 의 `data-s` 가 `전투력 <b id="pw">` 를 `<span data-s="ui.power">전투력</span> <b id="pw">`
로 감싸면서 형제 번호가 밀린 것이다(요소 수 **+13**). 즉 **`textContent` 를 써도
«자리»로 짝을 맞추면 똑같이 속는다.** 그래서 **구조에 안 흔들리는** 측정으로 바꿨다:
고정 상자 10개(`#plate`·`#tabs`·`#hud`·`#tabForge`·`#tabTower`·`#tabTech`·`#pop`·`#cmp`·
`#dice`·`#adwall`)의 `textContent` 와 «보이는 글자만» 둘을 **공백을 접지 않고** 통째로 견줬다.
두 빌드에 같은 고정 PRNG 를 심고(`Math.random` 교체) **250ms 루프를 멈춰**(`setInterval`
무력화) 웨이브·충전이 흐르지 않게 못박았다 — 안 그러면 실시간 드리프트가 차이로 잡힌다.

```
상태 14종 × 세이브 2벌 × 크기 3 = 84판 · 측정 10상자 × 2방식 + <title> + <html lang>
글자 차이 — 서로 다른 쌍 3종, 전부 같은 한 곳:
   #tabForge  "" ⇒ " "   (앞「…제련」 뒤「600…」)        ×27 (box)
   #tabForge  "" ⇒ " "   (보이는 글자만)                ×27
   #spin textContent  "제련600" ⇒ "제련 600"
자리 차이 — 0건  (제련 줄 y · 대기열 줄 y · #spin·#up·#autores·#msg·#asc 의 x·y·w·h ·
                  문서 가로 넘침 — 전부 동일)
콘솔 — 전 0건 / 후 0건
```

→ **지시서·판정 ⓑ 의 주장 그대로다**: ko 화면 글자 차이는 **「제련 600」 공백 한 칸뿐**이고,
그 한 곳은 **의도된 회귀 복구**다. **자리는 한 픽셀도 안 움직였다.**

#### ③ en — 한글 0자 · 금지어 0 · 키 노출 0

**소스 표에서 먼저**(정적): `ko` 153키 · `en` 153키 · **양쪽에만 있는 키 0** · 키 순서까지 동일.
en 값에 한글 음절 **0건**, 금지어(단어 경계) **0건**. ko 의 「릴」 5키는 전부
`item`/`per forge` 로 옮겨졌다(`ui.lockHint`·`ui.pityFull`·`asc.reels`·`asc.reels2`·`asc.confirmReels`).
리터럴 `t('키')` 106개와 `data-s` 가 전부 표에 있고, 접두사 조립(`part.`·`opt.`·`wt.`·`sp.`·
`tile.`·`tech.`)의 후보 수가 ko·en 에서 같다. 리터럴로 안 쓰이는 키는 `pop.asc` 하나인데
`t(POPS[k])` 로 풀린다 — **죽은 키 0**.

**화면에서**(런타임): 탭 셋 · 팝업 셋 · 비교 팝업 · 던전 · 주사위판 · 승천 가능 배너 ·
자동 정리 판정문 · 제련 판정문 등 **상태 14종 × 세이브 2벌(평범·승천 가능) × 크기 3
= 84판**, 보이는 글자 조각 **9,652개** + `title`·`aria-label`·`placeholder`·`alt` + `<title>`:

```
PASS  한글 음절 0자 — 0건
PASS  금지어 0 (단어 경계 · spin·slot·reel·jackpot·bet·gamble·lucky·casino·payout·win big) — 0건
PASS  표에서 빠진 키 노출 0 — 0건
PASS  문서 가로 넘침 0 — 0px
<html lang>=en · <title>="Hit Smith"   (부제가 en 에서 빠진 것 확인)
콘솔 0건
```

같은 측정을 ko 로도 돌려 **금지어 0 · 키 노출 0** 을 확인했다(한글은 당연히 나온다).

#### ④ checklist 를 두 언어로 — 둘 다 **122/0**, 그리고 무르게 한 곳이 **한 군데 있었다**

기기 배포본을 `--en` 과 기본(ko)으로 각각 완주시켰다: **ko 122/0 · en 122/0.**
두 판정문을 줄 단위로 대조했을 때 **다른 줄은 둘뿐**이고(3b·3b2 는 항목 «이름»에 풀린
문구가 박혀 있어 언어마다 다르게 찍히는 설계), 나머지 120 항목은 글자까지 같다.

항목 이름 집합을 9dbf474 와 대조: **122 = 122 · 신설 0 · 삭제 0 · 이름 정정 6**
(3b·3b2·6b·8b·8c·V2). 고친 자리를 하나씩 읽었다 — **다섯은 오히려 조여졌다**:

| 항목 | 전 | 후 |
|---|---|---|
| `3b`·`3b2` | 부분 문자열 포함 | **`t()` 결과와 완전 일치** |
| `6b` | `/가득/` 포함 | **`t('ui.queueFull')` 와 완전 일치** |
| `8c` | `/도달 필요\|현재 최고/` **OR** | 두 조각 **AND** |
| `V2` | `/근접\|원거리\|혼합/` | `t('foe.*')` 셋 중 하나를 **구절째로** 포함 |
| `6a`·`TB1`·`TB4`·`TB7`·`GR1` | 한국어 박음 | 표에서 풀어 비교(강도 같음) |

⚠ **한 곳은 정말로 물러졌다 — `5c`.** `includes('전투력')` 이
`includes(t('ui.power')) || #cstat.textContent.length > 0` 로 바뀌었는데, 뒤쪽 갈래는
**글자가 무엇이든 비어 있지만 않으면 통과**시킨다. 첫 갈래만으로 두 언어 다 통과하는
것을 실측하고(ko `#cstat`=「전투력 7 · 웨이브 1 · 0」 / en 「Power 7 · Wave 1 · 0」)
**`||` 를 걷어내고 항목 이름대로 `t('ui.power')`·`t('ui.wave')` 둘을 다 보게 조였다.**
조인 뒤 두 언어 124/0.

#### ⑤ en 최악 `#msg` — 800×450·821×462 에서 **한 줄**

판정 ⓐ 가 적은 대로 **상자 밖의 떠 있는 span**(`position:absolute`·`nowrap`·`#msg` 와
같은 계산 글꼴)으로 실제 필요 폭을 쟀다. 최악 부위 이름을 여섯 중에서 재서 골랐다
(ko 「무기」 / en 「Greaves」), 등급 15 · 세부등급 VIII · 골드 아이콘 포함.

| 문구 | ko 필요폭 | en 필요폭 |
|---|---|---|
| ◆ N연 정렬 | 166.0px | 213.8px |
| ▣ 임계압 정렬 | 183.4px | 235.8px |
| 자동 판매 | 202.7px | 234.8px |
| **자동 정리(장착+판매)** | **354.1px** | **390.9px** |
| 자동 정리(판매) | 230.1px | 234.1px |
| 대기 가득 안내 | 172.7px | 185.4px |

칸 폭: 380×820 **328.0px** · 800×450 **406.4px** · 821×462 **418.1px** · 1216×684 585.6px.

→ **800×450(406.4px)·821×462(418.1px)에서 en 최악 390.9px 는 한 줄**이다 ✅
→ **380×820(328px)에서는 ko 354.1px · en 390.9px 둘 다 두 줄**이다 — 034 제안 ⑸ 가 적은
그대로이고 **034 가 만든 것이 아니다**(ko 도 넘친다). 내 수치가 보고의 363/397px 보다
9px 가량 작은 것은 골드 값이 달라서다 — 결론은 같다.

#### ⑥ 변이 셋 — 전부 한 항목씩만, 그리고 내 새 검사가 그것을 문다

| 변이 | md5 | 결과 |
|---|---|---|
| ㉠ **en 표에서 `ui.sortQueue` 한 키 삭제** | `196fb029…` | **`I18N1` 만 FAIL** — `en 키 노출 8종: … span#spinq 「ui.sortQueue」`. 나머지 123 그대로. ⚠ **ko run 에서 울었다** — `I18N1` 이 `--en` 과 무관하게 자기 창을 en 으로 열기 때문이다 |
| ㉡ **en `ui.queueFull` 에 한글을 남김** | `ebfdbb7d…` | **`I18N1` 만 FAIL** — `en 화면에 한글 16종: … #msg 「대기 가득 — 정리해야 계속 제련」`. 나머지 123 그대로 |
| ㉢ **「제련 600」 공백을 다시 지움**(033 회귀 재현) | `d7262f60…` | **`SPC1` 만 FAIL** — 9크기 × 2단정 = 18건. 나머지 123 그대로 |

#### ⑦ 제안 ⑥ 을 검사로 세웠다 — `SPC1` (글자는 `textContent`, 자리는 좌표, **따로**)

checklist **122 → 124** (신설 **2** · 삭제 0 · `5c` 조임 1).

- **`SPC1`** — `#spin` 의 글자와 자리를 **두 측정으로 따로** 본다. 9크기 전부에서:
  ⑴ **글자**: `textContent` 가 `t('ui.forge')` + **공백 문자** + 숫자인가, `#spinlbl` 이
     공백으로 끝나는가. ⑵ **자리**: `#spinlbl` 오른끝과 `#chg` 왼끝 사이 **간격 > 0**,
     대기열 줄이 제련 줄 **아래**인가. 라벨 말은 표가 정하므로 두 언어 공용이다.
  · ㉢ 변이의 판정문이 이 검사의 존재 이유를 그대로 보여 준다:
    **「제련600」인데 간격은 7px 그대로**다. 즉 **자리 쪽은 통과하고 글자 쪽만 운다** —
    둘을 합쳐 재면(`innerText`) 이 회귀는 또 통과한다. 실제로 그 변이에서 Playwright 의
    `innerText` 는 「제련⏎600」을 돌려줘 공백처럼 보인다.
  · ⚠ 주석에 **「`innerText` 로 바꾸면 이 검사는 그 자리에서 공허해진다」**를 못박았다.
- **`I18N1`** — 034 제안 ① 도 함께 닫았다. 상태 12종 × 크기 2 × **두 언어**에서 en 한글 0 ·
  금지어 0(단어 경계) · **표에서 빠진 키 노출 0**(토큰 단위), ko 에서는 금지어·키 노출만.
  `--en` 여부와 무관하게 **자기 창을 en 으로 연다** — 그래야 `--en` 을 잊어도 en 보증이
  지켜진다. 이 검사가 성립하는 근거는 `t()` 가 **모르는 키를 키 이름 그대로 돌려주는**
  것이므로, 주석에 「빈칸으로 삼키게 고치면 이 검사가 죽는다」를 적었다.

#### ⑧ 대조표 — 바뀐 **13키 표시 / 실제로 달라진 12키**, 판정 ⓒ 와 일치

두 대조표(§④ 와 판정 반영 후)를 **문서에서 파싱해 기계로** 견줬다:

- 둘 다 **153키**, 「바뀜」 표시 **13개**.
- **en 값이 실제로 달라진 키는 12개**이고 **전부 「바뀜」으로 표시돼 있다**. 표시했는데
  값이 같은 키는 **`up.next3` 하나**다 — 판정 ⓒ 가 `up.next`·`up.next2`·`up.next3` 를 한 줄에
  묶어 적었고 `up.next3` 는 원래도 빈 문자열이어서 고칠 것이 없었다. **과잉 표시 1건**이고
  누락은 0건이다.
- 12키 = 판정 ⓒ 의 일곱 갈래(`asc.reels`·`asc.reels2`·`asc.confirmReels`·`asc.capAll`·
  `up.capAll`·`up.next`·`up.next2`·`cmp.close`·`sp.pierce.d` = 9키) + 판정 ⓐ 의
  `msg.sorted.equip`·`msg.sorted.sold`·`msg.sorted.sell` 3키. **빠진 갈래 없음.**
- **대조표가 소스와 일치한다**: 153키 × 두 언어 전부, 소스 표의 값과 문서의 값이
  **차이 0** (`⏎` 치환·여백 정규화 후). 「표에서 자동으로 뽑았다」가 사실이다.
- 조립해 읽어 봤다 — `Forge Lv 7 opens Grade 6` · `All grades open · Ascend at Forge Lv 28` ·
  `Ascend ★2 — stats ×16.0 · stat cap ×2.2 · 4 per forge` · `Sorted: kept … · sold … `.
  판정 ⓒ 가 의도한 대로 읽힌다.

## 제안 (구현하지 말고 여기에 적을 것)

1. **`docs/DESIGN.md` 가 034 를 모른다** — 8,479 B 바이트 그대로다. 034 는 지시서가
   DESIGN.md 를 요구하지 않았지만, 「화면 글자는 표 하나에 있다 · 언어는 기기가 정한다 ·
   설정 화면은 없다」는 **설계 사실**이고 수동 체크리스트도 어느 언어로 하는지 안 적혀
   있다. 한 절과 한 줄이면 된다.
2. **034 제안 ⑦(`navigator.language` 경로)은 그대로 열려 있다.** 검사는 늘 `?lang=` 으로
   연다 — `I18N1` 도 그렇다. 진짜 제품 경로는 기기 언어이고, Playwright `locale` 로
   「ko-KR → ko · fr-FR → en」을 한 번 보는 단정이 아직 없다. `I18N1` 의 창 여는 자리에
   `locale` 만 더하면 되는 자리라 값이 싸다.
3. **`up.next3` 가 빈 문자열인 채 표에 남아 있다.** en·ko 둘 다 비어 있고(ko 는 「 개방」),
   en 조립문이 `Forge Lv 7 opens Grade 6` 로 끝나므로 지금은 맞다. 다만 **빈 값 키는
   `I18N1` 의 키 노출 검사가 볼 수 없는 자리**다(빈 글자는 글자 조각이 안 된다).
4. **`t()` 의 자리표 치환이 `{0}`~`{9}` 한 자리뿐이다**(`/\{(\d)\}/`). 지금 쓰는 최대가
   `{4}`(`asc.confirm`)라 문제가 없지만, 열 번째 자리표를 쓰면 **조용히** 안 치환된다.
5. **034 제안 ⑤(380×820 에서 자동 정리 문구가 ko·en 둘 다 두 줄)은 그대로 열려 있다.**
   내 실측으로도 ko 354.1px · en 390.9px vs 칸 328px 다. `#msg` 가 `height:18px` 라
   둘째 줄이 아래 칸을 밀고 들어간다 — **이 자리를 보는 검사는 아직 없다**(⑤ 의 표는
   검증 세션의 임시 계측이다). 떠 있는 span 으로 재는 그 방법이 그대로 항목이 된다.
6. **034 제안 ③(`Sort now (2)`·`Stoke the forge — full charge + speed` 가 가장 긴 말)**
   도 열려 있다. 아홉 크기 전부 통과하지만 여유가 크지 않다.
7. **「구조만 바뀐 회귀」를 보는 눈이 하나 더 필요하다.** 034 제안 ⑥ 은 「글자와 자리를
   따로」였고 `SPC1` 로 닫았는데, 이번에 **그 반대 함정**도 밟았다 — `textContent` 를
   써도 **형제 index 로 짝을 맞추면** `data-s` 래퍼 13개가 전부 「차이」로 잡힌다.
   화면 글자 대조는 **고정 상자의 `textContent` 를 통째로** 견주는 쪽이 맞다(요소 짝짓기 금지).
   규칙으로 올릴 만하다.
8. **빌드를 계속 커밋해라.** 이번에도 9dbf474 덕에 「CORE 변경이 넷뿐」을 바이트로 닫았다.
   다만 검증 세션에 `device_bash` 가 없어 `.git` 느슨한 개체를 손으로 풀어야 했다
   (커밋→트리→블롭, 스테이징 네 번). 기기 셸이 있으면 `git show` 한 줄이다.
