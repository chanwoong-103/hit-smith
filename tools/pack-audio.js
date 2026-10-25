/* ══════════════════════════════════════════════════════════════════════════
   049 §2① — 소리 묶음(sidecar) 만들기.  실행: node tools/pack-audio.js

   왜 이런 것이 필요한가
   ─────────────────────
   사용자는 `file://` 로 **더블클릭해서** 게임을 열고 그 판으로 판정한다. 그 판에서는
   `fetch('audio/x.mp3')` 가 막힌다(CORS). `<audio src>` 는 재생되지만 WebAudio 로
   이어 붙이거나 정확히 예약할 수 없다 — 반복 이음매(§2②)와 탭 반응 지연(§2③)이
   둘 다 거기서 죽는다. 반면 **`<script src>` 는 `file://` 에서도 된다.**
   그래서 소리를 base64 로 바꾼 `.js` 로 싣는다.

   ⚠ 이것은 **빌드 단계가 아니라 에셋 변환**이다(CLAUDE.md 원칙 2 「예외 둘」).
     생성물도 저장소에 넣고, 배포는 여전히 정적 파일 복사다. 소리를 바꿀 때만 다시 돈다.
   ⚠ 각 묶음 머리에 **원본 파일별 md5** 를 주석으로 적는다 — 검증이 「묶음 = 원본」을
     대조한다(A8). 적어 두지 않으면 묶음이 낡았는지 아무도 모른다.
   ══════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const SRC  = path.join(__dirname, '..', 'src', 'audio');
const OUT  = SRC;

/* 묶음 넷. 「어느 묶음에 드는가」를 **이름으로** 정한다 — 폴더만 보면
   `sfx-fever-start` 가 효과음 묶음에 끼어 첫 입력에 2.6MB 와 함께 실린다. */
const PACKS = [
  { name: 'sfx',   hit: f => f.dir === 'sfx' && !/^sfx-fever/.test(f.key) },
  { name: 'forge', hit: f => f.key === 'bgm-intro' || f.key === 'bgm-loop' },
  { name: 'fever', hit: f => /fever/.test(f.key) },
  { name: 'calm',  hit: f => /^bgm-calm/.test(f.key) },
];

function walk(dir, rel) {
  const out = [];
  for (const n of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, n), st = fs.statSync(p);
    if (st.isDirectory()) { out.push(...walk(p, n)); continue; }
    if (!/\.(mp3|wav|ogg|m4a)$/i.test(n)) continue;
    out.push({ file: p, dir: rel || '', key: n.replace(/\.[^.]+$/, ''), bytes: st.size });
  }
  return out;
}

/* ── `--verify` : 묶음이 원본과 같은가 (049 A8) ──────────────────────────────
   묶음의 base64 를 풀어 **원본 파일의 md5 와 대조**한다. 「크기로 짐작하지 말고 md5 로
   확인하라」(CLAUDE.md 022). 소리를 바꾸고 묶음을 다시 안 돌리면 여기서 운다. */
if (process.argv.indexOf('--verify') > -1) {
  const files = walk(SRC, '');
  const byKey = {}; files.forEach(f => byKey[f.key] = f);
  let bad = 0, seen = 0;
  for (const pk of PACKS) {
    const dest = path.join(OUT, `pack-${pk.name}.js`);
    if (!fs.existsSync(dest)) { console.log(`  FAIL pack-${pk.name}.js 가 없다`); bad++; continue; }
    const txt = fs.readFileSync(dest, 'utf8');
    const want = files.filter(f => pk.hit(f));
    for (const f of want) {
      seen++;
      const m = txt.match(new RegExp('HS_AUDIO\\[' + JSON.stringify(f.key).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\]=("(?:[^"\\\\]|\\\\.)*");'));
      if (!m) { console.log(`  FAIL ${f.key} 가 pack-${pk.name}.js 에 없다`); bad++; continue; }
      const buf = Buffer.from(JSON.parse(m[1]), 'base64');
      const a = crypto.createHash('md5').update(buf).digest('hex');
      const b = crypto.createHash('md5').update(fs.readFileSync(f.file)).digest('hex');
      if (a !== b) { console.log(`  FAIL ${f.key} md5 다름 — 묶음 ${a} · 원본 ${b}`); bad++; }
    }
  }
  console.log(`A8 묶음 = 원본 — 원본 ${files.length}개 중 ${seen}개 대조 · ${bad ? bad + '건 다름' : '전부 같다'}`);
  process.exit(bad ? 1 : 0);
}

const all = walk(SRC, '');
if (!all.length) { console.error('소리 원본이 없다: ' + SRC); process.exit(2); }

const used = new Set();
let total = 0;
const report = [];
for (const pk of PACKS) {
  const files = all.filter(f => pk.hit(f));
  files.forEach(f => used.add(f.key));
  const head = [], body = [];
  let raw = 0;
  for (const f of files) {
    const buf = fs.readFileSync(f.file);
    const md5 = crypto.createHash('md5').update(buf).digest('hex');
    raw += buf.length;
    head.push(`//   ${f.key.padEnd(20)} ${String(buf.length).padStart(9)} B  md5 ${md5}`);
    // 한 줄에 하나. 줄이 길어도 괜찮다 — 사람이 읽는 파일이 아니다.
    body.push(`HS_AUDIO[${JSON.stringify(f.key)}]=${JSON.stringify(buf.toString('base64'))};`);
  }
  const txt =
`/* 049 §2① — 소리 묶음 «${pk.name}» · tools/pack-audio.js 가 만든다. 손으로 고치지 말 것.
   원본 ${files.length}개 · ${raw.toLocaleString()} B
${head.join('\n')}
   ⚠ 원본을 바꾸면 **반드시** node tools/pack-audio.js 를 다시 돌린다.
      검증은 이 머리말의 md5 와 base64 를 푼 바이트를 대조한다(A8). */
window.HS_AUDIO=window.HS_AUDIO||{};
${body.join('\n')}
`;
  const dest = path.join(OUT, `pack-${pk.name}.js`);
  fs.writeFileSync(dest, txt);
  total += txt.length;
  report.push({ pack: pk.name, n: files.length, raw, out: txt.length, dest });
}

const left = all.filter(f => !used.has(f.key));
console.log('소리 묶음 ' + PACKS.length + '개');
for (const r of report)
  console.log(`  pack-${r.pack}.js`.padEnd(20) + `원본 ${String(r.n).padStart(2)}개 `
    + `${String(r.raw).padStart(9)} B → ${String(r.out).padStart(9)} B`
    + ` (×${(r.out / r.raw).toFixed(2)})`);
console.log(`  합계 ${total.toLocaleString()} B`);
if (left.length) {
  console.log('  ⚠ 어느 묶음에도 안 든 원본: ' + left.map(f => f.key).join(', '));
  process.exit(1);     // 조용히 빠지면 소리가 없는 채로 배포된다 — 실패로 죽는다
}
