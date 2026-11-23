import { S, todayKey } from '../store.js';
import { rankFor, xpToday } from '../xp.js';
import { esc, emblem, ring, fmtSince, fmtDate } from '../ui.js';
import { activeHabits, isDone, cleanMs, foodTotals, workoutMin, habitStreak } from '../logic.js';
import { brief } from '../coach.js';
import { quoteOfDay } from './mind.js';
import { commitCard } from './oath.js';

function greet() {
  const h = new Date().getHours();
  if (h < 5) return 'Noch wach';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hey';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}

export function render() {
  const s = S();
  const k = todayKey();
  const r = rankFor(s.xp);
  const xt = xpToday();
  const b = brief();
  const hs = activeHabits();
  const done = hs.filter((h) => isDone(h.id, k)).length;
  const t = foodTotals(k);
  const sl = s.sleep[k];
  const wm = workoutMin(k);
  const q = quoteOfDay();

  return `
  <header class="top">
    <div>
      <div class="kicker">${fmtDate(k)}</div>
      <h1 class="h1">${greet()}${s.profile.name ? ', ' + esc(s.profile.name) : ''}</h1>
    </div>
  </header>

  <section class="card rank-card" style="--rc:${r.color}" data-act="go" data-v="profile:">
    <div class="rank-card-emb">${emblem(r, 74)}</div>
    <div class="grow">
      <div class="rank-name">${esc(r.full)}</div>
      <div class="xpbar"><div style="width:${r.progress * 100}%"></div></div>
      <div class="row between gap small muted">
        <span>${s.xp} XP</span>
        <span>${r.next ? `noch ${r.toNext} bis ${esc(r.next.full)}` : 'Höchster Rang'}</span>
      </div>
    </div>
    <div class="xp-today ${xt < 0 ? 'neg' : ''}"><b>${xt >= 0 ? '+' : ''}${xt}</b><span>heute</span></div>
  </section>

  ${commitCard()}

  <section class="card coach-card">
    <div class="coach-head"><span class="coach-dot"></span>Coach</div>
    <p>${esc(b.text)}</p>
    <button class="next-act" ${b.next.go ? `data-act="go" data-v="${b.next.go}:${b.next.tab || ''}"` : ''}>
      <span class="small muted">Jetzt dran</span>
      <span>${esc(b.next.text)}</span>
    </button>
  </section>

  ${
    s.bad.length
      ? `<h2 class="h2">Clean-Serien</h2>
  <div class="bad-row">
    ${s.bad
      .map(
        (bd) => `<div class="card bad-mini" data-act="bad-open" data-id="${bd.id}">
        <div class="bad-ico">${bd.icon}</div>
        <div class="bad-name">${esc(bd.name)}</div>
        <div class="bad-time" data-since="${cleanMsStart(bd)}">${fmtSince(cleanMs(bd))}</div>
      </div>`
      )
      .join('')}
  </div>
  <button class="btn urge" data-act="urge">🚨 Ich hab gerade Drang</button>`
      : ''
  }

  <div class="row between mt2">
    <h2 class="h2 m0">Heute</h2>
    <span class="pill">${done}/${hs.length}</span>
  </div>
  <section class="card list">
    ${
      hs.length
        ? hs
            .map((h) => {
              const d = isDone(h.id, k);
              const st = habitStreak(h.id);
              return `<button class="check-row ${d ? 'done' : ''}" data-act="habit-toggle" data-id="${h.id}">
            <span class="check-ico">${h.icon}</span>
            <span class="grow left">${esc(h.name)}${st ? `<span class="streak-s">🔥 ${st}</span>` : ''}</span>
            <span class="check-box">${d ? '✓' : ''}</span>
          </button>`;
            })
            .join('')
        : `<div class="empty">Noch keine Gewohnheiten. <button class="link" data-act="go" data-v="habits:">Jetzt anlegen</button></div>`
    }
  </section>

  <div class="tiles">
    <button class="card tile" data-act="go" data-v="body:food">
      ${ring(t.kcal, s.profile.kcalGoal, { size: 62, stroke: 7, color: 'var(--gold)', inner: '🍽️' })}
      <div><b>${t.kcal}</b><span class="muted"> / ${s.profile.kcalGoal}</span></div>
      <span class="tile-l">Kalorien</span>
    </button>
    <button class="card tile" data-act="go" data-v="body:sleep">
      <div class="tile-big">${sl ? String(sl.hours).replace('.', ',') + '<small>h</small>' : '–'}</div>
      <span class="tile-l">${sl ? 'Schlaf' : 'Schlaf eintragen'}</span>
    </button>
    <button class="card tile" data-act="go" data-v="body:sport">
      <div class="tile-big">${wm}<small>min</small></div>
      <span class="tile-l">Sport</span>
    </button>
    <button class="card tile ${s.journal[k] ? 'ok' : ''}" data-act="go" data-v="mind:journal">
      <div class="tile-big">${s.journal[k] ? '✓' : '📓'}</div>
      <span class="tile-l">Tagebuch</span>
    </button>
    <button class="card tile" data-act="go" data-v="mind:breath">
      <div class="tile-big">${s.breath[k] || 0}<small>×</small></div>
      <span class="tile-l">Atmen</span>
    </button>
    <button class="card tile ${s.affirmedOn[k] ? 'ok' : ''}" data-act="go" data-v="mind:affirm">
      <div class="tile-big">${s.affirmedOn[k] ? '✓' : '✨'}</div>
      <span class="tile-l">Affirmation</span>
    </button>
  </div>

  <section class="card quote">
    <div class="quote-mark">“</div>
    <p>${esc(q.t)}</p>
    <span class="muted small">${esc(q.a)}</span>
  </section>
  `;
}

function cleanMsStart(bd) {
  return Date.now() - cleanMs(bd);
}
