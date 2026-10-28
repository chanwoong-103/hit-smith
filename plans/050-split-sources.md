# 050 — 소스를 조각으로 나눈다 (내놓는 것은 그대로 `forge.html` 하나) · 무거운 변경(파일 규약 · 도구) · 담당: 코딩 → 검증

상태: **구현 완료 — 검증 대기** (2026-10-25 · 코딩 세션) — **락 해제**. 이 일은 **게임을 한 바이트도 안 바꿨다** — `node tools/build.js` 결과 md5 = `93b4a35678fc61238257dea391a2f99a`(411,865 B) = 049 통과본.
새것: `src/parts/**`(조각 19 + manifest) · `tools/build.js`. 한 줄씩 고침: `tools/smoke.js`·`devtools/checklist.js`. `src/forge.html` 은 바이트가 같아 **기기 파일을 건드리지 않았다**. `CLAUDE.md` 는 안 건드렸다(④ 는 계획 세션 몫).
착수 확인: `git log -1` = 「049 R2a 소리·박자 + F1~F5 — 검증 통과 (2차 forge.html 93b4a35678fc61238257dea391a2f99a)」 `07b477c…`→`2c32137492fb8eef48faf7756d3f55409d10d9e7` ✔ · 기기 `src/forge.html` md5 = `93b4a35678fc61238257dea391a2f99a`(411,865 B) ✔
근거: **사용자 결정 2026-10-24** — 「기능이 늘어나는데 HTML 로 만드는 게 맞을지」 → 049 검증 세션의 플랫폼 재검토 제안(049 지시서 「플랫폼 재검토 제안」 소절) → **ⓑ 조각으로 나눈다** 선택.
ⓐ(파일 하나 그대로)는 한 걸음마다 +40KB 꼴로 «읽는 비용»이 커지고, ⓒ(엔진)은 검사 136항·`days.js` 하니스·`__view` 를 버리는 값에 비해 얻는 것이 적다(같은 소절의 숫자).

## 0. 무엇이 바뀌고 무엇이 안 바뀌나

| 그대로 | 바뀐다 |
|---|---|
| 포털·Pages·사용자가 여는 파일 = **`src/forge.html` 하나** | 사람과 세션이 **고치는 자리** = `src/parts/**` 조각 |
| 게임 동작 · CORE · 저장 형식 · `days.js` 출력 | `src/forge.html` 은 **도구가 쓰는 생성물** — 손으로 안 고친다 |
| 검사 136항 · smoke · soak · `__view` · `zones.js` (전부 forge.html 을 읽는다) | 락을 **조각 단위**로 걸 수 있다(소리와 릴을 두 세션이 나눠 맡는다) |
| 소리 묶음 `src/audio/pack-*.js` | 기록 속 줄 번호가 「조각:줄」 꼴이 된다 |

## 1. 변경할 것

### ① 조각 — 지금 파일의 실제 경계 그대로 (049 검증 세션이 잰 표가 출발점)

`src/parts/` 아래, **목록 순서 = 지금 파일 안의 순서**(순서가 곧 `const` 의 TDZ 계약이다):

| 조각 | 담는 것 |
|---|---|
| `00-head.html` | `<!doctype>` ~ `<style>` 앞 |
| `10-style.css` | `<style>` 안 |
| `20-body.html` | `</style>` ~ 첫 `<script>` 앞(마크업) |
| `30-core-str.js` | `STR` 표 |
| `31-core-rules.js` | 배너 「CORE (로직)」의 나머지 — 자료·상태·확률·제련·전투·탑·주사위 |
| `40-view-plat.js` | PLAT · CrazyGames · GD · 광고 |
| `41-view-art.js` | 스프라이트 · 글리프 · 아이콘 |
| `42-view-ui.js` | render · 던전 · 테크 · 배선 · 탭 · 팝업 · 자동 정리 · 틱 |
| `43-view-reels.js` | 릴 · 제련 주기 · 견습생(자동 제련) |
| `44-view-canvas.js` | 캔버스 · 무대 · 모션 · 잠 |
| `45-view-sound.js` · `46-view-rhythm.js` | 소리 · 박자 |
| `50-core-selfcheck.js` | 배너 「CORE (자체 점검)」 |
| `99-tail.html` | 마지막 `</script>` ~ 끝 |

