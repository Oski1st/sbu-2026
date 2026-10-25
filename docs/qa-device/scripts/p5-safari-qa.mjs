// P5-02 real-Safari QA over W3C WebDriver (safaridriver). Usage: node p5-safari-qa.mjs <outDir>
// Expects `safaridriver -p 4444` to be running.
import fs from 'node:fs';
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const WD = 'http://127.0.0.1:4444';
const BASE = 'http://127.0.0.1:5174';
const Q = '/?date=2026-11-15&time=17%3A30';
const K = { Tab: '', Enter: '', Escape: '', Down: '', Shift: '', Alt: '', Meta: '' };

async function wd(method, path, body) {
  const r = await fetch(WD + path, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json();
  if (j.value && j.value.error) throw new Error(`${path}: ${j.value.error} ${j.value.message}`);
  return j.value;
}
const sess = await wd('POST', '/session', { capabilities: { alwaysMatch: { browserName: 'safari' } } });
const S = `/session/${sess.sessionId}`;
console.log('BROWSER safari', sess.capabilities.browserVersion, sess.capabilities.platformName);
const results = [];
const rec = (id, check, result, detail) => { results.push({ id, check, result, detail }); console.log(`[${result}] ${id} ${check} :: ${JSON.stringify(detail)}`); };
const go = async (p) => { await wd('POST', `${S}/url`, { url: BASE + p }); await sleep(700); };
const js = (script, args = []) => wd('POST', `${S}/execute/sync`, { script, args });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const keys = async (...seq) => { // seq items: string key or [modifier, key]
  const actions = [];
  for (const k of seq) {
    if (Array.isArray(k)) actions.push({ type: 'keyDown', value: k[0] }, { type: 'keyDown', value: k[1] }, { type: 'keyUp', value: k[1] }, { type: 'keyUp', value: k[0] });
    else for (const ch of k) actions.push({ type: 'keyDown', value: ch }, { type: 'keyUp', value: ch });
  }
  await wd('POST', `${S}/actions`, { actions: [{ type: 'key', id: 'kb', actions }] });
  await wd('DELETE', `${S}/actions`);
  await sleep(150);
};
const shot = async (name) => fs.writeFileSync(`${out}/${name}`, Buffer.from(await wd('GET', `${S}/screenshot`), 'base64'));
const setInner = async (w, h) => { // resize window so innerWidth ≈ w
  await wd('POST', `${S}/window/rect`, { width: w, height: h, x: 40, y: 40 });
  const [iw] = await js('return [innerWidth, outerWidth]');
  const dw = (await js('return outerWidth - innerWidth')) || 0;
  await wd('POST', `${S}/window/rect`, { width: w + dw, height: h });
  return js('return innerWidth');
};

try {
  const ua = await js('return navigator.userAgent'); console.log('UA', ua);
  const iw = await setInner(1280, 800); console.log('innerWidth', iw);

  // 1 Autocomplete
  await go(Q);
  await js("const o=document.getElementById('origin'); o.focus(); o.select();");
  await keys('new');
  const opts = await js("return [...document.querySelectorAll('#origin-listbox [role=option]')].map(o=>o.textContent.trim())");
  await keys(K.Down, K.Down);
  const active = await js("return document.getElementById('origin').getAttribute('aria-activedescendant')");
  await keys(K.Enter);
  const a = await js("const o=document.getElementById('origin'); return {picked:o.value, expanded:o.getAttribute('aria-expanded')}");
  rec('1a', 'suggestions + arrows + Enter', opts.length >= 2 && a.picked === 'New York' && a.expanded === 'false' ? 'PASS' : 'FAIL', { opts, active, ...a });
  await js("document.getElementById('origin').select()");
  await keys('Zzyzx');
  const nm = await js("return document.body.innerText.includes('No supported sample cities match “Zzyzx”')");
  await keys(K.Escape);
  const b = await js("const o=document.getElementById('origin'); return {expanded:o.getAttribute('aria-expanded'), focus:document.activeElement.id}");
  rec('1b', 'no-match message + Escape', nm && b.expanded === 'false' && b.focus === 'origin' ? 'PASS' : 'FAIL', { noMatchVisible: nm, ...b });

  // 2 Keyboard sweep (Tab and Option+Tab)
  for (const [label, tab] of [['Tab', K.Tab], ['Option+Tab', [K.Alt, K.Tab]]]) {
    await go(Q);
    await js("window.__log=[]; document.addEventListener('focusin', e=>{const el=e.target; __log.push((el.getAttribute('aria-label')||el.id||el.name||el.textContent.trim()).slice(0,30))}); document.activeElement.blur(); scrollTo(0,0);");
    for (let i = 0; i < 20; i++) await keys(tab);
    const fwd = await js('return __log.length');
    for (let i = 0; i < 4; i++) await keys(Array.isArray(tab) ? [K.Shift, K.Tab] : [K.Shift, K.Tab]);
    const log = await js('return __log');
    rec(`2-${label}`, `${label} order / no trap`, fwd >= 6 && log.includes('origin') ? 'PASS' : 'FAIL', { forwardFocusEvents: fwd, order: log });
  }
  // focus appearance on To (keyboard)
  await go(Q);
  await js("document.querySelector('.swap-button').focus()");
  await keys(K.Tab); await sleep(400);
  const f = await js("const el=document.activeElement,c=getComputedStyle(el); return {id:el.id, outline:c.outlineStyle+' '+c.outlineWidth+' '+c.outlineColor, borderBottom:c.borderBottomStyle+' '+c.borderBottomWidth+' '+c.borderBottomColor}");
  await shot('p5-02-safari-focus-destination-keyboard-1280.png');
  rec('2c', 'To focus indicator (computed)', 'SEE-CONTRAST', f);

  // 3 Date typing, submit, Back
  await go(Q);
  await js("document.querySelector('input[name=departure-date]').focus()");
  await keys('12252026');
  const typed = await js("return document.querySelector('input[name=departure-date]').value");
  await js("document.querySelector('button[type=submit]').focus()"); await keys(K.Enter); await sleep(600);
  const urlAfter = await wd('GET', `${S}/url`);
  await wd('POST', `${S}/back`, {}); await sleep(700);
  const back = await js("return document.querySelector('input[name=departure-date]').value");
  rec('3', 'type date, submit, Back', typed === '2026-12-25' && urlAfter.includes('date=2026-12-25') && back === '2026-11-15' ? 'PASS' : 'FAIL', { typed, urlAfter: urlAfter.replace(BASE, ''), afterBack: back });

  // 4 Narrow widths (real Safari window; minimum width may be limited)
  for (const w of [375, 390]) {
    const got = await setInner(w, 812);
    await go(Q);
    await js("const s=document.querySelector('.date-time-controls'); scrollTo(0, scrollY + s.getBoundingClientRect().top - 200)");
    await sleep(300);
    const m = await js("const i=document.querySelector('input[name=departure-date]'), r=i.getBoundingClientRect(); return {innerWidth, dateW:Math.round(r.width), dir:getComputedStyle(document.querySelector('.date-time-controls')).flexDirection, docScrollW:document.documentElement.scrollWidth}");
    await shot(`p5-02-safari-window-${w}.png`);
    rec(`4-${w}`, `date/time at requested ${w}px`, got === w ? 'SEE-SCREENSHOT' : 'BLOCKED', m);
  }

  // 5 Zoom: Safari has no WebDriver zoom; use CSS zoom:2 on <html> at 1280 as an approximation
  await setInner(1280, 800);
  const z = {};
  for (const [name, p] of [['search', Q], ['journey', '/journey/regional-connection'], ['wallet', '/wallet/regional-connection']]) {
    await go(p);
    z[name] = await js("document.documentElement.style.zoom='2'; return new Promise(r=>setTimeout(()=>r({vw:innerWidth, scrollW:document.documentElement.scrollWidth}),400))");
    await shot(`p5-02-safari-csszoom200-${name}.png`);
  }
  rec('5', 'CSS zoom 200% approximation, no horizontal overflow', Object.values(z).every(r => r.scrollW <= r.vw + 1) ? 'PASS' : 'FAIL', z);
} finally {
  fs.writeFileSync(`${out}/results-safari.json`, JSON.stringify({ engine: 'safari', version: sess.capabilities.browserVersion, results }, null, 2));
  await wd('DELETE', S).catch(() => {});
}
