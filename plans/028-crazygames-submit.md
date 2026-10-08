# 028 — CrazyGames Basic Launch 제출 · 담당: 사용자 + 계획 세션

상태: **반려 (REJECTED, 2026-10-08 확인)** — 이전: 제출 2026-10-02 (Build ID `01da586a-a4b6-47b8-934a-3e7055d7015f`). 게임 코드는 건드리지 않는다.
빌드: **034 검증 통과본**(`9f805e49…`). 제출 뒤에도 파일은 언제든 다시 올릴 수 있다(보통 당일 처리, FAQ).

## 1. 업로드 묶음 — `index.html` 한 장

⚠ **정정(2026-10-02 포털 실측): 포털은 zip 을 받지 않는다**(「Archive files are not supported」).
아래 명령으로 만든 **`upload\index.html` 파일 하나를 업로드 칸에 직접 끌어 놓는다.** zip 줄은 무시.

CrazyGames 에 올릴 묶음은 **`src/forge.html` 을 `index.html` 이라는 이름으로 담은 zip 하나**다.
게임이 정말로 파일 하나라서(외부 요청 0, 상대경로 자원 0) 리다이렉트 페이지를 끼울 이유가 없다.

⚠ **이것은 저장소 안의 사본이 아니다.** 압축하려고 잠깐 만드는 꾸러미이고 추적하지 않는다
(`.gitignore` 에 `upload/` 와 `*.zip` 을 더한다). 「사본은 반드시 갈라진다」(022)는 **저장소에 두 벌을
두는 것**을 막는 규칙이다 — 올릴 때마다 원본에서 새로 만든다.

```
cd "C:\Users\user\Desktop\claude\방치형 게임 개발"
Remove-Item upload, hit-smith-upload.zip -Recurse -ErrorAction SilentlyContinue
New-Item upload -ItemType Directory | Out-Null
Copy-Item src\forge.html upload\index.html
Compress-Archive -Path upload\index.html -DestinationPath hit-smith-upload.zip
(Get-FileHash upload\index.html -Algorithm MD5).Hash
```

마지막 줄이 **`9F805E49…`** 로 시작해야 한다(034 검증 통과본). 다르면 멈추고 알릴 것.
⚠ `Compress-Archive` 에 `src\forge.html` 을 바로 주면 폴더가 사라지고 이름도 `forge.html` 로 남는다 —
그래서 꾸러미 폴더를 거친다.

## 2. 포털에 적을 것 (영어)

**Title:** `Hit Smith`

**Short description:**
> Forge gear at the anvil, power up your hero, and push through endless waves — even while you're away.

**Description:**
> Hit Smith is a pixel-art idle forging game.
>
> Every strike of the anvil forges a new piece of gear — weapons, helms, armor, greaves, gloves and boots across 15 grades. Forge matching pieces for higher grades, keep the best, sell the rest, and your hero fights on by itself.
>
> • Forge and equip gear across 15 grades
> • Auto and Sort keep the forge running while you watch — or while you're away
> • Upgrade your forge to unlock higher grades
> • Climb the Endless Tower for Stardust and spend it in the Tech tree
> • Ascend to start again, stronger

**Controls:**
> Mouse / touch. Tap **Forge** to forge. Tap **Auto** to forge automatically. **Sort** keeps the queue moving by itself. Tap an item in the forge to lock it.

**태그(고를 수 있는 만큼):** Idle · Incremental · Clicker · Crafting · Pixel · RPG
**방향:** 가로·세로 둘 다(데스크톱 가로 · 모바일 세로 지원).

⚠ 문구 금지어 — spin · slot · reel · jackpot · bet · gamble · lucky · casino · payout (원칙 7, 034 와 같다).

## 3. 올린 뒤 바로 볼 것 (포털 미리보기 화면에서)

1. 게임이 뜨고 **바로 제련할 수 있다**(요건: 즉시 게임플레이).
2. F12 콘솔에 `__view.plat` → **`env: "crazygames"`**, `ready: true`. 광고 버튼은 **안 보인다**
   (`ADS_LIVE=false` — Basic Launch 는 광고가 꺼져 있다). `env` 가 `disabled` 면 **사이트락 목록이 안 맞는 것** —
   멈추고 알릴 것(026 제안 ⑷: 이때는 오류 없이 수익이 0 이 된다).
3. 언어: 영어 브라우저면 영어, 한국어 브라우저면 한국어.
4. 콘솔 오류 0.

## 4. 제출 뒤

- Basic Launch 는 **작은 비율의 플레이어**에게 보여 주고 지표를 본다. 그 기간에 **025 체류 보상**을 넣는다.
- Full Launch 전환(029): Data 모듈 저장(양쪽 쓰기) · `ADS_LIVE=true` · 광고 실패 한 줄 알림 · 티켓 훅 판정.

