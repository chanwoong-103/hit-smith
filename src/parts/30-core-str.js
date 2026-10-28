/* ═══════════════════════════════════════════════════════════════════
   === CORE (로직) ===
   수식 · 상태 · 저장/복원 · 자체 점검. 렌더 개편(007~011) 동안
   **바이트 단위로 보존**한다. 표시·디자인 작업은 이 구획을 만지지 않는다.
   days.js 출력이 바이트 단위로 같아야 한다는 것이 이 구획의 계약이다.
   ═══════════════════════════════════════════════════════════════════ */
/* ══ 글자 표 (034) ══════════════════════════════════════════════════════════
   화면에 나가는 모든 글자가 여기 있다. **데이터만** — 여기에 로직을 두지 않는다.
   ⚠ 이 표는 CORE 맨 앞에 있지만 «계산»에는 한 글자도 안 쓰인다. `days.js` 는
     하네스에서 CORE 만 돌리는데, 하네스에는 `navigator` 가 없어 LANG 이 'ko' 로
     떨어진다 — 그래서 기본 출력이 034 전과 바이트 동일하다.
   ⚠ `{0}` `{1}` 은 자리표다. 말의 **순서**가 언어마다 다르기 때문에 필요하다
     (ko 「13등급」 ↔ en 「Grade 13」). `t(key, a, b)` 가 순서대로 끼운다.
   ⚠ 모르는 키는 **키 이름 그대로** 돌려준다(빈칸으로 삼키지 않는다). 화면에 점이
     찍힌 영어 키가 보이면 그 자리가 표에서 빠진 것이다 — 검사가 그것을 본다.
   ⚠ 영어 금지어(원칙 7 의 영어판): spin · slot · reel · jackpot · bet · gamble ·
     lucky · casino · payout · win big. 「릴」은 **item** 으로 옮긴다. */
