# submission/ — CrazyGames 제출 자산

035 §2 「미리보기 영상」의 산출물. **게임 파일(`src/forge.html`)은 한 글자도 안 바뀌었다.**
찍은 빌드: 커밋 **9dbf474 다음의 034 통과본** · `src/forge.html` md5 `9f805e49a017c1f44d490445e9deacb4`.

| 파일 | 크기 | 길이 | 용량 |
|---|---|---|---|
| `preview-landscape.mp4` | 1920×1080 (16:9) | 19.52초 | 3.76MB |
| `preview-portrait.mp4` | 1080×1620 (2:3) | 19.52초 | 3.00MB |
| `cover-slot-landscape.png` | 1920×1080 | — | 표지가 들어갈 **1.5초 자리**의 현재 그림 |
| `cover-slot-portrait.png` | 1080×1620 | — | 같음 |
| `record-preview.js` | — | — | 다시 찍는 각본 (아래) |

둘 다 h264 · yuv420p · 25fps · **오디오 스트림 0개** · SAR 1:1.

## 표지 — 끼워 넣음 (계획 세션 2026-10-02)

**현재 `preview-*.mp4` 는 아래 명령으로 표지(`cover-landscape.png`·`cover-portrait.png`)를 앞 1.5초에 넣은 최종본이다**
(19.56초 · 3.33MB / 2.62MB · blackdetect 0). `cover-slot-*.png` 는 이제 안 쓴다(무시 목록).

### 갈아 끼운 명령

지금 앞 1.5초는 **게임의 조용한 첫 화면을 그대로 멈춘 것**이다(검은 화면도, 로고도, 글자도 아니다).
표지 그림이 나오면 그 1.5초만 바꾼다. 게임플레이 18.0초는 그대로다.

```sh
# 가로
ffmpeg -y -loop 1 -t 1.5 -framerate 25 -i cover-landscape.png \
       -ss 1.5 -i preview-landscape.mp4 \
  -filter_complex "[0:v]scale=1920:1080:flags=lanczos,format=yuv420p,setsar=1[a];\
[1:v]format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart \
  preview-landscape-final.mp4

# 세로 (크기만 1080:1620 으로)
ffmpeg -y -loop 1 -t 1.5 -framerate 25 -i cover-portrait.png \
       -ss 1.5 -i preview-portrait.mp4 \
  -filter_complex "[0:v]scale=1080:1620:flags=lanczos,format=yuv420p,setsar=1[a];\
[1:v]format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart \
  preview-portrait-final.mp4
```

⚠ 이 명령은 게임플레이를 **한 번 더 인코딩**한다(crf 19 → 눈에 안 보이는 수준).
무손실로 붙이고 싶으면 `record-preview.js` 로 **다시 찍는 쪽**이 깨끗하다.

## 다시 찍는 법

```sh
npm i -g playwright && npx playwright install chromium     # 없으면
xvfb-run -a -s "-screen 0 1600x1200x24" node submission/record-preview.js            # 가로
MODE=port xvfb-run -a -s "-screen 0 1400x1400x24" node submission/record-preview.js  # 세로
```

찍히는 것은 `take-land/` · `take-port/` 의 **webm 원본**(960×540 · 540×810)과 `meta.json`
(안무 시점 기록). mp4 로 만드는 명령은 `meta.json` 의 `preroll` 을 `-ss` 에 넣어서:

```sh
ffmpeg -y -ss <preroll-0.08> -i take-land/*.webm -frames:v 1 -vf "scale=1920:1080:flags=neighbor" slot.png
ffmpeg -y -loop 1 -t 1.5 -framerate 25 -i slot.png -ss <preroll> -t 18.0 -i take-land/*.webm \
  -filter_complex "[0:v]format=yuv420p,setsar=1[a];\
[1:v]scale=1920:1080:flags=neighbor,fps=25,format=yuv420p,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -movflags +faststart preview-landscape.mp4
```

## 왜 절반 크기로 찍고 ×2 로 키우는가 — 세 번 밟고 고른 길