- 한 조각이 파일 안에서 **여러 군데**로 흩어져 있으면(예: ui 가 세 덩이) **그 덩이마다 따로 조각**으로 둔다(`42a-`·`42b-`…) — 순서를 바꾸지 않는다. 덩이를 «한데 모으는» 재배치는 이 지시서에서 **하지 않는다**(바이트가 바뀐다 — 그건 다음 일).
- 조각 경계는 **줄 단위**. 조각 파일 하나하나는 이어 붙였을 때 원본과 같아지는 그대로의 글자다(머리말 주석을 더하지 않는다 — 그것도 바이트다).

### ② 도구 — `tools/build.js` (의존성 0 · node)

- `node tools/build.js` → `src/parts/manifest.txt` 의 순서대로 이어 붙여 `src/forge.html` 을 쓴다.
- `node tools/build.js --check` → 「지금 `src/forge.html` = 조각을 이은 것」인지 바이트로 보고, 다르면 **어느 조각 근처가 다른지** 적고 종료 코드 1.
- `tools/smoke.js` 와 `devtools/checklist.js` **맨 앞에서 `--check` 를 부른다**(어긋난 판으로 검사가 도는 일을 막는다). 이것만은 두 도구에 한 줄씩 더한다.

### ③ 첫 걸음의 계약 — **바이트 0 변경**

- 나눈 직후 `node tools/build.js` 의 결과 md5 = **그때(049 통과본)의 `forge.html` md5.** 다르면 멈추고 보고.
- 그러면 136항 · `days.js` · smoke · soak · `zones.js` 는 **한 줄도 안 바뀌고** 같은 결과를 낸다 — 검증은 그것을 확인하는 일이다.

### ④ 규약 (계획 세션이 같은 커밋 전에 CLAUDE.md 를 고친다 — 코딩 세션은 안 건드린다)

- 「`src/forge.html` — 게임 전체. 단일 파일 유지」 → 「`src/parts/**` 가 원본, `src/forge.html` 은 `tools/build.js` 의 생성물(손으로 안 고친다 · 커밋엔 둘 다)」.
- 락: 지시서 상태 줄에 **잠그는 조각 목록**을 적는다(예: 「락: 45·46」). 같은 조각을 두 세션이 동시에 잡지 않는다. `forge.html` 자체는 아무도 잠그지 않는다(생성물이다).
- CORE/VIEW 대조: `git diff -- src/parts/3*-core-* src/parts/50-core-*` 로 갈음할 수 있다(`zones.js` 도 그대로 둔다).

## 2. 바꾸지 말 것

- 게임의 **모든 바이트**(③). 주석·공백·줄바꿈 포함.
- 검사의 판정식·문턱(②의 `--check` 한 줄 말고).
- 소리 묶음 · `days.js` · `soak.js`.

## 3. 완료 조건

- `build.js` 결과 md5 = 049 통과본 md5 · `--check` 통과 · 변이: 조각 하나에 공백 하나를 넣으면 `--check` 가 그 조각 이름을 대며 실패.
- smoke · checklist ko/en · `days.js` md5 `81a6288…` · soak 한 판 — **049 통과 때와 같은 결과**.
- 조각 표(이름 · 줄 범위 · 바이트 · md5)를 「구현 결과」에.
- `git status` 로 보일 새 파일 목록.

## 구현 결과 · 제안 · 검증 기록
- (각 세션이 기록 — 쓰기 직전에 파일을 다시 읽고 자기 절만 덧붙일 것 · 쓴 뒤 기기에서 다시 받아 크기·마지막 절을 확인할 것)

## 구현 결과 (2026-10-25 · 코딩 세션)

**게임은 한 바이트도 안 바뀌었다.** `node tools/build.js` 의 결과 md5 = **`93b4a35678fc61238257dea391a2f99a`** (411,865 B · 5,949줄) = 049 통과본 그대로. 첫 계약(③)이 섰다.

고친 자리: `src/parts/**`(새것) · `tools/build.js`(새것) · `tools/smoke.js`·`devtools/checklist.js`(각 한 줄). `src/forge.html` 은 **다시 쓰였지만 바이트가 같아** 기기 파일을 건드리지 않았다(mtime 도 049 커밋 그대로다). `CLAUDE.md` 는 안 건드렸다(④는 계획 세션 몫).

### ① 조각 19개 — 지금 파일의 실제 경계 그대로

경계는 모두 **지금 있는 배너 줄**이다(`/* ══ … ══ */`). 새로 가른 자리는 없고, 순서도 그대로다. 흩어진 덩이는 `42a·42b·42c`·`43a·43b`·`44a·44b`·`45a·45b` 로 **덩이마다** 두었다 — 모으지 않았다.

