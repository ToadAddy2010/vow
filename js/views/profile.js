import { S, save, exportJSON, replaceState, resetAll, todayKey } from '../store.js';
import { RANKS, rankFor } from '../xp.js';
import { esc, emblem, toast, confirmBox, fmtTime, fmtDate } from '../ui.js';
import { activeDays, activeHabits, habitBest, bestClean } from '../logic.js';

export function render() {
  const s = S();
  const r = rankFor(s.xp);
  const bestHabit = Math.max(0, ...activeHabits().map((h) => habitBest(h.id)));
  const bestBad = Math.max(0, ...s.bad.map((b) => Math.floor(bestClean(b) / 86400000)));
  const workouts = Object.values(s.workouts).reduce((a, l) => a + l.length, 0);
  const journals = Object.keys(s.journal).length;
  return `
  <header class="top"><button class="back" data-act="go" data-v="today:">‹ Zurück</button></header>

  <section class="profile-hero" style="--rc:${r.color}">
    <div class="hero-emb">${emblem(r, 150)}</div>
    <div class="rank-name xl">${esc(r.full)}</div>
    <div class="muted">${s.xp} XP${r.next ? ` · noch ${r.toNext} bis ${esc(r.next.full)}` : ''}</div>
    <div class="xpbar wide"><div style="width:${r.progress * 100}%"></div></div>
  </section>

  <div class="stats3 card">
    <div><b>${activeDays()}</b><span>aktive Tage</span></div>
    <div><b>🔥 ${bestHabit}</b><span>beste Serie</span></div>
    <div><b>${bestBad}</b><span>Tage clean Rekord</span></div>
  </div>
  <div class="stats3 card">
    <div><b>${workouts}</b><span>Trainings</span></div>
    <div><b>${journals}</b><span>Tagebuch</span></div>
    <div><b>${Object.values(s.breath).reduce((a, b) => a + b, 0)}</b><span>Atemübungen</span></div>
  </div>

  <h2 class="h2">Ränge</h2>
  <section class="card ladder">
    ${[...RANKS]
      .reverse()
      .map((rk) => {
        const got = s.xp >= rk.min;
        const cur = rk.i === r.i;
        return `<div class="ladder-row ${got ? 'got' : 'locked'} ${cur ? 'cur' : ''}" style="--rc:${rk.color}">
          ${emblem(rk, 38)}
          <span class="grow left"><b>${esc(rk.full)}</b>${cur ? ' <span class="pill sm">DU</span>' : ''}</span>
          <span class="small muted">${rk.min.toLocaleString('de-DE')} XP</span>
        </div>`;
      })
      .join('')}
  </section>

  <h2 class="h2">So bekommst du XP</h2>
  <section class="card list small xp-rules">
    <div><span>Tag gestartet</span><b>+5</b></div>
    <div><span>Gewohnheit abgehakt</span><b>+10</b></div>
    <div><span>Alle Gewohnheiten an einem Tag</span><b>+25</b></div>
    <div><span>Jeder Tag clean (pro Angewohnheit)</span><b>+8</b></div>
    <div><span>Clean-Meilensteine (1, 3, 7, 14, 30… Tage)</span><b>bis +2000</b></div>
    <div><span>Training</span><b>+15 bis +55</b></div>
    <div><span>Schlaf eingetragen / Ziel geschafft</span><b>+10 / +15</b></div>
    <div><span>Kalorienziel getroffen (am Tag danach)</span><b>+20</b></div>
    <div><span>Tagebuch</span><b>+15</b></div>
    <div><span>Atemübung (3× am Tag)</span><b>+10</b></div>
    <div><span>Affirmationen</span><b>+5</b></div>
    <div class="bad-t"><span>Rückfall</span><b>−50 bis −300</b></div>
  </section>

  <h2 class="h2">Letzte XP</h2>
  <section class="card list small">
    ${
      s.xpLog
        .slice(0, 25)
        .map(
          (l) => `<div class="xp-row"><span class="grow left">${esc(l.reason)}<span class="muted block">${fmtDate(todayKey(new Date(l.t)))} · ${fmtTime(l.t)}</span></span><b class="${l.amt < 0 ? 'bad-t' : 'good-t'}">${l.amt > 0 ? '+' : ''}${l.amt}</b></div>`
        )
        .join('') || '<div class="empty">Noch nichts.</div>'
    }
  </section>

  <h2 class="h2">Einstellungen</h2>
  <section class="card">
    <label class="lbl">Dein Name</label>
    <input class="inp" id="pName" maxlength="24" value="${esc(s.profile.name)}">
    <div class="row gap">
      <div class="grow"><label class="lbl">Kalorienziel</label><input class="inp" id="pK" type="number" inputmode="numeric" min="1500" max="6000" value="${s.profile.kcalGoal}"></div>
      <div class="grow"><label class="lbl">Eiweiß (g)</label><input class="inp" id="pP" type="number" inputmode="numeric" min="20" max="400" value="${s.profile.proteinGoal}"></div>
    </div>
    <label class="lbl">Schlafziel (Stunden)</label>
    <input class="inp" id="pS" type="number" inputmode="decimal" step="0.5" min="5" max="12" value="${s.profile.sleepGoal}">
    <button class="btn primary full mt" data-act="profile-save">Speichern</button>
  </section>

  ${window.__vowAccount ? `<h2 class="h2">Konto</h2>
  <section class="card">
    <p class="small muted">Angemeldet als <b>${esc(window.__vowAccount.email)}</b>. Deine Einträge sind auf allen deinen Geräten gleich.</p>
    <button class="btn ghost full" data-act="logout">Abmelden</button>
  </section>` : ''}

  <h2 class="h2">Backup</h2>
  <section class="card">
    <p class="small muted">Deine Einträge liegen in deinem Konto. Ein eigenes Backup schadet trotzdem nicht.</p>
    <button class="btn full" data-act="backup-export">⬇️ Backup speichern</button>
    <label class="btn ghost full mt file-btn">⬆️ Backup laden<input type="file" id="pImport" accept="application/json,.json" hidden></label>
  </section>

  <h2 class="h2">Hilfe</h2>
  <section class="card small help-card">
    <p>Wenn es dir nicht gut geht, ist das wichtiger als jede Serie. In Deutschland erreichst du kostenlos und anonym:</p>
    <p><a href="tel:08001110111">TelefonSeelsorge: 0800 111 0 111</a> (Tag und Nacht)</p>
    <p><a href="tel:116111">Nummer gegen Kummer: 116 111</a> (für Kinder und Jugendliche)</p>
    <p>In akuter Gefahr: <a href="tel:112">112</a>. Vow ersetzt keinen Arzt und keine Therapie.</p>
  </section>

  <h2 class="h2">Hinweise</h2>
  <section class="card small muted info">
    <p><b>iPhone:</b> In Safari auf „Teilen“, dann „Zum Home-Bildschirm“. Dann startet Vow wie eine echte App und funktioniert auch offline.</p>
    <p><b>Android:</b> In Chrome auf die drei Punkte, dann „App installieren“ oder „Zum Startbildschirm hinzufügen“.</p>
    <p><b>Erinnerungen:</b> Eine Website kann dich nicht zuverlässig zu festen Uhrzeiten erinnern. Stell dir dafür am besten einen Wecker.</p>
    <p><b>Andere Apps sperren:</b> Geht mit einer Website nicht. Nutz dafür „Bildschirmzeit“ auf dem iPhone oder „Digital Wellbeing“ auf Android.</p>
  </section>

  <button class="btn danger full mt2" data-act="reset-all">Alles löschen</button>
  <p class="center small muted mt">Vow · v1.1</p>
  `;
}

