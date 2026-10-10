# 037 — GameDistribution 출시 (B 경로) · 무거운 변경(광고/플랫폼) · 담당: 사용자(0단계) → 코딩 → 검증

상태: **구현 완료 — 검증 대기** (코딩 세션, 2026-10-09) — `src/forge.html` **락 해제**. (0단계 완료 2026-10-08 · 사용자 판정: **037 먼저, 040 은 그 뒤**.)
빌드 기준: 034 검증 통과본 `9f805e49…` (커밋 18ec052). 게임에 소리가 없으므로 「광고 중 음소거」는 지금 해당 없음 — 040 이 GD 광고 정지 때 소리 0 을 맡는다.

## 왜

CrazyGames 가 품질로 반려했다(028, 2026-10-08). 같은 빌드를 **심사 문턱이 낮은 개방형 포털**에 올려
「운영 없는 광고 수익」 경로에 먼저 올려 둔다. 동시에 A 경로(038)로 품질 기준을 파악한다.

GameDistribution(Azerion) 요약 — ⚠ 수익 배분은 **제3자 보고서 수치**(공식 확인 아님):
- 개방형 제출, 영어 필수, 반응형 iframe. 심사 최대 약 3주. 중복·IP 위반은 반려.
- 광고: **프리롤·미드롤 필수**, 보상형 선택. 개발자 몫 약 33%, 최소 지급 €100.
- SDK 규칙(공식 위키): 광고는 **사용자 입력(클릭) 직후에만, 게임플레이 밖에서만**. 광고 중 게임 정지·소리 끔.
  SDK 는 **게임 로드 때 한 번** 싣는다(버튼 클릭 때 싣지 말 것). 빈도 제한은 SDK 가 한다.
  보상은 `SDK_REWARDED_WATCH_COMPLETE` 이벤트에서만 준다(`showAd` 의 then/catch 에서 주지 말 것).

## 0단계 — 사용자

1. gamedistribution.com 개발자 가입 → **새 게임 등록**(Hit Smith, HTML5).
2. 게임의 Upload 탭에서 **Game ID** 를 복사해 계획 세션에 붙여 넣는다 → ✔ 완료: `0ac9b15c90f241d2a672c48aebc1078e` (EDIT: 1280×720 · 데스크톱+모바일 · No Blood · HTTPS Ready).
3. 게임 설정에서 **Rewarded ads 플래그를 켠다**(공식 위키: 안 켜면 보상형 광고 요청 자체가 안 된다).
   ⚠ **실측(2026-10-08): 게임 등록 화면에서 이 칸이 비활성이다.** 오른쪽 상태 카드가 `SDK: No` 라 —
   SDK 가 연결된 빌드를 올려 `SDK: Yes` 가 된 **뒤에** 켜지는 것으로 보인다(추정). → 업로드 뒤에 켠다(아래 「업로드」 3번).
   그래서 코드는 **플래그가 꺼진 상태로 첫 업로드**되는 것을 전제한다 — ②-b.

## 변경할 것

### ① PLAT 에 GameDistribution 백엔드 추가

- 상수 셋: `GD_SDK='https://html5.api.gamedistribution.com/main.min.js'`, `GD_ID='0ac9b15c90f241d2a672c48aebc1078e'`,
  `GD_HOSTS=['gamedistribution.com']`(하위 도메인 포함 — `CG_HOSTS` 와 같은 판정식).
  ✔ **실측(2026-10-08, 포털 Upload 탭)**: 업로드한 빌드의 시험 주소는
  `https://revision.gamedistribution.com/0ac9b15c90f241d2a672c48aebc1078e/?correlator=…` — 호스트 `revision.gamedistribution.com`.
  이 판정식이 덮는다. 배포본 호스트(승인 뒤)는 아직 모른다 — 업로드 뒤 미리보기 콘솔에서 `location.hostname` 을 「구현 결과」에 적는다.
- **싣는 조건**: GD 호스트이거나 `?gd=1`. 그 밖(Pages·로컬·CrazyGames)에서는 **외부 요청 0 그대로.**
  CG 판정과 GD 판정은 서로 배타 — 둘 다 해당하면 CG 우선(일어날 일은 없지만 순서를 못박는다).
