# 힉스필드 프롬프트 (2026-09-14 · 2차)

1차 시험 결과는 `higgsfield-test-01.md`. 요지:
**무기는 통과, 장갑은 실루엣이 비어서 낙제.** 1차에서 배운 것을 공통 규칙에
반영했다. 1차 프롬프트는 이 문서 맨 아래 「1차 기록」에 남겨 둔다.

---

## 0. 공통 규칙 (모든 프롬프트 앞에 붙일 것)

```
32x32 pixel art sprite, orthographic view, centered,
GRAYSCALE ONLY - no hue, pure black white and grey,
exactly 4 value steps: near-black outline, dark tone, mid tone, bright highlight,
strong separation between the 4 values - never two similar greys touching,
thick hard black outline on every edge, flat fills,
light source from upper-left,
NO anti-aliasing, NO dithering, NO gradients, NO text, NO background scenery,
crisp hard pixel edges, 16-bit SNES RPG sprite style,
solid flat magenta background (#FF00FF), nothing in the lower-right corner
```

### 1차에서 고친 네 가지

1. **흑백으로 뽑는다.** 우리 파이프라인은 휘도 4단만 저장하고 색은
   `--g1~--g15` 에서 온다. 1차의 갈색 가죽·금 상감은 **변환에서 전부 버려졌고**,
   t1 에서는 갈색과 쇠의 휘도가 붙어 안쪽이 뭉갰다. 색을 쓰면 손해만 본다.
2. **배경은 단색 마젠타.** 1차는 "transparent background"라고 적었는데 알파
   최솟값이 191 인 **가짜 투명**(체커보드가 픽셀로 구워짐)이 왔다. 격자 모형을
   세워 벗겨 내야 했다.
3. **우하단을 비운다.** 워터마크가 장갑 t3 아랫단을 물었다.
4. **"1px 외곽선"을 부탁하지 않는다.** 축소하면 어차피 부서진다(적중 33~79%).
   대신 **두껍고 새까맣게** 달라고 하고, 1칸 외곽선은 축소 뒤 우리가 긋는다.

---

## 1. 무기 — 확정. 재생성 불필요

1차 3장이 네 판정을 모두 통과했다(주축 47°, 경계상자 27~28×30, 실루엣 판독됨).
**흑백 규칙이 바뀌었으므로 같은 프롬프트에 새 공통 규칙만 갈아 끼워 다시 뽑되,
형태는 1차와 같은 것을 고른다.** 축은 **왼쪽 아래 → 오른쪽 위 대각선**.

---

## 2. 장갑 — 자세를 바꿔 재생성 (두 번째 실패 자리)

**진단**: "손가락은 홈으로"(벌레 다리 방지)와 "실루엣만으로 부위가 갈릴 것"이
**정면 주먹 자세에서는 동시에 성립하지 않는다.** 정보가 전부 안쪽 음영으로
가서 바깥은 땅콩이 된다. t1↔t2 실루엣 겹침 0.89 — 단계도 못 나른다.

**해법은 손가락 처리가 아니라 자세다.** 옆으로 세워 윤곽에 단을 만든다.
세로축(91°)과 홈 규칙은 그대로 유지된다.

**t1 (1~5등급) — 조악**
```
[공통 규칙] + a crude iron gauntlet shown from the SIDE in profile,
standing upright and empty with no arm inside.
Shape from bottom to top: a WIDE FLARED cuff at the bottom that is the
widest part of the whole sprite, then a NARROW waist at the wrist,
then a closed fist block at the top that is clearly WIDER than the wrist.
Exactly THREE large rounded knuckle bumps along the upper-right edge.
ONE thumb bump sticking out of the left edge at mid height.
Fingers are only shallow grooves inside the fist block.
NO separate finger tubes, NO comb of vertical fingers, NO fingertips
pointing upward, NO claws. The outer outline must be a STEPPED profile,
not a smooth oval. Rough uneven hammered plates, chipped edges.
```

**t2 (6~10등급) — 정제**
```
[공통 규칙] + a well-forged steel gauntlet shown from the SIDE in profile,
standing upright and empty. Same stepped profile: wide flared cuff at the
bottom, narrow wrist waist, fist block wider than the wrist at the top,
THREE rounded knuckle bumps on the upper-right edge, ONE thumb bump on the
left edge at mid height. Fingers only as shallow grooves.
Clean banded cuff, smooth symmetric plates, sharp even edges.
NO separate finger tubes, NO claws.
```

**t3 (11~15등급) — 세공**
```
[공통 규칙] + an ornate masterwork gauntlet shown from the SIDE in profile,
standing upright and empty. EXACTLY the same outer size and stepped profile
as a plain gauntlet: wide flared cuff, narrow wrist, wider fist block,
THREE knuckle bumps on the upper-right edge, ONE thumb bump on the left.
Ornamentation is engraved INSIDE the silhouette only - layered overlapping
plates and fine engraved scrollwork on the cuff.
NO claws, NO spikes, NO talons, NO wings, nothing extending past the outline.
```

> **합격 기준**: 검정 실루엣만 놓고 봤을 때 ① 장갑으로 읽히고 ② t1↔t2 겹침이
> **0.80 미만**(1차 0.89)이어야 한다. 두 조건 중 하나라도 못 넘기면 다시 뽑는다.

---

## 3. 몹 6장 — 근접 3 + 원거리 3

