/* ══ 정리 ══ */
function opRows(it,wt){
  return Object.entries(it.ops).map(([k,v])=>{
    const dead = (k==='melee'&&wt==='ranged')||(k==='ranged'&&wt==='melee');
    return `<div class="${dead?'dead':''}"><span class="k">${t('opt.'+k)}</span>
      <span class="v num">+${v}%</span></div>`;}).join('');
}
function cardHTML(it,label){
  if(!it) return `<h3>${label}</h3><div class="dim">${t('cmp.empty')}</div>`;
  const P=PARTS.find(p=>p.id===it.part);
  return `<h3>${label}</h3>
    <div class="hd">${plate(it.part,it.g)}
      <div class="row" style="flex:1"><span>${t('part.'+P.id)}${it.wt?` · ${t('wt.'+it.wt)}`:''}</span>
      <b style="color:${GC[it.g]}">${t('ui.grade',it.g)} <span class="rm">${ROMAN[it.lv||1]}</span></b></div></div>
    <div class="pw num">${t('ui.base',fmt(it.base))}</div>
    <div class="oplist">${opRows(it,it.wt||(S.equip.weapon&&S.equip.weapon.wt))}</div>
    ${it.sp?`<div class="sp"><b>${t('sp.label')} · ${t('sp.'+it.sp+'.nm')}</b> <span>${t('sp.'+it.sp+'.d')}</span></div>`:''}`;
}
function openCmp(){
  if(!S.queue.length){ document.getElementById('cmp').classList.remove('on'); return; }
  const nw=S.queue[0], old=S.equip[nw.part]||null;
  const after={...S.equip,[nw.part]:nw};
  const d=power(after)-power(S.equip);
  document.getElementById('cOld').innerHTML=cardHTML(old,t('cmp.worn'));
  document.getElementById('cNew').innerHTML=cardHTML(nw,t('cmp.queued'))+
    `<div class="pw">${t('cmp.delta')} <span class="delta ${d>=0?'up':'down'} num">${d>=0?'+':'-'}${fmt(Math.abs(d))}</span></div>`;
  document.getElementById('bSell').innerHTML=`${t('cmp.sell')} ${ciGold()}${fmt(sellPrice(nw))}`;
  document.getElementById('bEquip').textContent=old?t('cmp.equipTry'):t('cmp.equip');
  document.getElementById('qn2').textContent=S.queue.length;
  document.getElementById('cmp').classList.add('on');
}

/* ══ 렌더 ══ */
// 첫 화면 점진 노출: 층·테크는 최고 웨이브 10 전까지 숨긴다 (원칙 7).
// 진행 기반 — 경과 시각이나 날짜 기준이 아니다. S.top 에서 파생하므로 별도 저장이 없고,
// 웨이브 10을 이미 넘긴 기존 세이브는 로드 즉시 노출된다.
const GATE_WAVE=10;
/* ══ 048 §2② — 견습생 해금 ══════════════════════════════════════════════
   사용자 결정(2026-10-16): 「처음 시작할 때는 **수동만** 보여 주고, 첫 스테이지
   20~30 넘어가면 그때부터. **승천 이후에는 1스테이지부터**.」 가운데 값 25 를 쓴다.
   041 의 `autoResOn()` 과 **같은 꼴**이다 — VIEW 상수 하나 + 저장값은 안 건드린다.
   `S.top` 은 CORE 가 웨이브를 깰 때마다 올리는 **통산** 최고치라 승천해도 안 줄고,
   그래서 「승천 이후에는 처음부터」는 `S.star>=1` 한 갈래로 충분하다.
   ⚠ 저장값 `S.auto` 는 건드리지 않는다. 잠긴 동안 `S.auto` 가 참인 옛 세이브라도
     `apprOn()` 이 거짓이라 견습생은 한 타도 안 친다(검사 S4). */
