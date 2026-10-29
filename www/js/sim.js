// Game loop: advances the calendar, plays fixtures, runs weekly/monthly/season hooks.
import { RNG, clamp } from "./rng.js";
import { NATIONS } from "./data.js";
import { A } from "./attributes.js";
import { fullName, shortName, newStats, fairWage } from "./player.js";
import { simulateMatch } from "./match.js";
import { ymd, ageOn, seasonOf, seasonLabel, fmt, day } from "./calendar.js";
import {
  userP, userClub, pickTeam, quickSim, applyLine, developPlayer, makeFixtures, addMail, addNews, table,
  genSenior, genYouth, fifaU18Allowed, leagueNation, INTL_WINDOWS, clubNatOK, createWorld,
} from "./world.js";
import {
  weeklyCareer, monthlyCareer, monthlyReport, playShare, seasonAwards, userSeasonEnd, endLoan, userContractExpiry,
  squadStatus, selectNational, nationalLineup, ntFor, decision,
} from "./career.js";
import { intlDay, campMatchToday, afterIntlMatch } from "./intl.js";
import { staffOf } from "./meta.js";
const staffOfLite = (G, cid) => (G.clubs[cid] ? staffOf(G, cid)[0].name : "");

export function newCareer(f) {
  const G = createWorld(f);
  const rng = rngOf(G);
  seasonPreviews(G, rng);
  G.rs = rng.s;
  return G;
}
export function rngOf(G) { const r = new RNG(1); r.s = G.rs; return r; }
const ids = t => ({ club: t.club, name: t.name, formation: t.formation, xi: t.xi.map(p => p.id), bench: t.bench.map(p => p.id) });
const fromIds = (G, t) => ({ ...t, xi: t.xi.map(id => G.players[id]).filter(Boolean), bench: t.bench.map(id => G.players[id]).filter(Boolean) });

export function continueGame(G, maxDays = 45) {
  const rng = rngOf(G);
  const mailBefore = G.mailId || 0;
  let stop = null;
  for (let i = 0; i < maxDays && !stop; i++) {
    if (G.user.retired) { stop = "retired"; break; }
    if (G.pending) { stop = "match"; break; }
    if (G.inbox.some(m => m.kind === "decision" && !m.done)) { stop = "decision"; break; }
    if (G.processed !== G.date) {
      processDay(G, rng);
      G.processed = G.date;
      if (G.pending) { stop = "match"; break; }
    }
    nextDay(G, rng);
    if ((G.mailId || 0) > mailBefore) { stop = "mail"; break; }
  }
  G.rs = rng.s;
  return stop || "day";
}

// ---------- one day ----------
function processDay(G, rng) {
  intlDay(G, rng);
  const u = userP(G);
  const uc = u.club;
  let userFix = null;
  for (const L of Object.values(G.leagues)) {
    const today = L.fixtures.filter(f => f.d === G.date && !f.res);
    if (!today.length) continue;
    const full = uc && L.id === G.clubs[uc]?.league;
    for (const f of today) {
      if (!G.user.retired && (f.h === uc || f.a === uc)) { userFix = { L, f }; continue; }
      playFixture(G, rng, L, f, full);
    }
  }
  if (userFix) {
    const { L, f } = userFix;
    const prospect = ageOn(u.birth, G.date) <= 21 && u.squad === "A" && rng.chance(0.35 + (u.favour ? 0.3 : 0)) ? u : null;
    const H = pickTeam(G, f.h, rng, { prospect: f.h === uc ? prospect : null });
    const Aw = pickTeam(G, f.a, rng, { prospect: f.a === uc ? prospect : null });
    const mine = f.h === uc ? H : Aw;
    const role = mine.xi.some(p => p.id === u.id) ? "XI" : mine.bench.some(p => p.id === u.id) ? "Cadangan" : null;
    if (role && !u.away) {
      G.pending = { kind: "liga", league: L.id, fid: f.id, home: ids(H), away: ids(Aw), role, comp: L.name, round: f.r };
      return;
    }
    playFixture(G, rng, L, f, true, H, Aw);
    trackMinutes(G, 0);
    if (u.squad === "A" && !u.injury && !u.away && !(u.ban > 0)) G.user.notPicked = (G.user.notPicked || 0) + 1;
  }
  // U-19 match on Saturdays for academy players
  if (!G.pending && u.squad === "Y" && !u.injury && !u.away && !(u.ban > 0) && isYouthDay(G.date)) {
    const club = userClub(G);
    const opp = rng.pick(G.leagues[club.league].teams.filter(id => id !== club.id));
    const home = rng.chance(0.5);
    const H = pickTeam(G, home ? club.id : opp, rng, { youth: true });
    const Aw = pickTeam(G, home ? opp : club.id, rng, { youth: true });
    const mine = home ? H : Aw;
    const role = mine.xi.some(p => p.id === u.id) ? "XI" : mine.bench.some(p => p.id === u.id) ? "Cadangan" : null;
    if (role) G.pending = { kind: "u19", home: ids(H), away: ids(Aw), role, comp: "Liga U-19", youth: true };
  }
  const cm = campMatchToday(G);
  if (!G.pending && cm) {
    if (u.injury) cm.done = true;
    else G.pending = { kind: "timnas", match: cm, comp: cm.comp, role: "?" };
  }
}
function isYouthDay(n) {
  const { m, d, wd } = ymd(n);
  if (wd !== 6) return false;
  if (m === 6 || m === 7 || (m === 8 && d < 22) || (m === 5 && d > 24)) return false;
  return !INTL_WINDOWS.some(([wm, wd2]) => m === wm && d >= wd2 && d <= wd2 + 6);
}