## 구현 결과 · 제안 · 검증 기록
- (각 세션이 기록 — **재작성 시 이 절을 지우지 말 것**)
- **계획 세션 2026-10-02 — 업로드·미리보기 기록.**
  - 포털 1단계(Upload) 입력: Game name `Hit Smith` · engine `HTML5` · 파일 `index.html`(md5 `9F805E49…`, zip 거부됨) ·
    저장 = **「Yes, using LocalStorage (refer to Automatic Progress Save)」**(HTML5 를 고르면 넷째 선택지로 생긴다) ·
    mobile ✔ · orientation `BOTH` · multiplayer ✗ · SDK 음소거 ✗.
  - 저장 선택지 아래 경고 「For iframe games our Automatic Progress Save does not work」 — **URL 을 iframe 으로 등록한 게임**
    얘기로 판단(우리는 파일 업로드). ⚠ 추정이다 — Basic Launch 중 **다른 기기·로그인으로 진행이 이어지는지** 실측.
    안 이어지면 029 에서 Data 모듈로 간다.
  - 미리보기 실측: 총 0.3MB · 로드 0.1MB · 로드 1.8초 · SDK 패널 **Gameplay Start 초록** ·
    게임 프레임 콘솔 `__view.plat` → **`{env:'crazygames', ready:true, adsOn:false, paused:false, blocked:false}`** ·
    한국어 브라우저 → 한국어. 콘솔 빨간 줄(sharethrough·alkimi·googlesyndication 등)은 **포털 광고 스크립트**, 우리 것 아님.
  - 첫 캡처에서 위가 잘려 보인 것은 **CrazyGames 페이지가 스크롤된 것**이었다 — 맨 위로 올린 화면에서 HUD·무대·패널·탭 전부 보임(≈1054×580 프레임).
- **029 에 미치는 것**: Full Launch 의 진행 저장 요건은 Data 모듈 · 자체 백엔드 · **APS** 중 하나(account-integration 문서, 인앱 결제 없는 게임만 APS).
  APS 가 실측으로 동작하면 **029 의 「Data 모듈 양쪽 쓰기」는 빠진다** — 029 는 `ADS_LIVE` · 광고 실패 알림 · 티켓 훅만 남는다.
- **계획 세션 2026-10-02 — 제출 완료.** 상태 `AWAITING REVIEW`, 카테고리 Clicker, Build `01da586a-…7015f`(= `src/forge.html` md5 `9f805e49…`).
  - QA 체크리스트(Basic): 자동 2(용량·Gameplay Start) + 수동 전부 Yes · 약관/개인정보 = N/A.
  - Details: 정사각 표지는 사용자가 **`cover-square-alt.png`**(망치 클로즈업) 선택. 표지 v2 — 포털 자르기 창의 **왼쪽 위 라벨 자리**(가로 ≈764×211 · 세로 ≈317×118 · 정사각 ≈280×240px)를 피해 제목을 옮김(`compose2.py`, 계획 세션 scratch).
    영상은 v2 표지로 다시 이음.
  - **「The game works well in fullscreen」 끔** — 1920×1080 에서 UI 가 위 45%만 채운다(036). 036 반영 빌드에서 다시 켠다.
  - Billing(Tipalti): 개인 · 국내 계좌 KRW · EU VAT 미등록. 지급 최소 USD 100, 건당 EUR 6.42 + 환전 수수료.
  - 포털 함정: zip 거부(파일 직접) · 저장 질문의 넷째 선택지는 HTML5 를 골라야 생김 · Billing 미등록이면 4단계에 「Error fetching payment details」.
- **심사 중 원칙**: 심사 결과가 오기 전에는 **새 버전을 올리지 않는다**(심사 대상이 바뀐다). 036·025-2 는 저장소에서 진행하고 결과를 받은 뒤 한 번에 올린다.
- **계획 세션 2026-10-08 — 반려.** 포털 상태 `REJECTED`. 피드백 원문:
  「Your submission has been rejected … **The overall quality of the game does not yet meet the expectations of our platform.**」
  기술 항목(용량·SDK·사이트락·Gameplay Start)은 미리보기에서 전부 통과했다 — **반려 사유는 품질(첫인상·재미) 판정**이다.
  게임 페이지에 「Submit new version」 버튼이 사라지고 「Remove game」만 남았다. FAQ: 「meaningful improvements」 뒤 재제출 가능, 대기 기간 명시 없음.
  다음 방향(개선 후 재제출 / 다른 포털 / 정리)은 사용자 판단 대기.
