// Builds app/www from the website (../index.html + ../art-gallery-guide.json).
// - Bundles Leaflet and SheetJS locally so the map works without a CDN.
// - Loads the live gallery list from GitHub first (so gallery updates reach the
//   app without a new App Store release), falling back to the bundled copy offline.
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, '..');
const root = join(app, '..');
const www = join(app, 'www');
const LIVE_JSON = 'https://raw.githubusercontent.com/artloopwalk/artloopwalk/main/art-gallery-guide.json';

rmSync(www, { recursive: true, force: true });
mkdirSync(join(www, 'vendor'), { recursive: true });

let html = readFileSync(join(root, 'index.html'), 'utf8');

function swap(from, to) {
  if (!html.includes(from)) throw new Error('Expected text not found in index.html:\n' + from);
  html = html.replace(from, to);
}

// Local copies of the CDN libraries
swap('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', 'vendor/leaflet/leaflet.css');
swap('https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js', 'vendor/leaflet/leaflet.js');
swap('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'vendor/xlsx.full.min.js');
cpSync(join(app, 'node_modules/leaflet/dist'), join(www, 'vendor/leaflet'), { recursive: true });
cpSync(join(app, 'node_modules/xlsx/dist/xlsx.full.min.js'), join(www, 'vendor/xlsx.full.min.js'));

// Live data first (4s timeout), bundled copy as fallback
swap(
  "const r = await fetch('art-gallery-guide.json', { cache: 'no-store' });",
  `const r = await (async () => {
        try {
          const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 4000);
          const live = await fetch('${LIVE_JSON}', { cache: 'no-store', signal: ctl.signal });
          clearTimeout(t);
          if (live.ok) return live;
        } catch (e) { /* offline or slow: use bundled list */ }
        return fetch('art-gallery-guide.json');
      })();`
);

// Respect the iPhone notch / home indicator
swap('content="width=device-width, initial-scale=1.0"', 'content="width=device-width, initial-scale=1.0, viewport-fit=cover"');
swap('</style>', `  body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);}
</style>`);

writeFileSync(join(www, 'index.html'), html);
cpSync(join(root, 'art-gallery-guide.json'), join(www, 'art-gallery-guide.json'));
console.log('Built app/www from index.html');