function playFixture(G, rng, L, f, full, H, Aw) {
  H = H || pickTeam(G, f.h, rng);
  Aw = Aw || pickTeam(G, f.a, rng);
  const res = full ? simulateMatch(rng, H, Aw) : quickSim(rng, H, Aw);
  applyFixture(G, rng, L, f, H, Aw, res);
  return res;
}
function applyFixture(G, rng, L, f, H, Aw, res) {
  f.res = res.score;
  f.pom = res.pom;
  const u = userP(G);
  const touchesUser = f.h === u.club || f.a === u.club;
  if (touchesUser || full_(res)) f.sc = res.events.filter(e => e.type === "goal").map(e => [e.side, e.pid, e.min]);
  for (const [id, line] of Object.entries(res.players)) {
    const p = G.players[id];
    applyLine(G, rng, p, line, "liga", p?.isUser);
    if (p && +id === res.pom) p.st.pom++;
  }
  for (const t of [H, Aw]) for (const pid of G.clubs[t.club].squad) { const p = G.players[pid]; if (p && p.ban > 0 && !res.players[pid]) p.ban--; }
}
const full_ = res => !res.quick;

function trackMinutes(G, min) {
  const m = G.user.minutes8 || (G.user.minutes8 = []);
  m.push({ g: 1, min }); if (m.length > 8) m.shift();
}

// ---------- the user's match ----------
const NT_COLORS = { IDN: ["#ce1126", "#ffffff"], ESP: ["#c60b1e", "#ffc400"], ENG: ["#ffffff", "#1d2a5c"], FRA: ["#1f2a6b", "#ffffff"], GER: ["#ffffff", "#111111"], ITA: ["#0064aa", "#ffffff"], POR: ["#a30d2d", "#0c6b3e"], NED: ["#f36c21", "#ffffff"], BRA: ["#ffdc02", "#1b5e20"], ARG: ["#75aadb", "#ffffff"] };
export const ntColors = nat => NT_COLORS[nat] || (() => { let h = 0; for (const c of nat) h = (h * 31 + c.charCodeAt(0)) >>> 0; const hue = h % 360; return [`hsl(${hue} 60% 42%)`, "#ffffff"]; })();