export function mount(root, app) {
  const inp = root.querySelector('#pImport');
  if (inp)
    inp.addEventListener('change', async () => {
      const f = inp.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || typeof data !== 'object' || !('xp' in data) || !data.profile) throw new Error('kein Backup');
        if (await confirmBox('Backup laden?', 'Deine jetzigen Daten werden durch das Backup ersetzt.', 'Laden', true)) {
          replaceState(data);
          toast('Backup geladen.');
          app.rerender();
        }
      } catch (e) {
        toast('Das ist keine gültige Vow-Backup-Datei.', 'bad');
      }
      inp.value = '';
    });
}

export const actions = {
  logout: async () => {
    if (!(await confirmBox('Abmelden?', 'Deine Einträge bleiben in deinem Konto.', 'Abmelden'))) return;
    const ok = await window.__vowAccount.logout();
    if (!ok) toast('Noch nicht alles gespeichert. Geh online und versuch es nochmal.', 'bad');
  },
  'profile-save': (el, app) => {
    const root = document.getElementById('view');
    const s = S();
    const clamp = (v, a, b, d) => (isFinite(v) && v >= a && v <= b ? v : d);
    s.profile.name = root.querySelector('#pName').value.trim();
    s.profile.kcalGoal = Math.round(clamp(Number(root.querySelector('#pK').value), 1500, 6000, s.profile.kcalGoal));
    s.profile.proteinGoal = Math.round(clamp(Number(root.querySelector('#pP').value), 20, 400, s.profile.proteinGoal));
    s.profile.sleepGoal = clamp(Number(root.querySelector('#pS').value), 5, 12, s.profile.sleepGoal);
    save();
    toast(Number(root.querySelector('#pK').value) < 1500 ? 'Gespeichert. Unter 1500 kcal lässt Vow nicht zu.' : 'Gespeichert.');
    app.rerender();
  },
  'backup-export': async () => {
    const data = exportJSON();
    const name = `vow-backup-${todayKey()}.json`;
    const file = new File([data], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Vow Backup' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  },
  'reset-all': async (el, app) => {
    if (!(await confirmBox('Alles löschen?', 'Alle XP, Serien, Einträge und Einstellungen werden gelöscht. Das kann man nicht rückgängig machen. Mach vorher ein Backup.', 'Weiter', true))) return;
    if (!(await confirmBox('Wirklich sicher?', 'Letzte Chance. Alles ist danach weg.', 'Alles löschen', true))) return;
    resetAll();
    app.go('today');
  },
};
