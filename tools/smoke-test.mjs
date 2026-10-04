// End-to-end smoke test of the web app in Chromium (runs on GitHub's Linux
// machines before you spend time on an iOS build).
//   npm run build && npm test
// Uses a fake Capacitor so the native parts (saved progress, haptics) are
// exercised too. Exits non-zero on any failure.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../www/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const FAKE_CAP = `window.__calls=[];window.__store={};
window.Capacitor={isNativePlatform:()=>true,registerPlugin:n=>new Proxy({},{get:(_,m)=>a=>{__calls.push(n+'.'+m);
if(n==='Preferences'){if(m==='set')__store[a.key]=a.value;if(m==='keys')return Promise.resolve({keys:Object.keys(__store)});if(m==='get')return Promise.resolve({value:__store[a.key]??null});}
return Promise.resolve({});}})};`;
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/vendor/capacitor.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(FAKE_CAP); }
  try { const body = await readFile(join(root, p === '/' ? 'index.html' : p)); res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const LOGIC = `(() => { for (const el of document.querySelectorAll('*')) { const k = Object.keys(el).find(k => k.startsWith('__reactFiber$')); if (!k) continue; let f = el[k]; while (f) { if (f.stateNode && f.stateNode.logic && f.stateNode.logic.celebrate) return f.stateNode.logic; f = f.return; } } return null; })()`;

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) failures++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 932, height: 430 }, hasTouch: false });
const page = await ctx.newPage();
const errors = [], external = [], missing = [];
page.on('pageerror', e => errors.push(e.message));
const voiceCalls = [];
page.on('request', r => {
  const u = r.url();
  if (u.startsWith('https://translate.google.com/translate_tts')) voiceCalls.push(u);   // Snaily's kid voice
  else if (!u.startsWith(base)) external.push(u);
});
page.on('response', r => { if (r.status() >= 400) missing.push(r.url()); });
const go = async (p, wait = 1200) => { await page.goto(base + p); await sleep(wait); };
const logic = expr => page.evaluate(`(() => { const L = ${LOGIC}; return ${expr}; })()`);

console.log('Pages load');
for (const p of ['index.html', 'garden.html', 'story.html']) {
  await go(p);
  ok(await page.evaluate(() => !!document.body && document.body.innerText.length > 50), `${p} renders`);
}
ok(errors.length === 0, 'no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
ok(external.length === 0, 'no network requests outside the app' + (external.length ? ': ' + external.join(', ') : ''));
ok(!(await page.$('select')), 'no voice picker on the page');
ok(missing.filter(u => !u.includes('translate_tts')).length === 0, 'no missing files' + (missing.length ? ': ' + missing.join(', ') : ''));

console.log("Snaily's kid voice");
await go('story.html', 400);
await page.click('text=Lily Pond', { force: true }); await sleep(1500);
ok(voiceCalls.some(u => /tl=en-US/.test(u)), 'Story World reads the story in the kid voice');
ok(await page.evaluate(() => [...document.querySelectorAll('audio')].length >= 0 && !document.querySelector('select')), 'no voice choice in Story World');

console.log('Parent gate + settings');
await go('index.html', 400);
await page.evaluate(() => localStorage.clear());
await go('index.html', 400);
const gear = await (await page.$('#gear')).boundingBox();
await page.mouse.move(gear.x + gear.width / 2, gear.y + gear.height / 2);
await page.mouse.down(); await sleep(800); await page.mouse.up(); await sleep(200);
ok(!(await page.$('.sn-gate')), 'short press does not open the gate');
await page.mouse.down(); await sleep(2200); await page.mouse.up(); await sleep(200);
ok(!!(await page.$('.sn-gate')), 'holding the gear 2s opens the gate');
const q = await page.textContent('.sn-gate-q'); const [a, b] = q.match(/\d+/g).map(Number);
await page.click('.sn-key[aria-label="1"]'); await page.click('.sn-key[aria-label="1"]'); await sleep(600);
ok(!(await page.isHidden('.sn-gate')) && (await page.$('#parent[hidden]')), 'wrong answer keeps the gate closed');
for (const d of String(a * b)) await page.click(`.sn-key[aria-label="${d}"]`);
await sleep(400);
ok(!(await page.$('#parent[hidden]')), 'right answer opens the parent area');
await page.click('button[aria-label="Sound effects"]');
await page.click('.seg[aria-label="Number Garden level"] button:has-text("3")');
await page.click('.p-tab:has-text("Progress")'); await page.click('.p-tab:has-text("Privacy")');
ok((await page.textContent('.p-body')).includes('do not collect'), 'privacy policy shown');
await page.click('.done');
await go('garden.html');
ok(await logic('L.props.sound') === false, 'sound setting reaches Number Garden');
ok(await logic('L.state.level') === 3, 'level picker sets Number Garden level');

console.log('Reduce Motion');
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('snaily-settings')); s.reduceMotion = true; localStorage.setItem('snaily-settings', JSON.stringify(s)); });
for (const p of ['garden.html', 'story.html']) {
  await go(p);
  await page.evaluate(`${LOGIC}.celebrate()`); await sleep(700);
  ok(await logic('!L.state.cannon && L.state.leaves === 1'), `${p}: no cannon, Snaily still eats`);
}
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('snaily-settings')); s.reduceMotion = false; localStorage.setItem('snaily-settings', JSON.stringify(s)); });

console.log('Story flow + progress stats + saved progress');
await go('story.html');
await page.click('text=Lily Pond', { force: true }); await sleep(800);
for (let i = 0; i < 8 && (await logic('L.state.phase')) === 'build'; i++) {
  const btn = await page.$('button:has-text("Show me")'); if (btn) await btn.click({ force: true }); await sleep(2500);
}
ok(await logic('L.state.phase') === 'solve', 'guided "Show me" builds the model');
await page.evaluate(`(() => { const L = ${LOGIC}; const ids = Object.keys(L.cur().slots); L.finalWin(ids[ids.length - 1]); })()`);
await sleep(1500);
ok(await logic('L.state.coll.pond') === 1, 'solving earns a shell');
const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('snaily-stats') || '{}'));
ok(stats.sw && stats.sw[0] && stats.sw[0].r === 1, 'solved story recorded for the progress report');
ok(await page.evaluate(() => __calls.some(c => c === 'Haptics.notification')), 'haptics fired on the right answer');
const store = await page.evaluate(() => __store);
ok(store['snaily-sw-coll'] && JSON.parse(store['snaily-sw-coll']).pond === 1, 'progress mirrored to native storage');
await sleep(4500);

console.log('Night time');
await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('snaily-settings')); s.bedtime = 10; localStorage.setItem('snaily-settings', JSON.stringify(s)); localStorage.setItem('snaily-session-secs', '598'); });
await go('garden.html', 1500);
ok(!!(await page.$('.sn-break')), 'game locks when the time limit is reached');
await go('index.html', 600);
ok(!!(await page.$('.sn-break')), 'home screen is locked too');
await page.evaluate(() => localStorage.setItem('snaily-break-until', String(Date.now() + 2000)));
await go('garden.html', 600);
ok(!!(await page.$('.sn-night')), 'night screen shows the moon and countdown');
await sleep(3500);
ok(!(await page.$('.sn-break')) && (await page.evaluate(() => localStorage.getItem('snaily-session-secs'))) !== null, 'morning: the game starts again by itself');

console.log('Restore after iOS clears web storage');
await page.evaluate(() => { localStorage.clear(); });
await page.evaluate(s => Object.assign(__store, s), store);
await go('index.html', 50);
await page.evaluate(s => Object.assign(__store, s), store);
await page.evaluate(() => SnailyNative.restore());
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('snaily-sw-coll') || '{}').pond === 1), 'saved progress comes back');

ok(errors.length === 0, 'still no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
