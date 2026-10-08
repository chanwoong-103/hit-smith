# 037 — GameDistribution 출시 (B 경로) · 무거운 변경(광고/플랫폼) · 담당: 사용자(0단계) → 코딩 → 검증

상태: **대기 — 착수 가능** (0단계 완료 2026-10-08 · 사용자 판정 2026-10-08: **037 먼저, 040 은 그 뒤**). 착수하면 이 줄을 「진행 중」으로 바꾼다(락).
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
F12 게임 프레임 콘솔 `__view.plat.env==='gamedistribution'` → 상태 카드가 `SDK: Yes` 로 바뀌었는지 → **EDIT 탭에서 Rewarded Ads 체크**(이때 켜지는지 확인, 안 켜지면 GD Support 문의) → 다시 미리보기에서 `__view.plat.rewardOn===true` → **Request Activation**.
썸네일: `submission/gd/thumb-512x512.png`·`thumb-512x384.png`·`thumb-200x120.png`(계획 세션 작성).
설명·조작 문구는 028 §2 영어 그대로.

## 구현 결과 · 제안 · 검증 기록
- (각 세션이 기록 — **쓰기 직전에 파일을 다시 읽고 자기 절만 덧붙일 것**)
