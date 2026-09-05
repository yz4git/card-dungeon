import assert from 'node:assert/strict';
import { CARDS, cardStats } from '../dist/js/data.js';
import { newGame, findCell, DIRS, posKey, reveal, startBattle, executePlannedTurn, finishBattle, claimReward, descend, move, chestReward, resolveTurn } from '../dist/js/engine.js';

const fmt = n => Number(n).toFixed(1);

function cardScore(card){
  const c=cardStats(card);
  let s=c.attack*1.18+c.guard*.72+c.heal*1.02+c.focus*.65+c.counter*1.08+c.poison*2.4+c.regen*2.15;
  if(c.pierce)s+=8;if(c.shatter)s+=5;if(c.ambush)s+=4;if(c.drain)s+=5;if(c.cleanse)s+=5;
  return s;
}

function optimizeDeck(game){
  const all=[...game.collection].sort((a,b)=>cardScore(b)-cardScore(a)||b.rank-a.rank);
  const picks=[], used=new Set();
  const take=(type,count)=>{
    for(const c of all){
      if(picks.length>=15||count<=0)break;
      if(used.has(c.uid)||CARDS[c.key].type!==type)continue;
      picks.push(c);used.add(c.uid);count--;
    }
  };
  take('attack',7);take('guard',4);take('heal',3);take('focus',1);
  for(const c of all){if(picks.length>=15)break;if(!used.has(c.uid)){picks.push(c);used.add(c.uid);}}
  assert.equal(picks.length,15,'optimized deck must contain 15 cards');
  game.deck=picks.map(c=>c.uid);
}

function battleStateScore(player,opponent,outcome,initialEnemyHp){
  if(outcome==='victory')return 1e9+player.hp*100;
  if(outcome==='defeat')return -1e9+opponent.hp;
  return (initialEnemyHp-opponent.hp)*14 + player.hp*6 - opponent.hp*5 + player.focus*.45 + player.regenTurns*3 - player.poisonTurns*7 + opponent.poisonTurns*5;
}

function planWindow(battle,beamWidth=160){
  const available=battle.cards.filter(c=>!battle.used.includes(c.uid));
  const startTurn=battle.turn;
  let beam=[{player:battle.player,opponent:battle.opponent,seq:[],used:new Set(),score:0,outcome:null}];
  for(let step=0;step<5;step++){
    const enemyCard=battle.enemy.cards[startTurn+step];
    if(!enemyCard)break;
    const next=[];
    for(const st of beam){
      if(st.outcome){next.push(st);continue;}
      for(const card of available){
        if(st.used.has(card.uid))continue;
        const r=resolveTurn(st.player,st.opponent,card,enemyCard);
        const used=new Set(st.used);used.add(card.uid);
        let score=battleStateScore(r.player,r.opponent,r.outcome,battle.opponent.maxHp);
        // Small tie-breaker: avoid spending high-value cards when the same state can be reached cheaply.
        score-=cardScore(card)*.015;
        next.push({player:r.player,opponent:r.opponent,seq:[...st.seq,card.uid],used,score,outcome:r.outcome});
      }
    }
    next.sort((a,b)=>b.score-a.score);
    beam=next.slice(0,beamWidth);
  }
  const best=beam[0];
  if(!best||best.seq.length===0)throw new Error('planner produced no cards');
  // If battle ended inside the look-ahead, fill the remaining plan slots with any unused cards;
  // executePlannedTurn stops as soon as outcome is set.
  const seq=[...best.seq];
  for(const c of available){if(seq.length>=5)break;if(!seq.includes(c.uid))seq.push(c.uid);}
  return seq.slice(0,5);
}

