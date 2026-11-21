import { S, save, todayKey, addDays } from '../store.js';
import { esc, ring, bars, last7, segmented, sheet, closeSheet, toast, heatmap, fmtTime } from '../ui.js';
import { foodList, foodTotals, addFood, removeFood, logSleep, sleepHours, addWorkout, removeWorkout, workoutMin, workoutStreak } from '../logic.js';
import { FOODS, WORKOUT_TYPES } from '../data.js';
const de = (n) => String(n).replace('.', ',');

const MEALS = [
  ['fr', 'Frühstück'],
  ['mi', 'Mittag'],
  ['ab', 'Abend'],
  ['sn', 'Snacks'],
];

function defaultMeal() {
  const h = new Date().getHours();
  if (h < 11) return 'fr';
  if (h < 15) return 'mi';
  if (h < 21) return 'ab';
  return 'sn';
}

export function render(app) {
  const tab = app.ui.bodyTab || 'food';
  return `
  <header class="top"><h1 class="h1">Körper</h1></header>
  ${segmented('body-tab', [['food', '🍽️ Essen'], ['sleep', '😴 Schlaf'], ['sport', '💪 Sport']], tab)}
  ${tab === 'food' ? food(app) : tab === 'sleep' ? sleep() : sport()}
  `;
}

// ---------- Essen ----------
function allFoods() {
  return [...S().customFoods.map((f) => [...f, true]), ...FOODS];
}

function food(app) {
  const s = S();
  const k = todayKey();
  const t = foodTotals(k);
  const g = s.profile.kcalGoal;
  const list = foodList(k);
  const left = g - t.kcal;
  const week = last7((dk) => {
    const v = foodTotals(dk).kcal;
    return { v, cls: v > g * 1.08 ? 'over' : '' };
  });
  return `
  <section class="card kcal-card">
    ${ring(t.kcal, g, { size: 132, stroke: 12, color: 'var(--gold)', inner: `<b>${Math.abs(left)}</b><span>${left >= 0 ? 'übrig' : 'zu viel'}</span>` })}
    <div class="grow">
      <div class="kv"><span class="muted">Gegessen</span><b>${t.kcal} kcal</b></div>
      <div class="kv"><span class="muted">Ziel</span><b>${g} kcal</b></div>
      <div class="kv"><span class="muted">Eiweiß</span><b>${Math.round(t.p)} / ${s.profile.proteinGoal} g</b></div>
      <div class="pbar"><div style="width:${Math.min(100, (t.p / s.profile.proteinGoal) * 100)}%"></div></div>
      ${t.junk ? `<div class="small bad-t mt">⚠️ ${t.junk}× Junkfood heute</div>` : ''}
    </div>
  </section>

  <div class="search">
    <input class="inp" id="foodQ" placeholder="Essen suchen… z.B. Döner, Skyr, Reis" autocomplete="off" value="${esc(app.ui.foodQ || '')}">
  </div>
  <div id="foodRes" class="food-res">${foodResults(app.ui.foodQ || '')}</div>

  ${MEALS.map(([m, l]) => {
    const items = list.filter((f) => (f.meal || 'sn') === m);
    if (!items.length) return '';
    const sum = items.reduce((a, f) => a + f.kcal, 0);
    return `<div class="row between mt"><h3 class="h3 m0">${l}</h3><span class="small muted">${sum} kcal</span></div>
    <section class="card list">${items
      .map(
        (f) => `<div class="food-row">
        <span class="grow left">${f.junk ? '🍔 ' : ''}${esc(f.name)} <span class="small muted">${f.qty && f.qty !== 1 ? f.qty + '× ' : ''}${fmtTime(f.t)}</span></span>
        <b>${f.kcal}</b>
        <button class="x" data-act="food-del" data-id="${f.id}" aria-label="löschen">×</button>
      </div>`
      )
      .join('')}</section>`;
  }).join('')}

  ${!list.length ? `<div class="card empty">Noch nichts eingetragen. Was du nicht aufschreibst, kannst du nicht kontrollieren.</div>` : ''}

  <section class="card mt2">
    <div class="row between"><b>Letzte 7 Tage</b><span class="small muted">kcal</span></div>
    ${bars(week, { goal: g, color: 'var(--gold)' })}
  </section>
  `;
}

