import { S, save, todayKey, keyToDate } from '../store.js';
import { esc, segmented, toast, fmtDate, sheet, closeSheet, xpFloat } from '../ui.js';
import { saveJournal, breathDone, affirm } from '../logic.js';
import { QUOTES, AFFIRMATIONS, JOURNAL_PROMPTS, MOODS, BREATHING } from '../data.js';

function dayNum(k = todayKey()) {
  return Math.floor(keyToDate(k).getTime() / 86400000);
}

export function quoteOfDay() {
  const n = dayNum() + (S().quoteShift || 0);
  return QUOTES[((n % QUOTES.length) + QUOTES.length) % QUOTES.length];
}

function promptOfDay() {
  return JOURNAL_PROMPTS[dayNum() % JOURNAL_PROMPTS.length];
}

function todaysAffirmations() {
  const own = S().affirmations;
  const pool = [...own, ...AFFIRMATIONS];
  const n = dayNum();
  const out = [];
  // eigene zuerst, dann rotierend aus der Liste
  for (let i = 0; out.length < 3 && i < pool.length; i++) {
    const a = i < own.length ? own[(n + i) % own.length] : AFFIRMATIONS[(n * 3 + i) % AFFIRMATIONS.length];
    if (!out.includes(a)) out.push(a);
  }
  return out;
}

export function render(app) {
  const tab = app.ui.mindTab || 'journal';
  return `
  <header class="top"><h1 class="h1">Geist</h1></header>
  ${segmented('mind-tab', [['journal', '📓 Tagebuch'], ['breath', '🌬️ Atmen'], ['affirm', '✨ Mindset']], tab)}
  ${tab === 'journal' ? journal(app) : tab === 'breath' ? breath() : affirmView()}
  `;
}

// ---------- Tagebuch ----------
function journal(app) {
  const s = S();
  const k = todayKey();
  const j = s.journal[k] || {};
  const mood = app.ui.mood ?? j.mood ?? 0;
  const grat = j.grat || ['', '', ''];
  const past = Object.keys(s.journal)
    .filter((x) => x !== k)
    .sort()
    .reverse()
    .slice(0, 30);
  return `
  <section class="card">
    <b>Wie geht's dir heute?</b>
    <div class="moods">${MOODS.map((m) => `<button class="mood ${mood === m.v ? 'on' : ''}" data-act="mood" data-v="${m.v}"><span>${m.e}</span>${m.l}</button>`).join('')}</div>
    <label class="lbl">${esc(j.prompt || promptOfDay())}</label>
    <textarea class="inp ta" id="jText" rows="6" placeholder="Schreib einfach drauf los…">${esc(j.text || '')}</textarea>
    <label class="lbl">3 Dinge, für die du dankbar bist</label>
    ${[0, 1, 2].map((i) => `<input class="inp mb" id="jG${i}" maxlength="80" placeholder="${i + 1}." value="${esc(grat[i] || '')}">`).join('')}
    <button class="btn primary full mt" data-act="journal-save">${j.t ? 'Aktualisieren' : 'Speichern'}</button>
  </section>

  ${
    past.length
      ? `<h3 class="h3 mt2">Frühere Einträge</h3>
  ${past
    .map((pk) => {
      const e = s.journal[pk];
      const m = MOODS.find((x) => x.v === e.mood);
      return `<details class="card entry"><summary><span>${m ? m.e : '📓'}</span><span class="grow">${fmtDate(pk)}</span><span class="small muted">${esc((e.text || '').slice(0, 24))}${(e.text || '').length > 24 ? '…' : ''}</span></summary>
      ${e.prompt ? `<p class="small muted">${esc(e.prompt)}</p>` : ''}
      <p class="pre">${esc(e.text || '')}</p>
      ${(e.grat || []).filter(Boolean).length ? `<p class="small"><b>Dankbar:</b> ${(e.grat || []).filter(Boolean).map(esc).join(' · ')}</p>` : ''}
    </details>`;
    })
    .join('')}`
      : ''
  }`;
}