export function pendingTeams(G) {
  const pd = G.pending; if (!pd) return null;
  if (pd.kind === "timnas") {
    const u = userP(G), c = G.camp, mt = pd.match;
    const team = { name: c.team, level: c.level, youth: c.youth, max: c.max };
    const mine = nationalLineup(selectNational(G, c.nat, team).map(p => (p.id === u.id ? u : p)));
    const oppTeam = { ...team, level: c.youth ? NATIONS[mt.opp].level * (c.level / NATIONS[c.nat].level) : NATIONS[mt.opp].level };
    const theirs = nationalLineup(selectNational(G, mt.opp, oppTeam));
    const sfx = c.youth ? " " + c.team : "";
    const H = { club: "NT-" + c.nat, name: NATIONS[c.nat].name + sfx, formation: "4-3-3", xi: mine.xi, bench: mine.bench.slice(0, 9), nat: c.nat };
    const Aw = { club: "NT-" + mt.opp, name: NATIONS[mt.opp].name + sfx, formation: "4-3-3", xi: theirs.xi, bench: theirs.bench.slice(0, 9), nat: mt.opp };
    pd.role = H.xi.some(p => p.id === u.id) ? "XI" : H.bench.some(p => p.id === u.id) ? "Cadangan" : "Tribun";
    return { H, A: Aw };
  }
  return { H: fromIds(G, pd.home), A: fromIds(G, pd.away) };
}
export function teamColors(G, t) {
  if (t.nat) return ntColors(t.nat);
  return G.clubs[t.club]?.colors || ["#888", "#fff"];
}

export function playPending(G, record) {
  const rng = rngOf(G);
  const pd = G.pending; if (!pd) return null;
  const u = userP(G);
  const { H, A: Aw } = pendingTeams(G);
  // the user's own slot: make sure they're used if selected
  const res = simulateMatch(rng, H, Aw, { record: true });
  let comp = pd.comp;
  if (pd.kind === "liga") {
    const L = G.leagues[pd.league];
    const f = L.fixtures.find(x => x.id === pd.fid);
    applyFixture(G, rng, L, f, H, Aw, res);
    trackMinutes(G, res.players[u.id]?.min || 0);
    // other league games of the day were already played
  } else {
    const line = res.players[u.id];
    if (line) {
      applyLine(G, rng, u, line, pd.kind === "u19" ? "u19" : "timnas", true);
      if (pd.kind === "timnas") { G.user.int.apps++; G.user.int.gls += line.gls; G.user.int.ast += line.ast; if (!pd.youth && !G.camp?.youth) { (G.user.int.senior = G.user.int.senior || []).push({ date: G.date, nat: G.camp.nat, official: !/Uji Coba/.test(pd.comp), tour: !!G.camp.tour, age: ageOn(u.birth, G.date) }); u.caps = (u.caps || 0) + 1; u.intGoals = (u.intGoals || 0) + line.gls; if (!G.user.debut) G.user.debut = { date: G.date, opp: pd.match.opp }; } else { const k = G.camp.team; G.user.int.youth[k] = (G.user.int.youth[k] || 0) + 1; } }
      if (pd.kind === "u19") trackMinutes(G, line.min);
    } else if (pd.kind === "u19") trackMinutes(G, 0);
    if (pd.kind === "timnas") {
      pd.match.done = true;
      const sideScore = res.score;
      afterIntlMatch(G, rng, pd.match, sideScore);
    }
  }
  const nameOf = id => { const p = G.players[id] || [...H.xi, ...H.bench, ...Aw.xi, ...Aw.bench].find(q => q.id === +id); return p ? fullName(p) : "?"; };
  const summary = {
    kind: pd.kind, comp, date: G.date, role: pd.role,
    home: { name: H.name, colors: teamColors(G, H), club: H.club }, away: { name: Aw.name, colors: teamColors(G, Aw), club: Aw.club },
    score: res.score, teams: res.teams, pom: res.pom, pomName: nameOf(res.pom),
    events: res.events.map(e => ({ ...e, name: e.pid ? nameOf(e.pid) : "", astId: e.ast, ast: e.ast ? nameOf(e.ast) : null, offId: e.off, off: e.off ? nameOf(e.off) : null })),
    lines: Object.entries(res.players).map(([id, l]) => ({ id: +id, name: nameOf(id), ...l })).sort((a, b) => a.side - b.side || (b.start - a.start) || 0),
    user: res.players[u.id] || null, pens: pd.match?.pens || null,
    ...matchCharts(res),
    lineups: res.lineups.map((l, side) => ({ formation: l.formation, start: l.start.map(s => ({ ...s, name: nameOf(s.id), no: numOf(G, s.id, [H, Aw][side]) })) })),
    venue: pd.kind === "timnas" ? "" : pd.kind === "u19" ? "Lapangan Akademi" : `Kandang ${H.name}`,
    homeShort: shortOfTeam(G, H), awayShort: shortOfTeam(G, Aw),
    benches: [H, Aw].map(t => t.bench.map(p => ({ id: p.id, name: shortName(p), no: numOf(G, p.id, t), pos: p.main }))),
    managers: [H, Aw].map(t => managerOf(G, t)),
  };
  summary.shots.forEach(sh => (sh.name = nameOf(sh.pid)));
  const myLine = summary.user;
  if (myLine) {
    const mySide = myLine.side;
    (G.user.matchLog = G.user.matchLog || []).unshift({ date: G.date, comp, opp: mySide === 0 ? Aw.name : H.name, ha: mySide === 0 ? "K" : "T", score: mySide === 0 ? res.score : [res.score[1], res.score[0]], rating: myLine.rating, min: myLine.min, gls: myLine.gls, ast: myLine.ast, pom: res.pom === u.id });
    if (G.user.matchLog.length > 30) G.user.matchLog.length = 30;
  }
  if (pd.kind === "liga") matchReport(G, summary, H, Aw);
  G.lastMatch = summary;
  if (pd.kind === "liga" && summary.user) {
    const r = summary.user.rating;
    if (!G.user.debutClub || G.user.debutClub.club !== u.club) { G.user.debutClub = { club: u.club, date: G.date }; addMail(G, "Debut!", `Kamu melakoni debut untuk ${userClub(G).name} melawan ${u.club === H.club ? Aw.name : H.name} (${summary.user.min} menit, rating ${r.toFixed(1)}).`, "good"); }
  }
  let replay = null;
  if (record) {
    const all = [...H.xi, ...H.bench, ...Aw.xi, ...Aw.bench];
    const info = {};
    [H, Aw].forEach((t, side) => [...t.xi, ...t.bench].forEach(p => (info[p.id] = { name: shortName(p), num: numOf(G, p.id, t), side, user: !!p.isUser })));
    const shortOf = t => G.clubs[t.club]?.short || (t.nat ? t.nat : t.name.slice(0, 3).toUpperCase());
    replay = { frames: res.frames, lineups: summary.lineups, events: summary.events, shots: summary.shots, info, colors: [summary.home.colors, summary.away.colors], names: [H.name, Aw.name], short: [shortOf(H), shortOf(Aw)], lines: summary.lines, h2: summary.h2 };
  }
  G.pending = null;
  G.rs = rng.s;
  return { summary, replay };
}

