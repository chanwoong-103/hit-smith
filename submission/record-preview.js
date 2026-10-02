/* 035 §2 — 미리보기 영상 녹화.
   게임 파일은 건드리지 않는다: 쿼리(?lang=en)와 localStorage 비움, 그리고
   커서 숨김 스타일 주입만 한다(주입은 런타임이고 파일이 아니다).
   배속·시계 조작 없음 — 전부 실제 시간, 실제 난수다. */
const path=require('path'), fs=require('fs');
function loadPW(){ const r=require('child_process').execSync('npm root -g',{stdio:['ignore','pipe','ignore']}).toString().trim();
  return require(path.join(r,'playwright')); }
const pw=loadPW(); const ms=t=>new Promise(r=>setTimeout(r,t));
// 빌드 경로: BUILD 환경변수 → 없으면 저장소의 src/forge.html
const BUILD=process.env.BUILD||path.join(__dirname,'..','src','forge.html');
const URL='file://'+BUILD+'?lang=en';
const MODE=process.env.MODE||'land';
/* ⚠ **Playwright 의 `recordVideo.size` 는 확대가 아니라 «여백 채우기»다.** 뷰포트보다 큰
   size 를 주면 CSS 픽셀 그대로 찍고 남는 자리를 회색으로 메운다(실측: 1920×1080 영상의
   왼쪽 위 960×540 만 게임, 나머지 세 분면은 회색 127). 그래서 영상 크기 = 뷰포트다.

   그런데 **1920×1080 을 CSS 뷰포트로 그대로 쓰면 화면이 텅 빈다** — 실측으로 UI 가 위쪽
   45%만 채우고 아래 절반이 빈 배경이다(요건의 「검은 띠」는 아니지만 미리보기로는 못 쓴다).
   가로는 **뷰포트 1920×1080 + `html{width:960;height:540;transform:scale(2)}`** 로 찍는다 —
   미디어 질의는 1920×1080(가로)을 그대로 보고, 레이아웃만 960×540 으로 잡힌 뒤 2배로 그려진다.
   **진짜 960×540 뷰포트와 상자 좌표가 정확히 2배로 일치하는 것을 실측으로 확인했다**
   (hud 960×121→1920×242 · forge 520×305.3→1040×610.5 · spin 316.7×36→633.3×72 …).
   ⚠ **세로에는 이 수법을 쓰지 않는다.** 세로 레이아웃의 `#manage{max-height:30vh}` 가
     «뷰포트» 높이를 보기 때문에 비율이 어긋난다(실측: manage 243→682, 2배인 486 이 아니다).
     세로는 1080×1620 을 그대로 쓴다 — 그 크기에서 이미 화면이 꽉 찬다. */
/* ⚠ **영상 크기 = 뷰포트 크기다.** `recordVideo.size` 를 뷰포트보다 크게 주면 확대가 아니라
   «여백 채우기»다(실측: 1920×1080 영상의 왼쪽 위 960×540 만 게임, 나머지 세 분면 회색 127).
   ⚠ 그렇다고 1920×1080 을 CSS 뷰포트로 쓰면 **UI 가 위쪽 45%만 채우고 아래 절반이 빈다**(실측).
   ⚠ `transform:scale(2)` 로 레이아웃만 반으로 잡는 수법은 상자 좌표는 정확히 2배로 맞지만
     **무대 캔버스가 깨진다** — 몹이 안 그려진다(실측). 몹은 이 영상의 필수 장면이라 못 쓴다.
   → 그래서 **절반 크기로 찍고 ffmpeg 에서 정확히 ×2 nearest 로 키운다.** 녹화는 손대지 않은
     게임을 실제 크기에서 찍은 것이고, ×2 nearest 는 한 픽셀이 2×2 가 될 뿐 색을 섞지 않는다
     (이 게임은 `image-rendering:pixelated` 로 정수 배율을 전제한다 — 1859행 주석). */
