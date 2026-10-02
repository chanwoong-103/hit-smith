# 035 — CrazyGames 제출 자산 (표지 3장 · 영상 2개 · 업로드 묶음)

상태: **완료(2026-10-02).** 표지 3장(+정사각 대안) · 영상 2개 — `submission/`. 묶음은 028 §1 로 대체.

요건 출처(2026-09-29 확인): CrazyGames 문서 Requirements → Game Covers · FAQ · Sitelock.

## 1. 표지 3장 — 필수

| 이름 | 크기 | 비율 |
|---|---|---|
| `cover-landscape.png` | 1920×1080 | 16:9 |
| `cover-portrait.png` | 800×1200 | 2:3 |
| `cover-square.png` | 800×800 | 1:1 |

**요건 규칙:** 테두리 금지 · **게임 제목 말고 다른 글자 금지** · 아이콘·스토어 로고 금지 ·
제목은 반드시 들어감 · 스크린샷 금지(일러스트여야 함) · 깔끔한 구도 · **흐리거나 깨진 픽셀 금지** ·
세 장이 같은 톤.

### 만드는 법 — 그림과 제목을 나눈다

생성기는 글자를 자주 틀리게 그린다(「HIT SMTIH」). 그래서:
1. **사용자**: 아래 프롬프트로 **글자 없는 그림** 세 장을 뽑는다. 위쪽에 제목 자리를 비워 둔다.
2. **계획 세션**: 게임의 픽셀 숫자 글리프와 같은 방식으로 **「HIT SMITH」 픽셀 로고**를 그려
   세 장에 같은 위치·같은 크기 비율로 얹는다. 세 장의 제목이 정확히 같아진다.

⚠ 프롬프트는 **한 번에 하나씩** 붙여 넣을 것 — 지난번에 문서 전체를 넣었더니 그림이 한 장만 나왔다.

### 공통 스타일 (세 프롬프트에 이미 들어 있다 — 따로 넣지 말 것)

어두운 대장간 안, 화로의 주황 불빛, 황동·잉걸불 색, 선명한 고해상도 픽셀아트(흐림 없음),
좌상단 광원, 글자 없음.

### 프롬프트 ① 가로 1920×1080

```
High-resolution crisp pixel art illustration, 16:9 landscape, no text, no letters, no logo, no border.
A dark medieval blacksmith forge interior lit by a roaring orange furnace on the right.
In the center-left a small stout blacksmith hero in simple leather and iron, mid-swing with a big hammer over a glowing anvil;
bright sparks burst from the strike. On the anvil, freshly forged gear glows: a sword, a helmet, a chest plate, gauntlets, boots.
In the background on the right, a pack of small green goblins with clubs and skeleton archers with bows approach from the shadows.
Palette: deep charcoal and slate background, warm brass, ember orange, molten gold highlights, a few cool blue-violet glints on rare gear.
Light source top-left and from the furnace. Clean composition, strong silhouettes, chunky readable pixel shapes,
upper third of the image kept as calm dark smoky empty space for a title. Cozy, heroic, playful mood. Not realistic, not 3D.
```

### 프롬프트 ② 세로 800×1200

```
High-resolution crisp pixel art illustration, 2:3 portrait, no text, no letters, no logo, no border.
A dark medieval blacksmith forge seen from the front. At the bottom center a glowing anvil;
a small stout blacksmith hero in leather and iron raises a big hammer high, sparks flying upward in a column.
Floating above the anvil in a gentle arc: a sword, a helmet, a chest plate, gauntlets, boots — each glowing a different rarity color
(bronze, silver, gold, violet). Behind, a roaring orange furnace fills the lower background.
Palette: deep charcoal and slate, warm brass, ember orange, molten gold, a touch of violet.
Light from top-left and from the furnace. Chunky readable pixel shapes, clean composition,
the top third of the image kept as dark smoky empty space for a title. Cozy, heroic, playful. Not realistic, not 3D.
```

### 프롬프트 ③ 정사각 800×800

```
High-resolution crisp pixel art illustration, square 1:1, no text, no letters, no logo, no border.
Close-up of a glowing anvil in a dark blacksmith forge; a big hammer striking from the upper left,
a bright burst of sparks at the impact point, and a freshly forged glowing sword resting on the anvil.
Warm orange furnace glow behind. Palette: deep charcoal, warm brass, ember orange, molten gold highlights.
Light from top-left. Chunky readable pixel shapes, strong centered composition,
the top quarter kept as dark empty space for a title. Heroic, punchy, playful. Not realistic, not 3D.
```

**고를 때:** 세 장의 불빛 색과 픽셀 굵기가 닮은 것 · 제목 자리(위쪽)가 비어 있는 것 ·
몹이 무섭지 않고 귀여운 것 · 글자처럼 보이는 얼룩이 없는 것. 뽑은 원본을 그대로 주면 된다.
크기가 요건과 달라도 괜찮다 — 자르기·맞추기는 계획 세션이 한다.

## 2. 미리보기 영상 2개 — 필수 · 034 검증 뒤 · 담당: 검증 세션

| 이름 | 크기 | 길이 |
|---|---|---|
| `preview-landscape.mp4` | 1920×1080 | 15~20초 |
| `preview-portrait.mp4` | 1080×1620 | 15~20초 |

