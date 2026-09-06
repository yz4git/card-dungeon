// Post-polish real WebGL verification trigger. Prefer defensive cards so the audit normally reaches TURN 05.
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const { chromium }=require('../.audit-runtime/node_modules/playwright-core');

const baseUrl=process.env.CARD_DUNGEON_AUDIT_URL||'http://127.0.0.1:4173';
const out=process.env.CARD_DUNGEON_AUDIT_DIR||'artifacts/webgl-battle-audit';
await mkdir(out,{recursive:true});

const browser=await chromium.launch({
  headless:true,
  executablePath:process.env.CARD_DUNGEON_CHROME_PATH||'/usr/bin/google-chrome',
  args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--disable-dev-shm-usage']
});
const context=await browser.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const page=await context.newPage();
const consoleErrors=[],pageErrors=[],httpErrors=[];
page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource: the server responded with a status of 404/i.test(m.text()))consoleErrors.push(m.text());});
page.on('pageerror',e=>pageErrors.push(String(e)));
page.on('response',r=>{if(r.status()>=400)httpErrors.push({status:r.status(),url:r.url()});});

await page.goto(baseUrl,{waitUntil:'networkidle',timeout:60000});
await page.locator('.title-screen').waitFor({state:'visible',timeout:30000});
await page.screenshot({path:`${out}/00-title.png`});

const canvas=page.locator('#world canvas').first();
await canvas.waitFor({state:'visible',timeout:30000});
const renderState=await canvas.evaluate(c=>{
  const gl=c.getContext('webgl2')||c.getContext('webgl');
  const ext=gl?.getExtension('WEBGL_debug_renderer_info');
  const r=c.getBoundingClientRect();
  return {webgl:Boolean(gl),renderer:ext&&gl?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,backingWidth:c.width,backingHeight:c.height,cssWidth:r.width,cssHeight:r.height};
});
await writeFile(`${out}/render-state.json`,JSON.stringify({sourceSha:process.env.GITHUB_SHA||null,renderState},null,2));

await page.locator('[data-action="new"]').first().click();
await page.waitForTimeout(150);
const modalButtons=page.locator('#modal-root button:visible');
if(await modalButtons.count()) await modalButtons.last().click({force:true});
await page.waitForFunction(()=>document.body.dataset.mode==='explore',null,{timeout:15000});
await page.waitForTimeout(500);
await page.screenshot({path:`${out}/01-explore-webgl.png`});
const canvasBox=await canvas.boundingBox();
if(canvasBox) await page.screenshot({path:`${out}/01-explore-canvas.png`,clip:canvasBox});

await page.locator('[data-action="forward"]').click({force:true});
await page.waitForFunction(()=>document.body.dataset.mode==='encounter',null,{timeout:10000});
await page.waitForTimeout(520);
await page.screenshot({path:`${out}/02-encounter-webgl.png`});
if(canvasBox) await page.screenshot({path:`${out}/02-encounter-canvas.png`,clip:canvasBox});

await page.locator('[data-action="fight"]').click({force:true});
await page.waitForFunction(()=>document.body.dataset.mode==='battle',null,{timeout:10000});
await page.waitForTimeout(250);
await page.screenshot({path:`${out}/03-battle-plan-top.png`});
await page.locator('.hand-scroll').scrollIntoViewIfNeeded();
await page.screenshot({path:`${out}/03b-battle-hand.png`});

const uids=await page.locator('.hand-scroll .game-card:not([disabled])').evaluateAll(nodes=>[...nodes]
  .sort((a,b)=>Number(a.classList.contains('attack'))-Number(b.classList.contains('attack')))
  .slice(0,5).map(n=>n.dataset.uid));
if(uids.length<5) throw new Error(`Only ${uids.length} selectable cards found`);
for(const uid of uids){await page.locator(`.hand-scroll .game-card[data-uid="${uid}"]`).click({force:true});await page.waitForTimeout(35);}
await page.locator('.battle-stage').scrollIntoViewIfNeeded();
await page.waitForTimeout(80);
await page.screenshot({path:`${out}/04-five-cards-planned.png`});
const fiveCardCursor=await page.evaluate(()=>({
  targetCount:document.querySelectorAll('.plan-slot.target').length,
  activeLaneCount:document.querySelectorAll('.duel-lanes span.active').length,
  prompt:document.querySelector('.plan-label small')?.textContent?.trim()||''
}));