- `window.GD_OPTIONS={gameId:GD_ID, onEvent(e){…}}` 를 스크립트 삽입 **전에** 둔다.
- `onEvent` 처리:
  - `SDK_GAME_PAUSE` → `PLAT.paused=true; adWall(true); platSync()`
  - `SDK_GAME_START` → `PLAT.paused=false; adWall(false); platSync(); __canvasWake(600)`
  - `SDK_REWARDED_WATCH_COMPLETE` → 진행 중인 보상 요청에 「완주」 표시
  - 준비 신호: **SDK 문서의 준비 이벤트를 확인해서** 쓴다(이름을 추측해 박지 말 것). 받으면
    `PLAT.ready=true; PLAT.env='gamedistribution'; PLAT.adsOn=true; renderFast()`.
    문서에서 못 찾으면 「구현 결과」에 적고 `gdsdk.preloadAd('rewarded')` 성공을 준비로 본다.
- `PLAT.adsOn` 은 GD 에서 **`ADS_LIVE` 와 무관하게 true** 다. `ADS_LIVE` 는 CrazyGames 전용 상수로 남기고 **건드리지 않는다.**
- 스크립트 `onerror` → `PLAT.blocked=true` (차단기여도 게임은 그대로 — CG 와 같은 원칙).

### ② `PLAT.rewarded()` 의 GD 분기

- `gdsdk.showAd('rewarded')`. 결과는 **요청 시작 이후 `SDK_REWARDED_WATCH_COMPLETE` 가 왔는가** 하나로 정한다.
  promise 의 then/catch 는 「끝났다」만 알리고 보상 판단에 쓰지 않는다.
- 기존 반환 계약 그대로: 끝까지 본 경우만 `true`. 기존 `end()`·90초 보루·`ads/done/failed` 카운터를 그대로 쓴다.
- 기존 상한(`AD_COOL`·`AD_DAY`·`DAD_COOL`)과 보상 내용은 **바꾸지 않는다.**

### ②-b 보상형 버튼은 **보상형이 실제로 준비됐을 때만** 보인다 (GD)

- GD 에서 `#ad`·`#dad` 의 존재 조건은 `PLAT.adsOn` 이 아니라 `PLAT.rewardOn` 이다:
  `gdsdk.preloadAd('rewarded')` 가 **성공한 뒤에만** true. 실패하면 false 로 두고 5분 뒤 한 번 다시 시도.
- 이유: 포털 플래그가 꺼진 첫 업로드에서는 보상형 요청이 전부 실패한다. 그때 버튼이 보이면
  「누르면 매번 실패」 — 026 이 「눌리는데 아무 일도 안 나는 버튼은 최악의 첫인상」이라 막은 바로 그것이다.
- 미드롤·프리롤(`PLAT.adsOn`)은 이것과 무관하게 돈다. CrazyGames 경로는 지금처럼 `adsOn` 하나로 둔다(`rewardOn=adsOn`).
- 검사 G6: 가짜 SDK 에서 preload 실패 → `#ad` 요소 숨김, 성공 → 보임. **변이**: preload 결과를 무시하는 빌드 → G6 이 운다.

### ③ `PLAT.midroll()` 신설 — GD 전용(CG·Pages 에서는 즉시 끝나는 무동작)

- `gdsdk.showAd()`(전면 광고). **보상 없음.** 반환은 Promise(끝나면 resolve, 실패도 resolve).
- 부르는 자리 — 둘 다 **클릭 처리기 안, 게임 처리를 먼저 끝낸 뒤**:
  - `#ascGo`(승천한다) — 승천 처리 직후.
  - `#tower`(도전) — 도전 결과가 화면에 나온 직후.
- 자체 하한 간격 `MID_COOL=3*60*1000`(SDK 제한과 별개로 둔다 — 같은 버튼 연타로 광고 연쇄 방지).
- 미드롤 중에도 정지는 ①의 `SDK_GAME_PAUSE/START` 가 맡는다.

### ④ 프리롤 — GD 환경에서만 시작 화면 `#gdStart`

