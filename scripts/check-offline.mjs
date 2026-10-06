// Fails the build if any shipped web file references the network.
// Apple Kids Category: the app must make no network requests.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const www = new URL('../www/', import.meta.url).pathname;
// Only allowed network use: Snaily's kid voice (translate.google.com/translate_tts).
// Friends (opt-in, behind the parent gate): our own Supabase project and the web version's address.
const BAD = [/https?:\/\/(?!www\.w3\.org\/|translate\.google\.com\/translate_tts|fvkcrsasrwkevrkcjcqd\.supabase\.co|helloboomlabs\.github\.io\/hungry-snaily-math)/i, /fonts\.googleapis/i, /unpkg\.com/i];
// support.js contains CDN fallback constants that are never used because
// React is preloaded from vendor/ (loadReactUmd returns early).
const ALLOW = new Set(['support.js', 'vendor/capacitor.js', 'vendor/react.production.min.js', 'vendor/react-dom.production.min.js', 'vendor/qrcode.js', 'vendor/jsQR.js']);
let problems = 0;
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n), rel = p.slice(www.length);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!['.html', '.js', '.css'].includes(extname(n)) || ALLOW.has(rel)) continue;
    const t = readFileSync(p, 'utf8');
    for (const re of BAD) if (re.test(t)) { console.error(`[check] ${rel} matches ${re}`); problems++; }
  }
})(www);
const cfg = readFileSync(join(www, 'app/config.js'), 'utf8');
if (/SET-YOUR-SUPPORT-EMAIL/.test(cfg)) console.warn('[check] WARNING: set supportEmail in www/app/config.js before release');
if (problems) process.exit(1);
console.log('[check] no network references in shipped files');