1. **`recordVideo.size` 는 확대가 아니라 여백 채우기다.** 뷰포트 960×540 에 size 1920×1080 을
   주면 왼쪽 위 960×540 만 게임이고 나머지 세 분면이 회색(실측 Y=127)이다.
2. **1920×1080 을 CSS 뷰포트로 쓰면 화면이 텅 빈다.** UI 가 위쪽 45%만 채우고 아래 절반이
   빈 배경이다 — 요건이 막는 「검은 띠」는 아니지만 미리보기로는 못 쓴다.
3. **`transform:scale(2)` 로 레이아웃만 반으로 잡는 수법은 상자 좌표가 정확히 2배로 맞는데도
   무대 캔버스가 깨진다** — 몹이 안 그려진다. 몹이 쓰러지는 장면은 이 영상의 필수 구성이라 버렸다.

→ **손대지 않은 게임을 960×540 / 540×810 에서 찍고, ffmpeg 에서 정확히 ×2 `neighbor` 로 키운다.**
한 픽셀이 2×2 가 될 뿐 색을 섞지 않는다. 이 게임은 `image-rendering:pixelated` 로 **정수 배율을
전제**하므로(forge.html 1859행 주석) 1.5배 같은 비정수 확대는 픽셀이 들쭉날쭉해진다.

## 구성 (둘 다 같은 각본 · 배속 없음 · 실제 시간 · 실제 난수)

`?lang=en` · 새 세이브(localStorage 비움) · 커서 숨김 · 시계 조작 없음.

| 구간 | 내용 |
|---|---|
| 0.0~1.5초 | **표지 자리** (정지 화면) |
| 1.5~4.8초 | 첫 제련 5회 — 릴이 돌고 멈추며 정렬·등급 불빛 |
| 4.8~6.3초 | 대기열에서 하나 장착 — 비교 팝업의 「Power after swap」, 전투력이 오른다 |
| 6.3~19.5초 | 「Auto」 — 장비가 흐르고 전투력이 오르고, 무대에서 몹이 쓰러지고 웨이브가 넘어간다. 골드가 모이면 「Upgrade」를 누른다 |

실측(가로): 전투력 **5 → 372**, 웨이브 **1 → 8**(2·3·4·5·6·7 전환이 영상 안에), 강화 2회, 콘솔 0건.
실측(세로): 전투력 **5 → 704**, 웨이브 **1 → 5**(2·3·4 전환이 영상 안에), 강화 2회, 콘솔 0건.

## 요건 대조

| 요건 | 결과 |
|---|---|
| 50MB 이하 | **3.76MB · 3.00MB** |
| 소리 없음 | **오디오 스트림 0개** (게임에 소리 자체가 없다 — `AudioContext`·`<audio>` 0건) |
| 표지로 시작 | **표지 1.5초 → 게임플레이** (자르기 하나) |
| 검은 화면 금지 | `blackdetect` **0건** · 가장 어두운 프레임 평균 Y **36.9 / 38.9** |
| 로고·전환 효과 금지 | 없음 — 정지 화면에서 게임플레이로 **자르기 하나**, 페이드·와이프 없음 |
| 양옆 검은 띠 금지 | 테두리 6px 밝기 최솟값 **22.2~40.3** (0 이 아니다 = 띠가 아니라 게임 배경) |
| 기본 마우스 커서 금지 | 커서 숨김 주입 + **마우스를 아예 안 움직였다**(페이지 안에서 `.click()`) · 왼쪽 위 28×28 최대 밝기 85/38 |
| 「Play Now」 같은 글자 금지 | 덧붙인 글자 0 — 화면 글자는 게임 UI 뿐 |
| 빨리감기 금지 | 25fps 실시간 · 배속·시계 조작 없음 · 중간 잘라 붙인 곳 없음(앞 흰 화면과 뒤 꼬리만 잘랐다) |
| 세로는 세로 배치 | 540×810 = 2:3 → `@media (orientation:landscape)` **밖** · 제목판·3단 세로 배치 확인 |