function playBattle(game,{beamWidth=160,editDeck=true}={}){
  const beforeHp=game.hp;
  const enemyName=game.encounter.name;
  const floor=game.floor;
  if(editDeck)optimizeDeck(game);
  startBattle(game);
  const b=game.battle;
  const windows=[];
  while(!b.outcome){
    if(b.phase!=='plan')throw new Error(`unexpected battle phase ${b.phase}`);
    const plan=planWindow(b,beamWidth);
    windows.push(plan.map(uid=>CARDS[b.cards.find(c=>c.uid===uid).key].name));
    b.plan=plan;b.phase='resolve';b.windowStart=b.turn;
    while(b.phase==='resolve'&&!b.outcome){
      const r=executePlannedTurn(b);game.hp=b.player.hp;
      if(r.outcome)break;
    }
  }
  const turns=b.turn,outcome=b.outcome,afterCombatHp=b.player.hp;
  finishBattle(game);
  const reward=game.reward;
  const sorted=[...reward.cards].sort((a,b)=>cardScore(b)-cardScore(a)||b.rank-a.rank);
  reward.selected=sorted.slice(0,reward.kind==='victory'?3:1).map(c=>c.uid);
  claimReward(game);
  if(editDeck)optimizeDeck(game);
  return {floor,enemyName,outcome,turns,beforeHp,afterCombatHp,afterClaimHp:game.hp,windows};
}

function cellMap(game){return new Map(game.dungeon.cells.map(c=>[posKey(c.x,c.z),c]));}
function route(game,target){
  const map=cellMap(game),start=posKey(game.dungeon.position.x,game.dungeon.position.z),goal=posKey(target.x,target.z);
  const dist=new Map([[start,0]]),prev=new Map(),open=[[0,start]];
  while(open.length){
    open.sort((a,b)=>a[0]-b[0]);
    const [d,key]=open.shift();if(d!==dist.get(key))continue;if(key===goal)break;
    const [x,z]=key.split(',').map(Number);
    for(const [dx,dz] of DIRS){
      const nk=posKey(x+dx,z+dz),cell=map.get(nk);if(!cell)continue;
      const hostile=!cell.cleared&&(cell.event==='enemy'||cell.event==='boss');
      const nd=d+1+(hostile?4:0);
      if(nd<(dist.get(nk)??Infinity)){dist.set(nk,nd);prev.set(nk,key);open.push([nd,nk]);}
    }
  }
  if(!dist.has(goal))throw new Error('no route');
  const keys=[];let k=goal;while(k!==start){keys.push(k);k=prev.get(k);}keys.reverse();
  return keys.map(k=>map.get(k));
}

function walkTo(game,target,opts,stats){
  const path=route(game,target);
  for(const next of path){
    const p=game.dungeon.position,dx=next.x-p.x,dz=next.z-p.z;
    const dir=DIRS.findIndex(([x,z])=>x===dx&&z===dz);assert(dir>=0);
    game.dungeon.facing=dir;
    const r=move(game,1);assert(r.moved);stats.steps++;
    if(game.mode==='encounter'){
      const battle=playBattle(game,opts);stats.battles.push(battle);
      if(battle.outcome==='defeat')return false;
    }
  }
  return true;
}

function useSpring(game,stats){
  const c=findCell(game);if(c.event!=='spring'||c.cleared)return;
  const before=game.hp;game.hp=Math.min(game.maxHp,game.hp+Math.ceil(game.maxHp*.4));c.cleared=true;
  stats.springHeal+=game.hp-before;
}

function playFloor(game,opts,stats){
  const floor=game.floor,visit={floor,startHp:game.hp,maxHp:game.maxHp,steps0:stats.steps,battles0:stats.battles.length,chest:false,spring:false,endHp:null};
  const chest=game.dungeon.cells.find(c=>c.event==='chest'&&!c.cleared);
  if(chest){if(!walkTo(game,chest,opts,stats))return {defeat:true,visit};if(game.floor!==floor)return {defeat:true,visit};const got=chestReward(game);if(got){visit.chest=true;if(opts.editDeck)optimizeDeck(game);}}
  const spring=game.dungeon.cells.find(c=>c.event==='spring'&&!c.cleared);
  // Exercise the floor resource and simulate a player preserving it until useful.
  if(spring && (game.hp<game.maxHp*.88 || floor%5===0)){
    if(!walkTo(game,spring,opts,stats))return {defeat:true,visit};if(game.floor!==floor)return {defeat:true,visit};useSpring(game,stats);visit.spring=true;
  }
  let exit=game.dungeon.cells.find(c=>c.event==='stairs'||c.event==='boss');
  if(!walkTo(game,exit,opts,stats))return {defeat:true,visit};if(game.floor!==floor)return {defeat:true,visit};
  // Boss becomes stairs after victory.
  exit=findCell(game);
  if(exit.event!=='stairs')throw new Error(`floor ${floor}: exit did not become stairs (${exit.event})`);
  visit.endHp=game.hp;visit.steps=stats.steps-visit.steps0;visit.battles=stats.battles.length-visit.battles0;
  if(floor<10)descend(game);
  stats.floorVisits.push(visit);
  return {defeat:false,visit,completed:floor===10};
}

