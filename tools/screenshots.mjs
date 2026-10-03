// Makes App Store screenshots at the exact sizes Apple asks for.
//   npm run build && npm run screenshots   -> store-screenshots/*.png
// iPhone 6.9" = 2868x1320 (956x440 @3x), iPad 13" = 2752x2064 (1376x1032 @2x)
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../www/', import.meta.url));
const outDir = fileURLToPath(new URL('../store-screenshots/', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const body = await readFile(join(root, p === '/' ? 'index.html' : p));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(body);
  } catch { res.writeHead(404); res.end(); }
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const DEVICES = [
  { name: 'iphone-6.9', viewport: { width: 956, height: 440 }, dpr: 3 },
  { name: 'ipad-13', viewport: { width: 1376, height: 1032 }, dpr: 2 }
];
const SHOTS = [
  { id: '1-home', url: 'index.html', wait: 800 },
  { id: '2-garden-map', url: 'story.html', wait: 1500 },
  { id: '3-bar-model', url: 'story.html', wait: 1200, act: async p => { await p.click('text=Lily Pond', { force: true }); await p.waitForTimeout(1500); } },
  { id: '4-number-garden', url: 'garden.html', wait: 1200, act: async p => { await p.click("text=Let's feed Snaily!", { force: true }); await p.waitForTimeout(3500); } },
  { id: '5-thinking-tree', url: 'story.html', wait: 1200, act: async p => { await p.click('text=Thinking Tree', { force: true }); await p.waitForTimeout(1500); } }
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
for (const d of DEVICES) {
  const ctx = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.dpr, hasTouch: true });
  for (const s of SHOTS) {
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('snaily-sw-coll', JSON.stringify({ pond: 7, hill: 4, tree: 10, bakery: 2 })); localStorage.setItem('snaily-sw-medals', '3'); localStorage.setItem('snaily-medals', '2'); } catch (e) {} });
    await page.goto(base + s.url);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(s.wait);
    if (s.act) await s.act(page);
    const file = join(outDir, `${d.name}-${s.id}.png`);
    await page.screenshot({ path: file });
    console.log('saved', file);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