| # | 조각 | 049 통과본 줄 범위 | 줄 | 바이트 | md5 |
|---|---|---|---|---|---|
| 1 | `00-head.html` | 1–15 | 15 | 1,236 | `bc3e3381c43276548dbe2ebed2b8f895` |
| 2 | `10-style.css` | 16–924 | 909 | 61,978 | `211c0569dbb4e1478a3c96d32da17a4b` |
| 3 | `20-body.html` | 925–1217 | 293 | 19,150 | `e573215f1625c2ac94aa3a5d1e43c8df` |
| 4 | `30-core-str.js` | 1218–1513 | 296 | 19,315 | `5d1437803f795434987313ec924d1ce4` |
| 5 | `31-core-rules.js` | 1514–1838 | 325 | 17,393 | `1c5ae6985739f27697222bea7e3a403d` |
| 6 | `40-view-plat.js` | 1839–2130 | 292 | 18,809 | `ef8ce7e72f4f01dfbefc4f9e34bcec50` |
| 7 | `41-view-art.js` | 2131–2715 | 585 | 70,891 | `ccbc2ab0944bcea4cf5709385633471a` |
| 8 | `42a-view-ui.js` | 2716–3251 | 536 | 34,202 | `662f0adc3e988b460179a6d3c36cf710` |
| 9 | `43a-view-reels.js` | 3252–3689 | 438 | 27,111 | `ad18168006daa45f5fa1c8e1a1261975` |
| 10 | `42b-view-ui.js` | 3690–3915 | 226 | 16,264 | `c883e88ae720271e54255cd324d75c4c` |
| 11 | `43b-view-reels.js` | 3916–4249 | 334 | 20,275 | `e2426b9deaaa5b0b9b8d6ea6059bae7a` |
| 12 | `42c-view-ui.js` | 4250–4362 | 113 | 8,110 | `faf7f3f902a4ce9af838a01535aad893` |
| 13 | `44a-view-canvas.js` | 4363–4494 | 132 | 10,654 | `c4fceef389bc703e9685d6a1bcddd508` |
| 14 | `45a-view-sound.js` | 4495–4829 | 335 | 17,701 | `8d1a2d3cf3ad723559459fc2f96d6b43` |
| 15 | `46-view-rhythm.js` | 4830–5019 | 190 | 10,429 | `86ab1bd0752d291cab5e9f54f1f3b25e` |
| 16 | `45b-view-sound.js` | 5020–5030 | 11 | 292 | `270430b7a36cce86153af9a80b86300b` |
| 17 | `44b-view-canvas.js` | 5031–5805 | 775 | 48,094 | `80e71a1b402edc6363f7554584f2d9fb` |
| 18 | `50-core-selfcheck.js` | 5806–5946 | 141 | 9,935 | `62d4aa8df96b328430438a502dc8d3c1` |
| 19 | `99-tail.html` | 5947–5949 | 3 | 26 | `6ad4ea15127078e6949350f7e3821449` |
| — | `manifest.txt` (순서표) | — | 19 | 309 | `c56736a1810fc706a9f5e15809d546d1` |

- **조각 합계 411,865 B = `forge.html` 바이트 수**(빈틈·겹침 0). 줄 합계 5,949 = 원본 줄 수.
- 범위는 **1–5949 를 빈틈 없이 덮는지** 쪼개면서 단정했다(겹치거나 끊기면 멈춘다). 각 조각의 개행 수가 그 줄 수와 같은지도 표를 만들 때 다시 단정했다.
- 태그가 걸친 자리는 이렇게 끊었다(계약을 바이트로 지키기 위해 한 줄씩 이웃에 붙인다 — 지시서 표의 「`<style>` 앞」·「`</style>` ~」을 줄 단위로 옮긴 것):
  - `<style>`(15줄) = `00-head.html` 의 **마지막 줄** · CSS 본문만 `10-style.css` · `</style>`(925줄) = `20-body.html` 의 첫 줄.
  - 첫 `<script>`(1217줄) = `20-body.html` 의 **마지막 줄** · 마지막 `</script>`+`</body>`+`</html>` = `99-tail.html`.
  - 그래서 `.js` 조각 15개는 **순수 자바스크립트**다 — 편집기가 바로 읽고, `node --check` 도 통한다(아래).
- **머리말 주석을 한 줄도 더하지 않았다**(그것도 바이트다). 조각 안의 첫 줄은 지금 파일의 그 배너 그대로다.
- 조각이 문장 가운데서 끊기지 않았다는 증거: `.js` 조각 **15개 전부 `node --check` 통과**(혼자서도 파싱된다). 경계가 전부 최상위 배너라서 그렇다.