const VP  = MODE==='land' ? {width:960,height:540} : {width:540,height:810};
const VID = MODE==='land' ? {width:1920,height:1080} : {width:1080,height:1620};
const ZOOM = null;   // ⚠ transform:scale 수법은 **무대 캔버스를 깨뜨린다**(몹이 안 그려진다). 쓰지 않는다.
const OUT=process.env.OUT||path.join(__dirname,'take-'+MODE);
const PLAY=+(process.env.PLAY||20000);           // 안무 길이(ms) — 뒤는 자른다
fs.mkdirSync(OUT,{recursive:true});
(async()=>{
  const b=await pw.chromium.launch({ headless:false,
    args:['--window-position=0,0','--force-device-scale-factor=1','--hide-scrollbars','--mute-audio'] });
  const ctx=await b.newContext({ viewport:VP, deviceScaleFactor:1, locale:'en-US',
    recordVideo:{ dir:OUT, size:{width:VP.width,height:VP.height} } });
  const pg=await ctx.newPage();
  const errs=[]; pg.on('pageerror',e=>errs.push('pageerror: '+e.message));
  pg.on('console',m=>{ if(m.type()==='error'||m.type()==='assert') errs.push(m.text()); });
  await pg.addInitScript(()=>{ try{ localStorage.removeItem('forge'); }catch(e){} });
  const tCtx=Date.now();
  await pg.goto(URL);
  // 커서 숨김 (요건: 기본 마우스 커서 금지)
  await pg.addStyleTag({content:'*,*::before,*::after{cursor:none !important}'});
  if(ZOOM) await pg.addStyleTag({content:
    'html{width:'+ZOOM.w+'px!important;height:'+ZOOM.h+'px!important;'+
    'transform:scale(2)!important;transform-origin:0 0!important;overflow:hidden!important}'+
    'body{width:'+ZOOM.w+'px!important;height:'+ZOOM.h+'px!important}'});
  // 게임이 실제로 그려졌는지 확인한 뒤에 안무를 시작한다 — 앞쪽 빈 프레임을 자르기 위해 시점을 기록
  await pg.waitForFunction(()=>{
    const r=document.querySelectorAll('#reels .reel').length;
    const sp=document.getElementById('spin');
    return r>=3 && sp && /\d/.test(sp.textContent) && document.getElementById('foes').textContent.length>0;
  },null,{timeout:10000});
  await ms(900);                                  // 첫 렌더가 안정되도록
  const tReady=Date.now();
  const marks=[]; const t0=Date.now();
  const mark=async(tag)=>{ const r=await pg.evaluate(()=>({pow:power(S.equip),wave:S.wave,
      eq:Object.keys(S.equip).length,lv:S.lv,q:S.queue.length,pity:S.pity||0,gold:S.gold,
      msg:document.getElementById('msg').textContent.trim()}));
    marks.push({t:+((Date.now()-t0)/1000).toFixed(2),tag,...r}); return r; };
  await mark('안무 시작');
  // ① 첫 제련 다섯 번 — 릴 정렬과 등급 불빛
  for(let i=0;i<5;i++){
    await pg.evaluate(()=>document.getElementById('spin').click());
    await ms(640);
  }
  await mark('제련 5회');
  // ② 대기열에서 하나 장착 — 전투력이 오르는 것이 보인다
  await pg.evaluate(()=>{ if(S.queue.length) openCmp(); });
  await ms(900); await mark('비교 팝업');
  await pg.evaluate(()=>{ const x=document.getElementById('bEquip'); if(x&&x.onclick) x.onclick(); });
  await ms(500); await mark('장착');
  await pg.evaluate(()=>{ const c=document.getElementById('cmp'); if(c) c.classList.remove('on'); });
  await ms(250);
  // ③ 자동 — 장비가 흐르고, 몹이 쓰러지고, 웨이브가 넘어간다. 골드가 모이면 강화를 누른다.
  await pg.evaluate(()=>document.getElementById('auto').click());
  await mark('자동 켬');
  let lastWave=1;
  while(Date.now()-t0 < PLAY){
    await ms(500);
    const did=await pg.evaluate(()=>{ const u=document.getElementById('up');
      if(u && !u.disabled && S.gold>=upCost()){ u.click(); return true; } return false; });
    const r=await pg.evaluate(()=>({wave:S.wave}));
    if(did) await mark('강화');
    if(r.wave>lastWave){ lastWave=r.wave; await mark('웨이브 '+r.wave); }
  }
  await mark('안무 끝');
  const preroll=(tReady-tCtx)/1000;
  await ctx.close();
  const vids=fs.readdirSync(OUT).filter(f=>f.endsWith('.webm'));
  const meta={mode:MODE, vp:VP, vid:VID, preroll:+preroll.toFixed(2), play:PLAY/1000,
    video:vids.map(f=>({f,bytes:fs.statSync(path.join(OUT,f)).size})), marks, errs};
  fs.writeFileSync(path.join(OUT,'meta.json'), JSON.stringify(meta,null,1));
  console.log('MODE='+MODE+' 녹화 '+VP.width+'×'+VP.height+' → ×2 → '+VID.width+'×'+VID.height+' · preroll '+meta.preroll+'s · 안무 '+meta.play+'s');
  console.log('영상: '+meta.video.map(v=>v.f+' '+(v.bytes/1048576).toFixed(1)+'MB').join(', '));
  marks.forEach(m=>console.log('  '+String(m.t).padStart(6)+'s '+m.tag.padEnd(12)+
    '전투력 '+String(m.pow).padStart(6)+' · 웨이브 '+String(m.wave).padStart(2)+' · 장비 '+m.eq+
    ' · 제련등급 '+m.lv+' · 대기 '+m.q+' · 압력 '+String(m.pity).padStart(2)+' · 「'+m.msg.slice(0,38)+'」'));
  console.log('콘솔 '+errs.length+'건'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  await b.close();
})();
