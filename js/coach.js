// Coach ohne echte KI: liest deine Daten und antwortet nach festen Regeln. Streng, aber fair.
import { S, todayKey, addDays } from './store.js';
import { rankFor, xpToday } from './xp.js';
import { activeHabits, isDone, habitStreak, cleanDays, foodTotals, workoutMin, workoutStreak, hoursLeftToday } from './logic.js';
import { safetyKind, careState, insightLine, patternsReport, CRISIS_HELP, EATING_HELP } from './insights.js';

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const seedNow = () => Math.floor(Date.now() / 60000);
const name = () => S().profile.name || 'Bro';

export function weekStats() {
  const s = S();
  const t = todayKey();
  const ks = [...Array(7)].map((_, i) => addDays(t, -i));
  const hs = activeHabits();
  const possible = hs.length * 7;
  const done = ks.reduce((a, k) => a + hs.filter((h) => isDone(h.id, k)).length, 0);
  const sleeps = ks.map((k) => s.sleep[k]).filter(Boolean);
  const foodDays = ks.filter((k) => (s.food[k] || []).length);
  const avgK = foodDays.length ? Math.round(foodDays.reduce((a, k) => a + foodTotals(k).kcal, 0) / foodDays.length) : 0;
  const junk = ks.reduce((a, k) => a + foodTotals(k).junk, 0);
  const wMin = ks.reduce((a, k) => a + workoutMin(k), 0);
  const wDays = ks.filter((k) => workoutMin(k) > 0).length;
  const since = Date.now() - 7 * 86400000;
  const relapses = s.bad.reduce((a, b) => a + b.relapses.filter((r) => r.t >= since).length, 0);
  const xpWeek = s.xpLog.filter((l) => l.t >= since).reduce((a, l) => a + l.amt, 0);
  const journals = ks.filter((k) => s.journal[k]).length;
  return {
    habitPct: possible ? Math.round((done / possible) * 100) : null,
    avgSleep: sleeps.length ? Math.round((sleeps.reduce((a, x) => a + x.hours, 0) / sleeps.length) * 10) / 10 : null,
    sleepLogged: sleeps.length,
    avgK,
    foodDays: foodDays.length,
    junk,
    wMin,
    wDays,
    relapses,
    xpWeek,
    journals,
  };
}

// Die eine Sache, die du jetzt tun solltest
export function nextAction() {
  const s = S();
  const k = todayKey();
  const h = new Date().getHours();
  const open = activeHabits().filter((x) => !isDone(x.id, k));
  if (!s.sleep[k] && h >= 5 && h < 14) return { text: 'Trag ein, wie du geschlafen hast.', go: 'body', tab: 'sleep' };
  if (open.length && h < 21) return { text: `Hak „${open[0].name}“ ab. Jetzt, nicht später.`, go: 'habits' };
  if (!workoutMin(k) && h >= 10 && h < 21) return { text: 'Noch kein Training heute. Selbst 15 Minuten zählen.', go: 'body', tab: 'sport' };
  if (!s.affirmedOn[k]) return { text: 'Lies deine Affirmationen und bestätige sie.', go: 'mind', tab: 'affirm' };
  if (!s.journal[k] && h >= 18) return { text: 'Schreib dein Tagebuch. 3 Minuten reichen.', go: 'mind', tab: 'journal' };
  if (h >= 22) return { text: 'Handy weg. Licht aus. Schlaf ist Training.', go: null };
  if (open.length) return { text: `Noch offen: ${open.map((x) => x.name).join(', ')}.`, go: 'habits' };
  return { text: 'Alles erledigt. Mach eine Atemübung oder lern was Neues.', go: 'mind', tab: 'breath' };
}