### ② `tools/build.js` (새것 · 5,536 B · md5 `b7f120d983b6bb3e3441b8f8df620182` · 의존성 0)

- `node tools/build.js` → `manifest.txt` 순서대로 **바이트 그대로** 이어 `src/forge.html` 을 쓴다. 결과를 「조각 수 · 바이트 · 줄 · md5」로 적는다.
- `node tools/build.js --check` → 지금 `forge.html` 과 바이트 비교. 같으면 한 줄로 ok, 다르면 **첫 번째로 달라지는 바이트**를 찾아 「조각 이름 · 그 조각의 몇째 줄 · 이은 파일의 몇째 줄」과 양쪽 줄의 글자를 적고 종료 코드 1.
- 순서는 이름순이 **아니다** — `manifest.txt` 가 정한다(`42a`→`43a`→`42b` 처럼 흩어진 덩이의 순서가 곧 `const` 의 TDZ 계약이다. 이름순으로 이으면 TDZ 로 죽는다).
- 지키는 것 둘(조용한 사고를 막는다): manifest 에 **없는** 파일이 `src/parts/` 에 있으면 멈춘다(코드가 조용히 빠지는 일) · manifest 에 있는데 파일이 없으면 멈춘다.
- `tools/smoke.js`·`devtools/checklist.js` 맨 앞에 **각 한 줄**:
  `try { …execFileSync(process.execPath, [build.js, '--check'], {stdio:'inherit'}); } catch (e) { process.exit(1); }`
  어긋난 판으로 검사가 도는 일을 막는다. 두 도구 말고는 아무것도 안 건드렸다.

### ③ 변이 시험 — 조각 하나에 공백 하나

| 변이 | `--check` 가 한 말 | 종료 코드 |
|---|---|---|
| `43a-view-reels.js` 100째 줄 끝에 공백 1 | 「조각 **43a-view-reels.js** 의 **100째 줄**(이은 파일 3351째 줄)」 · 양쪽 줄 글자까지 | 1 |
| `10-style.css` 500째 줄 끝에 공백 1 | 「조각 **10-style.css** 의 **500째 줄**(이은 파일 515째 줄)」 | 1 |
| `42c-view-ui.js` 6째 줄 끝에 공백 1 | 같은 꼴 — 그리고 **`node tools/smoke.js` 와 `node devtools/checklist.js` 가 그 자리에서 멈췄다**(둘 다 종료 코드 1 · 브라우저를 아예 안 띄운다) | 1 |
| `src/parts/` 에 manifest 에 없는 파일 하나 | 「manifest 에 없는 파일이 src/parts/ 에 있다: …」 | 1 |
| manifest 에서 `45b-view-sound.js` 줄을 지움 | 같은 줄로 잡힌다(그 파일이 목록에 없는 파일이 된다) | 1 |

⚠ **첫 변이 시험이 엉뚱한 줄을 댔고, 그래서 도구를 고쳤다.** 자리는 바이트인데 문맥 줄을 꺼낼 때 문자열 인덱스로 찾았다 — 한글 한 자가 3바이트 ↔ 1칸이라 전혀 다른 줄이 찍혔다(조각 이름·줄 번호는 처음부터 맞았다). 버퍼에서 개행을 찾도록 바꿨다. 변이 시험이 **도구의 결함**을 잡은 셈이다.

### ④ 회귀 — 049 통과 때와 같은 결과

| 잰 것 | 050 (조각 뒤) | 049 통과 때 |
|---|---|---|
| `node tools/build.js` 결과 md5 | **`93b4a356…`** · 411,865 B | (같은 파일) |
| `node tools/days.js` 기본 출력 md5 | **`81a6288ee480f80cc9a6c014de4e1826`** | 같다 |
| `node tools/smoke.js` | **19 통과 · 0 실패** · self-check ok (★0 · 릴 3 · 상한 5 · 승천 제련 28) | 같다 |
| `node devtools/checklist.js` (ko) | **141 통과 · 0 실패** | 141 · 0 |
| `node devtools/checklist.js --en` | **141 통과 · 0 실패** | 141 · 0 |
| `node devtools/soak.js 5 380 g` | **누수 없음**(프로브 11종) · 정렬 400회 · rAF 피크 3 · 힙 9.5MB 고정 · 리스너 27 · 콘솔 0건 · 불티 최대 57/64 | 누수 없음 · 400회 · rAF 3 · 9.5MB · 27 · 0건 · 51/64 |

