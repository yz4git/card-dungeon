const state={handLeft:0,handTop:0,focusUid:null,keyboardFocus:false,lastTurn:null,queued:false,scrollLockUntil:0,pendingHand:null};
const fx=document.getElementById('fx');
const screen=document.getElementById('screen');
const app=document.getElementById('app');

function snapshotHand(hand=document.querySelector('.hand-scroll')){
  if(!hand)return null;
  return {left:hand.scrollLeft,top:hand.scrollTop,uid:state.focusUid,keyboard:state.keyboardFocus};
}
function rememberHand(hand=document.querySelector('.hand-scroll')){
  if(!hand)return;
  state.handLeft=hand.scrollLeft;
  state.handTop=hand.scrollTop;
}
function restoreHand(snapshot=null){
  const hand=document.querySelector('.hand-scroll');
  if(!hand)return;
  const source=snapshot||state.pendingHand||{left:state.handLeft,top:state.handTop};
  const maxLeft=Math.max(0,hand.scrollWidth-hand.clientWidth);
  const maxTop=Math.max(0,hand.scrollHeight-hand.clientHeight);
  const left=Math.min(Math.max(0,source.left||0),maxLeft);
  const top=Math.min(Math.max(0,source.top||0),maxTop);
  hand.scrollLeft=left;hand.scrollTop=top;
  state.handLeft=left;state.handTop=top;
  if((source.keyboard??state.keyboardFocus)&&(source.uid||state.focusUid)){
    const uid=source.uid||state.focusUid;
    const card=[...hand.querySelectorAll('.game-card[data-uid]')].find(item=>item.dataset.uid===uid);
    if(card)card.focus({preventScroll:true});
  }
  updateScrollCue(hand);
}
function lockHandPosition(hand){
  if(!hand)return;
  rememberHand(hand);
  state.pendingHand={left:hand.scrollLeft,top:hand.scrollTop,uid:state.focusUid,keyboard:state.keyboardFocus};
  state.scrollLockUntil=performance.now()+420;
  const snap={...state.pendingHand};
  requestAnimationFrame(()=>restoreHand(snap));
  setTimeout(()=>restoreHand(snap),0);
  setTimeout(()=>{restoreHand(snap);if(performance.now()>=state.scrollLockUntil)state.pendingHand=null;},80);
  setTimeout(()=>{restoreHand(snap);state.pendingHand=null;},220);
}

function updateScrollCue(hand=document.querySelector('.hand-scroll')){
  if(!hand)return;
  let cue=hand.querySelector(':scope > .hand-scroll-cue');
  const overflow=hand.scrollHeight>hand.clientHeight+6 || hand.scrollWidth>hand.clientWidth+6;
  const moreDown=hand.scrollTop<hand.scrollHeight-hand.clientHeight-5;
  const moreSide=hand.scrollLeft<hand.scrollWidth-hand.clientWidth-5;
  if(!overflow){cue?.remove();return;}
  if(!cue){cue=document.createElement('div');cue.className='hand-scroll-cue';hand.append(cue);}
  cue.textContent=(moreDown||moreSide)?'↕ スクロールして他のカードも選べます':'↑ 上にもカードがあります';
  cue.classList.toggle('at-end',!(moreDown||moreSide));
}

function cardType(el){
  if(!el)return 'focus';
  return ['attack','guard','heal','focus'].find(type=>el.classList.contains(type))||'focus';
}
function glyph(type){return ({attack:'↗',guard:'◇',heal:'✚',focus:'◆'})[type]||'◆';}
function numberFrom(text,re){const m=text.match(re);return m?Number(m[1]):0;}

function addFlowRow(flow,actor,card,target,type,result){
  const row=document.createElement('div');row.className=`combat-flow-row ${actor==='あなた'?'player-flow':'enemy-flow'} ${type}`;
  const action=document.createElement('span');action.className='combat-action';
  const who=document.createElement('b');who.textContent=actor;
  const move=document.createElement('span');move.textContent=`${glyph(type)} ${card}`;
  const arrow=document.createElement('i');arrow.textContent='→';
  const to=document.createElement('span');to.textContent=target;
  action.append(who,move,arrow,to);
  const outcome=document.createElement('strong');outcome.className='combat-outcome';outcome.textContent=result;
  row.append(action,outcome);flow.append(row);
}