function foodResults(q) {
  q = q.trim().toLowerCase();
  if (!q) {
    return `<div class="chips">${['Döner', 'Hähnchen mit Reis', 'Skyr', 'Banane', 'Pizza (1 Stück)', 'Rührei', 'Proteinshake (Milch)']
      .map((n) => `<button class="chip" data-act="food-pick" data-name="${esc(n)}">${esc(n)}</button>`)
      .join('')}<button class="chip accent" data-act="food-custom">+ Eigenes Essen</button></div>`;
  }
  const res = allFoods()
    .filter((f) => f[0].toLowerCase().includes(q))
    .sort((a, b) => a[0].toLowerCase().indexOf(q) - b[0].toLowerCase().indexOf(q))
    .slice(0, 12);
  return `<section class="card list">
    ${res
      .map(
        (f) => `<button class="food-row tap" data-act="food-pick" data-name="${esc(f[0])}">
        <span class="grow left">${f[4] ? '🍔 ' : ''}${esc(f[0])} <span class="small muted">${esc(f[3])}${f[5] ? ' · eigenes' : ''}</span></span>
        <b>${f[1]}</b><span class="small muted">kcal</span>
      </button>`
      )
      .join('')}
    <button class="food-row tap accent-t" data-act="food-custom" data-name="${esc(q)}"><span class="grow left">+ „${esc(q)}“ selbst eintragen</span></button>
  </section>`;
}

function openFoodPick(app, name) {
  const f = allFoods().find((x) => x[0] === name);
  if (!f) return;
  let qty = 1;
  let meal = defaultMeal();
  const [n, kcal, p, portion, junk] = f;
  const upd = (b) => {
    b.querySelector('#fK').textContent = Math.round(kcal * qty);
    b.querySelector('#fP').textContent = Math.round(p * qty);
    b.querySelectorAll('[data-q]').forEach((x) => x.classList.toggle('on', Number(x.dataset.q) === qty));
  };
  sheet(
    `<h3 class="sheet-title">${junk ? '🍔 ' : ''}${esc(n)}</h3>
     <p class="muted small">1 Portion = ${esc(portion)}</p>
     <div class="big-kcal"><b id="fK">${kcal}</b> kcal · <b id="fP">${p}</b> g Eiweiß</div>
     <label class="lbl">Menge</label>
     <div class="chips">${[0.5, 1, 1.5, 2, 3].map((q) => `<button class="chip ${q === 1 ? 'on' : ''}" data-q="${q}">${String(q).replace('.', ',')}×</button>`).join('')}</div>
     <label class="lbl">Mahlzeit</label>
     <div class="chips">${MEALS.map(([m, l]) => `<button class="chip ${m === meal ? 'on' : ''}" data-meal="${m}">${l}</button>`).join('')}</div>
     ${junk ? `<p class="small bad-t">Das ist Junkfood. Bist du sicher, dass du das brauchst?</p>` : ''}
     <button class="btn primary full mt" id="fAdd">Hinzufügen</button>`,
    {
      onMount: (b) => {
        b.querySelectorAll('[data-q]').forEach((x) =>
          x.addEventListener('click', () => {
            qty = Number(x.dataset.q);
            upd(b);
          })
        );
        b.querySelectorAll('[data-meal]').forEach((x) =>
          x.addEventListener('click', () => {
            meal = x.dataset.meal;
            b.querySelectorAll('[data-meal]').forEach((y) => y.classList.toggle('on', y === x));
          })
        );
        b.querySelector('#fAdd').onclick = () => {
          addFood({ name: n, kcal: Math.round(kcal * qty), p: Math.round(p * qty), qty, meal, junk: !!junk });
          closeSheet();
          app.ui.foodQ = '';
          const t = foodTotals();
          const g = S().profile.kcalGoal;
          if (junk) toast('Eingetragen. Junkfood. Das nächste Essen wird sauber.', 'bad');
          else if (t.kcal > g) toast(`Eingetragen. Du bist ${t.kcal - g} kcal über deinem Ziel.`, 'bad');
          else toast(`Eingetragen. Noch ${g - t.kcal} kcal übrig.`);
          app.rerender();
        };
      },
    }
  );
}

