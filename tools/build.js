#!/usr/bin/env node
/* tools/build.js — 050. `src/parts/**` 를 이어 붙여 `src/forge.html` 을 쓴다.
   의존성 0 · node 만. 빌드 스텝이 아니라 **조각을 다시 한 장으로 붙이는 도구**다
   (내놓는 것은 여전히 `src/forge.html` 하나 · 포털 업로드도 Pages 배포도 그대로).

   쓰는 법
     node tools/build.js          조각을 이어 src/forge.html 을 쓴다 (바이트·md5 를 적는다)
     node tools/build.js --check  지금 src/forge.html 이 조각을 이은 것과 **바이트로** 같은가.
                                  다르면 **어느 조각의 몇 째 줄**인지 대고 종료 코드 1.

   계약
   - 조각은 **글자 하나 더하지 않고** 그대로 잇는다(머리말 주석도 없다 — 그것도 바이트다).
   - 순서는 `src/parts/manifest.txt` 가 정한다. 이름순이 **아니다** — 42a·43a·42b 처럼
     흩어진 덩이가 파일 안의 순서를 지켜야 하기 때문이다(그 순서가 `const` 의 TDZ 계약이다).
   - manifest 에 없는 조각 파일이 `src/parts/` 에 있으면 **멈춘다.** 조용히 빠지는
     코드를 만들지 않기 위해서다.
   - `src/forge.html` 은 이제 생성물이다. 손으로 고치지 않는다(CLAUDE.md 파일 규약).
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT  = path.join(__dirname, '..');
const PARTS = path.join(ROOT, 'src', 'parts');
const OUT   = path.join(ROOT, 'src', 'forge.html');
const MAN   = path.join(PARTS, 'manifest.txt');

const md5 = buf => crypto.createHash('md5').update(buf).digest('hex');
const rel = p => path.relative(ROOT, p).split(path.sep).join('/');

function manifest() {
  if (!fs.existsSync(MAN)) die(`manifest 이 없다: ${rel(MAN)}`);
  const names = fs.readFileSync(MAN, 'utf8').split('\n')
    .map(s => s.replace(/\r$/, '').trim())
    .filter(s => s && s[0] !== '#');
  if (!names.length) die(`manifest 이 비었다: ${rel(MAN)}`);
  const seen = new Set();
  for (const n of names) {
    if (n.indexOf('/') > -1 || n === '..') die(`manifest 줄이 조각 이름이 아니다: ${n}`);
    if (seen.has(n)) die(`manifest 에 같은 조각이 두 번 있다: ${n}`);
    seen.add(n);
    if (!fs.existsSync(path.join(PARTS, n))) die(`조각이 없다: src/parts/${n}`);
  }
  // 목록에 없는 조각 파일이 남아 있으면 그 코드가 **조용히 빠진다** — 멈춘다.
  const stray = fs.readdirSync(PARTS).filter(f => f !== 'manifest.txt' && !seen.has(f));
  if (stray.length) die(`manifest 에 없는 파일이 src/parts/ 에 있다: ${stray.join(', ')}`);
  return names;
}

function read() {
  return manifest().map(n => ({ name: n, buf: fs.readFileSync(path.join(PARTS, n)) }));
}

/* 바이트 위치 하나를 「조각 이름 · 그 조각의 줄 번호 · 이은 파일의 줄 번호」로 바꾼다. */
function where(ps, off) {
  let base = 0;
  for (const p of ps) {
    if (off < base + p.buf.length) {
      const inPart = p.buf.slice(0, off - base).toString('utf8').split('\n').length;
      return { name: p.name, line: inPart, before: base };
    }
    base += p.buf.length;
  }
  const last = ps[ps.length - 1];
  return { name: last ? last.name : '(없다)', line: 0, before: base };
}

function die(msg) { console.error('build: ' + msg); process.exit(1); }

const ps = read();
const out = Buffer.concat(ps.map(p => p.buf));
const outLines = out.toString('utf8').split('\n').length - 1;

if (process.argv.indexOf('--check') > -1) {
  if (!fs.existsSync(OUT)) die(`${rel(OUT)} 이 없다 — \`node tools/build.js\` 로 만든다.`);
  const cur = fs.readFileSync(OUT);
  if (cur.equals(out)) {
    console.log(`build --check: ok · 조각 ${ps.length}개 = ${rel(OUT)} (${out.length} B · md5 ${md5(out)})`);
    process.exit(0);
  }
  // 첫 번째로 다른 바이트를 찾아 그 자리의 조각을 댄다.
  const n = Math.min(cur.length, out.length);
  let i = 0;
  while (i < n && cur[i] === out[i]) i++;
  const w = where(ps, i);
  const lineInOut = out.slice(0, Math.min(i, out.length)).toString('utf8').split('\n').length;
  console.error(`build --check: **어긋났다** — ${rel(OUT)} 는 조각을 이은 것과 다르다.`);
  console.error(`  조각 ${ps.length}개를 이으면 ${out.length} B (md5 ${md5(out)})`);
  console.error(`  지금 ${rel(OUT)} 은    ${cur.length} B (md5 ${md5(cur)})`);
  console.error(`  처음 달라지는 자리: 바이트 ${i} · **조각 ${w.name} 의 ${w.line}째 줄**(이은 파일 ${lineInOut}째 줄)`);
  const cut = s => JSON.stringify(s.length > 72 ? s.slice(0, 72) + '…' : s);
  /* ⚠ 자리는 **바이트**다. 문자열로 바꿔 찾으면 한글 한 자가 3바이트 ↔ 1칸이라
     엉뚱한 줄을 댄다(050 첫 변이 시험에서 바로 그랬다). 버퍼에서 개행을 찾는다. */
  const lineAt = (buf, at) => {
    const NL = 10;
    let a = at; while (a > 0 && buf[a - 1] !== NL) a--;
    let b = at; while (b < buf.length && buf[b] !== NL) b++;
    return buf.slice(a, b).toString('utf8');
  };
  console.error(`    조각 쪽: ${cut(lineAt(out, Math.min(i, out.length - 1)))}`);
  console.error(`    파일 쪽: ${cut(lineAt(cur, Math.min(i, cur.length - 1)))}`);
  console.error(`  고치는 자리는 **조각**이다. ${rel(OUT)} 은 \`node tools/build.js\` 가 쓴다.`);
  process.exit(1);
}

fs.writeFileSync(OUT, out);
console.log(`build: ${rel(OUT)} ← 조각 ${ps.length}개 · ${out.length} B · ${outLines}줄 · md5 ${md5(out)}`);
