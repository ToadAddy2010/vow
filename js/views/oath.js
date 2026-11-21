// Der Schwur: Dauer wählen, dann gedrückt halten, bis der Kreis den ganzen Bildschirm füllt
import { S, save, todayKey, daysBetween } from '../store.js';
import { esc, confirmBox } from '../ui.js';

const HOLD_MS = 2400;
const OPTIONS = [
  ['7', '7', 'Tage', 'Der Anfang'],
  ['30', '30', 'Tage', 'Aus Versuch wird Gewohnheit'],
  ['365', '365', 'Tage', 'Ein ganzes Jahr'],
  ['forever', 'Immer', 'Ohne Enddatum', 'Das bist jetzt du'],
];

export const commitDays = (v) => (v === 'forever' ? null : Number(v));

export function setCommitment(days) {
  S().commitment = { days, startKey: todayKey() };
  save();
}

function progress() {
  const c = S().commitment;
  if (!c) return null;
  const day = Math.max(1, daysBetween(c.startKey, todayKey()) + 1);
  if (!c.days) return { day, forever: true };
  return { day: Math.min(day, c.days), total: c.days, left: Math.max(0, c.days - day), done: day > c.days, share: Math.min(1, day / c.days) };
}

export function commitSummary() {
  const p = progress();
  if (!p) return '';
  if (p.forever) return `Für immer · Tag ${p.day}`;
  return p.done ? `${p.total} Tage · gehalten` : `${p.total} Tage · Tag ${p.day}`;
}

export function commitCard() {
  const p = progress();
  if (!p) return '';
  if (p.done) {
    return `<section class="card commit-card">
      <div class="commit-head"><b>Schwur gehalten</b><span class="commit-day">${p.total} Tage</span></div>
      <p class="small muted">Du hast es durchgezogen. Was kommt als Nächstes?</p>
      <button class="btn primary full" data-act="commit-new">Neu schwören</button>
    </section>`;
  }
  if (p.forever) {
    return `<section class="card commit-card">
      <div class="commit-head"><b>Dein Schwur</b><span class="commit-day">Tag ${p.day}</span></div>
      <p class="small muted">Für immer. Kein Enddatum.</p>
    </section>`;
  }
  return `<section class="card commit-card">
    <div class="commit-head"><b>Dein Schwur</b><span class="commit-day">Tag ${p.day} von ${p.total}</span></div>
    <div class="commit-bar"><div style="width:${p.share * 100}%"></div></div>
    <p class="small muted">${p.left === 0 ? 'Letzter Tag. Zieh ihn durch.' : `Noch ${p.left} ${p.left === 1 ? 'Tag' : 'Tage'}.`}</p>
  </section>`;
}

export function commitPicker(action) {
  return `<h2 class="ob-h">Wie viele Tage committest du dich?</h2>
    <p class="muted">Wähl ehrlich. Danach gibt es kein „ich fang morgen an“ mehr.</p>
    <div class="commit-grid">${OPTIONS.map(
      ([v, big, unit, note]) => `<button class="commit-opt" data-act="${action}" data-v="${v}"><b>${big}</b><span>${unit}</span><small>${note}</small></button>`
    ).join('')}</div>`;
}

export function render() {
  return `<div class="ob">${commitPicker('commit-pick')}</div>`;
}

export function openOath(name, days, onDone) {
  const line = `Ich, ${esc(name)}, schwöre: ${days ? `${days} Tage lang ziehe ich das durch.` : 'Ab heute ziehe ich das für immer durch.'}`;
  const top = `<div class="oath-top"><div class="oath-kicker">Dein Schwur</div><p class="oath-line">${line}</p></div>`;
  const el = document.createElement('div');
  el.className = 'oath';
  el.innerHTML = `
    <button class="oath-x" aria-label="Zurück">×</button>
    <div class="oath-layer">
      ${top}
      <button class="oath-hold" aria-label="Ich schwöre. Gedrückt halten.">Ich schwöre</button>
      <div class="oath-bottom"><span class="oath-hint">Gedrückt halten</span></div>
    </div>
    <div class="oath-fill" aria-hidden="true">
      ${top}
      <div class="oath-hold">Ich schwöre</div>
      <div class="oath-bottom"><span class="oath-hint">Gedrückt halten</span></div>
      <div class="oath-sworn">Geschworen.</div>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => el.classList.add('show'));

  const hold = el.querySelector('button.oath-hold');
  const hints = el.querySelectorAll('.oath-hint');
  const hint = (text) => hints.forEach((h) => { h.textContent = text; });
  let share = 0;
  let holding = false;
  let finished = false;
  let frame = 0;
  let last = 0;

  const radius = () => (Math.hypot(window.innerWidth, window.innerHeight) / 2 + 2) * Math.pow(share, 1.6);
  const paint = () => el.style.setProperty('--r', `${radius()}px`);

  const close = () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', onHidden);
    document.removeEventListener('keydown', onEscape);
    document.body.classList.remove('no-scroll');
    el.classList.remove('show');
    el.classList.add('out');
    setTimeout(() => el.remove(), 450);
  };

  const complete = () => {
    finished = true;
    holding = false;
    share = 1;
    paint();
    if (navigator.vibrate) navigator.vibrate(40);
    el.classList.add('sworn');
    setTimeout(() => {
      onDone();
      close();
    }, 1100);
  };

  const tick = (now) => {
    const dt = Math.min(now - last, 60);
    last = now;
    share += holding ? dt / HOLD_MS : -dt / 450;
    if (share >= 1) return complete();
    if (share <= 0 && !holding) {
      share = 0;
      paint();
      frame = 0;
      return undefined;
    }
    share = Math.max(share, 0);
    paint();
    frame = requestAnimationFrame(tick);
    return undefined;
  };

  const run = () => {
    if (frame) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  const start = (e) => {
    if (finished || holding) return;
    e.preventDefault();
    holding = true;
    hold.classList.add('held');
    hint('Nicht loslassen');
    if (e.pointerId !== undefined) {
      try {
        hold.setPointerCapture(e.pointerId);
      } catch (err) {}
    }
    run();
  };

  const stop = () => {
    if (finished || !holding) return;
    holding = false;
    hold.classList.remove('held');
    hint('Zu früh. Halt, bis der Kreis alles füllt.');
    run();
  };

  function onHidden() {
    if (document.hidden) stop();
  }
  function onEscape(e) {
    if (e.key === 'Escape' && !finished) close();
  }

  hold.addEventListener('pointerdown', start);
  ['pointerup', 'pointercancel', 'lostpointercapture', 'blur'].forEach((type) => hold.addEventListener(type, stop));
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) start(e);
  });
  hold.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') stop();
  });
  el.querySelector('.oath-x').addEventListener('click', () => {
    if (!finished) close();
  });
  document.addEventListener('visibilitychange', onHidden);
  document.addEventListener('keydown', onEscape);
  hold.focus({ preventScroll: true });
}

function restart(app) {
  S().commitment = null;
  save();
  app.go('today');
}

export const actions = {
  'commit-pick': (el, app) => {
    const days = commitDays(el.dataset.v);
    openOath(S().profile.name, days, () => {
      setCommitment(days);
      app.go('today');
    });
  },
  'commit-new': (el, app) => restart(app),
  'commit-change': async (el, app) => {
    if (await confirmBox('Schwur ändern?', 'Dein aktueller Schwur endet dann, und du legst einen neuen ab.', 'Neu schwören', true)) restart(app);
  },
};