// ---------- match charts: momentum and xG story ----------
export function matchCharts(res) {
  const F = res.frames;
  const h2f = F.find(f => f.k === "half" && f.h === 2);
  const h2 = h2f ? h2f.t : 2800;
  const toMin = t => (t < h2 ? t / 60 : 45 + (t - h2) / 60);
  const B = 18, mom = new Array(B * 2).fill(0);
  for (let i = 0; i < F.length - 1; i++) {
    const a = F[i], b = F[i + 1];
    const dt = b.t - a.t; if (dt <= 0 || dt > 120) continue;
    const right = (a.s === 0) === (a.h === 1);
    const depth = right ? a.x / 105 : (105 - a.x) / 105;
    const v = Math.max(0, depth - 0.45) * dt * (a.s === 0 ? 1 : -1);
    const half = a.h === 2 ? 1 : 0;
    const k = Math.min(B - 1, Math.floor(((a.t - (half ? h2 : 0)) / 60) / (45 / B)));
    mom[half * B + Math.max(0, k)] += v;
  }
  for (const sh of res.shots) {
    const half = sh.t >= h2 ? 1 : 0;
    const k = Math.min(B - 1, Math.floor(((sh.t - (half ? h2 : 0)) / 60) / (45 / B)));
    mom[half * B + Math.max(0, k)] += (sh.side === 0 ? 1 : -1) * (sh.xg * 260 + (sh.r === "goal" ? 90 : 0));
  }
  const mx = Math.max(1, ...mom.map(Math.abs));
  return {
    momentum: mom.map(v => +(v / mx).toFixed(2)),
    shots: res.shots.map(s => ({ ...s, min: +toMin(s.t).toFixed(1) })),
    h2,
  };
}
function managerOf(G, t) {
  if (t.nat) return "Pelatih timnas";
  return staffOfLite(G, t.club);
}
const shortOfTeam = (G, t) => G.clubs[t.club]?.short || t.nat || t.name.slice(0, 3).toUpperCase();
export function numOf(G, id, team) {
  const p = G.players[id] || [...team.xi, ...team.bench].find(q => q.id === id);
  if (!p) return "";
  if (p.virtual || !G.clubs[p.club] || (team && team.nat)) { const i = [...team.xi, ...team.bench].indexOf(p); return i + 1; }
  return shirtNumber(G, p);
}
// Squad numbers: kept per club; senior squad takes 1–35, academy 36–69
export function shirtNumber(G, p) {
  if (p.no && p.noClub === p.club) return p.no;
  const club = G.clubs[p.club]; if (!club) return "";
  const used = new Set([...club.squad, ...club.youthSquad].map(id => G.players[id]).filter(q => q && q.noClub === club.id && q.id !== p.id).map(q => q.no));
  const PREF = { GK: [1, 13, 25, 31], DR: [2, 12, 22], DL: [3, 15, 23], DC: [4, 5, 6, 15, 24, 26], WBR: [2, 12], WBL: [3, 18], DM: [6, 16, 21], MC: [8, 14, 16, 18, 20], MR: [7, 17], ML: [11, 19], AMR: [7, 17, 27], AML: [11, 19, 29], AMC: [10, 20, 28], ST: [9, 19, 29, 30] };
  let n = null;
  if (p.squad === "A") n = (PREF[p.main] || []).find(x => !used.has(x)) ?? [...Array(35).keys()].map(i => i + 1).find(x => !used.has(x));
  if (n == null) n = [...Array(34).keys()].map(i => i + 36).find(x => !used.has(x)) ?? 99;
  p.no = n; p.noClub = club.id;
  return n;
}

