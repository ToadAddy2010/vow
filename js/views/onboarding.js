import { S, save } from '../store.js';
import { esc, toast, emblem } from '../ui.js';
import { RANKS } from '../xp.js';
import { HABIT_PRESETS, BAD_PRESETS } from '../data.js';
import { addHabit, addBad, dailyStart } from '../logic.js';
import { commitPicker, commitDays, openOath, setCommitment } from './oath.js';

function ob(app) {
  if (!app.ui.ob) app.ui.ob = { step: 0, name: '', bad: new Set(), badCustom: [], good: new Set(), goodCustom: [], kcal: 2400, protein: 120, sleep: 8 };
  return app.ui.ob;
}

const STEPS = 6;

export function render(app) {
  const o = ob(app);
  const dots = `<div class="ob-dots">${[...Array(STEPS)].map((_, i) => `<i class="${i <= o.step ? 'on' : ''}"></i>`).join('')}</div>`;
  let body = '';
  if (o.step === 0) {
    body = `<div class="ob-hero">
      <div class="ob-emblems">${[RANKS[0], RANKS[6], RANKS[12], RANKS[15]].map((r) => emblem(r, 64)).join('')}</div>
      <h1 class="ob-title">VOW</h1>
      <p class="ob-sub">Gute Gewohnheiten aufbauen. Schlechte killen. Jeden Tag XP verdienen, von Bronze bis Unreal.</p>
      <p class="muted small">Nur für dich. Mit deinem Konto auf Handy und Laptop gleich.</p>
    </div>
    <button class="btn primary full big" data-act="ob-next">Los geht's</button>
    <details class="install-tip">
      <summary>Als App aufs Handy legen</summary>
      <p><b>iPhone:</b> In Safari auf „Teilen“, dann „Zum Home-Bildschirm“.</p>
      <p><b>Android:</b> In Chrome auf die drei Punkte, dann „App installieren“ oder „Zum Startbildschirm hinzufügen“.</p>
    </details>`;
  } else if (o.step === 1) {
    body = `<h2 class="ob-h">Wie heißt du?</h2>
    <input class="inp big" id="obName" maxlength="24" placeholder="Dein Name" value="${esc(o.name)}" autocomplete="given-name">
    <p class="muted small">Damit der Coach dich anspricht.</p>
    <button class="btn primary full big mt2" data-act="ob-next">Weiter</button>`;
  } else if (o.step === 2) {
    body = `<h2 class="ob-h">Was willst du loswerden?</h2>
    <p class="muted">Sei ehrlich. Nur du siehst das. Für jede Angewohnheit läuft ab jetzt eine Clean-Serie.</p>
    <div class="ob-grid">${BAD_PRESETS.map(([n, i]) => `<button class="ob-opt ${o.bad.has(n) ? 'on' : ''}" data-act="ob-tog" data-k="bad" data-v="${esc(n)}"><span>${i}</span>${esc(n)}</button>`).join('')}
    ${o.badCustom.map((n) => `<button class="ob-opt on" data-act="ob-rm" data-k="badCustom" data-v="${esc(n)}"><span>🔒</span>${esc(n)}</button>`).join('')}</div>
    <div class="row gap mt"><input class="inp" id="obBadC" placeholder="Eigene…" maxlength="40"><button class="btn" data-act="ob-add" data-k="badCustom" data-in="obBadC">+</button></div>
    <button class="btn primary full big mt2" data-act="ob-next">Weiter</button>`;
  } else if (o.step === 3) {
    const n = o.good.size + o.goodCustom.length;
    body = `<h2 class="ob-h">Welche Gewohnheiten willst du aufbauen?</h2>
    <p class="muted">Tipp: Fang mit 3 bis 5 an. Lieber wenige durchziehen als viele abbrechen.</p>
    <div class="ob-grid">${HABIT_PRESETS.map(([nm, i]) => `<button class="ob-opt ${o.good.has(nm) ? 'on' : ''}" data-act="ob-tog" data-k="good" data-v="${esc(nm)}"><span>${i}</span>${esc(nm)}</button>`).join('')}
    ${o.goodCustom.map((nm) => `<button class="ob-opt on" data-act="ob-rm" data-k="goodCustom" data-v="${esc(nm)}"><span>✅</span>${esc(nm)}</button>`).join('')}</div>
    <div class="row gap mt"><input class="inp" id="obGoodC" placeholder="Eigene…" maxlength="40"><button class="btn" data-act="ob-add" data-k="goodCustom" data-in="obGoodC">+</button></div>
    ${n > 6 ? `<p class="small bad-t mt">${n} Gewohnheiten sind viel. Bist du sicher?</p>` : ''}
    <button class="btn primary full big mt2" data-act="ob-next">Weiter</button>`;
  } else if (o.step === 4) {
    body = `<h2 class="ob-h">Deine Ziele</h2>
    <label class="lbl">Kalorien pro Tag</label>
    <input class="inp big" id="obK" type="number" inputmode="numeric" value="${o.kcal}" min="1500" max="6000">
    <p class="small muted">Der Bedarf ist bei jedem anders, oft grob 2000 bis 2800 kcal. Unter 18 bitte keine Diät ohne Arzt. Kannst du später ändern.</p>
    <label class="lbl">Eiweiß pro Tag (g)</label>
    <input class="inp big" id="obP" type="number" inputmode="numeric" value="${o.protein}" min="20" max="400">
    <p class="small muted">Richtwert: ungefähr 1,5 g pro kg Körpergewicht, wenn du trainierst.</p>
    <label class="lbl">Schlaf pro Nacht (Stunden)</label>
    <input class="inp big" id="obS" type="number" inputmode="decimal" step="0.5" value="${o.sleep}" min="5" max="12">
    <p class="small muted">Jugendliche brauchen meist 8 bis 10 Stunden, Erwachsene 7 bis 9.</p>
    <button class="btn primary full big mt2" data-act="ob-next">Weiter</button>`;
  } else if (o.step === 5) {
    body = commitPicker('ob-commit');
  }
  return `<div class="ob">${o.step > 0 ? `<button class="back" data-act="ob-back">‹</button>` : ''}${dots}${body}</div>`;
}

