from pathlib import Path

app_path = Path('dist/js/app.js')
planning_path = Path('dist/js/battle-planning.js')
sw_path = Path('dist/sw.js')
test_path = Path('tests/plan-cursor.test.js')

app = app_path.read_text()

old = "  const selectable=b.cards.filter(c=>!b.used.includes(c.uid));\n"
new = "  const selectable=b.cards.filter(c=>!b.used.includes(c.uid));\n  const planPrompt=resolving?'カードは自動で進みます':filled===5&&slot<0?'5手の配置完了 · 入れ替える手を上の1〜5から選択':`${slot+1}手目を選択中 · 下のカードをタップ`;\n"
assert old in app
app = app.replace(old, new, 1)

old = "<div class=\"plan-label\"><span>あなたの5手</span><small>${resolving?'カードは自動で進みます':`${slot+1}手目を選択中 · 下のカードをタップ`}</small></div>"
new = "<div class=\"plan-label\"><span>あなたの5手</span><small>${planPrompt}</small></div>"
assert old in app
app = app.replace(old, new, 1)

old = "filled===5?'5手の配置完了。タップすると入れ替えられます。':`空いている手にあと${5-filled}枚配置してください。`"
new = "filled===5?'5手の配置完了。入れ替える場合は上の1〜5手目を選択。':`空いている手にあと${5-filled}枚配置してください。`"
assert old in app
app = app.replace(old, new, 1)

old = "function continueGame(){game=JSON.parse(JSON.stringify(saved));slot=game.battle?.plan?.findIndex(x=>!x)??0;if(slot<0)slot=0;if(game.mode==='battle'&&game.battle.outcome){finishBattle(game);save();}render();world?.sync(game,true);if(game.mode==='battle'&&game.battle.phase==='resolve')scheduleTurn();audio.play('start');}"
new = "function continueGame(){game=JSON.parse(JSON.stringify(saved));const openSlot=game.battle?.plan?.findIndex(x=>!x);slot=openSlot==null?0:openSlot;if(game.mode==='battle'&&game.battle.outcome){finishBattle(game);save();}render();world?.sync(game,true);if(game.mode==='battle'&&game.battle.phase==='resolve')scheduleTurn();audio.play('start');}"
assert old in app
app = app.replace(old, new, 1)

old = """function placeCard(uid){
  const b=game?.battle;if(!b||b.phase!=='plan'||b.used.includes(uid))return;
  const existing=b.plan.indexOf(uid);
  if(existing===slot){b.plan[slot]=null;}
  else {if(existing>=0)b.plan[existing]=b.plan[slot];b.plan[slot]=uid;const next=b.plan.findIndex((v,i)=>!v&&i>slot);slot=next>=0?next:Math.max(0,b.plan.findIndex(v=>!v));}
  audio.play('place');save();renderBattle();
}"""
new = """function placeCard(uid){
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
}"""
assert old in app
app = app.replace(old, new, 1)
app_path.write_text(app)

planning = planning_path.read_text()
old = "  const targetIndex=Math.max(0,foundTarget);"
new = "  const targetIndex=foundTarget;"
assert old in planning
planning_path.write_text(planning.replace(old, new, 1))

sw = sw_path.read_text()
assert "card-dungeon-v1.1.6" in sw
sw_path.write_text(sw.replace("card-dungeon-v1.1.6", "card-dungeon-v1.1.7", 1))

test_path.write_text("""import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('five-card planning clears the edit cursor instead of returning to slot one', async () => {
  const app = await readFile(new URL('../dist/js/app.js', import.meta.url), 'utf8');
  const planning = await readFile(new URL('../dist/js/battle-planning.js', import.meta.url), 'utf8');
  assert.match(app, /filled===5&&slot<0/);
  assert.match(app, /if\(slot<0\)\{toast\('入れ替える手を上の1〜5から選んでください。'\);return;\}/);
  assert.match(app, /slot=nextAfter>=0\?nextAfter:nextAny/);
  assert.doesNotMatch(app, /Math\.max\(0,b\.plan\.findIndex\(v=>!v\)\)/);
  assert.match(planning, /const targetIndex=foundTarget;/);
  assert.doesNotMatch(planning, /const targetIndex=Math\.max\(0,foundTarget\);/);
});
""")