// Tageskarte auf dem Startbildschirm
export function brief() {
  const s = S();
  const k = todayKey();
  const h = new Date().getHours();
  const hs = activeHabits();
  const done = hs.filter((x) => isDone(x.id, k)).length;
  const r = rankFor(s.xp);
  const xpT = xpToday();
  const lines = [];

  // Wenn das Tagebuch zeigt, dass es dir schlecht geht: kein Druck
  const care = careState();
  if (care) return { text: care.text, xpT, next: { text: care.next, go: 'mind', tab: care.tab } };

  // Rückfall heute?
  const relToday = s.bad.filter((b) => b.relapses.some((x) => todayKey(new Date(x.t)) === k));
  if (relToday.length) {
    lines.push(
      pick(
        [
          `Rückfall heute. Abgehakt. Der Rest des Tages gehört trotzdem dir. Zeig, dass das ein Ausrutscher war und kein Muster.`,
          `Du bist heute gefallen. Das ist passiert. Was jetzt zählt: die nächste Entscheidung.`,
        ],
        seedNow()
      )
    );
  } else if (h < 11) {
    lines.push(pick([`Morgen, ${name()}. Der Tag wird nicht von alleine gut.`, `Aufgestanden? Gut. Jetzt den Tag gewinnen.`, `Neuer Tag, neue XP. Fang stark an.`], seedNow() >> 6));
  } else if (h < 17) {
    lines.push(done === hs.length && hs.length ? `Alle Gewohnheiten erledigt. Respekt. Der Tag ist aber noch nicht vorbei.` : `Halbzeit. ${done}/${hs.length} Gewohnheiten erledigt. Da geht noch was.`);
  } else if (h < 22) {
    lines.push(done === hs.length && hs.length ? `Starker Tag. Jetzt sauber zu Ende bringen.` : `Noch ${Math.floor(hoursLeftToday())} Stunden. ${hs.length - done} Gewohnheiten offen. Keine Ausreden.`);
  } else {
    lines.push(`Es ist spät. Der gefährlichste Teil des Tages. Handy weg, ab ins Bett.`);
  }

  const fromJournal = insightLine();
  if (fromJournal) lines.push(fromJournal);

  // stärkste Serie loben / warnen
  const bestBad = [...s.bad].sort((a, b) => cleanDays(b) - cleanDays(a))[0];
  if (bestBad && cleanDays(bestBad) >= 3 && !relToday.length) lines.push(`${cleanDays(bestBad)} Tage clean bei „${bestBad.name}“. Wirf das nicht weg.`);

  const t = foodTotals(k);
  if (t.junk >= 2) lines.push(`${t.junk}× Junkfood heute. Das hast du dir nicht geschworen.`);

  if (workoutStreak() === 0 && !workoutMin(k)) {
    const last = lastWorkoutDaysAgo();
    if (last !== null && last >= 3) lines.push(`${last} Tage kein Sport. Dein Körper wartet.`);
  }

  if (r.next) lines.push(`Noch ${r.toNext} XP bis ${r.next.full}.`);
  return { text: lines.join(' '), xpT, next: nextAction() };
}

function lastWorkoutDaysAgo() {
  const s = S();
  const t = todayKey();
  for (let i = 0; i < 60; i++) if (workoutMin(addDays(t, -i)) > 0) return i;
  return Object.keys(s.workouts).length ? 60 : null;
}

// ---------- Chat ----------
const URGE = [
  `Hör zu. Ein Drang ist eine Welle: Er steigt, er erreicht den Höhepunkt, er geht weg. Meistens in 10 bis 20 Minuten. Du musst nur nicht mitschwimmen.\n\nJetzt sofort:\n1. Steh auf und geh raus aus dem Raum.\n2. Handy weg oder in einen anderen Raum.\n3. 20 Liegestütze oder kaltes Wasser ins Gesicht.\n4. Mach die Drang-Killer-Atmung.`,
  `Das ist genau der Moment, für den du die Serie aufgebaut hast. Nicht verhandeln, nicht „nur kurz gucken“. Das ist die Lüge, die dein Gehirn dir erzählt.\n\nJetzt: Raum wechseln, Licht an, 20 Liegestütze, Atmung starten. In 15 Minuten lachst du über den Drang.`,
];

const NOMOTIVATION = [
  `Motivation ist ein Gefühl, und Gefühle kommen und gehen. Du brauchst sie nicht. Mach die kleinste mögliche Version: 2 Minuten. Nur anfangen. Der Rest kommt meistens von allein.`,
  `Keine Lust ist normal. Die Leute, die gewinnen, haben auch keine Lust. Sie machen es trotzdem. Such dir jetzt EINE Sache aus und mach sie in den nächsten 5 Minuten.`,
  `Ehrlich: Wie fühlst du dich, wenn du heute Abend nichts geschafft hast? Genau. Steh auf. Eine Sache.`,
];

const RELAPSE = [
  `Okay. Passiert. Jetzt kein Selbstmitleid und kein „ist eh egal“. Genau dieser Gedanke macht aus einem Ausrutscher eine Woche.\n\nDrei Fragen:\n1. Was war der Auslöser? (Uhrzeit, Ort, Gefühl)\n2. Was hättest du 10 Minuten vorher anders machen können?\n3. Was änderst du ab heute?\n\nSchreib es ins Tagebuch. Und dann: neue Serie, ab jetzt.`,
  `Du bist nicht deine Rückfälle. Aber du bist verantwortlich dafür, was als Nächstes passiert. Trag den Rückfall ehrlich ein, lern den Auslöser und hol dir die XP zurück.`,
];