**요건 규칙:** 50MB 이하 · **소리 없음** · **표지 그림으로 시작** · 검은 화면·로고·전환 효과 금지 ·
양옆 검은 띠 금지 · **기본 마우스 커서 금지** · 「Play Now」 같은 글자 금지 · 빨리감기 금지 · 오해를 부르는 연출 금지.

**찍는 법:** Playwright 헤디드(커서 숨김) · **영어(`?lang=en`)** · 새 세이브.
구성(가로 기준 약 18초): 표지 1.5초 → 첫 제련 몇 번(정렬·등급 불빛) → 장비가 바뀌며 전투력이 오르는 장면 →
무대에서 몹이 쓰러지는 장면 → 웨이브가 넘어가는 장면. **배속·잘라 붙이기로 빨리 보이게 하지 말 것.**
세로판은 세로 배치(가로 미디어 질의 밖)로 찍는다 — 양옆 띠가 생기면 안 된다.
**게임 파일은 건드리지 않는다.** ffmpeg 로 표지 정지 화면 + 녹화를 잇는다.

## 3. 업로드 묶음 — ⚠ 028 §1 로 대체됨 (아래는 옛 안, 따르지 말 것)

028 판정: 게임이 파일 하나라 리다이렉트를 끼울 이유가 없다 → **`forge.html` 을 `index.html` 로 담은 zip 하나.**

- 묶음은 **`index.html` + `src/forge.html`** 둘뿐. 루트 `index.html` 은 상대경로로 `src/forge.html` 에
  넘긴다 — 구조를 그대로 넣으면 된다. **사본을 만들지 않는다.**
- 만드는 법(PowerShell, 빌드 도구 없음):
  `Compress-Archive -Path index.html, src -DestinationPath hit-smith-upload.zip` 에서
  `src` 안에 `proto-stage.html` 이 딸려 들어가지 않게 — 넣는 파일을 둘로 못박는 명령은 028 에 적는다.
- ⚠ 포털이 진입 파일 이름·zip 구조를 어떻게 요구하는지는 **문서에 없다.** 업로드 화면에서
  확인하고 028 에서 판정한다. 리다이렉트가 막히면 루트를 한 장짜리로 바꾸는 판단이 필요하다.

## 4. 사이트락 — 확인됨

CrazyGames 가 적은 허용 도메인: `*.crazygames.com` · `games.crazygames.com` ·
`https://app.crazygames.com` · `capacitor://app.crazygames.com` · `www.1001juegos.com`.
026 의 `CG_HOSTS`(crazygames.com·crazygames.co.uk·1001juegos.com + 하위 도메인)가 전부 덮는다
(`app.`·`games.` 은 하위 도메인, `capacitor://` 도 호스트는 `app.crazygames.com`).

## 구현 결과 · 제안 · 검증 기록
- (각 세션이 기록 — **재작성 시 이 절을 지우지 말 것**)
- **계획 세션 2026-10-02 — 표지 완료.** 사용자 그림 3장(Gemini, 1024px 급)의 우측하단 마름모 워터마크를 지우고
  픽셀 로고 「HIT SMITH」를 같은 글리프로 얹었다. `cover-landscape` 1920×1080 · `cover-portrait` 800×1200 ·
  `cover-square` 800×800(가로 그림에서 잘라 톤 통일, 기본) · `cover-square-alt` 800×800(망치 클로즈업, 대안).
  ⚠ 원본이 1024px 이라 1920 가로판은 확대본 — 포털이 「흐림」으로 반려하면 고해상도로 다시 뽑는다.
- **검증 세션 2026-10-02 — 영상 완료.** 상세는 `submission/README.md`. 960×540·540×810 에서 찍고 ffmpeg ×2 `neighbor`
  (`recordVideo.size` 는 여백 채우기, 1920 CSS 뷰포트는 UI 가 위 45%만 채움, `transform:scale(2)` 는 무대 캔버스가 깨짐).
  실측 전투력 5→372 · 웨이브 1→8(가로), 5→704 · 1→5(세로), 콘솔 0, blackdetect 0, 오디오 0.
- **계획 세션 판정** — ① 검증 세션은 앞 1.5초를 게임 첫 화면으로 두었으나 요건은 「표지 그림으로 시작」이다 →
  README 의 명령 그대로 표지를 끼워 **최종본으로 교체**(19.56초 · 3.33MB / 2.62MB · blackdetect 0, 첫 프레임 표지 확인).
  ② `.gitignore`: 영상·take·cover-slot 제외, 레시피·README·표지 PNG 는 추적 — 제안 수용.
  ③ 제안 「1920×1080 CSS 뷰포트에서 UI 가 위 45%만 채운다」 → **036 후보로 등록, 제출을 막지 않는다**
  (CrazyGames 주력 iframe 은 821×462~1216×684, 빌드는 제출 뒤에도 교체 가능). 전체화면 대응은 Basic Launch 중에.
  ④ 세로 540×810 끝 프레임에서 Gear 판 아래가 잘림 — `#manage` 자체 스크롤이라 결함 아님, 기록만.
  ⚠ 이 문서의 계획 세션 절이 한 번 지워져 있었다(장치 파일이 옛 내용으로 덮임). 문서를 고치는 세션은 **다시 읽고 자기 절만 덧붙일 것**.
