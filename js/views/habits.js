import { S, save, todayKey } from '../store.js';
import { esc, heatmap, sheet, closeSheet, confirmBox, toast, fmtSince, fmtDate, fmtTime } from '../ui.js';
import {
  activeHabits,
  isDone,
  habitStreak,
  habitBest,
  habitTotal,
  addHabit,
  deleteHabit,
  toggleHabit,
  dayScore,
  cleanMs,
  cleanDays,
  bestClean,
  addBad,
  deleteBad,
  relapse,
  relapsePenalty,
  relapseDays,
  lastReset,
} from '../logic.js';
import { HABIT_PRESETS, BAD_PRESETS, ICONS } from '../data.js';

export function render() {
  const s = S();
  const k = todayKey();
  const hs = activeHabits();
  return `
  <header class="top"><h1 class="h1">Gewohnheiten</h1></header>

  <section class="card">
    <div class="row between"><b>Deine Konstanz</b><span class="small muted">letzte 20 Wochen</span></div>
    ${heatmap(dayScore)}
    <div class="hm-legend small muted" style="--hm:var(--accent)"><span>weniger</span><i class="hm-c l0"></i><i class="hm-c l1"></i><i class="hm-c l2"></i><i class="hm-c l3"></i><i class="hm-c l4"></i><span>mehr</span><i class="hm-c bad"></i><span>Rückfall</span></div>
  </section>

  <div class="row between mt2"><h2 class="h2 m0">Gute Gewohnheiten</h2><button class="btn sm" data-act="habit-add">+ Neu</button></div>
  ${
    hs.length
      ? hs
          .map((h) => {
            const d = isDone(h.id, k);
            const st = habitStreak(h.id);
            return `<section class="card habit">
          <div class="row gap">
            <button class="habit-main grow" data-act="habit-open" data-id="${h.id}">
              <span class="check-ico">${h.icon}</span>
              <span class="left"><b>${esc(h.name)}</b><span class="small muted block">🔥 ${st} ${st === 1 ? 'Tag' : 'Tage'} · Rekord ${habitBest(h.id)}</span></span>
            </button>
            <button class="check-box big ${d ? 'on' : ''}" data-act="habit-toggle" data-id="${h.id}" aria-label="abhaken">${d ? '✓' : ''}</button>
          </div>
          ${heatmap((dk) => (dk < todayKey(new Date(h.createdAt)) ? null : isDone(h.id, dk) ? 4 : 0), { weeks: 26, small: true })}
        </section>`;
          })
          .join('')
      : `<div class="card empty">Leg deine erste Gewohnheit an. Klein anfangen schlägt groß planen.</div>`
  }

  <div class="row between mt2"><h2 class="h2 m0">Schlechte Angewohnheiten</h2><button class="btn sm" data-act="bad-add">+ Neu</button></div>
  ${
    s.bad.length
      ? s.bad
          .map(
            (b) => `<section class="card bad" data-act="bad-open" data-id="${b.id}">
        <div class="row gap">
          <span class="bad-ico lg">${b.icon}</span>
          <div class="grow left">
            <b>${esc(b.name)}</b>
            <div class="bad-time big" data-since="${lastReset(b)}">${fmtSince(cleanMs(b))}</div>
            <span class="small muted">Rekord ${fmtSince(bestClean(b))} · ${b.relapses.length} Rückfälle</span>
          </div>
        </div>
        ${heatmap((dk) => (dk < todayKey(new Date(b.startedAt)) ? null : relapseDays(b).has(dk) ? 'bad' : 3), { weeks: 26, small: true, color: "var(--good)" })}
      </section>`
          )
          .join('')
      : `<div class="card empty">Was hält dich zurück? Trag es ehrlich ein. Nur du siehst das.</div>`
  }
  `;
}

// ---------- Aktionen ----------
function emojiPicker(selected) {
  return `<div class="emoji-grid">${ICONS.map((i) => `<button class="emo ${i === selected ? 'on' : ''}" data-emo="${i}">${i}</button>`).join('')}</div>`;
}

function bindEmoji(b, cb) {
  b.querySelectorAll('[data-emo]').forEach((e) =>
    e.addEventListener('click', () => {
      b.querySelectorAll('.emo').forEach((x) => x.classList.remove('on'));
      e.classList.add('on');
      cb(e.dataset.emo);
    })
  );
}

