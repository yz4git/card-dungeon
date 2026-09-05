import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, cardStats } from '../dist/js/data.js';
import { generateFloor,newGame,DIRS,posKey,rng,shuffle,createEnemy,fighter,resolveTurn,startBattle,executePlannedTurn,finishBattle,claimReward,descend,move,reveal,findCell,validSave } from '../dist/js/engine.js';

const card=(key,rank=1,uid=key)=>({uid,key,rank});
test('1F has ten connected irregular tiles, a reachable exit, and a safe entrance',()=>{
  for(let seed=0;seed<100;seed++)for(const floor of [1,2,5,10,25]){
    const d=generateFloor(floor,seed),set=new Set(d.cells.map(c=>posKey(c.x,c.z))),visited=new Set(['0,0']),queue=[[0,0]];
    for(let i=0;i<queue.length;i++)for(const [dx,dz]of DIRS){const x=queue[i][0]+dx,z=queue[i][1]+dz,k=posKey(x,z);if(set.has(k)&&!visited.has(k)){visited.add(k);queue.push([x,z]);}}
    assert.equal(d.cells.length,Math.min(90,10+(floor-1)*4));assert.equal(visited.size,d.cells.length);assert.equal(set.size,d.cells.length);
    assert.equal(d.cells.filter(c=>c.event===(floor%5===0?'boss':'stairs')).length,1);assert.equal(d.cells[0].event,'start');
    if(floor===1){const [dx,dz]=DIRS[d.facing];assert.equal(d.cells.find(c=>c.x===dx&&c.z===dz).event,'enemy');}
  }
});
test('generation is reproducible and different seeds make different layouts',()=>{
  assert.deepEqual(generateFloor(4,99),generateFloor(4,99));assert.notDeepEqual(generateFloor(4,99).cells,generateFloor(4,100).cells);
});
test('block, counter, piercing, shield-break, and ambush have distinct outcomes',()=>{
  const p=fighter(64,64),e=fighter(50,50);
  let r=resolveTurn(p,e,card('guard'),card('slash'));assert.equal(r.damageToPlayer,0);
  r=resolveTurn(p,e,card('parry'),card('cleave'));assert.equal(r.damageToPlayer,7);assert.equal(r.damageToEnemy,8);
  r=resolveTurn(p,e,card('pierce'),card('bastion'));assert.equal(r.damageToEnemy,9);
  r=resolveTurn(p,e,card('rupture'),card('guard'));assert.equal(r.damageToEnemy,8);
  r=resolveTurn(p,e,card('ambush'),card('heal'));assert.equal(r.damageToEnemy,17);
  assert.equal(p.hp,64);assert.equal(e.hp,50,'resolution does not mutate input snapshots');
});
test('poison ticks for three future turns, never immediately, and cleansing happens first',()=>{
  let r=resolveTurn(fighter(64,64),fighter(50,50),card('venom'),card('focus'));
  assert.equal(r.opponent.hp,45);assert.equal(r.opponent.poisonTurns,3);
  for(let i=0;i<3;i++){r=resolveTurn(r.player,r.opponent,card('guard'),card('guard'));assert.equal(r.opponent.hp,43-i*2);}
  assert.equal(r.opponent.poison,0);
  const poisoned={...fighter(1,64),poison:4,poisonTurns:3};
  const clean=resolveTurn(poisoned,fighter(50,50),card('remedy'),card('guard'));
  assert.equal(clean.player.hp,9);assert.equal(clean.player.poisonTurns,0);assert.equal(clean.outcome,null);
});
test('healing cannot resurrect; simultaneous lethal damage is a defeat',()=>{
  let r=resolveTurn(fighter(5,64),fighter(30,30),card('heal'),card('slash'));assert.equal(r.player.hp,0);assert.equal(r.outcome,'defeat');
  r=resolveTurn(fighter(5,64),fighter(5,30),card('slash'),card('slash'));assert.equal(r.opponent.hp,0);assert.equal(r.outcome,'defeat');
});
test('focus persists through guard and is consumed by the next attack only',()=>{
  let r=resolveTurn(fighter(64,64),fighter(50,50),card('focus'),card('guard'));
  r=resolveTurn(r.player,r.opponent,card('guard'),card('guard'));assert.equal(r.player.focus,7);
  r=resolveTurn(r.player,r.opponent,card('slash'),card('heal'));assert.equal(r.damageToEnemy,17);assert.equal(r.player.focus,0);
});
test('moving into the first enemy opens a pre-battle encounter, with exactly fifteen owned cards',()=>{
  const g=newGame(199);reveal(g);const r=move(g);assert.equal(r.moved,true);assert.equal(g.mode,'encounter');assert.equal(g.encounter.cards.length,15);startBattle(g);assert.equal(g.battle.cards.length,15);assert(validSave(g));
});
test('fifteen used cards cannot be reused and timeout is a defeat',()=>{
  const g=newGame(2);g.encounter=createEnemy(1,0,4);startBattle(g);const b=g.battle;
  b.player=fighter(999,999);b.opponent=fighter(999,999);b.enemy.cards=Array.from({length:15},(_,i)=>card('guard',1,`e4-${i}`));
  for(let block=0;block<3;block++){
    b.plan=b.cards.slice(block*5,block*5+5).map(c=>c.uid);b.phase='resolve';
    for(let i=0;i<5;i++)executePlannedTurn(b);
    if(block<2){assert.equal(b.phase,'plan');assert.equal(b.plan.filter(Boolean).length,0);}
  }
  assert.equal(b.turn,15);assert.equal(b.used.length,15);assert.equal(b.outcome,'defeat');assert.equal(b.timedOut,true);assert.throws(()=>executePlannedTurn(b));
});
test('a mid-window save resumes with exactly the same result',()=>{
  const g=newGame(19);g.encounter=createEnemy(1,0,23);startBattle(g);g.battle.plan=g.battle.cards.slice(0,5).map(c=>c.uid);g.battle.phase='resolve';g.battle.windowStart=0;
  executePlannedTurn(g.battle);g.hp=g.battle.player.hp;assert(validSave(g));const restored=JSON.parse(JSON.stringify(g));
  for(let i=1;i<5;i++){if(g.battle.outcome)break;assert.deepEqual(executePlannedTurn(restored.battle),executePlannedTurn(g.battle));}
  assert.deepEqual(restored.battle,g.battle);
});
test('victory allows up to three enemy cards and keeps exactly fifteen equipped',()=>{
  const g=newGame(17);move(g);startBattle(g);g.battle.outcome='victory';finishBattle(g);g.reward.selected=g.reward.cards.slice(0,3).map(c=>c.uid);const before=g.collection.length;claimReward(g);
  assert.equal(g.collection.length,before+3);assert.equal(g.deck.length,15);assert.equal(new Set(g.collection.map(c=>c.uid)).size,g.collection.length);assert.equal(g.mode,'explore');assert(validSave(g));
});
test('defeat requires one card, retains the entire collection, resets only the run',()=>{
  const g=newGame(8);g.floor=6;g.bestFloor=6;g.dungeon=generateFloor(6,g.seed);g.encounter=createEnemy(6,1,188);startBattle(g);g.battle.outcome='defeat';g.battle.player.hp=0;finishBattle(g);
  assert.throws(()=>claimReward(g));const deck=[...g.deck];g.reward.selected=[g.reward.cards[2].uid];claimReward(g);
  assert.equal(g.floor,1);assert.equal(g.bestFloor,6);assert.equal(g.hp,g.maxHp);assert.deepEqual(g.deck,deck);assert.equal(g.collection.length,16);assert.equal(g.deaths,1);assert(validSave(g));
});
test('deeper floors grow and descending restores health',()=>{
  const g=newGame(1),stairs=g.dungeon.cells.find(c=>c.event==='stairs');g.dungeon.position={x:stairs.x,z:stairs.z};g.hp=15;descend(g);
  assert.equal(g.floor,2);assert.equal(g.dungeon.cells.length,14);assert(g.hp>15);assert.equal(g.bestFloor,2);assert(validSave(g));
});
test('malformed saves are rejected without discarding an existing record',()=>{
  const g=newGame(1);assert(validSave(g));
  for(const mutate of [x=>x.deck.pop(),x=>x.deck[1]=x.deck[0],x=>x.collection[0].key='unknown',x=>x.floor=-1,x=>x.dungeon.cells[0].event='<script>',x=>x.nextUid=1,x=>x.mode='battle',x=>x.wins='bad']){const bad=JSON.parse(JSON.stringify(g));mutate(bad);assert.equal(validSave(bad),false);}
});
test('all card ranks produce finite nonnegative combat values',()=>{
  for(const key of Object.keys(CARDS))for(const rank of [1,2,5,15,30]){const c=cardStats(card(key,rank));for(const field of ['attack','guard','heal','focus','counter','poison','regen'])assert(Number.isFinite(c[field])&&c[field]>=0);}
});
