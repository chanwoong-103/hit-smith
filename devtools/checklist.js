// ─────────────────────────────────────────────────────────────────────────────
// checklist.js — docs/DESIGN.md 하단 「수동 플레이 체크리스트」를 실제 브라우저에서
// 자동 재현한다. 모바일 폭 380px 고정.
//
// 이 도구는 **완료 조건이 아니다** (CLAUDE.md devtools/ 규정). 합·불 판정은
// tools/smoke.js + tools/days.js + 사람이 직접 하는 수동 체크리스트로 한다.
// 이건 그 수동 확인을 빠르게 대신 돌려보는 보조 도구다.
//
// 설치 — **저장소 안에 설치하지 말 것** (node_modules·package-lock 커밋 금지).
// 전역으로 깔면 이 스크립트가 알아서 찾는다 (npm root -g 조회):
//   npm i -g playwright
//   npx playwright install chromium
// 실행:
//   node devtools/checklist.js
//
// 전역 설치가 싫으면 저장소 밖 아무 폴더에 깔고 PW_HOME 으로 알려주면 된다:
//   Windows : npm i playwright --prefix %TEMP%\pw
//             set PW_HOME=%TEMP%\pw&& node devtools\checklist.js
//   mac/리눅스: npm i playwright --prefix /tmp/pw
//             PW_HOME=/tmp/pw node devtools/checklist.js
//
// 스크린샷은 기본적으로 OS 임시 폴더에 떨어진다 (저장소를 더럽히지 않으려고).
// 다른 곳에 두려면: node devtools/checklist.js --shots ./out
//
// 종료 코드: 실패 0건이면 0, 있으면 1. WARN 은 실패로 세지 않는다 (아래 KNOWN).
//
// 게임 내부를 직접 부르는 이유: 스핀·천장·승천은 확률이라 UI 클릭만으로는
// 재현이 안 된다. page.evaluate 안에서 S / spin() / render() 를 그대로 쓴다.
// 스핀 콜백이 420ms 이므로 spin() 뒤에는 500ms 이상 기다려야 한다.
// 정렬 결과가 필요한 검사는 Math.random 을 큐로 갈아끼워 고정한다
// (예: [0,0,0] = 3연, [0,0,0.9] = 2연).
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const os = require('os');

// playwright 를 저장소 밖에서 찾는다: 지역 → PW_HOME → 전역 npm root.
function loadPlaywright() {
  const tries = ['playwright'];
  if (process.env.PW_HOME) tries.push(path.join(process.env.PW_HOME, 'node_modules', 'playwright'));
  try {
    const root = require('child_process')
      .execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    if (root) tries.push(path.join(root, 'playwright'));
  } catch { /* npm 이 없으면 그냥 넘어간다 */ }
  for (const t of tries) { try { return require(t); } catch { /* 다음 후보 */ } }
  return null;
}

const pw = loadPlaywright();
if (!pw) {
  console.error('playwright 를 못 찾았다. 파일 상단 주석의 설치 절차를 먼저 밟을 것.\n' +
    '  npm i -g playwright && npx playwright install chromium');
  process.exit(2);
}
const { chromium } = pw;

const URL = 'file://' + path.join(__dirname, '..', 'src', 'forge.html');
const ai = process.argv.indexOf('--shots');
const SHOTS = ai > -1 ? process.argv[ai + 1] : os.tmpdir();

// 이미 지시서에 기록된 선행 결함을 실패로 세지 않고 WARN 으로만 띄우는 목록.
// **비어 있는 게 정상이다.** 003 이 고친 3항목(`초기 상한이 5가 아님` ·
// `초기 대기창이 10칸이 아님` · `릴 수 오류`)은 004 검증에서 제거했다 —
// 이제 다시 나오면 FAIL 로 잡힌다. 여기에 무언가를 넣는 것은 "지시서에 적힌
// 선행 결함을 잠시 눈감는다"는 뜻이므로, 넣을 때는 지시서 번호를 같이 적을 것.
const KNOWN = [];

/* ── 020 판정(2026-09-16)이 들여온 잣대 둘 ────────────────────────────────
   ① **1-최근접 무리 판별** — 검정 실루엣 IoU. 각 장이 «다른 무리의 어떤 것보다
      자기 무리의 어떤 것과 더 닮을 것». ART-DIRECTION 2026-09-15 판정이 세운
      규칙이고, 수단(구멍·자세·든 물건)은 정하지 않는다.
      ⚠ IoU 는 **원시 격자**에서 잰다 — 경계상자로 정규화하면 값이 부풀어
      (근접끼리 0.90~0.93) 020 이 보고한 0.80~0.90 과 어긋난다. 원시 격자로
      재면 그 수치가 그대로 재현된다.
      ⚠ 이 검사는 **무리가 갈리는지**를 보지 **이름이 맞는지**는 못 본다.
      두 무리를 통째로 맞바꾸면 분리는 그대로라 통과한다 — 한 장만 건너가는
      경우가 이 검사가 잡는 결함이다.
   ② **면적비** — 「경계상자 완전 동일」을 대신한다(SG2). t1·t2·t3 가 같은 물건의
      정제 단계가 아니라 서로 다른 재질이라 상자가 4칸까지 어긋난다. */
const silh = px => { const a = new Uint8Array(px.length);
  for (let i = 0; i < px.length; i++) a[i] = (px[i] !== '.' && px[i] !== '0') ? 1 : 0;
  return a; };
const iouOf = (a, b) => { let inter = 0, uni = 0;
  for (let i = 0; i < a.length; i++) { if (a[i] && b[i]) inter++; if (a[i] || b[i]) uni++; }
  return uni ? inter / uni : 0; };
// members: {id: {group, px}} → 무리를 벗어난 장의 목록과 여유를 낸다.
const oneNN = members => {
  const ids = Object.keys(members);
  const sil = {}; ids.forEach(i => sil[i] = silh(members[i].px));
  const rows = [], bad = [];
  for (const a of ids) {
    const ga = members[a].group;
    let best = null, sameMax = -1, diffMax = -1;
    for (const b of ids) {
      if (b === a) continue;
      const v = iouOf(sil[a], sil[b]);
      if (!best || v > best.v) best = { id: b, v };
      if (members[b].group === ga) { if (v > sameMax) sameMax = v; }
      else if (v > diffMax) diffMax = v;
    }
    const ok = best && members[best.id].group === ga;
    rows.push({ id: a, near: best && best.id, v: best ? best.v : -1, ok, sameMax, diffMax });
    if (!ok) bad.push(`${a}→${best && best.id}(${(best ? best.v : 0).toFixed(2)})`);
  }
  const margin = rows.reduce((m, r) => Math.min(m, r.sameMax - r.diffMax), 9);
  return { rows, bad, margin, n: ids.length };
};