function openFoodCustom(app, preset = '') {
  sheet(
    `<h3 class="sheet-title">Eigenes Essen</h3>
     <label class="lbl">Name</label><input class="inp" id="cN" maxlength="40" value="${esc(preset)}">
     <div class="row gap">
       <div class="grow"><label class="lbl">kcal</label><input class="inp" id="cK" type="number" inputmode="numeric" min="0" max="5000"></div>
       <div class="grow"><label class="lbl">Eiweiß (g)</label><input class="inp" id="cP" type="number" inputmode="numeric" min="0" max="300" value="0"></div>
     </div>
     <label class="lbl">Portion</label><input class="inp" id="cPo" maxlength="20" placeholder="z.B. 1 Teller" value="1 Portion">
     <label class="row gap check-l"><input type="checkbox" id="cJ"> Das ist Junkfood</label>
     <label class="row gap check-l"><input type="checkbox" id="cS" checked> In meiner Liste speichern</label>
     <p class="small muted">Tipp: kcal stehen hinten auf der Packung. Bei Restaurant-Essen lieber etwas mehr schätzen.</p>
     <button class="btn primary full mt" id="cAdd">Hinzufügen</button>`,
    {
      onMount: (b) => {
        b.querySelector('#cAdd').onclick = () => {
          const name = b.querySelector('#cN').value.trim();
          const kcal = Math.round(Number(b.querySelector('#cK').value));
          const p = Math.round(Number(b.querySelector('#cP').value) || 0);
          const portion = b.querySelector('#cPo').value.trim() || '1 Portion';
          const junk = b.querySelector('#cJ').checked ? 1 : 0;
          if (!name || !kcal || kcal < 0) return toast('Name und kcal eingeben.');
          if (b.querySelector('#cS').checked) {
            const s = S();
            s.customFoods = s.customFoods.filter((f) => f[0] !== name);
            s.customFoods.unshift([name, kcal, p, portion, junk]);
            save();
          }
          addFood({ name, kcal, p, qty: 1, meal: defaultMeal(), junk: !!junk });
          closeSheet();
          app.ui.foodQ = '';
          toast('Eingetragen.');
          app.rerender();
        };
      },
    }
  );
}

// ---------- Schlaf ----------
function sleep() {
  const s = S();
  const k = todayKey();
  const cur = s.sleep[k];
  const g = s.profile.sleepGoal;
  const week = last7((dk) => {
    const e = s.sleep[dk];
    return { v: e ? e.hours : 0, cls: e && e.hours < g - 0.5 ? 'low' : '' };
  });
  const logged = Object.keys(s.sleep)
    .sort()
    .reverse()
    .slice(0, 14)
    .map((dk) => s.sleep[dk]);
  const avg = logged.length ? Math.round((logged.reduce((a, e) => a + e.hours, 0) / logged.length) * 10) / 10 : null;
  const bed = cur ? cur.bed : '23:00';
  const wake = cur ? cur.wake : '07:00';
  return `
  <section class="card">
    <b>Letzte Nacht</b>
    <div class="row gap mt">
      <div class="grow"><label class="lbl">Ins Bett</label><input class="inp" type="time" id="sBed" value="${bed}"></div>
      <div class="grow"><label class="lbl">Aufgestanden</label><input class="inp" type="time" id="sWake" value="${wake}"></div>
    </div>
    <div class="sleep-calc" id="sCalc">${de(sleepHours(bed, wake))} Stunden</div>
    <label class="lbl">Wie gut?</label>
    <div class="stars" id="sQ">${[1, 2, 3, 4, 5].map((i) => `<button class="star ${cur && cur.q >= i ? 'on' : ''}" data-q="${i}">★</button>`).join('')}</div>
    <button class="btn primary full mt" data-act="sleep-save">${cur ? 'Aktualisieren' : 'Eintragen'}</button>
  </section>

  <section class="card">
    <div class="row between"><b>Letzte 7 Nächte</b><span class="small muted">${avg ? `Ø ${de(avg)} h` : ''}</span></div>
    ${bars(week, { goal: g, unit: 'h', color: 'var(--blue)' })}
    ${
      avg !== null && avg < g - 0.5
        ? `<p class="small bad-t mt">Du schläfst zu wenig. Weniger Schlaf = mehr Hunger, weniger Fokus, stärkere Dränge.</p>`
        : avg !== null
        ? `<p class="small good-t mt">Guter Schnitt. Jetzt noch feste Zeiten.</p>`
        : ''
    }
  </section>

  <section class="card tips">
    <b>Besser schlafen</b>
    <ul>
      <li>Handy ab 30 Minuten vor dem Schlafen aus dem Zimmer.</li>
      <li>Jeden Tag gleiche Aufstehzeit, auch am Wochenende.</li>
      <li>Kein Energy Drink oder Kaffee nach 14 Uhr.</li>
      <li>Zimmer kühl und dunkel.</li>
      <li>Nicht einschlafen können? 4-7-8-Atmung unter „Geist“.</li>
    </ul>
  </section>`;
}