// ---------- news ----------
function matchReport(G, S, H, Aw) {
  const u = userP(G);
  const mine = S.home.club === u.club ? 0 : 1;
  const [a, b] = S.score;
  const my = mine === 0 ? a : b, th = mine === 0 ? b : a;
  const verb = my > th ? (my - th >= 3 ? "pesta gol" : "menang") : my < th ? "takluk" : "imbang";
  const me = S.user;
  const scorers = S.events.filter(e => e.type === "goal").map(e => `${e.name} (${e.min}')`).join(", ");
  addNews(G, {
    title: my > th ? `${[S.home, S.away][mine].name} ${verb} ${my}-${th} atas ${[S.home, S.away][1 - mine].name}` : my < th ? `${[S.home, S.away][mine].name} takluk ${my}-${th} dari ${[S.home, S.away][1 - mine].name}` : `${S.home.name} dan ${S.away.name} bermain imbang ${a}-${b}`,
    body: `${S.comp}: ${S.home.name} ${a}-${b} ${S.away.name}.${scorers ? " Gol: " + scorers + "." : ""}${me ? ` ${fullName(u)} bermain ${me.min} menit dengan rating ${me.rating.toFixed(1)}${me.gls ? ` dan mencetak ${me.gls} gol` : ""}.` : ""} Pemain terbaik: ${S.pomName}.`,
    tag: "Laporan Laga", club: u.club, scope: "me",
  });
}
const PREVIEW = {
  top: ["Juara lagi?", "Target gelar", "Siap merebut mahkota"], euro: ["Malam-malam Eropa kembali?", "Mengincar zona Eropa", "Bidik empat besar"],
  mid: ["Solid dan stabil", "Persiapan yang tenang", "Mencari konsistensi"], low: ["Misi bertahan", "Musim yang berat menanti", "Berjuang menjauhi zona merah"],
};
export function seasonPreviews(G, rng) {
  const u = userP(G);
  for (const L of Object.values(G.leagues)) {
    const ranked = L.teams.slice().sort((a, b) => G.clubs[b].level - G.clubs[a].level);
    const picks = new Set([ranked[0], ranked[1], rng.pick(ranked.slice(4))]);
    if (G.clubs[u.club]?.league === L.id) picks.add(u.club);
    for (const id of picks) {
      const c = G.clubs[id], rank = ranked.indexOf(id) + 1, n = ranked.length;
      const band = rank <= 2 ? "top" : rank <= 6 ? "euro" : rank <= n - 4 ? "mid" : "low";
      addNews(G, {
        title: `Pratinjau Musim ${c.short === c.name ? c.name : c.name.replace(/^(FC|AC|AS|RC|CA|SC|RCD|UD|CF|AJ|OGC|LOSC|SV|VfL|VfB|TSG|1\. FC|1\. FSV|FC)\s/, "")}: ${rng.pick(PREVIEW[band])}`,
        body: `${c.name} diprediksi finis di posisi ke-${rank} ${L.name} musim ${seasonLabel(G.season)}. ${band === "top" ? "Skuad mereka dianggap salah satu yang terkuat di liga." : band === "euro" ? "Mereka punya modal untuk bersaing di papan atas." : band === "mid" ? "Target realistisnya finis di papan tengah." : "Bertahan di liga akan menjadi prioritas utama."}`,
        tag: "Media", club: id, scope: id === u.club ? "me" : "world", league: L.id,
      });
    }
  }
}
function rumours(G, rng) {
  if (!rng.chance(0.5)) return;
  const stars = Object.values(G.players).filter(p => p.squad === "A" && !p.isUser && p.ca >= 140 && G.clubs[p.club] && G.leagues[G.clubs[p.club].league]);
  if (!stars.length) return;
  const p = rng.pick(stars), from = G.clubs[p.club];
  const buyers = Object.values(G.clubs).filter(c => G.leagues[c.league] && c.id !== from.id && c.level >= p.ca - 5);
  if (!buyers.length) return;
  const to = rng.pick(buyers);
  addNews(G, { title: `${to.short} incar ${p.fn[0]}. ${p.ln}`, body: `${to.name} disebut-sebut berminat merekrut ${fullName(p)} dari ${from.name}, menurut spekulasi media terbaru.`, tag: "Rumor Transfer", club: to.id, scope: "transfer" });
}
export function trainingRating(G, rng) {
  const u = userP(G);
  const inten = { Rendah: -0.25, Normal: 0, Tinggi: 0.2 }[G.user.training.intensity] || 0;
  const r = 6.2 + (u.hid.pro - 10) * 0.05 + (u.a[A.det] - 10) * 0.04 + (u.a[A.wor] - 10) * 0.03 + inten + rng.normal(0, 0.28) - (u.injury ? 1 : 0);
  const v = Math.round(clamp(r, 5, 9.5) * 100) / 100;
  (G.user.trainRatings = G.user.trainRatings || []).push(v);
  if (G.user.trainRatings.length > 12) G.user.trainRatings.shift();
}