function center(el){
  if(!el)return null;
  const r=el.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
}
function addBeam(from,to,kind,blocked=false){
  if(!fx||!from||!to)return;
  const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy),a=Math.atan2(dy,dx)*180/Math.PI;
  const beam=document.createElement('div');beam.className=`combat-beam ${kind}${blocked?' blocked':''}`;
  beam.style.left=`${from.x}px`;beam.style.top=`${from.y}px`;beam.style.width=`${d}px`;beam.style.transform=`rotate(${a}deg)`;
  fx.append(beam);
}
function addBurst(point,text,kind,offsetY=0){
  if(!fx||!point)return;
  const burst=document.createElement('div');burst.className=`combat-burst ${kind}`;burst.textContent=text;
  burst.style.left=`${point.x}px`;burst.style.top=`${point.y+offsetY}px`;fx.append(burst);
}
function clearCombatFx(){
  if(!fx)return;
  fx.querySelectorAll('.combat-beam,.combat-burst,.combat-event-overlay').forEach(el=>el.remove());
}
function addCombatBanner(data){
  if(!fx)return;
  const stage=document.querySelector('.battle-stage');
  const r=stage?.getBoundingClientRect();
  if(!r)return;
  const banner=document.createElement('div');banner.className='combat-event-overlay';
  const playerResult=data.enemyDamage>0?`敵に −${data.enemyDamage} HP`:data.enemyBlocked?'敵が BLOCK':data.healPlayer>0?`自分 +${data.healPlayer} HP`:'効果発動';
  const enemyResult=data.playerDamage>0?`あなたに −${data.playerDamage} HP`:data.playerBlocked?'あなたが BLOCK':'効果発動';
  banner.innerHTML=`<div class="combat-event-title">TURN ${data.turn}</div><div class="combat-event-row player-event"><b>あなた</b><span>${glyph(data.playerType)} ${data.playerCard}</span><i>→ 敵</i><strong>${playerResult}</strong></div><div class="combat-event-row enemy-event"><b>敵</b><span>${glyph(data.enemyType)} ${data.enemyCard}</span><i>→ あなた</i><strong>${enemyResult}</strong></div>`;
  banner.style.left=`${r.left+r.width/2}px`;banner.style.top=`${Math.max(r.top+64,r.bottom-108)}px`;banner.style.width=`${Math.max(220,Math.min(440,r.width-18))}px`;
  fx.append(banner);
}
function playCombatFx(data){
  if(!fx)return;
  clearCombatFx();
  const enemyPoint=center(document.querySelector('.battle-enemy'));
  const playerPoint=center(document.querySelector('.player-vitals'));
  const playerAttacked=data.enemyDamage>0||data.playerType==='attack';
  const enemyAttacked=data.playerDamage>0||data.enemyType==='attack';
  addCombatBanner(data);
  if(playerAttacked)addBeam(playerPoint,enemyPoint,'player-to-enemy',data.enemyDamage===0);
  if(enemyAttacked)addBeam(enemyPoint,playerPoint,'enemy-to-player',data.playerDamage===0);
  if(data.enemyDamage>0)addBurst(enemyPoint,`敵 −${data.enemyDamage}`,'damage-enemy');
  else if(data.enemyBlocked)addBurst(enemyPoint,'敵 BLOCK','block-enemy');
  if(data.playerDamage>0)addBurst(playerPoint,`あなた −${data.playerDamage}`,'damage-player');
  else if(data.playerBlocked)addBurst(playerPoint,'あなた BLOCK','block-player');
  if(data.healPlayer>0)addBurst(playerPoint,`あなた +${data.healPlayer}`,'heal-player',38);
  setTimeout(clearCombatFx,1450);
}

function enhanceBattle(){
  restoreHand();
  updateScrollCue();
  const feedback=document.querySelector('.battle-feedback');
  if(!feedback){state.lastTurn=null;return;}
  const label=feedback.querySelector(':scope > .eyebrow')?.textContent?.trim()||'';
  if(!label.startsWith('TURN'))return;
  const heading=feedback.querySelector(':scope > h3')?.textContent?.trim()||'';
  const parts=heading.split(/\s+vs\s+/i);
  if(parts.length<2)return;
  const summary=feedback.querySelector(':scope > p')?.textContent||'';
  const detail=feedback.querySelector(':scope > small')?.textContent||'';
  const enemyDamage=numberFrom(summary,/敵に\s*(\d+)/);
  const playerDamage=numberFrom(summary,/被ダメージ\s*(\d+)/);
  const healPlayer=numberFrom(summary,/回復\s*(\d+)/);
  const details=detail.split(' · ').map(item=>item.trim()).filter(Boolean);
  const playerBlocked=playerDamage===0&&details.includes('攻撃を防いだ');
  const enemyBlocked=enemyDamage===0&&details.includes('敵が攻撃を防いだ');
  const playerType=cardType(document.querySelector('.plan-slot.active'));
  const enemyType=cardType(document.querySelector('.forecast-card.active'));
  if(!feedback.querySelector('.combat-flow')){
    feedback.classList.add('enhanced-feedback');
    const flow=document.createElement('div');flow.className='combat-flow';
    let playerResult=enemyDamage>0?`敵 −${enemyDamage} HP`:enemyBlocked?'敵 BLOCK':'効果発動';
    if(healPlayer>0)playerResult+=` / 自分 +${healPlayer} HP`;
    const enemyResult=playerDamage>0?`あなた −${playerDamage} HP`:playerBlocked?'あなた BLOCK':'効果発動';
    addFlowRow(flow,'あなた',parts[0],'敵',playerType,playerResult);
    addFlowRow(flow,'敵',parts[1],'あなた',enemyType,enemyResult);
    if(detail){const note=document.createElement('div');note.className='combat-note';note.textContent=detail;flow.append(note);}
    feedback.append(flow);
  }
  if(state.lastTurn!==label){
    state.lastTurn=label;
    playCombatFx({turn:label.replace(/\D/g,'')||'',playerCard:parts[0],enemyCard:parts[1],enemyDamage,playerDamage,healPlayer,playerBlocked,enemyBlocked,playerType,enemyType});
  }
}

