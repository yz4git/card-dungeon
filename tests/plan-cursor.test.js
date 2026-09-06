import test from 'node:test';
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
