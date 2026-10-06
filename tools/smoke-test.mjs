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

console.log('Friends & presents (fake server)');
{
  // A tiny in-memory stand-in for the Supabase backend (supabase/schema.sql).
  const db = { users: 0, children: [], invites: [], friends: [], gifts: [] };
  const BEE = { id: 'bee', family: 'other', nickname: 'Brave Bee 7', color: 'blue' };
  db.children.push(BEE);
  const pub = c => ({ id: c.id, nickname: c.nickname, color: c.color });
  const byId = id => db.children.find(c => c.id === id);
  const fr = me => db.friends.filter(f => f.a === me || f.b === me).map(f => byId(f.a === me ? f.b : f.a));
  const RPC = {
    make_invite: a => { const code = 'ABC' + (100 + db.invites.length); db.invites.push({ code, child: a.me, used_by: null }); return { code }; },
    invite_status: a => { const i = db.invites.find(x => x.code === a.invite); return i.used_by ? { state: 'used', friend: pub(byId(i.used_by)) } : { state: 'waiting' }; },
    redeem_invite: a => { const i = db.invites.find(x => x.code === a.invite && !x.used_by); if (!i) throw { message: 'That code did not work. Ask your friend for a new one.' }; i.used_by = a.me; db.friends.push({ a: a.me, b: i.child }); return pub(byId(i.child)); },
    list_friends: a => fr(a.me).map(c => ({ ...pub(c), since: new Date().toISOString(), sent_today: 0 })),
    inbox: a => ({ gifts: db.gifts.filter(g => g.to === a.me && !g.opened).map(g => ({ id: g.id, item: g.item, from: pub(byId(g.from)) })),
      thanks: db.gifts.filter(g => g.from === a.me && g.thanks && !g.seen).map(g => ({ id: g.id, item: g.item, thanks: g.thanks, from: pub(byId(g.to)) })),
      sent_today: db.gifts.filter(g => g.from === a.me).length }),
    send_gift: a => { const n = db.gifts.filter(g => g.from === a.me).length; if (n >= 3) throw { message: 'You can send 3 gifts a day.' }; db.gifts.push({ id: 'g' + db.gifts.length, from: a.me, to: a.friend, item: a.gift }); return { left_today: 2 - n }; },
    open_gift: a => { const g = db.gifts.find(x => x.id === a.gift && x.to === a.me); g.opened = true; if (a.say_thanks) g.thanks = a.say_thanks; return { id: g.id, item: g.item }; },
    seen_thanks: a => { db.gifts.forEach(g => { if (a.ids.includes(g.id)) g.seen = true; }); return null; },
    remove_friend: a => { db.friends = db.friends.filter(f => !((f.a === a.me && f.b === a.friend) || (f.b === a.me && f.a === a.friend))); return null; },
    delete_family: () => { db.children = db.children.filter(c => c.family === 'other'); db.deleted = true; return null; }
  };
  const ctx2 = await browser.newContext({ viewport: { width: 932, height: 430 } });
  const fp = await ctx2.newPage();
  const ferr = [];
  fp.on('pageerror', e => ferr.push(e.message));
  await ctx2.route('https://fvkcrsasrwkevrkcjcqd.supabase.co/**', async route => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' } });
    const u = new URL(route.request().url()), body = JSON.parse(route.request().postData() || '{}');
    const reply = (st, b) => route.fulfill({ status: st, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: b == null ? '' : JSON.stringify(b) });
    if (u.pathname === '/auth/v1/signup') { db.users++; return reply(200, { access_token: 't', refresh_token: 'r', expires_in: 3600, user: { id: 'fam' + db.users } }); }
    if (u.pathname === '/auth/v1/token') return reply(200, { access_token: 't2', refresh_token: 'r2', expires_in: 3600 });
    if (u.pathname === '/rest/v1/children') { const c = { id: 'kid' + db.users, ...body }; db.children.push(c); return reply(201, [c]); }
    const fn = u.pathname.replace('/rest/v1/rpc/', '');
    try { return reply(200, RPC[fn](body)); } catch (e) { return reply(400, { message: e.message || String(e) }); }
  });
  const passGate = async () => {
    await fp.waitForSelector('.sn-gate-q');
    const q = await fp.textContent('.sn-gate-q'); const [, x, y] = q.match(/(\d+) × (\d+)/);
    for (const d of String(x * y)) await fp.click(`.sn-key[aria-label="${d}"]`);
    await sleep(400);
  };
  const title = () => fp.textContent('.fr-head h2').catch(() => '');
  await fp.goto(base + 'index.html'); await sleep(500);
  await fp.evaluate(() => localStorage.setItem('snaily-sw-coll', JSON.stringify({ pond: 2 })));
  ok(!!(await fp.$('.fr-open')) && !(await fp.isVisible('.fr-badge')), 'Friends button on the home screen, no badge yet');
  await fp.click('.fr-open'); await sleep(300);
  ok(/turn on Friends/.test(await fp.textContent('.fr-body')), 'Friends is off until a grown-up turns it on');
  await fp.click('text=Grown-ups: turn on Friends'); await passGate();
  ok(/Turn on Friends/.test(await title()) && /anonymous account/.test(await fp.textContent('.fr-info')), 'grown-up sees what is collected');
  await fp.click('.fr-info .fr-big'); await sleep(600);
  const mine = await fp.evaluate(() => JSON.parse(localStorage.getItem('snaily-cloud')));
  ok(/My friends/.test(await title()) && mine && /^[A-Z][a-z]+ [A-Z][a-z]+ \d+$/.test(mine.child.nickname), 'account made with a made-up nickname: ' + (mine && mine.child.nickname));
  await fp.click('.fr-add'); await passGate();
  await fp.click('text=Show my code'); await sleep(600);
  const code = (await fp.textContent('.fr-code')).replace(/\s/g, '');
  ok(/^ABC\d{3}$/.test(code), 'friend code is shown: ' + code);
  ok(!!(await fp.$('.fr-qr svg')) || /Type this code/.test(await fp.textContent('.fr-qr')), 'QR code (or typing hint) is shown');
  RPC.redeem_invite({ me: 'bee', invite: code });
  await sleep(3200);
  ok(/New friend/.test(await title()) && /Brave Bee 7/.test(await fp.textContent('.fr-body')), 'when the friend scans it, both become friends');
  await fp.click('text=Yay!'); await sleep(500);
  ok((await fp.$$('.fr-friend:not(.fr-add)')).length === 1, 'friend shows in the list');
  await fp.click('.fr-friend:not(.fr-add) .sn-btn'); await sleep(300);
  ok((await fp.$$('.fr-tile')).length === 2, 'present choices: the free surprise and shells');
  await fp.click('.fr-tile:not(.fr-free)'); await sleep(200);
  await fp.click('text=Wrap it and send!'); await sleep(500);
  ok(db.gifts.length === 1 && db.gifts[0].item === 'pond' && db.gifts[0].to === 'bee', 'present is sent to the friend');
  ok(await fp.evaluate(() => JSON.parse(localStorage.getItem('snaily-sw-coll')).pond === 1), 'the shell leaves the Story Garden');
  db.gifts.push({ id: 'gb', from: 'bee', to: mine.child.id, item: 'clock' });
  db.gifts[0].thanks = 'hug';
  await fp.click('.fr-head .fr-x:not(.fr-back)'); await sleep(200);
  await fp.evaluate(() => SnailyFriends.refresh()); await sleep(300);
  ok((await fp.textContent('.fr-badge')) === '2' && await fp.isVisible('.fr-badge'), 'badge shows a present and a thank-you');
  await fp.click('.fr-open'); await sleep(600);
  ok(/hug/.test(await fp.textContent('.fr-say')) && db.gifts[0].seen, 'thank-you sticker is shown, then cleared');
  await fp.click('.fr-present'); await sleep(200);
  await fp.click('.fr-bigbox'); await sleep(500);
  ok(await fp.evaluate(() => JSON.parse(localStorage.getItem('snaily-sw-coll')).clock === 1), 'opened present goes into the Story Garden');
  await fp.click('.fr-sticker[aria-label="a big heart"]'); await sleep(400);
  ok(db.gifts[1].opened && db.gifts[1].thanks === 'heart', 'thank-you sticker is sent back');
  await fp.click('.fr-head .fr-x:not(.fr-back)'); await sleep(200);
  await fp.evaluate(() => window.__openParent('friends')); await sleep(500);
  ok(/Brave Bee 7/.test(await fp.textContent('.p-body')), 'Grown-ups › Friends lists the friend');
  await fp.click('.p-body .sn-btn.danger:has-text("Block")'); await sleep(400);
  ok(db.friends.length === 0 && /No friends yet/.test(await fp.textContent('.p-body')), 'grown-up can remove/block a friend');
  await fp.click('button:has-text("Turn off Friends")'); await fp.click('button:has-text("Tap again to delete")'); await sleep(400);
  ok(db.deleted && !(await fp.evaluate(() => localStorage.getItem('snaily-cloud'))), 'Turn off Friends deletes the account');
  ok(ferr.length === 0, 'no JavaScript errors in Friends' + (ferr.length ? ': ' + ferr.join(' | ') : ''));
  await ctx2.close();
}

ok(errors.length === 0, 'still no JavaScript errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); server.close();
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