// ---------- calendar ----------
function nextDay(G, rng) {
  const u = userP(G);
  // recovery
  for (const p of Object.values(G.players)) {
    if (p.cond < 100) p.cond = Math.min(100, p.cond + 5 + p.a[A.nat] / 20 * 6);
    if (p.sharp > 0) p.sharp = Math.max(0, p.sharp - 0.35);
    if (p.injury) {
      p.injury.days--;
      if (p.injury.days <= 0) { p.injury = null; p.cond = 70; p.backOn = G.date; if (p.isUser) addMail(G, "Pulih dari cedera", "Tim medis menyatakan kamu sudah fit dan siap dipilih lagi.", "good", { cat: "Cedera" }); }
    }
  }
  if (u.favour && G.user.favourUntil && G.date > G.user.favourUntil) u.favour = 0;
  G.date++;
  const { m, d, wd } = ymd(G.date);
  if (wd === 1) weekly(G, rng);
  if (d === 1) monthly(G, rng);
  if (m === 6 && d === 1) endSeason(G, rng);
  if (m === 7 && d === 1) newSeason(G, rng);
  if (m === 3 && d === 15) youthIntake(G, rng);
  if ((m === 9 && d === 1) || (m === 2 && d === 1)) addNews(G, { title: "Jendela transfer resmi ditutup", tag: "Transfer", scope: "transfer" });
  if ((m === 7 && d === 1) || (m === 1 && d === 1)) addNews(G, { title: "Jendela transfer dibuka", tag: "Transfer", scope: "transfer" });
}

