// Liest das Tagebuch direkt auf dem Gerät und sucht Muster. Nichts davon wird verschickt.
import { S, todayKey, addDays, daysBetween, keyToDate } from './store.js';
import { workoutMin } from './logic.js';
import { MOODS } from './data.js';

export const CRISIS_HELP = `Das hier ist wichtiger als jede Serie und jeder Rang. Ich bin nur ein Programm und kann dir dabei nicht richtig helfen, aber echte Menschen können das.\n\nBist du gerade in Gefahr? Ruf die 112.\n\nKostenlos und anonym:\n• TelefonSeelsorge: 0800 111 0 111 (Tag und Nacht)\n• Nummer gegen Kummer: 116 111 (für Kinder und Jugendliche)\n\nSag bitte auch jemandem, dem du vertraust, was los ist. Am besten jetzt gleich.`;

export const EATING_HELP = `Das klingt ernst, und dabei geht es nicht um Disziplin. Bitte iss regelmäßig und lass Kalorien und Serien gerade links liegen.\n\nSprich mit jemandem, dem du vertraust, und mit einem Arzt oder einer Ärztin.\n\nKostenlos und anonym:\n• TelefonSeelsorge: 0800 111 0 111 (Tag und Nacht)\n• Nummer gegen Kummer: 116 111 (für Kinder und Jugendliche)`;

const CRISIS_WORDS = ['suizid', 'selbstmord', 'umbringen', 'nicht mehr leben', 'sterben will', 'will sterben', 'lebensmüde', 'mich ritzen', 'ritze mich', 'selbstverletz', 'mir was antun', 'mir etwas antun', 'mir das leben', 'will tot sein', 'wäre lieber tot', 'nicht mehr aufwachen', 'ohne mich besser'];
const EATING_WORDS = ['essstörung', 'magersucht', 'bulimie', 'nichts mehr essen', 'nichts essen', 'erbrechen', 'erbrochen', 'hasse meinen körper', 'nach dem essen gekotzt', 'essen ausgekotzt', 'essen wieder auskotzen'];

