/* devtools/soak.js — 2D 캔버스 누수 소크 (008 §4 · 013 §0 으로 재작성)
 *
 * 사용: node devtools/soak.js [분=5] [폭=380]
 * 종료 코드: 0 통과 / 1 누수 의심 / 2 **측정 불가**
 *
 * ── 왜 다시 썼나 ────────────────────────────────────────────────
 * 옛 하니스는 Phaser 객체를 들여다봤다:
 *     g.scene.scenes  → 씬 표시목록 길이
 *     g.textures.list → 텍스처 수
 * 017 이 Phaser 를 걷어내자 `games` 필터가 빈 배열이 되어 씬 항목은 `[]`,
 * 텍스처는 `-1` 이 됐다. **그런데 하니스는 그걸 그냥 찍고 통과했다.**
 * `[]` 는 "객체가 0개"가 아니라 "볼 곳이 없다"였고, 사람은 전자로 읽었다.
 *
 * 그래서 이 판의 규약은 **하나**다:
 *   ▸ 모든 프로브는 {ok, v} 를 낸다. `ok:false` 면 그 자리에서 **종료 2**.
 *     못 재는 것을 통과로 적지 않는다. 누수 판정보다 이쪽이 먼저다.
 *   ▸ 프로브가 살아 있다는 것도 따로 증명한다(공허성 검사). 정렬을 수백 번
 *     때렸는데 불티가 한 번도 0 을 안 넘었다면 그건 "누수 없음"이 아니라
 *     "불티 창구가 죽었다"이다 — 역시 종료 2.
 *
 * ── 2D 에서 실제로 새는 곳 ──────────────────────────────────────
 *   L1 SPR_CACHE   구운 스프라이트 PNG 캐시   ← 옛 textures.list 자리
 *   L2 GLY_CACHE   구운 숫자 글리프 캐시      ← 옛 textures.list 자리
 *   L3 cacheBytes  캐시 data URL 총 길이      (개수는 같은데 커지는 경우)
 *   L4 particles   __view.alive.particles     ← 옛 scene.children 자리
 *   L5 nodes/imgs/canvases  DOM 표시목록      ← 옛 scene.children 자리
 *   L6 listeners   addEventListener 순증      (Phaser 시절에도 못 보던 것)
 *   L7 timers      살아있는 interval/timeout
 *   L8 rafLive     동시에 도는 rAF 체인       ← 옛 tweens 자리. 중복 wake 탐지
 *   L9 heapMB      힙
 *
 * ── 계측기를 심는 법 (CLAUDE.md 함정) ───────────────────────────
 * `window.save` 는 addInitScript 로 덮으면 페이지의 `function save(){}` 호이스팅에
 * 도로 먹힌다. 하지만 여기서 감싸는 것들(EventTarget.prototype.addEventListener,
 * setInterval, requestAnimationFrame …)은 **페이지가 다시 대입하지 않는다.**
 * 그래서 이것들만 addInitScript 로 감싸고, save 무력화는 로드 뒤에 한다.
 */
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const path = require('path');

const MIN   = Number(process.argv[2] || 5);
const WIDTH = Number(process.argv[3] || 380);
const GAME  = 'file://' + path.join(__dirname, '..', 'src', 'forge.html').replace(/\\/g, '/');

const SAMPLE_MS = 30000;   // 표본 간격
const SPIN_MS   = 2000;    // 정렬 간격

/* ── 페이지가 열리기 전에 심는 계측기 ───────────────────────────── */
const INSTRUMENT = () => {
  const raw = {
    add: EventTarget.prototype.addEventListener,
    rem: EventTarget.prototype.removeEventListener,
    si: window.setInterval, ci: window.clearInterval,
    st: window.setTimeout,  ct: window.clearTimeout,
    raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame
  };
  const P = { installed: true, raw, listeners: 0, timers: 0, rafLive: 0, rafTotal: 0 };

  EventTarget.prototype.addEventListener = function (...a) { P.listeners++; return raw.add.apply(this, a); };
  EventTarget.prototype.removeEventListener = function (...a) { P.listeners--; return raw.rem.apply(this, a); };

  window.setInterval = function (...a) { P.timers++; return raw.si.apply(window, a); };
  window.clearInterval = function (id) { if (id != null) P.timers--; return raw.ci.call(window, id); };
  window.setTimeout = function (fn, ms, ...r) {
    P.timers++;
    const wrapped = typeof fn === 'function'
      ? function () { P.timers--; return fn.apply(this, arguments); } : fn;
    return raw.st.call(window, wrapped, ms, ...r);
  };
  window.clearTimeout = function (id) { if (id != null) P.timers--; return raw.ct.call(window, id); };

  window.requestAnimationFrame = function (fn) {
    P.rafLive++; P.rafTotal++;
    return raw.raf.call(window, function (t) { P.rafLive--; return fn(t); });
  };
  window.cancelAnimationFrame = function (id) { if (id != null) P.rafLive--; return raw.caf.call(window, id); };

  Object.defineProperty(window, '__probe', { value: P, writable: false, configurable: false });
};