function run(seed,{editDeck=true,beamWidth=160,maxDeaths=0,detailed=false}={}){
  const game=newGame(seed);reveal(game);if(editDeck)optimizeDeck(game);
  const stats={seed,editDeck,beamWidth,steps:0,battles:[],floorVisits:[],springHeal:0,deaths:0,success:false,bestFloor:1};
  let safety=0;
  while(safety++<80){
    stats.bestFloor=Math.max(stats.bestFloor,game.floor);
    const result=playFloor(game,{editDeck,beamWidth},stats);
    if(result.completed){stats.success=true;stats.bestFloor=10;break;}
    if(result.defeat){
      stats.deaths++;stats.bestFloor=Math.max(stats.bestFloor,game.bestFloor);
      if(stats.deaths>maxDeaths)break;
      if(editDeck)optimizeDeck(game);
      continue;
    }
  }
  stats.finalFloor=game.floor;stats.collection=game.collection.length;stats.wins=game.wins;
  if(detailed){
    console.log(`\nDETAILED seed=${seed} editDeck=${editDeck} success=${stats.success} deaths=${stats.deaths} best=B${stats.bestFloor}F`);
    for(const f of stats.floorVisits){
      console.log(`B${f.floor}F  HP ${f.startHp}/${f.maxHp} -> ${f.endHp}/${f.maxHp}  steps=${f.steps} battles=${f.battles} chest=${f.chest?'Y':'N'} spring=${f.spring?'Y':'N'}`);
      for(const b of stats.battles.filter(x=>x.floor===f.floor)) console.log(`  - ${b.enemyName}: ${b.outcome} ${b.turns}T HP ${b.beforeHp}->${b.afterCombatHp}->${b.afterClaimHp}`);
    }
  }
  return stats;
}

function aggregate(label,runs){
  const success=runs.filter(r=>r.success).length;
  const deaths=runs.map(r=>r.deaths),battles=runs.map(r=>r.battles.length),steps=runs.map(r=>r.steps),best=runs.map(r=>r.bestFloor);
  const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
  console.log(`\n${label}`);
  console.log(`  success B10: ${success}/${runs.length} (${fmt(success/runs.length*100)}%)`);
  console.log(`  avg best floor: ${fmt(avg(best))}`);
  console.log(`  avg deaths: ${fmt(avg(deaths))} / avg battles: ${fmt(avg(battles))} / avg movement steps: ${fmt(avg(steps))}`);
  const floorReach=Array.from({length:10},(_,i)=>runs.filter(r=>r.bestFloor>=i+1).length);
  console.log(`  reach: ${floorReach.map((n,i)=>`B${i+1}:${n}/${runs.length}`).join(' ')}`);
}

console.log('=== CARD DUNGEON B10 PLAYCHECK ===');
const detail=run(20260905,{editDeck:true,beamWidth:320,maxDeaths:5,detailed:true});
const skilled=[];for(let seed=1001;seed<=1020;seed++)skilled.push(run(seed,{editDeck:true,beamWidth:90,maxDeaths:0}));
aggregate('20 seeds / skilled planning + deck editing / first life only',skilled);
const persistent=[];for(let seed=2001;seed<=2012;seed++)persistent.push(run(seed,{editDeck:true,beamWidth:90,maxDeaths:5}));
aggregate('12 seeds / skilled planning + deck editing / up to 5 deaths',persistent);
const noEdit=[];for(let seed=3001;seed<=3012;seed++)noEdit.push(run(seed,{editDeck:false,beamWidth:90,maxDeaths:0}));
aggregate('12 seeds / skilled planning / starter deck never edited / first life only',noEdit);

// Structural assertions for the playcheck itself.
assert(detail.bestFloor>=5,'detailed run should at least exercise first boss tier');
assert(skilled.every(r=>r.battles.length>0),'every run should fight');
console.log('\nPLAYCHECK_COMPLETE');