// ---------- Sport ----------
function sport() {
  const s = S();
  const k = todayKey();
  const today = s.workouts[k] || [];
  const st = workoutStreak();
  const week = last7((dk) => ({ v: workoutMin(dk) }));
  const wk = week.reduce((a, d) => a + d.v, 0);
  return `
  <div class="stats3 card">
    <div><b>${workoutMin(k)}</b><span>Min heute</span></div>
    <div><b>${wk}</b><span>Min Woche</span></div>
    <div><b>🔥 ${st}</b><span>Tage Serie</span></div>
  </div>

  <h3 class="h3">Training eintragen</h3>
  <div class="wtypes">${WORKOUT_TYPES.map(([n, i]) => `<button class="card wtype" data-act="workout-add" data-type="${esc(n)}" data-ico="${i}"><span>${i}</span>${esc(n)}</button>`).join('')}</div>

  ${
    today.length
      ? `<h3 class="h3 mt2">Heute</h3><section class="card list">${today
          .map(
            (w) => `<div class="food-row"><span class="grow left">${w.ico || '🔥'} ${esc(w.type)} <span class="small muted">${'⚡'.repeat(w.int || 1)} ${w.note ? '· ' + esc(w.note) : ''}</span></span><b>${w.min} min</b><button class="x" data-act="workout-del" data-id="${w.id}">×</button></div>`
          )
          .join('')}</section>`
      : ''
  }

  <section class="card mt2">
    <div class="row between"><b>Letzte 7 Tage</b><span class="small muted">Minuten</span></div>
    ${bars(week, { color: 'var(--good)' })}
  </section>
  <section class="card">
    <b>Trainingstage</b>
    ${heatmap((dk) => {
      const m = workoutMin(dk);
      return m === 0 ? 0 : m < 20 ? 1 : m < 40 ? 2 : m < 70 ? 3 : 4;
    }, { color: 'var(--good)' })}
  </section>

  <section class="card tips">
    <b>Kein Gym? 15-Minuten-Zirkel</b>
    <ul>
      <li>15 Liegestütze</li><li>20 Kniebeugen</li><li>10 Ausfallschritte pro Bein</li><li>30 Sekunden Plank</li><li>4 Runden, 1 Minute Pause</li>
    </ul>
  </section>`;
}