/* ── 프로브 정의. 각자 {ok, v} 를 낸다 ──────────────────────────── */
const READ = () => {
  const out = {};
  const probe = (id, fn) => {
    try {
      const v = fn();
      out[id] = (typeof v === 'number' && isFinite(v))
        ? { ok: true, v }
        : { ok: false, why: '수가 아니다: ' + JSON.stringify(v) };
    } catch (e) { out[id] = { ok: false, why: e.message }; }
  };
  const bytes = o => Object.keys(o).reduce((s, k) => s + (o[k] ? String(o[k]).length : 0), 0);

  probe('sprCache', () => Object.keys(SPR_CACHE).length);
  probe('glyCache', () => Object.keys(GLY_CACHE).length);
  probe('cacheKB', () => Math.round((bytes(SPR_CACHE) + bytes(GLY_CACHE)) / 1024));
  // 불티·rAF 는 **순간값이 아니라 구간 최고값**으로 본다. 불티 수명은 ~0.7초라
  // 30초 간격 스냅샷으로는 거의 잡히지 않는다 — 처음 이 하니스를 그렇게 짰다가
  // 공허성 검사에 걸렸다. 페이지 안에서 50ms 마다 고수위를 갱신하고 여기서
  // 읽어 비운다. 표본 사이에 난 누수도 이래야 보인다.
  probe('particles', () => { const v = window.__hw.particles; window.__hw.particles = 0; return v; });
  probe('nodes', () => document.getElementsByTagName('*').length);
  probe('imgs', () => document.getElementsByTagName('img').length);
  probe('canvases', () => document.getElementsByTagName('canvas').length);
  probe('listeners', () => window.__probe.listeners);
  probe('timers', () => window.__probe.timers);
  probe('rafLive', () => { const v = window.__hw.rafLive; window.__hw.rafLive = 0; return v; });
  probe('heapMB', () => performance.memory
    ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : NaN);

  // 판정에 쓰지 않는 참고값 — 하지만 공허성 검사가 이걸 본다.
  let witness;
  try {
    witness = {
      ok: true,
      burst: window.__view.counters.burst,
      shake: window.__view.counters.shake,
      sleeping: window.__view.perf.sleeping,
      wakes: window.__view.perf.wakes,
      rafTotal: window.__probe.rafTotal,
      particlesNow: window.__view.alive.particles,   // 회수 확인은 순간값으로 본다
      rafNow: window.__probe.rafLive
    };
  } catch (e) { witness = { ok: false, why: e.message }; }
  return { out, witness };
};

/* 프로브별 절대 상한과 이름. cap 은 "구조적으로 이보다 커질 수 없다"는 값이다. */
const SPEC = {
  sprCache:  { name: '스프라이트캐시', cap: 6 * 16 * 4 },   // 부위6 × 등급0~15 × 배율4
  glyCache:  { name: '글리프캐시',     cap: 17 * 8 * 4 },   // 17자 × 색 × 배율
  cacheKB:   { name: '캐시KB',         cap: 4096 },
  particles: { name: '불티피크',       cap: null },          // FX_MAX_PARTICLES 로 따로 본다
  nodes:     { name: 'DOM노드',        cap: 4000 },
  imgs:      { name: 'img',            cap: 400 },
  canvases:  { name: 'canvas',         cap: 16 },
  listeners: { name: '리스너',         cap: 300 },
  timers:    { name: '타이머',         cap: 100 },
  rafLive:   { name: 'rAF피크',        cap: 4 },             // 겹 둘 → 최대 2, 여유 4
  heapMB:    { name: '힙MB',           cap: 400 }
};
const IDS = Object.keys(SPEC);

