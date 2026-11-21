// Startet Vow: erst anmelden, dann eigene Daten laden
import { configured, loadSession, signIn, resetPassword, collection, clearSession } from './firebase.js';
import { initCloud } from './cloud.js';

const ERRORS = {
  INVALID_LOGIN_CREDENTIALS: 'E-Mail oder Passwort stimmt nicht.',
  EMAIL_NOT_FOUND: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_PASSWORD: 'E-Mail oder Passwort stimmt nicht.',
  INVALID_EMAIL: 'Das ist keine gültige E-Mail-Adresse.',
  USER_DISABLED: 'Dieses Konto ist gesperrt.',
  NETWORK: 'Keine Verbindung. Prüf dein Internet.',
};

function errorText(e) {
  const code = String((e && e.message) || '');
  if (code.startsWith('TOO_MANY_ATTEMPTS')) return 'Zu viele Versuche. Warte ein paar Minuten.';
  return ERRORS[code] || 'Das hat nicht geklappt. Versuch es gleich nochmal.';
}

async function start(session) {
  const view = document.getElementById('view');
  view.innerHTML = '<div class="login-load"><div class="ob-title">VOW</div><p class="muted">Deine Einträge werden geladen…</p></div>';
  if (session) {
    const storageKey = `vow.account.${session.uid}`;
    window.__vowAccount = {
      email: session.email,
      async logout() {
        await window.__vowCloud?.flush();
        if (window.__vowCloud?.isDirty()) return false;
        try {
          localStorage.removeItem(storageKey);
        } catch (e) {}
        clearSession();
        location.reload();
        return true;
      },
    };
    await initCloud(collection(), storageKey);
  } else {
    await initCloud(null);
  }
  await import('./app.js');
}

function showLogin() {
  const view = document.getElementById('view');
  view.className = 'view v-login';
  view.innerHTML = `
    <form class="login" id="loginForm" novalidate>
      <div class="ob-title">VOW</div>
      <p class="login-sub">Melde dich an. Deine Einträge sind dann auf Handy und Laptop gleich.</p>
      <label class="lbl" for="loginMail">E-Mail</label>
      <input class="inp" id="loginMail" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <label class="lbl" for="loginPass">Passwort</label>
      <input class="inp" id="loginPass" type="password" autocomplete="current-password" required>
      <p class="login-msg" id="loginMsg" role="alert" hidden></p>
      <button class="btn primary full big" id="loginGo" type="submit">Anmelden</button>
      <button class="link login-forgot" id="loginForgot" type="button">Passwort vergessen?</button>
    </form>`;
  const form = view.querySelector('#loginForm');
  const mail = view.querySelector('#loginMail');
  const pass = view.querySelector('#loginPass');
  const msg = view.querySelector('#loginMsg');
  const go = view.querySelector('#loginGo');
  const say = (text, ok = false) => {
    msg.textContent = text;
    msg.hidden = !text;
    msg.classList.toggle('ok', ok);
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = mail.value.trim();
    if (!email || !pass.value) return say('Gib E-Mail und Passwort ein.');
    go.disabled = true;
    go.textContent = 'Anmelden…';
    say('');
    try {
      const session = await signIn(email, pass.value);
      pass.value = '';
      view.className = 'view';
      await start(session);
    } catch (err) {
      say(errorText(err));
      go.disabled = false;
      go.textContent = 'Anmelden';
    }
  });

  view.querySelector('#loginForgot').addEventListener('click', async () => {
    const email = mail.value.trim();
    if (!email) return say('Schreib zuerst deine E-Mail oben rein.');
    try {
      await resetPassword(email);
    } catch (err) {
      if (String(err.message) === 'NETWORK') return say(ERRORS.NETWORK);
    }
    say('Wenn es dieses Konto gibt, kommt gleich eine E-Mail zum Zurücksetzen.', true);
  });
}

if (!configured()) start(null);
else {
  const session = loadSession();
  if (session) start(session);
  else showLogin();
}
