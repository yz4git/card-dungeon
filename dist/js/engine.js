import { CARDS, STARTER, ENEMIES, BASE_HP, MAX_TURNS, cardStats } from './data.js';

export function rng(seed) {
  let n = seed >>> 0;
  return () => { n += 0x6D2B79F5; let t = n; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function shuffle(items, random) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const DIRS = [[0,-1],[1,0],[0,1],[-1,0]];
export const posKey = (x,z) => `${x},${z}`;
export function generateFloor(floor, seed) {
  const random = rng(seed + floor * 196613);
  const count = Math.min(90, 10 + (floor - 1) * 4);
  const cells = [{x:0,z:0,event:'start',cleared:true,seen:true}];
  const occupied = new Set(['0,0']);
  while (cells.length < count) {
    const base = random() < .58 ? cells[Math.floor(random() * cells.length)] : cells[cells.length - 1];
    const options = shuffle(DIRS, random);
    for (const [dx,dz] of options) {
      const x = base.x+dx, z = base.z+dz, key=posKey(x,z);
      if (occupied.has(key)) continue;
      const neighbors=DIRS.reduce((n,[ax,az])=>n+Number(occupied.has(posKey(x+ax,z+az))),0);
      if(neighbors>2 && random()<.9) continue;
      cells.push({x,z,event:'empty',cleared:false,seen:false}); occupied.add(key); break;
    }
  }
  const lookup = new Map(cells.map(c=>[posKey(c.x,c.z),c]));
  const distances=new Map([['0,0',0]]), queue=[cells[0]];
  for(let i=0;i<queue.length;i++) for(const [dx,dz] of DIRS) {
    const key=posKey(queue[i].x+dx,queue[i].z+dz);
    if(lookup.has(key)&&!distances.has(key)){distances.set(key,distances.get(posKey(queue[i].x,queue[i].z))+1);queue.push(lookup.get(key));}
  }
  const sorted=[...cells].sort((a,b)=>distances.get(posKey(b.x,b.z))-distances.get(posKey(a.x,a.z)));
  const exit=sorted[0]; exit.event=floor%5===0?'boss':'stairs';
  const candidates=shuffle(cells.filter(c=>c!==exit&&distances.get(posKey(c.x,c.z))>1),random);
  const enemyCount=Math.min(candidates.length-2,2+Math.floor(floor/2));
  candidates.slice(0,enemyCount).forEach((c,i)=>{c.event='enemy';c.enemyIndex=(floor===1?0:Math.floor(random()*Math.min(3,1+floor)) );c.enemySeed=seed+floor*7919+i*371;});
  if(candidates[enemyCount]) candidates[enemyCount].event='chest';
  if(candidates[enemyCount+1]) candidates[enemyCount+1].event='spring';
  exit.enemyIndex=3;exit.enemySeed=seed+floor*7103;
  // Guarantee a first encounter in the first corridor, while keeping the starting tile safe.
  if(floor===1){const first=queue[1]; if(first && first!==exit){const existing=cells.find(c=>c.event==='enemy'); if(existing)existing.event='empty';first.event='enemy';first.enemyIndex=0;first.enemySeed=seed+7919;}}
  const firstDir = DIRS.findIndex(([dx,dz])=>occupied.has(posKey(dx,dz)));
  return { floor, seed, cells, position:{x:0,z:0}, facing:Math.max(0,firstDir), steps:0 };
}
export function newGame(seed = (Date.now() ^ Math.floor(Math.random()*1e9)) >>> 0) {
  const collection = STARTER.map((key,i)=>({uid:`c${i+1}`,key,rank:1}));
  return { schema:1, seed, nextUid:16, collection, deck:collection.map(c=>c.uid), maxHp:BASE_HP, hp:BASE_HP, floor:1, bestFloor:1, wins:0, deaths:0, dungeon:generateFloor(1,seed), battle:null, encounter:null, reward:null, mode:'explore', discovered:[], startedAt:Date.now() };
}
export function findCell(game,x=game.dungeon.position.x,z=game.dungeon.position.z){return game.dungeon.cells.find(c=>c.x===x&&c.z===z);}
export function reveal(game){const p=game.dungeon.position;for(const c of game.dungeon.cells)if(Math.abs(c.x-p.x)+Math.abs(c.z-p.z)<=1)c.seen=true;}
export function createEnemy(floor, index, seed) {
  const def=ENEMIES[index], random=rng(seed), rank=Math.min(30,1+Math.floor((floor-1)/3));
  const cards=shuffle(def.deck,random).map((key,i)=>({uid:`e${seed}-${i}`,key,rank:Math.min(30,rank+(floor>2&&random()<.25?1:0))}));
  const hp=def.hp+(floor-1)*5+Math.floor((floor-1)/3)*5;
  return {...def, floor, hp, maxHp:hp, cards, seed};
}
export function fighter(hp, maxHp) {return {hp,maxHp,focus:0,poison:0,poisonTurns:0,regen:0,regenTurns:0};}
export function startBattle(game) {
  if(!game.encounter)throw new Error('No encounter');
  const cards=game.deck.map(uid=>game.collection.find(c=>c.uid===uid));
  if(cards.length!==15 || cards.some(c=>!c) || new Set(game.deck).size!==15)throw new Error('Deck must contain 15 distinct owned cards');
  const enemy=game.encounter;
  game.battle={enemy,player:fighter(game.hp,game.maxHp),opponent:fighter(enemy.hp,enemy.maxHp),cards:cards.map(c=>({...c})),used:[],plan:[null,null,null,null,null],turn:0,log:[],phase:'plan',outcome:null};
  game.mode='battle';
  return game.battle;
}
export function resolveTurn(player,opponent,playerCard,enemyCard) {
  const p={...player}, e={...opponent}, a=cardStats(playerCard), b=cardStats(enemyCard);
  const detail=[];
  function upkeep(f,c,label){
    if(c.cleanse){f.poison=0;f.poisonTurns=0;}
    if(f.poisonTurns>0){f.hp=Math.max(0,f.hp-f.poison);detail.push(`${label}に毒 ${f.poison}`);f.poisonTurns--;if(!f.poisonTurns)f.poison=0;}
    if(f.hp>0&&f.regenTurns>0){f.hp=Math.min(f.maxHp,f.hp+f.regen);f.regenTurns--;if(!f.regenTurns)f.regen=0;}
  }
  upkeep(p,a,'あなた');upkeep(e,b,'敵');
  if(p.hp<=0||e.hp<=0)return{player:p,opponent:e,damageToEnemy:0,damageToPlayer:0,healPlayer:0,healEnemy:0,detail,outcome:p.hp<=0?'defeat':'victory'};
  function damage(c,other,self){
    if(!c.attack)return 0;
    let power=c.attack+self.focus;
    if(c.shatter&&other.type==='guard')power+=c.shatter;
    if(c.ambush&&(other.type==='heal'||other.type==='focus'))power+=c.ambush;
    return Math.max(0,power-(c.pierce?0:other.guard));
  }
  const attackP=damage(a,b,p), attackE=damage(b,a,e);
  const counterP=b.attack?a.counter:0, counterE=a.attack?b.counter:0;
  const damageToEnemy=attackP+counterP, damageToPlayer=attackE+counterE;
  p.hp=Math.max(0,p.hp-damageToPlayer);e.hp=Math.max(0,e.hp-damageToEnemy);
  if(a.attack)p.focus=0;if(b.attack)e.focus=0;
  if(counterP)detail.push(`あなたの反撃 ${counterP}`);
  if(counterE)detail.push(`敵の反撃 ${counterE}`);
  if(a.attack&&!attackP)detail.push('敵が攻撃を防いだ');
  if(b.attack&&!attackE)detail.push('攻撃を防いだ');
  if(a.pierce&&b.guard)detail.push('敵の防御を貫通');
  const beforeP=p.hp,beforeE=e.hp;
  function finish(self,other,c,dealt){
    if(self.hp<=0)return;
    self.hp=Math.min(self.maxHp,self.hp+c.heal+(c.drain?Math.ceil(dealt/2):0));
    self.focus=Math.min(100,self.focus+c.focus);
    if(c.regen){self.regen=c.regen;self.regenTurns=3;}
    if(c.poison&&dealt>0&&other.hp>0){other.poison=Math.max(other.poison,c.poison);other.poisonTurns=3;}
  }
  finish(p,e,a,attackP);finish(e,p,b,attackE);
  return {player:p,opponent:e,damageToEnemy,damageToPlayer,healPlayer:p.hp-beforeP,healEnemy:e.hp-beforeE,detail,outcome:p.hp<=0?'defeat':e.hp<=0?'victory':null};
}
export function executePlannedTurn(battle) {
  if(battle.outcome)throw new Error('Battle already ended');
  const step=battle.turn%5, uid=battle.plan[step];
  if(!uid||battle.used.includes(uid))throw new Error('Invalid or already used card');
  const card=battle.cards.find(c=>c.uid===uid),enemyCard=battle.enemy.cards[battle.turn];
  if(!card||!enemyCard)throw new Error('Missing card');
  const r=resolveTurn(battle.player,battle.opponent,card,enemyCard);
  battle.player=r.player;battle.opponent=r.opponent;battle.used.push(uid);battle.turn++;
  battle.log.push({turn:battle.turn,playerCard:card,enemyCard,...r});
  if(r.outcome)battle.outcome=r.outcome;
  else if(battle.turn>=MAX_TURNS){battle.outcome='defeat';battle.timedOut=true;}
  if(battle.turn%5===0&&!battle.outcome){battle.plan=[null,null,null,null,null];battle.phase='plan';}
  return r;
}
export function finishBattle(game) {
  const b=game.battle;if(!b?.outcome)return;
  game.hp=b.player.hp;
  const victory=b.outcome==='victory';
  game.reward={kind:victory?'victory':'defeat',cards:b.enemy.cards.map(c=>({...c})),selected:[],max:victory?3:1,enemy:b.enemy.name,timedOut:!!b.timedOut};
  if(victory){game.wins++;const c=findCell(game);c.cleared=true;if(c.event==='boss')c.event='stairs';}
  game.mode='reward';
}
export function claimReward(game) {
  const reward=game.reward;
  if(!reward)throw new Error('No reward');
  const selected=reward.selected;
  if(new Set(selected).size!==selected.length||selected.length>reward.max||selected.some(uid=>!reward.cards.some(c=>c.uid===uid)))throw new Error('Invalid reward selection');
  if(reward.kind==='defeat'&&selected.length!==1)throw new Error('Choose one card');
  for(const uid of selected){const card=reward.cards.find(c=>c.uid===uid);game.collection.push({key:card.key,rank:card.rank,uid:`c${game.nextUid++}`});}
  if(reward.kind==='defeat'){
    game.deaths++;game.floor=1;game.maxHp=BASE_HP;game.hp=BASE_HP;game.seed=(game.seed+104729)>>>0;game.dungeon=generateFloor(1,game.seed);
  } else if(reward.kind==='victory') game.hp=Math.min(game.maxHp,game.hp+Math.ceil(game.maxHp*.2));
  game.reward=null;game.battle=null;game.encounter=null;game.mode='explore';reveal(game);
}
export function descend(game){
  const c=findCell(game);if(c.event!=='stairs')throw new Error('No stairs');
  game.floor++;game.bestFloor=Math.max(game.bestFloor,game.floor);game.maxHp=BASE_HP+Math.min(80,(game.floor-1)*3);game.hp=Math.min(game.maxHp,game.hp+Math.ceil(game.maxHp*.35));game.dungeon=generateFloor(game.floor,game.seed);game.encounter=null;reveal(game);
}
export function move(game,direction=1){
  if(game.mode!=='explore')return{moved:false};
  const [dx,dz]=DIRS[game.dungeon.facing],p=game.dungeon.position;
  const c=findCell(game,p.x+dx*direction,p.z+dz*direction);
  if(!c)return{moved:false,wall:true};
  game.dungeon.position={x:c.x,z:c.z};game.dungeon.steps++;c.seen=true;reveal(game);
  if(!c.cleared&&(c.event==='enemy'||c.event==='boss')){game.encounter=createEnemy(game.floor,c.enemyIndex,c.enemySeed);game.mode='encounter';}
  return{moved:true,cell:c};
}
export function chestReward(game){
  const c=findCell(game);if(c.event!=='chest'||c.cleared)return false;
  const random=rng(game.seed+game.floor*1009+c.x*31+c.z*71);
  const keys=game.floor<3?['pierce','parry','drain','ward','ambush','remedy']:Object.keys(CARDS);
  const key=keys[Math.floor(random()*keys.length)];
  const card={uid:`c${game.nextUid++}`,key,rank:Math.min(30,1+Math.floor(game.floor/3))};game.collection.push(card);c.cleared=true;return card;
}
export function validSave(raw){
  const integer=(v,min=0,max=1e9)=>Number.isInteger(v)&&v>=min&&v<=max;
  const card=c=>c&&CARDS[c.key]&&typeof c.uid==='string'&&/^c\d+$|^e\d+-\d+$/.test(c.uid)&&integer(c.rank,1,30);
  const combatant=f=>f&&integer(f.maxHp,1,1e6)&&integer(f.hp,0,f.maxHp)&&integer(f.focus,0,100)&&integer(f.poison,0,100)&&integer(f.poisonTurns,0,3)&&integer(f.regen,0,100)&&integer(f.regenTurns,0,3);
  const enemy=e=>e&&ENEMIES.some(d=>d.id===e.id)&&integer(e.sprite,0,3)&&Array.isArray(e.cards)&&e.cards.length===15&&e.cards.every(card)&&new Set(e.cards.map(c=>c.uid)).size===15&&integer(e.hp,1,1e6)&&integer(e.maxHp,1,1e6);
  if(!raw||raw.schema!==1||!Array.isArray(raw.collection)||!Array.isArray(raw.deck)||raw.deck.length!==15)return false;
  if(raw.collection.length>15000||!raw.collection.every(card))return false;
  if(new Set(raw.collection.map(c=>c.uid)).size!==raw.collection.length||new Set(raw.deck).size!==15||raw.deck.some(id=>!raw.collection.some(c=>c.uid===id)))return false;
  if(!integer(raw.floor,1,10000)||!integer(raw.bestFloor,raw.floor,10000)||!integer(raw.wins)||!integer(raw.deaths)||!integer(raw.seed,0,4294967295)||!integer(raw.nextUid,16)||!integer(raw.hp,0,raw.maxHp)||!integer(raw.maxHp,1,1000))return false;
  if(raw.collection.some(c=>!/^c\d+$/.test(c.uid)||Number(c.uid.slice(1))>=raw.nextUid))return false;
  const d=raw.dungeon;
  if(!d||!Array.isArray(d.cells)||d.cells.length<2||d.cells.length>90||!d.position||!Number.isInteger(d.facing)||d.facing<0||d.facing>3)return false;
  if(d.cells.some(c=>!Number.isInteger(c.x)||Math.abs(c.x)>100||!Number.isInteger(c.z)||Math.abs(c.z)>100||!['start','empty','enemy','boss','chest','spring','stairs'].includes(c.event))||!d.cells.some(c=>c.x===d.position.x&&c.z===d.position.z))return false;
  if(d.floor!==raw.floor||!integer(d.steps)||new Set(d.cells.map(c=>posKey(c.x,c.z))).size!==d.cells.length)return false;
  if(d.cells.some(c=>['enemy','boss'].includes(c.event)&&(!integer(c.enemyIndex,0,3)||!integer(c.enemySeed,0,1e12))))return false;
  if(!['explore','encounter','battle','reward'].includes(raw.mode))return false;
  if((raw.mode==='encounter'||raw.mode==='battle')&&!enemy(raw.encounter))return false;
  if(raw.mode==='battle'){
    const b=raw.battle;
    if(!b||b.cards?.length!==15||!b.cards.every(card)||!enemy(b.enemy)||!combatant(b.player)||!combatant(b.opponent)||!integer(b.turn,0,15)||!Array.isArray(b.log)||b.log.length!==b.turn||!Array.isArray(b.used)||b.used.length!==b.turn||new Set(b.used).size!==b.turn||!Array.isArray(b.plan)||b.plan.length!==5)return false;
    if(!['plan','resolve','ended'].includes(b.phase)||![null,'victory','defeat'].includes(b.outcome)||b.cards.some(c=>!raw.deck.includes(c.uid))||new Set(b.cards.map(c=>c.uid)).size!==15)return false;
    if(b.used.some(id=>!b.cards.some(c=>c.uid===id))||b.plan.some(id=>id!==null&&!b.cards.some(c=>c.uid===id))||new Set(b.plan.filter(Boolean)).size!==b.plan.filter(Boolean).length)return false;
    if(b.phase==='resolve'&&(b.plan.some(id=>!id)||!integer(b.windowStart,0,10)||b.windowStart%5!==0||b.turn<b.windowStart||b.turn>=b.windowStart+5))return false;
    if(b.phase==='plan'&&(b.turn%5!==0||b.turn>=15||b.plan.some(id=>b.used.includes(id))))return false;
    if(b.log.some(l=>!card(l.playerCard)||!card(l.enemyCard)||!Array.isArray(l.detail)||l.detail.some(t=>typeof t!=='string')))return false;
  }
  if(raw.mode==='reward'){
    const r=raw.reward;if(!r||!['victory','defeat'].includes(r.kind)||!Array.isArray(r.cards)||r.cards.length!==15||!r.cards.every(card)||!Array.isArray(r.selected)||r.max!==(r.kind==='victory'?3:1)||r.selected.length>r.max||new Set(r.selected).size!==r.selected.length||r.selected.some(id=>!r.cards.some(c=>c.uid===id)))return false;
  }
  return true;
}
