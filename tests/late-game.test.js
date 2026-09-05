import test from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, ENEMIES } from '../dist/js/data.js';
import { generateFloor, createEnemy, newGame } from '../dist/js/engine.js';
import { recommendDeck, deckSummary, cardUtility } from '../dist/js/deck-advisor.js';

test('B6-B10 introduce late-game enemy patterns and B10 uses the final boss',()=>{
  for(const floor of [6,7,8,9,10]){
    const d=generateFloor(floor,20260905+floor);
    const normals=d.cells.filter(c=>c.event==='enemy');
    assert(normals.some(c=>c.enemyIndex>=4&&c.enemyIndex<=6),`B${floor} should include a late-game enemy`);
    const exit=d.cells.find(c=>c.event===('boss'));
    if(floor===10){assert(exit);assert.equal(exit.enemyIndex,7);}
  }
  assert.equal(ENEMIES[7].id,'abyss-crown');
});

test('B10 final boss has a fixed three-phase card script with escalating ranks',()=>{
  const e=createEnemy(10,7,777);
  assert.equal(e.id,'abyss-crown');
  assert.equal(e.cards.length,15);
  assert.deepEqual(e.cards.map(c=>c.key),ENEMIES[7].deck);
  assert.equal(e.phases.length,3);
  assert.equal(e.cards[0].rank,4);
  assert.equal(e.cards[5].rank,5);
  assert.equal(e.cards[10].rank,6);
  assert(e.maxHp>createEnemy(10,3,777).maxHp);
});

test('recommended deck always selects fifteen distinct owned cards and stays balanced',()=>{
  const g=newGame(11);
  const extras=['eclipse','aegis','remedy','rupture','ambush','drain','bastion','ward','renew','focus','pierce','parry','cleave','heal','purge'];
  extras.forEach((key,i)=>g.collection.push({uid:`c${g.nextUid++}`,key,rank:4+(i%2)}));
  const deck=recommendDeck(g.collection,8),ids=deck.map(c=>c.uid),summary=deckSummary(deck);
  assert.equal(deck.length,15);
  assert.equal(new Set(ids).size,15);
  assert(ids.every(uid=>g.collection.some(c=>c.uid===uid)));
  assert(summary.counts.attack>=6);
  assert(summary.counts.guard>=4);
  assert(summary.counts.heal>=3);
  assert(summary.counts.focus>=2);
});

test('advisor scores higher-rank and late-floor utility cards above weaker copies',()=>{
  const weak={uid:'c1',key:'pierce',rank:1},strong={uid:'c2',key:'pierce',rank:5};
  assert(cardUtility(strong,8)>cardUtility(weak,8));
  for(const key of Object.keys(CARDS))assert(Number.isFinite(cardUtility({uid:'x',key,rank:3},8)));
});