function openWorkout(app, type, ico) {
  let min = 30;
  let int = 2;
  sheet(
    `<h3 class="sheet-title">${ico} ${esc(type)}</h3>
     <label class="lbl">Dauer</label>
     <div class="chips">${[10, 15, 20, 30, 45, 60, 90].map((m) => `<button class="chip ${m === min ? 'on' : ''}" data-m="${m}">${m} Min</button>`).join('')}</div>
     <input class="inp" id="wMin" type="number" inputmode="numeric" min="1" max="600" value="${min}">
     <label class="lbl">Wie hart?</label>
     <div class="chips">${[
       [1, 'Locker'],
       [2, 'Normal'],
       [3, 'Brutal'],
     ]
       .map(([v, l]) => `<button class="chip ${v === int ? 'on' : ''}" data-i="${v}">${'⚡'.repeat(v)} ${l}</button>`)
       .join('')}</div>
     <label class="lbl">Notiz (optional)</label>
     <input class="inp" id="wNote" maxlength="80" placeholder="z.B. Brust & Trizeps, 5 km">
     <button class="btn primary full mt" id="wAdd">Eintragen</button>`,
    {
      onMount: (b) => {
        const mi = b.querySelector('#wMin');
        b.querySelectorAll('[data-m]').forEach((x) =>
          x.addEventListener('click', () => {
            mi.value = x.dataset.m;
            b.querySelectorAll('[data-m]').forEach((y) => y.classList.toggle('on', y === x));
          })
        );
        b.querySelectorAll('[data-i]').forEach((x) =>
          x.addEventListener('click', () => {
            int = Number(x.dataset.i);
            b.querySelectorAll('[data-i]').forEach((y) => y.classList.toggle('on', y === x));
          })
        );
        b.querySelector('#wAdd').onclick = () => {
          min = Math.round(Number(mi.value));
          if (!min || min < 1 || min > 600) return toast('Gib die Minuten ein.');
          addWorkout({ type, ico, min, int, note: b.querySelector('#wNote').value.trim() });
          closeSheet();
          toast(int === 3 ? 'Brutal. Respekt.' : 'Training eingetragen. Stark.');
          app.rerender();
        };
      },
    }
  );
}

export function mount(root, app) {
  const q = root.querySelector('#foodQ');
  if (q) {
    q.addEventListener('input', () => {
      app.ui.foodQ = q.value;
      root.querySelector('#foodRes').innerHTML = foodResults(q.value);
    });
  }
  const bed = root.querySelector('#sBed');
  if (bed) {
    const wake = root.querySelector('#sWake');
    const calc = () => (root.querySelector('#sCalc').textContent = de(sleepHours(bed.value || "23:00", wake.value || "07:00")) + " Stunden");
    bed.addEventListener('input', calc);
    wake.addEventListener('input', calc);
    root.querySelectorAll('#sQ .star').forEach((st) =>
      st.addEventListener('click', () => {
        const q = Number(st.dataset.q);
        root.querySelectorAll('#sQ .star').forEach((x) => x.classList.toggle('on', Number(x.dataset.q) <= q));
        app.ui.sleepQ = q;
      })
    );
  }
}

export const actions = {
  'body-tab': (el, app) => {
    app.ui.bodyTab = el.dataset.v;
    app.rerender(true);
  },
  'food-pick': (el, app) => openFoodPick(app, el.dataset.name),
  'food-custom': (el, app) => openFoodCustom(app, el.dataset.name || ''),
  'food-del': (el, app) => {
    removeFood(el.dataset.id);
    app.rerender();
  },
  'sleep-save': (el, app) => {
    const root = document.getElementById('view');
    const bed = root.querySelector('#sBed').value;
    const wake = root.querySelector('#sWake').value;
    if (!bed || !wake) return toast('Gib beide Uhrzeiten ein.');
    const cur = S().sleep[todayKey()];
    const q = app.ui.sleepQ || (cur && cur.q) || 3;
    const h = logSleep(todayKey(), bed, wake, q);
    const g = S().profile.sleepGoal;
    toast(h >= g - 0.25 ? `${de(h)} h. Schlafziel geschafft.` : `${de(h)} h. Zu wenig. Heute früher ins Bett.`, h >= g - 0.25 ? '' : 'bad');
    app.ui.sleepQ = null;
    app.rerender();
  },
  'workout-add': (el, app) => openWorkout(app, el.dataset.type, el.dataset.ico),
  'workout-del': (el, app) => {
    removeWorkout(el.dataset.id);
    app.rerender();
  },
};
