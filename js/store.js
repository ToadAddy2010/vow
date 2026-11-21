// Speicher: hält den aktuellen Stand, cloud.js sichert ihn im Konto.

export const pad = (n) => String(n).padStart(2, '0');

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return todayKey(d);
}
export function daysBetween(a, b) {
  // ganze Kalendertage von a nach b
  return Math.round((keyToDate(b) - keyToDate(a)) / 86400000);
}
export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

export function defaultState() {
  return {
    version: 1,
    onboarded: false,
    profile: {
      name: '',
      createdAt: Date.now(),
      kcalGoal: 2400,
      proteinGoal: 120,
      sleepGoal: 8,
    },
    xp: 0,
    xpLog: [], // {t, amt, reason}
    awarded: {}, // dateKey -> { key: amt }
    habits: [], // {id, name, icon, createdAt, archived}
    checks: {}, // dateKey -> [habitId]
    bad: [], // {id, name, icon, startedAt, relapses:[{t, note}], creditedUntil, best}
    sleep: {}, // dateKey (Aufwach-Tag) -> {bed, wake, q, hours}
    food: {}, // dateKey -> [{id, name, kcal, p, meal, junk, t}]
    customFoods: [], // [name, kcal, protein, portion, junk]
    workouts: {}, // dateKey -> [{id, type, min, int, note, t}]
    journal: {}, // dateKey -> {mood, text, prompt, grat:[..], t}
    breath: {}, // dateKey -> Anzahl
    affirmations: [], // eigene
    affirmedOn: {}, // dateKey -> true
    chat: [], // {from:'coach'|'me', text, t}
    quoteShift: 0,
    commitment: null, // {days (null = für immer), startKey}
    lastOpen: null,
  };
}

let state = null;

function migrate(s) {
  const d = defaultState();
  // fehlende Felder ergänzen, falls später neue dazukommen
  for (const k of Object.keys(d)) if (s[k] === undefined) s[k] = d[k];
  for (const k of Object.keys(d.profile)) if (s.profile[k] === undefined) s.profile[k] = d.profile[k];
  return s;
}

export function load() {
  try {
    state = window.__vowInitial ? migrate(window.__vowInitial) : defaultState();
  } catch (e) {
    state = defaultState();
  }
  return state;
}

export function save() {
  try {
    window.__vowCloud?.changed(state);
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
  }
}

export const S = () => state;

export function replaceState(newState) {
  state = migrate(newState);
  save();
}

export function resetAll() {
  state = defaultState();
  save();
}

export function applyRemote(newState) {
  state = migrate(newState);
}

export function exportJSON() {
  return JSON.stringify(state, null, 2);
}

// Safari löscht sonst manchmal Daten von Webseiten, die man länger nicht öffnet
export async function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (e) {}
}