- GD 규칙은 「광고는 사용자 입력 직후」다. 그래서 **GD 환경에서만** 첫 화면 위에 막 하나:
  제목 「Hit Smith」 + 버튼 「Play」(글자는 `t()` — ko/en). 누르면 `PLAT.midroll()` → 끝나면 막을 걷는다.
- **CrazyGames·Pages·로컬에서는 이 요소가 아예 없다**(CG 요건 「바로 게임플레이」 유지).
- 한 세션(페이지 로드)에 한 번. 막이 떠 있는 동안 틱은 돌아도 되지만 입력은 막에만 간다.
- SDK 가 안 실렸거나(차단기) 준비 신호가 3초 안에 안 오면 버튼은 광고 없이 바로 막을 걷는다.

### ⑤ 광고 실패 한 줄 (029 에서 앞당김 — 두 환경 공통)

- 보상형 광고가 `false` 로 끝나면 `#msg` 에 한 줄: ko 「광고를 불러오지 못했어요 — 잠시 뒤 다시」 /
  en 「Couldn't load an ad — try again shortly」. 새 팝업 금지.
- `STR` 표에 키 둘(ko/en)을 더하는 것은 허용한다. 그 밖의 CORE 는 금지.

### ⑥ 검증 창구

- `__view.plat` 에 `env:'gamedistribution'`, `mids`(미드롤 요청 수), `midDone` 을 더한다.

## 바꾸지 말 것

- **CORE** — ⑤의 `STR` 키 추가 말고 한 줄도. `days.js` 기본 출력 md5 `81a6288…` 바이트 동일.
- CrazyGames 경로 전부: `CG_HOSTS`·`ADS_LIVE=false`·`platInit` 의 CG 분기 동작. `?cg=1` 동작이 이전과 같아야 한다.
- Pages·로컬에서 **외부 요청 0**(022 배포 확인 항목).
- 보상 상한·보상 내용(026 §4), 026 의 막(`#adwall`)·정지 세 겹, 030~034 배치·글자.

## 완료 조건

- smoke 전 항목 · self-check 0 · `node --check` · checklist 전 항목 · soak 0 · `days.js` md5 동일.
- **효과로 재는 검사**(CLAUDE.md 「깃발은 원인이지 효과가 아니다」):
  - G1 `?gd=1`(가짜 SDK 주입 하네스 허용): `SDK_GAME_PAUSE` 동안 `#spin` 을 눌러도 **대기열이 안 는다**, 충전이 안 오른다.
  - G2 보상: `SDK_REWARDED_WATCH_COMPLETE` 없이 promise 만 resolve → **보상 0**. 이벤트 후 → 보상 1.
    **변이**: then 에서 보상을 주는 빌드 → G2 가 운다.
  - G3 미드롤: `#ascGo`·`#tower` 처리 결과가 광고 유무와 무관하게 같다(광고가 게임 처리를 막거나 바꾸지 않는다). 미드롤 보상 0. `MID_COOL` 안의 두 번째 클릭 → 광고 요청 0.
  - G4 `#gdStart` 는 GD 환경에서만 존재. Pages·`?cg=1` 에서 **요소 0개**. 차단기 상황(스크립트 실패)에서 버튼 한 번에 게임 진입.
  - G5 Pages(쿼리 없음) 네트워크 외부 요청 0, `?cg=1` 경로 026 검사 AD1~AD6 그대로 PASS.
- `TB8` 35칸·`AD6`·`LG1`·`LG2` 그대로 PASS.
- 「구현 결과」에 준비 이벤트 이름과 그 근거(문서 위치)를 적는다.

## 업로드 (검증 통과 = 커밋 뒤, 사용자)

