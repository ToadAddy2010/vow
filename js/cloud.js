// Speichert Vow in deinem Konto.
// Zusätzlich liegt eine Kopie im Browser, damit bei Funkloch nichts verloren geht.
let LOCAL = 'vow.noaccount';
let RESCUE = 'vow.noaccount.rescue';
const DAILY = ['awarded', 'checks', 'sleep', 'food', 'workouts', 'journal', 'breath', 'affirmedOn', 'urgesBeaten'];
const NOTES = {
  offline: 'Keine Verbindung. Deine Einträge werden übertragen, sobald du wieder online bist.',
  local: 'Noch kein Konto verbunden. Deine Einträge liegen nur auf diesem Gerät.',
  full: 'Speichern im Konto klappt gerade nicht. Mach im Profil ein Backup.',
  conflict: 'Auf einem anderen Gerät gab es neuere Einträge. Die wurden übernommen.',
};

let col = null;
let online = false;
let current = null;
let base = 0; // Stand, den dieses Gerät zuletzt sicher in der Cloud gesehen hat
let lastSig = '';
let lastJSON = {};
let known = new Set();
let dirty = false;
let writing = false;
let timer = null;

const signature = (s) => JSON.stringify({ ...s, updatedAt: 0 });
const clone = (v) => JSON.parse(JSON.stringify(v));

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); }
    );
  });
}

function note(kind) {
  const el = document.getElementById('syncNote');
  if (!el) return;
  el.textContent = NOTES[kind] || '';
  el.hidden = !NOTES[kind];
  if (kind === 'conflict') setTimeout(() => { if (el.textContent === NOTES.conflict) el.hidden = true; }, 6000);
}

function readLocal() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOCAL) || 'null');
    if (saved) return saved;
    // Einträge aus der Version ohne Login übernehmen
    const old = JSON.parse(localStorage.getItem('vow.v1') || localStorage.getItem('lockin.v1') || 'null');
    return old ? { state: old, base: 0 } : null;
  } catch (e) {
    return null;
  }
}

function writeLocal() {
  try {
    localStorage.setItem(LOCAL, JSON.stringify({ state: current, base }));
  } catch (e) {}
}

// Tagesdaten liegen pro Monat in einem eigenen Dokument, damit nichts zu groß wird
function split(state) {
  const core = {};
  for (const [k, v] of Object.entries(state)) if (!DAILY.includes(k)) core[k] = v;
  const months = {};
  for (const field of DAILY) {
    for (const [day, value] of Object.entries(state[field] || {})) {
      const id = 'm-' + day.slice(0, 7);
      months[id] = months[id] || {};
      months[id][field] = months[id][field] || {};
      months[id][field][day] = value;
    }
  }
  return { core, months };
}

function join(docs) {
  const state = { ...docs.core };
  for (const field of DAILY) state[field] = {};
  for (const [id, doc] of Object.entries(docs)) {
    if (!id.startsWith('m-')) continue;
    for (const field of DAILY) Object.assign(state[field], doc[field] || {});
  }
  return state;
}

async function fetchCloud() {
  const snap = await withTimeout(col.get(), 8000);
  if (snap.metadata && snap.metadata.fromCache) throw new Error('offline');
  const docs = {};
  snap.docs.forEach((d) => { docs[d.id] = clone(d.data()); });
  known = new Set(Object.keys(docs));
  lastJSON = Object.fromEntries(Object.entries(docs).map(([id, d]) => [id, JSON.stringify(d)]));
  return docs;
}

function choose(docs, local) {
  const hasLocal = !!(local && local.state);
  if (!docs.core) return { state: hasLocal ? local.state : null, push: hasLocal, base: 0 };
  const cloudAt = docs.core.updatedAt || 0;
  if (!hasLocal) return { state: join(docs), push: false, base: cloudAt };
  const localAt = local.state.updatedAt || 0;
  if (cloudAt === local.base) return { state: local.state, push: localAt !== cloudAt, base: cloudAt };
  if (localAt === local.base) return { state: join(docs), push: false, base: cloudAt };
  // Beide Seiten wurden geändert: Cloud gewinnt, die lokale Version bleibt als Reserve liegen
  try {
    localStorage.setItem(RESCUE, JSON.stringify(local.state));
  } catch (e) {}
  return { state: join(docs), push: false, base: cloudAt, conflict: true };
}

function schedule(ms = 700) {
  clearTimeout(timer);
  timer = setTimeout(flush, ms);
}

async function flush() {
  clearTimeout(timer);
  if (!col || !online || writing || !dirty || !current) return;
  writing = true;
  dirty = false;
  let retry = false;
  try {
    const { core, months } = split(current);
    const coreBody = clone(core);
    for (const [id, body] of Object.entries(months)) {
      const json = JSON.stringify(body);
      if (lastJSON[id] === json) continue;
      await col.doc(id).set(JSON.parse(json));
      lastJSON[id] = json;
      known.add(id);
    }
    for (const id of [...known]) {
      if (id === 'core' || months[id]) continue;
      await col.doc(id).delete();
      known.delete(id);
      delete lastJSON[id];
    }
    await col.doc('core').set(coreBody);
    lastJSON.core = JSON.stringify(coreBody);
    known.add('core');
    base = coreBody.updatedAt || 0;
    writeLocal();
    note('');
  } catch (e) {
    dirty = true;
    const permanent = e && ['invalid_argument', 'quota_exceeded', 'revoked', 'not_granted'].includes(e.code);
    note(permanent ? 'full' : 'offline');
    retry = !permanent;
  } finally {
    writing = false;
  }
  if (retry) schedule(30000);
  else if (dirty && document.getElementById('syncNote')?.hidden !== false) schedule();
}

function changed(state) {
  current = state;
  const sig = signature(state);
  if (sig === lastSig) return;
  lastSig = sig;
  state.updatedAt = Date.now();
  dirty = true;
  writeLocal();
  schedule();
}

// Beim Zurückkehren in die App: Stand vom anderen Gerät holen
async function refresh() {
  if (!col || writing) return null;
  try {
    const docs = await fetchCloud();
    online = true;
    const picked = choose(docs, { state: current, base });
    base = picked.base;
    note(picked.conflict ? 'conflict' : '');
    if (picked.state && picked.state !== current) {
      current = picked.state;
      lastSig = signature(current);
      dirty = false;
      writeLocal();
      return current;
    }
    if (picked.push) {
      dirty = true;
      schedule(100);
    }
  } catch (e) {
    online = false;
    note('offline');
  }
  return null;
}

export async function initCloud(collection, storageKey) {
  if (storageKey) {
    LOCAL = storageKey;
    RESCUE = `${storageKey}.rescue`;
  }
  const local = readLocal();
  let initial = local && local.state ? local.state : null;
  base = (local && local.base) || 0;
  let push = false;
  if (collection) {
    col = collection;
    try {
      const docs = await fetchCloud();
      online = true;
      const picked = choose(docs, local);
      initial = picked.state;
      base = picked.base;
      push = picked.push;
      if (picked.conflict) note('conflict');
    } catch (e) {
      note('offline');
    }
  } else {
    note('local');
  }
  current = initial;
  lastSig = initial ? signature(initial) : '';
  if (initial) writeLocal();
  window.__vowInitial = initial;
  window.__vowCloud = { changed, flush, refresh, isDirty: () => dirty || writing };
  if (push) {
    dirty = true;
    schedule(300);
  }
}
