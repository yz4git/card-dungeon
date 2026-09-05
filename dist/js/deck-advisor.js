import { CARDS, cardStats, mainValue } from './data.js';

const QUOTAS={attack:6,guard:4,heal:3,focus:2};

export function cardUtility(card,floor=1){
  const c=cardStats(card);
  let score=mainValue(c);
  if(c.type==='guard')score*=.94;
  if(c.type==='heal')score*=1.03;
  if(c.type==='focus')score*=.9;
  if(c.pierce)score+=floor>=6?13:10;
  if(c.shatter)score+=8;
  if(c.ambush)score+=7;
  if(c.counter)score+=7+c.counter*.35;
  if(c.drain)score+=8;
  if(c.poison)score+=4+c.poison*.7;
  if(c.cleanse)score+=floor>=6?10:7;
  if(c.regen)score+=6+c.regen*.6;
  if(c.heal&&c.type!=='heal')score+=5+c.heal*.25;
  if(c.type==='focus'&&floor>=6)score+=3;
  score+=Math.min(12,(c.rank-1)*1.3);
  return Math.round(score*10)/10;
}

export function recommendDeck(collection,floor=1){
  const cards=collection.filter(c=>CARDS[c.key]);
  const ranked=[...cards].sort((a,b)=>cardUtility(b,floor)-cardUtility(a,floor)||b.rank-a.rank||String(a.uid).localeCompare(String(b.uid)));
  const chosen=[];
  const used=new Set();
  for(const [type,quota] of Object.entries(QUOTAS)){
    for(const card of ranked){
      if(chosen.filter(c=>CARDS[c.key].type===type).length>=quota)break;
      if(used.has(card.uid)||CARDS[card.key].type!==type)continue;
      chosen.push(card);used.add(card.uid);
    }
  }
  for(const card of ranked){if(chosen.length>=15)break;if(!used.has(card.uid)){chosen.push(card);used.add(card.uid);}}
  return chosen.slice(0,15);
}

export function deckSummary(cards){
  const counts={attack:0,guard:0,heal:0,focus:0};
  let rank=0,score=0;
  for(const card of cards){
    const def=CARDS[card.key];if(!def)continue;
    counts[def.type]=(counts[def.type]||0)+1;rank+=card.rank||1;score+=cardUtility(card);
  }
  return {counts,averageRank:cards.length?rank/cards.length:0,totalScore:Math.round(score)};
}

export function compareCard(candidate,current,floor=1){
  return Math.round((cardUtility(candidate,floor)-cardUtility(current,floor))*10)/10;
}
