# Hit Smith (터져라! 대장간) — 방치형 제련 웨이브 게임

단일 파일 브라우저 게임. `src/forge.html` 을 열면 실행된다.
서버 없음, 빌드 없음, 의존성 없음 — 이게 이 프로젝트의 정체성이다.

## 폴더

```
index.html       루트 리다이렉트 3줄 → src/forge.html (게임 사본이 아니다)
.gitignore       배포에 안 들어갈 것 (node_modules·스크린샷·대용량 참고 그림)
CLAUDE.md        모든 세션이 먼저 읽는 공통 지침 (원칙·역할·완료 조건)
src/forge.html   게임 전체 (단일 파일 유지)
docs/DESIGN.md   확정 설계 — 여기 없는 시스템은 존재하지 않는 것
docs/BALANCE.md  수치·공식·근거·목표 페이싱 곡선
docs/ART-DIRECTION.md  화면·스프라이트·연출의 미술 규약
docs/ROADMAP.md  남은 일 (계획 세션만 수정)
docs/ref/        지시서가 가리키는 참고 그림·스프라이트 데이터
plans/           계획 세션이 쓰는 작업 지시서 (NNN-제목.md)
tools/           검증 도구 (node로 실행)
devtools/        검증 보조 (선택 — Playwright 체크리스트 자동화. 완료 조건 아님)
```

## Cowork 세션 분리

이 폴더를 Cowork의 작업 폴더로 지정하고, 역할별로 세션을 따로 연다.
각 세션 첫 메시지는 아래를 그대로 쓰면 된다.

**계획 세션**
> CLAUDE.md를 읽고 계획 세션 역할로 작업해. 내 요구: (요구사항).
> docs와 충돌 검사 후 plans/에 지시서를 만들어.

**코딩 세션**
> CLAUDE.md를 읽고 코딩 세션 역할로 작업해. plans/NNN-*.md 지시서를
> 구현해. 지시서에 없는 변경은 하지 마.

**디자인 세션**
> CLAUDE.md를 읽고 디자인 세션 역할로 작업해. plans/NNN-*.md 지시서를
> 구현해. 표시 계층(CSS·SVG·DOM·애니메이션) 밖은 건드리지 마.

**검증 세션**
> CLAUDE.md를 읽고 검증 세션 역할로 작업해. 최근 지시서 기준으로
> tools 전부 실행하고 DESIGN.md 하단 체크리스트를 검사해. 결과를
> 지시서 하단에 기록해.

## 배포 (GitHub Pages)

**빌드 없음 · 배포 스크립트 없음.** 이후 배포는 이것 한 줄이 전부다.

```
git add -A && git commit -m "무엇을 고쳤는지" && git push
```

### 최초 1회 설정

저장소 → **Settings** → 왼쪽 **Pages** → Build and deployment
→ Source: **Deploy from a branch** → Branch: **main** / **/ (root)** → Save.

⚠ `GitHub Actions` 를 고르면 안 된다. 이 저장소에는 **빌드할 것이 없고**,
Actions 를 켜는 순간 「빌드 스텝 없음」이라는 이 프로젝트의 자산이 깨진다
(CLAUDE.md 절대 원칙 2). Pages 는 무료 계정에서 **Public 저장소만** 켜진다.

### 루트 `index.html` 이 따로 있는 이유

게임은 `src/forge.html` **하나**다. 루트에 복사본을 두지 않는다 — 사본은 반드시
갈라진다. 대신 루트 `index.html` 이 meta refresh 로 보낸다.
⚠ 경로는 **상대경로**여야 한다. `/src/forge.html` 로 쓰면 프로젝트 페이지
(`계정.github.io/저장소/`)에서 깨진다. 둘 다 실제로 띄워서 확인한 사항이다.

### 로컬 확인

```
cd "<프로젝트 폴더>"
py -m http.server 8000      # 또는 python3 -m http.server 8000
```

`http://localhost:8000/` 이 게임으로 넘어가면 성공. `Ctrl+C` 로 종료.

### 저장소에 안 들어가는 것

`node_modules`·락파일·checklist 스크린샷·OS 부스러기, 그리고 **대용량 참고 그림
넷(29MB)**. 게임이 218KB 인데 참고 그림이 그 140배라 clone 만 무거워진다.
지우는 게 아니라 **추적에서 빼는 것**이라 로컬에는 그대로 남는다 — 목록과 이유는
`.gitignore` 주석에, 보관 방법은 `plans/022-deploy.md` 「제안」에 적혀 있다.

## 검증 명령

```
node tools/smoke.js   # 상호작용 19+ 시나리오. 실패 시 exit 1
node tools/days.js    # 페이싱 시뮬. BALANCE.md 목표 곡선과 대조
node devtools/checklist.js  # (선택) 수동 체크리스트 자동화. playwright 전역 설치 필요
node devtools/soak.js       # (선택) 누수 하니스. 0 통과 / 1 누수 의심 / 2 측정 불가
```

게임 자체의 self-check는 브라우저 콘솔에 출력된다 (assert 무오류 확인).

## 지금 상태

**001~021 전부 검증 통과.** 렌더링 대개편(007~017)은 끝났다 — Phaser 를 걷어내
**의존성 0** 이 됐고(gzip 362KB → 49KB), 2D 캔버스 두 겹 + 픽셀 스프라이트 32×32
26장 + 횡스크롤 무대 + 전투 모션이 올라가 있다. `src/forge.html` **218,434 B**
(gzip 72,961). 022 가 Pages 배포 껍데기를 세웠다.

forge.html 은 한 번에 한 세션만 수정한다 (CLAUDE.md 동시 작업 규칙 — 지시서의
「상태:」 줄이 락이다).