(불티 피크는 판마다 흔들리는 값이다 — 상한 64 안이고 soak 의 판정은 `ok`.)

### ⑤ `git status` 로 보일 것

새 파일(추적 안 됨) **21개**:

```
src/parts/00-head.html          src/parts/43a-view-reels.js
src/parts/10-style.css          src/parts/42b-view-ui.js
src/parts/20-body.html          src/parts/43b-view-reels.js
src/parts/30-core-str.js        src/parts/42c-view-ui.js
src/parts/31-core-rules.js      src/parts/44a-view-canvas.js
src/parts/40-view-plat.js       src/parts/45a-view-sound.js
src/parts/41-view-art.js        src/parts/46-view-rhythm.js
src/parts/42a-view-ui.js        src/parts/45b-view-sound.js
                                src/parts/44b-view-canvas.js
                                src/parts/50-core-selfcheck.js
                                src/parts/99-tail.html
                                src/parts/manifest.txt
tools/build.js
```

고쳐진 파일 **3개**: `tools/smoke.js`(3,375 → 3,667 B) · `devtools/checklist.js`(303,763 → 304,060 B) · `plans/050-split-sources.md`.
**`src/forge.html` 은 안 뜬다** — 다시 쓴 결과가 바이트로 같아서다(그것이 ③의 계약이다). `.gitignore` 에 `src/parts/`·`tools/build.js` 를 막는 줄은 없다(확인).

## 제안 (050)

1. **저장소가 커밋마다 두 벌을 진다.** 조각 412KB + 생성물 412KB. 게임을 고치면 둘 다 바뀌어 역사가 이전의 두 배 속도로 쌓인다(지금까지 `forge.html` 한 벌 ~412KB). 지시서가 「커밋엔 둘 다」로 정한 것이라 그대로 했고, 줄이려면 ⑴ 생성물을 추적에서 빼고 배포 때 만들거나 ⑵ Pages 전용 분기에만 둬야 하는데 **둘 다 「배포 = 정적 파일 복사」를 깬다**. 지금은 두 벌이 맞다고 보지만, 커밋 수가 쌓이면 계획 세션이 다시 재 보면 좋겠다.
2. **`build.js --lint` 를 다음에.** `.js` 조각 15개가 혼자서도 `node --check` 를 통과한다(위 ①). 그 성질을 `--check` 와 묶어 상설로 만들면, 경계를 옮기는 사람이 문장 가운데서 끊는 실수를 바로 안다. 이번 범위가 아니라 안 넣었다.
3. **락을 조각 단위로 쓰기 시작할 때 생기는 것.** `42`·`43`·`44`·`45` 가 각각 두세 덩이로 흩어져 있어, 「릴을 맡는다」가 `43a`+`43b` 두 조각을 함께 잠근다. 다음 단계(덩이를 한데 모으는 재배치)는 **바이트를 바꾸는 일**이라 게임 변경이 없는 커밋 하나로 따로 서는 것이 좋겠다 — 그때 `--check` 가 모든 이동을 지켜 준다.
4. **`src/parts/` 도 Pages 가 공개로 서빙한다.** 플레이어가 받는 바이트는 늘지 않지만(아무도 요청하지 않는다) 소스가 공개 경로에 한 벌 더 놓인다. 저장소가 이미 공개라 새로 새는 것은 없다 — 적어 둔다.

---

## 검증 기록 (검증 세션 · 2026-10-27) — **판정: 통과** (게임 바이트 0 변경 · 결함 0 · 문서 정정 넷은 제안)

대상: `src/parts/**`(조각 19 + `manifest.txt`) · `tools/build.js` `b7f120d9…` · `tools/smoke.js` `0e3a2181…` · `devtools/checklist.js` `039728df…` · `src/forge.html` `93b4a356…` — 판정 직전에 기기에서 다시 받아 처음 받은 것과 바이트로 대조(맨 아래).
기준: **049 통과 커밋 `2c32137`** — 기기 `.git` 의 새 객체 21개를 받아 이 세션의 재구성 저장소에 넣고 `git show 2c32137:src/forge.html` = **`93b4a35678fc61238257dea391a2f99a`**(411,865 B · 5,949줄). smoke·checklist 의 기준판도 같은 커밋에서 꺼냈다. `src/forge.html` 은 한 바이트도 안 건드렸다.

### ① 직접 이어 붙이기 — PASS