const STR={ko:{
  /* ── 뼈대 ── */
  'doc.title':'Hit Smith — 터져라! 대장간',
  'tab.forge':'제련', 'tab.dungeon':'던전', 'tab.tech':'테크',
  /* ── 부위 ── */
  'part.weapon':'무기','part.head':'모자','part.body':'상의',
  'part.legs':'하의','part.hands':'장갑','part.feet':'신발',
  'wt.melee':'근접','wt.ranged':'원거리',
  /* ── 각인 ── */
  'sp.exec.nm':'처형',  'sp.exec.d':'적 체력 25% 이하에 피해 ×1.8',
  'sp.rage.nm':'광폭',  'sp.rage.d':'내 체력 50% 이하에 피해 ×1.5',
  'sp.regen.nm':'재생', 'sp.regen.d':'초당 최대 체력 2% 회복',
  'sp.pierce.nm':'관통','sp.pierce.d':'맞지 않는 피해 옵션도 절반 적용',
  'sp.label':'각인',
  /* ── 옵션 (`.s` 는 장비 칸에 들어가는 짧은 꼴) ── */
  'opt.crit':'치명타 확률',  'opt.crit.s':'치명',
  'opt.cdmg':'치명타 피해',  'opt.cdmg.s':'치명',
  'opt.aspd':'공격 속도',    'opt.aspd.s':'공격',
  'opt.dbl':'더블 어택',     'opt.dbl.s':'더블',
  'opt.melee':'근접 피해',   'opt.melee.s':'근접',
  'opt.ranged':'원거리 피해','opt.ranged.s':'원거',
  'opt.hp':'체력',          'opt.hp.s':'체력',
  'opt.block':'블록 확률',   'opt.block.s':'블록',
  'opt.leech':'생명력 흡수', 'opt.leech.s':'생명',
  'opt.gold':'골드 획득',    'opt.gold.s':'골드',
  /* ── 테크 ── */
  /* 041 ④ — 한 단계당 증가분이 아니라 **지금 얼마나 좋아졌나 → 다음 단계**를 적는다.
     `.d` 는 다음 단계가 있을 때, `.d1` 은 상한·바닥에 닿아 더 안 변할 때. */
  'tech.spd.nm':'충전 속도',  'tech.spd.d':'주기 {0}초 → {1}초',   'tech.spd.d1':'주기 {0}초',
  'tech.cap.nm':'저장 한도',  'tech.cap.d':'한도 {0} → {1}',       'tech.cap.d1':'한도 {0}',
  'tech.sell.nm':'판매 금액', 'tech.sell.d':'판매가 +{0}% → +{1}%','tech.sell.d1':'판매가 +{0}%',
  'tech.cost.nm':'강화 비용', 'tech.cost.d':'비용 -{0}% → -{1}%',  'tech.cost.d1':'비용 -{0}%',
  'tech.gold.nm':'골드 획득', 'tech.gold.d':'골드 +{0}% → +{1}%',  'tech.gold.d1':'골드 +{0}%',
  'tech.align.nm':'정렬 보정','tech.align.d':'일치 +{0}% → +{1}%', 'tech.align.d1':'일치 +{0}%',
  'tech.title':'테크트리', 'tech.dust':'별가루', 'tech.done':'완료',
  /* ── 주사위 칸 ── */
  'tile.dust':'별가루','tile.gold':'골드','tile.tok':'고정 토큰','tile.chg':'충전 가득',
  'tile.full':'가득',
  /* ── HUD · 제련 ── */
  'ui.wave':'웨이브', 'ui.best':'최고', 'ui.power':'전투력',
  'ui.forge':'제련', 'ui.auto':'자동', 'ui.sort':'정리', 'ui.ascend':'승천',
  'ui.stoke':'화로 지피기 — 충전 가득 + 배속',
  'ad.failed':'광고를 불러오지 못했어요 — 잠시 뒤 다시',
  /* 041 ③ 2차 — 「대기열 가득(10/10·14/14)」이 이 글자가 읽히는 순간이고, 그때 왼쪽
     글자가 한 자리 넓어진다. 그 상태에서 380px 한 줄에 드는 길이로 줄였다(계획 2차 판정).
     짧아져 빠진 말은 `…Tip`(마우스 올림)이 든다 — 폭 0. */
  'ui.autoresLocked':'자동 정리 · 승천 후',
  'ui.autoresLockedTip':'자동 정리는 첫 승천에 열린다',
  /* 047 R1 §2⑦ — 새 키만. 기존 키의 **값은 하나도 안 바꿨다.** */
  'ui.apprentice':'견습생', 'ui.apprenticeTip':'켜 두면 견습생이 박자에 맞춰 대신 두드린다',
  'ui.stokeShort':'지피기', 'ui.tapHint':'두드리기', 'ui.info':'정보',
  'ui.infoTip':'승천 진행 · 자동 판매 · 확률표 · 옵션 상세',
  'ui.forgeLvShort':'Lv',
  'ui.lockTip':'문양 칸을 누르면 고정 토큰으로 그 문양을 붙잡는다',
  'ui.pityTip':'화로압',                  // 047 2차 — 바늘·막대가 든 말의 이름
  /* 047 3차 ③ — 탭은 치기, 고정은 길게 누르기. 옛 `ui.lockTip` 은 **값을 안 바꾸고**
     쓰지 않는다(§2⑦ 「기존 키의 값은 안 바꾼다」 · 안 쓰게 된 키는 제안에 적는다). */
  'ui.tapLockTip':'문양 칸을 누르면 한 번 두드린다 · 길게 누르면 고정 토큰으로 그 문양을 붙잡는다',
  // 049 §2④⑥ — 새 키만. 판정 이름은 사용자가 바꿀 수 있게 키로 둔다(§2⑥).
  'ui.sndTip':'소리 끄고 켜기 — 음악과 효과음을 한 번에',
  'ui.sndMusic':'음악', 'ui.sndSfx':'효과음',
  'judge.perfect':'완벽', 'judge.great':'정확', 'judge.good':'좋음', 'judge.miss':'아쉬움',
  'judge.combo':'×{0}',
  'msg.autoresUnlocked':'자동 정리가 열렸다',
  // 048 §2⑥ — 새 키만. 기존 키 값은 한 글자도 안 바꾼다.
  'msg.apprentice':'견습생이 왔다',
  /* ══ 049 F3 — 화면 글자만 「자동 제련」으로. 코드 이름은 그대로다 ══════════
     사용자: 「견습생이란 단어는 자동으로 두드리는 게 직관적이지 않아서 헷갈린다」.
     ⚠ 기존 키(`ui.apprentice`·`msg.apprentice`)는 **지우지도 바꾸지도 않는다** —
       문서(046·048·DESIGN)가 설계 용어로 쓰고 있고, 지시서 F3 이 그대로 두라고 했다. */
  'ui.autoForge':'자동 제련', 'ui.autoForgeTip':'켜 두면 박자에 맞춰 대신 두드린다',
  'msg.autoForge':'자동 제련이 열렸다',
  /* 1차에서는 en 에 `reel` 을 못 써서 「one symbol」로 썼다(checklist `I_BAN` 이 034 판
     그대로 `reel`·`spin` 을 막았다). 2차 ② 가 그 목록을 원칙 7 에 맞춰 정리했으므로
     en 은 지시서 원문으로 돌아갔다. ko 는 1차 그대로 — 「릴」은 외래어라 쓰지 않는다. */
  'ui.reelTip':'누를 때마다 문양 칸 하나가 선다',
  'gd.play':'시작하기',
  'ui.boost':'1.5배속 {0}분 남음',
  'ui.queue':'대기', 'ui.lockHint':'릴을 눌러 고정',
  'ui.forgeLv':'제련 등급', 'ui.upgrade':'강화', 'ui.gear':'장비',
  'ui.grade':'{0}등급', 'ui.base':'기본 {0}',
  'ui.sortQueue':'대기열 정리', 'ui.sortNow':'정리하기 ({0})',
  'ui.queueFull':'대기 가득 — 정리해야 계속 제련',
  'ui.stat':'전투력 {0} · 웨이브 {1} · ',
  'ui.pityFull':'▣ 임계압 — 다음 제련은 전 릴 정렬',
  'ui.pity':'화로압 {0}/{1}',
  'ui.autosellHd':'이 등급은 대기열을 거치지 않고 바로 판매',
  /* ── 제련 판정문 ── */
  'msg.item':'{0} {1} {2}',
  'msg.autosell':'{0} — 자동 판매 ',
  'msg.pity':'▣ 임계압 정렬 — {0}',
  'msg.match':'◆ {0}연 정렬 — {1}',
  'msg.match2':'◇ 2연 — {0}',
  'msg.sorted.equip':'자동 정리 — {0} 장착',
  'msg.sorted.sold':' · {0} 판매 ',
  'msg.sorted.sell':'자동 정리 — {0} 판매 ',
  /* ── 적 ── */
  'foe.floor':'{0}층 · {1}',
  'foe.melee':'근접 무리','foe.ranged':'원거리 무리','foe.mix':'혼합 무리',
  /* ── 비교 팝업 ── */
  'cmp.worn':'착용 중','cmp.queued':'대기열','cmp.empty':'비어 있음',
  'cmp.delta':'교체 시 전투력','cmp.sell':'판매','cmp.swap':'교체',
  'cmp.equipTry':'교체해서 껴보기','cmp.equip':'장착',
  'cmp.left':'남은 대기','cmp.note':'교체하면 빠진 장비가 맨 앞에 남습니다',
  'cmp.close':'닫기 — 화면 확인',
  /* ── 팝업 ── */
  'pop.odds':'등급 확률표','pop.stats':'옵션 수치 상세','pop.asc':'승천','pop.close':'닫기',
  'odds.base':'기본','odds.three':'3연',
  'odds.title':'{0}등급 {1}%',
  'stats.atk':'공격력','stats.hp':'체력',
  /* ── 승천 ── */
  'asc.capAll':'모든 등급 개방 · 승천까지 제련 ',
  'asc.needWave':'승천까지 ','asc.needWave2':'웨이브',
  'asc.reach':' 도달 필요',
  'asc.curBest':'(현재 최고 {0})',
  'asc.banner':'승천 ★{0} — 수치 ×{1} · 옵션 상한 ×{2}',
  'asc.reels':' · 릴 {0}개',
  'asc.sellAll':'장비 {0}개가 전부 팔리고 제련 등급이 0으로 돌아갑니다.',
  'asc.again':'등급 상한은 다시 5등급부터 — 같은 길을 더 강한 장비로 다시 오릅니다.',
  'asc.gain':' · 기본 수치 ×{0}',
  'asc.gain2':' · 옵션 상한 ×{0} · 대기창 {1}칸',
  'asc.reels2':' · 릴 {0}개 → {1}개',
  'asc.do':'승천한다',
  'asc.confirm':'승천 ★{0}\n\n장비 {1}개가 전부 팔리고 제련 등급이 0으로 돌아갑니다.\n등급 상한은 다시 5등급부터 — 같은 길을 더 강한 장비로 다시 오릅니다.\n\n장비 기본 수치 ×{2}, 옵션 상한 ×{3}, 대기창 {4}칸',
  'asc.confirmReels':'\n릴 {0}개 → {1}개',
  'asc.confirmGo':'\n\n계속할까요?',
  'swap.confirm':'{0}등급을 {1}등급으로 교체합니다.\n{2}등급 낮습니다. 계속할까요?',
  /* ── 강화 안내 ── */
  'up.next':'제련 ','up.next2':' 강화 시 ','up.next3':' 개방',
  'up.canAsc':'승천 가능',
  'up.capAll':'모든 등급 개방 · 세부등급 상승 중 · 제련 ',
  'up.needWave':'승천까지 ','up.needWave2':' 도달 필요 (현재 최고 {0})',
  /* ── 무한의 층 · 주사위 ── */
  'tower.title':'무한의 층','tower.best':'최고 {0}층','tower.unvisited':'미답',
  'tower.floor':'층','tower.floor0':'0층',
  'tower.challenge':'도전 — 오른 층만큼 별가루',
  'tower.reached':'{0}층 도달 — 주사위를 굴리세요',
  'dice.hint':'주사위를 굴려 보상 칸을 정하세요',
  'dice.roll':'굴리기','dice.reroll':'재굴림','dice.claim':'보상 받기',
  'dice.landed':'{0} {1} — 받거나 광고로 다시 굴리기',
  'dice.take':'{0} 받기'
},en:{
  'doc.title':'Hit Smith',
  'tab.forge':'Forge', 'tab.dungeon':'Dungeon', 'tab.tech':'Tech',
  'part.weapon':'Weapon','part.head':'Helm','part.body':'Armor',
  'part.legs':'Greaves','part.hands':'Gloves','part.feet':'Boots',
  'wt.melee':'Melee','wt.ranged':'Ranged',
  'sp.exec.nm':'Execute',  'sp.exec.d':'×1.8 damage below 25% enemy HP',
  'sp.rage.nm':'Frenzy',   'sp.rage.d':'×1.5 damage below 50% own HP',
  'sp.regen.nm':'Regen',   'sp.regen.d':'Restore 2% max HP per second',
  'sp.pierce.nm':'Pierce', 'sp.pierce.d':'Off-type damage stats apply at half',
  'sp.label':'Rune',
  'opt.crit':'Crit chance',  'opt.crit.s':'Crit',
  'opt.cdmg':'Crit damage',  'opt.cdmg.s':'Crit',
  'opt.aspd':'Attack speed', 'opt.aspd.s':'Speed',
  'opt.dbl':'Double strike', 'opt.dbl.s':'Double',
  'opt.melee':'Melee damage','opt.melee.s':'Melee',
  'opt.ranged':'Ranged damage','opt.ranged.s':'Ranged',
  'opt.hp':'Health',         'opt.hp.s':'HP',
  'opt.block':'Block chance','opt.block.s':'Block',
  'opt.leech':'Lifesteal',   'opt.leech.s':'Leech',
  'opt.gold':'Gold gain',    'opt.gold.s':'Gold',
  'tech.spd.nm':'Charge rate', 'tech.spd.d':'Cycle {0}s → {1}s',  'tech.spd.d1':'Cycle {0}s',
  'tech.cap.nm':'Charge cap',  'tech.cap.d':'Cap {0} → {1}',       'tech.cap.d1':'Cap {0}',
  'tech.sell.nm':'Sell price', 'tech.sell.d':'Sell +{0}% → +{1}%', 'tech.sell.d1':'Sell +{0}%',
  'tech.cost.nm':'Upgrade cost','tech.cost.d':'Cost -{0}% → -{1}%','tech.cost.d1':'Cost -{0}%',
  'tech.gold.nm':'Gold gain',  'tech.gold.d':'Gold +{0}% → +{1}%', 'tech.gold.d1':'Gold +{0}%',
  'tech.align.nm':'Match bonus','tech.align.d':'Match +{0}% → +{1}%','tech.align.d1':'Match +{0}%',
  'tech.title':'Tech tree', 'tech.dust':'Stardust', 'tech.done':'Maxed',
  'tile.dust':'Stardust','tile.gold':'Gold','tile.tok':'Lock token','tile.chg':'Full charge',
  'tile.full':'Full',
  'ui.wave':'Wave', 'ui.best':'Best', 'ui.power':'Power',
  'ui.forge':'Forge', 'ui.auto':'Auto', 'ui.sort':'Sort', 'ui.ascend':'Ascend',
  'ui.stoke':'Stoke the forge — full charge + speed',
  'ad.failed':"Couldn't load an ad — try again shortly",
  'ui.autoresLocked':'At 1st Ascend',
  'ui.autoresLockedTip':'Auto-sort unlocks at 1st Ascend',
  'ui.apprentice':'Apprentice', 'ui.apprenticeTip':'Leave it on and the apprentice strikes in time for you',
  'ui.stokeShort':'Stoke', 'ui.tapHint':'Strike', 'ui.info':'Info',
  'ui.infoTip':'Ascend progress · auto-sell · odds · stat detail',
  'ui.forgeLvShort':'Lv',
  'ui.lockTip':'Tap a symbol to lock it with a token',
  'ui.pityTip':'Forge pressure',
  'ui.tapLockTip':'Tap a symbol to strike once · press and hold to lock it with a token',
  // 049 §2④⑥
  'ui.sndTip':'Sound on or off — music and effects together',
  'ui.sndMusic':'Music', 'ui.sndSfx':'Effects',
  'judge.perfect':'Perfect', 'judge.great':'Great', 'judge.good':'Good', 'judge.miss':'Miss',
  'judge.combo':'×{0}',
  'msg.autoresUnlocked':'Auto-sort unlocked',
  // 048 §2⑥ — 새 키만. 원칙 7: slot·bet·jackpot·casino 낱말을 쓰지 않는다(S7).
  'msg.apprentice':'An apprentice joined',
  // 049 F3 — 화면 글자만. 기존 키는 그대로 둔다(설계 용어로 남는다).
  'ui.autoForge':'Auto Forge', 'ui.autoForgeTip':'Strikes for you in time while on',
  'msg.autoForge':'Auto Forge unlocked',
  // 048 2차 ② — 원칙 7 이 릴의 모양·움직임을 열었고 checklist `I_BAN` 에서 `reel`·`spin`
  //   을 뺐다(`slot`·`jackpot`·`bet`·`casino` 는 그대로 막는다). 지시서 §2⑥ 원문으로 되돌린다.
  'ui.reelTip':'Each tap stops one reel',
  'gd.play':'Play',
  'ui.boost':'1.5x speed, {0} min left',
  'ui.queue':'Queue', 'ui.lockHint':'Tap an item to lock',
  'ui.forgeLv':'Forge level', 'ui.upgrade':'Upgrade', 'ui.gear':'Gear',
  'ui.grade':'Grade {0}', 'ui.base':'Base {0}',
  'ui.sortQueue':'Sort queue', 'ui.sortNow':'Sort now ({0})',
  'ui.queueFull':'Queue full — sort it to keep forging',
  'ui.stat':'Power {0} · Wave {1} · ',
  'ui.pityFull':'▣ Critical — next forge matches every item',
  'ui.pity':'Pressure {0}/{1}',
  'ui.autosellHd':'These grades sell at once, skipping the queue',
  'msg.item':'{0} {1} {2}',
  'msg.autosell':'{0} — auto-sold ',
  'msg.pity':'▣ Critical match — {0}',
  'msg.match':'◆ {0} matched — {1}',
  'msg.match2':'◇ 2 matched — {0}',
  'msg.sorted.equip':'Sorted: kept {0}',
  'msg.sorted.sold':' · sold {0} ',
  'msg.sorted.sell':'Sorted: sold {0} ',
  'foe.floor':'Floor {0} · {1}',
  'foe.melee':'Melee pack','foe.ranged':'Ranged pack','foe.mix':'Mixed pack',
  'cmp.worn':'Equipped','cmp.queued':'In queue','cmp.empty':'Empty',
  'cmp.delta':'Power after swap','cmp.sell':'Sell','cmp.swap':'Swap',
  'cmp.equipTry':'Swap and try it','cmp.equip':'Equip',
  'cmp.left':'Queue left','cmp.note':'Swapping leaves the old piece at the front',
  'cmp.close':'Back to forge',
  'pop.odds':'Grade odds','pop.stats':'Stat details','pop.asc':'Ascend','pop.close':'Close',
  'odds.base':'Base','odds.three':'3 matched',
  'odds.title':'Grade {0} {1}%',
  'stats.atk':'Attack','stats.hp':'Health',
  'asc.capAll':'All grades open · Ascend at Forge Lv ',
  'asc.needWave':'Reach wave ','asc.needWave2':'',
  'asc.reach':' to ascend',
  'asc.curBest':'(best {0})',
  'asc.banner':'Ascend ★{0} — stats ×{1} · stat cap ×{2}',
  'asc.reels':' · {0} per forge',
  'asc.sellAll':'All {0} pieces are sold and forge level returns to 0.',
  'asc.again':'Grade cap starts at 5 again — the same climb with stronger gear.',
  'asc.gain':' · base stats ×{0}',
  'asc.gain2':' · stat cap ×{0} · queue {1}',
  'asc.reels2':' · per forge {0} → {1}',
  'asc.do':'Ascend',
  'asc.confirm':'Ascend ★{0}\n\nAll {1} pieces are sold and forge level returns to 0.\nGrade cap starts at 5 again — the same climb with stronger gear.\n\nBase stats ×{2}, stat cap ×{3}, queue {4}',
  'asc.confirmReels':'\nItems per forge {0} → {1}',
  'asc.confirmGo':'\n\nContinue?',
  'swap.confirm':'Swapping grade {0} for grade {1}.\nThat is {2} grades lower. Continue?',
  'up.next':'Forge Lv ','up.next2':' opens ','up.next3':'',
  'up.canAsc':'Ready to ascend',
  'up.capAll':'All grades open · tiers rising · ascend at Forge Lv ',
  'up.needWave':'Reach wave ','up.needWave2':' to ascend (best {0})',
  'tower.title':'Endless Tower','tower.best':'Best floor {0}','tower.unvisited':'Unvisited',
  'tower.floor':'F','tower.floor0':'Floor 0',
  'tower.challenge':'Challenge — stardust by floor reached',
  'tower.reached':'Floor {0} reached — roll the dice',
  'dice.hint':'Roll the dice to pick a reward',
  'dice.roll':'Roll','dice.reroll':'Reroll','dice.claim':'Claim',
  'dice.landed':'{0} {1} — take it, or watch an ad to roll again',
  'dice.take':'Take {0}'
}};
/* 언어는 **기기가 정한다** — 설정 화면을 만들지 않는다(027 이 걷어낸 자리다).
   `?lang=` 은 시험용 덮어쓰기다. `navigator` 가 없는 환경(하네스)은 ko 로 떨어진다
   — `days.js` 기본 출력이 034 전과 바이트 동일해야 하기 때문이다. */
const LANG=(function(){
  try{
    if(typeof location!=='undefined'&&location.search){
      const m=/[?&]lang=(ko|en)/.exec(location.search); if(m) return m[1];
    }
    if(typeof navigator!=='undefined'&&navigator.language)
      return /^ko/i.test(navigator.language)?'ko':'en';
  }catch(e){}
  return 'ko';
})();
// 모르는 키는 키 이름 그대로 나온다 — 빠진 자리를 화면이 스스로 고발하게 둔다.
function t(k){
  const T=STR[LANG]||STR.ko, v=T[k];
  if(v===undefined) return k;
  if(arguments.length<2) return v;
  const a=arguments;
  return v.replace(/\{(\d)\}/g,function(_,i){ const x=a[+i+1]; return x===undefined?'':x; });
}