GD 는 zip 을 받는다(✔ 포털 확인: 「.zip, 루트에 유효한 index.html」, 한도 500MB). 포털 문구: **SDK 가 구현되지 않으면 목록에 오르지도 배포되지도 않는다** — SDK 없는 지금 빌드를 올려 두는 것은 의미가 없다. 028 §1 명령으로 `upload\index.html` → `Compress-Archive` → zip.
md5 는 037 통과 커밋의 값. 포털 Upload 탭에 zip → 미리보기에서 **광고를 끝까지 한 번 본다**(GD 안내) →
F12 게임 프레임 콘솔 `__view.plat.env==='gamedistribution'` → 상태 카드가 `SDK: Yes` 로 바뀌었는지 → **EDIT 탭에서 Rewarded Ads 체크**(이때 켜지는지 확인, 안 켜지면 GD Support 문의) → 다시 미리보기에서 `__view.plat.rewardOn===true` →
**출시 관문(`docs/RELEASE-GATE.md`)** — 시험 주소에서 평가자 다섯 + 첫 사용이므로 18ec052 교정 회차. GD 범위: 첫 1분 블로커와 P2 반려 사유만 고친다 → 통과 뒤 **Request Activation**.
썸네일: `submission/gd/thumb-512x512.png`·`thumb-512x384.png`·`thumb-200x120.png`(계획 세션 작성).
설명·조작 문구는 028 §2 영어 그대로.

## 구현 결과 · 제안 · 검증 기록
- (각 세션이 기록 — **쓰기 직전에 파일을 다시 읽고 자기 절만 덧붙일 것**)

### 구현 결과 (코딩 세션 · 2026-10-09)

빌드 md5 **`254ce2b2e8744f55e710a61abb652577`** · `src/forge.html` 263,990 → **274,311 B**.
`devtools/checklist.js` 226,645 → 227,049 B.
CORE 첫 절 30,711 → **30,893 B** — 늘어난 182 B 는 **⑤의 `STR` 키 넷(ko·en 각 둘)과 그 자리뿐**이다.
**CORE 자체 점검 절 7,851 B 바이트 동일** · `node tools/days.js` md5 **`81a6288…` 그대로**.

#### 준비 이벤트 — **`SDK_READY`** (추측 아님, 문서 확인)