await page.evaluate(()=>{
  window.__auditTurns=[];
  const read=()=>document.querySelector('.battle-feedback > .eyebrow')?.textContent?.trim()||'';
  let last='';
  const record=()=>{const v=read();if(v.startsWith('TURN')&&v!==last){last=v;window.__auditTurns.push({turn:v,time:performance.now()});}};
  new MutationObserver(record).observe(document.querySelector('#screen'),{subtree:true,childList:true,characterData:true});
  record();
});

let resolve=page.locator('[data-action="resolve"]');
if(!(await resolve.count())) resolve=page.locator('button').filter({hasText:/実行|解決|開始/}).last();
if(!(await resolve.count())) throw new Error('Resolve action not found');
await resolve.click({force:true});

await page.waitForFunction(()=>window.__auditTurns?.some(x=>x.turn==='TURN 01'),null,{timeout:10000,polling:25});
await page.waitForTimeout(180);
await page.screenshot({path:`${out}/05-turn01-player-fx.png`});
const turn01Actors=await page.locator('#fx [class*="actor-"]').evaluateAll(nodes=>nodes.map(n=>n.className));
await page.waitForTimeout(440);
await page.screenshot({path:`${out}/06-turn01-enemy-fx.png`});

await page.waitForFunction(()=>window.__auditTurns?.some(x=>x.turn==='TURN 05')||document.body.dataset.mode!=='battle'||/勝利|決着/.test(document.querySelector('.battle-hint')?.textContent||''),null,{timeout:12000,polling:25});
const turnHistory=await page.evaluate(()=>window.__auditTurns||[]);
const turn5Seen=turnHistory.some(x=>x.turn==='TURN 05');
const earlyOutcome=await page.evaluate(()=>document.body.dataset.mode!=='battle'||/勝利|決着/.test(document.querySelector('.battle-hint')?.textContent||''));
let turn05Actors=[];
if(turn5Seen){
  await page.waitForTimeout(170);
  await page.screenshot({path:`${out}/07-turn05-visible.png`});
  turn05Actors=await page.locator('#fx [class*="actor-"]').evaluateAll(nodes=>nodes.map(n=>n.className));
  await page.waitForTimeout(420);
  await page.screenshot({path:`${out}/08-turn05-fx.png`});
}else{
  await page.screenshot({path:`${out}/07-early-outcome.png`});
}
await page.waitForTimeout(900);
await page.screenshot({path:`${out}/09-next-window.png`});

const postTurn5Mode=await page.evaluate(()=>({mode:document.body.dataset.mode,feedback:document.querySelector('.battle-feedback > .eyebrow')?.textContent||'',plan:document.querySelector('.plan-label small')?.textContent||''}));
const diagnostics={sourceSha:process.env.GITHUB_SHA||null,renderState,fiveCardCursor,turnHistory,turn5Seen,earlyOutcome,turn01Actors,turn05Actors,postTurn5Mode,consoleErrors,pageErrors,httpErrors};
await writeFile(`${out}/diagnostics.json`,JSON.stringify(diagnostics,null,2));
await browser.close();

const blockingHttp=httpErrors.filter(({url,status})=>!(status===404&&/(favicon\.ico|apple-touch-icon)/i.test(url)));
if(!renderState.webgl) throw new Error(`WebGL unavailable: ${JSON.stringify(renderState)}`);
if(!/SwiftShader|ANGLE/i.test(renderState.renderer||'')) throw new Error(`Unexpected renderer: ${renderState.renderer}`);
if(fiveCardCursor.targetCount!==0||fiveCardCursor.activeLaneCount!==0) throw new Error(`Five-card cursor should be clear: ${JSON.stringify(fiveCardCursor)}`);
if(!/5手の配置完了/.test(fiveCardCursor.prompt)) throw new Error(`Five-card completion prompt missing: ${fiveCardCursor.prompt}`);
if(!turn5Seen&&!earlyOutcome) throw new Error(`TURN 05 missing without battle outcome: ${JSON.stringify(turnHistory)}`);
if(consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);
if(pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
if(blockingHttp.length) throw new Error(`HTTP errors: ${JSON.stringify(blockingHttp)}`);
console.log(JSON.stringify(diagnostics,null,2));
