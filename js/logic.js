// Die Regeln der App: wer bekommt wann wie viel XP
import { S, save, todayKey, addDays, daysBetween, keyToDate, uid } from './store.js';
import { award, revoke, addXP, hasAward } from './xp.js';

export const XP = {
  login: 5,
  habit: 10,
  allHabits: 25,
  journal: 15,
  breath: 10,
  affirm: 5,
  sleepLog: 10,
  sleepGoal: 15,
  workoutBase: 15,
  foodGoal: 20,
  cleanDay: 8,
};
const MILESTONES = [
  [1, 10],
  [3, 30],
  [7, 75],
  [14, 125],
  [30, 250],
  [60, 400],
  [90, 600],
  [180, 1000],
  [365, 2000],
];

// ---------- Gute Gewohnheiten ----------
export const activeHabits = () => S().habits.filter((h) => !h.archived);

export function isDone(id, k = todayKey()) {
  return (S().checks[k] || []).includes(id);
}

export function toggleHabit(id, k = todayKey()) {
  const s = S();
  const h = s.habits.find((x) => x.id === id);
  if (!h) return;
  const list = (s.checks[k] = s.checks[k] || []);
  const i = list.indexOf(id);
  if (i >= 0) {
    list.splice(i, 1);
    revoke(k, 'h:' + id, `${h.name} zurückgenommen`);
    revoke(k, 'allHabits', 'Alle Gewohnheiten – zurückgenommen');
  } else {
    list.push(id);
    award(k, 'h:' + id, XP.habit, `${h.icon} ${h.name}`);
    const all = activeHabits();
    if (all.length >= 2 && all.every((x) => list.includes(x.id))) award(k, 'allHabits', XP.allHabits, 'Alle Gewohnheiten erledigt');
  }
  save();
  return i < 0;
}