공식 위키 [GD-HTML5 / SDK Implementation](https://github.com/GameDistribution/GD-HTML5/wiki/SDK-Implementation)
의 **SDK Events 표**에 `SDK_READY` 가 있고 설명이 「When the SDK is ready.」다.
같은 표에 `SDK_ERROR`·`SDK_GAME_START`(「When the game should start.」)·`SDK_GAME_PAUSE`·
`SDK_GDPR_*` 가 함께 있다. ⚠ **`SDK_REWARDED_WATCH_COMPLETE` 는 그 표에 없고** 위키의
구현 스니펫 `switch` 문에만 나온다 — 그래서 「표에 없다」를 「없는 이벤트」로 읽으면 안 된다.

[Rewarded Ads 위키](https://github.com/GameDistribution/GD-HTML5/wiki/Rewarded-Ads) 에서 확인한 것:
- `gdsdk.preloadAd('rewarded')` → then = 보여 줄 수 있다 / catch = **보상형 광고가 없다**.
- `gdsdk.showAd('rewarded')` 의 **reject 에 대해 「Please don't give reward here.」** 라고 못박혀 있고,
  resolve 도 「광고 절차가 끝났다」일 뿐 보상을 뜻하지 않는다. 보상은 `SDK_REWARDED_WATCH_COMPLETE`
  에서만 준다(「you can give reward there」).
- 포털의 Rewarded 플래그가 꺼져 있으면 「your game is unable to request rewarded ads」.
  → ②-b(버튼의 존재 조건을 `rewardOn` 으로)가 이 문장 때문에 필요하다.
- 전면(미드롤·프리롤)은 **인자 없는 `gdsdk.showAd()`**.

**배포본 호스트는 아직 모른다.** 지금 코드가 덮는 것은 `gamedistribution.com` 과 그 하위
도메인(= 포털이 알려 준 `revision.gamedistribution.com`)과 `?gd=1` 이다. 업로드 뒤
미리보기 콘솔에서 `location.hostname` 을 확인해 이 절에 덧붙일 것.

#### 검사 G1~G6 — **전부 효과로 쟀다** (깃발 아님)

| | 잰 것 | 결과 |
|---|---|---|
| **G1** | 광고 중 `#spin` 좌표를 **진짜 마우스로** 눌렀을 때 대기열·충전·프레임 | 0→0 · 300.29→300.29 · 36→36, 좌표 맨 위 «adwall» |
| **G1b** | 광고가 끝난 뒤 | 막 none · 프레임 36→73 |
| **G2** | `SDK_REWARDED_WATCH_COMPLETE` **없이** promise 만 resolve | 충전 +0.2 · 배속 false · 하루횟수 0 · failed 1 |
| **G2** | 이벤트 **있음** | 충전 +595 · 배속 true · 하루횟수 1 · done 1 |
| **G2b** | 실패 뒤 `#msg` (⑤) | 「Couldn't load an ad — try again shortly」 |
| **G3** | 도전이 그대로 돌았는가 | 층 0→58 · 티켓 1장 소모 |
| **G3b** | 미드롤 보상 | 골드·별가루·토큰 무변화 · 보상완주 0 |
| **G3c** | `MID_COOL` 안의 두 번째 클릭 | mids 1→1 · SDK 전면요청 1회 |
| **G3d** | 같은 조작을 **광고 없는 판**에서 | 티켓 1장·골드 무변화·미드롤 0회 — GD 판과 결과 동일 |
| **G4** | `#gdStart` 개수 | Pages 0 · `?cg=1` 0 · `?gd=1` 1 |
| **G4d** | 차단기(스크립트 실패) | 막은 뜨고 **한 번 눌러** 진입 |
| **G5** | Pages 외부 요청 | **0건** |
| **G6** | preload 실패 → `#ad` | `display:none` · rewardOn false (adsOn 은 true) |
| **G6** | preload 성공 → `#ad` | `display:flex` · rewardOn true |

**변이 둘, 둘 다 물었다.**
- ㉮ `showAd` 의 then 에서 보상을 주는 빌드 → **G2 가 FAIL**(이벤트 없이도 보상이 나갔다).
- ㉯ preload 결과를 무시하고 `rewardOn=true` 로 켜는 빌드 → **G6 이 FAIL**(실패인데 버튼이 보였다).

#### 완료 조건 대조

| 항목 | 결과 |
|---|---|
| smoke | **19/19** |
| 자체 점검·콘솔 | **0건** |
| `node --check` | OK |
| soak (5분·380px) | **누수 없음** · 콘솔 0 |
| checklist 전 항목 | ko **124 통과·0 실패** / en **124 통과·0 실패** |
| `days.js` md5 | **`81a6288…` 동일** |
| `TB8` · `LG1` · `LG2` · `GR1` | 전부 PASS (TB8 43칸 + 이름 붙인 예외 2칸) |
| `AD1`~`AD6` | **전부 PASS** (`?cg=1` 경로 불변) |
| 화면 | `docs/ref/037-gdstart-{ko,en}-{380x820,821x462}.png` |

#### checklist 에 손댄 곳 (삭제 0 · 신설 0)

`AD2`·`AD3` 와 4a 가 「광고가 켜진 환경」을 `PLAT.adsOn=true` 하나로 흉내내고 있었다.
②-b 로 **보상형 버튼의 문이 `rewardOn`** 이 됐으므로 그 줄만으로는 버튼이 안 열려
**검사가 공허하게 통과**한다(실제로 AD3 이 그렇게 한 번 울었다). 세 자리에
`PLAT.rewardOn=true` 를 함께 세웠다 — 무르게 한 것이 아니라 흉내를 진짜에 맞춘 것이다.

#### 밟은 자리 (다음 세션이 또 밟지 않게)

1. **`el.click()` 은 `#adwall` 을 그냥 통과한다** — 히트 테스트를 안 하기 때문이다.
   G1 을 그렇게 재면 「막이 안 막는다」는 거짓 FAIL 이 난다. 026 의 `AD6` 이 좌표
   클릭을 쓰는 이유가 이것이고, G1 도 좌표 클릭으로 고쳤다.
2. **전투 틱이 도는 동안에는 골드로 「보상 0」을 못 잰다** — 웨이브 보상이 저절로 들어온다.
   G3b 는 재는 동안만 틱을 멈추고 쟀다.
3. `#gdStart` 는 **SDK 와 무관하게** GD 판정 즉시 뜬다. 스크립트 로드를 기다렸다가
   띄우면 차단기 환경에서 영영 안 뜬다(G4d 가 그 자리를 본다).

### 제안 (구현하지 말고 여기에 적을 것)

1. **미드롤이 실제로 돌았는지 보는 눈이 포털 밖에는 없다.** G3 은 가짜 SDK 로 잰 것이라
   「우리 쪽 계약」만 증명한다. 업로드 뒤 미리보기에서 `__view.plat.mids`·`midDone` 을
   한 번 읽어 실물과 맞는지 대조할 것(업로드 절차에 한 줄 추가).
2. **`MID_COOL` 3분은 추측값이다.** GD 가 자체 빈도 제한을 갖고 있어 겹친다 — 실제 노출
   간격을 미리보기에서 재 보고 1.0 이후에 조정할 것. 지금은 「연타로 광고 연쇄」만 막는다.
3. **프리롤이 한 세션에 한 번이라는 것을 지키는 검사가 없다.** `#gdStart` 가 걷힌 뒤에는
   다시 안 뜨지만(요소를 지운다), 「새로고침 없이 두 번 뜨지 않는다」를 못으로 박을 것.
4. **`SDK_GAME_PAUSE` 가 광고 밖에서도 올 수 있다**(GDPR 창 등). 지금은 그때도 막이 뜨고
   틱이 멈춘다 — 그게 맞는 동작이지만, 오래 멈춰 있는 경우의 안전장치(예: 90초 보루)가
   보상형·미드롤 안에만 있고 **이벤트 경로에는 없다.** 한 번 볼 것.

### 검증 기록 (검증 세션 · 2026-10-09) — **판정: 통과**

빌드 `src/forge.html` md5 **`254ce2b2e8744f55e710a61abb652577`** (274,311 B) · `devtools/checklist.js` `cbd24a4a…` (227,049 B).
기준 18ec052 = `9f805e49…` (263,990 B) — 깃 개체에서 직접 풀어 비교.
얼린 사본(읽기 전용)으로만 쟀고 md5 를 처음·중간·끝에 확인 — 세 번 같다. 게임 파일·checklist 에 쓴 것 0.
**판정 직전 장치 수정 시각 재확인**: `src/forge.html` mtime `1791504789050`(= 2026-10-09 00:13:09 UTC, 세션 시작 때와 같음, md5 같음) ·
이 지시서 `1791507126523`(00:52:06 UTC, 세션 내내 같음) → 다시 읽은 뒤 이 절만 덧붙임.

#### 1) CORE 대조 — PASS

- 18ec052 대비 CORE 첫 절의 차이는 **`STR` 항목 넷뿐**(ko·en 각 둘):
  - `ad.failed` — ⑤ 광고 실패 한 줄 (`#msg`). ko 「광고를 불러오지 못했어요 — 잠시 뒤 다시」 / en 「Couldn't load an ad — try again shortly」.
  - `gd.play` — ④ `#gdStart` 버튼 글자. ko 「시작하기」 / en 「Play」.
- 늘어난 바이트 **+182 B** — 구현 결과와 같다. (절대값은 내 경계 기준 30,505 → 30,687 B 로 구현 결과의 30,711 → 30,893 과 206 B 다르다 — 배너 줄을 넣느냐의 경계 차이이고 증분은 일치.)
- **CORE 자체 점검 절 바이트 동일**(md5 `69af180d…` 두 빌드 같음).
- `node tools/days.js` 완주 후 md5 **`81a6288ee480f80cc9a6c014de4e1826`** — 같음.
- 기본: smoke **19/0** · `node --check` OK · 자체 점검 0 · checklist ko **124/0** · en **124/0** · soak 누수 없음·콘솔 0.
  TB8 PASS — **43칸 + 이름 붙인 예외 2칸**(완료 조건의 「35칸」은 옛 수치. 칸 수는 구현 결과 표기와 같다).

#### 2) G1~G6 독립 재현 — 14/14 + G3e PASS (자체 하네스, 가짜 GD SDK)

가짜 SDK 는 **`html5.api.gamedistribution.com/main.min.js` 요청을 가로채 응답**하는 방식 — 페이지가 `GD_OPTIONS` 를 먼저 두고
스크립트를 실제로 삽입하는 배선까지 함께 탄다(전역을 미리 박아 넣지 않았다).

| | 잰 것 | 결과 |
|---|---|---|
| G1 | `SDK_GAME_PAUSE` 중 `#spin` **좌표 클릭**(page.mouse) | 바닥 1.2초 충전 +0.21·프레임 +25 → 광고 중 충전 +0·프레임 +0·대기열 +0 · 좌표 맨 위 «adwall» |
| G1b | `SDK_GAME_START` 뒤 | 막 none · 프레임 59→90 |
| G2 | 이벤트 없이 `showAd` resolve | 충전 +0.2/600(틱분) · 배속 false · 하루횟수 +0 · failed 0→1 |
| G2 | `SDK_REWARDED_WATCH_COMPLETE` 뒤 resolve | 충전 +595 · 배속 true · 하루횟수 +1 · done 0→1 |
| G2b | 실패 뒤 `#msg` | 「Couldn't load an ad — try again shortly」 |
| G3 | `#tower` 결과 — GD 판 vs Pages 판(같은 세이브·7등급 장비) | 오른 층 37 vs 37 · 최고 37 vs 37 · 티켓 1 vs 1 · 문구 같음 |
| G3b | 미드롤 보상 — **틱을 멈춘 채** | 골드 1055→1055 · 별가루 0→0 · rewardHit 없음 |
| G3c | `MID_COOL` 안 두 번째 클릭 | mids 1→1 · SDK `showAd()` 호출 1→1 |
| G3e | `#ascGo` — 두 판의 승천 직후 상태 | 글자까지 같다 · 미드롤 1회(GD) / 0회(Pages) |
| G4 | `#gdStart` 개수 | Pages 0 · `?cg=1` 0 · `?gd=1` 1 |
| G4d | 스크립트 실패(차단기) | 막 1개(blocked true·ready false) → **한 번 눌러** 0개 · `#spin` 보임 |
| G5 | Pages 외부 요청 | **0건** |
| G5b | GD SDK `<script>` | 1개 · 실제 실행 1회 · `preloadAd` 1회 (로드 때 한 번, 클릭 때 추가 삽입 없음 — 정적으로도 삽입 자리는 `gdInit` 한 곳) |
| G6 | preload 실패 / 성공 | `#ad`·`#dad` none / flex · rewardOn false / true · adsOn 둘 다 true |

#### 3) 변이 — 어느 검사가 우는가

| 변이 (md5 앞 8자) | 내 G 하네스 | checklist (124항) |
|---|---|---|
| ㉠ `showAd` then 에서 보상 (`2df7bafb`) | **G2(이벤트 없음)·G2b FAIL** | 124/0 — **안 운다** |
| ㉡ preload 결과 무시, rewardOn=true (`212a33e2`) | **G6(실패) FAIL** | 124/0 — **안 운다** |
| ㉢ `MID_COOL` 제거 (`c808e14b`) | **G3c FAIL** (mids 1→2·showAd 1→2) | 124/0 — **안 운다** |
| ㉣ `#gdStart` 를 모든 환경에 (`92e9236e`) | **G4 FAIL** (Pages 1·cg 1) | 115/9 — 막이 덮어서 **도달 검사가 운다**: R-주사위판·R-정리 팝업(3크기 각각) · TB2 · TB3 · TB7 |

⚠ **G1~G6 은 checklist 에 없다.** ㉠㉡㉢은 지금 저장소의 어떤 상설 검사로도 안 잡힌다 — 코딩 세션의 하네스와 이 세션의 하네스가
각각 임시로 잡았을 뿐이다. ㉣만 기존 도달 검사가 우연히(막이 버튼을 가려서) 잡는다. → 제안 ①.

#### 4) 구현이 고친 checklist 세 자리 — 여전히 문다

고친 곳은 정확히 셋: 9-블록(`9c`·`9c2` 가 쓰는 줄 — 지시서의 「4a」는 이 자리를 가리킨다. `4a` 라는 이름의 항목은 고정 토큰 검사로 무관) · `AD2` · `AD3`.
모두 `PLAT.rewardOn = true` 를 더한 것뿐이고 삭제·신설 0.

| 변이 | 결과 |
|---|---|
| ㉤ **026 원결함**: `#ad` 처리기가 `ok` 를 무시하고 충전을 가득 (`8487d869`) | checklist **122/2 — `AD2` · `AD5b` FAIL** (내 G2·G2b 도 FAIL). 고친 AD2 가 공허해지지 않았다. |
| ㉥ `rewardOn` 항상 true (`9bbf2bf4`) | checklist **121/3 — `AD1` · `9c2` · `TB8` FAIL** (내 G6 도 FAIL). AD2·AD3 은 스스로 rewardOn 을 켜므로 설계상 안 운다 — 이 변이는 AD1 이 맡는다. |

작은 흠(판정 영향 없음): 9-블록은 끝에서 `adsOn`·`rewarded` 만 되돌리고 **`rewardOn` 은 true 로 남긴다**. 510행 `page.reload()` 까지
몇 항목(9d~9g)이 「Pages 인데 rewardOn true」 상태에서 돈다. 지금 그 항목들은 광고 버튼을 보지 않아 결과에 영향 없음. → 제안 ③.

#### 5) CrazyGames 경로 회귀 — PASS

- checklist `AD1`~`AD6` 전부 PASS(ko·en). `AD5`·`AD5b` 가 `?cg=1` 경로.
- `?cg=1`(CG SDK 흉내) `__view.plat` — **같은 빌드 두 번 먼저**: 로드 뒤·광고 중·광고 뒤 세 시점 모두 흔들린 칸 0.
  18ec052 → 037 차이는 **새 키 셋뿐**(`rewardOn` true(=adsOn) · `mids` 0 · `midDone` 0). 기존 12키 값은 세 시점 모두 같다.
  광고 중 paused·adwall 두 빌드 같음 · `#gdStart` 0/0 · 콘솔 0.
- 외부 요청: Pages **0** · `?cg=1` 두 빌드 모두 `sdk.crazygames.com` 하나뿐(GD 호스트 요청 0).
- GD SDK 스크립트는 로드 때 한 번만 삽입(G5b).

#### 6) 화면 — 넘침 없음

380×820 · 1216×684 × ko·en: `#gdStart`(`?gd=1`) 제목·버튼, 광고 실패 문구(`#msg`) 모두 한 줄·잘림 0
(실패 문구 폭 380×820 에서 en 206px · ko 224px / 칸 328px, 1216×684 칸 586px). 버튼 글자 안에 들어감.
화면 8장(`{gdstart,adfail}-{ko,en}-{380x820,1216x684}`)은 대화로 전달 — 저장소에는 넣지 않았다.

#### 지나가며 본 것 (037 결함 아님 — 18ec052 `?cg=1` 에서도 같음)

광고가 켜진 판(GD 는 rewardOn true)의 **380×820 첫 화면에서 `#ad` 는 3%만 보이고 `#autores` 는 0%**(둘 다 `#focus` 스크롤 밖, top 510·554).
1216×684 는 둘 다 100%. TB8 은 광고 꺼진 판으로 재므로 이 자리를 못 본다. GD 는 모바일도 대상이므로 보상형 버튼이 첫 화면 밖이면 수익 경로가 약하다. → 제안 ②.

#### 제안 (구현하지 말 것)

1. **G1~G6 을 checklist 에 상설화**(가짜 SDK 라우트 방식). 지금은 ㉠ then 보상·㉡ preload 무시·㉢ MID_COOL 제거가 상설 검사 0개로 통과한다.
   023/026 처럼 「변이로 운다」를 확인한 뒤 넣을 것.
2. **TB8 의 광고-켜짐 판** 하나 추가 또는 판정: 380×820 에서 `#ad` 가 첫 화면 밖인 것을 허용 예외로 둘지, 배치를 손볼지(030~034 배치는 이번 범위 밖).
3. 9-블록 끝에서 `PLAT.rewardOn` 도 원래 값으로 되돌릴 것(한 줄 · 흉내가 다음 항목으로 새지 않게).
4. 구현 결과 제안 ③(프리롤 한 세션 한 번)·④(이벤트 경로 PAUSE 보루) 동의 — 둘 다 이번 하네스로도 못을 박지 않았다.