function weekly(G, rng) {
  const u = userP(G);
  if (!G.user.retired) {
    developPlayer(G, rng, u, 1, playShare(G));
    // training injuries
    const inten = { Rendah: 0.6, Normal: 1, Tinggi: 1.6 }[G.user.training.intensity] || 1;
    if (!u.injury && rng.chance(0.006 * inten * (0.6 + u.hid.inj / 20) * (G.user.difficulty === "Keras" ? 1.3 : 1))) {
      const days = rng.int(3, 18);
      u.injury = { name: "Cedera ringan saat latihan", days, total: days };
      addMail(G, "Cedera di latihan", `Kamu cedera ringan saat latihan dan absen sekitar ${days} hari.`, "bad", { cat: "Cedera" });
      G.user.injuries.push({ date: G.date, name: u.injury.name, days });
    }
    if (G.user.training.intensity === "Tinggi") u.cond = Math.max(60, u.cond - 4);
    trainingRating(G, rng);
    weeklyCareer(G, rng);
  }
  const { m } = ymd(G.date);
  if (m === 7 || m === 8 || m === 1) { aiTransfers(G, rng); rumours(G, rng); }
}

function monthly(G, rng) {
  for (const p of Object.values(G.players)) {
    if (p.isUser) continue;
    const share = clamp((p.mins || 0) / (4.3 * 90), 0, 1);
    developPlayer(G, rng, p, 4.35, p.squad === "Y" ? 0.6 : share);
    p.mins = 0;
  }
  if (!G.user.retired) { monthlyReport(G); monthlyCareer(G, rng); }
}

// ---------- AI transfers ----------
const inLeague = (G, c) => !!G.leagues[c.league];
function aiTransfers(G, rng) {
  const clubs = Object.values(G.clubs).filter(c => inLeague(G, c));
  let moves = 0;
  for (const p of Object.values(G.players)) {
    if (moves >= 7) break;
    if (p.isUser || p.retired || p.squad !== "A" || !p.club) continue;
    const from = G.clubs[p.club]; if (!from || !inLeague(G, from)) continue;
    const age = ageOn(p.birth, G.date);
    if (age < 19 || age > 30 || p.ca < from.level + 6 || !rng.chance(0.035)) continue;
    const buyers = clubs.filter(c => c.id !== from.id && c.level >= p.ca - 4 && c.level <= p.ca + 14 && c.squad.length < 30 && fifaU18Allowed(p.nat, age, c.nation).ok && clubNatOK(c, p.nat));
    if (!buyers.length) continue;
    const to = rng.weighted(buyers, c => (c.nation === from.nation ? 1.6 : 1) * c.level);
    from.squad = from.squad.filter(id => id !== p.id);
    to.squad.push(p.id);
    p.club = to.id;
    p.contract = { end: seasonOf(G.date) + rng.int(3, 5), wage: fairWage(p, to.league) };
    genSenior(G, rng, from, p.main, from.level - 3 + rng.normal(0, 5), from.policy === "basque" ? "ESP" : undefined);
    moves++;
    const u = userP(G);
    if (to.id === u.club || from.id === u.club || p.ca >= 135) addNews(G, { title: `${to.short} rekrut ${fullName(p)}`, body: `${to.name} merekrut ${fullName(p)} (${ageOn(p.birth, G.date)} tahun) dari ${from.name}.`, tag: "Transfer", club: to.id, scope: to.id === u.club || from.id === u.club ? "me" : "transfer" });
    trim(G, to);
  }
}
function trim(G, club) {
  while (club.squad.length > 29) {
    const worst = club.squad.map(id => G.players[id]).filter(p => p && !p.isUser).sort((a, b) => a.ca - b.ca)[0];
    if (!worst) break;
    club.squad = club.squad.filter(id => id !== worst.id);
    delete G.players[worst.id];
  }
}

