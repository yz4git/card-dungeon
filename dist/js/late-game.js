import { SAVE_KEY, CARDS, TYPE, cardStats } from './data.js';
import { recommendDeck, cardUtility, deckSummary, compareCard } from './deck-advisor.js';

const NEW_KEY='card-dungeon-new-uids';
const FLOOR_NAMES={
  6:['THE AZURE VAULTS','蒼晶の回廊'],
  7:['THE BLOOD SCRIPT','血紋の墓域'],
  8:['THE MIRROR PRISON','鏡牢の石窟'],
  9:['THE LAST BELL','終鐘の深殿'],
  10:['THE SEVERED THRONE','断界王座'],
};
let queued=false,applying=false;

function readGame(){
  try{return JSON.parse(localStorage.getItem(SAVE_KEY)||'null');}catch{return null;}
}
function readNew(){
  try{return new Set(JSON.parse(sessionStorage.getItem(NEW_KEY)||'[]'));}catch{return new Set();}
}
function writeNew(ids){
  try{sessionStorage.setItem(NEW_KEY,JSON.stringify([...new Set(ids)]));}catch{}
}
function rememberClaim(){
  const g=readGame(),r=g?.reward;if(!r)return;
  const selected=r.selected.map(uid=>r.cards.find(c=>c.uid===uid)).filter(Boolean);
  const predicted=selected.map((_,i)=>`c${g.nextUid+i}`);
  if(predicted.length)writeNew(predicted);
}
function rememberTreasure(){
  const card=document.querySelector('.treasure-card .game-card[data-uid]');
  if(card)writeNew([...readNew(),card.dataset.uid]);
}
function addBadge(card,label,cls=''){
  if(!card||!label)return;
  let rack=card.querySelector(':scope > .advisor-badges');
  if(!rack){rack=document.createElement('span');rack.className='advisor-badges';card.append(rack);}
  if([...rack.children].some(x=>x.textContent===label))return;
  const chip=document.createElement('i');chip.className=`advisor-badge ${cls}`;chip.textContent=label;rack.append(chip);
}
function rewardInsight(cardEl,card,g){
  if(cardEl.dataset.advised==='1')return;
  cardEl.dataset.advised='1';
  const owned=g.collection.filter(c=>c.key===card.key);
  const equipped=g.deck.map(id=>g.collection.find(c=>c.uid===id)).filter(c=>c?.key===card.key);
  const bestOwned=Math.max(0,...owned.map(c=>c.rank));
  const bestDeck=Math.max(0,...equipped.map(c=>c.rank));
  if(!owned.length)addBadge(cardEl,'NEW','new');
  else if(card.rank>bestOwned)addBadge(cardEl,`自己最高 +${card.rank-bestOwned}`,'upgrade');
  if(card.rank>bestDeck)addBadge(cardEl,bestDeck?`装備比 +${card.rank-bestDeck}`:'未装備','compare');
}
function decorateReward(g){
  const root=document.querySelector('.reward-screen');if(!root||!g.reward)return;
  root.querySelectorAll('.reward-cards .game-card[data-uid]').forEach(el=>{
    const card=g.reward.cards.find(c=>c.uid===el.dataset.uid);if(card)rewardInsight(el,card,g);
  });
  const footer=root.querySelector('.reward-footer');
  const claim=footer?.querySelector('[data-action="claim"]');
  if(footer&&claim&&!footer.querySelector('[data-late-action="claim-deck"]')){
    const b=document.createElement('button');
    b.className='secondary reward-deck-button';b.dataset.lateAction='claim-deck';b.disabled=claim.disabled;
    b.textContent=g.reward.kind==='victory'?'受け取ってデッキ編集':'持ち帰ってデッキ編集';
    claim.before(b);
  }
}
function decorateTreasure(){rememberTreasure();}
function findCard(g,uid){return g.collection.find(c=>c.uid===uid);}
function decorateDeck(g){
  const modal=document.querySelector('.modal.wide-modal');
  const deckGrid=modal?.querySelector('.editor-deck'),reserve=modal?.querySelector('.reserve-grid');
  if(!modal||!deckGrid||!reserve)return;
  const recommended=recommendDeck(g.collection,g.floor),recommendedIds=new Set(recommended.map(c=>c.uid)),newIds=readNew();
  const summary=deckSummary(recommended);
  let panel=modal.querySelector('.deck-advisor');
  if(!panel){
    panel=document.createElement('section');panel.className='deck-advisor';
    const intro=modal.querySelector('.editor-intro');intro?.after(panel);
  }
  panel.innerHTML=`<div><span class="advisor-kicker">SMART BUILD · B${g.floor}F</span><strong>オススメ15枚</strong><small>攻${summary.counts.attack}・防${summary.counts.guard}・回${summary.counts.heal}・強${summary.counts.focus} / 平均R ${summary.averageRank.toFixed(1)}</small></div><button class="secondary advisor-apply" data-late-action="apply-recommended" ${applying?'disabled':''}>${applying?'編成中…':'オススメ編成を適用'}</button>`;
  const selectedEl=deckGrid.querySelector('.game-card.selected');
  const selected=findCard(g,selectedEl?.dataset.uid);
  modal.querySelectorAll('.game-card[data-uid]').forEach(el=>{
    const card=findCard(g,el.dataset.uid);if(!card)return;
    el.classList.toggle('advisor-recommended',recommendedIds.has(card.uid));
    el.classList.toggle('is-new-card',newIds.has(card.uid));
    el.querySelector(':scope > .advisor-badges')?.remove();
    if(newIds.has(card.uid))addBadge(el,'NEW','new');
    if(recommendedIds.has(card.uid))addBadge(el,'推奨','recommended');
    if(selected&&el.closest('.reserve-grid')){
      const delta=compareCard(card,selected,g.floor);
      if(delta>=4)addBadge(el,`交換 +${Math.round(delta)}`,'upgrade');
    }
  });
  const cards=[...reserve.querySelectorAll(':scope > .game-card[data-uid]')];
  cards.sort((a,b)=>cardUtility(findCard(g,b.dataset.uid),g.floor)-cardUtility(findCard(g,a.dataset.uid),g.floor));
  cards.forEach(el=>reserve.append(el));
  let label=modal.querySelector('.advisor-sort-label');
  if(!label){label=document.createElement('span');label.className='advisor-sort-label';label.textContent='おすすめ度の高い順';reserve.before(label);}
}
function decorateFinalBoss(g){
  const isFinal=g?.encounter?.id==='abyss-crown'||g?.battle?.enemy?.id==='abyss-crown';
  document.body.classList.toggle('final-boss-active',!!isFinal);
  if(!isFinal)return;
  const enemy=g.battle?.enemy||g.encounter;
  const turn=g.battle?.turn||0,phase=Math.min(2,Math.floor(turn/5));
  const phaseInfo=enemy.phases?.[phase]||[{name:'鏡界',note:'守りを崩せ'},{name:'断界',note:'刃が加速する'},{name:'終焉',note:'最後の5手'}][phase];
  const target=document.querySelector('.battle-enemy,.encounter-label');
  if(target){
    let badge=target.querySelector('.final-phase-badge');
    if(!badge){badge=document.createElement('div');badge.className='final-phase-badge';target.prepend(badge);}
    badge.innerHTML=`<b>PHASE ${phase+1}</b><span>${phaseInfo.name||''}</span><small>${phaseInfo.note||''}</small>`;
  }
}
function decorateFloor(g){
  for(let i=6;i<=10;i++)document.body.classList.remove(`late-depth-${i}`);
  document.body.classList.toggle('late-depth',g?.floor>=6);
  if(!g||g.floor<6)return;
  const n=Math.min(10,g.floor);document.body.classList.add(`late-depth-${n}`);
  const info=FLOOR_NAMES[n],location=document.querySelector('.explore-screen .location');
  if(info&&location){const eyebrow=location.querySelector('.eyebrow'),h2=location.querySelector('h2');if(eyebrow)eyebrow.textContent=info[0];if(h2)h2.textContent=info[1];}
}
function decorate(){
  const g=readGame();if(!g)return;
  decorateFloor(g);decorateFinalBoss(g);decorateReward(g);decorateTreasure();decorateDeck(g);
}
function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
const sleep=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
async function applyRecommended(){
  if(applying)return;applying=true;decorate();
  try{
    let g=readGame();if(!g)return;
    const target=recommendDeck(g.collection,g.floor),wanted=new Set(target.map(c=>c.uid));
    for(let guard=0;guard<20;guard++){
      g=readGame();if(!g)break;
      const missing=target.find(c=>!g.deck.includes(c.uid));
      if(!missing)break;
      const index=g.deck.findIndex(uid=>!wanted.has(uid));if(index<0)break;
      document.querySelector(`.editor-deck [data-action="deck-slot"][data-index="${index}"]`)?.click();
      await sleep();
      const swap=document.querySelector(`.reserve-grid [data-action="swap"][data-uid="${missing.uid}"]`);
      if(!swap)break;swap.click();await sleep();
    }
  } finally {applying=false;queue();}
}
async function claimThenDeck(){
  rememberClaim();
  const claim=document.querySelector('.reward-footer [data-action="claim"]');if(!claim||claim.disabled)return;
  claim.click();await sleep();await sleep();
  document.querySelector('.explore-controls [data-action="deck"]')?.click();
}

document.addEventListener('click',event=>{
  const el=event.target.closest('[data-late-action],[data-action="claim"]');if(!el)return;
  if(el.dataset.action==='claim'){rememberClaim();return;}
  if(el.dataset.lateAction==='apply-recommended'){event.preventDefault();applyRecommended();}
  if(el.dataset.lateAction==='claim-deck'){event.preventDefault();claimThenDeck();}
});
new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});
window.addEventListener('storage',queue);
queue();