function readStep(app) {
  const o = ob(app);
  const v = (id) => document.getElementById(id);
  if (o.step === 1) o.name = v('obName').value.trim();
  if (o.step === 4) {
    o.kcal = Number(v('obK').value) || 2400;
    o.protein = Number(v('obP').value) || 120;
    o.sleep = Number(v('obS').value) || 8;
  }
}

export const actions = {
  'ob-next': (el, app) => {
    readStep(app);
    const o = ob(app);
    if (o.step === 1 && !o.name) return toast('Wie heißt du?');
    if (o.step === 3 && o.good.size + o.goodCustom.length === 0) return toast('Wähl mindestens eine Gewohnheit.');
    o.step++;
    app.rerender(true);
  },
  'ob-back': (el, app) => {
    readStep(app);
    ob(app).step--;
    app.rerender(true);
  },
  'ob-tog': (el, app) => {
    const set = ob(app)[el.dataset.k];
    set.has(el.dataset.v) ? set.delete(el.dataset.v) : set.add(el.dataset.v);
    app.rerender();
  },
  'ob-add': (el, app) => {
    const inp = document.getElementById(el.dataset.in);
    const v = inp.value.trim();
    if (!v) return;
    const list = ob(app)[el.dataset.k];
    if (!list.includes(v)) list.push(v);
    app.rerender();
  },
  'ob-rm': (el, app) => {
    const o = ob(app);
    o[el.dataset.k] = o[el.dataset.k].filter((x) => x !== el.dataset.v);
    app.rerender();
  },
  'ob-commit': (el, app) => {
    const o = ob(app);
    const days = commitDays(el.dataset.v);
    openOath(o.name, days, () => finishOnboarding(app, o, days));
  },
};

function finishOnboarding(app, o, days) {
  const s = S();
  s.profile.name = o.name;
  s.profile.kcalGoal = Math.min(6000, Math.max(1500, Math.round(o.kcal)));
  s.profile.proteinGoal = Math.min(400, Math.max(20, Math.round(o.protein)));
  s.profile.sleepGoal = Math.min(12, Math.max(5, o.sleep));
  s.profile.createdAt = Date.now();
  for (const [n, i] of BAD_PRESETS) if (o.bad.has(n)) addBad(n, i);
  for (const n of o.badCustom) addBad(n, '🔒');
  for (const [n, i] of HABIT_PRESETS) if (o.good.has(n)) addHabit(n, i);
  for (const n of o.goodCustom) addHabit(n, '✅');
  setCommitment(days);
  s.onboarded = true;
  save();
  app.ui.ob = null;
  dailyStart();
  app.go('today');
}