- `build.js` 를 **쓰지 않고** 파이썬으로 `manifest.txt` 순서대로 조각 19개를 바이트 그대로 이었다 → **`93b4a356…` · 411,865 B · 5,949줄 = 기준과 바이트 동일.** 이으면서 조각마다 「기준 파일의 그 자리 바이트 = 조각」을 단정했다(빈틈·겹침 0).
- `node tools/build.js` 의 결과도 **`93b4a356…`** · `--check` ok.
- 조각 표(줄 범위·줄 수·바이트·md5)는 구현 결과 ① 표와 **19줄 전부 같다.** 조각마다 끝이 개행 · CR 0 · BOM 0. manifest 는 309 B · 19줄 · 중복 0 · CR 0.
- 덧: CORE 두 구획(`zones.js`)이 조각과 정확히 맞물린다 — CORE(로직) = `30-core-str.js`+`31-core-rules.js`(그 밖의 글자는 배너를 여는 `/* ═══` 한 줄과 끝 빈 줄뿐), CORE(점검) = `50-core-selfcheck.js`(같은 꼴). 지시서 §1④ 의 「CORE 대조 = `git diff -- src/parts/3*-core-* src/parts/50-core-*`」 갈음은 **성립한다.**
- 덧: 「이름순으로 이으면 TDZ 로 죽는다」도 확인 — 이름순(42a·42b·42c·43a…)으로 이은 판은 `Cannot access 'symAbove' before initialization` 로 게임이 안 선다. manifest 순서 판은 오류 0.

### ② 합계 · 목록 · node --check — PASS

- 조각 합계 **411,865 B · 5,949줄 = 원본.** `src/parts/` 의 파일 20개 = manifest 19 + `manifest.txt` — **manifest 에 없는 조각 0 · 빠진 조각 0.**
- `.js` 조각 **15개 전부 `node --check` 통과**(혼자서 파싱된다 = 문장 가운데서 안 끊겼다).

### ③ `--check` 변이 — 전부 운다 (종료 1 · 자리를 정확히 댄다)

| 변이 | `--check` 가 댄 자리 | 종료 |
|---|---|---|
| `10-style.css` 300째 줄 끝 공백 | **10-style.css 의 300째 줄**(이은 파일 315) · 양쪽 줄 글자 | 1 |
| `20-body.html` 120째 줄 끝 공백 | **20-body.html 의 120째 줄**(1044) | 1 |
| `31-core-rules.js` 200째 줄 끝 공백 | **31-core-rules.js 의 200째 줄**(1713) | 1 |
| `44b-view-canvas.js` 700째 줄 끝 공백 | **44b-view-canvas.js 의 700째 줄**(5730) | 1 |
| `00-head.html` 맨 앞(바이트 0)에 공백 | 00-head.html 1째 줄 · 바이트 0 | 1 |
| `99-tail.html` 맨 끝에 공백 | 99-tail.html 4째 줄(이은 파일 5950) | 1 |
| `30-core-str.js` 같은 길이로 글자 바꿈(「자동」→「수동」) | 30-core-str.js 84째 줄 — 길이가 같아도 잡는다 | 1 |
| `src/forge.html` 을 **손으로** 고침(3001째 줄 끝 공백) | 42a-view-ui.js 286째 줄(3001) · 「고치는 자리는 조각이다」 | 1 |
| manifest 순서 맞바꿈(43a↔42b) | 42b-view-ui.js 1째 줄(3252) | 1 |
| `45b-view-sound.js` 끝 개행 하나 **지움** | ⚠ **다음 조각** `44b-view-canvas.js` 1째 줄을 댄다 | 1 |
| manifest 에 없는 조각 `47-new.js` | 「manifest 에 없는 파일이 src/parts/ 에 있다: 47-new.js」 | 1 |
| `src/parts/` 안 빈 하위 폴더 `old/` | 같은 줄로 멈춘다 | 1 |
| 조각 파일 하나 지움 | 「조각이 없다: src/parts/45b-view-sound.js」 | 1 |

- 조각의 **끝**에서 바이트를 지우면 처음 달라지는 바이트가 다음 조각 첫 자리에 떨어져 **이웃 조각을 댄다**(종료 1 은 맞다 · 사소 — 제안 4).
- **smoke·checklist 가 브라우저를 띄우기 전에 멈춘다**: Playwright 의 브라우저 경로를 없는 곳(`PLAYWRIGHT_BROWSERS_PATH=/nonexistent-sentinel`)으로 돌려 놓고 돌렸다 — 대조(변이 없음)에서는 checklist 가 그 경로를 찾다 실패하는 흔적이 남고(= 이 덫이 실제로 실행 시도를 잡는다), 변이 셋(조각 공백 · manifest 밖 조각 · forge.html 손질)에서는 smoke·checklist ko·en 모두 **0.12~0.17초 만에 종료 1 · 실행 흔적 0 · 시험 출력 0줄**. smoke 는 원래 브라우저를 안 쓰는 도구라 「시험을 하나도 돌리기 전에」 멈춘다.