export function reply(input) {
  const q = input.toLowerCase();
  const s = S();
  const k = todayKey();
  const has = (...w) => w.some((x) => q.includes(x));

  // Zuerst: Krisen nie mit strengen Sprüchen beantworten
  const safety = safetyKind(input);
  if (safety === 'crisis') return { text: CRISIS_HELP, actions: [['Ruhe-Atmung', 'breath-start', 'calm']] };
  if (safety === 'eating') return { text: EATING_HELP, actions: [['Ruhe-Atmung', 'breath-start', 'calm']] };

  if (has('tagebuch', 'muster', 'analysier'))
    return { text: patternsReport(), actions: [['Tagebuch öffnen', 'go', 'mind:journal']] };

  if (has('drang', 'urge', 'goon', 'porn', 'geil', 'versuchung', 'rückfall gefahr', 'will gleich', 'craving', 'lust auf'))
    return { text: pick(URGE, seedNow()), actions: [['Drang-Killer starten', 'breath-start', 'urge']] };

  if (has('rückfall', 'mist gebaut', 'versagt', 'verkackt', 'relapse', 'gefallen', 'schwach geworden'))
    return { text: pick(RELAPSE, seedNow()), actions: [['Tagebuch öffnen', 'go', 'mind:journal']] };

  if (has('motivation', 'keine lust', 'bock', 'faul', 'müde', 'kein bock', 'aufgeben', 'schaff das nicht'))
    return { text: pick(NOMOTIVATION, seedNow()), actions: [['Was soll ich tun?', 'ask', 'Was soll ich jetzt tun?']] };

  if (has('was soll ich', 'was jetzt', 'nächste', 'was tun', 'plan'))
    return { text: `Deine nächste Aufgabe: ${nextAction().text}`, actions: nextAction().go ? [['Hin da', 'go', nextAction().go + ':' + (nextAction().tab || '')]] : [] };

  if (has('woche', 'statistik', 'wie läuft', 'bilanz', 'report', 'zusammenfassung', 'analyse')) return { text: weekReport() };

  if (has('essen', 'kalorien', 'kcal', 'hunger', 'abnehmen', 'zunehmen', 'protein', 'eiweiß')) {
    const t = foodTotals(k);
    const g = s.profile.kcalGoal;
    const left = g - t.kcal;
    let txt = `Heute: ${t.kcal} von ${g} kcal, ${Math.round(t.p)} g Eiweiß (Ziel ${s.profile.proteinGoal} g). `;
    if (!t.kcal) txt += `Noch nichts eingetragen. Was du nicht aufschreibst, kannst du nicht kontrollieren.`;
    else if (left > 600) txt += `Noch ${left} kcal übrig. Iss was Richtiges: z.B. Hähnchen mit Reis (550 kcal, 45 g Eiweiß) oder Skyr mit Beeren.`;
    else if (left > 0) txt += `Noch ${left} kcal. Eher was Leichtes: Skyr, Obst, Gemüse, Eier.`;
    else txt += `Du bist ${-left} kcal drüber. Kein Drama: Iss morgen ganz normal weiter und lass keine Mahlzeit ausfallen.`;
    if (t.p < s.profile.proteinGoal * 0.6) txt += ` Dein Eiweiß ist zu niedrig. Quark, Skyr, Hähnchen, Eier, Thunfisch.`;
    return { text: txt, actions: [['Essen eintragen', 'go', 'body:food']] };
  }

  if (has('schlaf', 'schlafen', 'ins bett', 'aufstehen', 'wach')) {
    const w = weekStats();
    let txt = w.avgSleep ? `Du schläfst im Schnitt ${w.avgSleep} h (Ziel ${s.profile.sleepGoal} h). ` : `Du hast diese Woche kaum Schlaf eingetragen. `;
    if (w.avgSleep && w.avgSleep < s.profile.sleepGoal - 0.5) txt += `Das ist zu wenig. Schlafmangel macht dich hungriger, schwächer und anfälliger für Dränge. Handy ab 22:30 aus dem Zimmer.`;
    else if (w.avgSleep) txt += `Solide. Jetzt noch jeden Tag zur gleichen Zeit ins Bett.`;
    txt += `\n\nTipp zum Einschlafen: 4-7-8-Atmung, 4 Runden.`;
    return { text: txt, actions: [['4-7-8 starten', 'breath-start', '478'], ['Schlaf eintragen', 'go', 'body:sleep']] };
  }

  if (has('sport', 'training', 'gym', 'workout', 'trainieren', 'muskel')) {
    const st = workoutStreak();
    const w = weekStats();
    let txt = `Diese Woche: ${w.wMin} Minuten an ${w.wDays} Tagen. `;
    txt += st ? `Du bist ${st} ${st === 1 ? 'Tag' : 'Tage'} am Stück dabei. ` : '';
    txt += workoutMin(k) ? `Heute schon trainiert. Stark.` : `Heute noch nichts. Kein Gym? Dann: 4 Runden aus 15 Liegestützen, 20 Kniebeugen, 30 Sek Plank. Dauert 15 Minuten.`;
    return { text: txt, actions: [['Training eintragen', 'go', 'body:sport']] };
  }

  if (has('rang', 'xp', 'level', 'punkte', 'unreal', 'diamant')) {
    const r = rankFor(s.xp);
    let txt = `Du bist ${r.full} mit ${s.xp} XP. `;
    txt += r.next ? `Noch ${r.toNext} XP bis ${r.next.full}. ` : `Höchster Rang. Jetzt halten. `;
    txt += `Heute: ${xpToday() >= 0 ? '+' : ''}${xpToday()} XP. Ein Rückfall kostet dich bis zu 300 XP. Denk dran.`;
    return { text: txt, actions: [['Profil ansehen', 'go', 'profile:']] };
  }

  if (has('traurig', 'einsam', 'schlecht drauf', 'stress', 'angst', 'down', 'deprimiert')) {
    return {
      text: `Das klingt schwer. Hart zu dir sein heißt nicht, Gefühle zu ignorieren. Mach jetzt eine ruhige Atemübung und schreib auf, was los ist. Und wenn es dir länger richtig schlecht geht: Rede mit jemandem, dem du vertraust, Eltern, Freunde, ein Lehrer. Oder ruf die Nummer gegen Kummer an: 116 111 (kostenlos, anonym). Das ist keine Schwäche.`,
      actions: [['Ruhe-Atmung', 'breath-start', 'calm'], ['Tagebuch', 'go', 'mind:journal']],
    };
  }

  if (has('lernen', 'schule', 'hausaufgaben', 'prüfung', 'klausur'))
    return {
      text: `Lernen läuft wie Training: kurz, fokussiert, regelmäßig. 25 Minuten Fokus, Handy in einen anderen Raum, dann 5 Minuten Pause. Zwei Runden davon sind schon mehr als die meisten schaffen. Mach's als Gewohnheit, dann gibt's auch XP.`,
      actions: [['Gewohnheit anlegen', 'go', 'habits:']],
    };

  if (/(^|\s)(hallo|hi|hey|moin|servus|yo)(\s|$|!|\?)/.test(q)) return { text: `Yo ${name()}. Was ist los? Drang, keine Motivation, oder willst du wissen, wie deine Woche läuft?` };
  if (has('danke', 'thx', 'thanks')) return { text: `Bedank dich nicht. Zieh's durch.` };

  return {
    text: `Ich bin ein fester Coach, keine echte KI. Ich verstehe Themen wie: Drang, Rückfall, keine Motivation, Essen, Schlaf, Sport, Rang, Woche, Lernen. Tipp eins davon oder nimm einen Knopf unten.`,
  };
}