const die = (code, msg) => { console.error('\n' + msg); process.exit(code); };

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 } });
  await ctx.addInitScript(INSTRUMENT);
  const page = await ctx.newPage();

  const logs = [];
  page.on('console', m => { if (m.type() === 'assert' || m.type() === 'error') logs.push(m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));

  await page.goto(GAME);
  await page.waitForTimeout(1500);

  console.log(`소크 — ${MIN}분 · 폭 ${WIDTH}px · ${GAME}`);

  // 계측기가 살아남았는지부터. 못 심었으면 아래 숫자는 전부 거짓말이다.
  const inst = await page.evaluate(() => !!(window.__probe && window.__probe.installed));
  if (!inst) die(2, '■ 측정 불가 — 계측기(__probe)가 심기지 않았다. 판정하지 않는다.');

  // 빨리 사라지는 값의 고수위 추적기. __view 가 생긴 뒤라야 하므로 로드 뒤에 건다.
  await page.evaluate(() => {
    globalThis.__hw = { particles: 0, rafLive: 0 };
    window.__probe.raw.si.call(window, () => {
      try {
        const a = window.__view.alive.particles; if (a > __hw.particles) __hw.particles = a;
        const r = window.__probe.rafLive;        if (r > __hw.rafLive) __hw.rafLive = r;
      } catch (e) {}
    }, 50);
  });

  /* ── 예비 검사: 프로브가 전부 읽히는가 ───────────────────────── */
  const pre = await page.evaluate(READ);
  const dead = IDS.filter(id => !pre.out[id].ok);
  if (dead.length || !pre.witness.ok) {
    console.error('\n■ 측정 불가 — 아래 프로브를 읽을 수 없다. **누수 없음이 아니다.**');
    dead.forEach(id => console.error(`   ${id} (${SPEC[id].name}) : ${pre.out[id].why}`));
    if (!pre.witness.ok) console.error(`   witness : ${pre.witness.why}`);
    console.error('\n  017 에서 g.scene.scenes·g.textures.list 가 조용히 []/-1 을 준 것과');
    console.error('  같은 상황이다. 프로브를 현재 구현에 맞게 고친 뒤 다시 돌릴 것.');
    await browser.close(); process.exit(2);
  }
  console.log('프로브 ' + IDS.length + '종 전부 읽힌다: ' +
    IDS.map(id => `${SPEC[id].name}=${pre.out[id].v}`).join(' · '));

  /* ── 정렬 구동 (2초마다 3연 고정) ─────────────────────────────
     save 무력화는 **로드 뒤**에 한다 (호이스팅 함정). 구동 타이머는 계측기가
     세지 않도록 감싸기 전 원본 setInterval 을 쓴다. */
  await page.evaluate(({ spinMs }) => {
    window.save = () => {};
    globalThis.__hits = 0;
    globalThis.__soak = window.__probe.raw.si.call(window, () => {
      const real = Math.random; let q = [0, 0, 0];
      Math.random = () => q.length ? q.shift() : real();
      S.charge = 10; S.queue = []; spinning = false; S.lockIdx = -1; S.pity = 0;
      S.asell = Array(15).fill(false);
      try { spin(); globalThis.__hits++; }
      finally { window.__probe.raw.st.call(window, () => { Math.random = real; }, 600); }
    }, spinMs);
  }, { spinMs: SPIN_MS });

  /* ── 표본 수집 ────────────────────────────────────────────── */
  const N = MIN * 2;                       // 30초 간격
  const rows = [];
  let sawParticles = 0, sawBurst = 0;
  const hdr = ['경과', '정렬'].concat(IDS.map(id => SPEC[id].name));
  const w = hdr.map(h => Math.max(6, h.length + 1));
  console.log('\n' + hdr.map((h, i) => h.padStart(w[i])).join(''));

  const t0 = Date.now();
  for (let i = 0; i <= N; i++) {
    const r = await page.evaluate(READ);
    const bad = IDS.filter(id => !r.out[id].ok);
    if (bad.length) {                       // 도중에 죽어도 통과로 넘기지 않는다
      await browser.close();
      die(2, '■ 측정 불가 — 소크 도중 프로브가 죽었다: ' +
        bad.map(id => `${id}(${r.out[id].why})`).join(', '));
    }
    const hits = await page.evaluate(() => globalThis.__hits);
    const el = Math.round((Date.now() - t0) / 1000);
    const v = {}; IDS.forEach(id => v[id] = r.out[id].v);
    rows.push(v);
    sawParticles = Math.max(sawParticles, v.particles);
    sawBurst = Math.max(sawBurst, r.witness.burst);
    console.log([el + 's', hits].concat(IDS.map(id => v[id]))
      .map((c, j) => String(c).padStart(w[j])).join(''));
    if (i < N) await page.waitForTimeout(SAMPLE_MS);
  }
  await page.evaluate(() => window.__probe.raw.ci.call(window, globalThis.__soak));
  const hits = await page.evaluate(() => globalThis.__hits);

  /* ── 공허성 검사: 계측기가 살아 있었다는 증거 ────────────────
     조건이 실제로 발생하지 않으면 어떤 검사도 통과한다 (CLAUDE.md). */
  const vac = [];
  if (hits < 5) vac.push(`정렬이 ${hits}회밖에 안 돌았다 — 부하가 걸리지 않았다`);
  if (sawBurst === 0) vac.push('counters.burst 가 끝까지 0 — 연출이 아예 안 돌았다');
  if (sawBurst > 0 && sawParticles === 0)
    vac.push('분출은 셌는데 alive.particles 가 한 번도 0 을 안 넘었다 — 불티 창구가 죽었다');
  const rafTotal = (await page.evaluate(READ)).witness.rafTotal;
  if (!rafTotal) vac.push('rAF 가 한 번도 안 돌았다 — 루프 계측이 죽었다');
  if (vac.length) {
    console.error('\n■ 측정 불가 — 프로브가 살아 있다는 증거가 없다:');
    vac.forEach(m => console.error('   · ' + m));
    await browser.close(); process.exit(2);
  }

  /* ── 몰아치기: 연속 12회 뒤 회수되는가 ───────────────────────── */
  const before = await page.evaluate(READ);
  await page.evaluate(async () => {
    const real = Math.random;
    for (let i = 0; i < 12; i++) {
      let q = [0, 0, 0];
      Math.random = () => q.length ? q.shift() : real();
      S.charge = 10; S.queue = []; spinning = false; S.lockIdx = -1; S.pity = 0;
      spin();
      await new Promise(r => setTimeout(r, 500));
    }
    Math.random = real;
  });
  const peak = await page.evaluate(READ);

  /* ── 정착 판정 — 한 순간이 아니라 6초를 200ms 간격으로 «훑는다» ──────────
     처음엔 5초 뒤 `perf.sleeping` 한 값만 봤다. 018 부터 **방치 중에도 주기적으로
     깨는 것이 정상**이 되면서 그 방법은 동전 던지기가 된다 — 400ms 마다 깨는
     빌드로 16회 재니 **옛 방법이 14회(88%) 헛발질**했고 6초 훑기는 0회였다.
     (사용자 보고 기준 018 실물은 13%. 어느 쪽이든 한 순간은 근거가 못 된다.)

     그래서 «한 번이라도 **완전히** 쉬었는가» 로 판정한다 — 불티 0 · sleeping ·
     rAF 0 이 **동시에** 참인 표본이 6초 안에 있는가. 「sleeping 이 한 번 깜빡였다」
     보다 세고, 주기적으로 깨는 정상 빌드를 벌하지 않는다.
     ⚠ 잠든 표본 비율은 **판정에 쓰지 않고 찍기만 한다** — 018 의 정상값을 모르는
     채로 문턱을 세우면 그 문턱이 곧 오탐이 된다. 기준선: 013 75% · 400ms 빌드 54%.
     값이 크게 떨어지면 사람이 보고 판단할 것. */
  const SETTLE_MS = 6000, SETTLE_STEP = 200;
  const sweep = [];
  for (let i = 0; i < SETTLE_MS / SETTLE_STEP; i++) {
    sweep.push(await page.evaluate(() => ({
      sleeping: window.__view.perf.sleeping,
      particles: window.__view.alive.particles,
      raf: window.__probe.rafLive })));
    await page.waitForTimeout(SETTLE_STEP);
  }
  const restIdx = sweep.findIndex(x => x.sleeping === true && x.particles === 0 && x.raf === 0);
  const asleepPct = Math.round(sweep.filter(x => x.sleeping).length / sweep.length * 100);
  const lastS = sweep[sweep.length - 1];
  const settle = await page.evaluate(READ);
  const cap = await page.evaluate(() => window.__view.limits.particles);
  console.log(`\n몰아치기 12회 — 피크 불티 ${peak.out.particles.v} (상한 ${cap}) · ` +
    (restIdx < 0 ? '**6초 안에 완전히 쉬는 순간 없음**'
                 : `완전 정지까지 ${restIdx * SETTLE_STEP}ms`) +
    ` · 6초 중 잠든 표본 ${asleepPct}% · 마지막 불티 ${lastS.particles}`);

  /* ── 판정 ────────────────────────────────────────────────────
     흔들리는 값(img 는 자릿수가 바뀌면 늘고 준다)에 속지 않도록
     **후반 최소 > 전반 최대** 일 때만 증가 추세로 본다.

     ⚠ **첫 표본은 부하 전(냉간)이라 추세에서 뺀다.** 넣으면 "부하가 걸렸다"가
     그대로 "증가 추세"로 나온다 — 처음 그렇게 짰다가 불티·타이머·rAF 가
     멀쩡한데도 누수 3건이 떴다. 비교는 **부하 걸린 표본끼리** 한다. */
  const base = rows[0], load = rows.slice(1);
  if (load.length < 2) die(2, '■ 측정 불가 — 부하 표본이 ' + load.length +
    '개뿐이라 추세를 낼 수 없다. 분을 늘려 다시 돌릴 것.');
  const half = Math.floor(load.length / 2);
  const fails = [];
  console.log('\n항목            냉간   전반(최소~최대)   후반(최소~최대)   판정');
  for (const id of IDS) {
    const a = load.slice(0, half).map(r => r[id]);
    const b = load.slice(half).map(r => r[id]);
    const aMax = Math.max(...a), bMin = Math.min(...b), bMax = Math.max(...b);
    const grew = bMin > aMax;
    const over = SPEC[id].cap != null && bMax > SPEC[id].cap;
    if (grew) fails.push(`${SPEC[id].name}: 후반 최소 ${bMin} > 전반 최대 ${aMax} (증가 추세)`);
    if (over) fails.push(`${SPEC[id].name}: ${bMax} 가 구조 상한 ${SPEC[id].cap} 초과`);
    console.log(`${SPEC[id].name.padEnd(14)}${String(base[id]).padStart(6)}` +
      `${(Math.min(...a) + '~' + aMax).padStart(15)}` +
      `${(bMin + '~' + bMax).padStart(18)}   ${grew || over ? '누수 의심' : 'ok'}`);
  }
  // 불티는 상한이 곧 안전장치다 (FX_MAX_PARTICLES).
  const pMax = Math.max(...rows.map(r => r.particles), peak.out.particles.v);
  if (pMax > cap) fails.push(`불티 ${pMax} 가 동시 상한 ${cap} 초과`);
  if (lastS.particles !== 0)
    fails.push(`몰아치기 6초 뒤에도 불티 ${lastS.particles} 남음 (회수 실패)`);
  if (restIdx < 0)
    fails.push('몰아치기 뒤 6초를 200ms 간격으로 훑는 동안 ' +
      '«불티 0 · sleeping · rAF 0» 이 동시에 참인 순간이 한 번도 없었다 (정착 실패)');
  if (settle.out.listeners.v > before.out.listeners.v)
    fails.push(`몰아치기로 리스너가 ${before.out.listeners.v}→${settle.out.listeners.v} 늘었다`);

  console.log(`\n총 정렬 ${hits}회 · 불티 최대 ${pMax}/${cap} · 콘솔 assert/error ` +
    (logs.length ? logs.join(' | ') : '0건'));
  await browser.close();

  if (logs.length) fails.push(`콘솔 assert/error ${logs.length}건`);
  if (fails.length) {
    console.error('\n■ 누수 의심 ' + fails.length + '건');
    fails.forEach(m => console.error('   · ' + m));
    process.exit(1);
  }
  console.log('\n✔ 누수 없음 — 프로브 ' + IDS.length + '종 전부 측정된 상태에서의 판정이다.');
})();
