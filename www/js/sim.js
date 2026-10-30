// Game loop: advances the calendar, plays fixtures, runs weekly/monthly/season hooks.
import { RNG, clamp } from "./rng.js";
import { NATIONS } from "./data.js";
import { A } from "./attributes.js";
import { fullName, shortName, newStats, fairWage } from "./player.js";
import { simulateMatch, matchGen, FORMATIONS } from "./match.js";
import { maybePress } from "./press.js";
import { ymd, ageOn, seasonOf, seasonLabel, fmt, day, nextWeekday } from "./calendar.js";
import {
  userP, userClub, pickTeam, quickSim, applyLine, developPlayer, makeFixtures, addMail, addNews, table,
  genSenior, genYouth, fifaU18Allowed, leagueNation, inIntlWindow, clubNatOK, createWorld, START, fillSquad, leagueSeasonLabel, banned, banTotal,
} from "./world.js";
import { setupSeasonComps, setupYearComps, compsAfterDay, afterTieFixture, cupWeekends, promotions, finishLeague, compLabel, CONT_IDS } from "./comps.js";
import {
  weeklyCareer, monthlyCareer, monthlyReport, playShare, seasonAwards, userSeasonEnd, endLoan, userContractExpiry,
  squadStatus, selectNational, nationalLineup, ntFor, decision, trainingSessionsToday, doTraining, W, F,
} from "./career.js";
import { intlDay, campMatchToday, afterIntlMatch, setupNL } from "./intl.js";
import { payWeek, payMatchBonus, weeklyResidency, checkPromise } from "./contract.js";
import { staffOf } from "./meta.js";
const staffOfLite = (G, cid) => (G.clubs[cid] ? staffOf(G, cid)[0].name : "");

export function newCareer(f) {
  const G = createWorld(f);
  const rng = rngOf(G);
  // 2026/27 (Aug–May leagues), the 2026 calendar-year leagues and Argentina's Torneo Clausura 2026
  G.blocked = cupWeekends(2026);
  for (const L of Object.values(G.leagues)) {
    if (L.cal === "aug") makeFixtures(G, rng, L, 2026);
    else if (L.cal === "year") makeFixtures(G, rng, L, 2026);
    else makeFixtures(G, rng, L, 2026, "Clausura");
  }
  setupSeasonComps(G, rng, 2026);
  setupYearComps(G, rng, 2026);
  setupNL(G);
  catchUp(G, rng, day(2026, 1, 1), START - 1);
  setupFriendlies(G, rng);
  seasonPreviews(G, rng);
  G.rs = rng.s;
  return G;
}
// Pre-season friendlies for the user's club (senior side and U-19), July–August.
export function setupFriendlies(G, rng) {
  const u = userP(G), club = userClub(G);
  G.friendly = null;
  const L = club && G.leagues[club.league];
  if (!L || L.cal !== "aug") return;
  const first = Math.min(...L.fixtures.map(f => f.d));
  const cands = Object.values(G.clubs).filter(c => c.id !== club.id && (G.leagues[c.league] || c.ext) && Math.abs(c.level - club.level) < 22);
  const ycands = cands.filter(c => c.youthSquad.length >= 11);
  const fixtures = [];
  let d = nextWeekday(G.date + 8, 6), n = 0;
  while (d < first - 4 && n < 5) {
    const opp = rng.pick(cands), home = rng.chance(0.5);
    fixtures.push({ id: `FR-${G.season}-${n}`, d: d - (n % 2 ? 3 : 0), h: home ? club.id : opp.id, a: home ? opp.id : club.id, res: null });
    const yo = rng.pick(ycands);
    if (yo) fixtures.push({ id: `FRY-${G.season}-${n}`, d: d + 1, h: club.id, a: yo.id, res: null, youth: true });
    d += 7; n++;
  }
  G.friendly = { club: club.id, season: G.season, fixtures, name: "Laga Persahabatan" };
}
function playFriendly(G, rng, f, H, Aw, res) {
  res = res || quickSim(rng, H, Aw);
  f.res = res.score.slice();
  for (const [id, line] of Object.entries(res.players)) { const p = G.players[id]; if (p) applyLine(G, rng, p, line, "friendly", p.isUser); }
  return res;
}
// Calendar-year competitions already under way on 1 July 2026: play their first half quickly.
function catchUp(G, rng, from, to) {
  const keep = G.date;
  for (let d = from; d <= to; d++) {
    G.date = d;
    for (const L of Object.values(G.leagues)) for (const f of L.fixtures) if (f.d === d && !f.res) playFixture(G, rng, L, f, false);
    for (const c of Object.values(G.comps)) if (c.state === "run") for (const f of c.fixtures) if (f.d === d && !f.res) playFixture(G, rng, c, f, false);
    compsAfterDay(G, rng);
  }
  G.date = keep;
  for (const p of Object.values(G.players)) { p.injury = null; p.bans = {}; p.ycs = {}; p.cond = 100; p.form = p.form.slice(-3); }
}
export function rngOf(G) { const r = new RNG(1); r.s = G.rs; return r; }
const ids = t => ({ club: t.club, name: t.name, formation: t.formation, xi: t.xi.map(p => p.id), bench: t.bench.map(p => p.id) });
const fromIds = (G, t) => ({ ...t, xi: t.xi.map(id => G.players[id]).filter(Boolean), bench: t.bench.map(id => G.players[id]).filter(Boolean) });

