import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

// Browser integration check using Chrome's DevTools protocol (no npm dependency).
const profile = path.resolve('artifacts/burst-chrome-profile');
await mkdir(profile, { recursive: true });
const child = spawn(process.env.CHROMIUM_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9337', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
let socket;
try {
  let targets;
  for (let i = 0; i < 60; i++) {
    try { targets = await (await fetch('http://127.0.0.1:9337/json')).json(); break; }
    catch { await new Promise(r => setTimeout(r, 100)); }
  }
  assert.ok(targets, 'Chrome starts');
  socket = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map(), errors = [];
  socket.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) {
      const p = pending.get(msg.id); pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error))); else p.resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const seq = ++id; pending.set(seq, { resolve, reject });
    socket.send(JSON.stringify({ id: seq, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    let callback, now = 1000;
    window.requestAnimationFrame = f => (callback = f, 1);
    window.advance = n => { for (let i=0;i<n;i++) { now += 1000/60; const f=callback; callback=null; f?.(now); } };
  ` });
  const gameURL = new URL(process.env.GAME_URL || 'http://127.0.0.1:5173/');
  gameURL.searchParams.set('qa', String(Date.now()));
  await send('Page.navigate', { url: gameURL.href });
  for (let i = 0; i < 80; i++) {
    const ready = await evaluate(`location.href === ${JSON.stringify(gameURL.href)} && document.readyState === 'complete' && !!document.querySelector('#p1 option')`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const result = await evaluate(`(async () => {
    const {Fighter} = await import('./js/combat.js');
    const {CombatWorld} = await import('./js/combat-world.js');
    const original = Fighter.prototype.step;
    const seen = [];
    const hits=[];let activeWorld;
    const worldStep=CombatWorld.prototype.step;
    CombatWorld.prototype.step=function(...args) {activeWorld=this;const events=worldStep.apply(this,args);hits.push(...events);return events;};
    window.skillQA={seen,hits,world:()=>activeWorld};
    Fighter.prototype.step = function(...args) { if (!seen.includes(this)) seen.push(this); return original.apply(this,args); };
    document.getElementById('training').click();
    document.getElementById('characters-next').click();
    document.getElementById('start').click();
    advance(150);
    const run = index => {
      const actor=seen[index], target=seen[1-index];
      actor.reset(index ? 300 : 400, 1); target.reset(index ? 470 : 550, -1);
      actor.energyPoints=3;
      actor.tryMove('skill2');
      const frames=[];
      for(let i=0;i<100;i++) {
        advance(1);
        frames.push({frame:i,x:actor.x,y:actor.y,hp:target.hp,key:actor.attack?.key,attackFrame:actor.attack?.frame,spawned:actor.attack?.spawned,landed:actor.attack?.landed,visual:!!actor.burstVisual});
      }
      return {index,frames};
    };
    return [run(0),run(1)];
  })()`);
  await writeFile('artifacts/burst-check.json', JSON.stringify({errors, result}, null, 2));
  console.log(JSON.stringify(result.map(r => ({index:r.index, hit:r.frames.find(f=>f.hp<100), final:r.frames.at(-1)})), null, 2));
  assert.equal(errors.length, 0);
  for (const run of result) {
    assert.ok(run.frames.some(f => f.hp < 100), `fighter ${run.index} skill two damages in the live arena`);
    assert.ok(run.frames.some(f => f.visual), 'burst effect appears');
    assert.equal(run.frames.at(-1).key, undefined, 'skill exits recovery');
  }
  const revisionCheck = await evaluate(`(() => {
    const imports=JSON.parse(document.querySelector('script[type="importmap"]').textContent).imports;
    const revisions=new Set(Object.values(imports).map(url=>url.split('?v=')[1]));
    return { count:revisions.size, revision:[...revisions][0], modules:Object.keys(imports).length };
  })()`);
  assert.equal(revisionCheck.count, 1, 'all modules load one coherent revision');
  assert.ok(revisionCheck.revision);
  console.log('Module graph:', revisionCheck);
  const skillCheck = await evaluate(`(async () => {
    const {seen,hits,world}=window.skillQA;
    const blue=seen[0],red=seen[1];
    world().reset();blue.reset(250,1);red.reset(850,-1);blue.energyPoints=3;
    blue.tryMove('skill');
    for(let i=0;i<40 && !world().projectiles.length;i++) advance(1);
    const balls=world().projectiles.map(p=>({x:p.x,y:p.y,delay:p.delay,age:p.age}));
    const palm={x:blue.x+94,y:blue.y-142};
    advance(17);
    const emitted=world().projectiles.map(p=>({x:p.x,y:p.y,delay:p.delay,age:p.age}));
    const shotPNG=document.getElementById('arena').toDataURL('image/png').split(',')[1];
    world().reset();blue.reset(475,-1);red.reset(400,1);red.energyPoints=3;
    hits.length=0;red.tryMove('super');
    for(let i=0;i<200;i++) advance(1);
    return {balls,emitted,palm,redHits:hits.filter(e=>e.grab).length,blueHP:blue.hp,released:!red.grabbing&&!blue.capturedBy,shotPNG};
  })()`);
  assert.equal(skillCheck.balls.length,3);
  assert.equal(skillCheck.balls.filter(p=>p.age>0).length,1);
  assert.equal(skillCheck.emitted.length,3);
  assert.ok(skillCheck.emitted.every(p=>p.delay<=0 && p.age>0 && p.y===skillCheck.palm.y));
  assert.ok(skillCheck.emitted[0].x>skillCheck.emitted[1].x && skillCheck.emitted[1].x>skillCheck.emitted[2].x);
  assert.equal(skillCheck.redHits,7);
  assert.equal(skillCheck.blueHP,79);
  assert.ok(skillCheck.released);
  await writeFile('artifacts/skill-palm-release.png',Buffer.from(skillCheck.shotPNG,'base64'));
  console.log('Straight sequential palm triple shot and six-punch super passed.');
  const crouchCheck=await evaluate(`(async()=>{
    const {bindings}=await import('./js/input.js');
    const {applyDamage}=await import('./js/combat.js');
    const {seen,world}=window.skillQA;
    seen.length=0;
    document.getElementById('mode').value='local';document.getElementById('start').click();advance(150);
    const cases=[];
    for(const index of [0,1]) for(const facing of [1,-1]) {
      world().reset();
      const a=seen[index],b=seen[1-index],binding=bindings[index];
      a.reset(480,facing);b.reset(480+facing*150,-facing);
      const back=facing===1?binding.left:binding.right;
      const press=(type,code)=>window.dispatchEvent(new KeyboardEvent(type,{code,bubbles:true}));
      press('keydown',back);press('keydown',binding.guard);advance(2);
      const entered={state:a.state,height:a.hurtbox().h};
      const event=applyDamage(b,a,b.def.moves.specialKick,{key:'specialKick'});
      advance(1);
      const blockedState=a.state;
      press('keyup',back);press('keyup',binding.guard);advance(8);
      cases.push({index,facing,entered,blocked:event.blocked,blockedState,final:a.state,height:a.hurtbox().h});
    }
    world().reset();seen[0].reset(350,1);seen[1].reset(650,-1);
    for(const [index,back] of [[0,'KeyA'],[1,'ArrowRight']]) {
      window.dispatchEvent(new KeyboardEvent('keydown',{code:back,bubbles:true}));
      window.dispatchEvent(new KeyboardEvent('keydown',{code:bindings[index].guard,bubbles:true}));
    }
    advance(2);
    return {cases,png:document.getElementById('arena').toDataURL('image/png').split(',')[1]};
  })()`);
  for(const c of crouchCheck.cases) {
    assert.equal(c.entered.state,'crouchGuard');
    assert.equal(c.entered.height,144);
    assert.equal(c.blocked,true);
    assert.equal(c.blockedState,'crouchGuard');
    assert.equal(c.height,180);
    assert.equal(c.final,'idle');
  }
  await writeFile('artifacts/crouch-guard.png',Buffer.from(crouchCheck.png,'base64'));
  console.log('Both players crouch-block and recover in both directions.');
  const posePreview = await evaluate(`(async () => {
    const {roster}=await import('./js/roster.js');
    const {Fighter}=await import('./js/combat.js');
    const {drawAnimatedFighter}=await import('./js/animation.js');
    const images=new Map();
    for(const def of roster) for(const sprite of Object.values(def.sprites))
      for(const pose of [sprite,...(sprite.clip||[])]) {
        const src=pose.src||sprite.src;
        if(!images.has(src)) {const img=new Image();img.src=src;images.set(src,img);}
      }
    await Promise.all([...images.values()].map(img=>img.decode()));
    const canvas=document.createElement('canvas'); canvas.width=1400;canvas.height=1120;
    const ctx=canvas.getContext('2d'); ctx.fillStyle='#182234';ctx.fillRect(0,0,1400,1120);
    let row=0;
    for(const def of roster) for(const slot of ['skill','super']) {
      const f=new Fighter(def,0,1); f.energyPoints=3; f.tryMove(slot); f.state=slot;
      const sprite=def.sprites[slot];
      for(let col=0;col<7;col++) {
        ctx.save();ctx.translate(col*200+100,row*280+245);
        ctx.strokeStyle='#526070';ctx.beginPath();ctx.moveTo(-95,0);ctx.lineTo(95,0);ctx.stroke();
        if(col===0) { f.state='idle';drawAnimatedFighter(ctx,f,images); }
        else {
          f.state=slot;
          const frame=sprite.clip[col-1];
          const selected={...sprite,...frame,clip:undefined};
          const fake={...f,attack:null,def:{...def,sprites:{...def.sprites,[slot]:selected}}};
          drawAnimatedFighter(ctx,fake,images);
        }
        ctx.fillStyle='#ffffff';ctx.font='13px sans-serif';ctx.fillText(def.name+' '+slot+' '+(col===0?'idle':col),-85,22);
        ctx.restore();
      }
      row++;
    }
    return canvas.toDataURL('image/png').split(',')[1];
  })()`);
  await writeFile('artifacts/sprite-v5-preview.png',Buffer.from(posePreview,'base64'));
  console.log('Browser burst integration passed.');
} finally {
  socket?.close();
  child.kill();
}
