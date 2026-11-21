import { S, save } from '../store.js';
import { esc } from '../ui.js';
import { reply, brief, QUICK } from '../coach.js';

function ensureIntro() {
  const s = S();
  const today = new Date().toDateString();
  const last = s.chat[s.chat.length - 1];
  if (!last || new Date(last.t).toDateString() !== today) {
    s.chat.push({ from: 'coach', text: brief().text + '\n\nWas brauchst du?', t: Date.now() });
    trim();
    save();
  }
}
function trim() {
  const s = S();
  if (s.chat.length > 80) s.chat = s.chat.slice(-80);
}

function bubble(m) {
  const acts = (m.actions || []).map(([l, a, v]) => `<button class="chip accent" data-act="${a}" data-v="${esc(v)}">${esc(l)}</button>`).join('');
  return `<div class="msg ${m.from}"><div class="bub">${esc(m.text).replace(/\n/g, '<br>')}</div>${acts ? `<div class="msg-acts">${acts}</div>` : ''}</div>`;
}

export function render() {
  ensureIntro();
  const s = S();
  return `
  <header class="top"><div><h1 class="h1">Coach</h1><div class="kicker">Fester Coach · keine echte KI</div></div></header>
  <div class="chat" id="chat">${s.chat.map(bubble).join('')}</div>
  <div class="chat-dock">
    <div class="chips scroll-x">${QUICK.map((q) => `<button class="chip" data-act="ask" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="chat-in" id="chatForm">
      <input class="inp" id="chatQ" placeholder="Schreib dem Coach…" autocomplete="off" maxlength="300">
      <button class="btn primary" type="submit" aria-label="senden">➤</button>
    </form>
  </div>`;
}

export function ask(text, app) {
  const s = S();
  text = text.trim();
  if (!text) return;
  s.chat.push({ from: 'me', text, t: Date.now() });
  const r = reply(text);
  s.chat.push({ from: 'coach', text: r.text, actions: r.actions || [], t: Date.now() + 1 });
  trim();
  save();
  app.rerender();
}

export function mount(root, app) {
  const chat = root.querySelector('#chat');
  if (chat) requestAnimationFrame(() => window.scrollTo(0, document.body.scrollHeight));
  const f = root.querySelector('#chatForm');
  if (f)
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = root.querySelector('#chatQ');
      ask(q.value, app);
    });
}

export const actions = {
  ask: (el, app) => {
    if (app.view !== 'coach') app.go('coach');
    ask(el.dataset.v, app);
  },
};