// ---------- Atmen ----------
function breath() {
  const s = S();
  const n = s.breath[todayKey()] || 0;
  const total = Object.values(s.breath).reduce((a, b) => a + b, 0);
  return `
  <div class="stats3 card">
    <div><b>${n}</b><span>heute</span></div>
    <div><b>${total}</b><span>gesamt</span></div>
    <div><b>${Math.max(0, 3 - n)}</b><span>mit XP übrig</span></div>
  </div>
  ${BREATHING.map(
    (b) => `<button class="card breath-card" data-act="breath-start" data-v="${b.id}">
      <div class="breath-dot"></div>
      <div class="grow left"><b>${b.name}</b><span class="small muted block">${b.desc}</span></div>
      <span class="small muted nowrap">${Math.round((b.phases.reduce((a, p) => a + p[1], 0) * b.rounds) / 6) / 10} Min</span>
    </button>`
  ).join('')}`;
}

export function startBreathing(id) {
  const ex = BREATHING.find((b) => b.id === id) || BREATHING[0];
  const el = document.createElement('div');
  el.className = 'breath-ov';
  el.innerHTML = `
    <button class="breath-x" aria-label="beenden">×</button>
    <div class="breath-title">${ex.name}</div>
    <div class="breath-stage">
      <div class="breath-circle"></div>
      <div class="breath-txt"><b>Bereit?</b><span></span></div>
    </div>
    <div class="breath-round">Runde 0 / ${ex.rounds}</div>
    <div class="breath-tip muted small">Atme durch die Nase ein, durch den Mund aus.</div>`;
  document.body.appendChild(el);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => el.classList.add('show'));

  const circle = el.querySelector('.breath-circle');
  const label = el.querySelector('.breath-txt b');
  const count = el.querySelector('.breath-txt span');
  const roundEl = el.querySelector('.breath-round');
  let timers = [];
  let stopped = false;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  const close = () => {
    stopped = true;
    timers.forEach(clearTimeout);
    el.classList.remove('show');
    document.body.classList.remove('no-scroll');
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector('.breath-x').onclick = close;

  let round = 0;
  let pi = 0;
  const runPhase = () => {
    if (stopped) return;
    if (pi === 0) {
      round++;
      if (round > ex.rounds) return finish();
      roundEl.textContent = `Runde ${round} / ${ex.rounds}`;
    }
    const [name, secs, kind] = ex.phases[pi];
    label.textContent = name;
    circle.style.transitionDuration = secs + 's';
    if (kind === 'in') circle.className = 'breath-circle big';
    else if (kind === 'out') circle.className = 'breath-circle';
    else circle.className = 'breath-circle ' + (kind === 'hold' ? 'big hold' : 'hold');
    let left = secs;
    count.textContent = left;
    for (let i = 1; i < secs; i++) later(() => (count.textContent = secs - i), i * 1000);
    later(() => {
      pi = (pi + 1) % ex.phases.length;
      runPhase();
    }, secs * 1000);
  };

  const finish = () => {
    label.textContent = 'Geschafft';
    count.textContent = '';
    circle.className = 'breath-circle done';
    const xp = breathDone();
    roundEl.innerHTML = xp ? `+${xp} XP · Gut gemacht.` : 'Gut gemacht. (Heute schon 3× XP bekommen)';
    later(close, 2600);
    window.dispatchEvent(new Event('vow:changed'));
  };

  // 3-2-1 Start
  count.textContent = '3';
  later(() => (count.textContent = '2'), 1000);
  later(() => (count.textContent = '1'), 2000);
  later(runPhase, 3000);
}

