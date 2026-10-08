# 037 — GameDistribution 출시 (B 경로) · 무거운 변경(광고/플랫폼) · 담당: 사용자(0단계) → 코딩 → 검증

상태: **대기 — 0단계(사용자: Game ID) 뒤 착수.** 착수하면 이 줄을 「진행 중」으로 바꾼다(락).
빌드 기준: 034 검증 통과본 `9f805e49…` (커밋 18ec052).

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
2. 게임의 Upload 탭에서 **Game ID** 를 복사해 계획 세션에 붙여 넣는다 → 계획 세션이 아래 `GD_ID` 칸을 채운다.
3. 게임 설정에서 **Rewarded ads 플래그를 켠다**(공식 위키: 안 켜면 보상형 광고 요청 자체가 안 된다).

## 변경할 것

### ① PLAT 에 GameDistribution 백엔드 추가

- 상수 셋: `GD_SDK='https://html5.api.gamedistribution.com/main.min.js'`, `GD_ID='(0단계 값)'`,
  `GD_HOSTS=['gamedistribution.com']`(하위 도메인 포함 — `CG_HOSTS` 와 같은 판정식).
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

GD 는 zip 을 받는다(Defold 안내 기준). 028 §1 명령으로 `upload\index.html` → `Compress-Archive` → zip.
md5 는 037 통과 커밋의 값. 포털 Upload 탭에 zip → 미리보기에서 **광고를 끝까지 한 번 본다**(GD 안내) →
F12 게임 프레임 콘솔 `__view.plat.env==='gamedistribution'` → **Request Activation**.
썸네일: `submission/gd/thumb-512x512.png`·`thumb-512x384.png`·`thumb-200x120.png`(계획 세션 작성).
설명·조작 문구는 028 §2 영어 그대로.

## 구현 결과 · 제안 · 검증 기록
- (각 세션이 기록 — **쓰기 직전에 파일을 다시 읽고 자기 절만 덧붙일 것**)