export function weekReport() {
  const w = weekStats();
  const s = S();
  const parts = [`📊 Deine letzten 7 Tage:`];
  if (w.habitPct !== null) parts.push(`• Gewohnheiten: ${w.habitPct}% erledigt ${w.habitPct >= 80 ? '🔥' : w.habitPct >= 50 ? '' : '⚠️'}`);
  parts.push(`• Schlaf: ${w.avgSleep ? w.avgSleep + ' h im Schnitt' : 'kaum eingetragen'}`);
  parts.push(`• Essen: ${w.foodDays ? `${w.avgK} kcal im Schnitt (Ziel ${s.profile.kcalGoal}), ${w.junk}× Junkfood` : 'nicht eingetragen'}`);
  parts.push(`• Sport: ${w.wMin} Min an ${w.wDays} Tagen`);
  parts.push(`• Tagebuch: ${w.journals}/7 Tage`);
  parts.push(`• Rückfälle: ${w.relapses}`);
  parts.push(`• XP: ${w.xpWeek >= 0 ? '+' : ''}${w.xpWeek}`);
  let verdict;
  const score = (w.habitPct || 0) / 25 + (w.wDays >= 3 ? 1 : 0) + (w.relapses === 0 ? 1 : -1) + (w.avgSleep && w.avgSleep >= s.profile.sleepGoal - 0.5 ? 1 : 0);
  if (score >= 5) verdict = `Urteil: Starke Woche. So wird man Unreal.`;
  else if (score >= 3) verdict = `Urteil: Okay, aber da ist mehr drin. Such dir den schwächsten Punkt oben und fix genau den.`;
  else verdict = `Urteil: Schwache Woche. Keine Ausreden. Morgen fängt die nächste an, mach sie besser.`;
  parts.push('', verdict);
  return parts.join('\n');
}

export const QUICK = ['Ich hab Drang', 'Keine Motivation', 'Was sagt mein Tagebuch?', 'Ich hatte einen Rückfall', 'Was soll ich jetzt tun?', 'Wie läuft meine Woche?', 'Wie viele kcal hab ich noch?', 'Wie ist mein Schlaf?'];