// ---------- season boundaries ----------
function endSeason(G, rng) {
  const awards = seasonAwards(G);
  const u = userP(G);
  if (!G.user.retired) userSeasonEnd(G, awards);
  if (G.user.loan) endLoan(G);
  const season = G.season;
  // academy player who aged out
  if (!G.user.retired && u.squad === "Y" && ageOn(u.birth, day(season + 1, 7, 1)) >= 19) {
    const club = userClub(G);
    const cas = club.squad.map(id => G.players[id]?.ca || 0).sort((a, b) => b - a);
    if (u.ca >= (cas[20] || club.level - 20) - 25) {
      club.youthSquad = club.youthSquad.filter(id => id !== u.id); club.squad.push(u.id); u.squad = "A";
      addMail(G, "Naik ke tim utama", "Kamu lulus dari akademi dan masuk skuad senior.", "good");
    } else { G.user.leaving = true; u.contract.end = season; addMail(G, "Dilepas akademi", `${club.name} memutuskan tidak mempromosikanmu ke tim utama.`, "bad"); }
  }
  if (!G.user.retired) userContractExpiry(G, rng);
  // AI clubs
  for (const club of Object.values(G.clubs)) {
    if (!inLeague(G, club)) continue;
    for (const pid of [...club.squad]) {
      const p = G.players[pid]; if (!p || p.isUser) continue;
      const age = ageOn(p.birth, day(season + 1, 7, 1));
      if (age >= 39 || (age >= 33 && rng.chance((age - 32) * 0.2 + (p.ca < club.level - 25 ? 0.25 : 0)))) {
        club.squad = club.squad.filter(id => id !== pid);
        delete G.players[pid];
      }
    }
    for (const pid of [...club.youthSquad]) {
      const p = G.players[pid]; if (!p || p.isUser) continue;
      const age = ageOn(p.birth, day(season + 1, 7, 1));
      if (age >= 19) {
        club.youthSquad = club.youthSquad.filter(id => id !== pid);
        if (p.ca >= club.level - 32) { p.squad = "A"; club.squad.push(pid); p.contract = { end: season + 3, wage: fairWage(p, club.league) }; }
        else delete G.players[pid];
      }
    }
    const shape = ["GK","GK","GK","DC","DC","DC","DC","DR","DR","DL","DL","DM","DM","MC","MC","MC","MC","AMR","MR","AML","ML","AMC","ST","ST","ST"];
    const have = {};
    for (const id of club.squad) { const p = G.players[id]; if (p) have[p.main] = (have[p.main] || 0) + 1; }
    for (const pos of shape) {
      if (club.squad.length >= 25) break;
      if ((have[pos] || 0) > 0) { have[pos]--; continue; }
      club.squad.push(genSenior(G, rng, club, pos, club.level - 5 + rng.normal(0, 7), club.policy === "basque" ? "ESP" : undefined).id);
    }
    trim(G, club);
  }
}

function newSeason(G, rng) {
  G.season = seasonOf(G.date);
  for (const L of Object.values(G.leagues)) makeFixtures(G, rng, L, G.season);
  for (const p of Object.values(G.players)) { p.st = newStats(); p.ycCount = 0; p.ban = Math.min(p.ban || 0, 1); }
  G.user.renewOffered = false;
  for (const c of Object.values(G.clubs)) c.injCount = 0;
  seasonPreviews(G, rng);
  addMail(G, `Musim ${seasonLabel(G.season)} dimulai`, `Jadwal ${G.leagues[userClub(G).league]?.name || "liga"} sudah keluar. Laga pertama pertengahan Agustus. Statusmu di skuad: ${squadStatus(G)}.`, "info");
}

function youthIntake(G, rng) {
  for (const club of Object.values(G.clubs)) {
    if (!inLeague(G, club)) continue;
    const n = 3 + Math.floor(club.youth / 5) + (rng.chance(0.3) ? 1 : 0);
    const poss = ["GK","DC","DC","DR","DL","DM","MC","MC","AMR","AML","AMC","ST","ST"];
    for (let i = 0; i < n; i++) club.youthSquad.push(genYouth(G, rng, club, rng.pick(poss), rng.chance(0.75) ? 15 : 16, club.policy === "basque" ? "ESP" : undefined).id);
    while (club.youthSquad.length > 24) {
      const worst = club.youthSquad.map(id => G.players[id]).filter(p => p && !p.isUser && ageOn(p.birth, G.date) >= 17).sort((a, b) => a.ca - b.ca)[0];
      if (!worst) break;
      club.youthSquad = club.youthSquad.filter(id => id !== worst.id); delete G.players[worst.id];
    }
  }
  if (userP(G).squad === "Y") addNews(G, { title: `Angkatan baru akademi ${userClub(G).short}`, body: `${userClub(G).name} menerima angkatan baru pemain muda di akademi.`, tag: "Klub", club: userClub(G).id, scope: "me" });
}

export function retireUser(G) {
  decision(G, "Pensiun?", "Yakin ingin mengakhiri karier sekarang? Keputusan ini tidak bisa dibatalkan.", [
    { label: "Ya, pensiun", detail: "Karier berakhir; Hall of Fame terkunci.", act: "retire" },
    { label: "Belum", detail: "Lanjutkan karier.", act: "none" },
  ]);
}