const R = [];
const chk = (name, cond, note) => {
  const known = !cond && KNOWN.some(k => String(note || '').includes(k));
  R.push([cond ? 'PASS' : known ? 'WARN' : 'FAIL', name, note || '']);
};

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 380, height: 820 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'assert') errs.push(m.text()); });
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  let dialogs = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });

  await page.goto(URL);
  await page.waitForTimeout(400);

  // ── 1. 첫 접속 ──
  const chg = await page.textContent('#chg');
  /* 032: 시작 충전 30 → **가득 찬 화로**. 값을 다시 박는 대신 페이지가 말하는
     `CHG_MAX()` 와 대조한다 — 그래야 `CHG_MAX` 의 기본값이 바뀌어도 이 검사가 같이
     따라가고, 「기본 상태가 상한보다 적다」는 032 의 결함이 되돌아오면 **운다**.
     느슨해진 것이 아니다: 예전 판정은 「30 언저리」였고 지금은 「상한과 같다」다. */
  const chgMax = await page.evaluate(() => CHG_MAX());
  chk('1a 첫 접속 충전 = 가득 (CHG_MAX)', Math.abs(+chg - chgMax) <= 1,
    'chg=' + chg + ' · CHG_MAX()=' + chgMax + ' (032 전에는 30)');
  chk('1b 스핀 즉시 가능', !(await page.isDisabled('#spin')));
  // 첫 화면에 **실제로 보이는 글자**만 훑는다. page.textContent('body') 를 쓰면
  // 인라인 <script> 소스가 통째로 딸려 들어와, 코드 주석에 "타이머"라고만 써도
  // UI 와 무관하게 FAIL 이 났다 (003·004 두 번 밟음). 이제 화면에 그려지는
  // 패널의 innerText 만 본다 — 숨겨진(게이팅된) 패널도 자동으로 빠진다.
  const shown = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('.panel'), document.getElementById('forge')])]
      .filter(e => e && getComputedStyle(e).display !== 'none')
      .map(e => e.innerText).join('\n'));
  chk('1c 데일리/타이머 문구 없음', !/데일리|출석|남은 시간|타이머/.test(shown),
    (shown.match(/데일리|출석|남은 시간|타이머/g) || []).join(','));
  // 원칙 7 의 시간 압박 표기 금지 = 004 §3 의 완료 조건. 첫 화면에 분·초·시간
  // 단위 숫자가 0건이어야 한다 (배속 진행 중 표시는 첫 화면이 아니라 통과).
  chk('1d 첫 화면 분·초 표기 0', !/\d+\s*(분|초|시간)/.test(shown),
    (shown.match(/\d+\s*(분|초|시간)/g) || []).join(','));

  // ── 첫 화면 점진 노출 (003 §3, GATE_WAVE 10) ──
  // 002 디자인 세션이 패널 구조를 만지면 가장 먼저 깨질 자리라 상시 검사로 둔다.
  const gate = await page.evaluate(() => {
    const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const before = { tower: vis('pTower'), tech: vis('pTech'), txt: document.body.innerText };
    S.top = 10; renderFast();                       // 게이트 문턱 도달
    return { before, after: { tower: vis('pTower'), tech: vis('pTech'),
      reveal: document.querySelectorAll('.reveal').length } };
  });
  chk('G1 새 게임에서 층·테크 패널 숨김', !gate.before.tower && !gate.before.tech,
    '층=' + gate.before.tower + ' 테크=' + gate.before.tech);
  chk('G2 첫 화면에 🎟·✦ 없음', !/🎟|✦|무한의 층|테크트리/.test(gate.before.txt),
    (gate.before.txt.match(/🎟|✦|무한의 층|테크트리/g) || []).join(','));
  chk('G3 웨이브 10 도달 시 노출 + 1회 강조', gate.after.tower && gate.after.tech &&
    gate.after.reveal === 2, '층=' + gate.after.tower + ' 테크=' + gate.after.tech +
    ' reveal=' + gate.after.reveal);

  // ── 웨이브 연출 (001) 회귀 방지 ──
  const foe = await page.evaluate(() => {
    const m = document.getElementById('mob');
    return { n: m.children.length, mobW: m.getBoundingClientRect().width,
             text: document.getElementById('foes').textContent };
  });
  chk('V1 적 블록 5~9개', foe.n >= 5 && foe.n <= 9, 'n=' + foe.n);
  chk('V2 무리 종류 표시', /근접|원거리|혼합/.test(foe.text), foe.text);
  chk('V3 무리 폭이 화면 안', foe.mobW <= 380, foe.mobW + 'px');

  // 근접/원거리/혼합 색 구분 (웨이브 %3 으로 종류가 갈린다)
  const kind = await page.evaluate(() => {
    const out = {};
    for (const w of [1, 2, 3]) {                    // 1=근접, 2=혼합, 3=원거리
      S.wave = w; newWave();
      out[w] = [...new Set([...document.getElementById('mob').children].map(e => {
        const c = getComputedStyle(e);
        return c.backgroundColor + '|' + c.borderTopColor;
      }))];
    }
    S.wave = 1; newWave();
    return out;
  });
  chk('V4 근접/원거리 색 구분', kind[1][0] !== kind[3][0],
    '근접=' + kind[1][0] + ' 원거리=' + kind[3][0]);
  chk('V5 혼합은 두 종류 섞임', kind[2].length === 2, kind[2].length + '종');

  // 처치 연출: 체력 비율만큼 소멸 + 애니메이션이 개체당 1회
  const dead = await page.evaluate(() => {
    S.wave = 1; newWave();
    foeHP = foeMax * 0.5; drawFoes();
    const els = [...document.getElementById('mob').children];
    const d = els.filter(e => e.classList.contains('dead'));
    const anim = d[0] ? getComputedStyle(d[0]).animationName : null;
    const before = els.map(e => e.dataset.d).join('');
    drawFoes();                                     // 같은 상태로 재호출
    return { n: d.length, total: els.length, anim,
             stable: before === els.map(e => e.dataset.d).join('') };
  });
  chk('V6 체력 50%에 절반 소멸', dead.n > 0 && dead.n < dead.total, dead.n + '/' + dead.total);
  chk('V7 처치 애니메이션 존재', dead.anim === 'foedie', String(dead.anim));
  chk('V8 재호출 시 상태 안 흔들림(애니메이션 1회)', dead.stable);

  // renderFast 원칙: 틱이 #mob 을 재구성하면 안 된다
  chk('V9 틱이 무리를 재구성하지 않음', await page.evaluate(() => {
    S.wave = 5; newWave();
    const first = document.getElementById('mob').children[0];
    for (let i = 0; i < 8; i++) tick();
    return document.getElementById('mob').children[0] === first;
  }));

  // ── 2. 니어미스 하이라이트 / 강조 메시지 ──
  const style = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.reel')];
    els.forEach(e => e.classList.add('hit'));
    const h = getComputedStyle(els[0]);
    const hit = h.borderTopColor + '/' + h.boxShadow;
    els.forEach(e => e.classList.remove('hit'));
    const p = getComputedStyle(els[0]);
    const plain = p.borderTopColor + '/' + p.boxShadow;
    const m = document.getElementById('msg');
    m.className = 'big';
    const b = getComputedStyle(m); const big = b.color + '/' + b.fontWeight;
    m.className = '';
    const s = getComputedStyle(m); const small = s.color + '/' + s.fontWeight;
    return { hit, plain, big, small };
  });
  chk('2a hit 스타일이 실제로 구분됨', style.hit !== style.plain, style.hit + ' vs ' + style.plain);
  chk('2b big 스타일이 실제로 구분됨', style.big !== style.small, style.big + ' vs ' + style.small);

  // 릴 결과를 고정해 2연·3연·단독을 결정적으로 확인
  const msgs = await page.evaluate(async () => {
    const real = Math.random; let q = [];
    Math.random = () => q.length ? q.shift() : real();
    const run = async vals => {
      q = vals.slice(); S.charge = 10; S.queue = []; spinning = false;
      S.lockIdx = -1; S.pity = 0; S.asell = Array(15).fill(false);
      spin(); await new Promise(r => setTimeout(r, 600));
      const m = document.getElementById('msg');
      return { t: m.textContent, cls: m.className,
               hits: [...document.querySelectorAll('.reel')]
                 .filter(e => e.classList.contains('hit')).length };
    };
    const three = await run([0, 0, 0]);             // 릴 3개 전부 같은 부위
    const two   = await run([0, 0, 0.9]);           // 2개만 일치
    const one   = await run([0, 0.4, 0.9]);         // 전부 다름
    Math.random = real;
    return { three, two, one };
  });
  chk('2c 2연 메시지·하이라이트', msgs.two.t.startsWith('◇') && msgs.two.hits === 2,
    msgs.two.t + ' hit=' + msgs.two.hits);
  chk('2d 3연+ 강조 메시지·전 릴 하이라이트',
    msgs.three.t.startsWith('◆') && msgs.three.cls === 'big' && msgs.three.hits === 3,
    msgs.three.t + ' cls=' + msgs.three.cls + ' hit=' + msgs.three.hits);
  chk('2e 단독은 강조 없음', !msgs.one.cls && msgs.one.hits === 0,
    msgs.one.t + ' hit=' + msgs.one.hits);

  // ── 3. 천장 게이지 ──
  const pity = await page.evaluate(async () => {
    S.queue = []; S.asell = Array(15).fill(false); S.charge = 50; S.lockIdx = -1;
    S.pity = PITY(); render();
    const colFull = getComputedStyle(document.getElementById('pityfill')).backgroundColor;
    const txt = document.getElementById('pitytxt').textContent;
    S.pity = Math.floor(PITY() / 2); render();       // 진행 중 라벨
    const mid = document.getElementById('pitytxt').textContent;
    S.pity = 0; render();
    const colNorm = getComputedStyle(document.getElementById('pityfill')).backgroundColor;
    // 강제 전릴 정렬
    S.pity = PITY(); S.queue = []; S.lockIdx = -1; spinning = false;
    spin(); await new Promise(r => setTimeout(r, 500));
    const forced = document.getElementById('msg').textContent, after = S.pity;
    // 조준: 고정 릴이 있으면 천장이 그 부위로 터진다
    S.pity = PITY(); S.queue = []; S.lockIdx = 1; lockPart = 4; spinning = false;   // 4 = 장갑
    spin(); await new Promise(r => setTimeout(r, 500));
    return { colFull, colNorm, txt, mid, forced, after, half: Math.floor(PITY() / 2), max: PITY(),
             aimed: S.queue.length ? S.queue[S.queue.length - 1].part : null };
  });
  chk('3a 게이지 가득 시 색 변화', pity.colFull !== pity.colNorm, pity.colFull + ' vs ' + pity.colNorm);
  // 3b — 화면 라벨은 DESIGN.md 「천장 게이지」가 확정한 제련 용어다.
  // 진행 중 `화로압 n/N` · 가득 `▣ 임계압`. 내부 명칭 "천장"은 화면에 절대
  // 노출하지 않는다 (원칙 7). 옛 검사는 `천장` 포함을 요구해서 규약과 정반대였다.
  chk('3b 진행 중 라벨 `화로압 n/N`',
    pity.mid.includes('화로압') && pity.mid.includes(pity.half + '/' + pity.max),
    pity.mid);
  chk('3b2 가득 라벨 `▣ 임계압`', /▣\s*임계압/.test(pity.txt), pity.txt);
  chk('3b3 화면에 내부 용어 노출 0', !/천장|pity|슬롯|잭팟|룰렛|베팅/i.test(pity.txt + ' ' + pity.mid),
    pity.txt + ' / ' + pity.mid);
  chk('3c 강제 전릴 정렬 발동', pity.forced.startsWith('▣'), pity.forced);
  chk('3d 천장 후 게이지 리셋', pity.after === 0, 'pity=' + pity.after);
  chk('3e 고정 릴로 조준', pity.aimed === 'hands', String(pity.aimed));

  // ── 4. 고정 → 해제 시 토큰 환불 ──
  const lock = await page.evaluate(() => {
    S.tok = 3; S.lockIdx = -1; render();
    const reel = document.querySelectorAll('.reel')[0];
    reel.onclick();                                 // 고정
    const on = { tok: S.tok, idx: S.lockIdx, cls: reel.className };
    reel.onclick();                                 // 해제
    return { on, tok: S.tok, idx: S.lockIdx };
  });
  chk('4a 고정 시 토큰 1 소모', lock.on.tok === 2 && lock.on.idx === 0, 'tok=' + lock.on.tok);
  chk('4b 고정 릴 시각 표시', /lock/.test(lock.on.cls), lock.on.cls);
  chk('4c 해제 시 환불', lock.tok === 3 && lock.idx === -1, 'tok=' + lock.tok);

  // ── 5. 교체 왕복 (팝업 유지 / 델타 반전 / 경고 1회 / 판매로만 종결) ──
  dialogs = [];
  const swap = await page.evaluate(() => {
    S.queue = []; S.equip = {}; S.gold = 0;
    S.queue.push(makeItem('head', 7)); resolve('equip');   // 7등급 장착
    S.queue.push(makeItem('head', 3)); openCmp();          // 3등급 대기 (2등급 이상 차이)
    const d1 = document.querySelector('#cNew .delta').textContent;
    const open1 = document.getElementById('cmp').classList.contains('on');
    document.getElementById('bEquip').onclick();           // 교체 — 경고 1회
    const open2 = document.getElementById('cmp').classList.contains('on');
    const d2 = document.querySelector('#cNew .delta').textContent;
    const head = document.getElementById('cmp').textContent.includes('전투력');
    document.getElementById('bEquip').onclick();           // 되돌리기
    document.getElementById('bEquip').onclick();           // 다시 — 경고 없어야 함
    const qlen = S.queue.length;
    document.getElementById('bSell').onclick();            // 판매로 종결
    return { d1, d2, open1, open2, head, qlen, qAfter: S.queue.length };
  });
  chk('5a 팝업이 교체 후에도 유지', swap.open1 && swap.open2);
  chk('5b 델타 반전(+/-)', swap.d1[0] !== swap.d2[0], swap.d1 + ' → ' + swap.d2);
  chk('5c 팝업에 전투력·웨이브·골드 표시', swap.head);
  chk('5d 낮은 등급 경고 1회만', dialogs.length === 1, dialogs.length + '회');
  chk('5e 판매만이 대기열을 줄임', swap.qlen === 1 && swap.qAfter === 0,
    swap.qlen + ' → ' + swap.qAfter);

  // ── 6. 대기 가득 → 스핀 정지 → 정리 후 재개 ──
  // 033: 이 블록은 **「정리」를 끈 판**을 잰다 — 033 이 옛 동작을 그대로 두는지 보는 자리다.
  // 끄지 않으면 자동 정리가 500ms 대기 사이에 칸을 비워서, 이 검사가 무엇을 재는지
  // 스스로 없애 버린다(실측: 6c·6d 가 자동 정리 때문에 FAIL). 자동 쪽(켬)의 판정은
  // 033 의 방치 실측이 따로 든다.
  const full = await page.evaluate(async () => {
    S.autoRes = false;
    S.queue = []; S.equip = {}; S.lv = 0; S.star = 0; S.charge = 50;
    S.asell = Array(15).fill(false);
    while (S.queue.length < qmax()) S.queue.push(makeItem('head', 3));
    // 033 ②: 가득일 때 제련 버튼이 하는 말이 「정리」 스위치에 따라 갈린다. 두 판을 다 본다.
    S.autoRes = true;  render();
    const onDisabled = document.getElementById('spin').disabled;
    S.autoRes = false; render();
    const offBtn = { dis: document.getElementById('spin').disabled,
                     txt: document.getElementById('spin').textContent.trim() };
    const msg = document.getElementById('msg').textContent;
    const q0 = S.queue.length;
    spinning = false; spin(); await new Promise(r => setTimeout(r, 500));
    const blocked = S.queue.length === q0;
    S.queue.shift(); render();
    const reopened = !document.getElementById('spin').disabled;
    spinning = false; spin(); await new Promise(r => setTimeout(r, 500));
    return { onDisabled, offBtn, msg, blocked, reopened, q: S.queue.length, qmax: qmax() };
  });
  /* 033: 이름을 고친다 — 「비활성」은 이제 절반만 맞다. 무르게 한 것이 아니라 **두 판을
     다 못박는다**: 정리 켬이면 예전대로 비활성이고(곧 자동이 비워 준다), 정리 끔이면
     버튼이 살아나 「대기열 정리」를 가리킨다. 어느 쪽이든 «가득일 때 제련은 안 굴러간다». */
  chk('6a 가득 시 제련이 멈춘다 (정리 켬 = 비활성 · 정리 끔 = 「대기열 정리」)',
    full.onDisabled === true && full.offBtn.dis === false && full.offBtn.txt === '대기열 정리',
    `켬 disabled=${full.onDisabled} · 끔 disabled=${full.offBtn.dis} 글자 "${full.offBtn.txt}"`);
  chk('6b 가득 안내 문구', /가득/.test(full.msg), full.msg);
  chk('6c 가득 상태에서 스핀 무시', full.blocked);
  chk('6d 정리 후 재개', full.reopened && full.q === full.qmax, 'q=' + full.q + '/' + full.qmax);

  // ── 7. 자동 판매: 대기열 미진입 + 토큰 미지급 ──
  const asell = await page.evaluate(async () => {
    S.queue = []; S.equip = {}; S.lv = 0; S.star = 0; S.tok = 0; S.gold = 0;
    S.asell = Array(15).fill(true);
    let entered = 0;
    for (let i = 0; i < 60; i++) {
      S.charge = 10; S.lockIdx = -1; S.pity = 0; spinning = false;
      spin(); await new Promise(r => setTimeout(r, 500));
      entered += S.queue.length; S.queue = [];
    }
    return { entered, tok: S.tok, gold: S.gold > 0 };
  });
  chk('7a 자동 판매 등급은 대기열 미진입', asell.entered === 0, '진입 ' + asell.entered + '건');
  chk('7b 자동 판매는 토큰 미지급', asell.tok === 0, '+' + asell.tok);
  chk('7c 자동 판매 골드 지급', asell.gold);

  // ── 8. 승천 버튼: 조건 미달 시 숨김 + 관문 진행 문구 ──
  const asc = await page.evaluate(() => {
    S.star = 0; S.lv = 10; S.peak = 0; render();
    const hid1 = document.getElementById('asc').style.display === 'none';
    const leg1 = document.getElementById('olegend').textContent;
    S.lv = 28; render();                            // 제련은 충족, 웨이브 관문 미달
    const hid2 = document.getElementById('asc').style.display === 'none';
    const leg2 = document.getElementById('olegend').textContent;
    S.peak = ASC_WAVE(); render();
    const shown = document.getElementById('asc').style.display === 'block';
    const label = document.getElementById('asc').textContent;
    S.peak = 0; S.lv = 0; render();
    return { hid1, hid2, shown, leg1, leg2, label };
  });
  chk('8a 조건 미달 시 승천 버튼 숨김', asc.hid1 && asc.hid2);
  chk('8b 상한 개방 진행 문구', /개방/.test(asc.leg1), asc.leg1.slice(-40));
  chk('8c 웨이브 관문 진행 문구', /도달 필요|현재 최고/.test(asc.leg2), asc.leg2.slice(-46));
  chk('8d 조건 충족 시 노출', asc.shown, asc.label);

  // ── 9. 층 → 주사위 → 재굴림 2회 제한 → 보상 ──
  // ⚠ 026 이 «재굴림 앞에 광고가 선다»로 계약을 바꿨다. 이 검사는 예전 계약
  //   (누르면 즉시 재굴림)을 재고 있어서 구현이 아니라 **검사가 엉뚱한 자리를
  //   보게 됐다** — CLAUDE.md 가 허용하는 그 경우다(구현 세션이 고치되 무엇을
  //   왜 고쳤는지 적고 검증 세션이 독립 재확인). 고친 방향은 **무르게가 아니라
  //   되게** 다: 「착지당 정확히 2회」라는 알맹이는 그대로 재고, 그 앞에
  //   「광고가 없으면 보상도 없다」(026 §0)를 **한 줄 더** 본다.
  const tower = await page.evaluate(async () => {
    S.tk = 2; S.dust = 0; S.gold = 0; S.tok = 0; S.charge = 0;
    enterTower();
    const on = document.getElementById('dice').classList.contains('on'), tk = S.tk;
    document.getElementById('droll').onclick();
    const l0 = landed, rollLocked = document.getElementById('droll').disabled;
    // ① 광고가 없는 환경(이 체크리스트가 그렇다 — SDK 없음)에서는 **보상이 없다.**
    const noAdOn = PLAT.adsOn, noAdRw = PLAT.rewarded;
    document.getElementById('dad').onclick();
    await new Promise(r => setTimeout(r, 80));
    const noAd = rerolls;                       // 2 여야 한다 (한 번도 안 줄어든다)
    const noAdVis = getComputedStyle(document.getElementById('dad')).display;
    // ② 광고를 통과시킨 상태에서 **착지당 2회 상한**을 본다 (옛 9c 의 알맹이).
    PLAT.adsOn = true; PLAT.rewarded = () => Promise.resolve(true);
    const ads = [];
    for (let i = 0; i < 3; i++) {
      dadAt = 0;                                // 쿨다운은 이 검사의 대상이 아니다
      document.getElementById('dad').onclick();
      await new Promise(r => setTimeout(r, 80));
      ads.push(rerolls);                        // 1, 0, 0 이어야 한다
    }
    PLAT.adsOn = noAdOn; PLAT.rewarded = noAdRw;
    renderTech();
    const adDisabled = document.getElementById('dad').disabled;
    const b = { d: S.dust, g: S.gold, t: S.tok, c: S.charge };
    document.getElementById('dtake').onclick();
    const a = { d: S.dust, g: S.gold, t: S.tok, c: S.charge };
    return { on, tk, l0, rollLocked, ads, adDisabled, b, a, floor: runFloor, best: S.best,
             noAd, noAdVis,
             closed: !document.getElementById('dice').classList.contains('on') };
  });
  chk('9a 티켓 소모 + 판 열림', tower.on && tower.tk === 1, 'tk=' + tower.tk);
  chk('9b 주사위 착지 + 굴리기 잠금', tower.l0 !== null && tower.rollLocked);
  chk('9c 재굴림 정확히 2회 (광고를 통과시킨 뒤)', tower.ads.join(',') === '1,0,0', tower.ads.join(','));
  chk('9c2 광고가 없으면 재굴림도 없다 (026 §0 — 버튼도 안 보인다)',
    tower.noAd === 2 && tower.noAdVis === 'none',
    `누른 뒤 남은 재굴림 ${tower.noAd}(2 여야 정상) · #dad display:${tower.noAdVis}`);
  chk('9d 소진 후 재굴림 버튼 비활성', tower.adDisabled);
  chk('9e 보상 수령 + 판 닫힘',
    tower.closed && (tower.a.d > tower.b.d || tower.a.g > tower.b.g ||
      tower.a.t > tower.b.t || tower.a.c > tower.b.c), JSON.stringify(tower.a));
  chk('9f 최고 층 기록', tower.best >= tower.floor, 'floor=' + tower.floor);

  // 원칙 6: 층 보상 골드는 층수가 아니라 현재 강화 비용 기준이어야 한다
  const tile = await page.evaluate(() => {
    S.lv = 5; runFloor = 10; const a = TILES.filter(t => t.k === 'gold').map(tileAmt);
    runFloor = 400;          const b = TILES.filter(t => t.k === 'gold').map(tileAmt);
    S.lv = 0; return { a, b };
  });
  chk('9g 골드 칸이 층수에 비례하지 않음',
    JSON.stringify(tile.a) === JSON.stringify(tile.b), tile.a + ' vs ' + tile.b);

  // ── 10. 새로고침 후 복원 (오프라인 충전 포함) ──
  await page.evaluate(() => {
    S.gold = 12345; S.lv = 6; S.star = 0; S.charge = 40; S.wave = 17;
    S.queue = [makeItem('head', 4)]; S.tok = 5;
    save(true);
    window.save = () => {};                         // pagehide 자동 저장이 t 를 덮어쓰는 것 방지
    const raw = JSON.parse(localStorage.getItem('forge'));
    raw.t = Date.now() - 20 * 60 * 1000;            // 20분 오프라인
    localStorage.setItem('forge', JSON.stringify(raw));
  });
  const freshErrs = errs.slice();                   // 신규 로드까지의 콘솔
  await page.reload();
  await page.waitForTimeout(400);
  const back = await page.evaluate(() => ({
    gold: S.gold, lv: S.lv, wave: S.wave, q: S.queue.length, tok: S.tok,
    charge: S.charge, expect: Math.min(CHG_MAX(), 40 + 20 * 60 * 1000 / CHG_MS())
  }));
  chk('10a 상태 복원', back.gold === 12345 && back.lv === 6 && back.wave === 17 &&
    back.q === 1 && back.tok === 5, JSON.stringify(back));
  chk('10b 오프라인 충전 델타 반영', Math.abs(back.charge - back.expect) < 5,
    back.charge.toFixed(1) + ' ≈ ' + back.expect.toFixed(1));

  // ── 모바일 폭 380px ──
  const layout = await page.evaluate(() => {
    const de = document.documentElement;
    return { scrollW: de.scrollWidth, clientW: de.clientWidth,
      over: [...document.querySelectorAll('body *')]
        .filter(e => e.getBoundingClientRect().right > de.clientWidth + 1)
        .map(e => (e.id || e.className || e.tagName)).slice(0, 6) };
  });
  chk('M1 가로 스크롤 없음(380px)', layout.scrollW <= layout.clientW + 1,
    layout.scrollW + '/' + layout.clientW);
  chk('M2 화면 밖으로 나간 요소 없음', layout.over.length === 0, layout.over.join(' '));

  const overflow = sel => page.evaluate(s => {
    const de = document.documentElement;
    return [...document.querySelectorAll(s + ' *')]
      .filter(e => e.getBoundingClientRect().right > de.clientWidth + 1).length;
  }, sel);

  await page.evaluate(() => { S.queue = [makeItem('head', 12)]; S.equip = {}; openCmp(); });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(SHOTS, 'forge-cmp.png') });
  chk('M3 정리 팝업 380px 안', await overflow('#cmp') === 0);

  await page.evaluate(() => {
    document.getElementById('cmp').classList.remove('on'); S.tk = 2; enterTower(); });
  await page.waitForTimeout(100);
  await page.screenshot({ path: path.join(SHOTS, 'forge-dice.png') });
  chk('M4 주사위 판 380px 안', await overflow('#dice') === 0);

  await page.evaluate(() => document.getElementById('dice').classList.remove('on'));
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(SHOTS, 'forge-main.png'), fullPage: true });

  // ── 콘솔 self-check ──
  chk('C1 신규 로드 콘솔 무오류', freshErrs.length === 0, freshErrs.slice(0, 3).join(' | '));
  chk('C2 세이브 복원 로드 콘솔 무오류', errs.length === freshErrs.length,
    errs.slice(freshErrs.length, freshErrs.length + 3).join(' | '));

  // C3 — 고테크 세이브. 하한·상한에 붙은 값을 "더 좋아져야 한다"로 재면 포화가
  // 곧 실패로 뒤집힌다 (005: spd 94 부터 CHG_MS 가 1500ms 바닥). 이 유형이 다시
  // 새지 않게 만렙 세이브를 한 번 로드해 본다.
  await page.evaluate(() => {
    S.tech = { spd: 99, cap: 100, sell: 100, cost: 100, gold: 100, align: 100 };
    save(true); window.save = () => {};
  });
  const hiBefore = errs.length;
  await page.reload();
  await page.waitForTimeout(400);
  const hiTech = await page.evaluate(() => JSON.stringify(S.tech));
  chk('C3 고테크(만렙) 세이브 로드 콘솔 무오류', errs.length === hiBefore,
    errs.slice(hiBefore, hiBefore + 3).join(' | ') || hiTech);

  // ── VC. 캔버스 층 (007~) ──
  // Playwright 는 캔버스 픽셀을 못 읽는다. `window.__view` 가 유일한 검증 창구고,
  // 여기 노출되지 않는 연출은 완료로 인정하지 않는다 (CLAUDE.md 검증 세션 절).
  //
  // **검사는 값이 아니라 계약을 본다.** 필드가 늘어나는 것은 정상적인 진행이므로
  // 통과해야 하고(008 이 counters.bounce 를 더하고 background 를 'canvas' 로 바꾼다),
  // 있어야 할 것이 사라지거나 타입이 무너지는 것만 잡는다. 값을 박아 두면
  // 다음 지시서가 검사를 고치느라 시간을 쓰고, 그러다 검사를 무르게 만든다.
  //
  // 위치가 마지막인 데도 뜻이 있다 — 바로 앞 C1~C3 이 페이지를 세 번 리로드하므로
  // 여기까지 살아 있으면 "리로드 후에도 캔버스가 다시 뜬다"까지 같이 본 셈이다.
  const CANVAS_MIN = ['engine', 'ready', 'scene', 'canvas', 'overlay', 'background', 'counters'];
  const CANVAS_COUNTERS = ['shake', 'burst'];        // 008 이 bounce 등을 더한다 — 추가는 허용
  await page.waitForFunction(() => window.__view && window.__view.ready === true, null,
    { timeout: 5000 }).catch(() => {});
  const vw = await page.evaluate(() => {
    const v = window.__view;
    if (!v) return { missing: true };
    const t = x => Array.isArray(x) ? 'array' : x === null ? 'null' : typeof x;
    return {
      keys: Object.keys(v), engine: v.engine, ready: v.ready, scene: v.scene,
      canvas: v.canvas, overlay: v.overlay, background: v.background,
      counters: v.counters, tCanvas: t(v.canvas), tCounters: t(v.counters),
      tOverlay: t(v.overlay), json: JSON.stringify(v),
      // 실제 캔버스 엘리먼트의 크기 — __view 가 자기 얘기를 하는지 대조할 기준
      real: (() => {
        const c = document.querySelector('#stage canvas') || document.querySelector('canvas');
        if (!c) return null;
        const r = c.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      })()
    };
  });
  const num = x => typeof x === 'number' && isFinite(x);
  if (vw.missing) {
    for (const n of ['VC1 __view 필수 키 존재', 'VC2 ready===true · scene 이름 있음',
      'VC3 canvas 크기 > 0', 'VC4 background 값 존재', 'VC5 counters = 숫자 카운터 묶음'])
      chk(n, false, 'window.__view 자체가 없음');
  } else {
    const lack = CANVAS_MIN.filter(k => !vw.keys.includes(k));
    chk('VC1 __view 필수 키 존재', lack.length === 0 && vw.tCanvas === 'object' &&
      vw.tCounters === 'object' && vw.tOverlay === 'object',
      lack.length ? '없는 키: ' + lack.join(',') : '키 ' + vw.keys.length + '개: ' + vw.keys.join(','));
    chk('VC2 ready===true · scene 이름 있음',
      vw.ready === true && typeof vw.scene === 'string' && vw.scene.length > 0 &&
      typeof vw.engine === 'string' && vw.engine.length > 0,
      'ready=' + vw.ready + ' scene=' + JSON.stringify(vw.scene) + ' engine=' + JSON.stringify(vw.engine));
    // 0보다 크기만 보면 하드코딩된 숫자도 통과한다. 실제 캔버스 엘리먼트 크기와
    // 대조해서 `__view.canvas` 가 정말 그 캔버스 얘기를 하는지까지 본다
    // (레이아웃이 바뀌어 캔버스가 전체 화면이 아니게 돼도 이 대조는 성립한다).
    const near = (a, b) => Math.abs(a - b) <= Math.max(2, b * 0.02);
    chk('VC3 canvas 크기 > 0 · 실제 캔버스와 일치',
      !!vw.canvas && num(vw.canvas.w) && num(vw.canvas.h) && vw.canvas.w > 0 && vw.canvas.h > 0 &&
      !!vw.real && near(vw.canvas.w, vw.real.w) && near(vw.canvas.h, vw.real.h),
      JSON.stringify(vw.canvas) + ' vs 실제 ' + JSON.stringify(vw.real));
    // 값은 박지 않는다: 지금 'css', 008 이후 'canvas'. 주인이 누구든 적혀 있기만 하면 된다.
    chk('VC4 background 값 존재',
      typeof vw.background === 'string' && vw.background.length > 0,
      JSON.stringify(vw.background));
    // 키 추가는 허용, 있던 카운터가 사라지거나 숫자가 아니게 되는 것만 잡는다.
    const cs = vw.counters || {}, ck = Object.keys(cs);
    const lackC = CANVAS_COUNTERS.filter(k => !(k in cs));
    const bad = ck.filter(k => !num(cs[k]) || cs[k] < 0);
    chk('VC5 counters = 숫자 카운터 묶음', lackC.length === 0 && ck.length > 0 && bad.length === 0,
      (lackC.length ? '없는 카운터: ' + lackC.join(',') + ' ' : '') +
      (bad.length ? '숫자 아님: ' + bad.join(',') + ' ' : '') + JSON.stringify(cs));
  }

  // ── R. 하단 도달 가능성 (008 §6) ──
  // **뷰포트 하나로 보면 이 결함은 영영 안 잡힌다.** `#board` 타일이
  // `aspect-ratio:1` 4열이라 폭이 넓을수록 판이 세로로 커진다 — 380px 에서는
  // 안 넘치고 1280px 에서만 넘쳤다. 그래서 데스크톱과 짧은 창을 반드시 함께 본다
  // (CLAUDE.md 검증 세션 「반응형 검사는 최소 두 크기로」).
  //
  // 두 가지를 같이 본다. 하나만으로는 각각 절반을 놓친다:
  //  (1) **조작 가능** — 핵심 버튼에 `click({trial:true})`. 실제 이벤트는 안 보내고
  //      가시성·안정성·히트타깃·뷰포트 안으로 스크롤까지만 확인한다. 상태를 넘기는
  //      진짜 클릭은 `el.click()` 으로 따로 보낸다. 캔버스가 두 겹이라 소프트웨어
  //      GL 환경에서 프레임이 느린데, 그걸 도달 실패로 오해하지 않기 위한 분리다.
  //  (2) **위쪽 잘림 없음** — `scrollTop=0` 일 때 첫 자식이 컨테이너 위로 올라가
  //      있으면 그 부분은 스크롤로도 닿을 수 없다. `justify-content:center` 인
  //      전면 모달이 넘칠 때 정확히 이렇게 된다. 008 이전 `#cmp` 는 아래쪽 판매
  //      버튼이 눌려서 (1)만으로는 통과했지만 착용 카드가 잘려 있었다.
  const REACH = [
    { w: 380, h: 820, nm: '380×820 모바일' },
    { w: 1280, h: 720, nm: '1280×720 데스크톱' },
    { w: 1280, h: 600, nm: '1280×600 짧은 창' }
  ];
  const clipTop = sel => page.evaluate(s => {
    const d = document.getElementById(s);
    d.scrollTop = 0;
    const f = d.firstElementChild;
    if (!f) return { gap: 0, sh: 0, ch: 0 };
    return { gap: Math.round(f.getBoundingClientRect().top - d.getBoundingClientRect().top),
      sh: d.scrollHeight, ch: d.clientHeight };
  }, sel);
  // 타임아웃을 넉넉히 잡는 이유: 008 이후 전체 화면 WebGL 캔버스가 두 겹이라
  // 소프트웨어 GL(headless) 에서 프레임이 ~280ms 까지 늘어진다. Playwright 의
  // "element is stable" 대기가 프레임에 물려서, 3초로 두면 **멀쩡히 보이는 카드가
  // 도달 실패로 찍힌다** (실측: #cOld 가 3초 FAIL / 8초 OK, 실제 소요 3.5초).
  // 도달성 판정을 환경 성능과 섞지 않으려면 여유가 필요하다.
  /* `TB8`·`LG1` 이 함께 쓰는 크기 목록. **한 곳에서만 고친다** — 031 지시서가
     「대상 크기는 TB8 과 같은 목록」이라 적었으므로 두 벌로 두면 반드시 갈라진다.
     1920×1080 은 031(030 제안 ⑵)에서 더했다 — CrazyGames 전체화면 목록에 있고,
     030 의 폭 상한 1120 이 그 크기에서 어떻게 보이는지 아무 검사도 안 보고 있었다. */
  const TB8_SIZES = [
    { w: 380,  h: 820, nm: '380×820 세로' },
    { w: 1280, h: 720, nm: '1280×720 전체화면' },
    { w: 1280, h: 600, nm: '1280×600 짧은 창' },
    { w: 821,  h: 462, nm: '821×462 CG데스크톱',  cg: true },
    { w: 907,  h: 510, nm: '907×510 CG데스크톱',  cg: true },
    { w: 1077, h: 606, nm: '1077×606 CG데스크톱', cg: true },
    { w: 1216, h: 684, nm: '1216×684 CG데스크톱', cg: true },
    { w: 800,  h: 450, nm: '800×450 CG모바일',    cg: true },
    { w: 1920, h: 1080, nm: '1920×1080 전체화면', cg: true }
  ];
  /* TB8 의 **이름 붙인 예외**. 한 칸씩, 왜 예외인지를 함께 든다 — 판정문이 매번
     그 칸과 이유를 출력한다(그래야 「조용히 빠진 칸」이 안 생긴다). */
  const TB8_SKIPS = [
    ['380×820 세로/배너/제련',
     '027 판정 ① — 관문이 열리면 제련이 가장 값없는 동작이라 배너가 미는 것이 우선순위 그대로다'],
    ['380×820 세로/평범/정리',
     '033 판정 ⓐ — 이 줄(「대기 N/10」)은 033 전에도 첫 화면 6px 아래였다(top 514 vs #focus 밑 508). ' +
     '위로 올리면 여유 2px 인 #spin 이 밀린다. 「정리」는 기본 켜짐이라 필수 동작이 아니라 설정이다']
  ];
  const TB8_SKIP_KEYS = TB8_SKIPS.map(s => s[0]);
  const TB8_SKIP = TB8_SKIP_KEYS[0];               // 옛 이름 (다른 곳에서 읽을 때를 위해 남긴다)
  const REACH_TIMEOUT = 8000;
  const reachable = async (sel, timeout = REACH_TIMEOUT) => {
    try { await page.locator(sel).click({ trial: true, timeout }); return true; }
    catch { return false; }
  };

  for (const vp of REACH) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForTimeout(250);

    // 주사위판: 도전 → 굴리기 → 받기 까지 실제로 닿는가
    await page.evaluate(() => {
      window.save = () => {};
      document.getElementById('dice').classList.remove('on');
      document.getElementById('cmp').classList.remove('on');
      S.top = 300; S.tk = 2; S.dust = 0; S.equip = {}; S.queue = []; render();
      enterTower();
    });
    await page.waitForTimeout(250);
    const dGeo = await clipTop('dice');
    const rollOk = await reachable('#droll');
    await page.evaluate(() => document.getElementById('droll').click());
    await page.waitForTimeout(250);
    const takeOk = await reachable('#dtake');
    const dTook = await page.evaluate(() => {
      const d0 = S.dust; document.getElementById('dtake').click();
      return { got: S.dust >= d0, closed: !document.getElementById('dice').classList.contains('on') };
    });
    chk(`R-주사위판 도달·조작 (${vp.nm})`,
      rollOk && takeOk && dTook.closed && dGeo.gap >= -1,
      `굴리기 ${rollOk ? '닿음' : '못 닿음'} · 받기 ${takeOk ? '닿음' : '못 닿음'} · ` +
      `수령 후 닫힘 ${dTook.closed} · 내용 ${dGeo.sh}px/창 ${dGeo.ch}px · 위쪽 여백 ${dGeo.gap}px`);

    // 정리 팝업: 위가 잘리면 착용 카드를 못 본다 (버튼은 아래라 눌리는데도)
    await page.evaluate(() => {
      document.getElementById('dice').classList.remove('on');
      S.star = 4; S.lv = 28;
      S.equip = { head: makeItem('head', 15) };
      S.queue = [makeItem('head', 15), makeItem('weapon', 15)];
      openCmp();
    });
    await page.waitForTimeout(250);
    const cGeo = await clipTop('cmp');
    const sellOk = await reachable('#bSell');
    const cardOk = await reachable('#cOld');
    await page.evaluate(() => document.getElementById('cmp').classList.remove('on'));
    chk(`R-정리 팝업 도달·조작 (${vp.nm})`,
      sellOk && cardOk && cGeo.gap >= -1,
      `판매 버튼 ${sellOk ? '닿음' : '못 닿음'} · 착용 카드 ${cardOk ? '닿음' : '못 닿음'} · ` +
      `내용 ${cGeo.sh}px/창 ${cGeo.ch}px · 위쪽 여백 ${cGeo.gap}px`);
  }
  await page.setViewportSize({ width: 380, height: 820 });

  // ── P. 프레임 비용 (009 §0) ──
  // 009 가 배경 재그리기를 RenderTexture 로 걷어내 프레임 비용을 한 자릿수 ms 로
  // 되돌렸다. 회귀하면 화면은 멀쩡해 보이고 조용히 느려지기만 하므로 상시 검사로 둔다.
  //
  // **절대 ms 로 판정하지 않는다.** 헤드리스는 소프트웨어 GL 이고 기계마다 다르다.
  // 대신 같은 실행 안에서 **바닥값**을 함께 잰다 — Phaser 루프를 재워(`loop.sleep()`)
  // 캔버스 렌더를 멈춘 상태의 rAF 간격이 그 환경의 최선값(보통 vsync 16.7ms)이다.
  // 살아 있는 값이 바닥의 몇 배인지로 보면 기계가 느려도 판정이 흔들리지 않는다.
  // 실측: 009 = 1.1배 / 008(배경을 매 프레임 다시 그리던 버전) = 10.3배.
  // 문턱 3배는 그 사이에서 넉넉히 갈린다.
  const FRAME_BUDGET = 3;
  const rafMedian = () => page.evaluate(() => new Promise(res => {
    const t = []; let n = 0, last = performance.now();
    const step = () => {
      const now = performance.now(); t.push(now - last); last = now;
      if (++n < 50) requestAnimationFrame(step);
      else { const w = t.slice(12).sort((a, b) => a - b); res(+w[w.length >> 1].toFixed(1)); }
    };
    requestAnimationFrame(step);
  }));
  const live = await rafMedian();
  const how = await page.evaluate(() => {
    const gs = Object.keys(globalThis).filter(k => k.startsWith('__'))
      .map(k => globalThis[k]).filter(g => g && g.loop && g.loop.sleep);
    if (gs.length) { gs.forEach(g => g.loop.sleep()); return 'loop.sleep×' + gs.length; }
    document.querySelectorAll('canvas').forEach(c => c.style.display = 'none');
    return 'canvas 숨김';
  });
  await page.waitForTimeout(300);
  const floor = await rafMedian();
  await page.evaluate(() => {
    Object.keys(globalThis).filter(k => k.startsWith('__')).map(k => globalThis[k])
      .filter(g => g && g.loop && g.loop.wake).forEach(g => g.loop.wake());
    document.querySelectorAll('canvas').forEach(c => c.style.display = '');
  });
  const ratio = floor > 0 ? live / floor : Infinity;
  chk('P1 프레임 비용 ≤ 바닥 ' + FRAME_BUDGET + '배',
    isFinite(ratio) && ratio <= FRAME_BUDGET,
    `실측 ${live}ms · 바닥 ${floor}ms(${how}) · ${ratio.toFixed(2)}배`);

  // 방치 중에는 배경을 다시 굽지 않는다 (구운 것을 재사용). 굽기 횟수가 가만히
  // 두는데도 늘면 "정적인 것을 매 프레임 다시 그리는" 옛 상태로 돌아간 것이다.
  await page.waitForTimeout(300);
  const bake0 = await page.evaluate(() => (window.__view && window.__view.perf) ? { ...window.__view.perf } : null);
  await page.waitForTimeout(3000);                 // 아무것도 하지 않고 방치
  const bake1 = await page.evaluate(() => (window.__view && window.__view.perf) ? { ...window.__view.perf } : null);
  const grew = (bake0 && bake1)
    ? ['bgBakes', 'panelBakes'].filter(k => (bake1[k] || 0) > (bake0[k] || 0)) : null;
  chk('P2 방치 3초 동안 배경 재굽기 0',
    !!bake0 && !!bake1 && grew.length === 0,
    !bake0 ? '__view.perf 자체가 없음'
      : `${JSON.stringify(bake0)} → ${JSON.stringify(bake1)}` +
        (grew.length ? ' · 증가한 카운터: ' + grew.join(',') : ''));

  // ── CV. 캔버스가 실제로 칠해졌는가 (010 검증에서 추가) ──
  // **이번에 뚫린 구멍이 정확히 여기다.** 지금까지 캔버스 검증은 `__view` 카운터로만
  // 했는데, 카운터는 "그리라고 시켰다"를 말하지 "픽셀이 칠해졌다"를 말하지 않는다.
  // 009 는 `perf{bgBakes:2,panelBakes:2}` 로 멀쩡히 보고하면서 실제로는 **좌상단
  // 사분면만**(정확히 폭 1/2 × 높이 1/2 = 면적 25%) 칠하고 화로·모루는 아예 없었다.
  // 카운터 검사(VC5·P2)는 전부 통과했다.
  //
  // 그래서 픽셀을 직접 본다: DOM 오버레이를 감춰 캔버스 층만 남기고 스크린샷을 떠서
  //  (1) 칠해진 비율  (2) 칠해진 영역이 화면을 덮는가(사분면 결함 정조준)
  //  (3) 칠해진 픽셀이 ART-DIRECTION 6색인가
  // 를 잰다. PNG 디코딩은 node 의존을 늘리지 않으려고 **페이지 안 2D 캔버스**로 한다.
  const PALETTE = { 무쇠: [0x23, 0x26, 0x2B], 숯: [0x14, 0x10, 0x0E], 열철: [0xE2, 0x62, 0x2A],
    백열: [0xFF, 0xD9, 0xA0], 담금질물: [0x4A, 0x6B, 0x72], 놋쇠: [0xB0, 0x8D, 0x4F] };
  await page.evaluate(() => {
    window.__cvHidden = [];
    [...document.body.children].forEach(e => {
      if (e.id === 'stage' || e.id === 'fx' || e.tagName === 'CANVAS') return;
      window.__cvHidden.push([e, e.style.visibility]);
      e.style.visibility = 'hidden';
    });
    // 캔버스가 안 칠한 자리를 "검정"으로 드러낸다 — body 바닥색이 깔리면 구분이 안 된다.
    window.__cvBg = [document.documentElement.style.background, document.body.style.background];
    document.documentElement.style.background = '#000';
    document.body.style.background = 'transparent';
  });
  await page.waitForTimeout(700);
  const shot = (await page.screenshot()).toString('base64');
  const cv = await page.evaluate(async ({ b64, pal }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const W = c.width, H = c.height;
    let painted = 0, x0 = W, x1 = -1, y0 = H, y1 = -1;
    const names = Object.keys(pal), hit = {}; names.forEach(n => hit[n] = 0);
    let onPalette = 0;
    // 칠해진 픽셀의 색 가짓수. 검사 자체가 캔버스 대신 body 바닥색을 재고 있으면
    // 화면 전체가 **단색 하나**로 나온다 (011 검증에서 재현). CV4 가 그것을 잡는다.
    const uniq = new Set();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2];
      if (Math.max(r, g, b) <= 4) continue;              // 안 칠해진 자리
      painted++;
      if (uniq.size < 400) uniq.add((r << 16) | (g << 8) | b);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      let on = false;
      for (const n of names) {
        const p = pal[n];
        if (Math.max(Math.abs(r - p[0]), Math.abs(g - p[1]), Math.abs(b - p[2])) <= 26) { hit[n]++; on = true; }
      }
      // 알파 합성으로 어두워진 팔레트색도 팔레트 안이다 (원점 방향이 같으면 통과)
      if (!on) {
        const mx = Math.max(r, g, b) || 1;
        for (const n of names) {
          const p = pal[n], pm = Math.max(...p);
          if (Math.abs(r / mx - p[0] / pm) < 0.14 && Math.abs(g / mx - p[1] / pm) < 0.14 &&
              Math.abs(b / mx - p[2] / pm) < 0.14) { on = true; break; }
        }
      }
      if (on) onPalette++;
    }
    return { W, H, painted, total: W * H, box: [x0, y0, x1, y1], uniq: uniq.size,
      onPalette, hit: Object.fromEntries(names.map(n => [n, hit[n]])) };
  }, { b64: shot, pal: PALETTE });
  await page.evaluate(() => {
    (window.__cvHidden || []).forEach(([e, v]) => e.style.visibility = v);
    if (window.__cvBg) { document.documentElement.style.background = window.__cvBg[0];
      document.body.style.background = window.__cvBg[1]; }
  });

  const paintPct = cv.painted / cv.total * 100;
  const boxW = cv.box[2] >= 0 ? (cv.box[2] - cv.box[0] + 1) / cv.W * 100 : 0;
  const boxH = cv.box[3] >= 0 ? (cv.box[3] - cv.box[1] + 1) / cv.H * 100 : 0;
  const palPct = cv.painted ? cv.onPalette / cv.painted * 100 : 0;
  const appear = Object.entries(cv.hit).filter(([, n]) => n > cv.total * 0.001).map(([n]) => n);

  chk('CV1 캔버스가 실제로 칠해짐 (≥90%)', paintPct >= 90,
    `칠해진 픽셀 ${cv.painted}/${cv.total} = ${paintPct.toFixed(2)}%`);
  // 009 결함은 "덜 칠했다"가 아니라 "사분면만 칠했다" 였다. 비율만 보면 놓칠 수 있는
  // 배치 결함(한쪽으로 쏠림·절반만 그림)을 덮는 범위 검사다.
  chk('CV2 칠해진 영역이 화면을 덮음 (≥95%)', boxW >= 95 && boxH >= 95,
    `범위 x${cv.box[0]}~${cv.box[2]} y${cv.box[1]}~${cv.box[3]} = 폭 ${boxW.toFixed(1)}% · 높이 ${boxH.toFixed(1)}%`);
  chk('CV3 칠해진 픽셀이 팔레트 6색 (≥95%)', palPct >= 95,
    `팔레트 안 ${palPct.toFixed(2)}% · 출현: ${appear.join(',') || '없음'}`);
  // CV4 는 게임이 아니라 **이 검사 자신**을 지킨다 (011 검증에서 추가).
  // 위에서 body 배경을 투명으로 걷지 않으면 body 바닥색(--iron)이 z-index:-1 캔버스를
  // 통째로 덮어, 캔버스가 완전히 백지여도 CV1·CV2·CV3 이 전부 통과한다 —
  // 011 구현 세션이 실제로 밟은 거짓 통과다. 그때 화면은 **단색 하나**로 나온다.
  // 정상 빌드의 색 가짓수: 008=163 · 009(결함)=35 · 010=214 · 011=214/232.
  chk('CV4 칠해진 화면이 단색이 아님 (≥24색 — 검사가 캔버스를 보고 있다)', cv.uniq >= 24,
    `유니크 색 ${cv.uniq}${cv.uniq <= 2 ? ' ⚠ body 바닥색을 재고 있다 (background:transparent 확인)' : ''}`);

  // ── SG. 손그림 실루엣이 부위를 형태만으로 가르는가 (012 검증에서 추가) ──
  // 012 의 핵심 완료 조건은 **검정 실루엣 테스트**다 — 색이 등급을 가져가므로
  // 부위는 오직 형태로만 구분된다. 사람 눈 판정을 기계로 붙잡아 두는 네 항목이다.
  // 색·팔레트는 일절 보지 않는다. 그림 문자열의 **모양**만 본다.
  const sg = await page.evaluate(() => {
    if (typeof SPR === 'undefined' || typeof SPR_SIZE === 'undefined') return null;
    const N = SPR_SIZE, parts = Object.keys(SPR);
    const grid = t => { const g = []; for (let y = 0; y < N; y++) { const r = [];
      for (let x = 0; x < N; x++) r.push(t[y * N + x] !== '.'); g.push(r); } return g; };
    const bbox = g => { let x0=N,y0=N,x1=-1,y1=-1;
      for (let y=0;y<N;y++) for (let x=0;x<N;x++) if (g[y][x]) {
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
      return [x0,y0,x1,y1]; };
    const runs = row => { let n=0,p=false; for (const v of row) { if (v && !p) n++; p=v; } return n; };
    // 위/아래 갈래: 경계상자 위(아래) 20% 띠에서 나온 덩어리 수의 최댓값.
    // 맨 한 줄만 보면 한 픽셀에 값이 뒤집혀 서명이 불안정해진다.
    const prongs = (g,b,top) => { const [x0,y0,x1,y1]=b, h=y1-y0+1, band=Math.max(1,Math.round(h*0.2));
      let best=0; for (let k=0;k<band;k++) { const y = top ? y0+k : y1-k;
        best = Math.max(best, runs(g[y].slice(x0,x1+1))); } return best; };
    const holes = (g,b) => { const [x0,y0,x1,y1]=b, W=x1-x0+1, H=y1-y0+1;
      const emp=(x,y)=>!g[y0+y][x0+x];
      const out=Array.from({length:H},()=>new Array(W).fill(false)), st=[];
      for(let x=0;x<W;x++){ if(emp(x,0))st.push([x,0]); if(emp(x,H-1))st.push([x,H-1]); }
      for(let y=0;y<H;y++){ if(emp(0,y))st.push([0,y]); if(emp(W-1,y))st.push([W-1,y]); }
      while(st.length){ const [x,y]=st.pop();
        if(x<0||y<0||x>=W||y>=H||out[y][x]||!emp(x,y)) continue;
        out[y][x]=true; st.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
      let n=0; const vis=Array.from({length:H},()=>new Array(W).fill(false));
      for(let y=0;y<H;y++) for(let x=0;x<W;x++)
        if(emp(x,y)&&!out[y][x]&&!vis[y][x]){ n++; const q=[[x,y]];
          while(q.length){ const [a,c]=q.pop();
            if(a<0||c<0||a>=W||c>=H||vis[c][a]||!emp(a,c)||out[c][a]) continue;
            vis[c][a]=true; q.push([a+1,c],[a-1,c],[a,c+1],[a,c-1]); } }
      return n; };
    const ratio = b => { const r=(b[2]-b[0]+1)/(b[3]-b[1]+1);
      return r>=1.15?'wide' : r<=0.87?'tall' : 'even'; };
    // 기울기: 공분산 주축. **이심률은 고유값 비로 재야 한다** — xx/yy 비로 재면
    // 45° 로 누운 막대(무기)가 xx≈yy 라서 "방향 없음"으로 잘못 나온다.
    const tilt = g => { let n=0,sx=0,sy=0; const pts=[];
      for(let y=0;y<N;y++) for(let x=0;x<N;x++) if(g[y][x]){ n++; sx+=x; sy+=y; pts.push([x,y]); }
      const mx=sx/n, my=sy/n; let xx=0,yy=0,xy=0;
      for(const [x,y] of pts){ xx+=(x-mx)*(x-mx); yy+=(y-my)*(y-my); xy+=(x-mx)*(y-my); }
      xx/=n; yy/=n; xy/=n;
      const deg = 0.5*Math.atan2(2*xy, xx-yy)*180/Math.PI, a = Math.abs(deg);
      const fromAxis = Math.min(a, Math.abs(a-90), Math.abs(a-180));
      const cm=(xx+yy)/2, rt=Math.sqrt(((xx-yy)/2)*((xx-yy)/2)+xy*xy);
      const ecc = Math.sqrt((cm+rt)/Math.max(1e-9, cm-rt));
      return (fromAxis > 25 && ecc >= 1.15) ? (xy < 0 ? '↗' : '↘') : '│'; };

    const out = { N, parts, count: 0, lenOK: true, geo: [], sig: {}, boxes: {} };
    for (const k of parts) {
      const t = SPR[k]; out.count += t.length;
      t.forEach(str => { if (str.length !== N*N) out.lenOK = false; });
      const g = t.map(grid), b = g.map(bbox);
      const same = JSON.stringify(b[0])===JSON.stringify(b[1]) &&
                   JSON.stringify(b[1])===JSON.stringify(b[2]);
      let grew = 0; for (let i=0;i<N*N;i++) if (t[1][i]==='.' && t[2][i]!=='.') grew++;
      out.geo.push({ part:k, boxSame:same, t3Grew:grew,
        t1NoShade: !t[0].includes('2'), t1NoHi: !t[0].includes('4'),
        len: t.every(x => x.length === N*N) });
      out.boxes[k] = b[1];
      out.sig[k] = [prongs(g[1],b[1],true), prongs(g[1],b[1],false), holes(g[1],b[1]),
                    ratio(b[1]), tilt(g[1])].join('·');
    }
    // 015 — 몹 2축 × 3단계, 용사 1장. **같은 헬퍼**로 재야 장비와 같은 잣대가 된다.
    const measure = t => { const g = t.map(grid), b = g.map(bbox);
      return { b,
        boxSame: JSON.stringify(b[0])===JSON.stringify(b[1]) && JSON.stringify(b[1])===JSON.stringify(b[2]),
        t3Grew: (() => { let n=0; for (let i=0;i<N*N;i++) if (t[1][i]==='.' && t[2][i]!=='.') n++; return n; })(),
        t1NoShade: !t[0].includes('2'), t1NoHi: !t[0].includes('4'),
        len: t.every(x => x.length === N*N),
        sig: [prongs(g[1],b[1],true), prongs(g[1],b[1],false), holes(g[1],b[1]),
              ratio(b[1]), tilt(g[1])].join('·'),
        holes: holes(g[1], b[1]) }; };
    out.mob = null; out.hero = null;
    if (typeof SPR_MOB !== 'undefined') {
      out.mob = { axes: Object.keys(SPR_MOB), count: 0, geo: {}, sig: {} };
      for (const k of out.mob.axes) {
        const t = SPR_MOB[k]; out.mob.count += t.length;
        // 3장이 아닌 표는 재지 않고 **실패로 적는다**. 예전엔 t[1] 이 undefined 라
        // evaluate 가 통째로 던져서 checklist 실행 자체가 죽었다 — 검사 도구가
        // 죽으면 결함이 아니라 "결과 없음"이 되어 더 나쁘다 (015 변이5에서 실측).
        if (t.length !== 3) {
          out.mob.geo[k] = { boxSame:false, t3Grew:-1, t1NoShade:false, t1NoHi:false,
                             len:false, box:null, holes:-1, sheets:t.length };
          out.mob.sig[k] = 'sheets=' + t.length;
          continue;
        }
        const m = measure(t);
        out.mob.geo[k] = { boxSame:m.boxSame, t3Grew:m.t3Grew, t1NoShade:m.t1NoShade,
                           t1NoHi:m.t1NoHi, len:m.len, box:m.b[1], holes:m.holes };
        out.mob.sig[k] = m.sig;
      }
    }
    // 020 판정 반영 — 1-최근접 무리 판별과 면적비는 node 쪽에서 잰다.
    // 페이지에서는 **원본 문자열과 단계별 경계상자만** 내보낸다(잣대를 한 곳에 둔다).
    out.px = {}; out.box3 = {};
    for (const k of parts) {
      SPR[k].forEach((p, i) => { out.px[k + (i+1)] = p; });
      out.box3[k] = SPR[k].map(p => bbox(grid(p)));
    }
    if (typeof SPR_MOB !== 'undefined')
      for (const k of Object.keys(SPR_MOB)) {
        SPR_MOB[k].forEach((p, i) => { out.px[k + (i+1)] = p; });
        out.box3[k] = SPR_MOB[k].map(p => bbox(grid(p)));
      }
    if (typeof SPR_HERO !== 'undefined') out.px.hero1 = SPR_HERO;
    if (typeof SPR_HERO_ATK !== 'undefined') out.px.hero2 = SPR_HERO_ATK;

    if (typeof SPR_HERO !== 'undefined') {
      const g = grid(SPR_HERO), b = bbox(g);
      out.hero = { len: SPR_HERO.length, box: b,
        sig: [prongs(g,b,true), prongs(g,b,false), holes(g,b), ratio(b), tilt(g)].join('·'),
        // 몹의 채움/비움 어느 쪽도 아닌 제3의 처리 = 외곽선이 팔레트 1 이 아니라 4.
        brightEdge: !SPR_HERO.includes('1') };
    }
    return out;
  });

  if (!sg) {
    chk('SG1 손그림 총량 (18장 · 셀 N×N · 길이 N²)', false, 'SPR 접근 불가');
    chk('SG2 단계 3장이 32×32 안 · 면적비 t3/t1 ≤ 1.35', false, 'SPR 접근 불가');
    chk('SG3 같은 부위 세 장이 한 무리로 보인다 (1-최근접)', false, 'SPR 접근 불가');
    chk('SG4 부위 6종 축 서명 무충돌 (검정 실루엣 테스트)', false, 'SPR 접근 불가');
  } else {
    // 원칙 3 예외의 상한이다. 부위×등급 90장으로 새면 여기서 걸린다.
    chk('SG1 손그림 총량 (18장 · 셀 N×N · 길이 N²)',
      sg.parts.length === 6 && sg.count === 18 && sg.lenOK,
      `부위 ${sg.parts.length} · 그림 ${sg.count}장 · 셀 ${sg.N}×${sg.N} · 길이 ${sg.lenOK ? '전부 ' + sg.N*sg.N + '자' : '어긋남'}`);

    /* SG2 — 020 판정 ①. 「경계상자 완전 동일」을 버리고 「32×32 안 + 면적비 ≤ 1.35」.
       근거: t1·t2·t3 는 같은 물건의 정제 단계가 아니라 **서로 다른 재질**(가죽 →
       판금 → 사슬)이라 상자가 최대 4칸 어긋난다. 원래 근거였던 「UI 칸이 넘친다」는
       일어나지 않는다 — 넘침은 32×32 안에 드는가로 따로 본다.
       ⚠ **문턱 1.35 는 지금 그림에 맞춰 세운 것이다**(실측 최대 1.31, 여유 4%p).
       021 이 몹을 늘릴 때 이 수를 먼저 다시 본다 — 새 그림이 1.35 에 붙으면
       **문턱을 늘리지 말고 그림을 되돌린다**(계획 세션 경고). */
    const AREA_CAP = 1.35;
    const area = b => Math.max(1, (b[2] - b[0] + 1) * (b[3] - b[1] + 1));
    const sg2rows = Object.keys(sg.box3 || {}).map(k => {
      const bs = sg.box3[k];
      const fits = bs.every(b => b[0] >= 0 && b[1] >= 0 && b[2] < sg.N && b[3] < sg.N);
      return { k, fits, ratio: area(bs[2]) / area(bs[0]) };
    });
    const bad2 = sg2rows.filter(r => !r.fits || r.ratio > AREA_CAP);
    chk(`SG2 단계 3장이 ${sg.N}×${sg.N} 안 · 면적비 t3/t1 ≤ ${AREA_CAP}`,
      sg2rows.length > 0 && bad2.length === 0,
      sg2rows.length === 0 ? '단계별 경계상자를 못 읽었다'
        : bad2.length ? bad2.map(r => `${r.k}(칸안 ${r.fits} · 면적비 ${r.ratio.toFixed(2)})`).join(' · ')
        : `${sg2rows.length}묶음 전부 칸 안 · 면적비 최대 ` +
          Math.max(...sg2rows.map(r => r.ratio)).toFixed(2) + ` (상한 ${AREA_CAP}) — ` +
          sg2rows.map(r => r.k + ' ' + r.ratio.toFixed(2)).join(' '));

    /* SG3 — 020 판정 ②. 옛 「t1 이 음영·하이라이트 미사용」은 **폐기**한다.
       실측이 근거를 무너뜨렸다: 톤 칸수가 단계에 따라 오르내린다(무기 61/23 →
       40/55 → 60/35). t1·t2·t3 가 정제 단계가 아니라 다른 재질이기 때문이고,
       「등급은 밀도로 오른다」의 밀도 단조 요구 자체가 철회됐다.
       대체 요구: **같은 부위의 세 장이 한 무리로 보일 것.** */
    const eqM = {};
    for (const k of sg.parts) for (let i = 1; i <= 3; i++) {
      const id = k + i; if (sg.px && sg.px[id]) eqM[id] = { group: k, px: sg.px[id] };
    }
    const nn3 = Object.keys(eqM).length ? oneNN(eqM) : null;
    chk('SG3 같은 부위 세 장이 한 무리로 보인다 (1-최근접)',
      !!nn3 && nn3.n === 18 && nn3.bad.length === 0,
      !nn3 ? '원본 문자열을 못 읽었다'
        : nn3.bad.length ? `무리를 벗어난 장: ${nn3.bad.join(' · ')}`
        : `${nn3.n}장 전부 자기 부위가 최근접 · 여유(자기무리최대 − 다른무리최대) 최소 ` +
          nn3.margin.toFixed(3));

    // ★ 이 항목이 012 의 핵심이다. 색은 등급이 가져가므로 부위는 형태로만 갈린다.
    // 서명 = 위갈래·아래갈래·구멍·가로세로·기울기. 두 부위가 같은 서명이면 FAIL.
    const sigVals = Object.values(sg.sig), uniqSig = new Set(sigVals);
    const dup = {}; Object.entries(sg.sig).forEach(([k, v]) => { (dup[v] = dup[v] || []).push(k); });
    const clash = Object.entries(dup).filter(([, v]) => v.length > 1);
    chk('SG4 부위 6종 축 서명 무충돌 (검정 실루엣 테스트)',
      uniqSig.size === sg.parts.length,
      clash.length ? '겹침: ' + clash.map(([v, ks]) => ks.join('=') + ' [' + v + ']').join(' · ')
        : `${uniqSig.size}/${sg.parts.length} 서로 다름 — ` +
          Object.entries(sg.sig).map(([k, v]) => k + ':' + v).join(' '));

    // ── SG5·SG6 (015) — 몹 2축 6장 + 용사 1장 ──
    // 015 §3 의 지시: 별도 도구(devtools/silhouette.js)를 만들지 말고
    // **SG4 를 몹 2축으로 확장**한다. 같은 헬퍼를 쓰므로 잣대가 하나다.
    if (!sg.mob || !sg.hero) {
      chk('SG5 몹 6장 + 용사 1장 · 손그림 총량 25 · 3단계 경계상자 동일', false,
        `SPR_MOB=${!!sg.mob} SPR_HERO=${!!sg.hero} — 접근 불가`);
      chk('SG6 9종 축 서명 무충돌 · 근접 채움 / 원거리 비움 / 용사 밝은 외곽', false,
        'SPR_MOB/SPR_HERO 접근 불가');
    } else {
      /* SG5 — 020 판정 ②. 옛 「3단계 경계상자 동일 + t1 무음영」은 **폐기**.
         SG3 과 같은 이유이고, 같은 잣대로 대체한다 — 몹 2축이 한 무리로 보일 것.
         손그림 총량은 **26장**이다(장비 18 + 몹 6 + 용사 2). 018 이 공격 포즈를
         더하며 25 → 26 이 됐고 `ST3` 이 타일 12 를 더해 38 로 본다. */
      const heroN = (sg.px && sg.px.hero2) ? 2 : 1;
      const total = sg.count + sg.mob.count + heroN;
      const mobM = {};
      for (const k of sg.mob.axes) for (let i = 1; i <= 3; i++) {
        const id = k + i; if (sg.px && sg.px[id]) mobM[id] = { group: k, px: sg.px[id] };
      }
      const nn5 = Object.keys(mobM).length ? oneNN(mobM) : null;
      chk('SG5 몹 2축이 한 무리로 보인다 (1-최근접) · 손그림 26장',
        !!nn5 && nn5.n === 6 && nn5.bad.length === 0 &&
        sg.mob.axes.length === 2 && sg.mob.count === 6 && total === 26,
        !nn5 ? '원본 문자열을 못 읽었다'
          : nn5.bad.length ? `무리를 벗어난 장: ${nn5.bad.join(' · ')}`
          : total !== 26 ? `손그림 ${total}장 (장비 ${sg.count} + 몹 ${sg.mob.count} + 용사 ${heroN}) — 26 이어야 한다`
          : `장비 ${sg.count} + 몹 ${sg.mob.count} + 용사 ${heroN} = ${total}장 · ` +
            `몹 ${nn5.n}장 전부 자기 축이 최근접 · 여유 최소 ${nn5.margin.toFixed(3)}`);

      // ★ 검정 실루엣 테스트의 본체. 장비 6 + 몹 2 + 용사 = 9종이 형태만으로 갈려야 한다.
      // 채움/비움은 **에워싼 구멍**으로 잰다 — 색으로 비우면 실루엣에서 근접과 같아진다.
      const all9 = Object.assign({}, sg.sig, sg.mob.sig, { hero: sg.hero.sig });
      const dup9 = {}; Object.entries(all9).forEach(([k, v]) => { (dup9[v] = dup9[v] || []).push(k); });
      const clash9 = Object.entries(dup9).filter(([, v]) => v.length > 1);
      const solid = !!sg.mob.geo.melee && sg.mob.geo.melee.holes === 0;
      const hollow = !!sg.mob.geo.ranged && sg.mob.geo.ranged.holes >= 1;
      chk('SG6 9종 축 서명 무충돌 · 근접 채움 / 원거리 비움 / 용사 밝은 외곽',
        Object.keys(all9).length === 9 && clash9.length === 0 &&
        solid && hollow && sg.hero.brightEdge === true,
        (clash9.length ? '겹침: ' + clash9.map(([v, ks]) => ks.join('=') + ' [' + v + ']').join(' · ') + ' — ' : '') +
        `근접 구멍 ${sg.mob.geo.melee && sg.mob.geo.melee.holes}(채움=0) · ` +
        `원거리 구멍 ${sg.mob.geo.ranged && sg.mob.geo.ranged.holes}(비움≥1) · ` +
        `용사 밝은외곽 ${sg.hero.brightEdge} · ` +
        Object.entries(all9).map(([k, v]) => k + ':' + v).join(' '));
    }
  }

  // ── OC. 외곽선이 배경과 갈리는가 (014 검증에서 추가) ──
  // 014 가 고친 회귀를 잡는 검사가 없었다 — 팔레트 공식을 되돌려도 84항목이 전부
  // 통과했다(014 제안 1번). 근거는 014 §0 의 실측이다:
  //   **스프라이트에서 배경(투명)에 닿는 픽셀의 100% 가 인덱스 1(외곽선)이다.**
  //   (18장 1,298/1,298. 본체는 배경에 한 번도 닿지 않는다.)
  // 따라서 실루엣 가장자리가 보이느냐는 「외곽선 대 배경」이 정하고, 본체:배경은
  // 본체 덩어리가 배경과 갈리느냐만 말한다.
  //
  // 배경은 **매번 실측한다**(상수로 박지 않는다). 명판 ::before 가 등급색을
  // 15% 로 깔아 배경이 등급마다 다르고, 그 틴트를 바꾸면 대비도 같이 움직인다
  // (014 제안 2번). 상수로 박으면 그 변경을 검사가 못 본다.
  const ocBg = await page.evaluate(async () => {
    if (typeof plate !== 'function' || typeof gradePalette !== 'function') return null;
    const panel = document.querySelector('#manage .panel') || document.querySelector('.panel');
    if (!panel) return null;
    // ⚠ 고정 위치로 띄우면 뒤에 있는 밝은 UI 가 비쳐 배경 실측이 오염된다.
    //   **실제 패널 안에** 심어야 진짜 배경이 나온다 (014 검증에서 밟았다).
    const host = document.createElement('div');
    host.id = '__ocprobe';
    host.style.cssText = 'display:flex;gap:0;flex-wrap:wrap';
    let html = '';
    for (let g = 1; g <= 15; g++) html += plate('weapon', g);
    host.innerHTML = html;
    panel.appendChild(host);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    host.scrollIntoView({ block: 'center' });
    // 아이콘을 감춰 **그 자리 배경**을 드러낸다
    host.querySelectorAll('img.px, .ico').forEach(e => e.style.visibility = 'hidden');
    const reel = document.querySelector('.reel');
    const reelIcons = reel ? [...reel.querySelectorAll('img.px, .ico')] : [];
    reelIcons.forEach(e => e.style.visibility = 'hidden');
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    const rect = e => { const b = e.getBoundingClientRect();
      return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; };
    return { plates: [...host.children].map(rect), reel: reel ? rect(reel) : null };
  });

  let ocShot = null;
  if (ocBg) { await page.waitForTimeout(250); ocShot = (await page.screenshot()).toString('base64'); }

  const oc = ocBg && ocShot ? await page.evaluate(async ({ b64, boxes }) => {
    const img = new Image();
    await new Promise(r => { img.onload = r; img.src = 'data:image/png;base64,' + b64; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const avg = r => { if (!r || r[2] < 4 || r[3] < 4) return null;
      const x = Math.round(r[0] + r[2] / 2), y = Math.round(r[1] + r[3] / 2);
      const d = cx.getImageData(x - 1, y - 1, 3, 3).data;
      let R = 0, G = 0, B = 0; for (let i = 0; i < 9; i++) { R += d[i*4]; G += d[i*4+1]; B += d[i*4+2]; }
      return [Math.round(R/9), Math.round(G/9), Math.round(B/9)]; };
    const out = { plates: boxes.plates.map(avg), reel: avg(boxes.reel), pal: {} };
    for (let g = 1; g <= 15; g++) out.pal[g] = gradePalette(g).slice(1);
    out.pal.neutral = gradePalette(0).slice(1);
    const host = document.getElementById('__ocprobe'); if (host) host.remove();
    const reel = document.querySelector('.reel');
    if (reel) reel.querySelectorAll('img.px, .ico').forEach(e => e.style.visibility = '');
    return out;
  }, { b64: ocShot, boxes: ocBg }) : null;

  if (!oc) {
    chk('OC1 실루엣이 배경과 갈린다 (외곽선:배경 ≥4 또는 본체:배경 ≥4.5)', false, '측정 불가 (plate/gradePalette/패널 없음)');
    chk('OC2 본체가 혼자 못 갈리는 등급은 외곽선이 배경보다 밝다', false, '측정 불가');
  } else {
    // WCAG 상대 휘도·대비를 **여기서 직접 구현한다** — 페이지의 relLum 이 깨져도
    // 검사가 같이 눈멀지 않도록.
    const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const cr = (a, b) => { const x = lum(a), y = lum(b);
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

    const rows = [];
    for (let g = 1; g <= 15; g++) {
      const bg = oc.plates[g - 1], p4 = oc.pal[g];
      if (!bg || !p4) continue;
      rows.push({ name: g + '등급', out: p4[0], body: p4[2], bg });
    }
    if (oc.reel && oc.pal.neutral) rows.push({ name: '중립(릴)', out: oc.pal.neutral[0], body: oc.pal.neutral[2], bg: oc.reel });

    const ev = rows.map(r => ({ ...r, ob: cr(r.out, r.bg), bb: cr(r.body, r.bg) }));
    // OC1 — 어느 쪽으로든 실루엣이 배경에서 떨어져야 한다.
    //   ① 외곽선이 배경과 갈리거나(밝은 등급색을 올린 경우),
    //   ② 본체 덩어리가 혼자 배경과 갈리거나(밝은 등급 — 1px 림이 묻혀도 형태는 산다).
    // 문턱은 실측 근거로 잡았다: 014 는 판정값 최소 5.37, 공식을 되돌리면 2.89 다.
    const bad1 = ev.filter(r => !(r.ob >= 4 || r.bb >= 4.5));
    const worst = ev.reduce((m, r) => Math.min(m, Math.max(r.ob, r.bb)), 99);
    chk('OC1 실루엣이 배경과 갈린다 (외곽선:배경 ≥4 또는 본체:배경 ≥4.5)',
      bad1.length === 0 && ev.length >= 16,
      bad1.length ? bad1.map(r => `${r.name}(외:배 ${r.ob.toFixed(2)} · 본체:배 ${r.bb.toFixed(2)})`).join(' · ')
        : `${ev.length}종 전부 통과 · 판정값 최소 ${worst.toFixed(2)} · 외곽선:배경 ` +
          `${Math.min(...ev.map(r => r.ob)).toFixed(2)}~${Math.max(...ev.map(r => r.ob)).toFixed(2)}`);

    // OC2 — 방향 검사. 문턱이 없는 부호 판정이라 흔들리지 않는다.
    // 본체가 혼자 배경과 못 갈리는 등급에서는 가장자리 1px 이 유일한 단서이므로,
    // 외곽선을 **더 어둡게** 만들면(예전 ×0.30, 또는 고정 숯) 배경에 녹는다.
    const dim = ev.filter(r => r.bb < 4.5);
    const bad2 = dim.filter(r => !(lum(r.out) > lum(r.bg)));
    chk('OC2 본체가 혼자 못 갈리는 등급은 외곽선이 배경보다 밝다',
      bad2.length === 0,
      bad2.length ? bad2.map(r => `${r.name}(외곽선 L ${lum(r.out).toFixed(3)} ≤ 배경 L ${lum(r.bg).toFixed(3)})`).join(' · ')
        : `해당 ${dim.length}종 전부 외곽선이 더 밝다 (${dim.map(r => r.name.replace('등급','')).join(',')})`);
  }

  // ── TB. 016 화면 골격: 탭 게이팅 · 탭 전환 · 팝업 넷 (016 검증에서 추가) ──
  // 016 이 탭바·탭 넷·팝업 넷을 들였는데 **이것을 보는 검사가 하나도 없었다** —
  // 탭 마크업을 통째로 지워도 88항목이 전부 통과했다. 아래 다섯이 그 구멍을 메운다.
  // 전부 `__view` 가 아니라 **실제 DOM 과 실제 클릭**으로 본다: 탭·팝업은 DOM
  // 오버레이이고, 카운터는 "보인다"를 말하지 못한다(009·011 의 교훈).
  const TB_VIS = `(function(e){ if(!e) return false;
    const cs=getComputedStyle(e), r=e.getBoundingClientRect();
    return cs.display!=='none' && cs.visibility!=='hidden' && r.width>0 && r.height>0; })`;
  // 「굴리기 전에 실제로 보이는가」 — `display` 로는 못 잰다. 뷰포트와 **모든 스크롤
  // 조상 상자**에 세로로 얼마나 들어오는지를 재고, 90% 이상일 때만 「보인다」로 친다.
  // (016 교훈의 반대 방향: 거기서는 `overflow:hidden` 인데 통과했고, 여기서는
  //  `display:block` 인데 상자 밖에 있는 것을 「보인다」로 세면 안 된다.)
  const TB_ONSCREEN = `(function(e){
    if(!e) return {ok:false,why:'요소가 없다'};
    const cs=getComputedStyle(e);
    if(cs.display==='none') return {ok:false,why:'display:none'};
    if(cs.visibility==='hidden') return {ok:false,why:'visibility:hidden'};
    const r=e.getBoundingClientRect();
    if(r.height<=0||r.width<=0) return {ok:false,why:'크기 0'};
    const box=(t,bm)=>Math.max(0,Math.min(r.bottom,bm)-Math.max(r.top,t))/r.height;
    let frac=box(0,innerHeight), why='뷰포트 밖';
    let p=e.parentElement;
    while(p && p!==document.body){
      const pc=getComputedStyle(p);
      if(/(auto|scroll|hidden|overlay)/.test(pc.overflowY)){
        const pr=p.getBoundingClientRect(), f=box(pr.top,pr.bottom);
        if(f<frac){ frac=f; why='#'+(p.id||p.className||p.tagName)+' 상자 밖'; }
      }
      p=p.parentElement;
    }
    frac=Math.round(frac*100)/100;
    return frac>=0.9 ? {ok:true,frac,top:Math.round(r.top)}
      : {ok:false,frac,why:why+' — 세로 '+Math.round(frac*100)+'%만 들어온다 (요소 top '+Math.round(r.top)+')'};
  })`;
  let POP_KEYS = [];   // 페이지의 POPS 에서 읽는다 (하드코딩하면 키가 바뀔 때 조용히 죽는다)

  // ⚠ 창마다 **컨텍스트를 따로** 판다. 한 컨텍스트를 나눠 쓰면 localStorage 가
  //   공유돼, 먼저 연 창의 250ms 틱 save() 가 뒤 창이 심은 세이브를 덮어쓴다
  //   (016 검증에서 밟았다 — top:12 를 심었는데 top:0 으로 읽혔다).
  // ⚠ `window.save=()=>{}` 를 **addInitScript 에 넣으면 안 된다.** 그 스크립트는
  //   문서 시작에 돌고, 그 뒤 페이지의 `function save(){}` 선언이 호이스팅되며
  //   window.save 를 **도로 덮어쓴다.** 로드 **뒤에** 막아야 한다.
  const tbErrs = [], tbCtxs = [];
  // extra: 세이브에 덧씌울 필드 (027 A — 승천 관문을 채운 세이브가 필요하다)
  const tbOpen = async (top, w, h, extra) => {
    const ctx2 = await browser.newContext({ viewport: { width: w || 380, height: h || 820 } });
    tbCtxs.push(ctx2);
    const pg = await ctx2.newPage();
    pg.on('console', m => { if (m.type() === 'error' || m.type() === 'assert') tbErrs.push(m.text()); });
    pg.on('pageerror', e => tbErrs.push('pageerror: ' + e.message));
    await pg.addInitScript(a => { try {
      localStorage.setItem('forge', JSON.stringify(Object.assign({ wave: 1, top: a.top, gold: 0,
        // 032 제안 ⑵(검증 세션 판정): 씨앗의 충전을 **첫 화면과 같은 600** 으로 올렸다.
        //   30 으로 두면 TB8 의 35칸이 «제련 30» 이라는, 새 플레이어가 한 번도 안 보는
        //   좁은 라벨을 재게 된다 — 「보이는가」를 보는 식구에서 그건 최악 조건이 아니다.
        //   TB·LG·GR 어느 항목도 충전 «값»으로 판정하지 않으므로(그 검사들은 각자
        //   S.charge 를 따로 심는다) 이 값을 올려도 판정이 안 흔들린다 — 031+032
        //   검증에서 전 항목 재실행으로 확인했다.
        tok: 2, lv: 0, star: 0, charge: 600, queue: [], equip: {},
        asell: new Array(15).fill(false), t: Date.now() }, a.extra || {})));
    } catch (e) {} }, { top, extra: extra || null });
    await pg.goto(URL);
    await pg.evaluate(() => { try { window.save = () => {}; } catch (e) {} });
    await pg.waitForTimeout(2400);
    return pg;
  };
  const tbFailAll = why => {
    chk('TB1 탭바 게이팅 (웨이브 10 전 탭바 없음 · 도달 시 제련·던전·테크 **정확히 셋**)', false, why);
    chk('TB2 탭 전환 — 누른 탭만 켜지고 보인다 (380 · 1280)', false, why);
    chk('TB3 팝업 전부 열림 · 닫기 버튼과 배경 탭 둘 다로 닫힘', false, why);
    chk('TB4 팝업이 열린 동안 전투력·웨이브·골드가 보인다', false, why);
    chk('TB5 팝업 전부 도달성 (세 크기 · 넘칠 때 끝까지 · 위쪽 잘림 없음)', false, why);
    chk('TB6 빈 설정 팝업은 없다 (톱니 유무 두 벌)', false, why);
    chk('TB7 팝업 입구를 실제로 눌러서 연다 (세 크기 · 자리·도달·제목)', false, why);
    chk(`TB8 첫 화면에 굴리기 전 강화·승천·제련이 보인다 (크기 ${TB8_SIZES.length})`, false, why);
  };

  // ⚠ 이 블록은 **016 골격이 없는 트리에서도 죽지 않아야 한다.** 검사가 터져 죽으면
  //   출력이 없고, 그것을 "검사가 못 잡는다"로 오독한다 (CLAUDE.md 규칙, 015 에서 확립).
  //   검증 세션이 이 검사를 처음 짤 때 그대로 밟았다 — 015 트리에서
  //   `openPop is not defined` 로 checklist 가 통째로 죽었다. 아래가 그 수정본이다.
  let tbSkel = null;
  try {
    const probe = await tbOpen(12);
    tbSkel = await probe.evaluate(() => ({
      tabs: !!document.getElementById('tabs'),
      panes: document.querySelectorAll('.tabpane').length,
      pop: !!document.getElementById('pop'),
      popsecs: document.querySelectorAll('.popsec').length,
      openPop: typeof openPop === 'function', closePop: typeof closePop === 'function',
      pclose: !!document.getElementById('pclose'), pstat: !!document.getElementById('pstat'),
      keys: (typeof POPS === 'object' && POPS) ? Object.keys(POPS) : [],
      cog: !!document.getElementById('cog'),
      // 설정 팝업 안에 자동판매 등급 체크와 승천이 있는가 (016 완료 조건)
      setHasSell: !!document.querySelector('#popSet #asell, #popSell #asell'),
      setHasAsc: !!document.querySelector('#popSet #asc, #popSell #asc, #popAsc #ascGo')
    }));
    POP_KEYS = (tbSkel.keys || []).slice();
    await probe.close();
  } catch (e) { tbSkel = { err: String((e && e.message) || e) }; }

  // ⚠ **전제를 좁혔다** (027 A-1 · 023 제안 ⑵). 옛 전제는 `popsecs >= 4`·`keys >= 4`·
  //   `tabs`·`panes >= 2` 까지 요구해서, **설정 절 하나가 빠지는 순간 TB 여섯이
  //   한꺼번에 눈을 감았다** — exit 1 은 뜨지만 「검사가 잡았다」가 아니라 «아무것도
  //   안 봤다»다 (023 M2 실측). 절 개수·탭 유무는 각 검사가 **자기 실패**로 적는다.
  //   여기서 막는 것은 **골격이 아예 없어 검사가 터져 죽는 경우**뿐이다.
  const tbMissing = !tbSkel || tbSkel.err || !tbSkel.pop || !tbSkel.openPop || !tbSkel.pstat;

  if (tbMissing) {
    tbFailAll('016 화면 골격이 없다 — ' + JSON.stringify(tbSkel));
  } else { try {

    // ── TB1 게이팅: 새 세이브에는 탭바 자체가 없고, 최고 웨이브 10 에서 나타난다
    // 016 「탭이 하나뿐인 탭바는 거짓말이다」 + 원칙 7(첫 3분 순수 스핀).
    {
      const read = async pg => pg.evaluate(vis => {
        const V = eval(vis);
        const bar = document.getElementById('tabs');
        const btns = bar ? [...bar.querySelectorAll('button')] : [];
        return { bar: V(bar), n: btns.filter(V).length,
          ids: btns.filter(V).map(b => b.id), labels: btns.filter(V).map(b => b.textContent.trim()) };
      }, TB_VIS);
      const before = await tbOpen(0);  const b0 = await read(before);  await before.close();
      const after  = await tbOpen(12); const b1 = await read(after);   await after.close();
      const gateOk = b0.bar === false;
      // 016 검증에서 남긴 조임(017 에서 반영): **「포함」이 아니라 「정확히 셋」**이다.
      // 예전 판은 `every(id => ids.includes(id))` 라 넷째 탭이 생겨도 통과했다 —
      // 「탭은 셋」은 원칙 4·7 에 붙은 규칙이지 취향이 아니므로 개수와 이름을 못박는다.
      const WANT_IDS = ['tbForge', 'tbTower', 'tbTech'];
      const WANT_LBL = ['제련', '던전', '테크'];
      const idsOk = JSON.stringify(b1.ids) === JSON.stringify(WANT_IDS);
      const lblOk = JSON.stringify(b1.labels) === JSON.stringify(WANT_LBL);
      const openOk = b1.bar === true && b1.n === 3 && idsOk && lblOk;
      const why = [];
      if (b0.bar !== false) why.push(`새 세이브에 탭바가 보인다(버튼 ${b0.n}개 ${JSON.stringify(b0.labels)})`);
      if (b1.bar !== true) why.push('게이트 후에도 탭바가 없다');
      else if (b1.n !== 3) why.push(`탭이 ${b1.n}개다 (셋이어야 한다) ${JSON.stringify(b1.labels)}`);
      else if (!idsOk) why.push(`id 가 다르다 ${JSON.stringify(b1.ids)} ≠ ${JSON.stringify(WANT_IDS)}`);
      else if (!lblOk) why.push(`라벨이 다르다 ${JSON.stringify(b1.labels)} ≠ ${JSON.stringify(WANT_LBL)}`);
      chk('TB1 탭바 게이팅 (웨이브 10 전 탭바 없음 · 도달 시 제련·던전·테크 **정확히 셋**)',
        gateOk && openOk,
        why.length ? why.join(' · ')
          : `새 세이브: 탭바 없음(버튼 0개) · 최고 12: 탭바 보임 · 탭 정확히 3개 ${JSON.stringify(b1.labels)}`);
    }

    // ── TB2 탭 전환: 보이는 탭마다 눌러서 그 판만 켜지는가 (두 크기)
    {
      const bad = [];
      for (const vp of [{ w: 380, h: 820, nm: '380' }, { w: 1280, h: 720, nm: '1280' }]) {
        const pg = await tbOpen(12, vp.w, vp.h);
        const btns = await pg.evaluate(vis => { const V = eval(vis);
          const bar = document.getElementById('tabs');
          return bar ? [...bar.querySelectorAll('button')].filter(V).map(b => b.id) : []; }, TB_VIS);
        for (const id of btns) {
          // 진짜 클릭이다 — el.click() 은 pointerdown 을 안 쏴서 배선을 덜 탄다(011).
          try { await pg.click('#' + id, { timeout: REACH_TIMEOUT }); }
          catch (e) { bad.push(`${vp.nm}:${id} 못 누름`); continue; }
          await pg.waitForTimeout(220);
          const r = await pg.evaluate(vis => { const V = eval(vis);
            const panes = [...document.querySelectorAll('.tabpane')];
            return { on: panes.filter(e => e.classList.contains('on')).map(e => e.id),
              shown: panes.filter(V).map(e => e.id) }; }, TB_VIS);
          const want = 'tab' + id.slice(2);
          if (r.on.length !== 1 || r.on[0] !== want) bad.push(`${vp.nm}:${id} → on=${JSON.stringify(r.on)}`);
          else if (r.shown.length !== 1 || r.shown[0] !== want) bad.push(`${vp.nm}:${id} → 보이는 판 ${JSON.stringify(r.shown)}`);
        }
        if (!btns.length) bad.push(`${vp.nm}: 탭 버튼 0개`);
        await pg.close();
      }
      chk('TB2 탭 전환 — 누른 탭만 켜지고 보인다 (380 · 1280)', bad.length === 0,
        bad.length ? bad.slice(0, 4).join(' · ') : '두 크기에서 보이는 탭 전부 전환 정상 · 동시에 켜진 판 1개');
    }

    // ── TB3 팝업 넷: 각각 열리고, 닫기 버튼과 배경 탭 **둘 다**로 닫힌다
    {
      const pg = await tbOpen(12);
      const bad = [];
      // 전제를 좁혔으므로(027 A-1) 키가 0개일 수 있다 — 그러면 루프가 안 돌고
      // 검사가 **공허하게 통과**한다. 그 길을 여기서 막는다 (016 TB5 교훈).
      if (!POP_KEYS.length) bad.push('POPS 가 비었다 — 팝업이 하나도 없다');
      for (const k of POP_KEYS) {
        const secId = 'pop' + k[0].toUpperCase() + k.slice(1);
        const opened = await pg.evaluate(({ key, sec, vis }) => { const V = eval(vis);
          if (typeof openPop !== 'function') return { err: 'openPop 없음' };
          try { openPop(key); } catch (e) { return { err: String(e) }; }
          return { pop: V(document.getElementById('pop')), sec: V(document.getElementById(sec)),
            others: [...document.querySelectorAll('.popsec')].filter(V).map(e => e.id) };
        }, { key: k, sec: secId, vis: TB_VIS });
        if (opened.err) { bad.push(`${k}: ${opened.err}`); continue; }
        if (!opened.pop || !opened.sec) { bad.push(`${k}: 안 열림(pop ${opened.pop} · 절 ${opened.sec})`); continue; }
        if (opened.others.length !== 1) bad.push(`${k}: 절이 ${opened.others.length}개 켜짐 ${JSON.stringify(opened.others)}`);
        try { await pg.click('#pclose', { timeout: REACH_TIMEOUT }); } catch (e) { bad.push(`${k}: 닫기 버튼 못 누름`); }
        await pg.waitForTimeout(160);
        let shut = await pg.evaluate(vis => eval(vis)(document.getElementById('pop')), TB_VIS);
        if (shut) bad.push(`${k}: 닫기 버튼으로 안 닫힘`);
        await pg.evaluate(key => { if (typeof openPop === 'function') openPop(key); }, k);
        await pg.waitForTimeout(160);
        const box = await pg.evaluate(() => { const r = document.getElementById('pop').getBoundingClientRect();
          return [r.x, r.y]; });
        await pg.mouse.click(Math.round(box[0] + 3), Math.round(box[1] + 3));
        await pg.waitForTimeout(160);
        shut = await pg.evaluate(vis => eval(vis)(document.getElementById('pop')), TB_VIS);
        if (shut) bad.push(`${k}: 배경 탭으로 안 닫힘`);
        await pg.evaluate(() => { try { if (typeof closePop === 'function') closePop(); } catch (e) {} });
      }
      chk('TB3 팝업 전부 열림 · 닫기 버튼과 배경 탭 둘 다로 닫힘', bad.length === 0,
        bad.length ? bad.slice(0, 4).join(' · ')
          : `${POP_KEYS.length}종(${POP_KEYS.join("·")}) 전부 열리고 두 방법으로 닫힌다 — 027 B-3 이 설정 절을 걷어낸 뒤로는 셋이다`);
      await pg.close();
    }

    // ── TB4 팝업이 열린 동안 전투력·웨이브·골드가 보인다
    {
      const pg = await tbOpen(12);
      const bad = [];
      if (!POP_KEYS.length) bad.push('POPS 가 비었다 — 팝업이 하나도 없다');
      for (const k of POP_KEYS) {
        const r = await pg.evaluate(({ key, vis }) => { const V = eval(vis);
          if (typeof openPop !== 'function') return { vis: false, txt: 'openPop 없음', pw: false, wv: false, n: 0 };
          openPop(key);
          const ps = document.getElementById('pstat');
          const txt = (ps && V(ps)) ? ps.textContent : '';
          return { vis: !!(ps && V(ps)), pw: /전투력/.test(txt), wv: /웨이브/.test(txt),
            n: (txt.match(/\d/g) || []).length, txt: txt.slice(0, 60) };
        }, { key: k, vis: TB_VIS });
        if (!r.vis || !r.pw || !r.wv || r.n < 3) bad.push(`${k}: "${r.txt}"`);
        await pg.evaluate(() => { try { if (typeof closePop === 'function') closePop(); } catch (e) {} });
      }
      chk('TB4 팝업이 열린 동안 전투력·웨이브·골드가 보인다', bad.length === 0,
        bad.length ? bad.join(' · ') : '네 팝업 모두 #pstat 에 전투력·웨이브·골드가 살아 있다');
      await pg.close();
    }

    // ── TB5 팝업 도달성 (008 이 고친 결함을 되살리지 않는다)
    // ⚠ 지금 팝업 넷은 세 크기 모두에서 **내용이 안 넘친다**(넘침 0px). 그 상태로
    //   "끝까지 닿는다"만 재면 **아무것도 증명하지 않는 검사**가 된다 — 실제로
    //   `overflow:hidden` 변이가 그대로 통과했다. 그래서 **일부러 넘치게 만들어** 잰다.
    {
      const bad = []; let natMax = 0;
      if (!POP_KEYS.length) bad.push('POPS 가 비었다 — 팝업이 하나도 없다');
      for (const vp of REACH) {
        const pg = await tbOpen(12, vp.w, vp.h);
        for (const k of POP_KEYS) {
          await pg.evaluate(key => { if (typeof openPop === 'function') openPop(key); }, k);
          await pg.waitForTimeout(200);
          const g = await pg.evaluate(() => {
            const pop = document.getElementById('pop');
            const sec = [...pop.querySelectorAll('.popsec')].find(e => e.classList.contains('on')) || pop;
            const nat = pop.scrollHeight - pop.clientHeight;
            pop.scrollTop = 0;
            const gap = Math.round(pop.firstElementChild.getBoundingClientRect().top -
                                   pop.getBoundingClientRect().top);
            const sp = document.createElement('div');
            sp.style.height = (pop.clientHeight + 400) + 'px';
            sec.appendChild(sp);
            const sh = pop.scrollHeight, ch = pop.clientHeight;
            pop.scrollTop = pop.scrollHeight;
            const moved = pop.scrollTop > 0;
            const end = document.getElementById('popend') || pop.lastElementChild;
            const reached = end.getBoundingClientRect().bottom <= pop.getBoundingClientRect().bottom + 2;
            // ⚠ scrollTop 은 `overflow:hidden` 에서도 **프로그램으로는 움직인다** —
            //   그래서 도달성만 재면 스크롤바가 없는 팝업이 통과한다(016 검증에서 실측).
            //   사람이 실제로 굴릴 수 있는지는 계산된 overflow-y 로 따로 본다.
            const ov = getComputedStyle(pop).overflowY;
            sp.remove(); pop.scrollTop = 0;
            return { gap, nat, sh, ch, moved, reached, ov };
          });
          natMax = Math.max(natMax, g.nat);
          if (g.gap < -1) bad.push(`${vp.nm}/${k}: 위쪽 ${g.gap}px 잘림`);
          if (!/^(auto|scroll|overlay)$/.test(g.ov)) bad.push(`${vp.nm}/${k}: 사람이 못 굴린다 (overflow-y:${g.ov})`);
          if (!g.moved) bad.push(`${vp.nm}/${k}: 넘쳐도 스크롤이 안 된다 (${g.sh}/${g.ch}px)`);
          else if (!g.reached) bad.push(`${vp.nm}/${k}: 넘칠 때 끝까지 못 닿음 (${g.sh}/${g.ch}px)`);
          await pg.evaluate(() => { try { if (typeof closePop === 'function') closePop(); } catch (e) {} });
        }
        await pg.close();
      }
      chk('TB5 팝업 전부 도달성 (세 크기 · 넘칠 때 끝까지 · 위쪽 잘림 없음)', bad.length === 0,
        bad.length ? bad.slice(0, 4).join(' · ')
          : `${REACH.length}크기 × ${POP_KEYS.length}팝업 = ${REACH.length * POP_KEYS.length}조합 · ` +
            `강제로 넘치게 해도 끝까지 도달 · 위쪽 잘림 0 (자연 상태 넘침 ${natMax}px — 그래서 강제한다)`);
    }

    // ── TB6 «빈 설정 팝업은 없다» — 톱니 유무로 **두 벌** (027 A-3)
    // CLAUDE.md 「기준선이 미래 버전의 것이면 키를 잡아 두 벌로 실어라」(019 SG7 규약).
    // 027 B 가 톱니를 걷으므로, 지금 빌드와 B 뒤 빌드가 **같은 불변식**을 다른 모양으로
    // 만족하게 한다. 지키는 것 하나: **누르면 빈 창이 뜨는 버튼은 없다.**
    //   · 톱니가 **있으면** — 톱니가 설정 팝업을 열고, **그 절에 쓸 것이 실제로 들어 있다.**
    //     (016 완료 조건: 자동판매·승천. 여기에 «비어 있지 않다»를 더한다.)
    //   · 톱니가 **없으면** — 설정 팝업도 POPS.set 도 없고, `#asell`·`#asc` 가
    //     `#tabForge` 안에 있다.
    // ⚠ 「비어 있다」는 **보이는 조작 요소 수**로 잰다 — `display` 만 보면 `#asc` 가
    //   display:none 인 새 세이브에서 «절은 있다»로 통과한다(009 카운터 교훈).
    {
      const pg = await tbOpen(0);          // **새 세이브에서도** 성립해야 한다
      const r = await pg.evaluate(vis => { const V = eval(vis);
        const cog = document.getElementById('cog');
        const keys = (typeof POPS === 'object' && POPS) ? Object.keys(POPS) : [];
        const inForge = id => { let p = document.getElementById(id);
          while (p && p !== document.body) { if (p.id === 'tabForge') return true; p = p.parentElement; }
          return false; };
        if (!cog) {                        // ── 톱니 없는 벌 (027 B 뒤)
          return { cog: false, keys,
            setPop: !!document.getElementById('popSet'), setKey: keys.indexOf('set') > -1,
            sellInForge: inForge('asell'), ascInForge: inForge('asc'),
            sellEl: !!document.getElementById('asell'), ascEl: !!document.getElementById('asc') };
        }
        const before = V(document.getElementById('pop'));
        cog.click();
        const on = [...document.querySelectorAll('.popsec')].filter(V);
        // 열린 절 안에서 **사람이 볼 수 있고 누를 수 있는 것**을 센다.
        // ⚠ `button,input` 만 세면 안 된다 — `#asell` 은 `<label>` 에 onclick 을 걸고
        //   진짜 `<input>` 은 `display:none` 이다(forge.html `#asell input{display:none}`).
        //   태그로만 세면 «자동판매 칸이 멀쩡히 보이는데 0개»가 나온다.
        const ctl = on.length === 1
          ? [...on[0].querySelectorAll('*')].filter(e => V(e) &&
              (e.onclick || /^(BUTTON|SELECT|TEXTAREA|INPUT)$/.test(e.tagName))).length : -1;
        return { cog: V(cog), before, opened: V(document.getElementById('pop')),
          sec: on.map(e => e.id), ctl, keys,
          title: (document.getElementById('ptitle') || {}).textContent || '',
          sell: !!document.querySelector('.popsec.on #asell'),
          asc: !!document.querySelector('.popsec.on #asc') };
      }, TB_VIS);
      if (r.cog === false) {
        const ok = !r.setPop && !r.setKey && r.sellInForge && r.ascInForge;
        const why = [];
        if (r.setPop) why.push('#popSet 이 남아 있다');
        if (r.setKey) why.push('POPS.set 이 남아 있다');
        if (!r.sellEl) why.push('#asell 이 아예 사라졌다');
        else if (!r.sellInForge) why.push('#asell 이 #tabForge 밖이다');
        if (!r.ascEl) why.push('#asc 가 아예 사라졌다');
        else if (!r.ascInForge) why.push('#asc 가 #tabForge 밖이다');
        chk('TB6 빈 설정 팝업은 없다 (톱니 유무 두 벌)', ok,
          why.length ? '톱니 없는 벌 — ' + why.join(' · ')
            : '톱니 없는 벌 — 설정 팝업·POPS.set 없음 · #asell·#asc 가 #tabForge 안');
      } else {
        const ok = !!(r.cog && !r.before && r.opened && r.sec.length === 1 && r.sell && r.asc && r.ctl > 0);
        const why = [];
        if (!r.opened) why.push('톱니를 눌러도 안 열린다');
        if (r.sec.length !== 1) why.push('켜진 절 ' + JSON.stringify(r.sec));
        if (!r.sell) why.push('설정 절에 #asell 이 없다');
        if (!r.asc) why.push('설정 절에 #asc 가 없다');
        if (r.ctl === 0) why.push('★ 설정 절이 **비어 있다** — 보이는 조작 요소 0개');
        chk('TB6 빈 설정 팝업은 없다 (톱니 유무 두 벌)', ok,
          why.length ? '톱니 있는 벌 — ' + why.join(' · ')
            : `톱니 있는 벌 — 제목 "${r.title}" · 켜진 절 ${JSON.stringify(r.sec)} · ` +
              `자동판매 ${r.sell} · 승천 ${r.asc} · 보이는 조작 요소 ${r.ctl}개`);
      }
      await pg.close();
    }

    // ── TB7 팝업 입구를 **실제로 눌러서** 연다 (027 A-2 · 023 제안 ⑴)
    // 옛 TB3~TB5 는 전부 `openPop(key)` 를 **직접 불러서** 팝업을 열었다. 그러면
    // **입구 버튼이 어디로 옮겨가든, 심지어 사라져도** 검사가 통과한다 — 023 이
    // `#bOdds` 를 설정 팝업으로 옮긴 M1 빌드에서 TB 여섯이 전부 통과한 이유다.
    // 여기서는 `openPop` 을 부르지 않는다. **입구를 찾아서 누른다.**
    //   ① 입구가 어느 탭/영역에 사는가 (기준선 대조)
    //   ② 굴려서 닿는가 (사람이 실제로 굴릴 수 있는 상자인가까지 — TB5 교훈)
    //   ③ 눌렀을 때 뜨는 제목이 POPS[key] 와 같은가
    // ⚠ 입구는 **하드코딩하지 않는다.** onclick 소스에서 openPop('키') 를 읽어 찾는다.
    //   선택자를 박아 두면 입구가 사라져도 「없다」가 아니라 「못 찾았다」가 된다.
    // ⚠ 기준선은 톱니 유무로 **두 벌**이다(TB6 과 같은 규약). 기준선이 없는 키가
    //   오면 통과시키지 않고 FAIL 한다 — 못 재는 것을 통과로 적지 않는다.
    const TB7_HOME = {
      withCog: { odds: 'tabForge', stats: 'tabForge', set: 'hud', asc: 'pop' },
      noCog:   { odds: 'tabForge', stats: 'tabForge', asc: 'tabForge' }
    };
    {
      const bad = [], note = [];
      // 승천 관문을 채운 세이브 — `#asc` 는 canAscend() 일 때만 보인다.
      // cap()===GMAX 는 제련 20 부터, ASC_LV() 는 28, ASC_WAVE() 는 ★0 에서 100.
      const ASC_SAVE = { lv: 28, peak: 120, top: 120 };
      for (const vp of REACH) {
        const pg = await tbOpen(120, vp.w, vp.h, ASC_SAVE);
        const found = await pg.evaluate(() => {
          const out = { keys: (typeof POPS === 'object' && POPS) ? Object.keys(POPS) : [],
                        cog: !!document.getElementById('cog'), ent: {} };
          const homeOf = e => { let p = e;
            while (p && p !== document.body) {
              if (p.id === 'pop') return 'pop';
              if (p.id === 'hud') return 'hud';
              if (p.id === 'tabs') return 'tabs';
              if (p.classList && p.classList.contains('tabpane')) return p.id;
              p = p.parentElement; }
            return 'body'; };
          const secOf = e => { let p = e;
            while (p && p !== document.body) {
              if (p.classList && p.classList.contains('popsec')) return p.id;
              p = p.parentElement; }
            return null; };
          for (const el of document.querySelectorAll('*')) {
            const h = el.onclick; if (!h) continue;
            const m = String(h).match(/openPop\(\s*['"]([A-Za-z]+)['"]\s*\)/);
            if (m && !out.ent[m[1]])
              out.ent[m[1]] = { id: el.id || '', home: homeOf(el), sec: secOf(el) };
          }
          return out;
        });
        const base = found.cog ? TB7_HOME.withCog : TB7_HOME.noCog;
        if (!found.keys.length) bad.push(`${vp.nm}: POPS 가 비었다`);
        if (!found.cog && found.keys.indexOf('set') > -1)
          bad.push(`${vp.nm}: 톱니가 없는데 POPS.set 이 남았다`);
        for (const k of found.keys) {
          const e = found.ent[k];
          const want = base[k];
          if (want === undefined) { bad.push(`${vp.nm}/${k}: 기준선이 없다 — 표를 넓히기 전에는 판정하지 않는다`); continue; }
          if (!e) { bad.push(`${vp.nm}/${k}: **입구가 없다** (openPop('${k}') 를 부르는 버튼이 하나도 없다)`); continue; }
          if (e.home !== want) { bad.push(`${vp.nm}/${k}: 입구가 ${e.home} 에 있다 (기준선 ${want})`); continue; }
          if (!e.id) { bad.push(`${vp.nm}/${k}: 입구에 id 가 없어 누를 수 없다`); continue; }
          // ── 누른다. 팝업 안에 사는 입구(오늘의 asc)는 담는 절부터 연다.
          let chain = null;
          if (e.home === 'pop' && e.sec) {
            const ck = e.sec.replace(/^pop/, ''); chain = ck.charAt(0).toLowerCase() + ck.slice(1);
            const ce = found.ent[chain];
            if (!ce || !ce.id) { bad.push(`${vp.nm}/${k}: 담는 절 ${e.sec} 의 입구를 못 찾았다`); continue; }
            try { await pg.click('#' + ce.id, { timeout: REACH_TIMEOUT }); } catch (x) {
              bad.push(`${vp.nm}/${k}: 담는 절 입구 #${ce.id} 를 못 눌렀다`); continue; }
            await pg.waitForTimeout(150);
          } else if (/^tab/.test(e.home)) {
            const tb = 'tb' + e.home.slice(3);
            await pg.evaluate(id => { const b = document.getElementById(id); if (b) b.click(); }, tb);
            await pg.waitForTimeout(150);
          }
          // ② 굴려서 닿는가 — 안 보이면 굴려 보고, 굴릴 수 있는 상자인지도 본다
          const reach = await pg.evaluate(({ id, on }) => {
            const V = eval(on), el = document.getElementById(id);
            const a = V(el); if (a.ok) return { ok: true, scrolled: false, frac: a.frac };
            el.scrollIntoView({ block: 'center' });
            const b = V(el);
            let ov = '';
            let p = el.parentElement;
            while (p && p !== document.body) { const c = getComputedStyle(p);
              if (/(auto|scroll|hidden|overlay)/.test(c.overflowY)) { ov = c.overflowY; break; }
              p = p.parentElement; }
            return { ok: b.ok, scrolled: true, why: b.why, frac: b.frac, ov, first: a.why };
          }, { id: e.id, on: TB_ONSCREEN });
          if (!reach.ok) { bad.push(`${vp.nm}/${k}: 굴려도 입구 #${e.id} 에 못 닿는다 (${reach.why})`); continue; }
          if (reach.scrolled && !/^(auto|scroll|overlay)$/.test(reach.ov))
            bad.push(`${vp.nm}/${k}: 굴려야 닿는데 사람이 못 굴린다 (overflow-y:${reach.ov || '없음'})`);
          // ③ 눌렀을 때 뜨는 제목
          try { await pg.click('#' + e.id, { timeout: REACH_TIMEOUT }); } catch (x) {
            bad.push(`${vp.nm}/${k}: 입구 #${e.id} 를 못 눌렀다`); continue; }
          await pg.waitForTimeout(180);
          const got = await pg.evaluate(({ key, vis }) => { const V = eval(vis);
            return { open: V(document.getElementById('pop')),
              title: (document.getElementById('ptitle') || {}).textContent || '',
              want: (typeof POPS === 'object' && POPS) ? POPS[key] : '',
              on: [...document.querySelectorAll('.popsec')].filter(V).map(e2 => e2.id) };
          }, { key: k, vis: TB_VIS });
          if (!got.open) bad.push(`${vp.nm}/${k}: #${e.id} 를 눌러도 팝업이 안 뜬다`);
          else if (got.title !== got.want) bad.push(`${vp.nm}/${k}: 제목이 "${got.title}" (POPS 는 "${got.want}")`);
          else if (got.on.length !== 1) bad.push(`${vp.nm}/${k}: 절이 ${got.on.length}개 켜짐 ${JSON.stringify(got.on)}`);
          else if (vp === REACH[0]) note.push(`${k}←#${e.id}(${e.home})`);
          await pg.evaluate(() => { try { if (typeof closePop === 'function') closePop(); } catch (x) {} });
          await pg.waitForTimeout(120);
        }
        await pg.close();
      }
      chk('TB7 팝업 입구를 실제로 눌러서 연다 (세 크기 · 자리·도달·제목)', bad.length === 0,
        bad.length ? bad.slice(0, 4).join(' · ')
          : `${REACH.length}크기 × ${note.length}입구 — ${note.join(' · ')} · 전부 굴려 닿고 제목이 POPS 와 일치`);
    }

    // ── TB8 첫 화면에 **굴리기 전에** 보여야 하는 것 (027 A-4 → 030 이 넓혔다)
    // ⚠ 「보인다」는 `display` 가 아니라 **뷰포트와 모든 스크롤 상자 안에 실제로
    //   들어오는가**로 잰다 — 016 「scrollTop 만 보면 overflow:hidden 도 통과한다」의
    //   같은 함정이 반대 방향으로 난다. 문턱: 세로로 **90% 이상**이 상자 안.
    //
    // 030 이 더한 것 둘 (027 판정 ⑵ — 이 확장은 027 검증에서 미리 세운다):
    //   ⑴ **크기 다섯** — CrazyGames 가 「가장 중요하다」고 적은 데스크톱 비전체화면
    //      넷(821×462·907×510·1077×606·1216×684)과 모바일(800×450). **다섯의 세로가
    //      전부 1280×720 보다 짧다.** 여기서 주 버튼이 안 보이면 제출이 막힌다.
    //   ⑵ **항목 `#spin`** — 제련은 이 게임의 주 버튼이다. 027 까지는 아무도 안 봤다.
    // ⚠ **새 크기 다섯은 지금 빌드에서 FAIL 이 정상이다.** 030(가로형 레이아웃)이
    //   전부 PASS 로 뒤집는다. **FAIL 을 없애려고 문턱을 무르게 풀지 말 것** —
    //   그러면 030 이 무엇을 고쳤는지 아무도 못 본다(027-A 가 박아 둔 경고 그대로).
    //
    // ⚠⚠ **일부러 빼는 칸이 둘 있다 — 조용히 빼지 않는다.**
    //   ⑴ `380×820 · 승천 배너 켜짐 · #spin`. 027 제안 ⑴에 대한 **계획 세션 판정 ①**
    //   (「그대로 둔다」)이 그 자리다: 관문이 열린 뒤에는 제련이 가장 값없는 동작이라
    //   (026 실측 — 스핀은 병목이 아니다 / 025 실측 — 그 시간 골드는 쓸 데가 없고
    //   장비는 승천에 팔린다) **배너가 제련을 밀어내는 것이 그 순간의 우선순위 그대로**다.
    //   ⑵ `380×820 · 평범 · #autores`(033 판정 ⓐ). 「정리」가 앉은 대기열 줄은 **033
    //   전에도** 첫 화면 6px 아래였다(줄 top 514 vs `#focus` 밑 508 — 얼린 033 전
    //   빌드에서 실측). 위로 올리면 여유가 2px 뿐인 `#spin` 이 밀리고, 「정리」는 기본
    //   켜짐이라 **보고 눌러야 시작되는 동작이 아니라 설정**이다.
    //   그래서 이 둘은 «결함이 아니라 설계»다. 아래 `TB8_SKIPS` 가 그 칸들이고,
    //   빠졌다는 사실과 이유를 **판정문에 매번 적는다.**
    // (크기 목록과 제외 칸은 바깥 범위로 올렸다 — LG1 과 공유한다)
    {
      const bad = [], ok = [], cgBad = [], curBad = [];
      const read = (pg, id) => pg.evaluate(({ on, i }) => { const V = eval(on);
        scrollTo(0, 0);
        for (const e of document.querySelectorAll('*'))
          if (e.scrollTop) e.scrollTop = 0;              // «굴리기 전» 상태를 만든다
        return { v: V(document.getElementById(i)),
                 can: (typeof canAscend === 'function') ? canAscend() : null };
      }, { on: TB_ONSCREEN, i: id });
      for (const vp of TB8_SIZES) {
        // ⑴ 평범한 세이브 — 강화와 제련, 그리고 033 의 「정리」
        //    (033 지시서: `#autores` 를 TB8 에 더할 것. 대기열 줄에 붙은 작은 버튼이라
        //     아홉 크기에서 **굴리지 않고 보이는지**가 곧 그 자리의 판정이다.)
        const pg = await tbOpen(12, vp.w, vp.h);
        for (const [id, lab] of [['up', '강화'], ['spin', '제련'], ['autores', '정리']]) {
          const key = `${vp.nm}/평범/${lab}`;
          if (TB8_SKIP_KEYS.includes(key)) continue;      // ← 이름 붙인 예외. 아래 판정문이 든다
          const r = await read(pg, id);
          if (r.v.ok) ok.push(key);
          else { bad.push(`${key} #${id}: ${r.v.why}`); (vp.cg ? cgBad : curBad).push(key); }
        }
        await pg.close();
        // ⑵ 승천 관문을 채운 세이브 — 승천 배너와 제련
        const pg2 = await tbOpen(120, vp.w, vp.h, { lv: 28, peak: 120, top: 120 });
        for (const [id, lab] of [['asc', '승천'], ['spin', '제련']]) {
          const key = `${vp.nm}/배너/${lab}`;
          if (TB8_SKIP_KEYS.includes(key)) continue;      // ← 이름 붙인 예외
          const r = await read(pg2, id);
          if (r.can === false) { bad.push(`${key}: 세이브가 관문을 못 채웠다 — 검사 잘못`);
            (vp.cg ? cgBad : curBad).push(key); continue; }
          if (r.v.ok) ok.push(key);
          else { bad.push(`${key} #${id}: ${r.v.why}`); (vp.cg ? cgBad : curBad).push(key); }
        }
        await pg2.close();
      }
      const total = ok.length + bad.length;
      chk(`TB8 첫 화면에 굴리기 전 강화·승천·제련이 보인다 (크기 ${TB8_SIZES.length})`,
        bad.length === 0,
        (bad.length
          ? `${bad.length}/${total} 안 보임 — 030 새 크기 ${cgBad.length}칸 · 현행 크기 ${curBad.length}칸` +
            (cgBad.length ? ` [새 크기: ${cgBad.join(', ')}]` : '') +
            (curBad.length ? ` [현행: ${curBad.join(', ')}]` : '') +
            `  ⚠ 030(가로형) 전에는 새 크기 FAIL 이 정상이다 — 예: ${bad[0]}`
          : `${total}칸 전부 굴리기 전에 보인다`) +
        `  · **제외 ${TB8_SKIPS.length}칸(결함이 아니라 설계):** ` +
        TB8_SKIPS.map(([k, why]) => `**${k}** — ${why}`).join('  /  '));
    }
  } catch (e) {
    // 골격은 있는데 조작 중 터졌다 — 이것도 결함이지 "결과 없음"이 아니다.
    chk('TB-예외 탭·팝업 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  } }

  /* ── GR1 : 장비 격자(#gear)가 최악 조건에서도 가로로 안 넘친다 ────────────────
     031 제안 ⑴ 이 남긴 자리다(검증 세션이 세운다). 031 §3 이 **11px 로 올리자마자**
     `#gear` 에 «가로» 넘침이 생겼다 — 380×820 11px · 821×462 14px · 800×450 23px.
     고친 방법은 여백 셋(격자 간격 5→2 · 칸 좌우 여백 4→2 · `.op` 말줄임→두 줄)인데,
     **그 셋 중 하나만 되돌아가도 넘침이 그대로 돌아온다.** 그런데 이 자리를 보는
     검사가 하나도 없었다 — TB8 은 「보이는가」(세로)만 보고 가로는 안 본다.

     ⚠ **최악 조건을 박아 둔다 — 무작위로 뽑으면 조용히 통과한다.** 031 검증에서
       3줄짜리 아이템이 뽑혀 통과했다가, 4줄로 고정하자 넘쳤다. 그래서 세이브를
       직접 심는다:
         · `g:15`      — 등급 상한. `.gd` 가 「15등급」(두 자리)으로 가장 넓다.
         · `lv:8`      — `ROMAN[8]='VIII'`. 세부등급 열 단계 중 **글자가 가장 긴 것**.
         · 옵션 4개   — `lines(15)=4`. `.op` 가 가장 길어지는 수.
         · 여섯 칸 전부 — 한 칸만 채우면 1fr 이 안 좁아진다.
       이 셋 중 하나라도 무르게 하면 검사는 살아 있는 척만 한다.

     ⚠ **세 가지를 따로 잰다.** 「가로 넘침」은 한 값이 아니다:
       ⑴ `#gear` 자신의 `scrollWidth − clientWidth` (격자가 제 상자를 넘었나)
       ⑵ 칸(`.slot`)이 `#gear` 의 «내용 상자» 밖으로 나갔나 (padding 을 뺀 폭)
       ⑶ 칸 «안»의 글자(`.gd`·`.op`)가 칸 밖으로 나갔나 — ⑴·⑵ 는 `overflow:hidden`
          이 잘라 주면 0 이 되는데, 그때도 **글자는 이미 잘려 있다.**
       셋 중 가장 큰 값을 넘침으로 삼는다. 문턱은 **0.5px**(서브픽셀 반올림 몫).
     ⚠ 크기 목록은 `TB8_SIZES` 를 그대로 읽는다 — 한 곳에서만 고친다. */
  try {
    const GR_OPS  = { crit: 9.9, cdmg: 9.9, aspd: 9.9, hp: 9.9 };          // 4줄
    const GR_OPSW = { crit: 9.9, cdmg: 9.9, melee: 9.9, ranged: 9.9 };     // 무기 4줄
    const grEquip = {};
    // ⚠ 부위 id 는 `PARTS` 그대로여야 한다 — 'leg'·'hand'·'acc' 는 **없는 id** 라
    //   그 칸이 빈 칸으로 그려지고 최악 조건이 반쪽이 된다(031 검증 세션이 심은 오류,
    //   033 검증에서 잡았다). 실제 id 는 legs·hands·feet 다.
    for (const p of ['weapon', 'head', 'body', 'legs', 'hands', 'feet'])
      grEquip[p] = Object.assign({ part: p, g: 15, lv: 8, base: 999999, sp: 'pierce',
        ops: p === 'weapon' ? GR_OPSW : GR_OPS }, p === 'weapon' ? { wt: 'melee' } : {});
    const grBad = [], grRows = [];
    let grWorst = 0, grWorstAt = '';
    for (const vp of TB8_SIZES) {
      const pg = await tbOpen(12, vp.w, vp.h, { equip: grEquip });
      const r = await pg.evaluate(() => {
        const b = document.getElementById('tbForge'); if (b) b.click();
        const g = document.getElementById('gear');
        if (!g) return { err: '#gear 가 없다' };
        const cs = getComputedStyle(g), gr = g.getBoundingClientRect();
        const inL = gr.left + parseFloat(cs.paddingLeft || 0);
        const inR = gr.right - parseFloat(cs.paddingRight || 0);
        const slots = [...g.querySelectorAll('.slot')];
        let out = 0, at = '';
        const bump = (v, w) => { if (v > out) { out = v; at = w; } };
        bump(g.scrollWidth - g.clientWidth, '#gear scrollWidth');
        slots.forEach((s, i) => {
          const sr = s.getBoundingClientRect();
          bump(Math.max(sr.right - inR, inL - sr.left), `.slot[${i}] 가 #gear 내용상자 밖`);
          for (const c of s.children) {
            const cr = c.getBoundingClientRect();
            bump(Math.max(cr.right - sr.right, sr.left - cr.left),
              `.slot[${i}] > .${String(c.className || c.tagName).split(' ')[0]} 가 칸 밖`);
          }
        });
        // ⚠ **여섯 칸을 «전부» 확인한다.** 첫 칸만 보면 나머지가 빈 칸이어도 통과한다 —
        //   031 검증이 없는 부위 id 를 써서 세 칸이 빈 칸이었는데 이 검사가 못 잡았다.
        const filled = [...g.querySelectorAll('.slot:not(.empty)')];
        const gds = filled.map(s2 => { const e = s2.querySelector('.gd'); return e ? e.textContent.trim() : '(없다)'; });
        const ops = filled.map(s2 => { const e = s2.querySelector('.op');
          return e ? e.textContent.replace(/​/g, '').trim() : '(없다)'; });
        return { slots: slots.length, filled: filled.length,
          out: Math.round(Math.max(0, out) * 10) / 10, at,
          gearW: Math.round(gr.width * 10) / 10, gds, ops,
          gd: gds[0] || '(없다)', op: ops[0] || '(없다)' };
      });
      await pg.close();
      if (r.err) { grBad.push(`${vp.nm}: ${r.err}`); continue; }
      if (r.slots !== 6) grBad.push(`${vp.nm}: 칸이 6개가 아니다 (${r.slots}) — 세이브를 못 심었다, 검사 잘못`);
      if (r.filled !== 6) grBad.push(`${vp.nm}: 채워진 칸이 ${r.filled}/6 이다 — 부위 id 가 PARTS 와 안 맞아 빈 칸이 섞였다, 검사 잘못`);
      grRows.push(`${vp.nm} ${r.out}px(#gear ${r.gearW}px)`);
      if (r.out > grWorst) { grWorst = r.out; grWorstAt = `${vp.nm} — ${r.at}`; }
      if (r.out > 0.5) grBad.push(`${vp.nm}: 가로 ${r.out}px 넘침 (${r.at})`);
      { const badGd = (r.gds || []).filter(x => x !== '15등급 VIII');
        const badOp = (r.ops || []).filter(x => x.split('·').length !== 4);
        if (badGd.length) grBad.push(`${vp.nm}: 최악 조건이 ${badGd.length}칸에서 안 걸렸다 — .gd 「${badGd[0]}」 (「15등급 VIII」이어야 한다)`);
        if (badOp.length) grBad.push(`${vp.nm}: 최악 조건이 ${badOp.length}칸에서 안 걸렸다 — .op 「${badOp[0]}」 가 4줄이 아니다`); }
    }
    chk(`GR1 #gear 가로 넘침 0 (15등급·VIII·옵션 4줄 최악 · 크기 ${TB8_SIZES.length})`,
      grBad.length === 0,
      (grBad.length
        ? `${grBad.length}건 — ${grBad.join(' · ')}` +
          `  ⚠ 031 §3 의 여백 셋(간격 5→2 · 칸 여백 4→2 · .op 말줄임→두 줄) 중 하나라도 되돌아가면 여기가 운다`
        : `9크기 전부 0px (최대 ${grWorst}px${grWorstAt ? ' · ' + grWorstAt : ''})`) +
      `  · 최악 조건 고정: 여섯 칸 «전부» 15등급 · 세부등급 VIII · 옵션 4줄 (칸마다 확인한다)` +
      `  · 잰 값 셋의 최대: #gear scrollWidth / 칸이 내용상자 밖 / 글자가 칸 밖` +
      `  · 크기별: ${grRows.join(' · ')}`);
  } catch (e) {
    chk('GR1-예외 #gear 가로 넘침 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  /* ── LG1 : 보이는 글자 중 가장 작은 것 ≥ 11px (DPR 1) ────────────────────────
     031 이 열릴 자리다(030 제안 ⑴ · 계획 세션 판정 ⑴). CrazyGames 요건이
     「`devicePixelRatio:1` 에서 글자와 그림이 읽힐 것」을 적고 있는데, 이 화면의
     가장 작은 글자는 **9.5px** 이다. 문턱 **11px** 은 새로 만든 수가 아니라
     이 화면의 보조 글자(`.dim`)가 이미 쓰는 값이다.

     ⚠ **이 검사는 지금 빌드에서 FAIL 이 정상이다.** 031 이 11px 미만만 올려
     뒤집는다. **문턱 11 을 낮추지 말 것** — 낮추면 031 이 무엇을 고쳤는지 아무도 못 본다.

     ⚠ **무엇을 재는가 — 정의를 여기 박는다.**
       세는 것: **글자를 직접 담은 요소**의 계산된 `font-size`.
         부모의 `font-size` 는 안 센다(상속만 하고 글리프를 안 그리는 상자는
         「보이는 글자」가 아니다 — 009 의 「그렸다 ≠ 보인다」와 같은 갈래다).
       **빼는 것 셋** (판정문에도 매번 적는다):
         ⑴ `display:none` · `visibility:hidden` · 크기 0 인 요소
         ⑵ 뷰포트 **밖**(겹치는 넓이 0)
         ⑶ **빈 글자** — 직접 담은 텍스트가 공백뿐인 요소
       그 밖에 **닫힌 팝업**(`.popsec` 이 안 켜진 것)은 ⑴에 걸려 자동으로 빠진다.
       DPR 은 **1** 이다(Playwright 기본 `deviceScaleFactor`). 요건이 말하는 그 조건이다.

     ⚠ 탭 셋(제련·던전·테크)을 **차례로 켜서** 잰다. 안 켜진 탭은 `display:none`
       이라 ⑴로 빠지는데, 그러면 031 이 고칠 목록이 반쪽이 된다. 「보이는 글자」의
       정의는 지키면서 셋을 다 보이게 만든 뒤 잰다.
     ⚠ 크기 목록은 **`TB8` 과 같은 것**을 쓴다(031 지시서). 한 곳에서만 고치도록
       `TB8_SIZES` 를 그대로 읽는다. */
  try {
    const lgBad = [], lgSeen = new Map(); let lgMin = Infinity, lgMinAt = '', lgSkip = null, lgCss = [];
    for (const vp of TB8_SIZES) {
      const pg = await tbOpen(12, vp.w, vp.h);
      const r = await pg.evaluate(async () => {
        const out = { rows: [], skip: { hidden: 0, offscreen: 0, empty: 0 }, dpr: devicePixelRatio };
        const seeTab = id => { const b = document.getElementById('tb' + id.slice(3));
          if (b) b.click(); };
        for (const t of ['tabForge', 'tabTower', 'tabTech']) {
          seeTab(t);
          await new Promise(r2 => setTimeout(r2, 160));
          for (const e of document.querySelectorAll('*')) {
            // 글자를 **직접** 담았는가 (자식 요소가 아니라 이 요소의 텍스트 노드)
            let txt = '';
            for (const n of e.childNodes) if (n.nodeType === 3) txt += n.nodeValue;
            if (!txt.trim()) { if (txt.length) out.skip.empty++; continue; }
            const cs = getComputedStyle(e);
            if (cs.display === 'none' || cs.visibility === 'hidden') { out.skip.hidden++; continue; }
            const r3 = e.getBoundingClientRect();
            if (r3.width <= 0 || r3.height <= 0) { out.skip.hidden++; continue; }
            if (r3.bottom <= 0 || r3.top >= innerHeight || r3.right <= 0 || r3.left >= innerWidth) {
              out.skip.offscreen++; continue; }
            const px = parseFloat(cs.fontSize);
            const sel = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
              (e.className && typeof e.className === 'string' && e.className.trim()
                ? '.' + e.className.trim().split(/\s+/).join('.') : '');
            out.rows.push({ px: +px.toFixed(2), sel, t: txt.trim().slice(0, 14) });
          }
        }
        return out;
      });
      lgSkip = { hidden: (lgSkip ? lgSkip.hidden : 0) + r.skip.hidden,
                 offscreen: (lgSkip ? lgSkip.offscreen : 0) + r.skip.offscreen,
                 empty: (lgSkip ? lgSkip.empty : 0) + r.skip.empty };
      if (r.dpr !== 1) lgBad.push(`${vp.nm}: DPR 이 ${r.dpr} 다 — DPR 1 에서 재야 한다`);
      let m = Infinity, mAt = '';
      for (const row of r.rows) {
        if (row.px < m) { m = row.px; mAt = `${row.sel} 「${row.t}」`; }
        if (row.px < 11) {
          const k = `${row.px}px ${row.sel}`;
          if (!lgSeen.has(k)) lgSeen.set(k, { px: row.px, sel: row.sel, t: row.t, at: [] });
          const v = lgSeen.get(k); if (!v.at.includes(vp.nm)) v.at.push(vp.nm);
        }
      }
      if (m < lgMin) { lgMin = m; lgMinAt = `${vp.nm} — ${mAt}`; }
      if (m < 11) lgBad.push(`${vp.nm}: 최소 ${m}px`);
      await pg.close();
    }
    const list = [...lgSeen.values()].sort((a, b) => a.px - b.px)
      .map(v => `${v.px}px ${v.sel}「${v.t}」×${v.at.length}크기`);
    const skipTxt = lgSkip
      ? `제외(전 크기 합): display:none·크기0 ${lgSkip.hidden} · 뷰포트 밖 ${lgSkip.offscreen} · 빈 글자 ${lgSkip.empty}`
      : '제외 집계 없음';
    // ⚠ **판정에는 안 쓰는 참고 줄.** LG1 의 판정은 정의상 「보이는 글자」만 본다 —
    //    팝업 안이나 아직 안 그려진 자리의 작은 글자는 그 정의상 안 잡힌다. 031 은
    //    「검사가 뽑은 목록대로」 고쳐야 하므로, **소스에 박힌 11px 미만 선언 전체**를
    //    따로 적는다. 소스를 직접 읽는 이유: 이 문서의 CSSOM(`document.styleSheets`)은
    //    규칙을 28개밖에 내놓지 않아 **믿을 수 없다**(검증 세션 실측).
    let cssAll = [];
    try {
      const srcTxt = require('fs').readFileSync(
        require('path').join(__dirname, '..', 'src', 'forge.html'), 'utf8');
      const re = /([^{}]+)\{([^{}]*font-size\s*:\s*([0-9.]+)px[^{}]*)\}/g;
      let m2;
      while ((m2 = re.exec(srcTxt))) {
        const px = parseFloat(m2[3]);
        if (px < 11) cssAll.push(px + 'px ' + m2[1].trim().split('\n').pop().trim());
      }
      cssAll = [...new Set(cssAll)].sort();
    } catch (e) { cssAll = ['(소스를 못 읽었다: ' + String(e && e.message) + ')']; }
    const unseenTxt = cssAll.length
      ? ` · 참고(판정 밖) — 스타일시트의 11px 미만 규칙 ${cssAll.length}종: ${cssAll.join(' · ')}`
      : '';
    chk(`LG1 보이는 글자 중 가장 작은 것 ≥ 11px (DPR 1 · 크기 ${TB8_SIZES.length})`,
      lgBad.length === 0,
      (lgBad.length
        ? `최소 **${lgMin}px** (${lgMinAt}) · 11px 미만 ${lgSeen.size}종 — ${list.join(' · ')}` +
          `  ⚠ 031 전에는 이 FAIL 이 정상이다 (문턱 11 을 낮추지 말 것)`
        : `최소 ${lgMin}px (${lgMinAt}) — 전 크기 11px 이상`) + ` · ${skipTxt}` + unseenTxt);
  } catch (e) {
    chk('LG1-예외 글자 크기 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  /* ── LG2 : 팝업을 «연» 상태에서도 보이는 글자 ≥ 11px ─────────────────────────
     031 검증에서 **LG1 의 눈먼 자리**를 찾았다. LG1 은 「보이는 글자」만 보는데,
     `#pop` 의 절들은 평소 `display:none` 이라 정의상 ⑴로 빠진다 — 즉 **팝업 안의
     글자는 LG1 이 한 번도 안 본다.** 실측으로 증명했다: `render()` 의 인라인
     `style="…font-size:11px"`(각인 줄) 하나만 10px 로 되돌린 변이에서
       · LG1(팝업 닫힘) → **9크기 전부 PASS** (못 잡는다)
       · 이 검사(팝업 열림) → 9크기 전부 FAIL, 「10px span [팝업 안]」
     그래서 팝업을 실제로 열고 같은 정의로 다시 잰다. 팝업 목록은 페이지의 `POPS`
     에서 읽는다 — 하드코딩하면 절이 늘거나 줄 때 조용히 죽는다(027 B-3 이 `set` 을
     걷어낸 뒤 이 파일의 「팝업 넷」 이름들이 실제로 그렇게 상했다).

     ⚠ **세이브를 채워서 연다.** 빈 세이브로 열면 세 절이 거의 빈 통이라
       (`#stats` 의 각인 줄·`#ascTxt` 가 아예 안 그려진다) 검사가 살아 있는 척만 한다:
         · 장비 여섯 칸 `g:15`(→ `it.sp` 가 붙어 각인 줄이 그려진다)
         · `lv:28 · peak:120`(→ `canAscend()` 가 참이라 `#popAsc` 가 내용을 가진다)
       절마다 **팝업 안 글자 요소 수**를 판정문에 적는다. 0 이면 그 절은 빈 통이고,
       그건 PASS 가 아니라 검사 잘못이다 — 그래서 0 이면 FAIL 로 센다. */
  try {
    const LG2_OPS = { crit: 9.9, cdmg: 9.9, aspd: 9.9, hp: 9.9 };
    const lg2Equip = {};
    // ⚠ 부위 id 는 `PARTS` 그대로여야 한다 — 'leg'·'hand'·'acc' 는 **없는 id** 라
    //   그 칸이 빈 칸으로 그려지고 최악 조건이 반쪽이 된다(031 검증 세션이 심은 오류,
    //   033 검증에서 잡았다). 실제 id 는 legs·hands·feet 다.
    for (const p of ['weapon', 'head', 'body', 'legs', 'hands', 'feet'])
      lg2Equip[p] = Object.assign({ part: p, g: 15, lv: 8, base: 999999, sp: 'pierce',
        ops: LG2_OPS }, p === 'weapon' ? { wt: 'melee' } : {});
    const lg2Extra = { lv: 28, peak: 120, top: 120, equip: lg2Equip };
    let lg2Keys = null, lg2Titles = {};
    const lg2 = {};   // key → {bad:[], min, at, n, under:Map}
    for (const vp of TB8_SIZES) {
      const pg = await tbOpen(120, vp.w, vp.h, lg2Extra);
      if (!lg2Keys) {
        const k = await pg.evaluate(() => (typeof POPS === 'object' && POPS)
          ? { keys: Object.keys(POPS), t: POPS } : { keys: [], t: {} });
        lg2Keys = k.keys; lg2Titles = k.t;
        for (const q of lg2Keys) lg2[q] = { bad: [], min: Infinity, at: '', n: 0, under: new Map() };
      }
      for (const k of lg2Keys) {
        const a = lg2[k];
        const r = await pg.evaluate(async (kk) => {
          openPop(kk);
          await new Promise(r2 => setTimeout(r2, 200));
          const sec = document.getElementById('pop' + kk[0].toUpperCase() + kk.slice(1));
          const on = document.getElementById('pop').classList.contains('on');
          const secOn = sec ? getComputedStyle(sec).display !== 'none' : false;
          const rows = [];
          for (const e of document.querySelectorAll('*')) {
            let t = ''; for (const n of e.childNodes) if (n.nodeType === 3) t += n.nodeValue;
            if (!t.trim()) continue;
            const cs = getComputedStyle(e);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const r3 = e.getBoundingClientRect();
            if (r3.width <= 0 || r3.height <= 0) continue;
            if (r3.bottom <= 0 || r3.top >= innerHeight || r3.right <= 0 || r3.left >= innerWidth) continue;
            rows.push({ px: +parseFloat(cs.fontSize).toFixed(2), inPop: !!e.closest('#pop'),
              sel: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') +
                (e.className && typeof e.className === 'string' && e.className.trim()
                  ? '.' + e.className.trim().split(/\s+/).join('.') : ''),
              t: t.trim().slice(0, 14) });
          }
          return { on, secOn, rows, dpr: devicePixelRatio };
        }, k);
        if (!r.on || !r.secOn) { a.bad.push(`${vp.nm}: 팝업이 안 열렸다 (#pop.on=${r.on} · 절 보임=${r.secOn})`); continue; }
        if (r.dpr !== 1) a.bad.push(`${vp.nm}: DPR 이 ${r.dpr} 다`);
        let inPop = 0;
        for (const row of r.rows) {
          if (row.inPop) inPop++;
          if (row.px < a.min) { a.min = row.px; a.at = `${vp.nm} — ${row.sel}「${row.t}」${row.inPop ? ' [팝업 안]' : ''}`; }
          if (row.px < 11) a.under.set(`${row.px}px ${row.sel}${row.inPop ? ' [팝업 안]' : ''}`, 1);
        }
        a.n += inPop;
        if (!inPop) a.bad.push(`${vp.nm}: 팝업 «안»에 글자 요소가 0개다 — 빈 통을 재고 있다, 검사 잘못`);
        if (a.min < 11) a.bad.push(`${vp.nm}: 최소 ${a.min}px`);
      }
      await pg.close();
    }
    if (!lg2Keys || !lg2Keys.length) {
      chk('LG2 팝업을 연 상태에서도 보이는 글자 ≥ 11px', false, 'POPS 가 비었다 — 팝업이 하나도 없다');
    } else {
      const bad = lg2Keys.filter(k => lg2[k].bad.length);
      const per = lg2Keys.map(k => {
        const a = lg2[k];
        return `«${lg2Titles[k] || k}»(#pop${k[0].toUpperCase()}${k.slice(1)}) 최소 ${a.min === Infinity ? '?' : a.min + 'px'}` +
          ` · 팝업 안 글자 ${a.n}개` +
          (a.under.size ? ` · 11px 미만 ${a.under.size}종: ${[...a.under.keys()].sort().join(', ')}` : '') +
          (a.bad.length ? ` ⚠ ${a.bad.slice(0, 3).join(' · ')}` : '');
      });
      chk(`LG2 팝업을 연 상태에서도 보이는 글자 ≥ 11px (팝업 ${lg2Keys.length}종 × 크기 ${TB8_SIZES.length})`,
        bad.length === 0,
        (bad.length ? `${bad.length}/${lg2Keys.length}종 FAIL` : `${lg2Keys.length}종 전부 11px 이상`) +
        `  · LG1 은 팝업을 못 본다(닫힌 절은 display:none 이라 정의상 빠진다) — 그 눈먼 자리를 여기서 덮는다` +
        lg2Keys.map((k, i) => `\n        · ${per[i]}`).join(''));
    }
  } catch (e) {
    chk('LG2-예외 팝업 글자 크기 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  /* ── RS1 : 정리 뒤에도 싸움이 이어진다 (적 체력이 되감기지 않는다) ──────────────
     033 제안 ⑸ 가 남긴 자리다(검증 세션이 세운다). 033 은 CORE 에서 `resolve()` 끝의
     `newWave();` 를 **지웠는데**, 그때 **checklist 가 한 항목도 울지 않았다.** 그 줄이
     있든 없든 검사가 눈을 감고 있었다는 뜻이다 — `foeHP`·`newWave` 를 쓰는 다른 검사는
     전부 **스스로 판을 차리는** 줄(`S.wave=…; newWave();`)이라 「정리 뒤의 싸움」을
     아무도 안 본다.

     ⚠ **무엇을 재는가.** `resolve()` 는 장착·판매만 해야 하고 **싸움을 다시 세우면 안
       된다.** 그래서 `resolve()` 부르기 **직전**과 **직후**의 `foeHP`·`foeMax`·`pHP`·
       `S.wave` 를 비교한다. 되돌아갔으면(= `foeHP` 가 `foeMax` 로 되감겼으면) FAIL.
     ⚠ **한 `evaluate` 안에서 동기로 잰다.** 페이지의 250ms 틱과 자동 정리가 두 스냅샷
       사이에 끼면 그 자체가 노이즈다. 동기 코드 사이에는 못 끼어든다.
     ⚠ **한 틱에 안 죽는 판을 만든다.** 적을 한 방에 잡으면 `tick()` 이 «정당하게»
       `newWave()` 를 부르고 `foeHP` 가 차오른다 — 그건 결함이 아니다. 그래서 먼저
       `foeHP` 를 `foeMax` 의 30~80% 로 깎아 두고, 그 구간에서만 잰다.
     ⚠ **둘 다 본다** — 손으로 부르는 `resolve()`(정리 끔)와 자동 정리가 부르는
       `resolve()`(정리 켬). 033 이 고친 자리는 자동 쪽이지만 **CORE 는 한 줄**이라
       수동도 같이 움직인다. 수동이 깨지면 그게 곧 회귀다.
     ⚠ **되감김만 보면 반쪽이다.** 되감기지 않더라도 싸움이 «서» 버리면 결함이다.
       그래서 실제 시간 2.4초를 흘려 **적 체력이 더 줄었는지**도 본다.

     변이: `resolve()` 끝에 `newWave();` 를 도로 넣으면 여기가 운다(033 제안 ⑸). */
  try {
    const rsItem = (part, g) => ({ part, g, lv: 3, base: 40, ops: { crit: 1.1 },
      ...(part === 'weapon' ? { wt: 'melee' } : {}) });
    const rsExtra = {
      wave: 17, top: 20, peak: 20,
      equip: { weapon: { part: 'weapon', g: 6, lv: 3, base: 900, ops: { crit: 1.2 }, wt: 'melee' },
               body:   { part: 'body',   g: 6, lv: 3, base: 900, ops: { hp: 4.0 } } },
      queue: [rsItem('head', 4), rsItem('legs', 4), rsItem('hands', 4)]   // 부위 id 는 PARTS 그대로 (legs·hands·feet)
    };
    const rsBad = [], rsNote = [];
    for (const [lab, autoRes] of [['수동(정리 끔)', false], ['자동 정리(정리 켬)', true]]) {
      const pg = await tbOpen(20, 380, 820, rsExtra);
      // ① 한 틱에 안 죽는 구간으로 적 체력을 깎아 둔다 — 그 다음 한 evaluate 안에서 잰다
      const r = await pg.evaluate((auto) => {
        S.autoRes = auto;
        S.wave = 17; newWave();                       // 판을 차린다 (검사 자신의 준비)
        let guard = 0;
        while (foeHP > foeMax * 0.8 && guard++ < 400) tick();
        if (foeHP <= foeMax * 0.3 || foeHP > foeMax * 0.8)
          return { err: `준비 실패 — foeHP ${Math.round(foeHP)}/${Math.round(foeMax)} (틱 ${guard})` };
        if (!S.queue.length) return { err: '대기열이 비었다 — 검사 잘못' };
        const before = { foeHP, foeMax, pHP, wave: S.wave, q: S.queue.length,
                         gold: S.gold, pow: power(S.equip) };
        // ② 정리를 «한 번» 시킨다 — 자동이면 autoResolve(), 수동이면 resolve() 직접
        let how;
        if (auto) {
          while (S.queue.length < qmax()) S.queue.push(JSON.parse(JSON.stringify(S.queue[0])));
          const q0 = S.queue.length; autoResolve(); how = 'autoResolve()';
          if (S.queue.length === q0) return { err: '자동 정리가 아무것도 안 했다 — 검사 잘못' };
        } else {
          resolve('sell'); how = "resolve('sell')";
        }
        const after = { foeHP, foeMax, pHP, wave: S.wave, q: S.queue.length,
                        gold: S.gold, pow: power(S.equip) };
        return { before, after, how };
      }, autoRes);
      if (r.err) { rsBad.push(`${lab}: ${r.err}`); await pg.close(); continue; }
      const b = r.before, a = r.after;
      const rewound = a.foeHP > b.foeHP + 0.01;               // 조금이라도 «차오르면» 되감김이다
      const full = Math.abs(a.foeHP - a.foeMax) < 0.01;
      if (rewound)
        rsBad.push(`${lab}: ${r.how} 뒤 적 체력이 ${Math.round(b.foeHP)} → ${Math.round(a.foeHP)} 로 ` +
          `**되감겼다**${full ? '(가득)' : ''} — resolve() 가 싸움을 다시 세우고 있다`);
      if (a.wave !== b.wave)
        rsBad.push(`${lab}: ${r.how} 뒤 웨이브가 ${b.wave} → ${a.wave} 로 바뀌었다`);
      if (a.pHP > b.pHP + 0.01)
        rsBad.push(`${lab}: ${r.how} 뒤 내 체력이 ${Math.round(b.pHP)} → ${Math.round(a.pHP)} 로 공짜로 찼다`);
      // ③ 되감기지 않았더라도 싸움이 «서» 버리면 결함이다 — 실제 시간으로 본다
      await pg.waitForTimeout(2400);
      const c = await pg.evaluate(() => ({ foeHP, foeMax, wave: S.wave, top: S.top || 0 }));
      const moved = (c.wave > a.wave) || (c.foeHP < a.foeHP - 0.01);
      if (!moved)
        rsBad.push(`${lab}: 정리 뒤 2.4초 동안 싸움이 멈췄다 — 적 체력 ${Math.round(a.foeHP)} 그대로 · 웨이브 ${c.wave}`);
      rsNote.push(`${lab} ${r.how}: 적 ${Math.round(b.foeHP)}/${Math.round(b.foeMax)} → ` +
        `${Math.round(a.foeHP)} (웨이브 ${b.wave}→${a.wave} · 내 체력 ${Math.round(b.pHP)}→${Math.round(a.pHP)} · ` +
        `대기 ${b.q}→${a.q} · 골드 +${a.gold - b.gold}) → 2.4초 뒤 적 ${Math.round(c.foeHP)} · 웨이브 ${c.wave}`);
      await pg.close();
    }
    chk('RS1 정리 뒤에도 싸움이 이어진다 (적 체력이 안 되감긴다 · 수동·자동 두 벌)',
      rsBad.length === 0,
      (rsBad.length ? `${rsBad.length}건 — ${rsBad.join(' · ')}` : '두 벌 다 안 되감기고 싸움이 이어진다') +
      `  · ${rsNote.join('  /  ')}` +
      `  · 033 이 지운 \`resolve()\` 끝의 \`newWave();\` 를 도로 넣으면 여기가 운다 (033 제안 ⑸)`);
  } catch (e) {
    chk('RS1-예외 정리 뒤 전투 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  /* ── IT1~IT2 : 조작이 없는 동안 화면이 상태를 따라가는가 (031 §5 신설) ──────
     사용자 실기기가 「웨이브 8 최고 6」을 보여 줬다 — **최고가 현재 웨이브보다 낮다.**
     원인은 갱신 «자리»다: `S.top` 은 CORE 의 `tick()` 이 웨이브를 깰 때마다 올리는데
     「최고」 숫자를 그리는 `setNum('top', …)` 이 `render()` 안에만 있었다. 조작이
     없는 동안 실제로 도는 경로는 250ms 틱의 `tick(); renderFast();` 뿐이라
     화면의 「최고」가 첫 조작 시점 값에 그대로 굳는다.

     ⚠ **이 검사가 없어서 아무도 안 보고 있었다.** 앞선 검사는 전부 조작을 한 번은
       한다(클릭·`render()`). 「조작을 하지 않는다」가 이 검사의 본체다.
     ⚠ 그래서 **실제 틱과 똑같은 순서로만** 돈다: `tick(); renderFast();` — `render()`
       를 부르면 검사가 제 손으로 답을 만들어 주고, 그 순간 우는 능력을 잃는다.
       페이지의 `setInterval` 은 끄고 우리가 돈다(우리 루프와 섞이면 몇 번 돌았는지
       못 세고 판정이 환경 속도에 물린다).
     ⚠ IT2 는 같은 원인이 웨이브 10 탭바 게이트(`S.top` 파생)에도 걸리는지 보는
       자리다. 실측으로는 **걸리지 않는다** — `gateUI()` 가 `renderFast()` 의 첫
       줄이라 031 전에도 PASS 다. 「PASS 라서 지운다」가 아니라, 게이트를 `render()`
       쪽으로 옮기는 변경이 오면 **여기서 울려야 하기에** 남긴다. */
  try {
    const itPg = await tbOpen(0, 380, 820);
    const it = await itPg.evaluate(async N => {
      if (typeof S !== 'object' || typeof tick !== 'function' || typeof renderFast !== 'function')
        return { skel: false };
      for (let i = 1; i < 99999; i++) clearInterval(i);   // 페이지 틱을 끄고 우리가 돈다
      render();                                           // 시작점 = 「조작 직후」의 화면
      const shown = () => (document.getElementById('top').textContent || '').trim();
      const tabs = () => getComputedStyle(document.getElementById('tabs')).display;
      const start = { top: S.top | 0, shown: shown(), tabs: tabs() };
      // 웨이브가 실제로 넘어가게 장비를 준다 — 전투 수식(CORE)은 건드리지 않는다
      for (const k of ['weapon', 'head', 'body', 'legs', 'hands', 'feet']) S.equip[k] = makeItem(k, 15);
      let n = 0;
      for (; n < 600 && (S.top | 0) < N; n++) { tick(); renderFast(); }
      const after = { top: S.top | 0, wave: S.wave, shown: shown(), tabs: tabs(),
        btns: document.querySelectorAll('#tabs button').length,
        wv: (document.getElementById('wv').textContent || '').trim() };
      render();                                           // 조작 한 번 — 원인을 지목하는 참고값
      return { skel: true, start, after, ticks: n, afterRender: shown() };
    }, 14);
    if (!it.skel || it.after.top < 14) {
      const why = !it.skel ? 'S·tick·renderFast 가 없다'
        : `틱 ${it.ticks}번에 S.top 이 ${it.after.top} 까지만 올랐다 — 측정 불가`;
      chk('IT1 조작 없이 웨이브가 넘어가도 화면의 「최고」 = S.top', false, why);
      chk('IT2 조작 없이 웨이브 10 을 넘기면 탭바가 보인다', false, why);
    } else {
      const ok1 = it.after.shown === String(it.after.top);
      chk('IT1 조작 없이 웨이브가 넘어가도 화면의 「최고」 = S.top', ok1,
        `틱 ${it.ticks}번(조작 0) — S.top ${it.after.top} · 웨이브 ${it.after.wave}` +
        ` · 화면 「최고」 "${it.after.shown}" · 화면 웨이브 "${it.after.wv}"` +
        (ok1 ? '' : `  ⚠ 갱신 자리가 render() 뿐이다 — 조작 한 번 뒤엔 "${it.afterRender}" 로` +
          ` 따라잡힌다 (시작 화면 "${it.start.shown}")`));
      chk('IT2 조작 없이 웨이브 10 을 넘기면 탭바가 보인다',
        it.after.tabs !== 'none' && it.after.btns === 3,
        `S.top ${it.after.top} · 탭바 display:${it.after.tabs} · 버튼 ${it.after.btns}개` +
        ` (시작 ${it.start.tabs})`);
    }
  } catch (e) {
    chk('IT-예외 조작 없는 갱신 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  for (const c of tbCtxs) { try { await c.close(); } catch (e) {} }
  if (tbErrs.length) chk('TB-콘솔 탭·팝업 조작 중 무오류', false, tbErrs.slice(0, 3).join(' | '));

  /* ── ST1~ST3 : 횡스크롤 무대 (013 신설) ───────────────────────────────
     013 이 무대·타일 12장·몹 배치를 들였는데 **그것을 보는 검사가 하나도 없었다**:
     `<div id="arena">` 한 줄을 지운 트리에 94항목을 물리면 **94/94 전부 통과**한다
     (016 의 탭 골격이 그랬던 것과 같은 구멍).
     016 의 교훈대로 **골격 유무를 먼저 판정**하고, 없으면 항목을 FAIL 로 적되
     조작은 시도하지 않으며, 블록 전체를 try/catch 로 감싼다.
     표는 페이지의 `SPR_TILE` 등에서 **읽는다** — 장수를 박아 두면 표가 늘어난
     순간 검사가 조용히 죽는다. */
  const stCtxs = [];
  try {
    const stCtx = await browser.newContext({ viewport: { width: 380, height: 820 } });
    stCtxs.push(stCtx);
    const sp = await stCtx.newPage();
    const stErrs = [];
    sp.on('console', m => { if (m.type() === 'error' || m.type() === 'assert') stErrs.push(m.text()); });
    sp.on('pageerror', e => stErrs.push('pageerror: ' + e.message));
    await sp.goto(URL);
    await sp.waitForTimeout(2500);

    // ── 골격 판정 먼저 ──
    const skel = await sp.evaluate(() => {
      const V = globalThis.__view || {};
      return { arena: !!document.getElementById('arena'), stage: !!V.stage,
        keys: V.stage ? Object.keys(V.stage) : [],
        tiles: V.stage ? V.stage.tiles : null,
        tbl: (typeof SPR_TILE !== 'undefined') ? SPR_TILE.length : null };
    });
    const need = ['layers','tiles','tile','scrollX','moving','rect','kind','alive'];
    const missing = need.filter(k => !skel.keys.includes(k));
    const haveStage = skel.arena && skel.stage && missing.length === 0;

    if (!haveStage) {
      const why = !skel.arena ? '#arena 가 없다 (무대가 아예 없는 빌드)'
        : !skel.stage ? '__view.stage 가 없다'
        : '__view.stage 에 없는 키: ' + missing.join(',');
      chk('ST1 무대가 존재하고 실제로 칠해진다 (구간이 색을 바꾼다)', false, why);
      chk('ST2 무대에서 구운 몹 2축이 한 무리로 보인다 (검정 실루엣 1-최근접)', false, why);
      chk('ST3 손그림 총량 = 장비+몹+용사+타일 · 타일 이음새', false, why);
    } else {

      // 장면을 고정한다 (틱·난수). 그래야 두 번 재도 같은 무리가 선다.
      const freeze = wave => {
        for (let i = 1; i < 99999; i++) clearInterval(i);
        let s = 0x2F6E2B1 >>> 0;
        Math.random = () => { s ^= s<<13; s>>>=0; s ^= s>>17; s ^= s<<5; s>>>=0; return s/4294967296; };
        window.save = () => {};
        S.wave = wave; S.gold = 12345; S.lv = 6;
        try { newWave(); } catch (e) {}
        try { tick(); } catch (e) {}
        try { render(); } catch (e) {}
      };
      const settle = async () => {
        for (let i = 0; i < 40; i++) {
          const mv = await sp.evaluate(() => window.__view.stage.moving);
          if (!mv) break; await sp.waitForTimeout(100);
        }
        await sp.waitForTimeout(800);
      };

      // 무대 사각형 안의 픽셀을 **페이지 안 캔버스**에서 직접 읽는다.
      const readStage = () => {
        const V = window.__view, st = V.stage, rA = st.rect;
        const cv = document.querySelector('canvas'), g = cv.getContext('2d');
        const dpr = cv.width / cv.clientWidth;
        const gx = v => Math.round(v * dpr);
        const lum = (r, gg, b) => 0.2126*r + 0.7152*gg + 0.0722*b;
        const img = g.getImageData(gx(rA.x), gx(rA.y), Math.max(1, gx(rA.w)), Math.max(1, gx(rA.h)));
        const d = img.data, cols = new Set();
        for (let i = 0; i < d.length; i += 4) cols.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);

        // 몹 상자별 «채움»과 «실제 구멍».
        // ⚠ 좌표식을 **박아 두지 않는다.** 013 때는 여기에 0.34/0.97 과 `scale-1` 을
        //   박았는데, 018 §3 이 개체 간격을 바꾸자 검사가 **엉뚱한 자리를 재고도
        //   조용히 숫자를 냈다**(원거리 구멍 0.8%). 페이지가 내는 배치를 그대로 쓰고,
        //   없을 때만 옛 식으로 물러난다.
        const SS = 24;
        const ms = st.mobScale || Math.max(1, st.scale - 1);
        const ground = rA.y + st.ground;
        const n = st.mobs;
        const x0 = (st.mobX0 != null && st.mobX0 > 0) ? st.mobX0 : rA.x + rA.w*0.34;
        const step = (st.mobStep != null && st.mobStep > 0) ? st.mobStep
                   : (n > 1 ? (rA.x + rA.w*0.97 - SS*ms - x0)/(n - 1) : 0);
        const boxH = SS*ms, top = ground - boxH;
        const gi = g.getImageData(gx(rA.x + rA.w*0.12), gx(top), Math.max(1, gx(SS*ms)), Math.max(1, gx(boxH)));
        let gl = 0, gn = 0;
        for (let i = 0; i < gi.data.length; i += 4) { gl += lum(gi.data[i], gi.data[i+1], gi.data[i+2]); gn++; }
        const groundLum = gl/gn;
        const boxes = [];
        // ⚠ **살아 있는 자리는 «앞쪽 alive 마리» 가 아니다** (021 제안 2).
        //   021 부터 죽는 것은 **앞쪽(용사 쪽) `n−alive` 마리**이고 살아남은 것은
        //   `[deadCut, n)` 에 그대로 서 있다. 옛 `i < min(n, alive)` 를 그대로 두면
        //   무대 픽셀을 읽는 검사가 **빈 자리를 몹으로 재고도 조용히 숫자를 낸다** —
        //   018 에서 ST2 가 좌표식을 박고 똑같이 헛발질했던 자리와 같은 모양이다.
        //   지금 `boxes` 를 쓰는 chk 는 없지만(그래서 021 이 아무 검사도 안 깼다),
        //   되살리는 쪽이 이 줄을 먼저 보게 **창구(`deadCut`)부터 센다.**
        const cut0 = (st.deadCut != null) ? st.deadCut : Math.max(0, n - st.alive);
        for (let i = cut0; i < n; i++) {
          const kind = st.kind === 'mix' ? (i%2 ? 'ranged' : 'melee') : st.kind;
          const im = g.getImageData(gx(x0 + step*i), gx(top), Math.max(1, gx(SS*ms)), Math.max(1, gx(boxH)));
          const w = im.width, h = im.height, dd = im.data;
          const mask = new Uint8Array(w*h);
          let bright = 0;
          for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const o = (y*w + x)*4;
            if (lum(dd[o], dd[o+1], dd[o+2]) > groundLum + 6) { bright++; mask[y*w + x] = 1; }
          }
          // 테두리에서 못 닿는 배경칸 = 본체에 둘러싸인 «진짜 구멍» (015 규약:
          // 비움은 색이 아니라 실제 구멍이어야 한다)
          const seen = new Uint8Array(w*h), q = [];
          for (let x = 0; x < w; x++) { q.push([x,0]); q.push([x,h-1]); }
          for (let y = 0; y < h; y++) { q.push([0,y]); q.push([w-1,y]); }
          while (q.length) { const [x,y] = q.pop();
            if (x<0||y<0||x>=w||y>=h) continue;
            const k = y*w + x; if (seen[k] || mask[k]) continue; seen[k] = 1;
            q.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
          let holes = 0; for (let k = 0; k < w*h; k++) if (!mask[k] && !seen[k]) holes++;
          boxes.push({ kind, fill: +(bright/(w*h)*100).toFixed(1), hole: +(holes/(w*h)*100).toFixed(1) });
        }
        return { seg: st.seg, kind: st.kind, mobs: n, alive: st.alive, colors: cols.size,
          top: [...cols].slice(0, 400), boxes };
      };

      // ── ST1 : 무대가 칠해졌고, 구간이 그 색을 바꾼다 ──
      await sp.evaluate(freeze, 7);  await settle();
      const s7  = await sp.evaluate(readStage);
      await sp.evaluate(freeze, 30); await settle();
      const s30 = await sp.evaluate(readStage);
      const setA = new Set(s7.top), setB = new Set(s30.top);
      const inter = [...setA].filter(c => setB.has(c)).length;
      const jac = inter / (setA.size + setB.size - inter || 1);
      const painted = s7.colors >= 8 && s30.colors >= 8;
      const segDiff = s7.seg !== s30.seg && jac < 0.6;
      chk('ST1 무대가 존재하고 실제로 칠해진다 (구간이 색을 바꾼다)', painted && segDiff,
        `구간 ${s7.seg}: 색 ${s7.colors}가지 · 구간 ${s30.seg}: 색 ${s30.colors}가지 · ` +
        `두 구간 색 겹침 ${(jac*100).toFixed(1)}% (<60% 여야 팔레트가 실제로 갈렸다)` +
        (painted ? '' : ' · ⚠ 색 가짓수 8 미만 = 무대가 안 칠해졌다'));

      /* ── ST2 — 020 판정 ③. 옛 「근접=구멍 0 / 원거리=구멍 있음」은 **폐기**다.
         구멍 규칙은 2026-09-15 사용자 판정으로 **1-최근접 무리 판별**로 이미
         교체됐고(ART-DIRECTION), `ST2` 만 옛 규칙의 구현으로 남아 있었다.
         ⚠ 순서가 중요하다 — **규칙이 먼저 바뀌었고 검사가 안 따라온 것**이다.
         검사가 울어서 검사를 무르는 것과는 반대 방향이다.

         SG5 와 무엇이 다른가: SG5 는 **원본 문자열**을 보고, ST2 는 **무대에서
         실제로 구운 판**(팔레트·배율을 먹인 결과)을 본다. 그림은 갈리는데 무대에
         올리면 뭉개지는 경우를 ST2 만 잡는다 — 013 이 밟은 바로 그 자리다. */
      const st2 = await sp.evaluate(() => {
        const st = window.__view.stage;
        const ms = st.mobScale || Math.max(1, st.scale - 1), seg = st.seg;
        const out = { ms, seg, sil: {}, w: 0, h: 0, err: null };
        try {
          for (const kind of ['melee', 'ranged']) for (let t = 1; t <= 3; t++) {
            const cv = foeSprite(kind, t, ms, seg);
            if (!cv) { out.err = `foeSprite(${kind},${t}) 가 null`; return out; }
            const g = cv.getContext('2d');
            const d = g.getImageData(0, 0, cv.width, cv.height).data;
            out.w = cv.width; out.h = cv.height;
            let s = '';
            for (let i = 3; i < d.length; i += 4) s += d[i] > 8 ? '3' : '.';
            out.sil[kind + t] = s;
          }
        } catch (e) { out.err = e.message; }
        return out;
      });
      if (st2.err || Object.keys(st2.sil).length !== 6) {
        chk('ST2 무대에서 구운 몹 2축이 한 무리로 보인다 (검정 실루엣 1-최근접)', false,
          st2.err || `구운 판이 ${Object.keys(st2.sil).length}장뿐이다`);
      } else {
        const m2 = {};
        for (const k of Object.keys(st2.sil)) m2[k] = { group: k.replace(/\d+$/, ''), px: st2.sil[k] };
        const nn2 = oneNN(m2);
        chk('ST2 무대에서 구운 몹 2축이 한 무리로 보인다 (검정 실루엣 1-최근접)',
          nn2.n === 6 && nn2.bad.length === 0,
          nn2.bad.length ? `무리를 벗어난 장: ${nn2.bad.join(' · ')} (구간 ${st2.seg} · 배율 ${st2.ms} · ${st2.w}×${st2.h})`
            : `구간 ${st2.seg} · 배율 ${st2.ms} · 구운 판 ${st2.w}×${st2.h} · ` +
              `6장 전부 자기 축이 최근접 · 여유 최소 ${nn2.margin.toFixed(3)}`);
      }

      // ── ST3 : 손그림 총량과 타일 이음새 ──
      // SG5 는 장비+몹+용사 25장만 센다. 타일 표는 **아무도 안 보고 있었다** —
      // 12장을 24장으로 늘려도 울지 않는다 (013 제안 2).
      const art = await sp.evaluate(() => {
        const cnt = o => Array.isArray(o) ? o.flat(9).filter(x => typeof x === 'string').length
                                          : Object.values(o).flat(9).filter(x => typeof x === 'string').length;
        // SPR_TILE 은 배열이 아니라 층 이름을 키로 갖는 객체다 {far,mid,near}.
        // 모양을 박지 말고 **있는 그대로 읽는다** (표가 바뀌면 검사가 죽지 않게).
        const TT = (typeof SPR_TILE !== 'undefined') ? SPR_TILE : null;
        const layerArrs = !TT ? [] : (Array.isArray(TT) ? TT : Object.values(TT));
        const tiles = layerArrs.flat(9).filter(x => typeof x === 'string');
        const W = (typeof TILE_W !== 'undefined') ? TILE_W : 0, H = (typeof TILE_H !== 'undefined') ? TILE_H : 0;
        const col = (t, x) => { let s = ''; for (let y = 0; y < H; y++) s += t[y*W + x]; return s; };
        const seams = [];
        const per = layerArrs.map(l => (Array.isArray(l) ? l : [l]).length);
        let i = 0;
        for (const k of per) {
          const layer = tiles.slice(i, i + k); i += k;
          const L = new Set(layer.map(t => col(t, 0))), Rr = new Set(layer.map(t => col(t, W - 1)));
          seams.push(L.size === 1 && Rr.size === 1 && [...L][0] === [...Rr][0]);
        }
        // 용사는 018 에서 대기+공격 두 장이 됐다. SPR_HERO 는 문자열로 남겨 두고
        // (SG5·SG6 이 그렇게 읽는다) 공격 포즈를 따로 세운다 — 안 세면 26번째 장이
        // 아무 검사에도 안 걸린다(013 의 타일 12장이 그랬던 것과 같은 구멍).
        const heroN = ((typeof SPR_HERO === 'string') ? 1 : cnt(SPR_HERO))
                    + ((typeof SPR_HERO_ATK !== 'undefined') ? ((typeof SPR_HERO_ATK === 'string') ? 1 : cnt(SPR_HERO_ATK)) : 0);
        return { equip: cnt(SPR), mob: cnt(SPR_MOB), hero: heroN,
          tiles: tiles.length, W, H, sized: tiles.length > 0 && tiles.every(t => t.length === W*H),
          seams, layers: per.length, names: Array.isArray(TT) ? null : Object.keys(TT || {}) };
      });
      const total = art.equip + art.mob + art.hero + art.tiles;
      const CAP = 38;                       // 장비 18 + 몹 6 + 용사 2 + 타일 12 (018 상한)
      const seamOK = art.seams.length > 0 && art.seams.every(Boolean);
      chk('ST3 손그림 총량 = 장비+몹+용사+타일 · 타일 이음새', total === CAP && art.sized && seamOK,
        `장비 ${art.equip} + 몹 ${art.mob} + 용사 ${art.hero} + 타일 ${art.tiles} = ${total} (상한 ${CAP}) · ` +
        `타일 ${art.W}×${art.H} 크기일치 ${art.sized} · 층 ${art.layers}개${art.names?'('+art.names.join(',')+')':''} ` +
        `이음새 ${JSON.stringify(art.seams)}`);
    }
    if (stErrs.length) chk('ST-콘솔 무대 조작 중 무오류', false, stErrs.slice(0, 3).join(' | '));
  } catch (e) {
    chk('ST-예외 무대 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }
  for (const c of stCtxs) { try { await c.close(); } catch (e) {} }


  /* ── MC1~MC2 : 몹·용사 외곽선 대 무대 배경 대비 (013 제안 1 · 019 대비) ──────
     `OC1`·`OC2` 는 **명판/릴 배경 대 idx1** 을 본다. 013 이후 몹·용사는 명판이
     아니라 **무대 배경 위**에 서고, 용사의 경계는 idx1 이 아니라 **idx4** 다 —
     그래서 두 검사는 몹·용사를 한 픽셀도 덮지 못한다(015·013 검증이 확인).
     019 가 바이옴으로 땅을 밝힐 참이므로 그 전에 걸어 둔다.

     보는 것: `stageBody(seg,2)`(몹·용사가 서는 근경 바닥) 대
     `mobPalette(seg)[1]` · `heroPalette(seg)[4]`. 구간 색이 **셋을 순환**하므로
     seg 0·1·2 면 전수다(검사가 그 순환 주기를 페이지에서 직접 확인한다).

     문턱 3.0 의 근거: 실측이 몹 4.02~4.21 · **용사 3.33~3.59** 다. OC1 의 4.0 을
     그대로 쓰면 용사가 오늘 당장 운다 — 그건 새 기준을 소급 적용하는 것이라
     계획 세션 몫이다. 3.0 은 **「지금보다 나빠지면 운다」**는 회귀선이다. */
  try {
    const mcCtx = await browser.newContext({ viewport: { width: 380, height: 820 } });
    const mcPage = await mcCtx.newPage();
    await mcPage.goto(URL);
    await mcPage.waitForTimeout(2000);

    const mc = await mcPage.evaluate(() => {
      const need = ['stageBody', 'mobPalette', 'heroPalette', 'segRGB', 'relLum'];
      const missing = need.filter(n => typeof globalThis[n] !== 'function'
        && (() => { try { return typeof eval(n) !== 'function'; } catch (e) { return true; } })());
      if (missing.length) return { skel: false, missing };
      // 구간 순환 주기를 **페이지에서 읽는다** (셋이라고 박지 않는다).
      let period = 0;
      const k0 = JSON.stringify(segRGB(0));
      for (let i = 1; i <= 12; i++) if (JSON.stringify(segRGB(i)) === k0) { period = i; break; }
      const segs = [];
      for (let s = 0; s < (period || 3); s++) segs.push({
        seg: s, ground: stageBody(s, 2).map(Math.round),
        mobOut: mobPalette(s)[1].map(Math.round),
        heroOut: heroPalette(s)[4].map(Math.round) });
      // 땅이 도달할 수 있는 **최대 밝기** — 바이옴을 아무리 밝혀도 여기서 멈춘다.
      // 019 가 이 한계를 올리면(DEPTH·normRGB) 아래 수치가 따라 움직인다.
      const orig = BIOME_COLS.map(c => c.slice());
      for (let i = 0; i < BIOME_COLS.length; i++) BIOME_COLS[i] = [255, 255, 255];
      const maxG = stageBody(0, 2).map(Math.round);
      const maxMob = mobPalette(0)[1].map(Math.round);
      const maxHero = heroPalette(0)[4].map(Math.round);
      const maxLum = relLum(stageBody(0, 2));
      for (let i = 0; i < BIOME_COLS.length; i++) BIOME_COLS[i] = orig[i];
      return { skel: true, period, segs, maxG, maxMob, maxHero,
        maxLum: +maxLum.toFixed(3),
        outLum: (typeof OUT_LUM !== 'undefined') ? OUT_LUM : null };
    });

    if (!mc.skel) {
      const why = '측정 불가 — 없는 함수: ' + mc.missing.join(',');
      chk('MC1 몹 외곽선이 무대 바닥과 갈린다 (세 구간 전부)', false, why);
      chk('MC2 용사 외곽선이 무대 바닥과 갈린다 (세 구간 전부)', false, why);
    } else {
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
      const cr = (a, b) => { const x = lum(a), y = lum(b);
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
      const FLOOR = 3.0;

      // 「땅이 최대로 밝아져도」의 값 — 판정에는 쓰지 않고 주석으로 남긴다.
      const stress = `땅 최대 ${JSON.stringify(mc.maxG)}(상대휘도 ${mc.maxLum}` +
        (mc.outLum !== null ? ` · 뒤집힘 문턱 ${mc.outLum}` : '') + `) 에서 ` +
        `몹 ${cr(mc.maxMob, mc.maxG).toFixed(2)} · 용사 ${cr(mc.maxHero, mc.maxG).toFixed(2)}`;

      for (const [id, key, label] of [['MC1', 'mobOut', '몹'], ['MC2', 'heroOut', '용사']]) {
        const rows = mc.segs.map(s => ({ seg: s.seg, c: cr(s[key], s.ground),
          brighter: lum(s[key]) > lum(s.ground) }));
        const bad = rows.filter(r => r.c < FLOOR);
        // 방향이 구간마다 제각각이면 한 구간에서 외곽선이 땅에 녹는다는 뜻이다.
        const dirs = new Set(rows.map(r => r.brighter));
        const ok = bad.length === 0 && rows.length >= 3 && dirs.size === 1;
        chk(`${id} ${label} 외곽선이 무대 바닥과 갈린다 (세 구간 전부, 대비 ≥${FLOOR})`, ok,
          (rows.length < 3 ? `구간이 ${rows.length}개뿐이다 · ` : '') +
          (dirs.size > 1 ? '구간마다 밝기 방향이 다르다 · ' : '') +
          (bad.length ? bad.map(r => `구간${r.seg} 대비 ${r.c.toFixed(2)}`).join(' · ') + ' · '
                      : `순환 ${mc.period}구간 · 대비 ` +
                        rows.map(r => r.c.toFixed(2)).join('/') +
                        ` (전부 땅보다 ${rows[0].brighter ? '밝다' : '어둡다'}) · `) +
          stress);
      }
    }
    await mcCtx.close();
  } catch (e) {
    chk('MC-예외 몹·용사 대비 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }


  /* ── SG7 : 손그림 26장 «모양 서명» (018 제안 2 → 019 §5 · 020 대비) ──────────
     `ST3` 은 **장수**만 센다. 모양은 `SG5`(경계상자 3단계 동일)·`SG6`(축 서명)이
     일부만 보고, **공격 포즈는 아무도 안 본다**. 020 이 26장을 전부 갈아 끼우므로
     그 전에 장당 지문을 박아 둔다.

     지문 넷: `box`(경계상자 x,y,w,h) · `fill`(칠해진 칸) · `holes`(바깥에서 못 닿는
     칸) · `hist`(인덱스 0~4 칸수, **격자 전체** 기준이라 합 = SPR_SIZE²).

     ⚠ **기대값은 `SPR_SIZE` 로 키를 잡는다.** 020 이 24 → 32 로 올리므로 한 벌로는
     안 된다. `24` 는 018·019 실측(019 는 그림을 안 건드렸다 — 새 그림 0장을 따로
     확인했다), `32` 는 계획 세션이 확정한 `docs/ref/sprites32-v4.json` 의
     `box`·`fill`·`holes`·`hist` 를 그대로 옮긴 것이다(26/26 이 `px` 에서 재계산되는
     것을 검산했다). **020 이 통과하면 변환 손실 0 이 증명된다.**

     ⚠ 기준선이 없는 `SPR_SIZE` 나, 문자열 길이가 `SPR_SIZE²` 가 아닌 형식이 오면
     **통과시키지 않고 FAIL 한다.** 못 재는 것을 통과로 적지 않는다(soak 규약과 같다). */
  const ART_SIG = {"24":{"weapon1":{"box":[0,4,21,19],"fill":71,"holes":1,"hist":[505,52,0,19,0]},"weapon2":{"box":[0,4,21,19],"fill":77,"holes":0,"hist":[499,53,11,0,13]},"weapon3":{"box":[0,4,21,19],"fill":77,"holes":0,"hist":[499,53,11,0,13]},"head1":{"box":[3,5,18,15],"fill":162,"holes":23,"hist":[414,82,0,80,0]},"head2":{"box":[3,5,18,15],"fill":168,"holes":20,"hist":[408,84,24,24,36]},"head3":{"box":[3,5,18,15],"fill":168,"holes":20,"hist":[408,100,7,16,45]},"body1":{"box":[1,2,22,17],"fill":264,"holes":0,"hist":[312,65,0,199,0]},"body2":{"box":[1,2,22,17],"fill":272,"holes":0,"hist":[304,66,22,150,34]},"body3":{"box":[1,2,22,17],"fill":272,"holes":0,"hist":[304,84,21,112,55]},"legs1":{"box":[5,4,14,19],"fill":203,"holes":0,"hist":[373,85,0,118,0]},"legs2":{"box":[5,4,14,19],"fill":210,"holes":0,"hist":[366,82,33,54,41]},"legs3":{"box":[5,4,14,19],"fill":210,"holes":0,"hist":[366,106,29,24,51]},"hands1":{"box":[2,3,17,19],"fill":248,"holes":0,"hist":[328,69,0,179,0]},"hands2":{"box":[2,3,17,19],"fill":254,"holes":0,"hist":[322,68,27,129,30]},"hands3":{"box":[2,3,17,19],"fill":254,"holes":0,"hist":[322,96,14,103,41]},"feet1":{"box":[5,3,17,18],"fill":190,"holes":8,"hist":[386,72,0,118,0]},"feet2":{"box":[5,3,17,18],"fill":193,"holes":12,"hist":[383,73,25,62,33]},"feet3":{"box":[5,3,17,18],"fill":193,"holes":12,"hist":[383,89,16,39,49]},"melee1":{"box":[2,5,21,16],"fill":258,"holes":0,"hist":[318,54,0,204,0]},"melee2":{"box":[2,5,21,16],"fill":258,"holes":0,"hist":[318,54,22,154,28]},"melee3":{"box":[2,5,21,16],"fill":258,"holes":0,"hist":[318,95,21,96,46]},"ranged1":{"box":[6,1,12,22],"fill":152,"holes":42,"hist":[424,88,0,64,0]},"ranged2":{"box":[6,1,12,22],"fill":152,"holes":42,"hist":[424,88,12,8,44]},"ranged3":{"box":[6,1,12,22],"fill":152,"holes":42,"hist":[424,96,3,6,47]},"hero1":{"box":[2,2,20,21],"fill":232,"holes":12,"hist":[344,0,21,42,169]},"hero2":{"box":[2,2,22,21],"fill":209,"holes":4,"hist":[367,0,20,41,148]}},"32":{"weapon1":{"box":[1,1,29,30],"fill":216,"holes":0,"hist":[808,89,61,43,23]},"weapon2":{"box":[1,1,30,30],"fill":243,"holes":0,"hist":[781,85,40,63,55]},"weapon3":{"box":[1,1,30,30],"fill":252,"holes":0,"hist":[772,96,60,61,35]},"head1":{"box":[3,1,25,29],"fill":499,"holes":0,"hist":[525,224,132,76,67]},"head2":{"box":[3,1,26,29],"fill":526,"holes":0,"hist":[498,166,111,166,83]},"head3":{"box":[3,1,26,30],"fill":529,"holes":0,"hist":[495,215,133,111,70]},"body1":{"box":[2,4,28,23],"fill":453,"holes":0,"hist":[571,194,94,42,123]},"body2":{"box":[1,3,30,25],"fill":500,"holes":0,"hist":[524,219,93,72,116]},"body3":{"box":[1,3,30,25],"fill":561,"holes":0,"hist":[463,219,99,132,111]},"legs1":{"box":[2,1,28,30],"fill":636,"holes":0,"hist":[388,317,123,59,137]},"legs2":{"box":[2,1,28,30],"fill":626,"holes":0,"hist":[398,249,143,140,94]},"legs3":{"box":[1,1,29,30],"fill":694,"holes":0,"hist":[330,263,179,187,65]},"hands1":{"box":[4,2,24,27],"fill":479,"holes":0,"hist":[545,173,76,118,112]},"hands2":{"box":[5,1,21,30],"fill":481,"holes":0,"hist":[543,135,96,100,150]},"hands3":{"box":[5,1,22,30],"fill":511,"holes":0,"hist":[513,149,91,126,145]},"feet1":{"box":[4,3,24,26],"fill":473,"holes":0,"hist":[551,150,64,176,83]},"feet2":{"box":[4,3,24,26],"fill":451,"holes":0,"hist":[573,216,94,52,89]},"feet3":{"box":[4,1,24,30],"fill":494,"holes":0,"hist":[530,230,189,46,29]},"melee1":{"box":[5,3,22,26],"fill":425,"holes":0,"hist":[599,148,80,115,82]},"melee2":{"box":[4,1,23,29],"fill":493,"holes":0,"hist":[531,170,73,121,129]},"melee3":{"box":[4,1,24,30],"fill":531,"holes":0,"hist":[493,177,88,156,110]},"ranged1":{"box":[4,2,23,27],"fill":298,"holes":13,"hist":[726,170,42,48,38]},"ranged2":{"box":[4,1,24,29],"fill":332,"holes":24,"hist":[692,180,32,64,56]},"ranged3":{"box":[3,1,25,30],"fill":389,"holes":31,"hist":[635,188,59,79,63]},"hero1":{"box":[5,1,21,30],"fill":449,"holes":0,"hist":[575,0,195,137,117]},"hero2":{"box":[2,1,27,29],"fill":470,"holes":0,"hist":[554,0,198,91,181]}}};
  try {
    const sgCtx = await browser.newContext({ viewport: { width: 380, height: 820 } });
    const sgPage = await sgCtx.newPage();
    await sgPage.goto(URL);
    await sgPage.waitForTimeout(2000);

    const art = await sgPage.evaluate(() => {
      const out = { size: (typeof SPR_SIZE !== 'undefined') ? SPR_SIZE : null, slots: {}, miss: [] };
      const put = (id, v) => { if (typeof v === 'string') out.slots[id] = v; else out.miss.push(id); };
      try {
        ['weapon','head','body','legs','hands','feet'].forEach(k =>
          (SPR[k] || []).forEach((p, i) => put(k + (i + 1), p)));
        ['melee','ranged'].forEach(k =>
          ((typeof SPR_MOB !== 'undefined' && SPR_MOB[k]) || []).forEach((p, i) => put(k + (i + 1), p)));
        put('hero1', typeof SPR_HERO !== 'undefined' ? SPR_HERO : null);
        put('hero2', typeof SPR_HERO_ATK !== 'undefined' ? SPR_HERO_ATK : null);
      } catch (e) { out.err = e.message; }
      return out;
    });

    const sigOf = (px, G) => {
      const at = (x, y) => px.charAt(y * G + x);
      const solid = c => c !== '0' && c !== '.';
      const hist = [0,0,0,0,0];
      for (const c of px) hist[solid(c) ? +c : 0]++;
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) if (solid(at(x, y))) {
        if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
      const seen = new Uint8Array(G * G), st = [];
      for (let x = 0; x < G; x++) { st.push([x,0]); st.push([x,G-1]); }
      for (let y = 0; y < G; y++) { st.push([0,y]); st.push([G-1,y]); }
      while (st.length) { const [x,y] = st.pop();
        if (x<0||y<0||x>=G||y>=G) continue;
        const k = y*G+x; if (seen[k] || solid(at(x,y))) continue; seen[k] = 1;
        st.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); }
      let holes = 0;
      for (let y = 0; y < G; y++) for (let x = 0; x < G; x++)
        if (!solid(at(x,y)) && !seen[y*G+x]) holes++;
      return { box: [x0, y0, x1-x0+1, y1-y0+1], fill: G*G - hist[0], holes, hist };
    };

    const want = art.size != null ? ART_SIG[String(art.size)] : null;
    if (!art.size || !want) {
      chk('SG7 손그림 26장 모양 서명 (box·채움·구멍·인덱스 히스토그램)', false,
        !art.size ? 'SPR_SIZE 를 못 읽었다'
          : `SPR_SIZE=${art.size} 의 기준선이 없다 — 표를 넓히기 전에는 판정하지 않는다`);
    } else {
      const ids = Object.keys(want), bad = [], fmt = [];
      for (const id of ids) {
        const px = art.slots[id];
        if (typeof px !== 'string') { bad.push(`${id}: 없음`); continue; }
        if (px.length !== art.size * art.size) {
          fmt.push(`${id}: ${px.length}자 (${art.size}²=${art.size*art.size} 이어야 한다)`); continue; }
        const g = sigOf(px, art.size), w = want[id];
        const d = [];
        if (JSON.stringify(g.box) !== JSON.stringify(w.box)) d.push(`box ${JSON.stringify(g.box)}≠${JSON.stringify(w.box)}`);
        if (g.fill !== w.fill) d.push(`채움 ${g.fill}≠${w.fill}`);
        if (g.holes !== w.holes) d.push(`구멍 ${g.holes}≠${w.holes}`);
        if (JSON.stringify(g.hist) !== JSON.stringify(w.hist)) d.push(`hist ${JSON.stringify(g.hist)}≠${JSON.stringify(w.hist)}`);
        if (d.length) bad.push(`${id}(${d.join(' · ')})`);
      }
      const missing = ids.filter(i => !(i in art.slots));
      chk('SG7 손그림 26장 모양 서명 (box·채움·구멍·인덱스 히스토그램)',
        bad.length === 0 && fmt.length === 0 && missing.length === 0 && ids.length === 26,
        fmt.length ? `형식이 바뀌었다 — ${fmt.slice(0,3).join(' · ')}`
          : bad.length ? `${bad.length}장 불일치 — ${bad.slice(0,3).join(' · ')}`
          : `SPR_SIZE=${art.size} · 26장 전부 일치 (용사 idx1 ${want.hero1.hist[1]}·${want.hero2.hist[1]}칸 = 규약대로 0) · ` +
            `구멍 근접 ${[1,2,3].map(i=>want['melee'+i].holes).join('/')} · ` +
            `원거리 ${[1,2,3].map(i=>want['ranged'+i].holes).join('/')} · 용사 ${want.hero1.holes}/${want.hero2.holes}`);
    }
    await sgCtx.close();
  } catch (e) {
    chk('SG7-예외 모양 서명 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  /* ── DG1 : 던전 띠가 013 타일·015 몹에서 나왔는가 (019 제안 4) ────────────────
     019 는 「새 그림 0장」으로 던전을 칠한다 — 013 의 타일과 015 의 몹을 **팔레트만
     갈아** 다시 쓴다. 그 주장을 상시로 붙든다.
       ① 띠와 수문장이 실제로 구워졌는가 (구현 주석대로 «띠가 통째로 비는» 사고가
          한 번 났다 — `try` 가 ReferenceError 를 먹었다)
       ② 수문장이 `bakePX(SPR_MOB[…], mobPalette(seg), DGN_SCALE)` 와 **바이트 동일**
          — 새로 그린 것이 아니라 무대와 같은 팔레트로 같은 그림을 구웠다는 증거
       ③ 띠의 색이 `stagePalette(seg,0..2)` 안에 있는가 (무대와 같은 팔레트)
       ④ 구간을 바꾸면 띠·수문장이 **둘 다** 바뀌는가 (캐시가 굳지 않았는가) */
  try {
    const dgCtx = await browser.newContext({ viewport: { width: 380, height: 820 } });
    const dgPage = await dgCtx.newPage();
    await dgPage.goto(URL);
    await dgPage.waitForTimeout(2000);

    const dg = await dgPage.evaluate(async () => {
      const V = globalThis.__view;
      const need = ['dgnBand','dgnGuard','mobPalette','stagePalette','bakePX','segOf','dgnTier'];
      const missing = need.filter(n => { try { return typeof eval(n) !== 'function'; } catch (e) { return true; } });
      if (!V || !V.dungeon || missing.length)
        return { skel: false, why: !V || !V.dungeon ? '__view.dungeon 이 없다' : '없는 함수: ' + missing.join(',') };
      const px = url => new Promise(res => {
        const im = new Image();
        im.onload = () => { const c = document.createElement('canvas');
          c.width = im.width; c.height = im.height;
          const g = c.getContext('2d'); g.drawImage(im, 0, 0);
          res(g.getImageData(0, 0, c.width, c.height)); };
        im.onerror = () => res(null); im.src = url; });
      const hex = c => (c[0]<<16 | c[1]<<8 | c[2]);
      const segs = [0, 1, 2];
      const rows = [];
      for (const seg of segs) {
        const tier = 2, kind = 'melee';
        const band = dgnBand(seg), guard = dgnGuard(seg, tier, kind);
        const ref = bakePX(SPR_MOB[kind][tier-1], SPR_SIZE, SPR_SIZE, mobPalette(seg), DGN_SCALE);
        const pal = new Set();
        for (let d = 0; d < 3; d++) (stagePalette(seg, d) || []).forEach(c => { if (c) pal.add(hex(c)); });
        const img = band ? await px(band) : null;
        let inPal = 0, opaque = 0;
        if (img) { const D = img.data;
          for (let i = 0; i < D.length; i += 4) { if (D[i+3] < 8) continue; opaque++;
            if (pal.has((D[i]<<16 | D[i+1]<<8 | D[i+2]))) inPal++; } }
        rows.push({ seg, band: !!band, guard: !!guard, guardExact: !!guard && guard === ref,
          opaque, pct: opaque ? +(inPal/opaque*100).toFixed(2) : -1,
          bk: band ? band.length + ':' + band.slice(-24) : null,
          gk: guard ? guard.length + ':' + guard.slice(-24) : null });
      }
      return { skel: true, rows, keys: Object.keys(V.dungeon) };
    });

    if (!dg.skel) {
      chk('DG1 던전 띠·수문장이 013 타일 + 015 몹에서 나온다 (새 그림 0장)', false, dg.why);
    } else {
      const baked = dg.rows.every(r => r.band && r.guard);
      const exact = dg.rows.every(r => r.guardExact);
      const inPal = dg.rows.every(r => r.opaque > 0 && r.pct >= 99);
      const bandsDiffer = new Set(dg.rows.map(r => r.bk)).size === dg.rows.length;
      const guardsDiffer = new Set(dg.rows.map(r => r.gk)).size === dg.rows.length;
      const why = [];
      if (!baked) why.push('띠나 수문장이 안 구워졌다');
      if (!exact) why.push('수문장이 bakePX(SPR_MOB, mobPalette(seg), DGN_SCALE) 와 다르다 — 새로 그렸거나 팔레트가 어긋났다');
      if (!inPal) why.push('띠 색이 stagePalette 밖이다: ' + dg.rows.map(r => r.pct + '%').join('/'));
      if (!bandsDiffer) why.push('구간을 바꿔도 띠가 같다 (캐시가 굳었다)');
      if (!guardsDiffer) why.push('구간을 바꿔도 수문장이 같다');
      chk('DG1 던전 띠·수문장이 013 타일 + 015 몹에서 나온다 (새 그림 0장)',
        baked && exact && inPal && bandsDiffer && guardsDiffer,
        why.length ? why.join(' · ')
          : `구간 0·1·2 전부 — 수문장이 bakePX 와 **바이트 동일** · 띠 색 ${dg.rows.map(r=>r.pct+'%').join('/')} 가 stagePalette 안 · 구간마다 다르게 구워진다`);
    }
    await dgCtx.close();
  } catch (e) {
    chk('DG1-예외 던전 띠 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }


  /* ── DO1·DO2 · FL1~FL3 : 021 «가까운 쪽부터 죽는다» + 번쩍임이 산 자리에서 난다 ──
     사용자가 실기기에서 찾은 자리다. **101개 검사 중 아무도 못 잡았다** — 무리가
     어느 쪽부터 비는지를 아무도 안 봤기 때문이다. 021 의 규약은 한 줄이다:
     죽은 것은 **앞쪽(용사 쪽) `n−alive` 마리**, 살아남은 것은 제자리, 무리의
     **왼쪽 끝이 물러난다**(`deadCut`).

     ⚠ **자리 판정은 카운터가 아니라 무대 픽셀이다** (009: 카운터는 「했다」를 말하지
       「보인다」를 말하지 않는다). 정의를 못박는다 —
       **자리 i 의 평균 휘도가 «만석일 때 같은 자리의 값» 대비 55% 미만이면 빈칸.**
       ⑴ 절대 문턱을 박으면 배경 언덕을 몹으로 센다(빈 자리도 배경 때문에 0 이 아니다).
       ⑵ 「어두운 픽셀 수」로 세면 **거꾸로 나온다** — 020 그림은 구간 0 배경보다
          밝아서, 몹을 치우면 어두운 픽셀이 오히려 는다(실측 169%). 휘도 평균이어야 한다.
       실측 여유: 빈칸 43~48% · 산 자리 100% — 55% 는 그 사이다.
     ⚠ **배치는 `__view.stage` 가 내는 값만 쓴다**(`mobX0`·`mobStep`·`mobScale`·`ground`).
       좌표식을 박으면 배치가 바뀌는 순간 조용히 엉뚱한 자리를 잰다(018 에서 ST2 가
       실제로 그랬다).
     ⚠ **DO1(순서)과 DO2(묶음 호출)를 합치지 않는다.** 021 이 변이로 증명했다 —
       뒤집힌 빌드에서 묶음 검사는 **두 빌드 모두 통과**하고 순서 검사만 운다.
       한 검사가 두 성질을 겸하면 우는 쪽이 성한 쪽을 가린다.
     ⚠ **FL2·FL3 은 변이에서도 통과한다. 그래서 있다.** 「빈 자리는 안 밝아진다」·
       「카운터는 오른다」는 **연출을 통째로 죽여서 통과시키는 길**을 막는 반증용이다.
       「안 우니 쓸모없다」고 지우면 그 길이 열린다.
     ⚠ 번쩍임은 34~84ms 라 스크린샷으로 못 잡는다 — `flashing` 이 참인 **rAF 콜백
       안에서** 캔버스를 떠내고, 바로 다음 non-flashing 프레임과 자리별로 뺀다.
     ⚠ **반드시 `cut>0` 에서 잰다.** `cut=0`(만석)에서는 고친 빌드와 안 고친 빌드가
       **완전히 같다** — 만석에서는 인덱스 0 이 곧 가장 가까운 개체다. 021 1차 검증이
       못 잡은 이유가 이것이다. cut 0·3·6 을 전부 재고 **3·6 으로 판정**한다. */
  try {
    const doCtx = await browser.newContext({ viewport: { width: 380, height: 820 } });
    const doPage = await doCtx.newPage();
    await doPage.goto(URL);
    await doPage.waitForTimeout(2000);

    const D = await doPage.evaluate(async () => {
      const V = globalThis.__view;
      const need = [];
      if (!V || !V.stage || !V.motion) need.push('__view.stage/motion');
      if (typeof deadCut !== 'function') need.push('deadCut');
      if (typeof buildFoes !== 'function') need.push('buildFoes');
      if (typeof drawFoes !== 'function') need.push('drawFoes');
      if (need.length) return { skel: false, why: '없는 창구: ' + need.join(', ') };
      V.reducedMotion = true;                 // 셰이크를 끈다 — 자리가 흔들리면 못 잰다

      // 9마리 근접 웨이브를 **제품이 쓰는 길로** 만든다 (foeCount = 5 + (wave*7)%5)
      foeKind = 'melee'; S.wave = 7; buildFoes();
      const N = foeCount;
      if (N !== 9) return { skel: false, why: `웨이브 7 이 9마리가 아니다 (${N}) — 기준선을 다시 잡아야 한다` };
      const setAlive = a => { S.wave = 7; foeCount = N; foeMax = 1000; foeKind = 'melee';
                              foeHP = Math.round(1000 * a / N); };

      const can = [...document.querySelectorAll('canvas')].filter(c => c.width >= 300 && c.height >= 300)[0];
      if (!can) return { skel: false, why: '무대 캔버스를 못 찾았다' };
      const unit = (typeof SPR_UNIT !== 'undefined') ? SPR_UNIT : 24;
      const snap = () => can.getContext('2d').getImageData(0, 0, can.width, can.height);
      // 자리 상자 — 바닥에서 위로 한 칸(=unit×배율). 칸 폭 24 · 간격 28 이라 안 겹친다.
      const boxOf = (St, i) => { const w = unit * St.mobScale, x = St.mobX0 + St.mobStep * i,
          dpr = can.width / window.innerWidth, y1 = Math.round((St.rect.y + St.ground) * dpr);
        return { x0: Math.round(x * dpr), x1: Math.round((x + w) * dpr),
                 y0: Math.round(y1 - w * 1.05 * dpr), y1 }; };
      const lum = (im, b) => { let s = 0, n = 0;
        for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) {
          const k = (y * im.width + x) * 4;
          s += 0.299 * im.data[k] + 0.587 * im.data[k + 1] + 0.114 * im.data[k + 2]; n++; }
        return n ? s / n : -1; };
      // ── 몹 줄만 잘라 뜨는 «싼» 스냅. 전체 캔버스 getImageData 는 프레임을 떨어뜨려
      //    번쩍임(34ms) 자체를 놓친다. 잘라 뜨면 40배 싸서 **매 프레임** 떠도 된다.
      const stripOf = St => { const w = unit * St.mobScale, dpr = can.width / window.innerWidth,
          x0 = Math.round(St.mobX0 * dpr),
          x1 = Math.round((St.mobX0 + St.mobStep * (N - 1) + w) * dpr),
          y1 = Math.round((St.rect.y + St.ground) * dpr);
        return { x0, y0: Math.round(y1 - w * 1.05 * dpr), w: x1 - x0,
                 h: y1 - Math.round(y1 - w * 1.05 * dpr), dpr }; };
      const snapStrip = st => can.getContext('2d').getImageData(st.x0, st.y0, st.w, st.h);
      const lumIn = (im, st, St, i) => { const w = unit * St.mobScale;
        const a0 = Math.max(0, Math.round((St.mobX0 + St.mobStep * i) * st.dpr) - st.x0);
        const a1 = Math.min(im.width, Math.round((St.mobX0 + St.mobStep * i + w) * st.dpr) - st.x0);
        let t = 0, n = 0;
        for (let y = 0; y < im.height; y++) for (let x = a0; x < a1; x++) {
          const k = (y * im.width + x) * 4;
          t += 0.299 * im.data[k] + 0.587 * im.data[k + 1] + 0.114 * im.data[k + 2]; n++; }
        return n ? t / n : -1; };
      const rowAt = async a => { setAlive(a);
        const t = setInterval(() => setAlive(a), 4);          // CORE 틱이 밀어내지 못하게
        if (globalThis.__canvasWake) globalThis.__canvasWake(900);
        await new Promise(r => setTimeout(r, 750));           // 소멸 잔상(DIE_MS 320)이 빠진다
        clearInterval(t);
        const im = snap(), St = JSON.parse(JSON.stringify(V.stage));
        return { alive: a, cut: St.deadCut, nearest: St.nearest,
                 lum: Array.from({ length: N }, (_, i) => lum(im, boxOf(St, i))) }; };

      const o = { skel: true, N };
      // ── DO1 ㉮ 한 마리씩 : DOM 생존지도 + __foeDie 슬롯
      const realDie = globalThis.__foeDie, calls = [];
      globalThis.__foeDie = s => { calls.push(Array.isArray(s) ? s.slice() : [s]); };
      setAlive(9); drawFoes(); calls.length = 0;
      o.step = []; o.stepCalls = [];
      for (let a = N - 1; a >= 3; a--) { setAlive(a); drawFoes();
        o.step.push([...document.querySelectorAll('#mob [data-d]')]
          .map(e => e.dataset.d === '1' ? '0' : '1').join(''));   // 1 = 서 있다
        o.stepCalls.push(calls.length ? calls[calls.length - 1].join(',') : ''); }
      // ── DO2 ㉯ 같은 틱에 여섯 : 호출 **1회** · 슬롯 [0..5]  (019 의 묶기)
      setAlive(9); drawFoes(); calls.length = 0;
      setAlive(3); drawFoes();
      o.bundle = { n: calls.length, slots: calls.map(c => c.join(',')) };
      globalThis.__foeDie = realDie;

      // ── DO1 ㉮ 무대 픽셀 : 만석 대비 점유율
      o.full = await rowAt(N); o.c3 = await rowAt(N - 3); o.c6 = await rowAt(N - 6);

      // ── FL1~FL3 번쩍임 — flashing 인 rAF 프레임을 떠낸다. cut 0·3·6 전부.
      o.flash = [];
      const orf = window.requestAnimationFrame.bind(window);
      let pin = null, grab = null;
      window.requestAnimationFrame = cb => orf(t => {
        if (pin) pin();                       // ① 그리기 직전에 상태를 못박는다
        cb(t);                                // ② 게임 프레임
        try { if (grab) grab(); } catch (e) { /* 떠내기 실패는 아래에서 FAIL 로 잡힌다 */ }
      });
      // ⚠ **대조는 «바로 앞 프레임»이다.** 정렬 직전의 한 장을 대조로 쓰면 그 사이
      //   배경이 조금이라도 흐른 날(패럴랙스·이동) 자리 전체가 같이 밝아져 헛발질한다 —
      //   900ms 쉬어 보니 정상 빌드가 「1,3,4,8 이 밝아졌다」로 울었다. 인접 두 프레임이면
      //   배경 드리프트가 0 이고 남는 차는 백열 판뿐이다.
      // ⚠ **정렬 한 방으로 끝내지 않는다 — 최대 3번 친다.** reducedMotion 에서 번쩍임은
      //   FLASH_MS 34ms 뿐이라 프레임 간격이 벌어진 순간(checklist 를 통째로 돌 때 실제로
      //   그랬다) 번쩍이는 프레임이 두 rAF 사이로 빠진다. 단독 3/3 통과, 전체 1회 실패 —
      //   제품이 아니라 **재는 쪽의 경주**였다. 연출이 없는 빌드는 3회 모두 못 잡으므로
      //   **여전히 운다** — 무르게 푼 것이 아니라 표본을 늘린 것이다.
      const TRY = 3, BRIGHT0 = 5;
      for (const cut of [0, 3, 6]) {
        const a = N - cut; pin = () => setAlive(a); pin();
        let best = null, flashed = 0, caught = false, frCut = -1, tries = 0;
        for (let t = 0; t < TRY; t++) {
          tries = t + 1;
          if (globalThis.__canvasWake) globalThis.__canvasWake(1600);
          await new Promise(r => setTimeout(r, t ? 500 : 700));
          const St0 = JSON.parse(JSON.stringify(V.stage));
          const st = stripOf(St0), b4 = V.counters.flash;
          let prev = null; const hits = [];
          grab = () => { const f = V.motion.flashing;
            if (f) { hits.push([snapStrip(st), prev, V.stage.deadCut]); }
            else prev = snapStrip(st); };
          if (typeof globalThis.__hitFx === 'function') globalThis.__hitFx(5, 8);
          await new Promise(r => setTimeout(r, 700));
          grab = null;
          flashed += V.counters.flash - b4;
          for (const [fr, pv, fc] of hits) {
            if (!pv || fc !== St0.deadCut) continue;
            caught = true; frCut = fc;
            const d = Array.from({ length: N }, (_, i2) =>
              +(lumIn(fr, st, St0, i2) - lumIn(pv, st, St0, i2)).toFixed(2));
            if (!best || Math.max(...d) > Math.max(...best)) best = d;
          }
          if (best && Math.max(...best) > BRIGHT0) break;
        }
        const St = JSON.parse(JSON.stringify(V.stage));
        o.flash.push({ cut: St.deadCut, nearest: St.nearest, flashed, tries,
          caught: caught && frCut === St.deadCut, frCut, delta: best });
      }
      pin = null; window.requestAnimationFrame = orf;
      return o;
    });

    if (!D.skel) {
      for (const [id, label] of [['DO1', '소멸이 가까운 쪽(앞)부터 — 무대 픽셀 + DOM 생존지도'],
                                 ['DO2', '같은 틱 소멸은 __foeDie 한 번으로 묶인다 (019)'],
                                 ['FL1', '번쩍임이 살아 있는 가장 왼쪽(stage.nearest)에서, 거기서만 난다'],
                                 ['FL2', '빈 자리(cut 앞쪽)는 안 밝아진다 (반증용 — 변이에서도 통과)'],
                                 ['FL3', '번쩍임 카운터는 그대로 오른다 (반증용 — 연출을 죽이지 않았다)']])
        chk(`${id} ${label}`, false, D.why);
    } else {
      const N = D.N, EMPTY = 0.55;            // 만석 대비 55% 미만 = 빈칸 (위 정의)
      const pct = (row, i) => D.full.lum[i] > 0 ? row.lum[i] / D.full.lum[i] : -1;
      const mapOf = row => Array.from({ length: N }, (_, i) => pct(row, i) < EMPTY ? '0' : '1').join('');

      // ── DO1
      const wantStep = Array.from({ length: 6 }, (_, k) =>
        '0'.repeat(k + 1) + '1'.repeat(N - k - 1));                 // 011111111 → 000000111
      const stepBad = D.step.map((m, k) => m === wantStep[k] ? null : `${k + 1}마리째 ${m}≠${wantStep[k]}`).filter(Boolean);
      const callBad = D.stepCalls.map((c, k) => c === String(k) ? null : `${k + 1}마리째 __foeDie(${c || '없음'})≠${k}`).filter(Boolean);
      const pixWant = [[D.c3, 3], [D.c6, 6]].map(([row, c]) =>
        (row.cut === c && mapOf(row) === '0'.repeat(c) + '1'.repeat(N - c)) ? null
          : `cut=${c} 에서 ${mapOf(row)} (deadCut=${row.cut})`).filter(Boolean);
      const emptyMax = Math.max(...[[D.c3, 3], [D.c6, 6]].flatMap(([r, c]) =>
        Array.from({ length: c }, (_, i) => pct(r, i))));
      const liveMin = Math.min(...[[D.c3, 3], [D.c6, 6]].flatMap(([r, c]) =>
        Array.from({ length: N - c }, (_, i) => pct(r, c + i))));
      chk('DO1 소멸이 가까운 쪽(앞)부터 — 무대 픽셀 + DOM 생존지도',
        stepBad.length === 0 && callBad.length === 0 && pixWant.length === 0,
        [...stepBad, ...callBad, ...pixWant].length
          ? [...stepBad, ...callBad, ...pixWant].slice(0, 3).join(' · ')
          : `DOM ${D.step[0]}→${D.step[5]} · __foeDie 0→5 · 무대 픽셀 cut 3·6 일치 ` +
            `(빈칸 최대 ${(emptyMax * 100).toFixed(0)}% · 산 자리 최소 ${(liveMin * 100).toFixed(0)}% · 문턱 55%)`);

      // ── DO2 (DO1 과 합치지 않는다 — 독립임이 021 변이로 증명됐다)
      chk('DO2 같은 틱 소멸은 __foeDie 한 번으로 묶인다 (019)',
        D.bundle.n === 1 && D.bundle.slots[0] === '0,1,2,3,4,5',
        D.bundle.n !== 1 ? `호출 ${D.bundle.n}회 — 묶기가 풀렸다`
          : D.bundle.slots[0] !== '0,1,2,3,4,5' ? `슬롯 [${D.bundle.slots[0]}]`
          : `호출 1회 · 슬롯 [0,1,2,3,4,5] (오름차순 = 묶인 안에서도 가까운 쪽 먼저)`);

      // ── FL1~FL3.  판정은 cut>0 에서만 — cut=0 은 두 빌드가 같아 아무것도 못 가른다.
      const BRIGHT = 5;                        // 실측 +30 대 0 — 5 는 그 사이 어디로 잡아도 된다
      const pos = D.flash.filter(f => f.cut > 0);
      const caught = D.flash.every(f => f.caught);
      const lit = f => f.delta ? f.delta.map((v, i) => v > BRIGHT ? i : -1).filter(i => i >= 0) : null;
      const fl1 = pos.map(f => { const L = lit(f);
        return (L && L.length === 1 && L[0] === f.nearest) ? null
          : `cut=${f.cut} 에서 밝아진 자리 ${L && L.length ? L.join(',') : '없음'} (nearest=${f.nearest})`; }).filter(Boolean);
      chk('FL1 번쩍임이 살아 있는 가장 왼쪽(stage.nearest)에서, 거기서만 난다',
        caught && pos.length === 2 && fl1.length === 0,
        !caught ? `flashing 프레임을 못 떴거나 그 프레임의 deadCut 이 어긋났다 (${D.flash.map(f => f.frCut + '/' + f.cut).join(' ')}) — 못 잰 것을 통과로 적지 않는다`
          : fl1.length ? fl1.join(' · ')
          : `cut 3·6 에서 자리 ${pos.map(f => f.nearest).join('·')} 만 밝아진다 ` +
            `(Δ휘도 ${pos.map(f => f.delta[f.nearest].toFixed(1)).join('·')} · 나머지 0)`);

      const fl2 = D.flash.filter(f => f.cut > 0).map(f => { const bad = f.delta
          ? f.delta.slice(0, f.cut).map((v, i) => v > BRIGHT ? i : -1).filter(i => i >= 0) : null;
        return (bad && bad.length) ? `cut=${f.cut} 에서 빈 자리 ${bad.join(',')} 가 밝아졌다` : null; }).filter(Boolean);
      chk('FL2 빈 자리(cut 앞쪽)는 안 밝아진다 (반증용 — 변이에서도 통과)',
        caught && fl2.length === 0,
        !caught ? 'flashing 프레임을 못 떴다' : fl2.length ? fl2.join(' · ')
          : `cut 3·6 의 앞쪽 3·6 자리 전부 Δ≤${BRIGHT}`);

      const fl3 = D.flash.filter(f => f.flashed < 1);
      chk('FL3 번쩍임 카운터는 그대로 오른다 (반증용 — 연출을 죽이지 않았다)',
        fl3.length === 0,
        fl3.length ? `cut ${fl3.map(f => f.cut).join('·')} 에서 counters.flash 가 안 올랐다`
          : `cut 0·3·6 전부 정렬 한 방에 counters.flash +${D.flash[0].flashed} — ` +
            `⚠ 카운터는 «났다»만 말한다. 어디서 나는지는 FL1 이 픽셀로 본다(009)`);
    }
    await doCtx.close();
  } catch (e) {
    chk('DO-예외 소멸 순서·번쩍임 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }


  /* ── AD. 026 광고 훅: 「끝까지 본 경우에만 보상」 ──────────────────────────
     026 완료 조건이 요구한 변이 대비 검사다. `PLAT.rewarded()` 가 **무조건 true**
     를 내는 빌드에서 AD2 가 운다 — 그 빌드에서 아무것도 안 울면 「오류면 보상
     없음」을 지키는 검사가 이 저장소에 하나도 없다는 뜻이다.
     SDK 는 안 쓴다. 어댑터의 **계약**만 보므로 `PLAT.rewarded` 를 갈아 끼운다. */
  try {
    const adCtx = await browser.newContext({ viewport: { width: 380, height: 820 } });
    const ap = await adCtx.newPage();
    const adErrs = [];
    ap.on('pageerror', e => adErrs.push('pageerror: ' + e.message));
    ap.on('console', m => { if (m.type() === 'error' || m.type() === 'assert') adErrs.push(m.text()); });
    await ap.goto(URL);
    await ap.evaluate(() => { try { window.save = () => {}; } catch (e) {} });
    await ap.waitForTimeout(1200);

    // AD1 — 광고가 없는 환경(SDK 없음)에서는 버튼도 보상도 없다 (§0 의 공짜 결함)
    const a1 = await ap.evaluate(async () => {
      const v = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).display : null; };
      const c0 = S.charge, b0 = S.boost || 0;
      document.getElementById('ad').click();
      await new Promise(r => setTimeout(r, 300));
      return { ad: v('#ad'), dad: v('#dad'), adsOn: PLAT.adsOn, ready: PLAT.ready,
               gained: S.charge - c0, boosted: (S.boost || 0) > b0, adN: S.adN || 0 };
    });
    chk('AD1 광고 없는 환경: 버튼 둘 다 안 보이고 눌러도 보상이 없다 (026 §0)',
      a1.ad === 'none' && a1.dad === 'none' && a1.adsOn === false
        && a1.gained < 2 && !a1.boosted && a1.adN === 0,
      `#ad ${a1.ad} · #dad ${a1.dad} · adsOn ${a1.adsOn} · 충전증가 ${a1.gained.toFixed(2)} · 배속 ${a1.boosted} · 하루횟수 ${a1.adN}`);

    // AD2 — **오류·중단이면 보상이 없다.** 변이(무조건 true)가 여기서 운다.
    const a2 = await ap.evaluate(async () => {
      PLAT.adsOn = true; PLAT.rewarded = () => Promise.resolve(false);
      S.adAt = 0; S.adN = 0; S.boost = 0; S.charge = 5; renderFast();
      const c0 = S.charge;
      document.getElementById('ad').click();
      await new Promise(r => setTimeout(r, 300));
      return { gained: S.charge - c0, boosted: (S.boost || 0) > Date.now(), adN: S.adN || 0,
               max: CHG_MAX(), charge: S.charge };
    });
    chk('AD2 광고가 끝까지 안 갔으면 보상이 없다 (변이 대비 — rewarded()=true 면 운다)',
      a2.gained < 2 && !a2.boosted && a2.adN === 0 && a2.charge < a2.max,
      `충전 ${a2.charge.toFixed(1)}/${a2.max} · 배속 ${a2.boosted} · 하루횟수 ${a2.adN}`);

    // AD3 — 완주하면 보상이 나가고, 하루 상한이 한 칸 준다 (반증용 반대편)
    const a3 = await ap.evaluate(async () => {
      PLAT.adsOn = true; PLAT.rewarded = () => Promise.resolve(true);
      S.adAt = 0; S.adN = 0; S.boost = 0; S.charge = 5; renderFast();
      document.getElementById('ad').click();
      await new Promise(r => setTimeout(r, 300));
      const after = { charge: S.charge, max: CHG_MAX(), boosted: (S.boost || 0) > Date.now(),
                      adN: S.adN || 0, left: __view.plat.adLeft, cap: AD_DAY };
      // 상한까지 채우면 더는 안 나간다
      for (let i = 0; i < AD_DAY + 1; i++) { S.adAt = 0; renderFast();
        document.getElementById('ad').click(); await new Promise(r => setTimeout(r, 140)); }
      after.adNEnd = S.adN || 0; after.leftEnd = __view.plat.adLeft;
      return after;
    });
    chk('AD3 끝까지 본 광고는 보상이 나가고, 하루 상한을 넘지 않는다',
      a3.charge >= a3.max - 1 && a3.boosted && a3.adN === 1
        && a3.adNEnd === a3.cap && a3.leftEnd === 0,
      `첫 보상 충전 ${Math.round(a3.charge)}/${a3.max} · 배속 ${a3.boosted} · ` +
      `하루 ${a3.adNEnd}/${a3.cap} · 남은 ${a3.leftEnd}`);

    chk('AD4 광고 조작 중 콘솔 무오류', adErrs.length === 0, adErrs.slice(0, 2).join(' | '));
    await adCtx.close();

    /* AD5 — **어댑터 속까지** 본다. AD2 는 `PLAT.rewarded` 를 갈아 끼우므로
       어댑터 «안»에서 `adError` 를 보상으로 잘못 잇는 회귀(가장 그럴듯한 회귀다)를
       못 잡는다. 여기서는 SDK 를 가짜로 하나 실어 **진짜 rewarded() 를** 돌린다.
       `?cg=1` 이라 주입 경로도 같이 검사된다. */
    for (const mode of ['ok', 'err']) {
      const c5 = await browser.newContext({ viewport: { width: 380, height: 820 } });
      const p5 = await c5.newPage();
      const e5 = [];
      p5.on('pageerror', e => e5.push('pageerror: ' + e.message));
      p5.on('console', m => { if (m.type() === 'error' || m.type() === 'assert') e5.push(m.text()); });
      await p5.route('**sdk.crazygames.com/**', rt => rt.fulfill({ status: 200,
        contentType: 'application/javascript',
        body: `window.CrazyGames={SDK:{environment:'local',init(){window.__stub={i:1};return Promise.resolve();},
          game:{gameplayStart(){__stub.gs=(__stub.gs||0)+1;},gameplayStop(){__stub.gp=(__stub.gp||0)+1;},
                loadingStart(){},loadingStop(){},happytime(){}},
          ad:{hasAdblock(){return Promise.resolve(false);},
              requestAd(t,cb){__stub.t=t;setTimeout(()=>{cb.adStarted&&cb.adStarted();
                setTimeout(()=>{${mode === 'ok' ? 'cb.adFinished&&cb.adFinished();' : "cb.adError&&cb.adError('no fill');"}},200);},30);}},
          data:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem(){},clear(){}}}};` }));
      await p5.goto(URL + '?cg=1');
      await p5.evaluate(() => { try { window.save = () => {}; } catch (e) {} });
      await p5.waitForTimeout(1200);
      const r5 = await p5.evaluate(async () => {
        const st0 = JSON.parse(JSON.stringify(__view.plat));
        S.charge = 5; S.boost = 0; S.adN = 0; S.adAt = 0; renderFast();
        const mid = new Promise(res => {
          document.getElementById('ad').click();
          setTimeout(() => res({ paused: __view.plat.paused,
            wall: getComputedStyle(document.getElementById('adwall')).display,
            charge: S.charge }), 120);
        });
        const m = await mid;
        await new Promise(r => setTimeout(r, 600));
        return { st0, m, charge: S.charge, max: CHG_MAX(), boosted: (S.boost || 0) > Date.now(),
                 adN: S.adN || 0, plat: JSON.parse(JSON.stringify(__view.plat)),
                 wall: getComputedStyle(document.getElementById('adwall')).display,
                 stub: window.__stub || null };
      });
      if (mode === 'ok') {
        chk('AD5 ?cg=1: SDK 를 실어 init 하고, 광고 중에는 멈추고, 완주하면 보상이 나간다',
          !!(r5.stub && r5.stub.i === 1) && r5.st0.ready === true && r5.st0.adsOn === true
            && r5.m.paused === true && r5.m.wall === 'block' && r5.stub.t === 'rewarded'
            && r5.charge >= r5.max - 1 && r5.boosted && r5.adN === 1
            && r5.plat.done === 1 && r5.plat.failed === 0 && r5.wall === 'none',
          `init ${r5.stub && r5.stub.i} · env ${r5.st0.env} · 광고중 paused ${r5.m.paused}/막 ${r5.m.wall} · ` +
          `충전 ${Math.round(r5.charge)}/${r5.max} · 배속 ${r5.boosted} · done ${r5.plat.done} · failed ${r5.plat.failed}`);
      } else {
        chk('AD5b ?cg=1: adError 면 **보상이 없다** (어댑터 안쪽까지 무는 변이 대비)',
          r5.charge < r5.max - 1 && !r5.boosted && r5.adN === 0
            && r5.plat.failed === 1 && r5.plat.done === 0 && r5.wall === 'none'
            && r5.plat.paused === false,
          `충전 ${Math.round(r5.charge)}/${r5.max} · 배속 ${r5.boosted} · 하루횟수 ${r5.adN} · ` +
          `done ${r5.plat.done} · failed ${r5.plat.failed} · 막 ${r5.wall}`);
      }
      if (e5.length) chk('AD5-콘솔(' + mode + ') 무오류', false, e5.slice(0, 2).join(' | '));
      await c5.close();
    }

    /* AD6 — **광고 중 정지를 «깃발»이 아니라 «효과»로 잰다.** (026 §3 요건)
       AD5 는 `plat.paused` 와 `#adwall` 의 `display` 를 본다. 둘 다 **깃발**이다 —
       009 의 「카운터는 "했다"를 말하지 "보인다"를 말하지 않는다」가 그대로 걸린다.
       실제로 세 변이가 AD1~AD5b 여섯 항목을 **전부 통과**했다(검증 세션 실측):
         · 250ms 틱의 `if(PLAT.paused) return;` 제거 → 광고 중 충전이 는다
         · `hidden()` 에서 `|| PLAT.paused` 제거      → 광고 중 캔버스가 계속 그린다
         · `#adwall{pointer-events:none}`            → 막은 떠 있는데 **스핀이 눌린다**
       CrazyGames 요건은 "a user cannot **progress the game** while showing an ad" 이므로
       재야 할 것은 깃발이 아니라 **진행이 실제로 멈췄는가**다. 세 겹을 따로 잰다.
       ⚠ 광고 전 같은 길이 구간을 **노이즈 바닥**으로 먼저 잰다. 원래 안 움직이는 값이면
         「멈췄다」가 아무것도 증명하지 않는다(016 `TB5` 가 밟은 공허한 검사).
       ⚠ 가짜 광고를 **2.2초**로 늘린다. 0.2초짜리로는 250ms 틱이 한 번도 안 지나
         「충전이 안 늘었다」가 저절로 참이 된다. */
    {
      const c6 = await browser.newContext({ viewport: { width: 380, height: 820 } });
      const p6 = await c6.newPage();
      const e6 = [];
      p6.on('pageerror', e => e6.push('pageerror: ' + e.message));
      p6.on('console', m => { if (m.type() === 'error' || m.type() === 'assert') e6.push(m.text()); });
      await p6.route('**sdk.crazygames.com/**', rt => rt.fulfill({ status: 200,
        contentType: 'application/javascript',
        body: `window.CrazyGames={SDK:{environment:'local',init(){window.__stub={i:1};return Promise.resolve();},
          game:{gameplayStart(){__stub.gs=(__stub.gs||0)+1;},gameplayStop(){__stub.gp=(__stub.gp||0)+1;},
                loadingStart(){},loadingStop(){},happytime(){}},
          ad:{hasAdblock(){return Promise.resolve(false);},
              requestAd(t,cb){setTimeout(()=>{cb.adStarted&&cb.adStarted();
                setTimeout(()=>{cb.adFinished&&cb.adFinished();},2200);},30);}},
          data:{getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v),removeItem(){},clear(){}}}};` }));
      await p6.goto(URL + '?cg=1');
      await p6.evaluate(() => { try { window.save = () => {}; } catch (e) {} });
      await p6.waitForTimeout(1400);
      const xy = await p6.evaluate(() => { S.charge = 50; S.boost = 0; S.adN = 0; S.adAt = 0; renderFast();
        const r = document.getElementById('spin').getBoundingClientRect();
        return [Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)]; });
      // ① 노이즈 바닥 — 광고 전 1.4초 동안 세 값이 얼마나 움직이는가
      const base = await p6.evaluate(async () => { const a = { c: S.charge, f: __view.perf.frames };
        await new Promise(r => setTimeout(r, 1400));
        return { dc: S.charge - a.c, df: __view.perf.frames - a.f }; });
      // ② 광고를 건다
      await p6.evaluate(() => { document.getElementById('ad').click(); });
      await p6.waitForTimeout(350);
      const s0 = await p6.evaluate(() => ({ c: S.charge, f: __view.perf.frames, q: S.queue.length,
        paused: __view.plat.paused, wall: getComputedStyle(document.getElementById('adwall')).display }));
      const top = await p6.evaluate(p => { const e = document.elementFromPoint(p[0], p[1]);
        return e ? (e.id || e.tagName) : null; }, xy);
      await p6.mouse.click(xy[0], xy[1]);                 // 막을 뚫는지 **진짜로** 눌러 본다
      await p6.waitForTimeout(1400);
      const s1 = await p6.evaluate(() => ({ c: S.charge, f: __view.perf.frames, q: S.queue.length }));
      // ⚠ 광고 종료 **직후** 에 재야 한다. 011 의 절전은 할 일이 없으면 다시 재우므로
      //   1초쯤 늦게 보면 멀쩡한 빌드가 「안 깼다」로 나온다(실제로 그렇게 나왔다).
      //   `__canvasWake(600)` 창 안에서 400ms 를 본다.
      await p6.waitForTimeout(600);                       // 광고 종료 직후
      const done = await p6.evaluate(async () => { const a = __view.perf.frames;
        await new Promise(r => setTimeout(r, 400));
        return { wall: getComputedStyle(document.getElementById('adwall')).display,
                 paused: __view.plat.paused, df: __view.perf.frames - a,
                 charge: S.charge, max: CHG_MAX(), done: __view.plat.done }; });
      const dC = s1.c - s0.c, dF = s1.f - s0.f, dQ = s1.q - s0.q;
      const live = base.dc > 0.15 && base.df > 5;         // 바닥이 실제로 움직였는가
      const ok = live && s0.paused === true && s0.wall === 'block'
        && Math.abs(dC) < 0.05 && dF === 0 && dQ === 0 && top === 'adwall'
        && done.wall === 'none' && done.paused === false && done.df > 5 && done.done === 1;
      const why = [];
      if (!live) why.push(`바닥이 안 움직인다 — 검사가 공허하다 (충전 +${base.dc.toFixed(2)} · 프레임 +${base.df})`);
      if (s0.paused !== true || s0.wall !== 'block') why.push(`광고 중인데 paused ${s0.paused} · 막 ${s0.wall}`);
      if (Math.abs(dC) >= 0.05) why.push(`★ 250ms 틱이 안 멈췄다 — 광고 중 충전 ${dC > 0 ? '+' : ''}${dC.toFixed(2)}`);
      if (dF !== 0) why.push(`★ 캔버스가 안 잤다 — 광고 중 그린 프레임 +${dF}`);
      if (top !== 'adwall' || dQ !== 0) why.push(`★ 막이 입력을 안 삼킨다 — 스핀 좌표 맨 위 «${top}» · 대기열 +${dQ}`);
      if (done.wall !== 'none' || done.paused !== false) why.push(`광고 뒤에도 막 ${done.wall} · paused ${done.paused}`);
      if (done.df <= 5) why.push(`광고 뒤에 캔버스가 안 깼다 (프레임 +${done.df})`);
      if (done.done !== 1) why.push(`완주가 안 찍혔다 (done ${done.done})`);
      chk('AD6 광고 중 «정지 세 겹» 이 실제로 진행을 막는다 (깃발이 아니라 효과로)',
        ok, why.length ? why.join(' · ')
          : `바닥 1.4초 충전 +${base.dc.toFixed(2)}·프레임 +${base.df} → 광고 중 충전 ${dC.toFixed(2)}·프레임 +${dF}·대기열 +${dQ} · ` +
            `스핀 좌표 맨 위 «${top}» · 광고 뒤 막 none·프레임 +${done.df}·충전 ${Math.round(done.charge)}/${done.max}`);
      if (e6.length) chk('AD6-콘솔 무오류', false, e6.slice(0, 2).join(' | '));
      await c6.close();
    }
  } catch (e) {
    chk('AD-예외 광고 훅 검사가 완주했다', false, '조작 중 예외: ' + String((e && e.message) || e));
  }

  await browser.close();

  let fail = 0, warn = 0;
  for (const [s, n, note] of R) {
    if (s === 'FAIL') fail++; else if (s === 'WARN') warn++;
    console.log(`${s}  ${n}${note ? '  — ' + note : ''}`);
  }
  console.log(`\n수동 체크리스트: ${R.length - fail - warn} 통과, ${fail} 실패` +
    (warn ? `, ${warn} 알려진 선행 결함(WARN)` : ''));
  console.log('스크린샷: ' + SHOTS);
  process.exit(fail ? 1 : 0);
})();
