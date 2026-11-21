#!/usr/bin/env node
/*
  Builds an Instagram carousel of upcoming NYC gallery openings from art-gallery-guide.json.

  node scripts/carousel.mjs --month 2026-12          all openings in December 2026
  node scripts/carousel.mjs --week 2026-11-30        the 7 days starting Mon, Nov 30
  node scripts/carousel.mjs --from 2026-11-21 --days 10
  options: --out <folder> (default social/<label>)   --dry (print what it found, no images)

  Writes slide-01.png … (1080×1350, Instagram's 4:5 portrait size) and caption.txt.
  Needs Playwright with Chromium (preinstalled in Claude's cloud workspace).
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

// ---------- the period ----------
const DAY = 86400000;
const iso = d => d.toISOString().slice(0, 10);
const utc = s => new Date(s + 'T00:00:00Z');
let start, end, label, periodTitle;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MON3 = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
if (args.month){
  const [y, m] = String(args.month).split('-').map(Number);
  start = new Date(Date.UTC(y, m - 1, 1)); end = new Date(Date.UTC(y, m, 0));
  label = `${y}-${String(m).padStart(2, '0')}-openings`;
  periodTitle = `${MONTHS[m - 1]} ${y}`;
} else {
  start = utc(String(args.week || args.from || iso(new Date())));
  const days = args.week ? 7 : Number(args.days || 7);
  end = new Date(start.getTime() + (days - 1) * DAY);
  label = `${iso(start)}-openings`;
  periodTitle = start.getUTCMonth() === end.getUTCMonth()
    ? `${MON3[start.getUTCMonth()]} ${start.getUTCDate()}–${end.getUTCDate()}`
    : `${MON3[start.getUTCMonth()]} ${start.getUTCDate()} – ${MON3[end.getUTCMonth()]} ${end.getUTCDate()}`;
}
const outDir = path.resolve(ROOT, String(args.out || path.join('social', label)));

// ---------- the data ----------
const guide = JSON.parse(fs.readFileSync(path.join(ROOT, 'art-gallery-guide.json'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const NAMES = Object.fromEntries([...(html.match(/const NEIGHBORHOOD_NAMES = \{([\s\S]*?)\};/) || [, ''])[1].matchAll(/(\w+):'([^']+)'/g)].map(m => [m[1], m[2]]));
const hood = t => NAMES[t] || String(t || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const MONIDX = { jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11 };

function timeText(after){
  const m = (after.match(/^,?\s*([^;.(]*)/) || [, ''])[1].match(/\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*(?:[–-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?/i);
  return m && /am|pm/i.test(m[0]) ? m[0].replace(/\s+/g, '') : '';
}
function showFor(p, when){
  const v = p.onView || '';
  const nx = v.match(/next:\s*(.+?)\s+—\s/i);
  if (nx) return nx[1].trim();
  if (/^(Between shows|No current|No public|Temporarily closed)/i.test(v)) return '';
  return v.split(/\s+—\s+/)[0].split('; ')[0].trim();
}
const events = [];
for (const p of guide.places){
  const text = p.opening || '';
  const re = /(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[a-z]*,?\s+)?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?!\d)/g;
  const ms = [...text.matchAll(re)];
  ms.forEach((m, i) => {
    const before = text.slice(i ? ms[i - 1].index + ms[i - 1][0].length : 0, m.index);
    if (/opened/i.test(before)) return;
    const after = text.slice(m.index + m[0].length, i + 1 < ms.length ? ms[i + 1].index : text.length);
    let time = timeText(after);
    if (!time && /^\s*&/.test(after) && ms[i + 1]) time = timeText(text.slice(ms[i + 1].index + ms[i + 1][0].length));
    const mon = MONIDX[m[1].toLowerCase()], day = +m[2];
    // choose the year that puts the date nearest the period
    const cands = [start.getUTCFullYear() - 1, start.getUTCFullYear(), start.getUTCFullYear() + 1].map(y => new Date(Date.UTC(y, mon, day)));
    const date = cands.sort((a, b) => Math.abs(a - start) - Math.abs(b - start))[0];
    if (date < start || date > end) return;
    let seg = before.split(/[;.]/).pop().replace(/^[\s&,]+|[—:–\-\s&,]+$/g, '').trim();
    if (/^(Reception|Opens|Opening|Next opening|Mon|Tue|Wed|Thu|Fri|Sat|Sun)?$/i.test(seg) || !/[A-Za-z]{3}/.test(seg)) seg = '';
    events.push({ date, time, gallery: p.name, show: seg || showFor(p, date), hood: hood((p.tags || [])[0]), address: p.address || '' });
  });
}
events.sort((a, b) => a.date - b.date || (a.time || 'zz').localeCompare(b.time || 'zz') || a.gallery.localeCompare(b.gallery));
const startHour = t => { const m = /^(\d{1,2})/.exec(t || ''); return m ? +m[1] : 99; };
events.sort((a, b) => a.date - b.date || startHour(a.time) - startHour(b.time) || a.gallery.localeCompare(b.gallery));

const hoods = new Set(events.map(e => e.hood));
console.log(`${events.length} openings, ${periodTitle}, ${hoods.size} neighborhoods`);
events.forEach(e => console.log(`  ${iso(e.date)} ${e.time.padEnd(10)} ${e.gallery} | ${e.show}`));
if (!events.length){ console.log('No openings found for this period; nothing built.'); process.exit(0); }

// ---------- caption ----------
const dayLine = d => `${DOW[d.getUTCDay()].slice(0, 3)}, ${MON3[d.getUTCMonth()]} ${d.getUTCDate()}`;
const capLines = [`Art gallery openings in NYC, ${periodTitle}.`, ''];
let lastDay = '';
for (const e of events){
  const dl = dayLine(e.date);
  if (dl !== lastDay){ if (lastDay) capLines.push(''); capLines.push(dl.toUpperCase()); lastDay = dl; }
  capLines.push(`${e.gallery}${e.show ? ': ' + e.show : ''}${e.time ? ' · ' + e.time : ''} (${e.hood})`);
}
capLines.push('', `Every opening across ${guide.places.length} NYC galleries, with walking routes: artloopwalk.com (link in bio).`,
  'Save this for your week, and follow @artloop for openings every week.', '',
  '#nycart #artopenings #nycgalleries #artgallery #contemporaryart ' + [...hoods].slice(0, 3).map(h => '#' + h.toLowerCase().replace(/[^a-z]/g, '') + 'galleries').join(' '));
const caption = capLines.join('\n');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'caption.txt'), caption + '\n');
if (args.dry){ console.log('\n' + caption); process.exit(0); }

// ---------- slides ----------
// Pack openings onto slides by the space they take (a 1350px slide holds about 980px of listings)
const BUDGET = 980, pages = [];
const cardH = e => 150 + (e.show ? (e.show.length > 50 ? 80 : 40) : 0) + 22;
let cur = [], used = 0, lastDayKey = '';
for (const e of events){
  const dayKey = iso(e.date);
  const need = cardH(e) + (dayKey !== lastDayKey || !cur.length ? 60 : 0);
  if (cur.length && used + need > BUDGET){ pages.push(cur); cur = []; used = 0; lastDayKey = ''; }
  used += cardH(e) + (dayKey !== lastDayKey ? 60 : 0);
  lastDayKey = dayKey; cur.push(e);
}
if (cur.length) pages.push(cur);
if (pages.length > 8) console.log(`Note: ${events.length} openings make ${pages.length} pages; Instagram allows up to 20 slides.`);

const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const F = n => pathToFileURL(path.join(ROOT, 'assets/fonts', n)).href;
const css = `
@font-face{font-family:Archivo;src:url(${F('archivo-wdth.woff2')});font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:Fraunces;src:url(${F('fraunces.woff2')});font-weight:100 900}
@font-face{font-family:'Work Sans';src:url(${F('work-sans-400.woff2')});font-weight:400}
@font-face{font-family:'Work Sans';src:url(${F('work-sans-500.woff2')});font-weight:500}
@font-face{font-family:'Work Sans';src:url(${F('work-sans-600.woff2')});font-weight:600}
@font-face{font-family:'Courier Prime';src:url(${F('courier-prime-400.woff2')});font-weight:400}
@font-face{font-family:'Courier Prime';src:url(${F('courier-prime-700.woff2')});font-weight:700}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#ccc}
.slide{width:1080px;height:1350px;background:#E8F5E5;color:#20281F;font-family:'Work Sans',sans-serif;position:relative;overflow:hidden;padding:84px 84px 0}
.brand{font-family:Archivo;font-weight:850;font-stretch:118%;font-variation-settings:'wdth' 118;letter-spacing:-.02em}
.kicker{font-family:'Courier Prime',monospace;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#1D4E4E}
.foot{position:absolute;left:84px;right:84px;bottom:64px;display:flex;justify-content:space-between;align-items:baseline;font-size:26px;color:#5A6459}
.foot b{font-family:Archivo;font-weight:800;font-stretch:112%;color:#20281F;font-size:28px}
/* cover */
.cover h1{font-size:150px;line-height:.92;margin-top:120px}
.cover .period{font-family:Archivo;font-weight:700;font-stretch:112%;font-size:64px;margin-top:44px}
.cover .meta{font-size:34px;color:#3B4439;margin-top:22px}
.cover .rule{height:3px;background:#1A1A1A;margin:64px 0 0}
.cover .swipe{font-size:32px;margin-top:40px;color:#1D4E4E;font-weight:500}
/* list pages */
.tab{display:inline-block;background:#F4FAF2;border:3px solid #1A1A1A;border-bottom:0;border-radius:22px 22px 0 0;padding:18px 30px 14px;font-family:Archivo;font-weight:800;font-stretch:112%;font-size:40px;position:relative;z-index:2}
.line{height:3px;background:#1A1A1A;margin-top:-3px}
.items{margin-top:34px;display:flex;flex-direction:column;gap:22px}
.day{font-family:'Courier Prime',monospace;font-weight:700;font-size:28px;letter-spacing:.12em;text-transform:uppercase;color:#1D4E4E;margin-top:8px}
.card{background:#FBF5E1;border:2px solid #EADFBF;border-radius:24px;padding:26px 32px 28px}
.card .g{font-family:Fraunces;font-weight:600;font-size:44px;line-height:1.1}
.card .s{font-size:30px;line-height:1.3;color:#3B4439;margin-top:8px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card .t{font-family:'Courier Prime',monospace;font-weight:700;font-size:25px;letter-spacing:.08em;text-transform:uppercase;color:#1D4E4E;margin-top:12px}
/* end */
.end h2{font-size:96px;line-height:.98;margin-top:200px}
.end p{font-size:40px;line-height:1.35;margin-top:44px;color:#3B4439}
.end .url{font-family:Archivo;font-weight:800;font-stretch:112%;font-size:58px;margin-top:70px}
.end .handle{font-family:Archivo;font-weight:800;font-stretch:112%;font-size:58px;color:#1D4E4E;margin-top:14px}
`;
const total = pages.length + 2;
const foot = n => `<div class="foot"><b>@artloop</b><span>${n} / ${total}</span></div>`;
let slides = `<section class="slide cover"><div class="kicker" style="font-size:30px">Art Loop Walk</div>
<h1 class="brand">Art Gallery Openings</h1><div class="period">${esc(periodTitle)}</div>
<div class="meta">${events.length} ${events.length === 1 ? 'opening' : 'openings'} across ${hoods.size} ${hoods.size === 1 ? 'neighborhood' : 'neighborhoods'}</div>
<div class="rule"></div><div class="swipe">Swipe for dates, times and galleries →</div>${foot(1)}</section>`;
pages.forEach((pg, i) => {
  let items = '', last = '';
  for (const e of pg){
    const dl = `${DOW[e.date.getUTCDay()]}, ${MON3[e.date.getUTCMonth()]} ${e.date.getUTCDate()}`;
    if (dl !== last){ items += `<div class="day">${esc(dl)}</div>`; last = dl; }
    items += `<div class="card"><div class="g">${esc(e.gallery)}</div>${e.show ? `<div class="s">${esc(e.show)}</div>` : ''}<div class="t">${esc([e.time, e.hood].filter(Boolean).join(' · '))}</div></div>`;
  }
  slides += `<section class="slide"><div class="tab">Openings · ${esc(periodTitle)}</div><div class="line"></div><div class="items">${items}</div>${foot(i + 2)}</section>`;
});
slides += `<section class="slide end"><div class="kicker" style="font-size:30px">Plan your walk</div>
<h2 class="brand">Every opening.<br>Every gallery.</h2>
<p>${guide.places.length} NYC galleries by neighborhood, what's on view, and walking routes in Google Maps.</p>
<div class="url">artloopwalk.com</div><div class="handle">Follow @artloop</div>${foot(total)}</section>`;
const page = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${slides}</body></html>`;
const tmp = path.join(outDir, '.slides.html');
fs.writeFileSync(tmp, page);

let pw;
try { pw = (await import('playwright')).default; }
catch { const g = execSync('npm root -g').toString().trim(); pw = (await import(pathToFileURL(path.join(g, 'playwright/index.js')).href)).default; }
const browser = await pw.chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
await tab.goto(pathToFileURL(tmp).href);
await tab.evaluate(() => document.fonts.ready);
const els = await tab.$$('section.slide');
for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`) });
await browser.close();
fs.unlinkSync(tmp);

// ---------- a phone-friendly kit page: save the slides, copy the caption ----------
const slideFiles = els.map((_, i) => `slide-${String(i + 1).padStart(2, '0')}.png`);
const kitHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>@artloop post kit · ${esc(periodTitle)}</title><meta name="robots" content="noindex">
<style>body{margin:0;background:#E8F5E5;color:#20281F;font:16px/1.5 -apple-system,system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:24px;margin:0 0 4px}p.m{color:#5A6459;margin:0 0 20px}ol{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
li img{width:100%;border-radius:10px;border:1px solid #C3DFBD;display:block}li a{font-size:13px;color:#1D4E4E}
textarea{width:100%;box-sizing:border-box;min-height:260px;font:14px/1.45 ui-monospace,Menlo,monospace;padding:12px;border-radius:10px;border:1px solid #C3DFBD;margin-top:8px}
button{margin-top:10px;font:inherit;font-weight:600;padding:10px 18px;border-radius:999px;border:1px solid #1D4E4E;background:#1D4E4E;color:#fff}h2{font-size:18px;margin:28px 0 0}</style></head>
<body><main><h1>Openings · ${esc(periodTitle)}</h1><p class="m">${events.length} openings · ${slideFiles.length} slides · built ${iso(new Date())}</p>
<p>On your phone: tap and hold each slide to save it to Photos (in order), then copy the caption and post as a carousel on @artloop.</p>
<ol>${slideFiles.map((f, i) => `<li><a href="${f}" download><img src="${f}" alt="Slide ${i + 1}"></a><a href="${f}" download>Slide ${i + 1}</a></li>`).join('')}</ol>
<h2>Caption</h2><textarea id="cap" readonly>${esc(caption)}</textarea>
<button onclick="navigator.clipboard.writeText(document.getElementById('cap').value).then(()=>{this.textContent='Copied'})">Copy caption</button>
</main></body></html>`;
fs.writeFileSync(path.join(outDir, 'index.html'), kitHtml);
// social/latest.html always points to the newest kit
const socialRoot = path.join(ROOT, 'social');
if (outDir.startsWith(socialRoot)){
  const rel = path.relative(socialRoot, outDir).split(path.sep).join('/');
  fs.writeFileSync(path.join(socialRoot, 'latest.html'), `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${rel}/"><a href="${rel}/">Latest @artloop post kit</a>\n`);
}
console.log(`\nWrote ${els.length} slides, caption.txt and a post kit page (index.html) to ${path.relative(ROOT, outDir)}`);
