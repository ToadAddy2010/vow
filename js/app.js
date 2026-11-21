import { load, S, save, todayKey, askPersist } from './store.js';
import { onXP, award } from './xp.js';
import { dailyStart, cleanMs } from './logic.js';
import { esc, toast, xpFloat, rankOverlay, sheet, closeSheet, fmtSince } from './ui.js';
import * as today from './views/today.js';
import * as habits from './views/habits.js';
import * as body from './views/body.js';
import * as mind from './views/mind.js';
import * as coach from './views/coachview.js';
import * as profile from './views/profile.js';
import * as onboarding from './views/onboarding.js';

const VIEWS = { today, habits, body, mind, coach, profile, onboarding };

const NAV = [
  ['today', 'Heute', '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'],
  ['habits', 'Habits', '<path d="M4 12.5 9 17.5 20 6.5"/>'],
  ['body', 'Körper', '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>'],
  ['mind', 'Geist', '<path d="M12 3a6 6 0 0 0-6 6c0 2.2 1.2 3.6 2.2 4.6.6.6.8 1.2.8 2V17h6v-1.4c0-.8.2-1.4.8-2 1-1 2.2-2.4 2.2-4.6a6 6 0 0 0-6-6zM9.5 20.5h5"/>'],
  ['coach', 'Coach', '<path d="M4 5h16v11H9l-5 4z"/>'],
];

const app = {
  view: 'today',
  ui: {},
  rerender(scrollTop = false) {
    render(scrollTop);
  },
  go(v, tab) {
    if (v === 'body' && tab) app.ui.bodyTab = tab;
    if (v === 'mind' && tab) app.ui.mindTab = tab;
    closeSheet();
    app.view = v;
    render(true);
  },
};

function render(scrollTop) {
  const s = S();
  const root = document.getElementById('view');
  const nav = document.getElementById('nav');
  let v = app.view;
  if (!s.onboarded) v = 'onboarding';
  const y = window.scrollY;
  root.className = 'view v-' + v;
  root.innerHTML = VIEWS[v].render(app);
  VIEWS[v].mount && VIEWS[v].mount(root, app);
  nav.hidden = v === 'onboarding';
  nav.innerHTML = NAV.map(
    ([id, label, path]) =>
      `<button class="nav-b ${id === v ? 'on' : ''}" data-act="go" data-v="${id}:" aria-label="${label}">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>
        <span>${label}</span>
      </button>`
  ).join('');
  if (v !== 'coach') window.scrollTo(0, scrollTop ? 0 : y);
}

// Neu zeichnen, ohne halb getippte Eingaben zu verlieren (z.B. nach App-Wechsel am Handy)
function renderKeep() {
  const values = new Map();
  document.querySelectorAll('#view input[id], #view textarea[id]').forEach((el) => {
    if (el.type !== 'file') values.set(el.id, el.type === 'checkbox' ? el.checked : el.value);
  });
  const focused = document.activeElement && document.activeElement.id;
  render();
  values.forEach((value, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = value;
    else el.value = value;
  });
  if (focused) document.getElementById(focused)?.focus();
}

// ---------- Drang-Notfall ----------
function urge() {
  const s = S();
  const k = todayKey();
  let left = 10 * 60;
  let timer;
  sheet(
    `<div class="urge-sheet">
      <div class="kicker bad-t">DRANG-NOTFALL</div>
      <h3 class="sheet-title">Halte 10 Minuten durch.</h3>
      <p class="muted">Ein Drang ist eine Welle. Sie geht vorbei, wenn du nicht mitschwimmst.</p>
      <div class="urge-timer" id="uT">10:00</div>
      <div class="urge-steps">
        ${['Steh auf und verlass den Raum', 'Handy weg oder in ein anderes Zimmer', '20 Liegestütze oder kaltes Wasser ins Gesicht', 'Drang-Killer-Atmung machen', 'Denk an deine Serie: ' + s.bad.map((b) => `${b.icon} ${fmtSince(cleanMs(b))}`).join(', ')]
          .map((t, i) => `<label class="urge-step"><input type="checkbox"><span>${esc(t)}</span></label>`)
          .join('')}
      </div>
      <button class="btn full mt" data-act="breath-start" data-v="urge">🌬️ Drang-Killer-Atmung</button>
      <button class="btn ghost full mt" data-act="ask" data-v="Ich hab Drang">💬 Mit dem Coach reden</button>
      <button class="btn primary full mt" id="uOk">💪 Drang überstanden</button>
    </div>`,
    {
      tall: true,
      onMount: (b) => {
        const t = b.querySelector('#uT');
        timer = setInterval(() => {
          left--;
          if (left <= 0) {
            clearInterval(timer);
            t.textContent = 'Geschafft';
            t.classList.add('good-t');
            return;
          }
          t.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        }, 1000);
        b.querySelector('#uOk').onclick = () => {
          s.urgesBeaten = s.urgesBeaten || {};
          const n = (s.urgesBeaten[k] = (s.urgesBeaten[k] || 0) + 1);
          if (n <= 3) award(k, 'urge' + n, 15, '🛡️ Drang besiegt');
          save();
          closeSheet();
          toast('Stark. Genau so baut man Disziplin.');
          render();
        };
      },
      onClose: () => clearInterval(timer),
    }
  );
}

// ---------- Klicks ----------
const ACTIONS = {
  go: (el) => {
    const [v, tab] = (el.dataset.v || '').split(':');
    app.go(v, tab || undefined);
  },
  urge: () => urge(),
};
for (const V of Object.values(VIEWS)) Object.assign(ACTIONS, V.actions || {});

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) {
    e.preventDefault();
    fn(el, app);
  }
});

// XP-Effekte
onXP(({ amt, before, after }) => {
  xpFloat(amt);
  if (after.i > before.i) setTimeout(() => rankOverlay(after, true), 400);
  else if (after.i < before.i) setTimeout(() => rankOverlay(after, false), 400);
});

// Live-Zähler für Clean-Serien
setInterval(() => {
  document.querySelectorAll('[data-since]').forEach((el) => {
    el.textContent = fmtSince(Date.now() - Number(el.dataset.since));
  });
}, 1000);

// Neuer Tag während die App offen ist / App kommt zurück in den Vordergrund
let lastDay = todayKey();
function checkDay() {
  if (!S().onboarded) return;
  const k = todayKey();
  dailyStart();
  if (k !== lastDay) {
    lastDay = k;
    renderKeep();
  }
}
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    checkDay();
    renderKeep();
  }
});
setInterval(checkDay, 60000);
window.addEventListener('vow:changed', () => renderKeep());

// Start
load();
if (S().onboarded) dailyStart();
askPersist();
render(true);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
