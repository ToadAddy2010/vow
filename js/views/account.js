// Konto-Seite: Name, Passwort und Abmelden
import { S, save } from '../store.js';
import { esc, sheet, closeSheet, toast } from '../ui.js';

const firstLetter = (text) => ([...String(text || '?').trim()][0] || '?').toUpperCase();

export function render(app) {
  const s = S();
  const email = window.__vowAccount?.email || '';
  const name = s.profile.name || 'Kein Name';
  const back = app.ui.accountFrom || 'today';
  return `
  <header class="top"><button class="back" data-act="go" data-v="${esc(back)}:">‹ Zurück</button></header>

  <section class="account-head">
    <div class="account-avatar" aria-hidden="true">${esc(firstLetter(s.profile.name || email))}</div>
    <div class="grow">
      <h1 class="account-name">${esc(name)}</h1>
      <div class="small muted account-mail">${esc(email)}</div>
    </div>
  </section>

  <h2 class="h2">Konto</h2>
  <section class="card list">
    <button class="account-row" data-act="account-name"><span>Name ändern</span><span class="account-val">${esc(name)} ›</span></button>
    <button class="account-row" data-act="account-password"><span>Passwort ändern</span><span class="account-val">›</span></button>
    <button class="account-row" data-act="go" data-v="profile:"><span>Rang, Statistik und Ziele</span><span class="account-val">›</span></button>
  </section>

  <button class="btn ghost full mt2" data-act="logout">Abmelden</button>
  <p class="center small muted mt">Deine Einträge bleiben nach dem Abmelden in deinem Konto.</p>`;
}

function openName(app) {
  sheet(
    `<h3 class="sheet-title">Name ändern</h3>
     <label class="lbl" for="accName">Dein Name</label>
     <input class="inp" id="accName" maxlength="24" autocomplete="given-name" value="${esc(S().profile.name)}">
     <button class="btn primary full mt" id="accNameSave">Speichern</button>`,
    {
      onMount: (b) => {
        b.querySelector('#accNameSave').onclick = () => {
          const value = b.querySelector('#accName').value.trim();
          if (!value) return toast('Gib einen Namen ein.', 'bad');
          S().profile.name = value;
          save();
          closeSheet();
          toast('Name gespeichert.');
          app.rerender();
          return undefined;
        };
      },
    }
  );
}

function openPassword() {
  const email = window.__vowAccount?.email || '';
  sheet(
    `<h3 class="sheet-title">Passwort ändern</h3>
     <input type="text" autocomplete="username" value="${esc(email)}" hidden readonly>
     <label class="lbl" for="pwOld">Aktuelles Passwort</label>
     <input class="inp" id="pwOld" type="password" autocomplete="current-password">
     <label class="lbl" for="pwNew">Neues Passwort (mindestens 8 Zeichen)</label>
     <input class="inp" id="pwNew" type="password" autocomplete="new-password" minlength="8">
     <label class="lbl" for="pwRepeat">Neues Passwort wiederholen</label>
     <input class="inp" id="pwRepeat" type="password" autocomplete="new-password" minlength="8">
     <p class="small bad-t" id="pwMsg" role="alert" hidden></p>
     <button class="btn primary full mt" id="pwSave">Passwort ändern</button>`,
    {
      onMount: (b) => {
        const go = b.querySelector('#pwSave');
        const msg = b.querySelector('#pwMsg');
        const say = (text) => {
          msg.textContent = text;
          msg.hidden = !text;
        };
        go.onclick = async () => {
          const current = b.querySelector('#pwOld').value;
          const next = b.querySelector('#pwNew').value;
          if (!current || !next) return say('Füll bitte alle Felder aus.');
          if (next.length < 8) return say('Das neue Passwort braucht mindestens 8 Zeichen.');
          if (next !== b.querySelector('#pwRepeat').value) return say('Die neuen Passwörter sind nicht gleich.');
          go.disabled = true;
          go.textContent = 'Wird geändert…';
          say('');
          const error = await window.__vowAccount.changePassword(current, next);
          if (error) {
            say(error);
            go.disabled = false;
            go.textContent = 'Passwort ändern';
            return undefined;
          }
          closeSheet();
          toast('Passwort geändert. Auf anderen Geräten meldest du dich neu an.');
          return undefined;
        };
      },
    }
  );
}

export const actions = {
  'account-name': (el, app) => openName(app),
  'account-password': () => openPassword(),
};
