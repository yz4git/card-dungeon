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
await page.screenshot({path:`${out}/00-title.png`,fullPage:true});

const canvas=page.locator('#world canvas').first();
await canvas.waitFor({state:'visible',timeout:30000});
const renderState=await canvas.evaluate(c=>{
  const gl=c.getContext('webgl2')||c.getContext('webgl');
  const ext=gl?.getExtension('WEBGL_debug_renderer_info');
  const r=c.getBoundingClientRect();
  return {webgl:Boolean(gl),renderer:ext&&gl?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,backingWidth:c.width,backingHeight:c.height,cssWidth:r.width,cssHeight:r.height};
});

await page.locator('[data-action="new"]').first().click();
await page.waitForTimeout(150);
const modalButtons=page.locator('#modal-root button:visible');
if(await modalButtons.count()) await modalButtons.last().click({force:true});
await page.waitForFunction(()=>document.body.dataset.mode==='explore',null,{timeout:15000});
await page.waitForTimeout(500);
await page.screenshot({path:`${out}/01-explore-webgl.png`,fullPage:true});
const box=await canvas.boundingBox();
if(box) await page.screenshot({path:`${out}/01-explore-canvas.png`,clip:box});

// Floor 1 deliberately places the first enemy directly in the initial facing corridor.
await page.locator('[data-action="forward"]').click({force:true});
await page.waitForFunction(()=>document.body.dataset.mode==='encounter',null,{timeout:10000});
await page.waitForTimeout(520);
await page.screenshot({path:`${out}/02-encounter-webgl.png`,fullPage:true});
if(box) await page.screenshot({path:`${out}/02-encounter-canvas.png`,clip:box});

await page.locator('[data-action="fight"]').click({force:true});
await page.waitForFunction(()=>document.body.dataset.mode==='battle',null,{timeout:10000});
await page.waitForTimeout(250);
await page.screenshot({path:`${out}/03-battle-plan.png`,fullPage:true});

const uids=await page.locator('.hand-scroll .game-card:not([disabled])').evaluateAll(nodes=>nodes.slice(0,5).map(n=>n.dataset.uid));
if(uids.length<5) throw new Error(`Only ${uids.length} selectable cards found`);
for(const uid of uids){
  await page.locator(`.hand-scroll .game-card[data-uid="${uid}"]`).click({force:true});
  await page.waitForTimeout(60);
}
await page.screenshot({path:`${out}/04-five-cards-planned.png`,fullPage:true});

let resolve=page.locator('[data-action="resolve"]');
if(!(await resolve.count())) resolve=page.locator('button').filter({hasText:/実行|解決|開始/}).last();
if(!(await resolve.count())) throw new Error('Resolve action not found');
await resolve.click({force:true});

const turnText=async()=>page.locator('.battle-feedback > .eyebrow').textContent().catch(()=>null);
await page.waitForFunction(()=>document.querySelector('.battle-feedback > .eyebrow')?.textContent?.includes('TURN 01'),null,{timeout:10000});
await page.waitForTimeout(120);
await page.screenshot({path:`${out}/05-turn01-start.png`,fullPage:true});
await page.waitForTimeout(260);
await page.screenshot({path:`${out}/06-turn01-player-fx.png`,fullPage:true});
await page.waitForTimeout(360);
await page.screenshot({path:`${out}/07-turn01-enemy-fx.png`,fullPage:true});
await page.waitForTimeout(300);
await page.screenshot({path:`${out}/08-turn01-result.png`,fullPage:true});

await page.waitForFunction(()=>document.querySelector('.battle-feedback > .eyebrow')?.textContent?.includes('TURN 05'),null,{timeout:15000});
const turn5Text=await turnText();
await page.waitForTimeout(130);
await page.screenshot({path:`${out}/09-turn05-visible.png`,fullPage:true});
const turn5Fx=await page.locator('#fx [class*="actor-"]').evaluateAll(nodes=>nodes.map(n=>n.className));
await page.waitForTimeout(450);
await page.screenshot({path:`${out}/10-turn05-fx.png`,fullPage:true});

const actorSamples={
  beams:await page.locator('#fx .actor-beam').count(),
  impacts:await page.locator('#fx .actor-impact').count(),
  shields:await page.locator('#fx .actor-shield').count(),
  poison:await page.locator('#fx .actor-poison').count(),
  auras:await page.locator('#fx .actor-aura').count(),
  presence:await page.locator('#fx .actor-player-presence').count()
};

await page.waitForTimeout(900);
await page.screenshot({path:`${out}/11-after-turn05.png`,fullPage:true});
const postTurn5Mode=await page.evaluate(()=>({mode:document.body.dataset.mode,feedback:document.querySelector('.battle-feedback > .eyebrow')?.textContent||'',plan:document.querySelector('.plan-label small')?.textContent||''}));
const diagnostics={sourceSha:process.env.GITHUB_SHA||null,renderState,turn5Text,turn5Fx,actorSamples,postTurn5Mode,consoleErrors,pageErrors,httpErrors};
await writeFile(`${out}/diagnostics.json`,JSON.stringify(diagnostics,null,2));
await browser.close();

const blockingHttp=httpErrors.filter(({url,status})=>!(status===404&&/(favicon\.ico|apple-touch-icon)/i.test(url)));
if(!renderState.webgl) throw new Error(`WebGL unavailable: ${JSON.stringify(renderState)}`);
if(!/SwiftShader|ANGLE/i.test(renderState.renderer||'')) throw new Error(`Unexpected renderer: ${renderState.renderer}`);
if(turn5Text?.trim()!=='TURN 05') throw new Error(`TURN 05 presentation missing: ${turn5Text}`);
if(consoleErrors.length) throw new Error(`Console errors: ${consoleErrors.join(' | ')}`);
if(pageErrors.length) throw new Error(`Page errors: ${pageErrors.join(' | ')}`);
if(blockingHttp.length) throw new Error(`HTTP errors: ${JSON.stringify(blockingHttp)}`);
console.log(JSON.stringify(diagnostics,null,2));
