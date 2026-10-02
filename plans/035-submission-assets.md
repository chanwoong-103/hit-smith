# 035 — CrazyGames 제출 자산 (표지 3장 · 영상 2개 · 업로드 묶음)

상태: **표지는 지금 착수 가능(사용자 · 게임 코드와 무관).** 영상·묶음은 034 검증 통과 뒤.

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

## 3. 업로드 묶음 — 034 검증 뒤

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