function neighborCell(cells,cols,currentIndex,facing,side){
  const row=Math.floor(currentIndex/cols),col=currentIndex%cols;
  const vectors={
    '↑':{left:[0,-1],right:[0,1]},
    '→':{left:[-1,0],right:[1,0]},
    '↓':{left:[0,1],right:[0,-1]},
    '←':{left:[1,0],right:[-1,0]}
  };
  const [dr,dc]=(vectors[facing]||vectors['↑'])[side];
  const nr=row+dr,nc=col+dc;
  if(nr<0||nc<0||nc>=cols||nr>=Math.ceil(cells.length/cols))return null;
  return cells[nr*cols+nc]||null;
}
function enhanceSideRoutes(){
  let guide=document.getElementById('side-route-guide');
  if(document.body.dataset.mode!=='explore') {guide?.remove();return;}
  const grid=document.querySelector('.minimap .map-grid');
  if(!grid)return;
  const cells=[...grid.querySelectorAll('.map-cell')],currentIndex=cells.findIndex(c=>c.classList.contains('current'));
  if(currentIndex<0)return;
  const cols=parseInt(grid.style.getPropertyValue('--cols'),10)||1;
  const facing=cells[currentIndex].textContent.trim()||'↑';
  const left=neighborCell(cells,cols,currentIndex,facing,'left');
  const right=neighborCell(cells,cols,currentIndex,facing,'right');
  const isPath=cell=>!!cell?.classList.contains('known');
  if(!guide){guide=document.createElement('div');guide.id='side-route-guide';guide.setAttribute('aria-hidden','true');app?.append(guide);}
  guide.innerHTML=`<div class="side-route left ${isPath(left)?'path':'wall'}"><span class="route-icon">${isPath(left)?'←':'▌'}</span><b>${isPath(left)?'道':'壁'}</b></div><div class="side-route right ${isPath(right)?'path':'wall'}"><b>${isPath(right)?'道':'壁'}</b><span class="route-icon">${isPath(right)?'→':'▐'}</span></div>`;
}

function queueEnhance(){
  if(state.queued)return;state.queued=true;
  requestAnimationFrame(()=>{state.queued=false;enhanceBattle();enhanceSideRoutes();});
}

document.addEventListener('scroll',event=>{
  if(!event.target?.classList?.contains('hand-scroll'))return;
  if(performance.now()<state.scrollLockUntil&&state.pendingHand){restoreHand(state.pendingHand);return;}
  rememberHand(event.target);updateScrollCue(event.target);
},true);
document.addEventListener('pointerdown',event=>{
  const card=event.target.closest?.('.hand-scroll .game-card[data-uid]');
  if(!card)return;
  state.focusUid=card.dataset.uid;state.keyboardFocus=false;lockHandPosition(card.closest('.hand-scroll'));
},true);
document.addEventListener('click',event=>{
  const card=event.target.closest?.('.hand-scroll .game-card[data-uid]');
  if(!card)return;
  state.focusUid=card.dataset.uid;lockHandPosition(card.closest('.hand-scroll'));
},true);
document.addEventListener('keydown',event=>{
  if(event.key!=='Enter'&&event.key!==' ')return;
  const card=document.activeElement?.closest?.('.hand-scroll .game-card[data-uid]');
  if(!card)return;
  state.focusUid=card.dataset.uid;state.keyboardFocus=true;lockHandPosition(card.closest('.hand-scroll'));
},true);

if(screen)new MutationObserver(queueEnhance).observe(screen,{childList:true,subtree:true});
queueEnhance();