### ④ smoke·checklist 에 더한 것 — PASS (판정식·문턱 0 변경)

`git show 2c32137:` 판과 diff — 두 파일 모두 **주석 한 줄 + `--check` 를 부르는 한 줄**(checklist 는 그 뒤 빈 줄 하나)만 더해졌다. 지운 줄 0 · 다른 자리 변경 0. checklist 의 그 줄은 Playwright 를 불러오기 **전**(파일 46째 줄)이다.

### ⑤ 회귀 — 049 통과 때와 같은 결과

| | 050 | 049 통과 때 |
|---|---|---|
| `days.js` 기본 출력 md5 | **`81a6288…`** | 같다 |
| smoke | **19 통과 · 0 실패**(첫 줄 `build --check: ok`) | 19 · 0 |
| checklist ko | **141 · 0** (9분 56초) | 141 · 0 |
| checklist en | **141 · 0** (9분 59초) | 141 · 0 |
| checklist 항목별 판정 | 049 2차 검증 때의 141줄과 **이름·PASS 가 줄마다 같다**(ko·en) | — |
| soak 5분 380 g | **누수 없음** · 장비 400 · rAF 피크 3 · 힙 9.5MB · 리스너 27 · 글리프 51~56→56 · 콘솔 0 | 누수 없음 · 400 · 3 · 9.5 · 27 · 0 |

### ⑥ CLAUDE.md 개정 — 고친 두 자리는 사실과 맞다 · **안 고친 자리 넷이 새 규약과 어긋난다**

맞는 것(실제로 확인):
- 「원본은 `src/parts/**`, `src/forge.html` 은 `build.js` 의 생성물」 · 「`--check` 가 바이트로 보고 smoke·checklist 가 맨 앞에서 부른다」(③④) · 「조각 순서 = manifest = 파일 안의 순서 = TDZ 계약」(① 덧 — 이름순은 죽는다) · 「생성물은 반드시 `src/forge.html` 자리」(`build.js` 의 `OUT` 이 그 자리로 박혀 있다 · 049 2차 검증 ⑥) · 「커밋엔 둘 다」.
- 락 줄(「잠그는 조각 목록」·「forge.html 은 생성물이라 잠그지 않는다」)은 정책이라 사실 대조 대상이 아니다.

어긋나는 것(같은 파일 안의 옛 문장 — 다음 세션이 그대로 읽는다):
1. **원칙 2** 「추상화·**빌드 도구 금지**」(17줄)와 「빌드 스텝은 여전히 없다」(35줄) — `tools/build.js` 가 생겼다. 소리 묶음처럼 「예외 셋 (050): `tools/build.js` — 조각을 다시 한 장으로 붙이는 도구 · 배포 단계가 아니다(배포 = 커밋된 `src/forge.html` 복사)」 한 줄이 필요하다.
2. **세션 입출력**(90·91·108·118줄) — 코딩 세션 「입력: 지시서 + `src/forge.html` · **출력: `src/forge.html` 수정**」, 디자인 세션 입력, 검증 세션 입력이 옛 그대로다. 56~61줄의 「손으로 `src/forge.html` 을 고치지 않는다」와 **정면으로 어긋난다** → 「입력·출력: `src/parts/**`(지시서가 잠근 조각) + `node tools/build.js`」.
3. **동시 작업 규칙 첫 줄**(302줄) 「`src/forge.html` 은 한 번에 한 세션만 수정한다(단일 파일이라 병합 불가)」 — 바로 아래 새 줄(「forge.html 은 생성물이라 잠그지 않는다」)과 한 항목 안에서 엇갈린다. 덧붙일 사실: 두 세션이 서로 다른 조각을 고쳐도 **생성물 `forge.html` 은 둘 다 바뀌어 git 에서 늘 충돌한다** — 「`forge.html` 충돌은 손으로 풀지 말고 조각을 합친 뒤 `build.js` 로 다시 쓴다」를 적어 둘 것.
4. **파일 내 구획**(63줄) — 배너 설명은 그대로 맞지만, CORE 대조가 조각으로 갈음된다는 지시서 §1④ 의 문장이 CLAUDE.md 에는 없다(① 덧에서 성립 확인 — 넣어도 된다).

