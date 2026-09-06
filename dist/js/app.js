import { VERSION,SAVE_KEY,TYPE,CARDS,ENEMIES,cardStats,cardEffect,mainValue,shortEffect } from './data.js';
import { newGame,findCell,reveal,startBattle,executePlannedTurn,finishBattle,claimReward,descend,move,chestReward,validSave } from './engine.js';
import { GameAudio } from './audio.js';

const $=s=>document.querySelector(s), screen=$('#screen'), hud=$('#hud'), modalRoot=$('#modal-root');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let game=null,saved=null,world=null,modal=null,slot=0,deckSlot=0,deckFilter='all',speed=1,timer=null,moveLock=0,toastTimer=null,focusReturn=null,storageFailed=false;
const audio=new GameAudio();
try{const raw=JSON.parse(localStorage.getItem(SAVE_KEY));if(validSave(raw))saved=raw;}catch{}
const hpbar=(hp,max,enemy=false)=>`<div class="health ${enemy?'enemy-health':''}"><div class="health-label"><span>${enemy?'ENEMY':'あなた'}</span><strong>${hp}<small> / ${max}</small></strong></div><div class="health-track"><i style="width:${Math.max(0,Math.min(100,hp/max*100))}%"></i></div></div>`;
const btn=(label,action,cls='',attrs='')=>`<button class="${cls}" data-action="${action}" ${attrs}>${label}</button>`;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2700);}
function save(){if(!game)return;try{localStorage.setItem(SAVE_KEY,JSON.stringify(game));saved=JSON.parse(JSON.stringify(game));}catch{if(!storageFailed){storageFailed=true;toast('このブラウザでは保存できません。メニューからデータを書き出せます。');}}}
function renderHud(){
  const mode=game?.mode||'title';
  hud.innerHTML=`<button class="brand" data-action="${game?'pause':'help'}" aria-label="${game?'メニュー':'遊び方'}"><span class="brand-mark">◈</span><span>CARD DUNGEON<small>先見の迷宮</small></span></button>${game?`<div class="floor-status"><span>DEPTH</span><b>B${game.floor}<small>F</small></b></div>`:''}<div class="hud-actions">${btn(audio.enabled?'♪ ON':'♪ OFF','sound','icon-button',`aria-label="効果音 ${audio.enabled?'オン':'オフ'}"`)}${btn(game?'Ⅱ':'? ',game?'pause':'help','icon-button',`aria-label="${game?'メニュー':'遊び方'}"`)}</div>`;
  document.body.dataset.mode=mode;
}
function render(){
  renderHud();
  if(!game)renderTitle();
  else if(game.mode==='explore')renderExplore();
  else if(game.mode==='encounter')renderEncounter();
  else if(game.mode==='battle')renderBattle();
  else if(game.mode==='reward')renderReward();
  if(world){if(game)world.sync(game);}
}
function renderTitle(){
  screen.innerHTML=`<section class="title-screen"><div class="title-copy"><p class="eyebrow">FIFTEEN CARDS. FIVE FUTURES.</p><h1><span>CARD</span><span>DUNGEON</span></h1><p class="title-ja">先 見 の 迷 宮</p><div class="title-line"></div><p class="title-promise">敵の5手は、すでに見えている。</p><p class="title-desc">15枚の選択で、運命を覆せ。</p></div><div class="start-panel">${saved?`<p class="continue-meta">到達 B${saved.bestFloor}F <span>·</span> 所持 ${saved.collection.length}枚</p>${btn(`探索をつづける <span> B${saved.floor}F　→</span>`,'continue','primary start-button')}${btn('新しい記録ではじめる','new','text-button')}`:btn('迷宮へ入る <span>→</span>','new','primary start-button')}<div class="title-bottom">${btn('遊び方','help','text-button')}<span>15枚のデッキ / 5手先読み / 3D迷宮</span></div></div><span class="version">v${VERSION}</span></section>`;
}
function mapHTML(big=false){
  const d=game.dungeon,seen=d.cells.filter(c=>c.seen),minX=Math.min(...d.cells.map(c=>c.x)),maxX=Math.max(...d.cells.map(c=>c.x)),minZ=Math.min(...d.cells.map(c=>c.z)),maxZ=Math.max(...d.cells.map(c=>c.z));
  const cols=maxX-minX+1,rows=maxZ-minZ+1;
  let content='';
  for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){
    const c=seen.find(c=>c.x===x&&c.z===z),current=d.position.x===x&&d.position.z===z;
    const event=c&&!c.cleared?c.event:c?.event==='stairs'?'stairs':'';
    let glyph=current?['↑','→','↓','←'][d.facing]:({enemy:'×',boss:'×',chest:'◇',spring:'+',stairs:'»'}[event]||'');
    content+=`<span class="map-cell ${c?'known':'unknown'} ${current?'current':''} ${event}" title="${current?'現在地':event}">${glyph}</span>`;
  }
  return `<div class="map-grid ${big?'big-map':''}" style="--cols:${cols};--rows:${rows}">${content}</div>`;
}
function currentPrompt(){
  const c=findCell(game);
  if(c.event==='stairs')return{title:'下り階段',body:`この先は B${game.floor+1}F。降りるとHPが35%回復。`,action:'descend',label:`B${game.floor+1}Fへ降りる ↓`};
  if(c.event==='chest'&&!c.cleared)return{title:'忘れられた宝箱',body:'誰かが遺した、まだ見ぬ一枚。',action:'chest',label:'宝箱を開ける ◇'};
  if(c.event==='spring'&&!c.cleared)return{title:'静寂の泉',body:'この泉では一度だけHPが40%回復。',action:'spring',label:'泉で休む ✚'};
  return{title:game.dungeon.steps===0?'迷宮の入口':`第${game.floor}層を探索中`,body:game.dungeon.steps===0?'前へ進み、最初の敵と向き合おう。':'地図を頼りに、下り階段を探そう。'};
}
function renderExplore(){
  const prompt=currentPrompt();
  screen.innerHTML=`<section class="explore-screen"><div class="explore-top"><div class="location"><span class="eyebrow">${game.floor%5===0?'THE WARDEN’S KEEP':'THE FORGOTTEN HALLS'}</span><h2>${['忘却の回廊','灯影の地下墓地','封印の石窟','沈黙の深殿','王の眠る層'][(game.floor-1)%5]}</h2><p>${game.dungeon.cells.filter(c=>c.seen).length} / ${game.dungeon.cells.length} マス発見</p></div><button class="minimap" data-action="map" aria-label="地図を拡大">${mapHTML()}<span>MAP</span></button></div><div class="explore-bottom"><div class="tile-prompt"><p class="eyebrow">${prompt.title}</p><p>${prompt.body}</p>${prompt.action?btn(prompt.label,prompt.action,'primary tile-action'):''}</div><div class="explore-vitals">${hpbar(game.hp,game.maxHp)}<div class="deck-summary"><b>15<span> CARDS</span></b><small>所持 ${game.collection.length}枚</small></div></div><div class="explore-controls"><div class="control-side">${btn('<span>▤</span>デッキ','deck','utility-button')}</div><div class="dpad"><span></span>${btn('↑','forward','move-button','aria-label="前に進む"')}<span></span>${btn('↶','left','move-button','aria-label="左を向く"')}${btn('↓','back','move-button','aria-label="後ろに進む"')}${btn('↷','right','move-button','aria-label="右を向く"')}</div><div class="control-side"><span class="compass">${['N','E','S','W'][game.dungeon.facing]}</span><small>矢印 / WASD</small></div></div></div></section>`;
}
function portrait(index,cls=''){return `<div class="portrait portrait-${index} ${cls}" role="img" aria-label="${ENEMIES[index].name}"></div>`;}
function renderEncounter(){
  const e=game.encounter;
  screen.innerHTML=`<section class="encounter-screen"><div class="encounter-stage"><div class="encounter-label"><span class="eyebrow">ENCOUNTER · RANK ${e.cards[0].rank}</span><h2>${escape(e.name)}</h2><p>${escape(e.flavor)}</p></div>${portrait(e.sprite,'fallback-portrait')}<div class="encounter-health">${hpbar(e.hp,e.maxHp,true)}</div></div><div class="encounter-panel"><span class="eyebrow">THE NEXT FIVE TURNS</span><h3>敵の最初の5手</h3><div class="forecast encounter-forecast">${e.cards.slice(0,5).map((c,i)=>forecastCard(c,i+1)).join('')}</div><p class="enemy-hint">${escape(e.hint)}</p><div class="encounter-rules"><span><b>15</b> 枚を1回ずつ</span><span><b>5</b> 手まとめて配置</span><span><b>15</b> ターン以内に撃破</span></div><div class="encounter-player">${hpbar(game.hp,game.maxHp)}<span>装備中 <b>15 / 15</b> 枚</span></div><div class="encounter-actions">${btn('デッキを編集','deck','secondary')}${btn('戦闘をはじめる →','fight','primary')}</div><p class="fine-print">勝利で敵のカードを最大3枚獲得。敗北でも1枚は持ち帰れる。</p></div></section>`;
}
function forecastCard(card,turn,active=false,done=false){const c=cardStats(card);return `<div class="forecast-card ${c.type} ${active?'active':''} ${done?'resolved':''}"><span class="turn-label">${String(turn).padStart(2,'0')}</span><strong>${c.name}</strong><span class="forecast-value">${TYPE[c.type].glyph} ${mainValue(c)}</span><small>${shortEffect(c)}</small></div>`;}
function statusText(f){return [f.focus?`次撃 +${f.focus}`:'',f.poisonTurns?`毒 ${f.poison} · ${f.poisonTurns}手`:'',f.regenTurns?`再生 ${f.regen} · ${f.regenTurns}手`:''].filter(Boolean).join(' / ')||'状態変化なし';}
function miniCard(card,{action='card',selected=false,used=false,extra='',attrs=''}={}){
  const c=cardStats(card);
  return `<button class="game-card ${c.type} ${selected?'selected':''} ${used?'used':''}" data-action="${action}" data-uid="${escape(card.uid)}" aria-label="${c.name} ランク${c.rank} ${cardEffect(card)}${selected?' 選択中':''}" ${selected?'aria-pressed="true"':''} ${used?'disabled':''} ${attrs}><div class="card-top"><span>${TYPE[c.type].name}</span><span class="rank">${'ⅠⅡⅢⅣⅤ'[c.rank-1]||c.rank}</span></div><strong>${c.name}</strong><div class="card-power"><span>${TYPE[c.type].glyph}</span>${mainValue(c)}</div><small>${shortEffect(c)}</small>${extra}</button>`;
}
function renderBattle(){
  const b=game.battle, resolving=b.phase==='resolve'||b.phase==='ended';
  const start=Math.min(10,b.phase==='resolve'||b.phase==='ended'?Math.floor(Math.max(0,b.turn-(b.turn%5===0?1:0))/5)*5:Math.floor(b.turn/5)*5);
  // Before the first turn in a new window, keep that window's cards visible.
  const windowStart=b.windowStart??start;
  const base=b.phase==='plan'?Math.floor(b.turn/5)*5:windowStart;
  const filled=b.plan.filter(Boolean).length,last=b.log.at(-1),step=resolving?Math.min(4,Math.max(0,b.turn-base-1)):-1;
  const selectable=b.cards.filter(c=>!b.used.includes(c.uid));
  const planPrompt=resolving?'カードは自動で進みます':filled===5&&slot<0?'5手の配置完了 · 入れ替える手を上の1〜5から選択':`${slot+1}手目を選択中 · 下のカードをタップ`;
  screen.innerHTML=`<section class="battle-layout"><div class="battle-stage"><div class="battle-enemy"><span class="eyebrow">${escape(b.enemy.title)}</span><h2>${escape(b.enemy.name)}</h2>${hpbar(b.opponent.hp,b.opponent.maxHp,true)}<p class="status-line">${statusText(b.opponent)}</p></div>${portrait(b.enemy.sprite,'fallback-portrait')}<div class="battle-feedback" aria-live="polite">${last&&resolving?`<span class="eyebrow">TURN ${String(last.turn).padStart(2,'0')}</span><h3>${CARDS[last.playerCard.key].name}<span> vs </span>${CARDS[last.enemyCard.key].name}</h3><p>${last.damageToEnemy?`敵に <b>${last.damageToEnemy}</b>`:'敵へのダメージ 0'}<span> / </span>${last.damageToPlayer?`被ダメージ <b>${last.damageToPlayer}</b>`:'被ダメージ 0'}${last.healPlayer?` / 回復 <b>${last.healPlayer}</b>`:''}</p><small>${last.detail.map(escape).join(' · ')||'次の一手へ'}</small>`:`<span class="eyebrow">READ. PLACE. RESOLVE.</span><p>敵の予告に、あなたの答えを。</p>`}</div><div class="player-vitals">${hpbar(b.player.hp,b.player.maxHp)}<p class="status-line">${statusText(b.player)}</p></div></div><div class="battle-panel"><div class="battle-heading"><div><span class="eyebrow">${resolving?'RESOLVING':'PLAN YOUR ANSWER'}</span><h3>${resolving?'運命が動き出す':'次の5手を組み立てる'}</h3></div><div class="turn-count"><b>${Math.min(15,b.turn+1)}</b><span>/ 15 手</span></div></div><div class="forecast-label"><span>敵の予告</span><span>${base+1}–${base+5}手</span></div><div class="forecast">${b.enemy.cards.slice(base,base+5).map((c,i)=>forecastCard(c,base+i+1,resolving&&i===step,i+base<b.turn)).join('')}</div><div class="plan-label"><span>あなたの5手</span><small>${planPrompt}</small></div><div class="plan-slots">${b.plan.map((uid,i)=>{
    const c=uid?b.cards.find(c=>c.uid===uid):null,s=c?cardStats(c):null;
    return `<button class="plan-slot ${s?.type||''} ${!resolving&&i===slot?'target':''} ${resolving&&i===step?'active':''} ${i+base<b.turn?'resolved':''}" data-action="slot" data-index="${i}" ${resolving?'disabled':''} aria-label="${i+1}手目 ${s?.name||'未配置'}"><span class="slot-number">${i+base+1}</span>${s?`<strong>${s.name}</strong><span>${TYPE[s.type].glyph} ${mainValue(s)}</span>`:`<span class="empty-slot">＋</span><small>セット</small>`}</button>`;
  }).join('')}</div><div class="hand-label"><span>使用できるカード <b>${selectable.length}</b></span>${resolving?btn(`速度 ×${speed}`,'speed','text-button'):btn('配置をクリア','clear','text-button',filled?'':'disabled')}</div><div class="hand-scroll ${resolving?'playback-hand':''}"><div class="hand-grid">${selectable.map(c=>miniCard(c,{selected:b.plan.includes(c.uid),attrs:resolving?'disabled':'',extra:b.plan.includes(c.uid)?`<span class="assigned-badge compact-assigned" aria-label="${base+b.plan.indexOf(c.uid)+1}手目">${['①','②','③','④','⑤'][b.plan.indexOf(c.uid)]}</span>`:''})).join('')}</div>${resolving&&selectable.length===0?'<p class="empty-note">15枚すべてを使い切りました。</p>':''}</div><div class="battle-bottom"><div class="battle-hint">${resolving?`<span class="pulse-dot"></span> ${b.outcome?(b.outcome==='victory'?'勝利。カードを回収中…':'決着。持ち帰る1枚を選ぼう。'):'配置した順番で解決中'}`:filled===5?'5手の配置完了。入れ替える場合は上の1〜5手目を選択。':`空いている手にあと${5-filled}枚配置してください。`}</div>${btn(resolving?'5手を進行中…':`5手を実行 <span>${filled} / 5　→</span>`,'resolve','primary resolve-button',resolving||filled!==5?'disabled':'')}</div></div></section>`;
}
function renderReward(){
  const r=game.reward,victory=r.kind==='victory';
  screen.innerHTML=`<section class="reward-screen"><div class="reward-heading"><span class="eyebrow">${victory?'VICTORY · CLAIM YOUR CARDS':'DEFEAT · BRING ONE MEMORY HOME'}</span><h2>${victory?'未来を、切りひらいた。':'この一枚が、次の希望。'}</h2><p>${victory?`${escape(r.enemy)}のデッキから、好きなカードを最大3枚。`:`${r.timedOut?'15ターン以内に倒せなかった。':'あなたのHPが尽きた。'} 敵のカードを1枚選んで持ち帰ろう。`}</p></div><div class="reward-toolbar"><span>敵が持っていた15枚</span><b>選択 ${r.selected.length} / ${r.max}</b></div><div class="reward-cards">${r.cards.map(c=>miniCard(c,{action:'loot',selected:r.selected.includes(c.uid),extra:r.selected.includes(c.uid)?'<span class="assigned-badge">獲得する ✓</span>':''})).join('')}</div><div class="reward-footer"><p>${victory?'勝利の休息：HPが20%回復。獲得カードはデッキ編集で装備できます。':'所持カードとデッキをすべて保持し、HP全快でB1Fへ戻ります。'}</p>${btn(victory?`${r.selected.length}枚受け取って探索へ →`:'1枚持ち帰って再挑戦 →','claim','primary',!victory&&r.selected.length!==1?'disabled':'')}</div></section>`;
}
function begin(){game=newGame();reveal(game);slot=0;save();render();world?.sync(game,true);audio.play('start');openModal('intro');}
function continueGame(){game=JSON.parse(JSON.stringify(saved));const openSlot=game.battle?.plan?.findIndex(x=>!x);slot=openSlot==null?0:openSlot;if(game.mode==='battle'&&game.battle.outcome){finishBattle(game);save();}render();world?.sync(game,true);if(game.mode==='battle'&&game.battle.phase==='resolve')scheduleTurn();audio.play('start');}
function placeCard(uid){
  const b=game?.battle;if(!b||b.phase!=='plan'||b.used.includes(uid))return;
  if(slot<0){toast('入れ替える手を上の1〜5から選んでください。');return;}
  const existing=b.plan.indexOf(uid);
  if(existing===slot){b.plan[slot]=null;}
  else {
    if(existing>=0)b.plan[existing]=b.plan[slot];
    b.plan[slot]=uid;
    const nextAfter=b.plan.findIndex((v,i)=>!v&&i>slot),nextAny=b.plan.findIndex(v=>!v);
    slot=nextAfter>=0?nextAfter:nextAny;
  }
  audio.play('place');save();renderBattle();
}
function startResolve(){
  const b=game?.battle;if(!b||b.phase!=='plan'||b.plan.some(x=>!x)||new Set(b.plan).size!==5)return;
  b.phase='resolve';b.windowStart=b.turn;save();renderBattle();audio.play('start');scheduleTurn(450);
}
function scheduleTurn(delay=1050/speed){
  clearTimeout(timer);if(!game||game.mode!=='battle'||modal||document.hidden)return;
  const b=game.battle;
  if(b.outcome){timer=setTimeout(()=>{if(game?.battle===b){finishBattle(game);save();render();audio.play(b.outcome==='victory'?'victory':'defeat');}},700/speed);return;}
  if(b.pendingWindowAdvance){
    timer=setTimeout(()=>{
      if(modal||document.hidden||game?.battle!==b)return;
      b.pendingWindowAdvance=false;b.phase='plan';b.plan=[null,null,null,null,null];slot=0;delete b.windowStart;
      save();renderBattle();toast('次の5手が見えた。残ったカードで組み立てよう。');
    },delay);return;
  }
  if(b.phase!=='resolve')return;
  timer=setTimeout(()=>{
    if(modal||document.hidden||game?.battle!==b)return;
    const closesWindow=b.turn%5===4,planSnapshot=closesWindow?[...b.plan]:null,windowStart=b.windowStart;
    const r=executePlannedTurn(b);game.hp=b.player.hp;
    if(b.outcome)b.phase='ended';
    if(!b.outcome&&b.phase==='plan'&&planSnapshot){
      b.phase='resolve';b.plan=planSnapshot;b.windowStart=windowStart;b.pendingWindowAdvance=true;
    }
    audio.play(r.damageToPlayer||r.damageToEnemy?'attack':r.healPlayer?'heal':'guard');world?.impact('enemy',r.damageToEnemy);world?.impact('player',r.damageToPlayer);
    $('#fx').className=r.damageToPlayer?'hurt':r.healPlayer?'healed':'blocked';setTimeout(()=>$('#fx').className='',280);
    save();renderBattle();scheduleTurn();
  },delay);
}
function movePlayer(action){
  if(game?.mode!=='explore'||modal||performance.now()<moveLock)return;
  moveLock=performance.now()+180;
  if(action==='left'||action==='right'){game.dungeon.facing=(game.dungeon.facing+(action==='left'?3:1))%4;audio.play('step');}
  else {const r=move(game,action==='back'?-1:1);if(!r.moved){audio.play('wall');toast('この先は壁です。左右を向いて道を探そう。');return;}audio.play('step');}
  save();render();
}
function openModal(type,options={}){
  clearTimeout(timer);focusReturn=document.activeElement;modal={type,...options};renderModal();requestAnimationFrame(()=>modalRoot.querySelector('button,input')?.focus());
}
function closeModal(){modal=null;modalRoot.innerHTML='';focusReturn?.focus?.();if(game?.mode==='battle')scheduleTurn();}
function renderModal(){
  if(!modal){modalRoot.innerHTML='';return;}
  let body='',title='',wide=false,footer='';
  if(modal.type==='help'||modal.type==='intro'){
    title=modal.type==='intro'?'5手先が見える、あなたへ':'遊び方';
    body=`<div class="help-steps"><div><b>01</b><p><strong>敵の5手を読む</strong>敵が何をするか、先にすべて見えます。</p></div><div><b>02</b><p><strong>あなたの5枚を配置する</strong>上の枠を選び、下のカードをタップ。5枚そろったら実行。</p></div><div><b>03</b><p><strong>15ターン以内に倒す</strong>各カードは1回限り。5手の自動進行が終わると、次の配置へ。</p></div></div><div class="matchup-guide"><p><span class="guard-ink">◇ 防御・反撃</span> → 敵の攻撃に合わせる</p><p><span class="attack-ink">↗ 貫通・盾砕き</span> → 敵の防御に合わせる</p><p><span class="heal-ink">✚ 回復・強化</span> → 敵の攻撃がない手に</p></div><p class="help-note">両者の攻撃は同時。HPが0になると回復できません。毒は次の3手の開始時に発動し、清め・解毒で解除できます。</p><p class="help-note">勝てば敵のカードを最大3枚、負けても1枚獲得。敗北時は所持カードを持ったままB1Fへ。戦闘前に「デッキ」から15枚を交換できます。</p>`;
    footer=btn(modal.type==='intro'?'迷宮を歩きはじめる →':'わかった','close-modal','primary');
  } else if(modal.type==='deck'){
    title='15枚のデッキ';wide=true;
    const equipped=game.deck.map(id=>game.collection.find(c=>c.uid===id));
    const reserve=game.collection.filter(c=>!game.deck.includes(c.uid)&&(deckFilter==='all'||CARDS[c.key].type===deckFilter)).sort((a,b)=>b.rank-a.rank||CARDS[a.key].name.localeCompare(CARDS[b.key].name));
    body=`<p class="editor-intro">交換するデッキの1枚を選び、下の所持カードをタップ。</p><div class="editor-section-label"><b>装備中　15 / 15</b><span>交換する枠 ${deckSlot+1}</span></div><div class="editor-deck">${equipped.map((c,i)=>miniCard(c,{action:'deck-slot',selected:i===deckSlot,attrs:`data-index="${i}"`})).join('')}</div><div class="editor-section-label"><b>予備のカード　${game.collection.length-15}枚</b><span>デッキ外</span></div><div class="filters">${['all','attack','guard','heal','focus'].map(t=>btn(t==='all'?'すべて':TYPE[t].name,'filter',deckFilter===t?'active':'',`data-filter="${t}"`)).join('')}</div><div class="reserve-grid">${reserve.length?reserve.map(c=>miniCard(c,{action:'swap'})).join(''):'<p class="empty-note">ここに予備のカードが並びます。<br>敵を倒すか、宝箱を開けて集めよう。</p>'}</div>`;
    footer=btn('この15枚で戻る →','close-modal','primary');
  } else if(modal.type==='map'){
    title=`B${game.floor}Fの地図`;
    body=`<div class="map-wrap">${mapHTML(true)}</div><div class="map-legend"><span>↑ 現在地</span><span>× 敵</span><span>◇ 宝箱</span><span>+ 泉</span><span>» 下り階段</span></div><p class="help-note">通った場所と隣接する道が記録されます。<br>発見 ${game.dungeon.cells.filter(c=>c.seen).length} / ${game.dungeon.cells.length}マス</p>`;
    footer=btn('探索へ戻る','close-modal','primary');
  } else if(modal.type==='pause'){
    title='探索の記録';
    body=`<div class="record-grid"><div><span>最高到達</span><b>B${game.bestFloor}F</b></div><div><span>勝利</span><b>${game.wins}</b></div><div><span>所持カード</span><b>${game.collection.length}</b></div><div><span>再挑戦</span><b>${game.deaths}</b></div></div><p class="help-note">${storageFailed?'自動保存が利用できません。データを書き出して保管してください。':'この端末に自動保存されています。戦闘中の配置・進行も続きから再開できます。'}</p><div class="menu-buttons">${btn('遊び方','help','secondary')}${btn('カード効果一覧','codex','secondary')}${btn('セーブを書き出す','export','secondary')}${btn('セーブを読み込む','import','secondary')}${btn('保存してタイトルへ','title','secondary')}</div><input id="import-file" type="file" accept="application/json,.json" hidden>`;
    footer=btn('ゲームへ戻る','close-modal','primary');
  } else if(modal.type==='codex'){
    title='カードの効果';
    body=`<div class="codex">${Object.entries(CARDS).map(([key,c])=>`<div class="codex-row ${c.type}"><span class="codex-symbol">${TYPE[c.type].glyph}</span><div><strong>${c.name}</strong><p>${cardEffect({key,rank:1})} · ${c.detail}</p></div></div>`).join('')}</div><p class="help-note">上記はランクⅠの数値です。深層で獲得する高ランクのカードは、威力や回復量が上がります。</p>`;
    footer=btn('戻る','close-modal','primary');
  } else if(modal.type==='confirm-new'){
    title='新しい記録ではじめる？';body='<p>現在の探索・所持カード・到達記録をリセットし、最初の15枚からはじめます。</p>';footer=btn('戻る','close-modal','secondary')+btn('新しい記録ではじめる','confirm-new','primary');
  } else if(modal.type==='treasure'){
    title='新しい一枚を手に入れた';body=`<div class="treasure-card">${miniCard(modal.card,{action:'none'})}</div><p class="help-note">${CARDS[modal.card.key].detail}<br>デッキ編集で、装備中のカードと交換できます。</p>`;footer=btn('デッキを編集','deck','secondary')+btn('探索をつづける','close-modal','primary');
  }
  modalRoot.innerHTML=`<div class="modal-backdrop"><section class="modal ${wide?'wide-modal':''}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h2 id="modal-title">${title}</h2>${btn('×','close-modal','icon-button','aria-label="閉じる"')}</div><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></section></div>`;
}
function exportSave(){save();const blob=new Blob([JSON.stringify(game,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`card-dungeon-B${game.floor}F.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);toast('探索の記録を書き出しました。');}
async function importSave(file){
  if(!file)return;
  try{if(file.size>5000000)throw new Error();const parsed=JSON.parse(await file.text());if(!validSave(parsed))throw new Error();clearTimeout(timer);game=parsed;saved=parsed;closeModal();save();if(game.mode==='battle'&&game.battle.outcome)finishBattle(game);render();world?.sync(game,true);if(game.mode==='battle'&&game.battle.phase==='resolve')scheduleTurn();toast('探索の記録を読み込みました。');}catch{toast('このファイルは読み込めません。カードダンジョンのセーブを選んでください。');}
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;const a=button.dataset.action;
  audio.unlock();
  if(['forward','back','left','right'].includes(a)){movePlayer(a);return;}
  if(a==='sound'){audio.toggle();renderHud();return;}
  if(a==='help'){openModal('help');return;}
  if(a==='close-modal'){closeModal();return;}
  if(a==='new'){if(saved)openModal('confirm-new');else begin();return;}
  if(a==='confirm-new'){closeModal();begin();return;}
  if(a==='continue'){continueGame();return;}
  if(a==='pause'){if(game)openModal('pause');return;}
  if(a==='title'){save();closeModal();clearTimeout(timer);game=null;render();world?.title();return;}
  if(a==='codex'){openModal('codex');return;}
  if(a==='export'){exportSave();return;}
  if(a==='import'){$('#import-file').click();return;}
  if(a==='deck'){if(game&&['explore','encounter'].includes(game.mode)){deckSlot=0;deckFilter='all';openModal('deck');}return;}
  if(a==='map'){openModal('map');return;}
  if(a==='deck-slot'){deckSlot=Number(button.dataset.index);renderModal();return;}
  if(a==='filter'){deckFilter=button.dataset.filter;renderModal();return;}
  if(a==='swap'){
    const uid=button.dataset.uid;if(game.deck.includes(uid)||!game.collection.some(c=>c.uid===uid))return;
    game.deck[deckSlot]=uid;save();audio.play('place');renderModal();toast(`${CARDS[game.collection.find(c=>c.uid===uid).key].name}をデッキに装備しました。`);return;
  }
  if(a==='fight'){startBattle(game);slot=0;save();render();audio.play('start');return;}
  if(a==='slot'){slot=Number(button.dataset.index);renderBattle();return;}
  if(a==='card'){placeCard(button.dataset.uid);return;}
  if(a==='clear'){game.battle.plan=[null,null,null,null,null];slot=0;save();renderBattle();return;}
  if(a==='resolve'){startResolve();return;}
  if(a==='speed'){speed=speed===1?2:1;renderBattle();return;}
  if(a==='loot'){
    const r=game.reward,uid=button.dataset.uid,i=r.selected.indexOf(uid);
    if(i>=0)r.selected.splice(i,1);else if(r.selected.length<r.max)r.selected.push(uid);else{toast(`選べるのは${r.max}枚まで。選択済みをタップすると外せます。`);return;}
    audio.play('place');save();renderReward();return;
  }
  if(a==='claim'){const isDefeat=game.reward.kind==='defeat',n=game.reward.selected.length;claimReward(game);save();world?.build(game.dungeon);render();world?.sync(game,true);toast(isDefeat?'新たな迷宮へ。持ち帰ったカードをデッキに加えよう。':`${n}枚を獲得。HPが20%回復しました。`);return;}
  if(a==='descend'){descend(game);save();render();world?.sync(game,true);audio.play('start');toast(`B${game.floor}Fへ。迷宮が広がり、HPが35%回復しました。`);return;}
  if(a==='chest'){const card=chestReward(game);if(card){save();render();audio.play('victory');openModal('treasure',{card});}return;}
  if(a==='spring'){const c=findCell(game);if(c.event==='spring'&&!c.cleared){const prev=game.hp;game.hp=Math.min(game.maxHp,game.hp+Math.ceil(game.maxHp*.4));c.cleared=true;save();render();audio.play('heal');toast(`泉で休み、HPが${game.hp-prev}回復しました。`);}return;}
});
document.addEventListener('change',e=>{if(e.target.id==='import-file')importSave(e.target.files[0]);});
document.addEventListener('keydown',e=>{
  if(modal){
    if(e.key==='Escape'){e.preventDefault();closeModal();}
    if(e.key==='Tab'){const items=[...modalRoot.querySelectorAll('button:not([disabled]),input:not([hidden])')];if(!items.length)return;const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    return;
  }
  const key=e.key.toLowerCase(),actions={arrowup:'forward',w:'forward',arrowdown:'back',s:'back',arrowleft:'left',a:'left',arrowright:'right',d:'right'};
  if(game?.mode==='explore'&&actions[key]){e.preventDefault();movePlayer(actions[key]);}
  if(e.key==='Escape'&&game){e.preventDefault();openModal('pause');}
  if(game?.mode==='battle'&&game.battle.phase==='plan'&&/^[1-5]$/.test(key)){slot=Number(key)-1;renderBattle();}
});
document.addEventListener('visibilitychange',()=>{save();if(document.hidden)clearTimeout(timer);else if(game?.mode==='battle'&&!modal)scheduleTurn();});
window.addEventListener('pagehide',save);
// Prevent Safari gesture zoom on the game controls without disabling readable text zoom.
document.addEventListener('gesturestart',e=>{if(!modal)e.preventDefault();},{passive:false});
render();
import('./scene.js').then(({DungeonView})=>{world=new DungeonView($('#world'),()=>document.body.classList.add('fallback-mode'));if(game)world.sync(game,true);else world.title();}).catch(()=>{document.body.classList.add('fallback-mode');toast('3D表示を読み込めませんでした。カードバトルは続けられます。');});
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