export function habitStreak(id) {
  let k = todayKey();
  // Wenn heute noch nicht erledigt, zählt die Serie bis gestern (noch nicht gebrochen)
  if (!isDone(id, k)) k = addDays(k, -1);
  let n = 0;
  while (isDone(id, k)) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

export function habitBest(id) {
  const s = S();
  const days = Object.keys(s.checks)
    .filter((k) => s.checks[k].includes(id))
    .sort();
  let best = 0,
    cur = 0,
    prev = null;
  for (const k of days) {
    cur = prev && daysBetween(prev, k) === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
    prev = k;
  }
  return best;
}

export function habitTotal(id) {
  const s = S();
  return Object.values(s.checks).filter((l) => l.includes(id)).length;
}

export function addHabit(name, icon) {
  const h = { id: uid(), name, icon, createdAt: Date.now(), archived: false };
  S().habits.push(h);
  save();
  return h;
}

export function deleteHabit(id) {
  const s = S();
  s.habits = s.habits.filter((h) => h.id !== id);
  for (const k of Object.keys(s.checks)) s.checks[k] = s.checks[k].filter((x) => x !== id);
  save();
}

// ---------- Schlechte Angewohnheiten ----------
export function lastReset(b) {
  const r = b.relapses.length ? b.relapses[b.relapses.length - 1].t : 0;
  return Math.max(b.startedAt, r);
}
export const cleanMs = (b) => Date.now() - lastReset(b);
export const cleanDays = (b) => Math.floor(cleanMs(b) / 86400000);

export function bestClean(b) {
  let best = b.best || 0;
  return Math.max(best, cleanMs(b));
}

export function addBad(name, icon, startedAt = Date.now()) {
  // Tage, die schon vor dem Eintragen clean waren, zählen für die Serie, geben aber keine XP (kein Cheaten)
  const pre = Math.max(0, Math.floor((Date.now() - startedAt) / 86400000));
  const b = { id: uid(), name, icon, startedAt, relapses: [], creditedDays: pre, milestones: MILESTONES.filter(([d]) => d <= pre).map(([d]) => d), best: 0 };
  S().bad.push(b);
  save();
  return b;
}

export function deleteBad(id) {
  S().bad = S().bad.filter((b) => b.id !== id);
  save();
}

export function relapsePenalty(b) {
  return 50 + Math.min(cleanDays(b) * 5, 250);
}

export function relapse(id, note = '') {
  const b = S().bad.find((x) => x.id === id);
  if (!b) return 0;
  const pen = relapsePenalty(b);
  b.best = Math.max(b.best || 0, cleanMs(b));
  b.relapses.push({ t: Date.now(), note });
  b.creditedDays = 0;
  b.milestones = [];
  addXP(-pen, `Rückfall: ${b.name}`);
  save();
  return pen;
}

// Für jeden vollen Tag ohne Rückfall gibt's XP, plus Meilensteine
export function creditClean() {
  const s = S();
  let gained = 0;
  for (const b of s.bad) {
    const d = cleanDays(b);
    b.creditedDays = b.creditedDays || 0;
    b.milestones = b.milestones || [];
    if (d > b.creditedDays) {
      const n = d - b.creditedDays;
      const amt = n * XP.cleanDay;
      addXP(amt, `${b.icon} ${n} ${n === 1 ? 'Tag' : 'Tage'} clean: ${b.name}`);
      gained += amt;
      b.creditedDays = d;
    }
    for (const [days, bonus] of MILESTONES) {
      if (d >= days && !b.milestones.includes(days)) {
        b.milestones.push(days);
        addXP(bonus, `🏆 Meilenstein ${days} ${days === 1 ? 'Tag' : 'Tage'}: ${b.name}`);
        gained += bonus;
      }
    }
  }
  save();
  return gained;
}

export function relapseDays(b) {
  return new Set(b.relapses.map((r) => todayKey(new Date(r.t))));
}

// ---------- Essen ----------
export function foodList(k = todayKey()) {
  return S().food[k] || [];
}
export function foodTotals(k = todayKey()) {
  return foodList(k).reduce((a, f) => ({ kcal: a.kcal + f.kcal, p: a.p + f.p, junk: a.junk + (f.junk ? 1 : 0) }), { kcal: 0, p: 0, junk: 0 });
}
export function addFood(entry, k = todayKey()) {
  const s = S();
  (s.food[k] = s.food[k] || []).push({ id: uid(), t: Date.now(), ...entry });
  save();
}
export function removeFood(id, k = todayKey()) {
  const s = S();
  s.food[k] = (s.food[k] || []).filter((f) => f.id !== id);
  save();
}
// Vergangene Tage auswerten: Kalorienziel getroffen?
export function evaluateFoodDays() {
  const s = S();
  const goal = s.profile.kcalGoal;
  const today = todayKey();
  for (let i = 1; i <= 14; i++) {
    const k = addDays(today, -i);
    if (!s.food[k] || !s.food[k].length || hasAward(k, 'foodGoal')) continue;
    const t = foodTotals(k);
    if (t.kcal >= goal * 0.7 && t.kcal <= goal * 1.08) award(k, 'foodGoal', XP.foodGoal, `🍽️ Kalorienziel getroffen (${k.slice(5).split('-').reverse().join('.')})`);
  }
}

// ---------- Schlaf ----------
export function sleepHours(bed, wake) {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let mins = wh * 60 + wm - (bh * 60 + bm);
  if (mins <= 0) mins += 1440;
  return Math.round((mins / 60) * 10) / 10;
}
export function logSleep(k, bed, wake, q) {
  const s = S();
  const hours = sleepHours(bed, wake);
  s.sleep[k] = { bed, wake, q, hours };
  award(k, 'sleepLog', XP.sleepLog, '😴 Schlaf eingetragen');
  if (hours >= s.profile.sleepGoal - 0.25) award(k, 'sleepGoal', XP.sleepGoal, `🌙 Schlafziel geschafft (${hours} h)`);
  else revoke(k, 'sleepGoal', 'Schlafziel doch nicht geschafft');
  save();
  return hours;
}

// ---------- Sport ----------
export function addWorkout(w, k = todayKey()) {
  const s = S();
  const entry = { id: uid(), t: Date.now(), ...w };
  (s.workouts[k] = s.workouts[k] || []).push(entry);
  const amt = XP.workoutBase + Math.min(Math.round(w.min / 3), 30) + (w.int === 3 ? 10 : 0);
  award(k, 'w:' + entry.id, amt, `🏋️ ${w.type} (${w.min} Min)`);
  save();
  return amt;
}
export function removeWorkout(id, k = todayKey()) {
  const s = S();
  s.workouts[k] = (s.workouts[k] || []).filter((w) => w.id !== id);
  revoke(k, 'w:' + id, 'Training gelöscht');
  save();
}
export function workoutMin(k) {
  return (S().workouts[k] || []).reduce((a, w) => a + Number(w.min || 0), 0);
}
export function workoutStreak() {
  let k = todayKey();
  if (!workoutMin(k)) k = addDays(k, -1);
  let n = 0;
  while (workoutMin(k) > 0) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

// ---------- Geist ----------
export function saveJournal(k, entry) {
  const s = S();
  s.journal[k] = { ...(s.journal[k] || {}), ...entry, t: Date.now() };
  const long = (entry.text || '').trim().length >= 20 || (entry.grat || []).filter((g) => g.trim()).length >= 2;
  if (long) award(k, 'journal', XP.journal, '📓 Tagebuch geschrieben');
  save();
  return long;
}

// Speichert beim Tippen automatisch, XP gibt es erst beim Knopf „Speichern“
export function saveJournalDraft(k, entry) {
  const s = S();
  const hasContent = (entry.text || '').trim() || (entry.grat || []).some((g) => g.trim());
  if (!hasContent) {
    if (!s.journal[k]) return false;
    delete s.journal[k];
    save();
    return false;
  }
  s.journal[k] = { ...(s.journal[k] || {}), ...entry, t: Date.now() };
  save();
  return true;
}

export function breathDone(k = todayKey()) {
  const s = S();
  s.breath[k] = (s.breath[k] || 0) + 1;
  const n = s.breath[k];
  if (n <= 3) award(k, 'breath' + n, XP.breath, '🌬️ Atemübung');
  save();
  return n <= 3 ? XP.breath : 0;
}

export function affirm(k = todayKey()) {
  const s = S();
  s.affirmedOn[k] = true;
  award(k, 'affirm', XP.affirm, '✨ Affirmationen bestätigt');
  save();
}

// ---------- Tagesstart ----------
export function dailyStart() {
  const s = S();
  const k = todayKey();
  if (s.lastOpen !== k) {
    s.lastOpen = k;
    award(k, 'login', XP.login, '☀️ Tag gestartet');
  }
  evaluateFoodDays();
  creditClean();
  save();
}

// ---------- Tagesbewertung 0–4 für die Gesamt-Heatmap ----------
export function dayScore(k) {
  const s = S();
  if (k < todayKey(new Date(s.profile.createdAt))) return null;
  const hs = activeHabits();
  const done = (s.checks[k] || []).length;
  let pts = hs.length ? (done / hs.length) * 4 : 0;
  if (s.journal[k]) pts += 1;
  if (workoutMin(k)) pts += 1.5;
  if (s.sleep[k]) pts += 0.5;
  if (s.breath[k]) pts += 0.5;
  const relapsed = s.bad.some((b) => relapseDays(b).has(k));
  if (relapsed) return 'bad';
  if (pts <= 0) return 0;
  if (pts < 2) return 1;
  if (pts < 4) return 2;
  if (pts < 6) return 3;
  return 4;
}

export function activeDays() {
  const s = S();
  return Object.keys(s.awarded).filter((k) => Object.keys(s.awarded[k]).length > 0).length;
}

export function hoursLeftToday() {
  const n = new Date();
  return 24 - n.getHours() - n.getMinutes() / 60;
}

export { keyToDate };