015 가 세운 구분을 그대로 쓴다. **판별 근거는 채움 비율이 아니라 구멍이다**
(013 검증: 섞인 웨이브에서 채움은 3.2%p 밖에 안 갈리지만 구멍은 0.0% 대
6.8~7.3% 로 범주가 갈린다). 그래서 프롬프트가 **뚫린 구멍을 명시**한다.

### 3-A. 근접 — 채움. 아래가 넓은 덩어리. **구멍 0개**

**t1 / t2 / t3 공통 뼈대**: 웅크린 어깨가 넓고 다리가 짧다. 팔은 몸통에 붙어
있다. 실루엣 안에 뚫린 칸이 하나도 없어야 한다.

```
[공통 규칙] + a hunched armored brute monster, front view, standing.
SOLID FILLED silhouette with NO holes anywhere - no gaps between arms and
body, no gap between the legs. Very WIDE heavy shoulders at the top,
SHORT thick legs, body widest at the bottom like a wedge.
Arms pressed against the torso. Head sunk low between the shoulders.
NO horns, NO spikes, NO tails, NO wings, nothing thin sticking out.
[t1] crude ragged hide and bone plates, asymmetric, lumpy
[t2] fitted iron plate armor, symmetric, clean banded edges
[t3] same outer size as a plain brute, layered engraved armor,
     dense interior detail, ornamentation stays INSIDE the silhouette
```

### 3-B. 원거리 — 비움. 위가 좁고 세로로 섬. **뚫린 구멍 필수**

```
[공통 규칙] + a gaunt skeletal archer monster, front view, standing tall.
TALL and NARROW - much taller than wide, narrow at the top.
It holds a large bow vertically in front of its body, and the bow plus the
bowstring form a FULLY ENCLOSED HOLE through the sprite - background shows
through that hole. The ribcage also shows TWO enclosed gaps.
Thin body, long straight legs with a gap between them.
NO horns, NO wings, NO spikes, NO tentacles.
[t1] cracked bare bone, crude uneven bow, asymmetric
[t2] bone in fitted leather wraps, clean recurve bow, symmetric
[t3] same outer size as a plain archer, engraved bone and layered wraps,
     dense interior detail, ornamentation stays INSIDE the silhouette
```

> **합격 기준**: 검정 실루엣에서 **바깥에서 못 닿는 칸**(진짜 구멍)이
> 근접 3장 모두 **0칸**, 원거리 3장 모두 **30칸 이상**(015 기준 42칸).
> 그리고 근접과 원거리의 주축·이심률이 갈려야 한다.

---

## 4. 용사 1장 — 제3의 처리

몹 2축(근접=채움 / 원거리=구멍) 어느 쪽과도 겹치지 않아야 한다(015 §2-B).
**채움이되 근접과 달리 세로로 서고 어깨가 좁다.** 장비 등급·부위는 반영하지
않는다 — 반영하면 손그림이 폭발한다(원칙 3).

```
[공통 규칙] + a lone hero knight standing and bracing, front view.
SOLID FILLED silhouette with NO holes. Stands TALL and UPRIGHT with
NARROW shoulders - clearly taller than wide, unlike a hunched brute.
Feet planted apart, knees slightly bent, body squared to the viewer.
A round shield held flat against the chest as one solid mass.
Hooded cloak falling straight down to the ankles.
NO weapon in hand, NO horns, NO wings, NO cape flare, nothing thin sticking out.
```

> **무기를 들려 주지 말 것.** 휘두르는 표현은 013 이 무기 궤적으로 만들고
> 궤적에는 012 의 장비 스프라이트를 태운다. 손에 칼을 그려 넣으면 두 벌이 된다.

---

## 5. 뽑을 때 지킬 것

1. **같은 스타일·시드로 한 벌씩 연속 생성.** 벌이 섞이면 한 줄에 놨을 때 무리로
   안 보인다. 가능하면 1차 무기 t2 를 스타일 참조로 건다.
2. **배경은 단색 마젠타 하나. 우하단은 비워 둘 것**(워터마크 자리).
3. **PNG 원본 그대로.** 리사이즈·JPEG 저장 금지.
4. 순서: **장갑 3장 → 몹 6장 → 용사 1장.** 장갑이 합격 기준을 넘지 못하면
   몹으로 넘어가지 말고 장갑부터 다시 뽑는다 — 같은 실패를 여섯 배로 키우지
   않는다.

## 6. 받은 뒤 계획 세션이 할 일 (1차와 동일)

1. 배경 제거 → 부위별 공통 배율로 32×32 축소 → 휘도 k-means 4단 → 인덱스 문자열
2. **축소 후 테두리 한 칸을 인덱스 1로 강제** (1차에서 신설, 외곽선 적중 100%)
3. 검정 실루엣 테스트 / 등급 15종 파생 / 축 서명·경계상자 / 구멍 수 측정
4. 넷을 통과하면 `forge.html` 교체를 구현 세션에 지시한다

---

## 1차 기록 (2026-09-14 · 무기·장갑 6장, 판정은 `higgsfield-test-01.md`)

1차 공통 규칙은 색 5색 · "transparent background" · "1px dark outline" 을
요구했다. 셋 다 2차에서 바꿨다(§0). 1차 장갑 프롬프트는 손가락을 "위쪽 모서리의
얕은 홈"으로만 지정했고, 그 결과가 §2 의 진단으로 이어졌다.