export function openAddHabit(app, bad = false) {
  let icon = bad ? '🔒' : '✅';
  const presets = bad ? BAD_PRESETS : HABIT_PRESETS;
  sheet(
    `<h3 class="sheet-title">${bad ? 'Schlechte Angewohnheit' : 'Neue Gewohnheit'}</h3>
     <div class="chips">${presets.map(([n, i]) => `<button class="chip" data-pre="${esc(n)}" data-ico="${i}">${i} ${esc(n)}</button>`).join('')}</div>
     <label class="lbl">Name</label>
     <input class="inp" id="hName" maxlength="40" placeholder="${bad ? 'z.B. Doomscrolling' : 'z.B. 10 Min lesen'}">
     <label class="lbl">Symbol</label>
     ${emojiPicker(icon)}
     ${
       bad
         ? `<label class="lbl">Seit wann bist du clean?</label>
     <div class="row gap"><input class="inp" id="hDays" type="number" min="0" max="3650" value="0" inputmode="numeric"><span class="muted nowrap">Tage</span></div>
     <p class="small muted">Alte Tage zählen für die Serie, geben aber keine XP. Ehrlich bleiben.</p>`
         : ''
     }
     <button class="btn primary full mt" id="hSave">Speichern</button>`,
    {
      onMount: (b) => {
        bindEmoji(b, (e) => (icon = e));
        b.querySelectorAll('[data-pre]').forEach((c) =>
          c.addEventListener('click', () => {
            b.querySelector('#hName').value = c.dataset.pre;
            icon = c.dataset.ico;
            b.querySelectorAll('.emo').forEach((x) => x.classList.toggle('on', x.dataset.emo === icon));
          })
        );
        b.querySelector('#hSave').onclick = () => {
          const name = b.querySelector('#hName').value.trim();
          if (!name) return toast('Gib einen Namen ein.');
          if (bad) {
            const days = Math.max(0, Math.min(3650, Number(b.querySelector('#hDays').value) || 0));
            addBad(name, icon, Date.now() - days * 86400000);
          } else addHabit(name, icon);
          closeSheet();
          toast(bad ? 'Eingetragen. Ab jetzt zählt jede Minute.' : 'Gewohnheit angelegt.');
          app.rerender();
        };
      },
    }
  );
}

function openHabit(app, id) {
  const h = S().habits.find((x) => x.id === id);
  if (!h) return;
  sheet(
    `<div class="row gap"><span class="check-ico lg">${h.icon}</span><h3 class="sheet-title m0">${esc(h.name)}</h3></div>
     <div class="stats3 mt">
       <div><b>${habitStreak(id)}</b><span>Serie</span></div>
       <div><b>${habitBest(id)}</b><span>Rekord</span></div>
       <div><b>${habitTotal(id)}</b><span>Gesamt</span></div>
     </div>
     ${heatmap((dk) => (dk < todayKey(new Date(h.createdAt)) ? null : isDone(id, dk) ? 4 : 0), { weeks: 17 })}
     <p class="small muted">Gestern vergessen abzuhaken? Tipp unten.</p>
     <button class="btn ghost full" id="hYest">Gestern nachtragen / entfernen</button>
     <label class="lbl">Umbenennen</label>
     <input class="inp" id="hRen" value="${esc(h.name)}" maxlength="40">
     <div class="row gap mt">
       <button class="btn danger grow" id="hDel">Löschen</button>
       <button class="btn primary grow" id="hSv">Speichern</button>
     </div>`,
    {
      tall: true,
      onMount: (b) => {
        b.querySelector('#hYest').onclick = () => {
          const y = new Date();
          y.setDate(y.getDate() - 1);
          const on = toggleHabit(id, todayKey(y));
          toast(on ? 'Für gestern abgehakt.' : 'Für gestern entfernt.');
          closeSheet();
          app.rerender();
        };
        b.querySelector('#hSv').onclick = () => {
          const v = b.querySelector('#hRen').value.trim();
          if (v) h.name = v;
          save();
          closeSheet();
          app.rerender();
        };
        b.querySelector('#hDel').onclick = async () => {
          closeSheet();
          if (await confirmBox('Gewohnheit löschen?', `„${esc(h.name)}“ und alle Häkchen werden gelöscht. Deine XP bleiben.`, 'Löschen', true)) {
            deleteHabit(id);
            app.rerender();
          }
        };
      },
    }
  );
}

