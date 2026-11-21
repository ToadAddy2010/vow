// Kleine Bausteine für die Oberfläche
import { todayKey, addDays, keyToDate } from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------- Toast ----------
let toastTimer;
export function toast(msg, kind = '') {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.className = 'toast show ' + kind;
  el.innerHTML = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast ' + kind), 2600);
}

export function xpFloat(amt) {
  if (!amt) return;
  const el = document.createElement('div');
  el.className = 'xp-float ' + (amt > 0 ? 'pos' : 'neg');
  el.textContent = (amt > 0 ? '+' : '') + amt + ' XP';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

// ---------- Sheet (Fenster von unten) ----------
let sheetClose = null;
export function sheet(html, { onMount, onClose, tall } = {}) {
  closeSheet();
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `<div class="sheet-bg" data-close></div>
    <div class="sheet ${tall ? 'tall' : ''}" role="dialog" aria-modal="true">
      <div class="sheet-grip" data-close></div>
      <div class="sheet-body">${html}</div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => wrap.classList.add('open'));
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeSheet();
  });
  sheetClose = () => {
    wrap.classList.remove('open');
    document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 250);
    onClose && onClose();
  };
  onMount && onMount(wrap.querySelector('.sheet-body'));
  return wrap.querySelector('.sheet-body');
}
export function closeSheet() {
  if (sheetClose) {
    const f = sheetClose;
    sheetClose = null;
    f();
  }
}

export function confirmBox(title, text, okLabel = 'Ja', danger = false) {
  return new Promise((resolve) => {
    let done = false;
    sheet(
      `<h3 class="sheet-title">${esc(title)}</h3>
       <p class="muted">${text}</p>
       <div class="row gap mt">
         <button class="btn ghost grow" data-no>Abbrechen</button>
         <button class="btn grow ${danger ? 'danger' : 'primary'}" data-yes>${esc(okLabel)}</button>
       </div>`,
      {
        onMount: (b) => {
          b.querySelector('[data-yes]').onclick = () => {
            done = true;
            resolve(true);
            closeSheet();
          };
          b.querySelector('[data-no]').onclick = () => closeSheet();
        },
        onClose: () => !done && resolve(false),
      }
    );
  });
}

// ---------- Rang-Emblem ----------
let gid = 0;
export function emblem(rank, size = 64) {
  const id = 'g' + gid++;
  const unreal = rank.tierName === 'Unreal';
  const stops = unreal
    ? `<stop offset="0" stop-color="#ff5fd2"/><stop offset=".5" stop-color="#8b5cff"/><stop offset="1" stop-color="#3bd5ff"/>`
    : `<stop offset="0" stop-color="${rank.color}"/><stop offset="1" stop-color="${rank.glow}"/>`;
  const label = unreal ? '∞' : rank.sub;
  return `<svg class="emblem ${unreal ? 'unreal' : ''}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="${esc(rank.full)}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient></defs>
    <polygon points="50,4 91,27 91,73 50,96 9,73 9,27" fill="url(#${id})"/>
    <polygon points="50,4 91,27 50,50 9,27" fill="#fff" opacity=".18"/>
    <polygon points="9,73 50,50 50,96" fill="#000" opacity=".18"/>
    <polygon points="50,18 79,34 79,66 50,82 21,66 21,34" fill="#0b0b10" opacity=".55"/>
    <text x="50" y="${unreal ? 62 : 59}" text-anchor="middle" font-size="${unreal ? 34 : 24}" font-weight="800" fill="url(#${id})" font-family="-apple-system,system-ui,sans-serif">${label}</text>
  </svg>`;
}

// ---------- Heatmap ----------
// levelOf(dateKey) -> 0..4, oder 'bad' für Rückfall-Tag, oder null (vor Start)
export function heatmap(levelOf, { weeks = 20, color = 'var(--accent)', small = false } = {}) {
  const today = todayKey();
  // Montag als Wochenstart
  const dow = (keyToDate(today).getDay() + 6) % 7;
  const end = addDays(today, 6 - dow);
  const start = addDays(end, -(weeks * 7 - 1));
  let cells = '';
  let months = '';
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const wk = addDays(start, w * 7);
    const m = keyToDate(wk).getMonth();
    if (m !== lastMonth) {
      months += `<span style="grid-column:${w + 1}">${['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'][m]}</span>`;
      lastMonth = m;
    }
    for (let d = 0; d < 7; d++) {
      const k = addDays(start, w * 7 + d);
      if (k > today) {
        cells += `<i class="hm-c future"></i>`;
        continue;
      }
      const lv = levelOf(k);
      if (lv === 'bad') cells += `<i class="hm-c bad" title="${k}"></i>`;
      else if (lv === null) cells += `<i class="hm-c none" title="${k}"></i>`;
      else cells += `<i class="hm-c l${lv} ${k === today ? 'today' : ''}" title="${k}"></i>`;
    }
  }
  return `<div class="hm ${small ? 'small' : ''}" style="--hm:${color}">
    ${small ? '' : `<div class="hm-months" style="grid-template-columns:repeat(${weeks},1fr)">${months}</div>`}
    <div class="hm-grid" style="grid-template-columns:repeat(${weeks},1fr)">${cells}</div>
  </div>`;
}

// ---------- Ring ----------
export function ring(value, max, { size = 120, stroke = 11, color = 'var(--accent)', inner = '' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return `<div class="ring" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--line)" stroke-width="${stroke}" fill="none"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${over ? 'var(--bad)' : color}" stroke-width="${stroke}" fill="none"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>
    <div class="ring-in">${inner}</div>
  </div>`;
}

// ---------- Balken (7 Tage) ----------
export function bars(items, { goal = null, unit = '', color = 'var(--accent)', height = 110 } = {}) {
  const max = Math.max(goal || 0, ...items.map((i) => i.v), 1) * 1.1;
  const goalLine = goal ? `<div class="bars-goal" style="bottom:${(goal / max) * 100}%"><span>Ziel ${String(goal).replace('.', ',')}${unit}</span></div>` : '';
  return `<div class="bars-wrap">
    <div class="bars" style="height:${height}px">
      ${goalLine}
      ${items.map((i) => `<div class="bar-track"><div class="bar ${i.cls || ''}" style="height:${(i.v / max) * 100}%;${i.cls ? '' : `background:${color}`}"></div></div>`).join('')}
    </div>
    <div class="bars-lbls">${items.map((i) => `<span class="bar-lbl ${i.today ? 'today' : ''}">${esc(i.label)}</span>`).join('')}</div>
  </div>`;
}

export const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
export const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

export function last7(fn) {
  const t = todayKey();
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(t, -i);
    out.push({ k, label: WD[keyToDate(k).getDay()], today: i === 0, ...fn(k) });
  }
  return out;
}

export function fmtSince(ms) {
  if (ms < 0) ms = 0;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (d > 0) return `${d}T ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function fmtDate(key) {
  const d = keyToDate(key);
  return `${WD[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
}

export function fmtTime(t) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function segmented(name, options, active) {
  return `<div class="seg" role="tablist">${options
    .map(([v, l]) => `<button class="seg-b ${v === active ? 'on' : ''}" data-act="${name}" data-v="${v}">${l}</button>`)
    .join('')}</div>`;
}

// ---------- Rang-Animation ----------
export function rankOverlay(rank, up = true) {
  const el = document.createElement('div');
  el.className = 'rank-ov ' + (up ? 'up' : 'down');
  el.style.setProperty('--rc', rank.color);
  el.innerHTML = `<div class="rank-ov-in">
      <div class="rank-ov-kicker">${up ? 'RANG AUFGESTIEGEN' : 'RANG VERLOREN'}</div>
      <div class="rank-ov-emb">${emblem(rank, 160)}</div>
      <div class="rank-ov-name">${esc(rank.full)}</div>
      <div class="rank-ov-sub">${up ? 'Verdient. Nicht geschenkt. Weiter so.' : 'Du bist abgestiegen. Hol ihn dir zurück.'}</div>
      <button class="btn primary mt">${up ? 'Ich bleib dran' : 'Ich hol ihn zurück'}</button>
    </div>`;
  if (up) {
    for (let i = 0; i < 40; i++) {
      const p = document.createElement('i');
      p.className = 'spark';
      p.style.left = Math.random() * 100 + '%';
      p.style.animationDelay = Math.random() * 1.2 + 's';
      p.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
      el.appendChild(p);
    }
  }
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el.querySelector('button').onclick = () => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  };
}