export function continueGame(G, maxDays = 45) {
  const rng = rngOf(G);
  if (G.trainingDue) { G.rs = rng.s; return "training"; }
  const mailBefore = G.mailId || 0;
  let stop = null;
  for (let i = 0; i < maxDays && !stop; i++) {
    if (G.user.retired) { stop = "retired"; break; }
    if (G.pending) { stop = "match"; break; }
    if (G.inbox.some(m => m.kind === "decision" && !m.done)) { stop = "decision"; break; }
    if (G.processed !== G.date) {
      // training comes first in the day: stop so the player can take part (or train automatically)
      if (G.user.trainDone !== G.date && trainingSessionsToday(G)) {
        const stopHere = (G.settings?.trainStop ?? true) && !(G.user.autoTrainUntil >= G.date);
        if (stopHere) { G.trainingDue = true; stop = "training"; break; }
        doTraining(G, rng, (G.user.autoTrainUntil >= G.date && G.user.autoEffort) || G.settings?.autoEffort || "Normal", false, true);
      }
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
const keyOf = (f, id) => (f.youth ? "Y:" : "") + id;
function processDay(G, rng) {
  intlDay(G, rng);
  const u = userP(G);
  const uc = u.club;
  const ul = G.clubs[uc]?.league;
  const today = [];
  for (const L of Object.values(G.leagues)) for (const f of L.fixtures) if (f.d === G.date && !f.res) today.push([L, f]);
  for (const c of Object.values(G.comps)) if (c.state === "run") for (const f of c.fixtures) if (f.d === G.date && !f.res) today.push([c, f]);
  const busy = new Set();
  let userFix = null;
  for (const [src, f] of today) {
    // a club can't play twice on the same day: the later game moves to tomorrow
    if (busy.has(keyOf(f, f.h)) || busy.has(keyOf(f, f.a))) { f.d++; continue; }
    busy.add(keyOf(f, f.h)); busy.add(keyOf(f, f.a));
    const mine = !G.user.retired && (f.h === uc || f.a === uc) && (f.youth ? u.squad === "Y" : true);
    if (mine && !userFix) { userFix = { src, f }; continue; }
    playFixture(G, rng, src, f, src === G.leagues[ul]);
  }
  if (userFix) {
    const { src, f } = userFix;
    const youth = !!f.youth;
    const prospect = !youth && ageOn(u.birth, G.date) <= 21 && u.squad === "A" && rng.chance(0.35 + (u.favour ? 0.3 : 0)) ? u : null;
    const key = youth ? (src.kind ? src.id : "u19") : statKey(src);
    const H = pickTeam(G, f.h, rng, { youth, comp: key, prospect: f.h === uc ? prospect : null });
    const Aw = pickTeam(G, f.a, rng, { youth, comp: key, prospect: f.a === uc ? prospect : null });
    const mine = f.h === uc ? H : Aw;
    const role = mine.xi.some(p => p.id === u.id) ? "XI" : mine.bench.some(p => p.id === u.id) ? "Cadangan" : null;
    const isLeague = !!G.leagues[src.id] && src.fixtures === G.leagues[src.id].fixtures;
    if (role && !u.away && !u.injury) {
      const stage = !isLeague && src.stages?.[f.st];
      const compName = isLeague ? src.name : `${src.name}${stage ? " · " + (stage.type === "ko" ? stage.name + (stage.legs === 2 ? ` (leg ${f.leg})` : "") : stage.type === "groups" ? `Grup ${String.fromCharCode(65 + f.g)}` : stage.names ? stage.names[f.g] : "Fase Liga") : ""}`;
      G.pending = { kind: isLeague ? "liga" : "comp", league: isLeague ? src.id : null, cid: isLeague ? null : src.id, fid: f.id, home: ids(H), away: ids(Aw), role, comp: compName, round: isLeague ? f.r : null, youth, neutral: !!f.neutral };
      return;
    }
    playFixture(G, rng, src, f, true, H, Aw);
    if (!youth) {
      trackMinutes(G, 0);
      if (u.squad === "A" && !u.injury && !u.away && !banned(u, key)) G.user.notPicked = (G.user.notPicked || 0) + 1;
    }
  }
  // pre-season friendlies of the user's club
  if (!G.pending && !userFix && G.friendly && G.friendly.club === uc) {
    for (const f of G.friendly.fixtures) {
      if (f.d !== G.date || f.res) continue;
      const youth = !!f.youth;
      const H = pickTeam(G, f.h, rng, { youth, comp: "friendly" }), Aw = pickTeam(G, f.a, rng, { youth, comp: "friendly" });
      const mine = f.h === uc ? H : Aw;
      const role = mine.xi.some(p => p.id === u.id) ? "XI" : mine.bench.some(p => p.id === u.id) ? "Cadangan" : null;
      if (role && !u.away && !u.injury && !G.pending) { G.pending = { kind: "friendly", fid: f.id, home: ids(H), away: ids(Aw), role, comp: youth ? "Laga Persahabatan U-19" : "Laga Persahabatan", youth }; break; }
      playFriendly(G, rng, f, H, Aw);
    }
  }
  const youthFriendly = G.friendly?.fixtures.some(f => f.d === G.date && f.youth);
  // U-19 match on Saturdays for academy players (when there is no youth competition game)
  if (!G.pending && !userFix && !youthFriendly && u.squad === "Y" && !u.injury && !u.away && isYouthDay(G.date) && G.leagues[ul]) {
    const club = userClub(G);
    const opp = rng.pick(G.leagues[club.league].teams.filter(id => id !== club.id && G.clubs[id].youthSquad.length >= 11));
    if (opp) {
      const home = rng.chance(0.5);
      const H = pickTeam(G, home ? club.id : opp, rng, { youth: true });
      const Aw = pickTeam(G, home ? opp : club.id, rng, { youth: true });
      const mine = home ? H : Aw;
      const role = mine.xi.some(p => p.id === u.id) ? "XI" : mine.bench.some(p => p.id === u.id) ? "Cadangan" : null;
      if (role) G.pending = { kind: "u19", home: ids(H), away: ids(Aw), role, comp: "Liga U-19", youth: true };
    }
  }
  const cm = campMatchToday(G);
  if (!G.pending && cm) {
    if (u.injury) cm.done = true;
    else G.pending = { kind: "timnas", match: cm, comp: cm.comp, role: "?" };
  }
  if (!G.pending) compsAfterDay(G, rng);
}
function isYouthDay(n) {
  const { m, d, wd } = ymd(n);
  if (wd !== 6) return false;
  if (m === 6 || m === 7 || (m === 8 && d < 22) || (m === 5 && d > 24)) return false;
  return !inIntlWindow(n);
}

// src: a league (G.leagues[x]) or a competition (G.comps[x])
const statKey = src => (src.kind ? (src.kind === "po" ? "liga" : src.id) : "liga");
function playFixture(G, rng, src, f, full, H, Aw) {
  const k0 = f.youth ? null : statKey(src);
  H = H || pickTeam(G, f.h, rng, { youth: !!f.youth, comp: k0 });
  Aw = Aw || pickTeam(G, f.a, rng, { youth: !!f.youth, comp: k0 });
  const res = full && !f.youth ? simulateMatch(rng, H, Aw) : quickSim(rng, H, Aw);
  applyFixture(G, rng, src, f, H, Aw, res);
  return res;
}
function applyFixture(G, rng, src, f, H, Aw, res) {
  f.res = res.score.slice();
  f.pom = res.pom;
  const u = userP(G);
  const touchesUser = f.h === u.club || f.a === u.club;
  if (touchesUser || full_(res)) f.sc = res.events.filter(e => e.type === "goal").map(e => [e.side, e.pid, e.min]);
  const key = f.youth ? (src.kind ? src.id : "u19") : statKey(src);
  for (const [id, line] of Object.entries(res.players)) {
    const p = G.players[id];
    applyLine(G, rng, p, line, key, p?.isUser);
    if (p && +id === res.pom && key === "liga") p.st.pom++;
  }
  if (!f.youth) for (const t of [H, Aw]) for (const pid of G.clubs[t.club]?.squad || []) { const p = G.players[pid]; if (p && p.bans?.[key] > 0 && !res.players[pid]) p.bans[key]--; }
  if (src.kind && f.tie != null) afterTieFixture(G, rng, src, f);
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

// the player's mindset from the team talk nudges his attributes for this match only
const MINDSET_ATTRS = { Termotivasi: { wor: 1.5, agg: 1.5, sta: 0.5 }, Fokus: { cmp: 1.5, dec: 1, cnt: 1 }, Santai: { fla: 1.5, vis: 0.5, cmp: 0.5 } };
function withMind(G, u, fn) {
  const MIND = MINDSET_ATTRS[G.pending?.mind];
  if (!MIND) return fn();
  const keep = u.a.slice();
  for (const [k, v] of Object.entries(MIND)) u.a[A[k]] = Math.min(20, u.a[A[k]] + v);
  try { return fn(); } finally { u.a = keep; }
}
export function playPending(G, record) {
  const rng = rngOf(G);
  const pd = G.pending; if (!pd) return null;
  const u = userP(G);
  const { H, A: Aw } = pendingTeams(G);
  const res = withMind(G, u, () => simulateMatch(rng, H, Aw, { record: true }));
  return finishPending(G, rng, H, Aw, res, record);
}
// Interactive match: the screen steps the engine and answers the user's key moments.
export function startLiveMatch(G) {
  const rng = rngOf(G);
  const pd = G.pending; if (!pd) return null;
  const u = userP(G);
  const { H, A: Aw } = pendingTeams(G);
  const rate = G.settings?.moments || "normal";
  const interactive = rate !== "mati" && ["XI", "Cadangan"].includes(pd.role);
  const sink = { frames: [], events: [], shots: [] };
  const gen = matchGen(rng, H, Aw, { record: true, interactive, userId: u.id, momentRate: rate, sink });
  const info = {};
  [H, Aw].forEach((t, side) => [...t.xi, ...t.bench].forEach(p => (info[p.id] = { name: shortName(p), full: fullName(p), num: numOf(G, p.id, t), side, user: !!p.isUser })));
  const shortOf = t => G.clubs[t.club]?.short || (t.nat ? t.nat : t.name.slice(0, 3).toUpperCase());
  const lineups = [H, Aw].map(t => { const f = FORMATIONS[t.formation] || FORMATIONS["4-3-3"]; return { formation: t.formation, start: t.xi.map((p, i) => ({ id: p.id, pos: f[i][0], sx: f[i][1], sy: f[i][2], name: shortName(p), no: numOf(G, p.id, t) })) }; });
  const ctx = { rng, H, Aw, gen, moment: null, res: null, interactive, R: { frames: sink.frames, events: sink.events, shots: sink.shots, lineups, info, colors: [teamColors(G, H), teamColors(G, Aw)], names: [H.name, Aw.name], short: [shortOf(H), shortOf(Aw)], lines: [], live: true } };
  stepLive(G, ctx, undefined);
  return ctx;
}
// advance the engine to the next key moment (or the final whistle); choice answers the previous moment
export function stepLive(G, ctx, choice) {
  const u = userP(G);
  const r = withMind(G, u, () => ctx.gen.next(choice));
  if (r.done) { ctx.res = r.value; ctx.moment = null; }
  else ctx.moment = r.value;
  return r;
}
// finish a live match: answer the remaining moments automatically, then apply the result
export function endLiveMatch(G, ctx) {
  while (!ctx.res) stepLive(G, ctx, null);
  return finishPending(G, ctx.rng, ctx.H, ctx.Aw, ctx.res, true);
}
function finishPending(G, rng, H, Aw, res, record) {
  const pd = G.pending, u = userP(G);
  let comp = pd.comp, fx = null, src = null;
  if (pd.kind === "liga" || pd.kind === "comp") {
    src = pd.kind === "liga" ? G.leagues[pd.league] : G.comps[pd.cid];
    fx = src.fixtures.find(x => x.id === pd.fid);
    applyFixture(G, rng, src, fx, H, Aw, res);
    if (!pd.youth) { const ln = res.players[u.id]; const mineSide = H.club === u.club ? 0 : 1; if (ln || pd.role === "Cadangan") payMatchBonus(G, ln, res.score[1 - mineSide] === 0); }
    if (!pd.youth) trackMinutes(G, res.players[u.id]?.min || 0);
    else trackMinutes(G, res.players[u.id]?.min || 0);
    // other games of the day were already played
  } else if (pd.kind === "friendly") {
    fx = G.friendly.fixtures.find(x => x.id === pd.fid);
    playFriendly(G, rng, fx, H, Aw, res);
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
    score: fx ? fx.res.slice() : res.score, teams: res.teams, pom: res.pom, pomName: nameOf(res.pom),
    aet: !!fx?.aet, pensScore: fx?.pens || null, agg: fx && fx.tie != null && fx.leg === 2 ? aggOf(src, fx) : null,
    events: res.events.map(e => ({ ...e, name: e.pid ? nameOf(e.pid) : "", astId: e.ast, ast: e.ast ? nameOf(e.ast) : null, offId: e.off, off: e.off ? nameOf(e.off) : null })),
    lines: Object.entries(res.players).map(([id, l]) => ({ id: +id, name: nameOf(id), ...l })).sort((a, b) => a.side - b.side || (b.start - a.start) || 0),
    user: res.players[u.id] || null, pens: pd.match?.pens || (fx?.pens ? (penWin(fx, u.club) ? "menang adu penalti" : "kalah adu penalti") : null),
    ...matchCharts(res),
    lineups: res.lineups.map((l, side) => ({ formation: l.formation, start: l.start.map(s => ({ ...s, name: nameOf(s.id), no: numOf(G, s.id, [H, Aw][side]) })) })),
    venue: pd.kind === "timnas" ? "" : pd.kind === "u19" || pd.youth ? "Lapangan Akademi" : pd.neutral ? "Stadion netral" : `Kandang ${H.name}`,
    pre: pd.kind === "friendly",
    homeShort: shortOfTeam(G, H), awayShort: shortOfTeam(G, Aw),
    benches: [H, Aw].map(t => t.bench.map(p => ({ id: p.id, name: shortName(p), no: numOf(G, p.id, t), pos: p.main }))),
    managers: [H, Aw].map(t => managerOf(G, t)),
    decisions: res.decisions || [],
  };
  summary.shots.forEach(sh => (sh.name = nameOf(sh.pid)));
  const myLine = summary.user;
  if (myLine) {
    const mySide = myLine.side;
    (G.user.matchLog = G.user.matchLog || []).unshift({ date: G.date, comp, opp: mySide === 0 ? Aw.name : H.name, ha: mySide === 0 ? "K" : "T", score: mySide === 0 ? res.score : [res.score[1], res.score[0]], rating: myLine.rating, min: myLine.min, gls: myLine.gls, ast: myLine.ast, pom: res.pom === u.id });
    if (G.user.matchLog.length > 30) G.user.matchLog.length = 30;
  }
  if ((pd.kind === "liga" || pd.kind === "comp") && !pd.youth) matchReport(G, summary, H, Aw);
  G.lastMatch = summary;
  if ((pd.kind === "liga" || pd.kind === "comp") && !pd.youth && summary.user) {
    const r = summary.user.rating;
    let debut = false;
    if (!G.user.debutClub || G.user.debutClub.club !== u.club) { debut = true; G.user.debutClub = { club: u.club, date: G.date }; addMail(G, "Debut!", `Kamu melakoni debut untuk ${userClub(G).name} melawan ${u.club === H.club ? Aw.name : H.name} (${summary.user.min} menit, rating ${r.toFixed(1)}).`, "good"); }
    const me = summary.user, side = me.side, gf = res.score[side], ga = res.score[1 - side];
    maybePress(G, rng, { opp: side === 0 ? Aw.name : H.name, gls: me.gls, pom: res.pom === u.id, rc: me.rc > 0, debut, final: /Final/.test(comp || "") && !/Semifinal|Perempat/.test(comp || ""), start: me.start, sub: !me.start, won: gf > ga, lost: gf < ga, ntPossible: ageOn(u.birth, G.date) >= 17 });
  }
  // running career totals (all competitive and friendly matches the player appeared in)
  if (summary.user && pd.kind !== "friendly") {
    const me = summary.user, side = me.side, gf = res.score[side], ga = res.score[1 - side];
    const add = t => { t.apps++; t.min += me.min; t.gls += me.gls; t.ast += me.ast; t.pom += res.pom === u.id ? 1 : 0; t.gf += gf; t.ga += ga; if (gf > ga) t.w++; else if (gf < ga) t.l++; else t.d++; t.rsum += me.rating; };
    const blank = () => ({ apps: 0, min: 0, gls: 0, ast: 0, pom: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0, rsum: 0 });
    const T = G.user.totals || (G.user.totals = { all: blank(), club: {}, nt: blank() });
    add(T.all);
    if (pd.kind === "timnas") add(T.nt); else add(T.club[u.club] || (T.club[u.club] = blank()));
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
  compsAfterDay(G, rng);
  G.rs = rng.s;
  return { summary, replay };
}
function aggOf(c, f) {
  const S = c.stages[f.st], tie = S.ties[f.tie];
  return tie.agg ? (f.h === tie.a ? tie.agg : [tie.agg[1], tie.agg[0]]) : null;
}
function penWin(f, club) { return f.h === club ? f.pens[0] > f.pens[1] : f.pens[1] > f.pens[0]; }

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
const MAJOR = new Set(["ENG1", "ESP1", "ITA1", "GER1", "FRA1", "IDN1"]);
export function seasonPreviews(G, rng, leagues = Object.values(G.leagues)) {
  const u = userP(G);
  for (const L of leagues) {
    const mine = G.clubs[u.club]?.league === L.id;
    if (!mine && !MAJOR.has(L.id)) continue;
    const ranked = L.teams.slice().sort((a, b) => G.clubs[b].level - G.clubs[a].level);
    const picks = new Set(mine ? [ranked[0], ranked[1], rng.pick(ranked.slice(4)), u.club] : [ranked[0]]);
    for (const id of picks) {
      const c = G.clubs[id], rank = ranked.indexOf(id) + 1, n = ranked.length;
      const band = rank <= 2 ? "top" : rank <= 6 ? "euro" : rank <= n - 4 ? "mid" : "low";
      addNews(G, {
        title: `Pratinjau Musim ${c.short === c.name ? c.name : c.name.replace(/^(FC|AC|AS|RC|CA|SC|RCD|UD|CF|AJ|OGC|LOSC|SV|VfL|VfB|TSG|1\. FC|1\. FSV|FC)\s/, "")}: ${rng.pick(PREVIEW[band])}`,
        body: `${c.name} diprediksi finis di posisi ke-${rank} ${L.name} ${leagueSeasonLabel(L)}. ${band === "top" ? "Skuad mereka dianggap salah satu yang terkuat di liga." : band === "euro" ? "Mereka punya modal untuk bersaing di papan atas." : band === "mid" ? "Target realistisnya finis di papan tengah." : "Bertahan di liga akan menjadi prioritas utama."}`,
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
  if (m === 1 && d === 1) newYear(G, rng);
  if (m === 3 && d === 15) youthIntake(G, rng);
  if ((m === 9 && d === 1) || (m === 2 && d === 1)) addNews(G, { title: "Jendela transfer resmi ditutup", tag: "Transfer", scope: "transfer" });
  if ((m === 7 && d === 1) || (m === 1 && d === 1)) addNews(G, { title: "Jendela transfer dibuka", tag: "Transfer", scope: "transfer" });
}

function weekly(G, rng) {
  const u = userP(G);
  if (!G.user.retired) {
    developPlayer(G, rng, u, 1, playShare(G), 1 + clamp(G.user.trainBoost || 0, -0.25, 0.35));
    const trained = G.user.trainedWeek || 0;
    G.user.trainBoost = 0; G.user.trainedWeek = 0;
    // training injuries (only when the daily sessions were not played out)
    const inten = { Rendah: 0.6, Normal: 1, Tinggi: 1.6 }[G.user.training.intensity] || 1;
    if (!trained && !u.injury && rng.chance(0.006 * inten * (0.6 + u.hid.inj / 20) * (G.user.difficulty === "Keras" ? 1.3 : 1))) {
      const days = rng.int(3, 18);
      u.injury = { name: "Cedera ringan saat latihan", days, total: days };
      addMail(G, "Cedera di latihan", `Kamu cedera ringan saat latihan dan absen sekitar ${days} hari.`, "bad", { cat: "Cedera" });
      G.user.injuries.push({ date: G.date, name: u.injury.name, days });
    }
    if (G.user.training.intensity === "Tinggi") u.cond = Math.max(60, u.cond - 4);
    if (!trained) trainingRating(G, rng);
    payWeek(G); weeklyResidency(G);
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
  if (!G.user.retired) { monthlyReport(G); monthlyCareer(G, rng); checkPromise(G); }
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
// strength-based single game used for play-offs that are not played out in full
function quickWinner(G, rng, a, b) {
  const H = pickTeam(G, a, rng), Aw = pickTeam(G, b, rng);
  const r = quickSim(rng, H, Aw).score;
  if (r[0] !== r[1]) return r[0] > r[1] ? a : b;
  return rng.chance(0.5 + (G.clubs[a].level - G.clubs[b].level) * 0.004) ? a : b;
}
// make sure a league season is complete (late postponements, unfinished play-offs)
function forceFinish(G, rng, L) {
  for (const f of L.fixtures) if (!f.res) playFixture(G, rng, L, f, false);
  if (L.state === "run") compsAfterDay(G, rng);
  const po = G.comps[L.id + "PO"];
  for (let guard = 0; guard < 8 && L.state === "po" && po && po.state === "run"; guard++) {
    for (const f of po.fixtures) if (!f.res) playFixture(G, rng, po, f, false);
    compsAfterDay(G, rng);
  }
}
function forceFinishComp(G, rng, c) {
  for (let guard = 0; guard < 12 && c.state === "run"; guard++) {
    for (const f of c.fixtures) if (!f.res) playFixture(G, rng, c, f, false);
    compsAfterDay(G, rng);
  }
}
function endSeason(G, rng) {
  for (const L of Object.values(G.leagues)) if (L.cal === "aug" && L.state !== "done") forceFinish(G, rng, L);
  const awards = seasonAwards(G);
  const lgBefore = userClub(G).league, tierBefore = G.leagues[lgBefore]?.tier || 3;
  promotions(G, rng, (a, b) => quickWinner(G, rng, a, b));
  contractAfterPromotion(G, tierBefore);
  const u = userP(G);
  if (!G.user.retired) userSeasonEnd(G, awards);
  if (G.user.loan) endLoan(G);
  if (G.user.outOfPyramid && !G.user.retired) escapePyramid(G, rng);
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
    if (club.ext) { refreshExternal(G, rng, club); continue; }
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

// relegation/promotion clauses in the user's contract
function contractAfterPromotion(G, tierBefore) {
  const u = userP(G), c = u.contract; if (!c || c.youth || G.user.retired) return;
  const tierNow = G.leagues[userClub(G).league]?.tier || 3;
  if (tierNow > tierBefore) {
    if (c.relegCut) { c.wage = Math.round(c.wage * (1 - c.relegCut / 100) / 50) * 50; addMail(G, "Gaji turun karena degradasi", `Sesuai klausul kontrak, gajimu turun ${c.relegCut}% menjadi ${W(c.wage)}/pekan.`, "bad", { cat: "Kontrak" }); }
    if (c.relegRelease) decision(G, "Klausul pelepasan degradasi", "Klubmu terdegradasi. Kontrakmu punya klausul yang membolehkanmu pergi secara gratis.", [
      { label: "Aktifkan klausul", detail: "Cari klub baru sebagai pemain bebas.", act: "relegRelease" },
      { label: "Bertahan", detail: "Bantu klub kembali naik.", act: "none" },
    ], "transfer");
  } else if (tierNow < tierBefore && c.promoRaise) {
    c.wage = Math.round(c.wage * (1 + c.promoRaise / 100) / 50) * 50;
    addMail(G, "Gaji naik karena promosi", `Sesuai klausul kontrak, gajimu naik ${c.promoRaise}% menjadi ${W(c.wage)}/pekan.`, "good", { cat: "Kontrak" });
  }
}
// external clubs (continental opponents) are not simulated week to week: refresh ages and quality yearly
function refreshExternal(G, rng, club) {
  for (const pid of [...club.squad]) {
    const p = G.players[pid]; if (!p || p.isUser) continue;
    if (ageOn(p.birth, G.date) >= 34 || rng.chance(0.12)) { club.squad = club.squad.filter(id => id !== pid); delete G.players[pid]; }
  }
  const shape = ["GK","DC","DC","DR","DL","DM","MC","MC","AMR","AML","AMC","ST","ST","GK","DC","MC","ST","DR","DL","MC","AMR","GK"];
  for (const pos of shape) { if (club.squad.length >= 22) break; club.squad.push(genSenior(G, rng, club, pos, club.level - 4 + rng.normal(0, 6)).id); }
  for (const pid of [...club.youthSquad]) { const p = G.players[pid]; if (p && !p.isUser && ageOn(p.birth, G.date) >= 19) { club.youthSquad = club.youthSquad.filter(id => id !== pid); delete G.players[pid]; } }
}
// the user's club dropped below the simulated divisions: clubs come in for him
function escapePyramid(G, rng) {
  const p = userP(G), age = ageOn(p.birth, G.date);
  const old = G.clubs[G.user.outOfPyramid.club];
  G.user.outOfPyramid = null;
  const cands = Object.values(G.clubs).filter(c => c.id !== old.id && G.leagues[c.league] && c.level <= p.ca + 14 && c.level >= p.ca - 25 && fifaU18Allowed(p.nat2 === c.nation ? p.nat2 : p.nat, age, c.nation).ok && clubNatOK(c, p.nat));
  const picks = rng.shuffle(cands).slice(0, 8).sort((a, b) => b.level - a.level).slice(0, 3);
  if (!picks.length) return;
  decision(G, "Klubmu turun kasta", `${old.name} turun ke divisi yang tidak dimainkan di gim ini. Beberapa klub siap merekrutmu secara gratis:`, picks.map(c => {
    const wage = Math.round(fairWage(p, c.league) * rng.float(0.95, 1.15) / 50) * 50;
    return { label: c.name, detail: `${G.leagues[c.league].name} · 3 tahun · ${W(wage)}/pekan`, act: "freeAgent", data: { to: c.id, wage, years: 3 } };
  }), "transfer");
}
function newSeason(G, rng) {
  G.season = seasonOf(G.date);
  G.blocked = cupWeekends(G.season);
  for (const c of Object.values(G.comps)) if (c.state === "run" && c.cal !== "year" && c.kind !== "po") forceFinishComp(G, rng, c);
  const aug = Object.values(G.leagues).filter(L => L.cal === "aug");
  for (const L of aug) makeFixtures(G, rng, L, G.season);
  const arg = Object.values(G.leagues).filter(L => L.cal === "half");
  for (const L of arg) { if (L.state !== "done") forceFinish(G, rng, L); makeFixtures(G, rng, L, G.season, "Clausura"); }
  setupSeasonComps(G, rng, G.season);
  // a new season wipes cup/continental yellow cards; a carried-over league ban stays (max one game)
  for (const p of Object.values(G.players)) { if (p.ycs) p.ycs = { liga: p.ycs.liga || 0 }; if (p.bans) p.bans = { liga: Math.min(p.bans.liga || 0, 1) }; }
  G.user.renewOffered = false;
  for (const c of Object.values(G.clubs)) c.injCount = 0;
  // annual raise clause, new season's earnings
  const uc = userP(G).contract;
  if (uc && uc.raise && !uc.youth && uc.start && G.date - uc.start > 300) { uc.wage = Math.round(uc.wage * (1 + uc.raise / 100) / 50) * 50; addMail(G, "Kenaikan gaji tahunan", `Gajimu naik ${uc.raise}% menjadi ${W(uc.wage)}/pekan sesuai kontrak.`, "good", { cat: "Kontrak" }); }
  if (G.user.money) G.user.money.season = 0, G.user.money.bonus = 0;
  setupFriendlies(G, rng);
  seasonPreviews(G, rng, [...aug, ...arg]);
  const L = G.leagues[userClub(G).league];
  addMail(G, `Musim ${seasonLabel(G.season)} dimulai`, `${L ? `Jadwal ${L.name} ${leagueSeasonLabel(L)} sudah keluar.` : ""} Statusmu di skuad: ${squadStatus(G)}.`, "info");
}
// calendar-year leagues and competitions (Brazil, MLS, Argentina's Apertura, Libertadores, cups)
function newYear(G, rng) {
  const y = ymd(G.date).y;
  for (const c of Object.values(G.comps)) if (c.state === "run" && c.cal === "year" && c.kind !== "po") forceFinishComp(G, rng, c);
  const yl = Object.values(G.leagues).filter(L => L.cal !== "aug");
  for (const L of yl) {
    if (L.state !== "done") forceFinish(G, rng, L);
    makeFixtures(G, rng, L, y, L.cal === "half" ? "Apertura" : undefined);
  }
  setupYearComps(G, rng, y);
  seasonPreviews(G, rng, yl);
  const L = G.leagues[userClub(G).league];
  if (L && L.cal !== "aug") addMail(G, `${L.name} ${leagueSeasonLabel(L)}`, `Jadwal ${L.name} ${leagueSeasonLabel(L)} sudah keluar. Laga pertama ${fmt(Math.min(...L.fixtures.map(f => f.d)))}.`, "info");
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
