// Copies the offline runtime files from node_modules into www/vendor:
//   Capacitor core (browser build), React 18.3.1 UMD builds (used by support.js) and the Fredoka font files.
// Run after `npm ci`. Fails if anything is missing.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => join(root, 'node_modules', ...p);
const out = (...p) => join(root, 'www', 'vendor', ...p);

const files = [
  [nm('@capacitor', 'core', 'dist', 'capacitor.js'), out('capacitor.js')],
  // Friends: QR code maker (MIT) and QR code reader for browsers without BarcodeDetector (Apache-2.0).
  [nm('qrcode-generator', 'qrcode.js'), out('qrcode.js')],
  [nm('jsqr', 'dist', 'jsQR.js'), out('jsQR.js')],
  [nm('react', 'umd', 'react.production.min.js'), out('react.production.min.js')],
  [nm('react-dom', 'umd', 'react-dom.production.min.js'), out('react-dom.production.min.js')],
  ...[400, 500, 600, 700].map(w => [
    nm('@fontsource', 'fredoka', 'files', `fredoka-latin-${w}-normal.woff2`),
    out('fonts', `fredoka-latin-${w}-normal.woff2`)
  ]),
  [nm('@fontsource', 'fredoka', 'LICENSE'), out('fonts', 'OFL-LICENSE.txt')]
];

// Web-version icons (Home Screen / manifest): the 1024 app icon, scaled by the browser.
const icon = join(root, 'resources', 'AppIcon-1024.png');
mkdirSync(join(root, 'www', 'icons'), { recursive: true });
for (const n of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) files.push([icon, join(root, 'www', 'icons', n)]);

mkdirSync(out('fonts'), { recursive: true });
let bad = 0;
for (const [src, dst] of files) {
  if (!existsSync(src)) { console.error('[vendor] MISSING', src); bad++; continue; }
  copyFileSync(src, dst);
  console.log('[vendor]', dst.replace(root + '/', ''));
}
if (bad) process.exit(1);
