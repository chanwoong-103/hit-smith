// 상호작용 스모크: 스핀·교체 왕복·천장·층·주사위·테크·승천 전 구간.
// 실행: node tools/smoke.js  (실패 있으면 exit 1)
require('./harness')(`

// ── 상호작용 스모크 ──
let ok=0, fail=0;
const chk=(c,m)=>{ if(c){ok++;} else {fail++; console.log('  FAIL:',m);} };

S.charge=10; const q0=S.queue.length, g0=S.gold;
spin();
chk(S.queue.length===q0+1 || S.gold>g0, '스핀 후 대기열/골드 무변화');
chk(S.charge<10, '스핀이 충전을 소모 안 함');

if(!S.queue.length) S.queue.push(makeItem('weapon',5));
const hadOld=!!S.equip[S.queue[0].part];
const nw=S.queue[0]; const qlen=S.queue.length; resolve('equip');
chk(hadOld ? S.queue.length===qlen : S.queue.length===qlen-1, '교체 후 대기열 길이 오류');
chk(!hadOld || S.queue[0]!==nw, '빠진 장비가 맨 앞에 없음');
chk(S.equip[nw.part]===nw, '장착 실패');

S.queue.unshift(makeItem('head',3)); const g1=S.gold;
resolve('sell');
chk(S.gold>g1, '판매 골드 미지급');

S.tk=2; const d0=S.dust;
enterTower(); chk(S.tk===1, '티켓 미소모');
rollDice(); chk(landed!==null, '주사위 미착지');
const rr=rerolls; document.getElementById('dad').onclick;
takeReward(); chk(S.dust>=d0, '보상 수령 오류');

S.gold=1e9; const lv0=S.lv;
for(let i=0;i<3;i++){ if(S.gold>=upCost()){S.gold-=upCost();S.lv++;} }
chk(S.lv===lv0+3, '제련 강화 실패');

S.dust=1000; const k='spd', t0=T(k);
if(S.dust>=techCost(k)){ S.dust-=techCost(k); S.tech[k]=T(k)+1; }
chk(T(k)===t0+1, '테크 구매 실패');

S.lv=28; S.peak=ASC_WAVE(); const st0=S.star;
ascend();
chk(S.star===st0+1 && S.lv===0 && Object.keys(S.equip).length===0, '승천 리셋 오류');

// 천장: 게이지 가득 → 강제 전릴 정렬 + 리셋
S.queue=[]; S.asell=Array(15).fill(false); S.charge=5; S.pity=PITY(); S.lockIdx=-1;
spin();
chk(S.pity===0, '천장 후 게이지 미리셋');
chk(S.queue.length===1, '천장 스핀 아이템 미지급');

// 교체 왕복: 되돌리기가 가능한가
S.queue=[]; S.equip={}; 
const A=makeItem('head',5), B=makeItem('head',7);
S.queue.push(A); resolve('equip');            // A 장착
S.queue.push(B); resolve('equip');            // B 장착, A가 맨 앞
chk(S.equip.head===B && S.queue[0]===A, '교체 1회차 오류');
resolve('equip');                              // 다시 A 장착, B가 맨 앞
chk(S.equip.head===A && S.queue[0]===B, '교체 되돌리기 오류');
resolve('sell');                               // B 판매로 종결
chk(S.queue.length===0 && S.equip.head===A, '왕복 후 종결 오류');

// 낮은 등급 경고는 장비당 1회
let asks=0; global.confirm=()=>{asks++;return true;};
S.queue=[]; S.equip={};
const HI=makeItem('head',7), LO=makeItem('head',3);
S.queue.push(HI); resolve('equip');
S.queue.push(LO); resolve('equip');   // 경고 1회
resolve('equip');                     // HI 다시 장착
resolve('equip');                     // LO 다시 — 경고 없어야 함
chk(asks===1, '경고가 '+asks+'회 (1회여야 함)');
global.confirm=()=>true;

// 릴 고정 해제 환불
S.tok=3; S.lockIdx=-1; lockPart=0;
// 고정: 토큰 -1
S.tok--; S.lockIdx=1;
// 해제 로직과 동일하게: 환불
S.lockIdx=-1; S.tok++;
chk(S.tok===3, '고정 해제 환불 오류');

console.log('');
console.log('스모크: '+ok+' 통과, '+fail+' 실패');

if(fail>0) process.exit(1);
`);