// ---------- Mindset: Affirmationen & Zitate ----------
function affirmView() {
  const s = S();
  const k = todayKey();
  const done = !!s.affirmedOn[k];
  const q = quoteOfDay();
  return `
  <section class="card affirm-card ${done ? 'done' : ''}">
    <div class="kicker">Deine Affirmationen heute</div>
    ${todaysAffirmations()
      .map((a) => `<p class="affirm">${esc(a)}</p>`)
      .join('')}
    <p class="small muted">Lies sie laut oder im Kopf. Langsam. Mein es.</p>
    <button class="btn ${done ? 'ghost' : 'primary'} full" data-act="affirm" ${done ? 'disabled' : ''}>${done ? '✓ Heute bestätigt' : 'Ich bestätige das (+5 XP)'}</button>
  </section>

  <section class="card quote">
    <div class="quote-mark">“</div>
    <p>${esc(q.t)}</p>
    <div class="row between"><span class="muted small">${esc(q.a)}</span><button class="btn sm ghost" data-act="quote-next">Neues Zitat</button></div>
  </section>

  <div class="row between mt2"><h3 class="h3 m0">Eigene Affirmationen</h3><button class="btn sm" data-act="affirm-add">+ Neu</button></div>
  <section class="card list">
    ${
      s.affirmations.length
        ? s.affirmations.map((a, i) => `<div class="food-row"><span class="grow left">${esc(a)}</span><button class="x" data-act="affirm-del" data-v="${i}">×</button></div>`).join('')
        : `<div class="empty small">Schreib Sätze, die du über dich glauben willst. Sie kommen dann zuerst dran.</div>`
    }
  </section>`;
}

export const actions = {
  'mind-tab': (el, app) => {
    app.ui.mindTab = el.dataset.v;
    app.rerender(true);
  },
  mood: (el, app) => {
    app.ui.mood = Number(el.dataset.v);
    document.querySelectorAll('.mood').forEach((m) => m.classList.toggle('on', m === el));
  },
  'journal-save': (el, app) => {
    const root = document.getElementById('view');
    const text = root.querySelector('#jText').value;
    const grat = [0, 1, 2].map((i) => root.querySelector('#jG' + i).value.trim());
    const s = S();
    const j = s.journal[todayKey()] || {};
    const mood = app.ui.mood ?? j.mood ?? 0;
    if (!text.trim() && !grat.some(Boolean)) return toast('Schreib erst etwas.');
    const ok = saveJournal(todayKey(), { text, grat, mood, prompt: j.prompt || promptOfDay() });
    app.ui.mood = null;
    toast(ok ? 'Gespeichert. Gut, dass du ehrlich zu dir bist.' : 'Gespeichert. Schreib etwas mehr für XP (20+ Zeichen).');
    app.rerender();
  },
  'breath-start': (el) => {
    closeSheet();
    startBreathing(el.dataset.v);
  },
  affirm: (el, app) => {
    affirm();
    toast('Bestätigt. Jetzt lebe danach.');
    app.rerender();
  },
  'quote-next': (el, app) => {
    S().quoteShift = (S().quoteShift || 0) + 1;
    save();
    app.rerender();
  },
  'affirm-add': (el, app) => {
    sheet(
      `<h3 class="sheet-title">Neue Affirmation</h3>
       <p class="small muted">Schreib sie so, als wäre sie schon wahr. Ich-Form, Gegenwart. Z.B. „Ich bin jemand, der jeden Tag trainiert.“</p>
       <textarea class="inp ta" id="aT" rows="3" maxlength="140"></textarea>
       <button class="btn primary full mt" id="aS">Speichern</button>`,
      {
        onMount: (b) => {
          b.querySelector('#aT').focus();
          b.querySelector('#aS').onclick = () => {
            const v = b.querySelector('#aT').value.trim();
            if (!v) return;
            S().affirmations.push(v);
            save();
            closeSheet();
            app.rerender();
          };
        },
      }
    );
  },
  'affirm-del': (el, app) => {
    S().affirmations.splice(Number(el.dataset.v), 1);
    save();
    app.rerender();
  },
};