판정에는 넣지 않는다(문서 정정이지 산출물 결함이 아니다). 계획 세션이 커밋 **전에** 고치면 커밋 하나로 규약이 맞물린다.

### git status (기기 `.git/index` 로 재구성 — HEAD **`2c32137`** 「049 R2a … 검증 통과」)

- 바뀜 5: `CLAUDE.md` · `devtools/checklist.js` · `docs/ROADMAP.md` · `plans/050-split-sources.md` · `tools/smoke.js`
- 새 파일 21: `tools/build.js` · `src/parts/` 20개(조각 19 + `manifest.txt`) — `.gitignore` 에 걸리는 것 0
- **`src/forge.html` 은 안 뜬다**(크기·수정시각이 인덱스 그대로 · 바이트도 같다). 050 이 만든 것 말고 보이는 것은 아래 ⚠ 의 둘뿐(지운 것 0).
- ⚠ **검증 도중 계획 세션이 기기에 쓴 것 셋**(이 절을 쓰는 동안 기기 목록에서 확인): `docs/ROADMAP.md` 33,243 → 33,664 B(`051 R2b` 줄 추가) · **`plans/046-reboot.md` 37,790 → 38,746 B(바뀜 — 위 「바뀜 5」 밖)** · **`plans/051-r2b-fever-and-feel.md` 9,318 B(새 파일 — 위 「새 파일 21」 밖)**. 셋 다 050 산출물이 아니다. 지시의 add 목록대로면 ROADMAP 의 051 줄은 들어가고 046·051 은 빠진다 — 함께 넣을지는 계획 세션이 정할 것.

### 판정

**통과.** 조각을 손으로 이어도 `build.js` 로 이어도 `93b4a356…` 바이트 동일 · 합계·목록·`node --check` 맞음 · `--check` 변이 13가지 전부 종료 1(자리를 대고) · smoke·checklist 는 어긋난 판에서 브라우저 전에 멈춤 · 두 도구에 더한 것은 `--check` 한 줄(+주석)뿐 · days·smoke·checklist ko/en·soak 가 049 통과 때와 같다.

### 제안 (구현하지 말 것)

1. **CLAUDE.md 정정 넷**(⑥) — 원칙 2 예외 · 세션 입출력 · 동시 작업 첫 줄(+생성물 충돌 푸는 법) · CORE 대조 갈음.
2. **`soak.js`·`days.js` 는 `--check` 를 안 부른다.** 둘 다 `src/forge.html`(또는 그 CORE)을 읽으므로 조각만 고치고 빌드를 잊으면 옛 판을 잰다. 이번엔 「soak 바꾸지 말 것」이라 그대로 두는 게 맞고, 다음에 손댈 일이 있을 때 같은 한 줄을 넣으면 된다.
3. **줄바꿈 계약을 저장소에 적는다.** 지금은 기기 `core.autocrlf=false` 덕에 조각·생성물 모두 LF(CR 0)다. 다른 PC 에서 `autocrlf=true` 로 받으면 조각과 생성물이 함께 CRLF 가 되어 `--check` 는 통과하지만 내놓는 바이트가 달라진다. `.gitattributes` 에 `src/parts/** -text` · `src/forge.html -text` 두 줄이면 막힌다.
4. 사소: `--check` 가 조각 **끝**의 바이트 삭제를 다음 조각 이름으로 댄다(③). 「앞 조각 끝일 수 있다」 한 마디를 덧붙이거나, 다른 자리가 조각 첫 바이트면 앞 조각도 함께 대면 된다. `src/parts/` 에 OS 가 만드는 숨김 파일(`desktop.ini`·`Thumbs.db`)이 생겨도 멈춘다 — 의도한 엄격함이지만 그 이름이 보이면 지우면 된다는 것만 알아 둘 것.

**판정 직전 기기 확인**: 조각 20개(`src/parts/` 목록 = 크기·수정시각 처음과 같음) · `tools/build.js` · `tools/smoke.js` · `devtools/checklist.js` · `src/forge.html`(**`93b4a356…` · 411,865 B · mtime 1792855872604** — 049 커밋 때 그대로)를 다시 받아 잰 나무(`/tmp/p50`)와 **바이트 대조 전부 같음** · `CLAUDE.md` 37,820 B 같음 · 지시서 16,656 B(이 절을 붙이기 전) 같음 · `docs/ROADMAP.md`·`plans/046`·`plans/051` 만 위 ⚠ 대로 계획 세션이 썼다.