export function openBad(app, id) {
  const b = S().bad.find((x) => x.id === id);
  if (!b) return;
  const pen = relapsePenalty(b);
  const rel = [...b.relapses].reverse().slice(0, 8);
  sheet(
    `<div class="row gap"><span class="bad-ico lg">${b.icon}</span><h3 class="sheet-title m0">${esc(b.name)}</h3></div>
     <div class="bad-time huge" data-since="${lastReset(b)}">${fmtSince(cleanMs(b))}</div>
     <div class="stats3">
       <div><b>${cleanDays(b)}</b><span>Tage clean</span></div>
       <div><b>${Math.floor(bestClean(b) / 86400000)}</b><span>Rekord (Tage)</span></div>
       <div><b>${b.relapses.length}</b><span>Rückfälle</span></div>
     </div>
     <button class="btn urge full mt" data-act="urge">🚨 Ich hab gerade Drang</button>
     <button class="btn danger full mt" id="bRel">Rückfall eintragen (−${pen} XP)</button>
     ${
       rel.length
         ? `<h4 class="h3 mt2">Letzte Rückfälle</h4><div class="rel-list">${rel
             .map((r) => `<div class="rel"><span>${fmtDate(todayKey(new Date(r.t)))} · ${fmtTime(r.t)}</span>${r.note ? `<span class="muted small">${esc(r.note)}</span>` : ''}</div>`)
             .join('')}</div>`
         : ''
     }
     <button class="btn ghost full mt2" id="bDel">Angewohnheit löschen</button>`,
    {
      tall: true,
      onMount: (body) => {
        body.querySelector('#bRel').onclick = () => {
          closeSheet();
          openRelapse(app, id);
        };
        body.querySelector('#bDel').onclick = async () => {
          closeSheet();
          if (await confirmBox('Wirklich löschen?', `„${esc(b.name)}“ wird mit allen Daten gelöscht.`, 'Löschen', true)) {
            deleteBad(id);
            app.rerender();
          }
        };
      },
    }
  );
}

const TRIGGERS = ['Langeweile', 'Allein im Zimmer', 'Spät nachts', 'Stress', 'Handy im Bett', 'Social Media', 'Traurig', 'Müde', 'Hunger'];

function openRelapse(app, id) {
  const b = S().bad.find((x) => x.id === id);
  const pen = relapsePenalty(b);
  const chosen = new Set();
  sheet(
    `<h3 class="sheet-title">Rückfall: ${esc(b.name)}</h3>
     <p class="muted">Ehrlich sein ist der erste Schritt. Deine Serie von <b>${fmtSince(cleanMs(b))}</b> startet neu und du verlierst <b class="bad-t">${pen} XP</b>.</p>
     <label class="lbl">Was war der Auslöser?</label>
     <div class="chips">${TRIGGERS.map((t) => `<button class="chip" data-tr="${t}">${t}</button>`).join('')}</div>
     <input class="inp" id="rNote" placeholder="Eigene Notiz (optional)" maxlength="120">
     <div class="row gap mt">
       <button class="btn ghost grow" data-close>Abbrechen</button>
       <button class="btn danger grow" id="rOk">Eintragen</button>
     </div>`,
    {
      onMount: (body) => {
        body.querySelectorAll('[data-tr]').forEach((c) =>
          c.addEventListener('click', () => {
            c.classList.toggle('on');
            c.classList.contains('on') ? chosen.add(c.dataset.tr) : chosen.delete(c.dataset.tr);
          })
        );
        body.querySelector('#rOk').onclick = () => {
          const note = [...chosen, body.querySelector('#rNote').value.trim()].filter(Boolean).join(', ');
          relapse(id, note);
          closeSheet();
          toast('Eingetragen. Aufstehen. Neue Serie startet jetzt.', 'bad');
          app.rerender();
        };
      },
    }
  );
}

export const actions = {
  'habit-toggle': (el, app) => {
    const on = toggleHabit(el.dataset.id);
    if (navigator.vibrate) navigator.vibrate(on ? 15 : 5);
    app.rerender();
  },
  'habit-add': (el, app) => openAddHabit(app, false),
  'bad-add': (el, app) => openAddHabit(app, true),
  'habit-open': (el, app) => openHabit(app, el.dataset.id),
  'bad-open': (el, app) => openBad(app, el.dataset.id),
};
