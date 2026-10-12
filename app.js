'use strict';
(function () {

/* ================= constanten ================= */
const KEY = 'bodybalanz.v1';
const DAY = 86400000;
const MIN_AVG = 3; // minimaal aantal metingen voor een geldig gemiddelde
const SITES = ['Buik links', 'Buik rechts', 'Bovenarm', 'Bovenbeen links', 'Bovenbeen rechts'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const DOW = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
const DOW_SHORT = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const ICAL_DAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/* ================= hulpfuncties ================= */
const $ = (s, r) => (r || document).querySelector(s);
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const toISO = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const fromISO = (s) => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const today = () => toISO(new Date());
const addDays = (s, n) => { const d = fromISO(s); d.setDate(d.getDate() + n); return toISO(d); };
const diffDays = (a, b) => Math.round((fromISO(b) - fromISO(a)) / DAY);
const round2 = (n) => Math.round(n * 100) / 100;
const nl = (n, dec) => (n == null || isNaN(n)) ? '–' : String(Number(Number(n).toFixed(dec == null ? 2 : dec))).replace('.', ',');
const num = (v) => { if (v == null) return null; const t = String(v).trim().replace(',', '.'); if (t === '') return null; const n = Number(t); return isFinite(n) ? n : NaN; };
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const fmtLongParts = (s) => { const d = fromISO(s); return [DOW[d.getDay()], d.getDate() + ' ' + MONTHS_LONG[d.getMonth()]]; };
const fmtDM = (s) => { const d = fromISO(s); return d.getDate() + ' ' + MONTHS[d.getMonth()]; };
const fmtDMY = (s) => fmtDM(s) + ' ' + fromISO(s).getFullYear();
const fmtSmart = (s) => (fromISO(s).getFullYear() === new Date().getFullYear() ? fmtDM(s) : fmtDMY(s));
const fmtDow = (s) => DOW_SHORT[fromISO(s).getDay()] + ' ' + fmtDM(s);
const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const signed = (n, dec) => (n > 0.0499 ? '+' : n < -0.0499 ? '−' : '') + nl(Math.abs(n), dec == null ? 1 : dec);

/* ================= iconen ================= */
const svgi = (inner) => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
const I = {
  home: svgi('<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'),
  pill: svgi('<g transform="rotate(-45 12 12)"><rect x="2.5" y="8.5" width="19" height="7" rx="3.5"/><path d="M12 8.5v7"/></g>'),
  ruler: svgi('<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v3"/><path d="M11 8v4"/><path d="M15 8v3"/><path d="M19 8v2"/>'),
  leaf: svgi('<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19c3-4 6-7 10-9"/>'),
  sliders: svgi('<path d="M4 7h9"/><path d="M17 7h3"/><path d="M4 17h3"/><path d="M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'),
  chev: '<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#B8A595" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>'
};

/* ================= gegevens ================= */
function defaults() {
  return {
    v: 1,
    setup: false,
    settings: {
      doseMg: null, intervalDays: null, penMg: null, firstDue: null,
      weightLimit: null, trendLimit: null, recipeWeeks: 4,
      proteinTarget: null, waterTargetMl: null,
      remindTime: '09:00', weighDay: null,
      sites: SITES.slice()
    },
    pens: [], shots: [], measurements: [], intake: {}
  };
}
function normalize(o) {
  const s = Object.assign(defaults(), o || {});
  s.settings = Object.assign(defaults().settings, (o && o.settings) || {});
  ['pens', 'shots', 'measurements'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
  if (!s.intake || typeof s.intake !== 'object' || Array.isArray(s.intake)) s.intake = {};
  if (!Array.isArray(s.settings.sites) || !s.settings.sites.length) s.settings.sites = SITES.slice();
  return s;
}
let S = (function () {
  try { const raw = localStorage.getItem(KEY); if (raw) return normalize(JSON.parse(raw)); } catch (e) { /* leeg starten */ }
  return defaults();
})();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Opslaan lukt niet. Maak een back-up.'); }
}
const UI = { tab: 'start', med: 'prikken', inst: null, vo: 'eiwit', skipInstall: false };

/* ================= berekeningen ================= */
const activePen = () => S.pens.find((p) => p.status === 'active') || null;
const stockPens = () => S.pens.filter((p) => p.status === 'stock');
const lastShot = () => (S.shots.length ? S.shots.reduce((a, b) => (a.date >= b.date ? a : b)) : null);

function nextShotDate() {
  const l = lastShot();
  if (l) return S.settings.intervalDays ? addDays(l.date, S.settings.intervalDays) : null;
  return S.settings.firstDue || null;
}

// Verdeelt de komende prikken over de pennen: eerst de actieve pen, daarna de voorraad.
function schedule(count) {
  const dose = S.settings.doseMg, iv = S.settings.intervalDays, out = [];
  if (!dose || !iv) return out;
  const pens = S.pens.filter((p) => p.status !== 'empty')
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'active' ? -1 : 1))
    .map((p) => ({ id: p.id, rest: p.restMg, started: p.status === 'active' }));
  let d = nextShotDate(), pi = 0;
  if (!d) return out;
  for (let i = 0; i < count; i++) {
    while (pi < pens.length && pens[pi].rest + 1e-6 < dose) pi++;
    const p = pens[pi] || null;
    let newPen = false;
    if (p) { if (!p.started) { newPen = true; p.started = true; } p.rest = round2(p.rest - dose); }
    out.push({ date: d, mg: dose, penId: p ? p.id : null, newPen: newPen });
    d = addDays(d, iv);
  }
  return out;
}

function supply() {
  const dose = S.settings.doseMg, iv = S.settings.intervalDays;
  if (!dose || !iv) return null;
  const next = nextShotDate();
  if (!next) return null;
  const doses = S.pens.filter((p) => p.status !== 'empty').reduce((n, p) => n + Math.floor((p.restMg + 1e-6) / dose), 0);
  if (doses <= 0) return { doses: 0, next: next, last: null, after: next, recipe: null };
  const last = addDays(next, (doses - 1) * iv);
  const after = addDays(last, iv);
  const weeks = S.settings.recipeWeeks == null ? 4 : S.settings.recipeWeeks;
  return { doses: doses, next: next, last: last, after: after, recipe: addDays(after, -7 * weeks) };
}

function penPlan() {
  const sup = supply(), map = {};
  if (!sup || sup.doses <= 0) return map;
  schedule(sup.doses).forEach((e) => {
    if (!e.penId) return;
    const m = map[e.penId] || (map[e.penId] = { first: e.date, last: e.date, count: 0 });
    m.last = e.date; m.count++;
  });
  return map;
}

function applyShotToPens(shot) {
  let pen = activePen();
  if (!pen || pen.restMg + 1e-6 < shot.mg) {
    if (pen) { pen.status = 'empty'; pen.endedOn = shot.date; }
    pen = S.pens.find((p) => p.status === 'stock' && p.restMg + 1e-6 >= shot.mg) || null;
    if (pen) { pen.status = 'active'; pen.startedOn = shot.date; }
  }
  if (pen) {
    pen.restMg = round2(pen.restMg - shot.mg);
    shot.penId = pen.id;
    if (pen.restMg <= 0.001) { pen.restMg = 0; pen.status = 'empty'; pen.endedOn = shot.date; }
  }
}

function suggestSite() {
  const sites = S.settings.sites, used = {};
  S.shots.forEach((s) => { if (s.site) used[s.site] = Math.max(used[s.site] || 0, Number(s.date.replace(/-/g, ''))); });
  if (!S.shots.some((s) => s.site)) return null;
  const never = sites.find((x) => !used[x]);
  if (never) return never;
  return sites.slice().sort((a, b) => used[a] - used[b])[0];
}

function weightStats() {
  const t = today();
  const ms = S.measurements.filter((m) => m.weight != null);
  const inWin = (a, b) => ms.filter((m) => { const d = diffDays(m.date, t); return d >= a && d <= b; });
  const avg = (a) => a.reduce((x, m) => x + m.weight, 0) / a.length;
  const cur = inWin(0, 6), prev = inWin(28, 34);
  const avg7 = cur.length >= MIN_AVG ? avg(cur) : null;
  const avgPrev = prev.length >= MIN_AVG ? avg(prev) : null;
  const trend = avg7 != null && avgPrev != null ? avg7 - avgPrev : null;
  const latest = ms.slice().sort(byDate).pop() || null;
  const lim = S.settings.weightLimit, tl = S.settings.trendLimit;
  return {
    avg7: avg7, trend: trend, latest: latest, n7: cur.length,
    above: lim != null && avg7 != null && avg7 > lim,
    rise: tl != null && trend != null && trend >= tl
  };
}
const latestOf = (k) => { const a = S.measurements.filter((m) => m[k] != null).sort(byDate); return a.length ? a[a.length - 1][k] : null; };

/* ================= instellingen ================= */
const SETTING_DEFS = {
  doseMg: { label: 'Dosis', suffix: 'mg', hint: 'Geldt voor nieuwe prikken. Eerdere prikken houden hun dosis.' },
  intervalDays: { label: 'Interval', suffix: 'dagen', int: true, unit: ' dagen', hint: 'De volgende prikdatum wordt opnieuw berekend vanaf je laatste prik.' },
  penMg: { label: 'Inhoud nieuwe pen', suffix: 'mg' },
  recipeWeeks: { label: 'Receptherinnering vooraf', suffix: 'weken', int: true, unit: ' weken', allowZero: true },
  weightLimit: { label: 'Bovengrens gemiddelde', suffix: 'kg', nullable: true },
  trendLimit: { label: 'Stijging in 4 weken', suffix: 'kg', nullable: true },
  proteinTarget: { label: 'Streefwaarde eiwit', suffix: 'g per dag', nullable: true },
  waterTargetMl: { label: 'Streefwaarde water', suffix: 'liter per dag', nullable: true, scale: 1000 }
};
function fmtSetting(k) {
  const d = SETTING_DEFS[k], v = S.settings[k];
  if (v == null) return 'Niet ingesteld';
  const shown = d.scale ? v / d.scale : v;
  return nl(shown, 2) + (d.unit || ' ' + d.suffix.replace(' per dag', ''));
}

/* ================= tekenhulp ================= */
function fld(o) {
  return '<label class="fld"><span class="fld-l">' + esc(o.label) + '</span><span class="fld-w"><input name="' + o.name + '" type="' + (o.type || 'text') + '"' +
    (o.inputmode ? ' inputmode="' + o.inputmode + '"' : '') + ' value="' + esc(o.value == null ? '' : o.value) + '"' +
    (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + (o.autofocus ? ' autofocus' : '') + ' autocomplete="off">' +
    (o.suffix ? '<span class="suf">' + esc(o.suffix) + '</span>' : '') + '</span>' +
    (o.hint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') + '</label>';
}
function sel(name, label, opts, val) {
  return '<label class="fld"><span class="fld-l">' + esc(label) + '</span><span class="fld-w"><select name="' + name + '">' +
    opts.map((o) => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
    '</select></span></label>';
}
let toastT;
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3400);
}

let sheetDelete = null;
function openSheet(o) {
  $('#sheet-root').innerHTML =
    '<div class="overlay" data-act="closeSheet"></div><section class="sheet" role="dialog" aria-modal="true" aria-label="' + esc(o.title) + '"><div class="grab"></div><h2>' + esc(o.title) + '</h2>' +
    '<form id="sheet-form" novalidate>' + o.body +
    '<div class="sheet-actions"><button type="button" class="btn btn-ghost" data-act="closeSheet">' + esc(o.cancel || 'Annuleer') + '</button>' +
    (o.submit === null ? '' : '<button class="btn btn-primary" type="submit">' + esc(o.submit || 'Opslaan') + '</button>') + '</div>' +
    (o.onDelete ? '<div class="sheet-del"><button type="button" class="btn btn-danger" data-act="sheetDelete">' + esc(o.deleteLabel || 'Verwijderen') + '</button></div>' : '') +
    '</form></section>';
  document.body.classList.add('sheet-open');
  sheetDelete = o.onDelete || null;
  const f = $('#sheet-form');
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (!o.onSubmit) { closeSheet(); return; }
    const vals = {};
    new FormData(f).forEach((v, k) => { vals[k] = v; });
    if (o.onSubmit(vals) !== false) closeSheet();
  });
  setTimeout(() => { const a = f.querySelector('[autofocus]'); if (a) a.focus(); }, 60);
}
function closeSheet() { $('#sheet-root').innerHTML = ''; document.body.classList.remove('sheet-open'); sheetDelete = null; }

