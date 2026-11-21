// Login und Online-Speicher über Firebase, ohne zusätzliche Bibliothek
import { FIREBASE } from './config.js';

const SESSION = 'vow.session';
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';
const STORE = 'https://firestore.googleapis.com/v1';
const key = () => encodeURIComponent(FIREBASE.apiKey);

let session = null;
let refreshing = null;

export const configured = () => !!(FIREBASE.apiKey && FIREBASE.projectId);

export function loadSession() {
  try {
    session = JSON.parse(localStorage.getItem(SESSION) || 'null');
  } catch (e) {
    session = null;
  }
  return session;
}

function keepSession() {
  try {
    localStorage.setItem(SESSION, JSON.stringify(session));
  } catch (e) {}
}

export function clearSession() {
  session = null;
  try {
    localStorage.removeItem(SESSION);
  } catch (e) {}
}

async function postAuth(path, body) {
  let res;
  try {
    res = await fetch(`${AUTH}:${path}?key=${key()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error('NETWORK');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data.error && data.error.message) || 'ERROR');
  return data;
}

export async function signIn(email, password) {
  const data = await postAuth('signInWithPassword', { email, password, returnSecureToken: true });
  session = {
    uid: data.localId,
    email: data.email,
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    expiresAt: Date.now() + Number(data.expiresIn) * 1000,
  };
  keepSession();
  return session;
}

export function resetPassword(email) {
  return postAuth('sendOobCode', { requestType: 'PASSWORD_RESET', email });
}

async function renew() {
  let res;
  try {
    res = await fetch(`${TOKEN}?key=${key()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: session.refreshToken }),
    });
  } catch (e) {
    throw { code: 'unavailable' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 400) {
      // Anmeldung abgelaufen. Die Einträge bleiben auf dem Gerät und werden nach dem Login übertragen.
      clearSession();
      location.reload();
    }
    throw { code: res.status === 400 ? 'not_granted' : 'unavailable' };
  }
  session.idToken = data.id_token;
  session.refreshToken = data.refresh_token;
  session.expiresAt = Date.now() + Number(data.expires_in) * 1000;
  keepSession();
  return session.idToken;
}

function idToken(force = false) {
  if (!session) return Promise.reject({ code: 'not_granted' });
  if (!force && session.expiresAt - Date.now() > 60000) return Promise.resolve(session.idToken);
  refreshing = refreshing || renew().finally(() => { refreshing = null; });
  return refreshing;
}

async function api(url, options = {}, retried = false) {
  const token = await idToken();
  let res;
  try {
    res = await fetch(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
  } catch (e) {
    throw { code: 'unavailable' };
  }
  if (res.status === 401 && !retried) {
    await idToken(true);
    return api(url, options, true);
  }
  if (res.ok) return res.json().catch(() => ({}));
  if (res.status === 429) throw { code: 'quota_exceeded' };
  if (res.status === 400) throw { code: 'invalid_argument' };
  if (res.status === 401 || res.status === 403) throw { code: 'not_granted' };
  throw { code: 'unavailable' };
}

// Die Einträge des angemeldeten Kontos: get(), doc(id).set(), doc(id).delete()
export function collection() {
  const base = `${STORE}/projects/${encodeURIComponent(FIREBASE.projectId)}/databases/(default)/documents/users/${encodeURIComponent(session.uid)}/vow`;
  return {
    async get() {
      const docs = [];
      let pageToken = '';
      do {
        const url = `${base}?pageSize=300${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
        const page = await api(url);
        for (const d of page.documents || []) {
          const raw = d.fields && d.fields.json && d.fields.json.stringValue;
          if (!raw) continue;
          const body = JSON.parse(raw);
          docs.push({ id: d.name.split('/').pop(), data: () => body });
        }
        pageToken = page.nextPageToken || '';
      } while (pageToken);
      return { docs, metadata: { fromCache: false } };
    },
    doc(id) {
      const url = `${base}/${encodeURIComponent(id)}`;
      return {
        set: (body) => api(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: { json: { stringValue: JSON.stringify(body) } } }),
        }),
        delete: () => api(url, { method: 'DELETE' }),
      };
    },
  };
}