const APPR_WAVE=25;
const apprUnlocked=()=>((S.star||0)>=1 || (S.top||0)>=APPR_WAVE);
const apprOn=()=>apprUnlocked() && !!S.auto;
let apprSeen=null;               // null = 아직 판정 전 (부팅 판정은 연출 없이 조용히)
function apprUI(){
  const on=apprUnlocked();
  if(apprSeen===on) return;      // 상태가 바뀔 때만 DOM 을 건드린다 (gateUI 와 같은 규약)
  const born=apprSeen!==null && on;
  apprSeen=on;
  try{ document.body.setAttribute('data-appr', on?'1':'0'); }catch(e){}
  if(born){
    const m=document.getElementById('msg');
    if(m){ m.textContent=t('msg.autoForge'); m.className='big'; }   // 049 F3
    try{ sfx('sfx-chime'); }catch(e){}                              // 049 §2③
    popAutores(document.getElementById('auto'));     // 041 과 같은 반짝임
  }
}
let gateOn=null;                 // null = 아직 판정 전 (첫 판정은 연출 없이 조용히)
function gateUI(){
  const on=(S.top||0)>=GATE_WAVE;
  if(gateOn===on) return;        // 상태가 바뀔 때만 DOM 을 건드린다
  const born=gateOn!==null&&on;  // 도달하는 그 순간
  gateOn=on;
  ['pTower','pTech'].forEach(id=>{ const e=document.getElementById(id); if(!e) return;
    e.style.display=on?'':'none';
    if(born){ e.classList.remove('reveal'); void e.offsetWidth; e.classList.add('reveal'); } });
  // 016: 판만 숨기면 **빈 탭**이 남는다. 그리고 탭이 하나뿐인 탭바는 거짓말이라
  // 게이트 전에는 **탭바 자체를 숨긴다** — 열리는 순간 셋이 함께 나타난다.
  const bar=document.getElementById('tabs');
  if(bar) bar.style.display=on?'':'none';
  // 잠긴 탭을 보고 있는 채로 게이트가 닫히면 빈 화면에 갇힌다.
  if(!on) showTab('tabForge');
}
// 매 틱 갱신은 숫자·버튼 상태만. innerHTML 재구성은 render()에서만 한다.
function renderFast(){
  gateUI();
  apprUI();                                 // 048 §2② — 견습생 해금 (같은 규약)
  // 계속 변하는 숫자는 픽셀 글리프로 (010 §2). 한글 라벨은 시스템 스택 그대로다.
  // #wv 는 CORE 의 tick() 이 textContent 로 쓰는 자리라 손대지 않고, 옆칸 #wvg 에
  // 글리프를 둔다 — CORE 는 바이트 그대로 두면서 화면만 바꾸는 이음매다.
  setNum('wvg',S.wave,'--text',3);          // 숫자(대)
  // 031 §5: 「최고」도 **여기서** 그린다. S.top 은 CORE 의 tick() 이 웨이브를 깰 때마다
  // 올리는데(1062행), 그리는 자리가 render() 안에만 있어서 **조작이 없는 동안은 화면이
  // 안 따라왔다** — 250ms 틱이 부르는 것은 renderFast() 뿐이다. 그래서 폰에서
  // 「웨이브 8 최고 6」 처럼 최고가 현재 웨이브보다 낮게 굳는다. CORE 는 안 건드린다.
  // (탭바 게이트는 무사하다 — gateUI() 는 이미 이 함수 첫 줄에서 돈다. §5 실측 ②)
  setNum('top',S.top||0,'--dim',2);
  setNum('gold',fmt(S.gold),'--brass',2);
  setNum('tok',S.tok,'--ember',2);
  document.getElementById('chg').textContent=Math.floor(S.charge);
  /* 047 §2⑤-6 — 가려진 동안 대기열 띠와 `#qn` 은 **보류분을 뺀 수**를 보인다.
     결과가 먼저 새어 나가면 「세 번 두드리면 하나」가 깨진다(검사 K5). */
  const qSeen=Math.max(0,S.queue.length-(FG.veiled?FG.qHeld:0));
  document.getElementById('qn').textContent=qSeen;
  document.getElementById('qm').textContent=qmax();
  fgDots(false);
  document.getElementById('lv').textContent=S.lv;
  document.getElementById('cost').textContent=fmt(upCost());
  setNum('pw',fmt(power(S.equip)),'--text',2);
  document.getElementById('dust').textContent=fmt(S.dust);
  document.getElementById('tk').textContent=S.tk;
  document.getElementById('up').disabled=S.gold<upCost();
  /* 033 ②: 대기열이 가득 찼을 때 제련 버튼이 하는 말이 갈린다.
       「정리」 켬 → 자동 정리가 곧 비워 주므로 예전 그대로 **비활성**.
       「정리」 끔 → 글자가 「대기열 정리」가 되고 **누를 수 있다**(누르면 #cmp).
     글자만 바뀐다 — 버튼의 자리·크기·색은 그대로다(TB8·AD6 좌표 불변). */
  const qFull=S.queue.length>=qmax(), qClear=qFull&&!autoResOn();   // 041 ①
  // 숨기지 않고 **비운다**: `display:none` 인 글자도 `textContent` 에는 남아서 버튼의
  // 글자를 읽는 쪽에 「제련 50대기열 정리」로 보인다(실측). 빈 span 은 CSS 가 자리에서
  // 뺀다(`#spin>span:empty{display:none}`) — 간격도 안 생긴다.
  /* 034 판정 ⓑ: 033 이 「제련600」으로 붙여 놓은 회귀를 되돌린다. `#spin` 의 flex gap
     은 **눈에만** 간격을 주고 글자에는 공백이 없었다 — 복사하면 「제련600」이고 읽어
     주는 기계도 그렇게 읽는다. 말 끝에 공백 하나를 둔다(ko 「제련 600」·en 「Forge 600」).
     ⚠ 이 자리는 `data-s` 를 쓰지 않는다 — i18nDom 이 공백 없는 말로 덮어쓰기 때문이다. */
  /* 047 §2③ — 같은 세 조각이 이제 **모루 아래 캡션**에 산다. 033 ② 의 글자
     바꿈(「대기열 정리」)은 그대로 여기서 일어난다 — 바꾸는 쪽은 안 바뀌었다.
     말 끝의 공백 하나는 034 판정 ⓑ 그대로(「두드리기600」이 되지 않게). */
  document.getElementById('spinlbl').textContent=qClear?'':t('ui.tapHint')+' ';
  if(qClear) document.getElementById('chg').textContent='';
  document.getElementById('spinq').textContent=qClear?t('ui.sortQueue'):'';
  /* ⚠ `#spin` 은 **비활성으로 만들지 않는다.** 장면 전체가 버튼이라 비활성이면
     문양 칸 위의 클릭까지 죽고, 「눌러도 아무 일 없는 화면」이 된다. 못 치는
     이유는 `strike()` 가 보고 막대를 깜빡인다(§2⑤-1). 치는 것이 막히는 유일한
     경우는 033 ② 의 비교 팝업뿐이고 그건 눌려야 한다. */
  document.getElementById('spin').disabled=false;
  /* 041 ②③ — 승천 0회에는 버튼이 **없고**, 그 자리에 누를 수 없는 안내 글자가 선다.
     버튼을 두고 비활성만 시키면 「눌리는데 아무 일도 안 나는 버튼」이 되고, 그것이
     026 §0·033 이 두 번 막은 그 결함이다. */
  const unlocked=(S.star||0)>=1, arb=document.getElementById('autores'),
        arl=document.getElementById('autoresLock');
  /* ⚠ `className=` 이 아니라 `classList.toggle` 이다 — 2차의 반짝임 클래스(`pop`)가
     250ms 틱마다 지워지면 애니메이션이 영원히 다시 시작한다. 켜짐 표시는 여전히
     `#auto` 와 **같은** `.hot` 하나다. */
  if(arb){ arb.style.display=unlocked?'':'none'; arb.classList.toggle('hot',!!S.autoRes); }
  if(arl) arl.style.display=unlocked?'none':'';
  // ③ 첫 승천의 그 순간에만 한 줄. (부팅 시 기억을 S.star 로 잡으므로 다시 안 뜬다)
  if(unlocked && lastStar<1){ const m=document.getElementById('msg');
    if(m){ m.textContent=t('msg.autoresUnlocked'); m.className='big'; }
    try{ sfx('sfx-chime'); }catch(e){}                              // 049 §2③
    popAutores(arb);   // 2차 — 자동 제련이 #msg 를 덮어도 이쪽은 남는다
  }
  lastStar=S.star||0;
  document.getElementById('tower').disabled=S.tk<1;
  techBtns();                                        // 041 ④ E3 — 탭이 열렸을 때만
  /* 047 §2① · 041 제안 9 — **대기열 띠는 틱마다 나타났다 사라지지 않는다.**
     옛 `display` 토글이 16px 을 흔들어 그 아래 전부를 밀었다(검사 L3).
     비어도 같은 자리·같은 높이로 있고, 비었을 때 누르면 아무 일도 없다.
     ⚠ `textContent=` 로 통째로 덮지 않는다 — 안에 `#qn`·`#qm`·`#qdots` 가 산다. */
  document.getElementById('open').disabled=!qSeen;
  if(S.queue.length>=qmax() && !FG.veiled) document.getElementById('msg').textContent=t('ui.queueFull');
  const cs=document.getElementById('cstat');
  if(cs) cs.innerHTML=t('ui.stat',fmt(power(S.equip)),S.wave)+ciGold()+fmt(S.gold);
  // 상세 팝업도 같은 줄을 든다 — 열려 있는 동안 판단 근거가 화면에서 사라지지 않는다 (016).
  const ps=document.getElementById('pstat');
  if(ps) ps.innerHTML=t('ui.stat',fmt(power(S.equip)),S.wave)+ciGold()+fmt(S.gold);
  // 화로 압력계 — 폭(막대)과 바늘 각도만 갱신한다. innerHTML 재구성 없음.
  const pv=Math.min(100,S.pity/PITY()*100);
  const pf=document.getElementById('pityfill');
  pf.style.width=pv+'%';
  pf.className=S.pity>=PITY()?'full':'';
  document.getElementById('pneedle').style.transform='rotate('+(-80+pv*1.6)+'deg)';
  /* 047 2차 — 같은 라벨이 **글자가 아니라 `title`** 로 간다. 쓰는 말(`ui.pity`·
     `ui.pityFull`)은 한 글자도 안 바뀐다. `#pitytxt` 는 비워 둔다(요소는 남긴다). */
  const plb=S.pity>=PITY()?t('ui.pityFull'):t('ui.pity',S.pity,PITY());
  document.getElementById('pitytxt').textContent='';
  { const pe=document.getElementById('pity');
    if(pe) pe.title=t('ui.pityTip')+' · '+plb; }
  // 세로 온도계 = 남은 충전 (표시 전용, 수치는 그대로)
  // 047 §2① — 온도계가 가로로 누웠다. 채우는 값은 그대로, 쓰는 축만 바뀐다.
  document.getElementById('thermf').style.width=
    Math.min(100,S.charge/CHG_MAX()*100)+'%';
  const ad=document.getElementById('ad'), adt=document.getElementById('adtxt');
  if(boosted()){ ad.className='hot';
    adt.textContent=t('ui.boost',Math.ceil((S.boost-Date.now())/60000)); }
  // 첫 화면에는 분 단위를 쓰지 않는다 (원칙 7 — 시간 압박 표기 금지).
  // 잔여 분은 배속이 도는 동안에만 위 줄에서 보여 준다.
  else { ad.className=''; adt.textContent=t('ui.stokeShort'); }   // 047 §2① — 손잡이 줄은 짧은 말
  platUI();                                  // 026 — 광고 버튼의 존재·활성은 여기서만 정한다
}
function render(){
  renderFast();

  document.getElementById('asell').innerHTML=
    `<div class="hd">${t('ui.autosellHd')}</div><div class="ck">`+
    GC.slice(1,cap()+1).map((c,i)=>
      `<label class="${S.asell[i]?'on':''}" style="color:${c}" data-g="${i}">${i+1}</label>`
    ).join('')+`</div>`;
  [...document.querySelectorAll('#asell label')].forEach(l=>
    l.onclick=()=>{ S.asell[+l.dataset.g]=!S.asell[+l.dataset.g]; render(); });
  document.getElementById('auto').className=S.auto?'hot':'';   // 견습생 켜짐 — #autores 와 같은 표시
  /* 047 §2① — 장비 띠는 6칸 한 줄이고 **글자가 없다**(등급색 테두리로만 말한다).
     `.gd`·`.op` 는 지우지 않고 CSS 로 숨긴다 — render 와 checklist 선택자가 산다.
     잃은 말은 `title` 이 든다(041 제안 7 채택 — 이 화면의 기본 규약). 칸을 누르면
     옵션 수치 상세가 열린다(§2④). */
  document.getElementById('gear').innerHTML=PARTS.map(p=>{
    const it=S.equip[p.id];
    if(!it) return `<div class="slot empty" title="${t('part.'+p.id)}">${plate(p.id,0)}<div class="gd">—</div></div>`;
    const tip=`${t('part.'+p.id)} · ${t('ui.grade',it.g)} ${ROMAN[it.lv||1]} · `
      + Object.keys(it.ops).map(k=>t('opt.'+k+'.s')).join(', ');
    return `<div class="slot" style="border-color:${GC[it.g]}" title="${tip}">${plate(p.id,it.g)}
      <div class="gd" style="color:${GC[it.g]}">${t('ui.grade',it.g)} <span class="rm">${ROMAN[it.lv||1]}</span></div>
      <div class="op">${Object.keys(it.ops).map(k=>t('opt.'+k+'.s')).join('·\u200B')}</div></div>`;
  }).join('');
  [...document.querySelectorAll('#gear .slot')].forEach(el=>el.onclick=()=>openPop('stats'));

  // 착용 중 합계. 무기 타입과 안 맞는 옵션은 죽은 표시.
  const s=stats(S.equip);
  const rows=[[t('stats.atk'),Math.round(s.dps),''],[t('stats.hp'),Math.round(s.hp),'']];
  OPTKEYS.forEach(k=>{
    const v=s.o[k]||0; if(!v) return;
    const dead=(k==='melee'&&s.wt==='ranged')||(k==='ranged'&&s.wt==='melee');
    rows.push([t('opt.'+k),'+'+v.toFixed(1)+'%',dead?'off':'']);});
  document.getElementById('stats').innerHTML=rows.map(([k,v,c])=>
    `<div class="${c}"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')
    + Object.keys(s.sp).map(k=>
    `<div style="grid-column:1/-1;color:var(--ember)"><span>${t('sp.label')} · ${t('sp.'+k+'.nm')}</span>
     <span style="color:var(--dim);font-size:11px">${t('sp.'+k+'.d')}</span></div>`).join('');

  drawOdds('ob0',gradeProbs(0)); drawOdds('ob2',gradeProbs(2));
  const c=cap();
  document.getElementById('star').textContent=S.star?' ★'.repeat(Math.min(S.star,5))+(S.star>5?S.star:''):'';
  setNum('top',S.top||0,'--dim',2);
  document.getElementById('asc').style.display=canAscend()?'block':'none';
  // 027 B-2: 승천 관문 진행. **조건이 미달일 때만** 글자가 들어가고, 다 차면 빈다
  // (그때는 #focus 의 배너가 말한다). 상한이 아직 안 열린 구간에서는 아무 말도
  // 하지 않는다 — 첫 화면에 웨이브 수를 늘어놓지 않는다(원칙 7).
  const gt=document.getElementById('ascgate');
  if(gt) gt.innerHTML = (cap()<GMAX || canAscend()) ? ''
    : S.lv<ASC_LV()
      ? `${t('asc.capAll')}<b style="color:var(--text)">${ASC_LV()}</b>`
      : `${t('asc.needWave')}<b style="color:var(--ember)">${ASC_WAVE()}${t('asc.needWave2')}</b>${t('asc.reach')}`
        + ` <span class="num">${t('asc.curBest',S.peak||0)}</span>`;
  document.getElementById('asc').textContent=
    t('asc.banner',S.star+1,4**(S.star+1),(1+(S.star+1)*0.6).toFixed(1))
    + (REELS()<5?t('asc.reels',REELS()+1):'');
  // 승천 확인 팝업 본문 (016). 되돌릴 수 없는 조작이라 잃는 것을 먼저 적는다.
  const at=document.getElementById('ascTxt');
  if(at) at.innerHTML=
    t('asc.sellAll',Object.keys(S.equip).length+S.queue.length)
    +`<br>${t('asc.again')}`
    +`<br><br><b style="color:var(--text)">★${S.star+1}</b>${t('asc.gain',4**(S.star+1))}`
    +t('asc.gain2',(1+(S.star+1)*0.6).toFixed(1),qmax()+1)
    + (REELS()<5?t('asc.reels2',REELS(),REELS()+1):'');
  document.getElementById('olegend').innerHTML=
    gradeProbs(0).slice(0,c).map((p,i)=>
      `<span style="color:${GC[i+1]}">${i+1} <b>${(p*100).toFixed(p<1?3:1)}%</b></span>`).join('')
    + `<span style="width:100%;margin-top:3px">`
    + (c<GMAX ? `${t('up.next')}<b>${nextCapAt()}</b>${t('up.next2')}<b style="color:${GC[c+1]}">${t('ui.grade',c+1)}</b>${t('up.next3')}`
       : canAscend() ? `<b style="color:var(--g14)">${t('up.canAsc')}</b>`
       : S.lv<ASC_LV() ? `${t('up.capAll')}<b>${ASC_LV()}</b>`
       : `${t('up.needWave')}<b style="color:var(--ember)">${ASC_WAVE()}${t('asc.needWave2')}</b>${t('up.needWave2',S.peak||0)}`)
    + `</span>`;

  renderTech();
  save();
}

function drawOdds(id,p){
  document.getElementById(id).innerHTML=p.slice(0,cap()).map((v,i)=>
    `<i style="width:${v*100}%;background:${GC[i+1]}" title="${t('odds.title',i+1,(v*100).toFixed(3))}"></i>`).join('');
}

/* ══ 던전 연출 (019 §1) ══════════════════════════════════════════════
   **새 그림을 한 장도 그리지 않는다.** 013 의 근경 타일 4장과 015 의 몹 6장을
   팔레트만 갈아 다시 쓴다 — 손그림 총량은 38장 그대로다(ST3).

   색은 층수에서 **공식으로** 파생한다: 무대 바이옴과 **같은 `segOf()`** 에 층수를
   먹인다. 구간 목록을 손으로 나열하지 않으며, 같은 구간이면 무대와 던전이 같은
   색이 되어 두 화면이 한 몸으로 읽힌다 (놋쇠 → 무쇠 → **담금질물**, 멀어질수록
   차가워진다). 명도는 무대와 **동일한 `stagePalette(seg,2)`** 를 쓴다 — 019 §3:
   바이옴은 색상만 바꾸고 땅 명도는 고정이다.

   왜 캔버스가 아니라 data URL + CSS 인가: 앞 겹(#fx)은 z-index 2 인데 주사위 판
   (#dice)은 10 이다. 팝업 위에 캔버스를 올리려면 층 순서를 건드려야 하고, 그것은
   007 이 「body 에 쌓임 맥락을 만들지 말 것」으로 금지한 종류의 변경이다. 구운
   PNG 를 배경으로 얹으면 층 순서를 하나도 안 건드리고 같은 그림이 나온다. */
const DGN_SCALE=2;                     // 타일 32×24 → 64×48 · 몹 24 → 48
const dgnCache={};                     // 구간당 한 벌. 구간 수가 유한하므로 상한이 있다
const dgnTier=f=>Math.max(1,Math.min(3,1+Math.floor((Math.max(1,f|0)-1)/25)));
// 띠는 무대를 **작게 접은 것**이다: 같은 3층을 같은 순서·같은 지평선 규칙으로 쌓는다.
// (근경 한 겹만 깔았더니 띠의 8할이 빈 하늘이라 그냥 가느다란 땅금으로 읽혔다.)
// ⚠ paintPX 는 putImageData 라 **투명까지 덮어쓴다** — 무대와 똑같이 층마다 자기
//   캔버스에 깔고 drawImage 로 겹친다.
const DGN_H=72;                        // 띠 높이 · 지면선은 DGN_H-16 = 56
function dgnBand(seg){
  const k='b'+seg; if(k in dgnCache) return dgnCache[k];
  let url=null;
  try{
    const s=DGN_SCALE, W=TILE_W*4*s, H=TILE_H*s, G=DGN_H-8*s;   // 네 장이 한 주기 = CSS 의 256px
    const cv=document.createElement('canvas'); cv.width=W; cv.height=DGN_H;
    const g=cv.getContext('2d');
    // ⚠ 무대의 STAGE_KEYS 는 rAF 블록 **안**의 지역 상수라 여기서 안 보인다
    //   (처음에 그걸 불렀다가 ReferenceError 가 try 에 먹혀 띠가 통째로 비었다).
    ['far','mid','near'].forEach((key,i)=>{
      const lay=document.createElement('canvas'); lay.width=W; lay.height=H;
      const lx=lay.getContext('2d'), P=stagePalette(seg,i), t=SPR_TILE[key];
      for(let j=0;j<4;j++) paintPX(lx,t[j],TILE_W,TILE_H,P,s,TILE_W*s*j,0);
      // 지평선 규칙은 무대(bakeStage)와 같은 식이다 — 먼 산이 가장 위다.
      g.drawImage(lay, 0, i===0 ? G-17*s-8*s : i===1 ? G-15*s-3*s : G-16*s);
    });
    url=cv.toDataURL('image/png');
  }catch(e){ url=null; }                        // 캔버스가 없는 환경 — 띠 없이 돈다
  return (dgnCache[k]=url);
}
const dgnGuard=(seg,tier,kind)=>{
  const k='g'+seg+'|'+tier+'|'+kind; if(k in dgnCache) return dgnCache[k];
  const px=(SPR_MOB[kind]||SPR_MOB.melee)[tier-1];
  return (dgnCache[k]=bakePX(px,SPR_SIZE,SPR_SIZE,mobPalette(seg),DGN_SCALE));
};
// 띠 하나를 그 층의 색으로 칠한다. 반환값을 __view 에 그대로 낸다(검증 창구).
function dgnPaint(el,floor,kind){
  const seg=segOf(floor), tier=dgnTier(floor);
  const b=dgnBand(seg), g=dgnGuard(seg,tier,kind||'melee');
  const i=el.querySelector?el.querySelector('i'):null;   // node 하네스에는 DOM 이 없다
  if(b) el.style.backgroundImage=`url(${b})`;
  if(i&&g) i.style.backgroundImage=`url(${g})`;
  return {seg, tier, band:!!b, guard:!!g};
}
const dgnV=()=>globalThis.__view&&globalThis.__view.dungeon;
function dgnSync(){
  const V=globalThis.__view; if(!V) return;
  const d=V.dungeon, el=document.getElementById('dice');
  d.open=!!(el&&el.classList.contains&&el.classList.contains('on'));
  d.pos=S.pos|0; d.landed=(landed==null?-1:landed); d.rerolls=rerolls; d.best=S.best|0;
}
// 던전 패널의 띠는 **최고 층**의 구간을 보여 준다. 구간이 바뀔 때만 다시 굽는다.
let tbandSeg=-2;
function dgnPanel(){
  const el=document.getElementById('tband'); if(!el) return;
  const f=S.best|0, lab=document.getElementById('tfloor');
  if(lab) lab.textContent = f>0 ? t('tower.best',f) : t('tower.unvisited');
  if(segOf(f)===tbandSeg) return;
  tbandSeg=segOf(f); dgnPaint(el,f,'melee');
}
// 층 등반 — 숫자가 오르는 동안 띠가 한 주기 흐른다. 타이머 하나뿐이고 스스로
// 정리한다(soak 가 보는 타이머 순증이 남지 않는다).
let climbT=0;
function climbFx(floor){
  const band=document.getElementById('dband'), num=document.getElementById('dfloor');
  if(!band||!num) return;
  const V=globalThis.__view, red=!!(V&&V.reducedMotion);
  const info=dgnPaint(band, floor, foeKind==='ranged'?'ranged':'melee');
  if(V){ const d=V.dungeon; d.floor=floor|0; d.seg=info.seg; d.tier=info.tier;
    d.band=info.band; d.guard=info.guard; V.counters.climb++; }
  clearInterval(climbT); climbT=0;
  band.classList.remove('climb'); void band.offsetWidth;   // 애니메이션 재시작
  if(red||floor<=0){ num.textContent=floor+t('tower.floor'); if(V) V.dungeon.climbing=false; return; }
  band.classList.add('climb');
  if(V) V.dungeon.climbing=true;
  let i=0; const N=14;
  climbT=setInterval(()=>{
    i++; num.textContent=Math.round(floor*i/N)+t('tower.floor');
    if(i<N) return;
    clearInterval(climbT); climbT=0;
    band.classList.remove('climb');
    if(V) V.dungeon.climbing=false;
  },44);                                                   // 14 × 44ms ≈ 620ms = 띠 한 주기
}

let runFloor=0, rerolls=0, landed=null;
// 026: 위(VIEW 머리)에 둔 자리표시 술어를 여기서 진짜로 갈아 끼운다. 위에서 바로
// `rerolls` 를 읽으면 첫 renderFast() 가 TDZ 로 죽는다 — 이 변수가 아래에 있어서다.
dadReady=()=>rerolls>0 && landed!==null && Date.now()>=dadAt+DAD_COOL;
function enterTower(){
  if(S.tk<1) return;
  S.tk--; runFloor=climb(); S.best=Math.max(S.best,runFloor);
  rerolls=2; landed=null;
  hopStop();                                   // 지난 굴림의 말이 남아 있지 않게
  document.getElementById('dmsg').textContent=t('tower.reached',runFloor);
  document.getElementById('ddie').dataset.v='0';
  document.getElementById('dnum').textContent='—';
  document.getElementById('droll').disabled=false;
  document.getElementById('dtake').style.display='none';
  climbFx(runFloor);
  drawBoard(); document.getElementById('dice').classList.add('on'); render();
  dgnSync();
}

// 칸 아이콘도 같은 심볼 한 벌을 쓴다 (이모지 혼용 금지)
const TILEICO={dust:'s-dust',gold:'s-gold',tok:'s-token',chg:'s-charge'};
const TILECOL={dust:'var(--g9)',gold:'var(--brass)',tok:'var(--ember)',chg:'var(--g8)'};
/* 말이 걷는 중에는 **걷는 자리**를 보여 준다. 결과(landed)는 이미 확정돼 있지만
   그것을 먼저 칠해 버리면 걸을 이유가 사라진다 — 도착해서야 칸이 번쩍인다. */
let hopT=0, hopPos=-1;
function drawBoard(){
  const walk=hopPos>=0;
  // 034: 지역 이름이 `t` 였다 — 표 조회 함수 `t()` 를 가린다. `tl`(tile)로 바꾼다.
  document.getElementById('board').innerHTML=TILES.map((tl,i)=>{
    const amt=tileAmt(tl);
    const cls = walk ? (hopPos===i?'here':'')
      : (landed===i ? (globalThis.__view&&globalThis.__view.reducedMotion?'land':'land pop')
        : (S.pos===i&&landed===null?'here':''));
    return `<div class="tile ${cls}">
      <svg class="ci" style="color:${TILECOL[tl.k]}"><use href="#${TILEICO[tl.k]}"/></svg>
      <b>${tl.k==='chg'?t('tile.full'):fmt(amt)}</b>${t('tile.'+tl.k)}</div>`;}).join('');
}
function hopStop(){ clearInterval(hopT); hopT=0; hopPos=-1;
  const d=dgnV(); if(d) d.rolling=false; }
/* 굴림 연출 (019 §1) — **8칸 사각 트랙 위를 말이 한 칸씩 걷는다.**
   원형 휠·포인터는 002 에서 이미 기각했다(룰렛으로 읽힌다 — 원칙 7).
   ⚠ 여기서 바뀌는 것은 **말의 자리뿐**이다. 눈금·착지·버튼 상태는 rollDice 가
     클릭과 같은 틱에 이미 확정한다 — 검사(9b·9c)가 클릭 직후에 landed 와 버튼을
     읽고, 사람도 연출이 끝나기 전에 재굴림을 누를 수 있어야 한다. */
function hopTo(from,steps){
  hopStop();
  const V=globalThis.__view, die=document.getElementById('ddie');
  if(V) V.counters.dice++;
  if(!V || V.reducedMotion || !(steps>0)){ drawBoard(); return; }
  hopPos=from; V.dungeon.rolling=true;
  let i=0;
  hopT=setInterval(()=>{
    i++; hopPos=(from+i)%TILES.length;
    if(die) die.dataset.v=String(1+((from+i)%6));   // 눈이 구르다 멎는다
    if(i>=steps){ clearInterval(hopT); hopT=0; hopPos=-1;
      if(die) die.dataset.v=String(steps); V.dungeon.rolling=false; }
    drawBoard();
  },105);
}
function rollDice(){
  const d=1+Math.floor(Math.random()*6);
  const from=S.pos;
  S.pos=(S.pos+d)%TILES.length; landed=S.pos;
  document.getElementById('ddie').dataset.v=d;
  document.getElementById('dnum').textContent=d;
  const tl=TILES[landed];
  document.getElementById('dmsg').textContent=
    t('dice.landed',t('tile.'+tl.k),tl.k==='chg'?'':fmt(tileAmt(tl)));
  document.getElementById('droll').disabled=true;
  document.getElementById('dtake').style.display='block';
  document.getElementById('dtake').textContent=t('dice.take',t('tile.'+tl.k));
  hopTo(from,d);
  drawBoard(); render(); dgnSync();
}
function takeReward(){
  const t=TILES[landed], a=tileAmt(t);
  if(t.k==='dust') S.dust+=a;
  else if(t.k==='gold') S.gold+=a;
  else if(t.k==='tok') S.tok+=a;
  else S.charge=CHG_MAX();
  hopStop();
  document.getElementById('dice').classList.remove('on'); render();
  rewardFx(); dgnSync();
}
/* 보상 수령 — 008 의 불티를 그대로 쓴다(새 파티클 시스템 금지, 019 §1).
   **판이 닫힌 뒤** 던전 판 위에서 터진다: 불티는 앞 겹(#fx, z-index 2)이고 주사위
   판은 그 위(10)라, 열린 채로 터뜨리면 아무것도 안 보인다. */
function rewardFx(){
  const V=globalThis.__view; if(V) V.counters.reward++;
  const p=document.getElementById('pTower');
  if(!p || !p.getBoundingClientRect || typeof globalThis.__fxBurst!=='function') return;
  const r=p.getBoundingClientRect();
  if(!(r.width>0&&r.height>0)) return;          // 던전 탭이 안 보이면 터뜨릴 자리가 없다
  globalThis.__fxBurst(V&&V.reducedMotion?3:14, r.x+r.width/2, r.y+r.height*0.62, .8);
}
// 037 ③ — 도전 결과가 화면에 나온 **뒤** 미드롤. enterTower() 가 먼저 끝난다.
document.getElementById('tower').onclick=()=>{ enterTower(); PLAT.midroll(); };
document.getElementById('droll').onclick=rollDice;
document.getElementById('dtake').onclick=takeReward;
// 026: **광고가 앞에 선다.** 보상 내용은 그대로 — 착지당 2회 상한도 그대로다.
document.getElementById('dad').onclick=()=>{     // 광고 = 재굴림, 최대 2회
  if(!PLAT.adsOn||PLAT.paused||!dadReady()) return;
  PLAT.rewarded().then(ok=>{
    platUI();
    if(!ok){ adFailMsg(); return; }              // 오류·중단 → 보상 없이 그대로 이어간다
    dadAt=Date.now();
    rerolls--; landed=null; rollDice(); });
};

/* ══ 041 ④ — 테크 한 줄의 «지금 효과 → 다음 단계» ════════════════════════
   지금까지 `.d` 는 **한 단계당 증가분**(「주기 -0.8%」)이라 1단계든 50단계든 같은
   글자였다. 레벨 숫자만 바뀌고 「그래서 지금 얼마나 좋아졌나」는 어디에도 없었다 —
   사용자가 본 결함이 그것이다.

   ⚠ **상태를 건드려서 미리 보지 않는다.** `S.tech[k]` 를 잠깐 +1 해서 CORE 함수를
     부르는 방식은 금지다(그 사이에 틱이 돌면 그 값으로 게임이 한 번 돈다 — 표시가
     상태를 오염시키는 종류의 버그다). 대신 **현재 값은 CORE 함수에서 읽고**, 다음
     단계는 같은 식을 여기 옮겨 적어 계산한다. 옮겨 적은 식이 CORE 와 갈라지는 것을
     막는 것이 041 E1 검사의 일이다 — 현재 값끼리 대조하면 식의 모양이 드러난다.
   ⚠ 바닥·상한: `spd` 는 1.5초(`Math.max(1500,…)`), `cost` 는 -50%
     (`Math.max(0.5,…)`)에서 멈춘다. 멈춘 뒤에는 「→」가 거짓말이 되므로 **현재 값만**
     쓴다(`.d1`). 상한(`maxed`)도 같다. */
const techFx=k=>{
  const l=T(k), max=TECH[k].max, n=Math.min(l+1,max);
  const pct=(x,d)=>{ const m=Math.pow(10,(d===undefined?1:d)); return Math.round(x*100*m)/m; };
  // 정렬 보정만 한 단계가 0.25% 라 소수 둘째 자리까지 쓴다 — 한 자리로 반올림하면
  // 「+0% → +0.3%」이 되어 **올린 만큼이 아닌 값**이 적힌다.
  let cur, nxt;
  if(k==='spd'){        cur=CHG_MS()/1000;                      nxt=Math.max(1500,6000*(1-n*0.008))/1000;
                        cur=Math.round(cur*100)/100; nxt=Math.round(nxt*100)/100; }
  else if(k==='cap'){   cur=CHG_MAX();                          nxt=600+n*30; }
  else if(k==='sell'){  cur=pct(l*0.015);                       nxt=pct(n*0.015); }
  else if(k==='cost'){  cur=pct(1-Math.max(0.5,1-l*0.005));     nxt=pct(1-Math.max(0.5,1-n*0.005)); }
  else if(k==='gold'){  cur=pct(l*0.015);                       nxt=pct(n*0.015); }
  else {                cur=pct(l*0.0025,2);                    nxt=pct(n*0.0025,2); }
  const stuck=(l>=max)||(String(cur)===String(nxt));            // 상한이거나 바닥에 닿았다
  return stuck ? t('tech.'+k+'.d1',cur) : t('tech.'+k+'.d',cur,nxt);
};
/* 041 ④ — 버튼의 활성만 다시 칠한다. **줄을 다시 짜지 않는다**(renderFast 원칙:
   innerHTML 재구성 금지). 탑 보상으로 별가루가 비용을 넘는 순간 다음 `render()` 를
   기다리지 않고 250ms 안에 눌리게 하는 것이 이 함수의 전부다(E3). */
function techBtns(){
  // ⚠ 하네스에는 진짜 DOM 이 없다(`classList.contains` 도 `querySelectorAll` 도 없는
  //   자리표시 객체다). 바깥 세계를 만지는 줄은 전부 가린다 — 026 주석이 적어 둔 규칙.
  if(typeof document==='undefined'||!document.querySelectorAll) return;
  const pane=document.getElementById('tabTech');
  if(!pane||!pane.classList||typeof pane.classList.contains!=='function') return;
  if(!pane.classList.contains('on')) return;                   // 테크 탭이 열렸을 때만
  const list=document.querySelectorAll('#tech button[data-t]')||[];
  for(const b of list){
    const k=b.dataset&&b.dataset.t; if(!k||!TECH[k]) continue;
    b.disabled=(T(k)>=TECH[k].max)||S.dust<techCost(k);
  }
}

/* ══ 테크트리 렌더 ══ */
function renderTech(){
  document.getElementById('best').textContent=S.best;
  dgnPanel();                       // 던전 띠 (019) — 구간이 바뀔 때만 다시 굽는다
  document.getElementById('dleft').textContent=rerolls;
  document.getElementById('dad').disabled=!(PLAT.adsOn&&!PLAT.paused&&dadReady());  // 026
  document.getElementById('tech').innerHTML=Object.entries(TECH).map(([k,v])=>{
    const l=T(k), maxed=l>=v.max, c=techCost(k);
    return `<div class="t"><span class="nm">${t('tech.'+k+'.nm')}<i>${techFx(k)}</i></span>
      <span class="lvn">${l}/${v.max}</span>
      <button data-t="${k}" ${maxed||S.dust<c?'disabled':''}>${maxed?t('tech.done'):ciDust()+fmt(c)}</button></div>`;
  }).join('');
  [...document.querySelectorAll('#tech button[data-t]')].forEach(b=>
    b.onclick=()=>{ const k=b.dataset.t, c=techCost(k);
      if(S.dust>=c&&T(k)<TECH[k].max){ S.dust-=c; S.tech[k]=T(k)+1; render(); } });
}

