# 028 — CrazyGames Basic Launch 제출 · 담당: 사용자 + 계획 세션

상태: **대기 — 035(표지·영상) 완료 뒤.** 게임 코드는 건드리지 않는다.
빌드: **034 검증 통과본**(`9f805e49…`). 제출 뒤에도 파일은 언제든 다시 올릴 수 있다(보통 당일 처리, FAQ).

## 1. 업로드 묶음 — `index.html` 한 장

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