/* ================= schermen ================= */
function render(keep) {
  const app = $('#app');
  const prev = $('#scroll');
  const top = prev && keep ? prev.scrollTop : 0;
  if (!S.setup) {
    app.innerHTML = needsInstallHint() ? vInstall() : vWelcome();
    return;
  }
  const views = { start: vStart, med: vMed, meet: vMeet, voed: vVoed, inst: vInst };
  app.innerHTML = '<main class="scroll" id="scroll">' + views[UI.tab]() + '</main>' + navHtml();
  const sc = $('#scroll'); if (sc) sc.scrollTop = top;
}
function navHtml() {
  const items = [['start', 'Start', I.home], ['med', 'Medicatie', I.pill], ['meet', 'Metingen', I.ruler], ['voed', 'Voeding', I.leaf], ['inst', 'Instellingen', I.sliders]];
  return '<nav aria-label="Hoofdmenu">' + items.map((i) => '<button data-act="tab" data-tab="' + i[0] + '"' + (UI.tab === i[0] ? ' aria-current="page"' : '') + '>' + i[2] + i[1] + '</button>').join('') + '</nav>';
}
function isStandalone() { return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
function needsInstallHint() { return isIOS() && !isStandalone() && !UI.skipInstall; }

function vInstall() {
  return '<main class="scroll welcome"><img class="logo" src="icons/icon-192.png" alt=""><h1>Zet BodyBalanz eerst op je beginscherm</h1>' +
    '<p class="lead">Je gegevens worden per app apart bewaard. Voeg de app daarom eerst toe, voordat je iets invult.</p>' +
    '<div class="card"><ol class="steps"><li>Tik onderin Safari op het deel-icoon (vierkantje met pijl omhoog).</li><li>Kies <b>Zet op beginscherm</b>.</li><li>Tik op <b>Voeg toe</b> en open BodyBalanz via het nieuwe icoon.</li></ol></div>' +
    '<button class="linkbtn" data-act="skipInstall">Toch hier doorgaan</button></main>';
}

function vWelcome() {
  return '<main class="scroll welcome"><img class="logo" src="icons/icon-192.png" alt=""><h1>Welkom bij BodyBalanz</h1>' +
    '<p class="lead">Vul eenmalig je schema in. Alles blijft op dit toestel, er wordt niets verstuurd.</p>' +
    '<form id="welcome-form" novalidate>' +
    '<section class="card"><div class="eyebrow">Medicatie</div>' +
    fld({ name: 'doseMg', label: 'Dosis per prik', inputmode: 'decimal', suffix: 'mg' }) +
    fld({ name: 'intervalDays', label: 'Interval', inputmode: 'numeric', suffix: 'dagen' }) +
    fld({ name: 'firstDue', label: 'Datum van je volgende prik', type: 'date', value: today() }) + '</section>' +
    '<section class="card"><div class="eyebrow">Pennen</div>' +
    fld({ name: 'activeRest', label: 'Wat er nog in je huidige pen zit', inputmode: 'decimal', suffix: 'mg', hint: 'Laat leeg als je nog geen pen in gebruik hebt.' }) +
    fld({ name: 'stockCount', label: 'Ongebruikte pennen in voorraad', inputmode: 'numeric', value: '0' }) +
    fld({ name: 'penMg', label: 'Inhoud per pen in voorraad', inputmode: 'decimal', suffix: 'mg' }) + '</section>' +
    '<section class="card"><div class="eyebrow">Gewichtsgrenzen (optioneel)</div>' +
    fld({ name: 'weightLimit', label: 'Bovengrens van je 7-daags gemiddelde', inputmode: 'decimal', suffix: 'kg' }) +
    fld({ name: 'trendLimit', label: 'Seintje bij een stijging in 4 weken van', inputmode: 'decimal', suffix: 'kg' }) + '</section>' +
    '<button class="btn btn-primary" type="submit">Starten</button>' +
    '<button type="button" class="linkbtn" data-act="restore">Ik heb een back-up</button></form></main>';
}

function handleWelcome(fd) {
  const v = {}; fd.forEach((x, k) => { v[k] = x; });
  const dose = num(v.doseMg), iv = num(v.intervalDays), due = v.firstDue;
  const rest = num(v.activeRest), stock = num(v.stockCount), penMg = num(v.penMg);
  const wl = num(v.weightLimit), tl = num(v.trendLimit);
  if (!(dose > 0) || !(iv >= 1) || !due) return toast('Vul dosis, interval en datum van je volgende prik in.');
  if ([rest, stock, penMg, wl, tl].some((x) => Number.isNaN(x))) return toast('Controleer de ingevulde getallen.');
  const n = stock == null ? 0 : Math.round(stock);
  if (n > 0 && !(penMg > 0)) return toast('Vul de inhoud per pen in.');
  S = defaults();
  Object.assign(S.settings, { doseMg: dose, intervalDays: Math.round(iv), firstDue: due, penMg: penMg > 0 ? penMg : null, weightLimit: wl, trendLimit: tl });
  if (rest > 0) S.pens.push({ id: uid(), mg: null, restMg: rest, status: 'active', startedOn: null });
  for (let i = 0; i < n; i++) S.pens.push({ id: uid(), mg: penMg, restMg: penMg, status: 'stock' });
  S.setup = true;
  save(); UI.tab = 'start'; render(false); toast('Klaar. Je schema staat erin.');
}

/* ---------- Start ---------- */
function vStart() {
  const st = S.settings, t = today(), next = nextShotDate(), sup = supply(), ws = weightStats();
  const days = next ? diffDays(t, next) : null;
  const alerts = [];
  if (ws.above) alerts.push('Je 7-daags gemiddelde van ' + nl(ws.avg7, 1) + ' kg ligt boven je grens van ' + nl(st.weightLimit, 1) + ' kg.');
  if (ws.rise) alerts.push('Je gewicht is in 4 weken ' + nl(ws.trend, 1) + ' kg gestegen. Je grens is ' + nl(st.trendLimit, 1) + ' kg.');
  if (sup && sup.doses === 0) alerts.push('Je hebt geen pen met genoeg inhoud voor de volgende prik.');
  else if (sup && sup.recipe && sup.recipe <= t) alerts.push('Tijd om een recept aan te vragen. Je voorraad is leeg na ' + fmtSmart(sup.last) + '.');

  let hero;
  if (next) {
    const sch = schedule(1)[0];
    let note = '';
    if (sch) {
      const pen = S.pens.find((p) => p.id === sch.penId);
      if (sch.newPen) note = ' · nieuwe pen starten';
      else if (pen && pen.restMg - sch.mg + 1e-6 < st.doseMg) note = ' · laatste uit deze pen';
    }
    const parts = fmtLongParts(next);
    const iv = st.intervalDays || 10;
    const frac = clamp((iv - days) / iv, 0, 1), C = 2 * Math.PI * 45;
    const n = days === 0 ? '0' : String(Math.abs(days));
    const l = days === 0 ? 'vandaag' : days < 0 ? 'te laat' : days === 1 ? 'dag' : 'dagen';
    hero = '<section class="hero"><div class="hero-top"><div class="hero-txt"><div class="eyebrow warm">Volgende prik</div>' +
      '<div class="hero-date">' + esc(parts[0]) + '<br>' + esc(parts[1]) + '</div><div class="hero-sub">' + nl(st.doseMg) + ' mg' + esc(note) + '</div></div>' +
      '<div class="ring"><svg width="108" height="108" viewBox="0 0 108 108" aria-hidden="true"><circle class="ring-track" cx="54" cy="54" r="45" fill="none" stroke-width="10"/>' +
      (frac > 0 ? '<circle class="ring-prog" cx="54" cy="54" r="45" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * frac).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 54 54)"/>' : '') +
      '</svg><div class="ring-in"><div class="ring-n">' + n + '</div><div class="ring-l">' + l + '</div></div></div></div>' +
      '<button class="btn btn-primary" data-act="shot">Prik registreren</button></section>';
  } else {
    hero = '<section class="hero"><div class="hero-date">Geen prikschema</div><div class="hero-sub">Stel dosis en interval in bij Instellingen.</div></section>';
  }

  const plan = penPlan(), ns = stockPens()[0];
  let c1;
  if (ns && plan[ns.id]) c1 = ['Nieuwe pen', fmtSmart(plan[ns.id].first), nl(ns.mg) + ' mg · ' + plan[ns.id].count + ' prikken'];
  else if (ns) c1 = ['Nieuwe pen', 'Staat klaar', nl(ns.mg) + ' mg'];
  else c1 = ['Voorraad', 'Geen pen', 'Voeg een pen toe'];
  let c2;
  if (sup && sup.recipe) c2 = ['Recept', sup.recipe <= t ? 'Nu aanvragen' : fmtSmart(sup.recipe), 'Voorraad t/m ' + fmtSmart(sup.last)];
  else c2 = ['Recept', 'Onbekend', 'Geen voorraad'];
  const cards = '<div class="grid2"><section class="mini tint-butter"><div class="eyebrow butter-ink">' + c1[0] + '</div><div class="mini-v">' + esc(c1[1]) + '</div><div class="mini-s" style="color:#6B5320">' + esc(c1[2]) + '</div></section>' +
    '<section class="mini tint-blush"><div class="eyebrow blush-ink">' + c2[0] + '</div><div class="mini-v">' + esc(c2[1]) + '</div><div class="mini-s" style="color:#7A3A2F">' + esc(c2[2]) + '</div></section></div>';

  const big = ws.avg7 != null ? nl(ws.avg7, 1) + ' kg' : ws.latest ? nl(ws.latest.weight, 1) + ' kg' : '– kg';
  const cap = ws.avg7 != null ? '7-daags gemiddelde' : ws.latest ? 'Laatste meting. Gemiddelde na ' + MIN_AVG + ' metingen in 7 dagen.' : '7-daags gemiddelde';
  const tl = st.trendLimit, frac2 = ws.trend != null && tl ? clamp(Math.max(ws.trend, 0) / tl, 0, 1) : 0;
  const weightCard = '<section class="card"><div class="between"><div class="col"><div class="eyebrow">Gewicht</div><div class="big">' + big + '</div><div class="small">' + esc(cap) + '</div></div>' +
    '<button class="btn btn-primary btn-sm" style="flex:none;height:48px;padding:0 24px;border-radius:16px;font-size:15px" data-act="measure" data-focus="weight">Wegen</button></div>' +
    '<div style="display:flex;flex-direction:column;gap:8px"><div class="trend-top"><b>Trend over 4 weken</b><span>' + (ws.trend != null ? signed(ws.trend, 1) + ' kg' : '– kg') + '</span></div>' +
    '<div class="track"><div class="track-fill' + (ws.rise ? ' hot' : '') + '" style="width:' + (frac2 * 100).toFixed(0) + '%"></div>' + (tl ? '<div class="track-mark"></div>' : '') + '</div>' +
    '<div class="trend-foot"><span>' + (st.weightLimit != null ? 'Seintje boven ' + nl(st.weightLimit, 1) + ' kg gemiddeld' : 'Geen bovengrens ingesteld') + '</span><span>' + (tl ? '+' + nl(tl, 1) + ' kg' : '') + '</span></div></div>' +
    '<div class="btn-row"><button class="btn btn-ghost btn-sm" data-act="measure" data-focus="waist">Taille meten</button><button class="btn btn-ghost btn-sm" data-act="measure" data-focus="hips">Heupen meten</button></div></section>';

  const okNote = !alerts.length && (ws.avg7 != null) ? '<div class="ok-note">Je gewicht zit binnen je grenzen.</div>' : '';
  return '<div class="head"><div class="dateline">' + esc(DOW[new Date().getDay()] + ' ' + fmtLongParts(t)[1]) + '</div><h1>Vandaag</h1></div>' +
    alerts.map((a) => '<div class="alert" role="alert">' + esc(a) + '</div>').join('') + hero + cards + weightCard + okNote;
}

/* ---------- Medicatie ---------- */
function vMed() {
  const seg = '<div class="seg" role="group" aria-label="Onderdeel"><button data-act="medSeg" data-v="prikken" aria-pressed="' + (UI.med === 'prikken') + '">Prikken</button><button data-act="medSeg" data-v="pen" aria-pressed="' + (UI.med === 'pen') + '">Pen en voorraad</button></div>';
  return '<h1>Medicatie</h1>' + seg + (UI.med === 'prikken' ? vMedPrik() : vMedPen());
}
function vMedPrik() {
  const st = S.settings, t = today(), next = nextShotDate(), sugg = suggestSite();
  const sch = schedule(4);
  let top;
  if (next) {
    const days = diffDays(t, next), p = fmtLongParts(next);
    const when = days === 0 ? 'vandaag' : days < 0 ? Math.abs(days) + (Math.abs(days) === 1 ? ' dag' : ' dagen') + ' te laat' : 'over ' + days + (days === 1 ? ' dag' : ' dagen');
    top = '<section class="hero" style="padding:20px;gap:14px"><div class="col" style="gap:4px"><div class="eyebrow warm">Volgende prik</div><div class="hero-date">' + esc(p[0] + ' ' + p[1]) + '</div>' +
      '<div class="hero-sub">' + nl(st.doseMg) + ' mg · ' + esc(when) + '</div></div>' +
      '<div class="small" style="color:#6B4A38">Voorgestelde prikplek: <b>' + esc(sugg || 'kies bij het registreren') + '</b></div>' +
      '<button class="btn btn-primary" data-act="shot">Prik registreren</button></section>';
  } else top = '<section class="hero"><div class="hero-date">Geen prikschema</div></section>';
  const later = sch.slice(1, 4).map((e) => '<div class="lrow"><b>' + esc(fmtDow(e.date)) + '</b><span class="r">' + (e.newPen ? 'Nieuwe pen starten · ' : '') + nl(e.mg) + ' mg</span></div>').join('');
  const log = S.shots.slice().sort(byDate).reverse().slice(0, 8).map((s) =>
    '<button class="lrow" data-act="shotDetail" data-id="' + s.id + '"><b>' + esc(fmtSmart(s.date)) + '</b><span class="r">' + esc((s.site ? s.site + ' · ' : '') + nl(s.mg) + ' mg') + '</span></button>').join('');
  return top +
    '<section class="card list"><div class="eyebrow">Daarna</div>' + (later || '<div class="empty">Nog geen vervolg te berekenen.</div>') + '</section>' +
    '<section class="card tint-butter list" style="padding-bottom:14px"><div class="eyebrow butter-ink">Logboek</div>' +
    (log || '<div class="empty" style="color:#6B5320">Nog geen prikken vastgelegd.</div>') +
    '<div style="padding-top:8px"><button class="btn btn-soft btn-sm" data-act="pastShot">Eerdere prik toevoegen</button></div></section>';
}

function penCard(p, label, info, canStart) {
  const dose = S.settings.doseMg;
  const total = p.mg ? Math.round(p.mg / dose) : null;
  const left = Math.floor((p.restMg + 1e-6) / dose);
  const used = total != null ? Math.max(0, total - left) : 0;
  const dots = total ? '<div class="dots" role="img" aria-label="' + left + ' van ' + total + ' prikken over">' + Array.from({ length: total }, (_, i) => '<div class="dot' + (i < used ? ' used' : '') + '"></div>').join('') + '</div>' : '';
  const infoHtml = info ? '<div class="grid2"><div class="col"><div class="small" style="color:#6B5320">Eerste prik</div><div style="font-size:17px;font-weight:800">' + esc(fmtSmart(info.first)) + '</div></div>' +
    '<div class="col"><div class="small" style="color:#6B5320">Laatste prik</div><div style="font-size:17px;font-weight:800">' + esc(fmtSmart(info.last)) + '</div></div></div>' : '';
  return '<section class="hero tint-butter" style="background:var(--butter);box-shadow:0 14px 30px -18px rgba(150,110,20,.45);padding:20px;gap:14px"><div class="eyebrow butter-ink">' + esc(label) + '</div>' +
    '<div class="between"><div class="big" style="font-size:38px;line-height:1">' + nl(p.restMg) + ' mg</div><div class="small" style="color:#6B5320;text-align:right">' + left + (left === 1 ? ' prik' : ' prikken') + ' over' + (total ? ' van ' + total : '') + '</div></div>' +
    dots + infoHtml +
    '<div class="btn-row"><button class="btn btn-soft btn-sm" data-act="penCorrect" data-pen="' + p.id + '">Restand corrigeren</button>' +
    (canStart ? '<button class="btn btn-primary btn-sm" data-act="penStart" data-pen="' + p.id + '">Pen starten</button>' : '') + '</div></section>';
}
function vMedPen() {
  const st = S.settings, plan = penPlan(), act = activePen(), stock = stockPens(), sup = supply(), t = today();
  if (!st.doseMg) return '<p class="lead">Stel eerst je dosis in bij Instellingen.</p>';
  let main = '';
  const first = stock[0];
  if (first) main = penCard(first, 'Nieuwe pen' + (plan[first.id] ? ' · start ' + fmtSmart(plan[first.id].first) : ''), plan[first.id], true);
  else if (act) main = penCard(act, 'Huidige pen', plan[act.id], false);
  else main = '<section class="card"><div class="eyebrow">Geen pen</div><div class="small">Voeg een pen toe om je voorraad bij te houden.</div></section>';
  let cur = '';
  if (first && act) {
    const left = Math.floor((act.restMg + 1e-6) / st.doseMg);
    cur = '<section class="card"><div class="between"><div class="col"><div class="eyebrow">Huidige pen</div><div style="font-size:14px;font-weight:600">' +
      (left > 0 && plan[act.id] ? left + (left === 1 ? ' prik' : ' prikken') + ' over (' + nl(act.restMg) + ' mg), laatste prik ' + esc(fmtSmart(plan[act.id].last)) : 'Niet genoeg voor een volgende prik (' + nl(act.restMg) + ' mg)') + '</div></div>' +
      (left <= 1 ? '<span class="pill">Loopt af</span>' : '') + '</div></section>';
  }
  const rec = sup && sup.recipe ? 'Recept aanvragen op ' + fmtSmart(sup.recipe) + ', ' + (st.recipeWeeks == null ? 4 : st.recipeWeeks) + ' weken vooraf.' : 'Zonder voorraad is er geen receptdatum.';
  const stockCard = '<section class="card tint-blush"><div class="eyebrow blush-ink">Voorraad</div><div class="grid2"><div class="col"><div class="small" style="color:#7A3A2F">Pennen in voorraad</div><div style="font-size:24px;font-weight:800;letter-spacing:-.02em">' + stock.length + '</div></div>' +
    '<div class="col"><div class="small" style="color:#7A3A2F">Voorraad reikt tot</div><div style="font-size:24px;font-weight:800;letter-spacing:-.02em">' + (sup && sup.last ? esc(fmtSmart(sup.last).replace(/ 20\d\d$/, '')) : '–') + '</div></div></div>' +
    '<div class="small" style="color:#7A3A2F">' + esc(rec) + '</div><button class="btn btn-soft btn-sm" data-act="penAdd">Pen toevoegen</button></section>';
  void t;
  return main + cur + stockCard;
}

/* ---------- Metingen ---------- */
function chartSvg() {
  const W = 314, H = 140, L = 34, R = 8, T = 14, B = 22;
  const data = S.measurements.filter((m) => m.weight != null).sort(byDate).filter((m) => m.date >= addDays(today(), -90));
  const lim = S.settings.weightLimit;
  if (data.length < 2) {
    return '<svg class="chart" viewBox="0 0 ' + W + ' 70" role="img" aria-label="Grafiek gewicht, nog te weinig metingen">' +
      (lim != null ? '<line class="c-lim" x1="0" y1="18" x2="' + W + '" y2="18"/><text class="c-t" x="' + W + '" y="11" text-anchor="end">' + nl(lim, 1) + ' kg grens</text>' : '') +
      '<line class="c-base" x1="0" y1="62" x2="' + W + '" y2="62"/><text class="c-t" x="' + (W / 2) + '" y="44" text-anchor="middle" style="font-size:12px">Je eerste metingen verschijnen hier</text></svg>';
  }
  const t0 = fromISO(data[0].date).getTime();
  const t1 = Math.max(fromISO(today()).getTime(), fromISO(data[data.length - 1].date).getTime());
  const span = Math.max(t1 - t0, 7 * DAY);
  const xs = (d) => L + (fromISO(d).getTime() - t0) / span * (W - L - R);
  const vals = data.map((m) => m.weight); if (lim != null) vals.push(lim);
  let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
  if (hi - lo < 1) { lo -= 0.5; hi += 0.5; }
  const padv = (hi - lo) * 0.12; lo -= padv; hi += padv;
  const ys = (v) => T + (hi - v) / (hi - lo) * (H - T - B);
  const pts = [];
  data.forEach((m) => {
    const w = data.filter((x) => { const d = diffDays(x.date, m.date); return d >= 0 && d <= 6; });
    if (w.length >= MIN_AVG) pts.push(xs(m.date).toFixed(1) + ',' + ys(w.reduce((a, b) => a + b.weight, 0) / w.length).toFixed(1));
  });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Grafiek gewicht over de afgelopen weken">' +
    (lim != null ? '<line class="c-lim" x1="' + L + '" y1="' + ys(lim).toFixed(1) + '" x2="' + W + '" y2="' + ys(lim).toFixed(1) + '"/><text class="c-t" x="' + W + '" y="' + (ys(lim) - 4).toFixed(1) + '" text-anchor="end">' + nl(lim, 1) + ' kg grens</text>' : '') +
    '<text class="c-t" x="0" y="' + (T + 8) + '">' + nl(hi - padv, 1) + '</text><text class="c-t" x="0" y="' + (H - B) + '">' + nl(lo + padv, 1) + '</text>' +
    (pts.length > 1 ? '<polyline class="c-line" points="' + pts.join(' ') + '"/>' : '') +
    data.map((m) => '<circle class="c-dot" cx="' + xs(m.date).toFixed(1) + '" cy="' + ys(m.weight).toFixed(1) + '" r="3.2"/>').join('') +
    '<text class="c-t" x="' + L + '" y="' + (H - 4) + '">' + fmtDM(data[0].date) + '</text><text class="c-t" x="' + W + '" y="' + (H - 4) + '" text-anchor="end">' + fmtDM(toISO(new Date(t1))) + '</text></svg>';
}
function vMeet() {
  const ws = weightStats();
  const big = ws.avg7 != null ? nl(ws.avg7, 1) + ' kg' : ws.latest ? nl(ws.latest.weight, 1) + ' kg' : '– kg';
  const waist = latestOf('waist'), hips = latestOf('hips'), ratio = waist != null && hips != null ? waist / hips : null;
  const tile = (l, v) => '<div class="tile"><div class="tile-l">' + l + '</div><div class="tile-v">' + v + '</div></div>';
  const recent = S.measurements.slice().sort(byDate).reverse().slice(0, 6).map((m) => {
    const bits = [];
    if (m.weight != null) bits.push(nl(m.weight, 1) + ' kg');
    if (m.waist != null) bits.push('taille ' + nl(m.waist, 1));
    if (m.hips != null) bits.push('heupen ' + nl(m.hips, 1));
    if (m.fat != null) bits.push('vet ' + nl(m.fat, 1) + '%');
    return '<button class="lrow" data-act="measureEdit" data-id="' + m.id + '"><b>' + esc(fmtSmart(m.date)) + '</b><span class="r">' + esc(bits.slice(0, 3).join(' · ')) + '</span></button>';
  }).join('');
  return '<div class="head"><div class="dateline">Lichaam</div><h1>Metingen</h1></div>' +
    '<button class="btn btn-primary" data-act="measure" data-focus="weight" style="box-shadow:0 12px 24px -14px rgba(150,50,30,.6)">Nieuwe meting</button>' +
    '<section class="card"><div class="between"><div class="col"><div class="eyebrow">Gewicht</div><div class="big">' + big + '</div></div>' +
    '<div class="small" style="text-align:right">' + (ws.avg7 != null ? '7-daags gemiddelde' : 'Laatste meting') + '<br>Trend 4 weken: ' + (ws.trend != null ? signed(ws.trend, 1) + ' kg' : '– kg') + '</div></div>' + chartSvg() + '</section>' +
    '<section class="card tint-sand"><div class="eyebrow warm">Afmetingen</div><div class="grid3">' + tile('Taille', nl(waist, 1) + (waist != null ? ' cm' : '')) + tile('Heupen', nl(hips, 1) + (hips != null ? ' cm' : '')) + tile('Ratio', ratio != null ? nl(ratio, 2) : '–') + '</div></section>' +
    '<section class="card tint-butter"><div class="eyebrow butter-ink">Lichaamssamenstelling</div><div class="grid3">' + tile('Vet', nl(latestOf('fat'), 1) + (latestOf('fat') != null ? ' %' : '')) + tile('Spier', nl(latestOf('muscle'), 1) + (latestOf('muscle') != null ? ' kg' : '')) + tile('Visceraal', nl(latestOf('visceral'), 0)) + '</div>' +
    '<div class="small" style="color:#6B5320">Over te nemen uit je Tanita-app.</div></section>' +
    (recent ? '<section class="card list"><div class="eyebrow">Eerdere metingen</div>' + recent + '</section>' : '');
}

/* ---------- Voeding ---------- */
function vVoed() {
  const t = today(), d = S.intake[t] || { eiwit: 0, water: 0 };
  const pT = S.settings.proteinTarget, wT = S.settings.waterTargetMl;
  const ring = (frac) => { const C = 2 * Math.PI * 43; return '<svg width="104" height="104" viewBox="0 0 104 104" aria-hidden="true"><circle class="ring-track" cx="52" cy="52" r="43" fill="none" stroke-width="10"/>' + (frac > 0 ? '<circle class="ring-prog" cx="52" cy="52" r="43" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * Math.min(1, frac)).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 52 52)"/>' : '') + '</svg>'; };
  const box = (cls, inkCls, label, valHtml, unit, target, kind) =>
    '<section class="card ' + cls + ' center" style="padding:18px 14px 14px"><div class="eyebrow ' + inkCls + '">' + label + '</div>' +
    '<div class="ring" style="width:104px;height:104px">' + ring(kind === 'eiwit' ? (pT ? d.eiwit / pT : 0) : (wT ? d.water / wT : 0)) + '<div class="ring-in"><div class="ring-n" style="font-size:28px">' + valHtml + '</div><div class="ring-l">' + unit + '</div></div></div>' +
    '<div class="small">' + target + '</div><button class="btn btn-primary btn-sm" style="width:100%" data-act="intake" data-kind="' + kind + '">Toevoegen</button></section>';
  const days = []; for (let i = 6; i >= 0; i--) days.push(addDays(t, -i));
  const kind = UI.vo, vals = days.map((x) => (S.intake[x] || {})[kind === 'eiwit' ? 'eiwit' : 'water'] || 0);
  const tgt = kind === 'eiwit' ? pT : wT, max = Math.max(tgt || 0, Math.max.apply(null, vals), 1);
  const bars = days.map((x, i) => {
    const h = vals[i] > 0 ? Math.max(8, Math.round(vals[i] / max * 64)) : 8;
    return '<div class="wb"><div class="wb-bar' + (vals[i] > 0 ? ' on' : '') + (i === 6 ? ' now' : '') + '" style="height:' + h + 'px"></div><div class="wb-l' + (i === 6 ? ' now' : '') + '">' + DOW_SHORT[fromISO(x).getDay()] + '</div></div>';
  }).join('');
  const hasAny = vals.some((v) => v > 0);
  return '<div class="head"><div class="dateline">' + esc(DOW[new Date().getDay()] + ' ' + fmtLongParts(t)[1]) + '</div><h1>Voeding</h1></div>' +
    '<div class="grid2">' + box('tint-sand', 'warm', 'Eiwit', nl(d.eiwit, 0), 'gram', 'Streef: ' + (pT ? nl(pT, 0) + ' g' : '– g'), 'eiwit') +
    box('tint-sky', 'sky-ink', 'Water', nl(d.water / 1000, 2), 'liter', 'Streef: ' + (wT ? nl(wT / 1000, 2) + ' l' : '– l'), 'water') + '</div>' +
    '<section class="card" style="gap:16px"><div class="between" style="align-items:center"><div class="eyebrow">Afgelopen 7 dagen</div>' +
    '<div class="seg small" role="group" aria-label="Weergave"><button data-act="voSeg" data-v="eiwit" aria-pressed="' + (kind === 'eiwit') + '">Eiwit</button><button data-act="voSeg" data-v="water" aria-pressed="' + (kind === 'water') + '">Water</button></div></div>' +
    '<div class="week">' + bars + '</div>' +
    '<div class="small">' + (hasAny ? 'Streefwaarden stel je in bij Instellingen.' : 'Je eerste dag verschijnt hier. Streefwaarden stel je in bij Instellingen.') + '</div></section>';
}

/* ---------- Instellingen ---------- */
function setRow(k) { return '<button class="setrow" data-act="setting" data-key="' + k + '"><span class="l">' + esc(SETTING_DEFS[k].label) + '</span><span class="v">' + esc(fmtSetting(k)) + I.chev + '</span></button>'; }
function navRow(act, title, sub) { return '<button class="setrow nav" data-act="' + act + '"><span class="t"><b>' + esc(title) + '</b><i>' + esc(sub) + '</i></span>' + I.chev + '</button>'; }
function vInst() {
  if (UI.inst === 'herinneringen') {
    const wd = S.settings.weighDay;
    return '<button class="back" data-act="instBack">' + I.back + 'Instellingen</button><h1>Herinneringen</h1>' +
      '<p class="lead">Een webapp kan niet rechtstreeks in Apple Herinneringen schrijven. BodyBalanz maakt daarom een agenda-bestand met je prikmomenten, het recept en eventueel het wegen. Je Agenda geeft daarna de meldingen.</p>' +
      '<div class="setgroup"><div class="setlist"><button class="setrow" data-act="remindTime"><span class="l">Tijd van de melding</span><span class="v">' + esc(S.settings.remindTime || '09:00') + I.chev + '</span></button>' +
      '<button class="setrow" data-act="weighDay"><span class="l">Wegen en meten</span><span class="v">' + (wd == null ? 'Geen' : 'Elke ' + DOW[wd].toLowerCase()) + I.chev + '</span></button></div></div>' +
      '<button class="btn btn-primary" data-act="ics">Agenda-bestand maken</button>' +
      '<p class="small" style="padding:0 6px">Maak het bestand opnieuw na een wijziging in je schema. Oude afspraken in je Agenda verwijder je zelf.</p>';
  }
  if (UI.inst === 'voeding') {
    return '<button class="back" data-act="instBack">' + I.back + 'Instellingen</button><h1>Voeding</h1><div class="setgroup"><div class="setlist">' + setRow('proteinTarget') + setRow('waterTargetMl') + '</div></div>';
  }
  if (UI.inst === 'gegevens') {
    return '<button class="back" data-act="instBack">' + I.back + 'Instellingen</button><h1>Gegevens</h1>' +
      '<p class="lead">Je gegevens staan alleen op dit toestel. Maak regelmatig een back-up, bijvoorbeeld als je een nieuwe telefoon krijgt.</p>' +
      '<button class="btn btn-primary" data-act="backupCopy">Back-up kopiëren</button><button class="btn btn-ghost" data-act="backupShare">Back-up delen als bestand</button>' +
      '<button class="btn btn-ghost" data-act="restore">Herstellen uit back-up</button><button class="btn btn-danger" data-act="wipe">Alles wissen</button>';
  }
  return '<h1>Instellingen</h1>' +
    '<div class="setgroup"><div class="eyebrow">Medicatie</div><div class="setlist">' + setRow('doseMg') + setRow('intervalDays') + setRow('penMg') + setRow('recipeWeeks') + '</div></div>' +
    '<div class="setgroup"><div class="eyebrow">Gewichtsgrenzen</div><div class="setlist">' + setRow('weightLimit') + setRow('trendLimit') + '</div></div>' +
    '<div class="setgroup"><div class="eyebrow">Meer</div><div class="setlist">' + navRow('instGo-herinneringen', 'Herinneringen', 'Agenda-bestand met meldingen') + navRow('instGo-voeding', 'Voeding', 'Streefwaarden eiwit en water') + navRow('instGo-gegevens', 'Gegevens', 'Back-up maken en herstellen') + '</div></div>' +
    '<p class="small" style="text-align:center">BodyBalanz 1.0 · gegevens blijven op dit toestel</p>';
}

/* ================= invoerschermen ================= */
function openShot(past) {
  const st = S.settings;
  if (!st.doseMg) { toast('Stel eerst je dosis in.'); return; }
  const sugg = suggestSite();
  let info;
  if (past) info = 'Wordt alleen in het logboek gezet. De penrestand verandert niet.';
  else {
    const e = schedule(1)[0], pen = e && S.pens.find((p) => p.id === e.penId);
    if (!pen) info = 'Er is geen pen met genoeg inhoud. De prik wordt zonder pen opgeslagen.';
    else if (e.newPen) info = 'Hiermee start je een nieuwe pen met ' + nl(pen.restMg) + ' mg.';
    else info = 'Wordt van je huidige pen afgetrokken (nu ' + nl(pen.restMg) + ' mg).';
  }
  const chips = st.sites.map((s) => '<label class="chip"><input type="radio" name="site" value="' + esc(s) + '"' + (s === sugg ? ' checked' : '') + '><span>' + esc(s) + '</span></label>').join('') +
    '<label class="chip"><input type="radio" name="site" value=""' + (sugg ? '' : ' checked') + '><span>Niet vastleggen</span></label>';
  openSheet({
    title: past ? 'Eerdere prik' : 'Prik registreren',
    body: '<p class="note">' + esc(info) + '</p>' + fld({ name: 'date', label: 'Datum', type: 'date', value: today() }) +
      fld({ name: 'mg', label: 'Dosis', inputmode: 'decimal', suffix: 'mg', value: nl(st.doseMg) }) +
      '<div class="fld"><span class="fld-l">Prikplek' + (sugg ? ' (voorgesteld: ' + esc(sugg) + ')' : '') + '</span></div><div class="chips">' + chips + '</div>',
    submit: 'Opslaan',
    onSubmit: (v) => {
      const mg = num(v.mg);
      if (!v.date || !(mg > 0)) { toast('Controleer datum en dosis.'); return false; }
      const shot = { id: uid(), date: v.date, mg: mg, site: v.site || null, penId: null };
      if (!past) applyShotToPens(shot);
      S.shots.push(shot); save(); render(true);
      const nx = nextShotDate();
      toast('Prik opgeslagen' + (nx ? '. Volgende: ' + fmtDow(nx) : ''));
    }
  });
}
function openShotDetail(id) {
  const sh = S.shots.find((s) => s.id === id); if (!sh) return;
  openSheet({
    title: 'Prik van ' + fmtSmart(sh.date),
    body: '<p class="note">' + esc(nl(sh.mg) + ' mg' + (sh.site ? ' · ' + sh.site : '') + (sh.penId ? ' · afgetrokken van een pen' : '')) + '</p>',
    submit: null, cancel: 'Sluiten',
    onDelete: () => { deleteShot(id); closeSheet(); }, deleteLabel: 'Prik verwijderen'
  });
}
function deleteShot(id) {
  const i = S.shots.findIndex((s) => s.id === id); if (i < 0) return;
  const sh = S.shots[i], pen = sh.penId && S.pens.find((p) => p.id === sh.penId);
  if (pen) {
    pen.restMg = round2(pen.mg ? Math.min(pen.mg, pen.restMg + sh.mg) : pen.restMg + sh.mg);
    if (pen.status === 'empty') pen.status = activePen() ? 'stock' : 'active';
  }
  S.shots.splice(i, 1); save(); render(true); toast('Prik verwijderd');
}

function openMeasure(opts) {
  opts = opts || {};
  const m = opts.id ? S.measurements.find((x) => x.id === opts.id) : null;
  const f = opts.focus || 'weight', val = (k) => (m && m[k] != null ? nl(m[k], k === 'visceral' ? 0 : 1) : '');
  openSheet({
    title: m ? 'Meting van ' + fmtSmart(m.date) : 'Nieuwe meting',
    body: fld({ name: 'date', label: 'Datum', type: 'date', value: m ? m.date : today() }) +
      fld({ name: 'weight', label: 'Gewicht', inputmode: 'decimal', suffix: 'kg', value: val('weight'), autofocus: f === 'weight' }) +
      '<div class="fgrid">' + fld({ name: 'waist', label: 'Taille', inputmode: 'decimal', suffix: 'cm', value: val('waist'), autofocus: f === 'waist' }) +
      fld({ name: 'hips', label: 'Heupen', inputmode: 'decimal', suffix: 'cm', value: val('hips'), autofocus: f === 'hips' }) +
      fld({ name: 'fat', label: 'Vet', inputmode: 'decimal', suffix: '%', value: val('fat') }) +
      fld({ name: 'muscle', label: 'Spier', inputmode: 'decimal', suffix: 'kg', value: val('muscle') }) + '</div>' +
      fld({ name: 'visceral', label: 'Visceraal vet', inputmode: 'decimal', value: val('visceral') }),
    onDelete: m ? () => { S.measurements = S.measurements.filter((x) => x.id !== m.id); save(); render(true); closeSheet(); toast('Meting verwijderd'); } : null,
    deleteLabel: 'Meting verwijderen',
    onSubmit: (v) => {
      const keys = ['weight', 'waist', 'hips', 'fat', 'muscle', 'visceral'], n = {};
      for (const k of keys) { n[k] = num(v[k]); if (Number.isNaN(n[k])) { toast('Controleer de ingevulde getallen.'); return false; } }
      if (!v.date) { toast('Kies een datum.'); return false; }
      if (keys.every((k) => n[k] == null)) { toast('Vul minstens één waarde in.'); return false; }
      if (m) { m.date = v.date; keys.forEach((k) => { m[k] = n[k]; }); }
      else {
        let tgt = S.measurements.find((x) => x.date === v.date);
        if (!tgt) { tgt = { id: uid(), date: v.date, weight: null, waist: null, hips: null, fat: null, muscle: null, visceral: null }; S.measurements.push(tgt); }
        keys.forEach((k) => { if (n[k] != null) tgt[k] = n[k]; });
      }
      save(); render(true); toast('Meting opgeslagen');
    }
  });
}

function openPenCorrect(id) {
  const p = S.pens.find((x) => x.id === id); if (!p) return;
  openSheet({
    title: 'Restand corrigeren',
    body: '<p class="note">Vul in hoeveel mg er nu nog in deze pen zit.</p>' + fld({ name: 'rest', label: 'Restand', inputmode: 'decimal', suffix: 'mg', value: nl(p.restMg), autofocus: true }),
    onSubmit: (v) => {
      const r = num(v.rest);
      if (r == null || Number.isNaN(r) || r < 0) { toast('Vul een geldige restand in.'); return false; }
      p.restMg = round2(r);
      if (p.restMg <= 0.001) { p.restMg = 0; p.status = 'empty'; p.endedOn = today(); }
      else if (p.status === 'empty') p.status = activePen() ? 'stock' : 'active';
      save(); render(true); toast('Restand aangepast');
    }
  });
}
function openPenStart(id) {
  const p = S.pens.find((x) => x.id === id), a = activePen(); if (!p) return;
  openSheet({
    title: 'Pen starten',
    body: '<p class="note">' + (a ? 'Je huidige pen (nog ' + nl(a.restMg) + ' mg) wordt afgesloten. ' : '') + 'Deze pen heeft ' + nl(p.restMg) + ' mg.</p>' + fld({ name: 'date', label: 'Startdatum', type: 'date', value: today() }),
    submit: 'Pen starten',
    onSubmit: (v) => {
      if (!v.date) { toast('Kies een datum.'); return false; }
      if (a && a.id !== p.id) { a.status = 'empty'; a.endedOn = v.date; }
      p.status = 'active'; p.startedOn = v.date; save(); render(true); toast('Pen gestart');
    }
  });
}
function openPenAdd() {
  openSheet({
    title: 'Pen toevoegen',
    body: fld({ name: 'count', label: 'Aantal pennen', inputmode: 'numeric', value: '1', autofocus: true }) +
      fld({ name: 'mg', label: 'Inhoud per pen', inputmode: 'decimal', suffix: 'mg', value: S.settings.penMg != null ? nl(S.settings.penMg) : '' }),
    onSubmit: (v) => {
      const c = num(v.count), mg = num(v.mg);
      if (!(c >= 1) || !(mg > 0)) { toast('Vul aantal en inhoud in.'); return false; }
      for (let i = 0; i < Math.round(c); i++) S.pens.push({ id: uid(), mg: mg, restMg: mg, status: 'stock' });
      if (S.settings.penMg == null) S.settings.penMg = mg;
      save(); render(true); toast('Voorraad bijgewerkt');
    }
  });
}

function openIntake(kind) {
  const t = today(), d = S.intake[t] || { eiwit: 0, water: 0 }, isP = kind === 'eiwit';
  openSheet({
    title: isP ? 'Eiwit toevoegen' : 'Water toevoegen',
    body: '<p class="note">Vandaag tot nu toe: ' + (isP ? nl(d.eiwit, 0) + ' g' : nl(d.water, 0) + ' ml') + '.</p>' +
      fld({ name: 'add', label: 'Erbij', inputmode: 'decimal', suffix: isP ? 'g' : 'ml', autofocus: true }) +
      fld({ name: 'set', label: 'Of stel het dagtotaal in', inputmode: 'decimal', suffix: isP ? 'g' : 'ml', hint: 'Laat leeg om het totaal niet te wijzigen.' }),
    onSubmit: (v) => {
      const a = num(v.add), s = num(v.set);
      if (Number.isNaN(a) || Number.isNaN(s) || (a == null && s == null) || (a != null && a < 0) || (s != null && s < 0)) { toast('Vul een geldig getal in.'); return false; }
      const day = S.intake[t] || (S.intake[t] = { eiwit: 0, water: 0 }), k = isP ? 'eiwit' : 'water';
      day[k] = s != null ? s : day[k] + a;
      save(); render(true);
    }
  });
}

function openSetting(k) {
  const d = SETTING_DEFS[k], cur = S.settings[k];
  openSheet({
    title: d.label,
    body: (d.hint ? '<p class="note">' + esc(d.hint) + '</p>' : '') + fld({ name: 'v', label: d.label, inputmode: d.int ? 'numeric' : 'decimal', suffix: d.suffix, value: cur == null ? '' : nl(d.scale ? cur / d.scale : cur, 2), autofocus: true }) +
      (d.nullable ? '<p class="note">Laat leeg om deze instelling uit te zetten.</p>' : ''),
    onSubmit: (v) => {
      let n = num(v.v);
      if (Number.isNaN(n)) { toast('Vul een geldig getal in.'); return false; }
      if (n == null) { if (!d.nullable) { toast('Dit veld mag niet leeg zijn.'); return false; } S.settings[k] = null; }
      else {
        if (n < 0 || (n === 0 && !d.allowZero)) { toast('Vul een getal groter dan nul in.'); return false; }
        if (d.int) n = Math.round(n);
        S.settings[k] = d.scale ? n * d.scale : n;
      }
      save(); render(true); toast('Opgeslagen');
    }
  });
}
function openRemindTime() {
  openSheet({ title: 'Tijd van de melding', body: fld({ name: 't', label: 'Tijd', type: 'time', value: S.settings.remindTime || '09:00' }),
    onSubmit: (v) => { if (!/^\d\d:\d\d$/.test(v.t || '')) { toast('Kies een tijd.'); return false; } S.settings.remindTime = v.t; save(); render(true); } });
}
function openWeighDay() {
  const opts = [['', 'Geen']].concat([1, 2, 3, 4, 5, 6, 0].map((i) => [String(i), 'Elke ' + DOW[i].toLowerCase()]));
  openSheet({ title: 'Wegen en meten', body: sel('d', 'Herinnering', opts, S.settings.weighDay == null ? '' : S.settings.weighDay),
    onSubmit: (v) => { S.settings.weighDay = v.d === '' ? null : Number(v.d); save(); render(true); } });
}

/* ================= bestanden: agenda en back-up ================= */
function buildICS() {
  const tm = (S.settings.remindTime || '09:00').split(':').map(Number), hh = tm[0], mm = tm[1];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dt = (iso, h, m) => iso.replace(/-/g, '') + 'T' + pad(h) + pad(m) + '00';
  const endTotal = hh * 60 + mm + 15, eh = Math.floor(endTotal / 60) % 24, em = endTotal % 60;
  const out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyBalanz//NL', 'CALSCALE:GREGORIAN'];
  const ev = (id, summary, start, end, rrule, alarms) => {
    out.push('BEGIN:VEVENT', 'UID:' + id + '@bodybalanz', 'DTSTAMP:' + stamp, start, end);
    if (rrule) out.push(rrule);
    out.push('SUMMARY:' + summary);
    alarms.forEach((tr) => out.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + summary, 'TRIGGER:' + tr, 'END:VALARM'));
    out.push('END:VEVENT');
  };
  const sup = supply();
  const n = sup && sup.doses > 0 ? Math.min(sup.doses, 12) : 6;
  schedule(n).forEach((e, i) => {
    ev('shot-' + e.date + '-' + i, 'Prikken: ' + nl(e.mg) + ' mg' + (e.newPen ? ' (nieuwe pen starten)' : ''),
      'DTSTART:' + dt(e.date, hh, mm), 'DTEND:' + dt(e.date, eh, em), null, ['PT0S', '-P1D']);
  });
  if (sup && sup.recipe && sup.recipe >= today()) {
    ev('recept-' + sup.recipe, 'Recept aanvragen', 'DTSTART;VALUE=DATE:' + sup.recipe.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + addDays(sup.recipe, 1).replace(/-/g, ''), null, ['PT9H']);
  }
  const wd = S.settings.weighDay;
  if (wd != null) {
    let d = today(); while (fromISO(d).getDay() !== wd) d = addDays(d, 1);
    ev('wegen-' + wd, 'Wegen en meten', 'DTSTART:' + dt(d, hh, mm), 'DTEND:' + dt(d, eh, em), 'RRULE:FREQ=WEEKLY;BYDAY=' + ICAL_DAY[wd], ['PT0S']);
  }
  out.push('END:VCALENDAR');
  return out.join('\r\n') + '\r\n';
}
async function deliverFile(name, type, text) {
  try {
    const file = new File([text], name, { type: type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const url = URL.createObjectURL(new Blob([text], { type: type }));
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function openBackupText(txt) {
  openSheet({ title: 'Back-up', body: '<p class="note">Kopiëren lukt niet automatisch. Houd de tekst ingedrukt, kies Selecteer alles en kopieer.</p><textarea readonly id="bk">' + esc(txt) + '</textarea>', submit: null, cancel: 'Sluiten' });
  setTimeout(() => { const t = $('#bk'); if (t) { t.focus(); t.select(); } }, 80);
}
async function copyBackup() {
  const txt = JSON.stringify(S);
  try { await navigator.clipboard.writeText(txt); toast('Back-up gekopieerd. Plak hem in Notities of in een mail aan jezelf.'); }
  catch (e) { openBackupText(txt); }
}
function openRestore() {
  openSheet({
    title: 'Herstellen uit back-up',
    body: '<p class="note">Plak hier de tekst van je back-up. Je huidige gegevens worden vervangen.</p><textarea name="json" placeholder="Plak hier je back-up" autofocus></textarea>',
    submit: 'Herstellen',
    onSubmit: (v) => {
      let o; try { o = JSON.parse(v.json || ''); } catch (e) { toast('Dit is geen geldige back-up.'); return false; }
      if (!o || typeof o !== 'object' || !o.settings || typeof o.settings !== 'object') { toast('Dit is geen BodyBalanz-back-up.'); return false; }
      S = normalize(o); if (!S.setup && S.settings.doseMg) S.setup = true;
      save(); UI.tab = 'start'; UI.inst = null; render(false); toast('Back-up hersteld');
    }
  });
}
function openWipe() {
  openSheet({ title: 'Alles wissen?', body: '<p class="note">Hiermee verwijder je al je gegevens van dit toestel. Maak eerst een back-up als je ze nog wilt hebben.</p>', submit: 'Alles wissen',
    onSubmit: () => { try { localStorage.removeItem(KEY); } catch (e) { /* negeren */ } S = defaults(); UI.tab = 'start'; UI.inst = null; render(false); } });
}

/* ================= events ================= */
const actions = {
  tab: (el) => { UI.tab = el.dataset.tab; UI.inst = null; render(false); },
  medSeg: (el) => { UI.med = el.dataset.v; render(false); },
  voSeg: (el) => { UI.vo = el.dataset.v; render(true); },
  shot: () => openShot(false),
  pastShot: () => openShot(true),
  shotDetail: (el) => openShotDetail(el.dataset.id),
  measure: (el) => openMeasure({ focus: el.dataset.focus }),
  measureEdit: (el) => openMeasure({ id: el.dataset.id }),
  penCorrect: (el) => openPenCorrect(el.dataset.pen),
  penStart: (el) => openPenStart(el.dataset.pen),
  penAdd: openPenAdd,
  intake: (el) => openIntake(el.dataset.kind),
  setting: (el) => openSetting(el.dataset.key),
  remindTime: openRemindTime,
  weighDay: openWeighDay,
  ics: () => deliverFile('bodybalanz-agenda.ics', 'text/calendar', buildICS()),
  backupCopy: copyBackup,
  backupShare: () => deliverFile('bodybalanz-back-up-' + today() + '.json', 'application/json', JSON.stringify(S, null, 1)),
  restore: openRestore,
  wipe: openWipe,
  instBack: () => { UI.inst = null; render(false); },
  skipInstall: () => { UI.skipInstall = true; render(false); },
  closeSheet: closeSheet,
  sheetDelete: () => { if (sheetDelete) sheetDelete(); }
};
document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act;
  if (act.indexOf('instGo-') === 0) { UI.inst = act.slice(7); render(false); return; }
  if (actions[act]) actions[act](el, ev);
});
document.addEventListener('submit', (ev) => {
  if (ev.target.id === 'welcome-form') { ev.preventDefault(); handleWelcome(new FormData(ev.target)); }
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#sheet-form')) closeSheet(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#sheet-form')) render(true); });

/* ================= start ================= */
render(false);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline-gebruik is een extra */ });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

})();
