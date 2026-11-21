// XP und Ränge: Bronze I–III … Diamant I–III, Unreal
import { S, save, todayKey } from './store.js';

export const TIERS = [
  { name: 'Bronze', color: '#d08a4c', glow: '#8a4a1c', subs: 3 },
  { name: 'Silber', color: '#cfd6e0', glow: '#6b7787', subs: 3 },
  { name: 'Gold', color: '#f7c948', glow: '#a3740a', subs: 3 },
  { name: 'Platin', color: '#56e3cf', glow: '#13806f', subs: 3 },
  { name: 'Diamant', color: '#86c8ff', glow: '#2a62c9', subs: 3 },
  { name: 'Unreal', color: '#ff5fd2', glow: '#7b3cff', subs: 1 },
];

const THRESHOLDS = [0, 150, 350, 600, 900, 1300, 1800, 2400, 3100, 3900, 4800, 5900, 7200, 8800, 10800, 14000];
const ROMAN = ['I', 'II', 'III'];

export const RANKS = (() => {
  const out = [];
  let i = 0;
  TIERS.forEach((t, ti) => {
    for (let s = 0; s < t.subs; s++) {
      out.push({
        i,
        tier: ti,
        tierName: t.name,
        sub: t.subs > 1 ? ROMAN[s] : '',
        full: t.subs > 1 ? `${t.name} ${ROMAN[s]}` : t.name,
        color: t.color,
        glow: t.glow,
        min: THRESHOLDS[i],
      });
      i++;
    }
  });
  return out;
})();

export function rankFor(xp) {
  let r = RANKS[0];
  for (const rk of RANKS) if (xp >= rk.min) r = rk;
  const next = RANKS[r.i + 1] || null;
  const progress = next ? (xp - r.min) / (next.min - r.min) : 1;
  return { ...r, next, progress: Math.max(0, Math.min(1, progress)), toNext: next ? next.min - xp : 0 };
}

const listeners = [];
export function onXP(cb) {
  listeners.push(cb);
}

export function addXP(amt, reason) {
  const s = S();
  const before = rankFor(s.xp);
  s.xp = Math.max(0, Math.round(s.xp + amt));
  s.xpLog.unshift({ t: Date.now(), amt: Math.round(amt), reason });
  if (s.xpLog.length > 300) s.xpLog.length = 300;
  const after = rankFor(s.xp);
  save();
  listeners.forEach((cb) => cb({ amt, reason, before, after }));
}

// Einmal pro Tag und Schlüssel XP geben (z.B. Gewohnheit abgehakt)
export function award(dateKey, key, amt, reason) {
  const s = S();
  s.awarded[dateKey] = s.awarded[dateKey] || {};
  if (s.awarded[dateKey][key] !== undefined) return false;
  s.awarded[dateKey][key] = amt;
  addXP(amt, reason);
  return true;
}

export function revoke(dateKey, key, reason) {
  const s = S();
  const a = s.awarded[dateKey];
  if (!a || a[key] === undefined) return false;
  const amt = a[key];
  delete a[key];
  addXP(-amt, reason || 'Zurückgenommen');
  return true;
}

export function hasAward(dateKey, key) {
  const a = S().awarded[dateKey];
  return !!(a && a[key] !== undefined);
}

export function xpOnDay(dateKey) {
  const a = S().awarded[dateKey];
  if (!a) return 0;
  return Object.values(a).reduce((x, y) => x + y, 0);
}

export function xpToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return S()
    .xpLog.filter((l) => l.t >= start.getTime())
    .reduce((x, l) => x + l.amt, 0);
}

export const todayXP = () => xpToday();
export const TODAY = () => todayKey();