const THEMES = [
  { id: 'stress', label: 'Stress', tone: 'hard', stems: ['stress', 'gestresst', 'überforder', 'druck', 'zu viel', 'hektik', 'nervös'], reply: 'Da liegt gerade viel auf dir. Schreib für morgen nur die eine wichtigste Sache auf. Den Rest darf der Tag danach haben.', action: ['Ruhe-Atmung', 'breath-start', 'calm'] },
  { id: 'angst', label: 'Sorgen', tone: 'hard', stems: ['angst', 'ängstlich', 'sorge', 'panik', 'unsicher', 'befürcht'], reply: 'Sorgen werden abends oft größer, als sie sind. Frag dich: Was davon kann ich morgen wirklich beeinflussen? Nur darum kümmerst du dich.', action: ['Box-Atmung', 'breath-start', 'box'] },
  { id: 'traurig', label: 'Traurigkeit', tone: 'hard', stems: ['traurig', 'einsam', 'alleine gefühlt', 'fühle mich allein', 'leer', 'deprimiert', 'geweint', 'weinen', 'vermisse', 'hoffnungslos', 'niedergeschlagen'], reply: 'Das klingt schwer, und das darf es auch sein. Heute musst du nichts gewinnen. Schreib oder ruf eine Person an, die dir guttut.', action: ['Ruhe-Atmung', 'breath-start', 'calm'] },
  { id: 'wut', label: 'Wut', tone: 'hard', stems: ['wütend', 'wut', 'sauer', 'genervt', 'aggressiv', 'streit', 'gestritten'], reply: 'Wut braucht Bewegung, keine Entscheidung. Mach 20 Liegestütze oder geh 10 Minuten raus. Antworte erst danach.', action: ['Training eintragen', 'go', 'body:sport'] },
  { id: 'muede', label: 'Müdigkeit', tone: 'hard', stems: ['müde', 'übermüdet', 'erschöpft', 'kaputt', 'schlapp', 'schlecht geschlafen', 'kaum geschlafen', 'wenig geschlafen', 'nicht geschlafen', 'wach gelegen'], reply: 'Das ist kein Charakterproblem, das ist Schlaf. Geh heute 30 Minuten früher ins Bett und leg das Handy aus dem Zimmer.', action: ['4-7-8 starten', 'breath-start', '478'] },
  { id: 'drang', label: 'Drang', tone: 'hard', stems: ['drang', 'rückfall', 'rückfällig', 'schwach geworden', 'porn', 'goon', 'versuchung', 'craving'], reply: 'Gut, dass du es aufschreibst. Ein Drang, den du benennst, hat weniger Macht. Wann und wo kam er? Genau da brauchst du morgen einen Plan.', action: ['Drang-Killer', 'breath-start', 'urge'] },
  { id: 'handy', label: 'Handy', tone: 'hard', stems: ['handy', 'tiktok', 'insta', 'youtube', 'reels', 'gescrollt', 'scrollen', 'doomscroll', 'gezockt', 'zocken'], reply: 'Das Handy hat dir heute Zeit genommen. Leg es heute Nacht außerhalb vom Bett. Das ist der kleinste Schritt mit der größten Wirkung.', action: ['Gewohnheiten', 'go', 'habits:'] },
  { id: 'essen', label: 'Essen', tone: 'hard', stems: ['junkfood', 'junk', 'süßes', 'gefressen', 'überfressen', 'genascht', 'naschen', 'zu viel gegessen', 'fast food'], reply: 'Ein Essen entscheidet gar nichts. Lass keine Mahlzeit ausfallen und mach morgen einfach normal weiter.', action: null },
  { id: 'stolz', label: 'Erfolg', tone: 'good', stems: ['stolz', 'geschafft', 'durchgezogen', 'gut gelaufen', 'erfolg', 'gewonnen', 'diszipliniert', 'fokussiert', 'produktiv', 'besser geworden', 'gut gemacht'], reply: 'Das hast du dir verdient. Merk dir genau, was heute geklappt hat, denn das kannst du morgen wiederholen.', action: null },
  { id: 'sport', label: 'Sport', tone: 'good', stems: ['training', 'trainiert', 'gym', 'sport', 'gelaufen', 'joggen', 'liegestütz', 'workout', 'fußball'], reply: 'Bewegung ist der Beweis, dass du es durchziehst. Morgen wieder, auch wenn es nur 15 Minuten sind.', action: ['Training eintragen', 'go', 'body:sport'] },
  { id: 'schule', label: 'Schule', tone: 'neutral', stems: ['schule', 'klausur', 'prüfung', 'lernen', 'gelernt', 'hausaufgabe', 'unterricht', 'mathe', 'referat', 'noten'], reply: 'Nimm dir morgen 25 Minuten ohne Handy für die schwerste Aufgabe, bevor du irgendetwas anderes machst.', action: ['Gewohnheiten', 'go', 'habits:'] },
  { id: 'menschen', label: 'Menschen', tone: 'neutral', stems: ['freund', 'familie', 'eltern', 'mama', 'papa', 'bruder', 'schwester', 'kumpel'], reply: 'Menschen, die dir guttun, sind Teil deiner Disziplin. Melde dich morgen bei einem von ihnen.', action: null },
].map((t) => ({
  ...t,
  re: new RegExp(`(^|[^a-zäöüß])(${t.stems.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g'),
}));

const NEGATED = /(?:nicht|kein|keine|keinen|keinem|ohne|kaum)\s+$/;
const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length;
const de = (n) => n.toFixed(1).replace('.', ',');
const parts = (text, split) => String(text || '').split(split).map((x) => x.trim()).filter(Boolean);

const entryText = (e) => [e.text, ...(e.grat || [])].filter(Boolean).join('\n');

export function safetyKind(input) {
  const q = String(input || '').toLowerCase();
  if (CRISIS_WORDS.some((w) => q.includes(w))) return 'crisis';
  if (parts(q, /[.!?,;\n]+/).some((x) => /(^|\s)(will|kann)\s+nicht\s+mehr$/.test(x))) return 'crisis';
  if (EATING_WORDS.some((w) => q.includes(w)) || /(^|[^a-zäöüß])(hungere|hungern)/.test(q)) return 'eating';
  return null;
}

function themesOf(text) {
  const q = String(text || '').toLowerCase();
  return THEMES.filter((t) => {
    t.re.lastIndex = 0;
    let m;
    while ((m = t.re.exec(q))) {
      const start = m.index + m[1].length;
      if (!NEGATED.test(q.slice(Math.max(0, start - 10), start))) return true;
    }
    return false;
  });
}

function recentEntries(days) {
  const s = S();
  const t = todayKey();
  const out = [];
  for (let i = 0; i < days; i++) {
    const k = addDays(t, -i);
    const e = s.journal[k];
    if (e && entryText(e).trim()) out.push({ ...e, k, full: entryText(e) });
  }
  return out;
}

// Antwort auf einen einzelnen Eintrag
export function entryResponse(k = todayKey()) {
  const e = S().journal[k];
  if (!e || !entryText(e).trim()) return null;
  const full = entryText(e);
  const safety = safetyKind(full);
  if (safety) {
    return {
      kind: safety,
      title: 'Das ist gerade wichtiger als jede Serie',
      text: safety === 'crisis' ? CRISIS_HELP : EATING_HELP,
      actions: [['Ruhe-Atmung', 'breath-start', 'calm']],
    };
  }
  const found = themesOf(full);
  const hard = found.find((t) => t.tone === 'hard');
  const good = found.find((t) => t.tone === 'good');
  const mood = e.mood || 0;
  const main = mood >= 4 ? good || hard || found[0] : hard || (mood && mood <= 2 ? null : good || found[0]);
  let text;
  if (main) text = main.reply;
  else if (mood && mood <= 2) text = 'Das war kein leichter Tag. Du musst heute nichts mehr gewinnen. Iss was, trink was und geh früh schlafen. Morgen reicht eine kleine Sache.';
  else if (mood >= 4) text = 'Starker Eintrag. Merk dir, was heute funktioniert hat, und mach morgen genau das nochmal.';
  else text = 'Gut, dass du es aufgeschrieben hast. Such dir für morgen eine Sache aus, die den Tag ein Stück besser macht.';
  if (main && main.tone === 'hard' && good) text += '\n\nUnd du hast auch etwas geschafft. Das zählt genauso.';
  return {
    kind: 'normal',
    title: found.length ? `Ich lese raus: ${found.slice(0, 3).map((t) => t.label).join(', ')}` : 'Dein Eintrag',
    text,
    actions: main && main.action ? [main.action] : [],
  };
}

// Wenn es jemandem schlecht geht, sind strenge Sprüche fehl am Platz
export function careState() {
  const safety = recentEntries(3).map((e) => safetyKind(e.full)).find(Boolean);
  if (safety) {
    return {
      kind: safety,
      text: 'Heute geht es nicht um Serien oder XP. Wenn es dir nicht gut geht, rede bitte mit jemandem. Die Nummern findest du im Tagebuch.',
      next: 'Hilfe und Ruhe-Atmung ansehen',
      tab: 'journal',
    };
  }
  const moods = recentEntries(7).map((e) => e.mood).filter(Boolean).slice(0, 4);
  if (moods.length === 4 && moods.every((m) => m <= 2)) {
    return {
      kind: 'low',
      text: 'Die letzten Tage waren schwer für dich. Heute reicht eine kleine Sache. Wenn es so bleibt, sprich bitte mit jemandem, dem du vertraust.',
      next: 'Eine kleine Sache: kurz atmen',
      tab: 'breath',
    };
  }
  return null;
}

function moodSplit(list, test) {
  const yes = [];
  const no = [];
  list.filter((e) => e.mood).forEach((e) => {
    const r = test(e.k);
    if (r === null) return;
    (r ? yes : no).push(e.mood);
  });
  if (yes.length < 2 || no.length < 2) return null;
  return { yes: avg(yes), no: avg(no), diff: avg(yes) - avg(no) };
}

function topOf(values) {
  const count = new Map();
  values.forEach((v) => {
    const key = v.toLowerCase();
    const old = count.get(key) || { label: v, n: 0 };
    old.n += 1;
    count.set(key, old);
  });
  return [...count.values()].sort((a, b) => b.n - a.n)[0] || null;
}

function bucketOf(t) {
  const h = new Date(t).getHours();
  if (h >= 22 || h < 5) return 'spät abends oder nachts';
  if (h < 12) return 'morgens';
  if (h < 17) return 'nachmittags';
  return 'abends';
}

// Muster aus den letzten 30 Tagen
export function patterns() {
  const s = S();
  const t = todayKey();
  const list = recentEntries(30);
  const need = Math.max(0, 3 - list.length);
  if (need) return { count: list.length, need, cards: [] };
  const cards = [];

  const moodsIn = (from, to) => list.filter((e) => e.mood && daysBetween(e.k, t) >= from && daysBetween(e.k, t) <= to).map((e) => e.mood);
  const now = moodsIn(0, 6);
  const before = moodsIn(7, 13);
  if (now.length >= 2 && before.length >= 2 && Math.abs(avg(now) - avg(before)) >= 0.5) {
    const up = avg(now) > avg(before);
    const text = `Deine Stimmung ging von ${de(avg(before))} auf ${de(avg(now))} von 5 ${up ? 'hoch' : 'runter'}.`;
    cards.push({ icon: up ? '📈' : '📉', title: up ? 'Es geht aufwärts' : 'Diese Woche war schwerer', text: up ? `${text} Was du gerade machst, wirkt.` : `${text} Das ist kein Versagen. Schau, was sich verändert hat.`, short: up ? 'Deine Stimmung steigt gerade. Bleib genau dabei.' : '' });
  }

  const sleep = moodSplit(list, (k) => (s.sleep[k] ? s.sleep[k].hours >= s.profile.sleepGoal - 0.25 : null));
  if (sleep && sleep.diff >= 0.5) {
    cards.push({ icon: '😴', title: 'Schlaf hebt deine Stimmung', text: `Mit genug Schlaf liegt deine Stimmung bei ${de(sleep.yes)}, sonst bei ${de(sleep.no)}.`, short: 'Dein Tagebuch zeigt: Mit genug Schlaf geht es dir meistens besser.' });
  }
  const sport = moodSplit(list, (k) => workoutMin(k) > 0);
  if (sport && sport.diff >= 0.5) {
    cards.push({ icon: '💪', title: 'Sport tut dir gut', text: `An Tagen mit Training liegt deine Stimmung bei ${de(sport.yes)}, sonst bei ${de(sport.no)}.`, short: 'Dein Tagebuch zeigt: An Trainingstagen geht es dir meistens besser.' });
  }

  const themeDays = THEMES.map((theme) => ({ theme, n: list.filter((e) => themesOf(e.full).includes(theme)).length })).filter((x) => x.n >= 2);
  const hardTop = themeDays.filter((x) => x.theme.tone === 'hard').sort((a, b) => b.n - a.n)[0];
  if (hardTop) cards.push({ icon: '🔎', title: `${hardTop.theme.label} kommt oft vor`, text: `In ${hardTop.n} von ${list.length} Einträgen. ${hardTop.theme.reply}` });
  const goodTop = themeDays.filter((x) => x.theme.tone === 'good').sort((a, b) => b.n - a.n)[0];
  if (goodTop) cards.push({ icon: '🔥', title: `${goodTop.theme.label} gibt dir Kraft`, text: `Das taucht in ${goodTop.n} von ${list.length} Einträgen auf. Bau genau darauf auf.` });

  const since = keyToDate(addDays(t, -29)).getTime();
  const relapses = s.bad.flatMap((b) => b.relapses.filter((r) => r.t >= since));
  const trigger = topOf(relapses.flatMap((r) => parts(r.note, ',')));
  const time = topOf(relapses.map((r) => bucketOf(r.t)));
  if (trigger && trigger.n >= 2) {
    cards.push({ icon: '🛡️', title: 'Dein häufigster Auslöser', text: `„${trigger.label}“ steht bei ${trigger.n} von ${relapses.length} Rückfällen. Überleg dir dafür heute einen festen Plan.` });
  } else if (time && time.n >= 2 && time.n / relapses.length >= 0.6) {
    cards.push({ icon: '🕙', title: 'Deine gefährliche Zeit', text: `${time.n} von ${relapses.length} Rückfällen passierten ${time.label}. Genau dann braucht das Handy einen anderen Platz.` });
  }

  const thanks = topOf(list.flatMap((e) => (e.grat || []).map((g) => g.trim()).filter(Boolean)));
  if (thanks && thanks.n >= 2) cards.push({ icon: '🙏', title: 'Das gibt dir Halt', text: `Am öftesten warst du dankbar für „${thanks.label}“. Gib dem diese Woche bewusst Zeit.` });

  const own = list
    .filter((e) => e.k !== t && (e.mood >= 4 || themesOf(e.full).some((x) => x.id === 'stolz')))
    .flatMap((e) => (String(e.text || '').match(/[^.!?\n]+[.!?]*/g) || []).map((line) => ({ line: line.trim(), k: e.k })))
    .find(({ line }) => line.length >= 25 && line.length <= 130 && !safetyKind(line) && !themesOf(line).some((x) => x.tone === 'hard'));
  if (!own) return { count: list.length, need: 0, cards: cards.slice(0, 5) };
  const d = keyToDate(own.k);
  const ownCard = { icon: '✍️', title: 'Das hast du selbst geschrieben', text: `Am ${d.getDate()}.${d.getMonth() + 1}.: „${own.line}“ Das warst du. Das kannst du wieder.` };
  return { count: list.length, need: 0, cards: [...cards.slice(0, 4), ownCard] };
}

// Eine persönliche Zeile für die Coach-Karte auf „Heute“
export function insightLine() {
  const lines = patterns().cards.map((c) => c.short).filter(Boolean);
  if (!lines.length) return '';
  const day = Math.floor(keyToDate(todayKey()).getTime() / 86400000);
  return lines[day % lines.length];
}

export function patternsReport() {
  const care = careState();
  if (care && care.kind === 'crisis') return CRISIS_HELP;
  if (care && care.kind === 'eating') return EATING_HELP;
  const p = patterns();
  if (p.need) return `Ich brauche noch ${p.need} ${p.need === 1 ? 'Eintrag' : 'Einträge'}, dann erkenne ich deine Muster. Schreib heute ein paar ehrliche Sätze.`;
  if (!p.cards.length) return `Ich habe ${p.count} Einträge gelesen, aber noch kein klares Muster gefunden. Schreib weiter und trag deine Stimmung ein.`;
  return ['📓 Das zeigt dein Tagebuch:', ...p.cards.map((c) => `• ${c.title}: ${c.text}`)].join('\n');
}

// Text zum Kopieren für eine echte KI. Enthält nur das Tagebuch, keinen Namen und keine E-Mail.
export function aiPrompt() {
  const entries = recentEntries(14).reverse().map((e) => {
    const mood = MOODS.find((m) => m.v === e.mood);
    const grat = (e.grat || []).filter(Boolean);
    return [`${e.k}${mood ? ` (Stimmung: ${mood.l}, ${mood.v}/5)` : ''}`, e.text ? e.text.trim() : '', grat.length ? `Dankbar für: ${grat.join(', ')}` : ''].filter(Boolean).join('\n');
  });
  return `Du bist ein ehrlicher, warmer Coach für Gewohnheiten. Unten stehen meine Tagebucheinträge der letzten 14 Tage.

Bitte:
1. Nenne die 3 wichtigsten Muster, die du siehst, mit konkreten Beispielen aus meinen Einträgen.
2. Sag mir, was gut läuft.
3. Gib mir genau einen kleinen, machbaren Schritt für morgen.
4. Schreib mir zum Schluss eine kurze, persönliche Motivation.

Regeln: Antworte locker auf Deutsch. Sei ehrlich, aber beschäme mich nicht. Stell keine Diagnosen und gib keine Diät- oder Kalorientipps. Wenn etwas auf eine Krise, Selbstverletzung oder Essstörung hindeutet, geh zuerst darauf ein und nenne echte Hilfe: 112, TelefonSeelsorge 0800 111 0 111, Nummer gegen Kummer 116 111.

Meine Einträge:

${entries.join('\n\n')}`;
}
