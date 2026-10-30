// World creation, squads, fixtures, selection, and the day-by-day simulation loop.
import { RNG, clamp } from "./rng.js";
import { NATIONS, LEAGUES, CLUBS, EXTERNAL, POOLS } from "./data.js";
import { A, ATTRS, PHYSICAL_DECLINE, WEIGHTS, N_ATTR, abilityFor } from "./attributes.js";
import { genPlayer, refreshCA, slotRating, newStats, marketValue, fairWage, fullName } from "./player.js";
import { FORMATIONS, simulateMatch } from "./match.js";
import { day, ymd, ageOn, seasonOf, nextWeekday, fmt } from "./calendar.js";

export const VERSION = 2;

// share of home-grown players per league (seniors)
const DOMESTIC = { ENG1: 0.38, ENG2: 0.6, ESP1: 0.6, ESP2: 0.75, ITA1: 0.42, ITA2: 0.65, GER1: 0.5, GER2: 0.65, FRA1: 0.55, FRA2: 0.7, IDN1: 0.8, IDN2: 0.92, POR1: 0.45, NED1: 0.6, BEL1: 0.45, KSA1: 0.55, MAS1: 0.72, THA1: 0.78, JPN1: 0.88, BRA1: 0.85, USA1: 0.55, ARG1: 0.88, RSA1: 0.85, EGY1: 0.9, MAR1: 0.85, EXT: 0.72 };
const FOREIGN_W = { BRA: 3, ARG: 2.5, FRA: 3, ESP: 2, POR: 2, NED: 2, BEL: 1.5, GER: 1.5, ITA: 1, ENG: 1, CRO: 1, DEN: 1.2, URU: 1, COL: 1, MAR: 1.5, SEN: 1.5, CIV: 1.2, NGA: 1.2, JPN: 1, KOR: 0.8, USA: 0.8, SRB: 0.8, GHA: 0.8, CMR: 0.7, IDN: 0.05 };
const FOREIGN_W_ASIA = { BRA: 4, ARG: 2, JPN: 1.5, KOR: 1.5, NED: 1.5, ESP: 1, POR: 1, AUS: 1, CRO: 0.6, NGA: 0.6, URU: 0.5, COL: 0.5 };
const FOREIGN_W_ARAB = { BRA: 4, POR: 2, FRA: 2, ESP: 1.5, MAR: 2, ALG: 1.2, SEN: 1.5, CIV: 1, COL: 1, ARG: 1.5, CRO: 0.8, SRB: 0.8, EGY: 0.6, TUN: 0.8 };
const FOREIGN_W_AMER = { ARG: 3, COL: 3, URU: 2, VEN: 1.5, PAR: 1.5, BRA: 1.5, ECU: 1.5, CHI: 1, MEX: 1, CAN: 1, ENG: 1, GER: 0.8, ESP: 0.8, JAM: 0.6, PER: 0.6 };
const FOREIGN_W_AFR = { NGA: 2, GHA: 2, ZWE: 2, ZMB: 2, COD: 2, MWI: 1, MOZ: 1, CMR: 1, CIV: 1, MLI: 1, SEN: 1, BRA: 0.5, TUN: 0.8, ALG: 0.8 };
const FOREIGN_BY = { IDN: FOREIGN_W_ASIA, MAS: FOREIGN_W_ASIA, THA: FOREIGN_W_ASIA, JPN: FOREIGN_W_ASIA, BRN: FOREIGN_W_ASIA, KSA: FOREIGN_W_ARAB, EGY: FOREIGN_W_ARAB, MAR: FOREIGN_W_ARAB, USA: FOREIGN_W_AMER, BRA: FOREIGN_W_AMER, ARG: FOREIGN_W_AMER, ZAF: FOREIGN_W_AFR };
// clubs based in another country than their league
const NATION_OVERRIDE = { dpm: "BRN", tfct: "CAN", mtl: "CAN", van: "CAN" };
// academy size: big leagues keep full U-19 squads, smaller leagues a core group (keeps saves small)
const BIG = new Set(["ENG1", "ESP1", "ITA1", "GER1", "FRA1", "IDN1"]);
const SQUAD_SHAPE = ["GK","GK","GK","DC","DC","DC","DC","DR","DR","DL","DL","DM","DM","MC","MC","MC","MC","AMR","MR","AML","ML","AMC","ST","ST","ST"];
const YOUTH_SHAPE = ["GK","GK","DC","DC","DC","DR","DL","DM","MC","MC","MC","AMR","AML","AMC","ST","ST"];

export const leagueNation = id => (LEAGUES.find(l => l.id === id) || {}).nation || (POOLS[id] ? leagueNation(POOLS[id]) : undefined);
export const clubNation = (G, cid) => G.clubs[cid].nation || leagueNation(G.clubs[cid].league);
export const activeLeague = (G, c) => !!(c && G.leagues[c.league]);

export function birthForAge(rng, age, onDay) {
  const { y } = ymd(onDay);
  // random birthday such that age on `onDay` equals `age`
  const start = day(y - age - 1, 7, 2), end = day(y - age, 7, 1);
  return rng.int(start, end);
}

function pickNation(rng, club, youth) {
  const dom = club.nation || leagueNation(club.league);
  const share = youth ? (["IDN", "JPN", "BRA", "ARG", "EGY"].includes(dom) ? 1 : 0.9) : DOMESTIC[club.league] ?? 0.65;
  if (rng.chance(share)) return dom;
  const W = FOREIGN_BY[dom] || FOREIGN_W;
  const keys = Object.keys(W).filter(k => k !== dom && NATIONS[k]);
  return rng.weighted(keys, k => W[k]);
}

function newPlayerId(G) { return G.nextId++; }

export function genSenior(G, rng, club, pos, ca, nat) {
  const age = clamp(Math.round(rng.normal(26, 4)), 18, 35);
  const birth = birthForAge(rng, age, G.date);
  let gap = age < 21 ? rng.normal(28, 15) : age < 24 ? rng.normal(12, 8) : age < 27 ? rng.normal(4, 4) : 0;
  const p = genPlayer(rng, { id: newPlayerId(G), nat: nat || pickNation(rng, club), pos, ca: clamp(Math.round(ca), 20, 195), pa: clamp(Math.round(ca + Math.max(0, gap)), 20, 200), birth, club: club.id, squad: "A", today: G.date });
  p.contract = { end: seasonOf(G.date) + rng.int(1, 4), wage: fairWage(p, club.league) };
  G.players[p.id] = p;
  return p;
}

export const youthLevel = (club, age) => club.level * (0.42 + (age - 15) * 0.06) + club.youth * 1.2 + 4;
export function genYouth(G, rng, club, pos, age, nat) {
  const birth = birthForAge(rng, age, G.date);
  const lv = club.level, yq = club.youth;
  const ca = clamp(Math.round(youthLevel(club, age) + rng.normal(0, 9)), 25, 150);
  let gap = rng.normal(40 + yq, 22);
  if (rng.chance(0.012 * yq / 10)) gap += rng.float(30, 60); // wonderkid
  const p = genPlayer(rng, { id: newPlayerId(G), nat: nat || pickNation(rng, club, true), pos, ca, pa: clamp(Math.round(ca + Math.max(8, gap)), 30, 200), birth, club: club.id, squad: "Y", today: G.date });
  p.contract = { end: seasonOf(G.date) + 2, wage: 0, youth: true };
  G.players[p.id] = p;
  return p;
}

export const clubNatOK = (club, nat) => club.policy !== "basque" || nat === "ESP";
export function youthSize(club) { return club.ext ? 0 : BIG.has(club.league) ? 16 : 10; }
export function buildClub(G, rng, c, squadOnly = false) {
  const club = { ...c, colors: [...c.colors], squad: [], youthSquad: [], formation: rng.pick(["4-3-3", "4-2-3-1", "4-2-3-1", "4-4-2", "4-3-3"]), nation: NATION_OVERRIDE[c.id] || c.nation || leagueNation(c.league) };
  if (club.id === "ath") club.policy = "basque";
  G.clubs[club.id] = club;
  if (squadOnly) return club;
  fillSquad(G, rng, club);
  return club;
}
// (re)generate a full squad; used at creation and when a pool club is promoted
export function fillSquad(G, rng, club) {
  for (const id of [...club.squad, ...club.youthSquad]) if (!G.players[id]?.isUser) delete G.players[id];
  club.squad = club.squad.filter(id => G.players[id]?.isUser); club.youthSquad = club.youthSquad.filter(id => G.players[id]?.isUser);
  const nat = () => (club.policy === "basque" ? "ESP" : undefined);
  // first XI from the formation, then depth for every position
  const starters = FORMATIONS[club.formation].map(f => f[0]);
  const depth = [...SQUAD_SHAPE];
  for (const pos of starters) { const i = depth.indexOf(pos); if (i >= 0) depth.splice(i, 1); else depth.pop(); }
  for (const pos of starters) club.squad.push(genSenior(G, rng, club, pos, club.level + rng.normal(1, 5), nat()).id);
  depth.forEach((pos, i) => {
    const ca = pos === "GK" && depth.indexOf("GK") !== i ? club.level - 26 + rng.normal(0, 6) : club.level - 7 + rng.normal(0, 5);
    club.squad.push(genSenior(G, rng, club, pos, ca, nat()).id);
  });
  YOUTH_SHAPE.slice(0, youthSize(club)).forEach(pos => club.youthSquad.push(genYouth(G, rng, club, pos, rng.int(15, 18), nat()).id));
  return club;
}
// external clubs get an U-19 side only when they enter a youth competition
export function ensureYouth(G, rng, club) {
  if (club.youthSquad.length >= 14) return;
  YOUTH_SHAPE.forEach(pos => club.youthSquad.push(genYouth(G, rng, club, pos, rng.int(16, 18)).id));
}

// ---------- fixtures ----------
// round robin: `legs` meetings between every pair (home/away alternating)
export function roundRobin(teams, rng, legs = 2) {
  const t = rng.shuffle([...teams]);
  if (t.length % 2) t.push(null);
  const n = t.length, base = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    base.push(pairs);
    t.splice(1, 0, t.pop());
  }
  const out = [];
  for (let k = 0; k < legs; k++) out.push(...base.map(rd => rd.map(([a, b]) => (k % 2 ? [b, a] : [a, b]))));
  return out;
}
// International windows (FIFA calendar from 2026): [month, first day, length in days, matches]
export const INTL_WINDOWS = [[9, 21, 16, 4], [11, 9, 9, 2], [3, 22, 9, 2], [6, 1, 9, 2]];
export function intlWindowAt(n) {
  const { y } = ymd(n);
  for (const [m, d, len, k] of INTL_WINDOWS) { const s0 = day(y, m, d); if (n >= s0 && n < s0 + len) return { start: s0, len, n: k }; }
  return null;
}
export const inIntlWindow = n => !!intlWindowAt(n);
const isBreakWeek = n => inIntlWindow(n) || inIntlWindow(n + 1);

// first/last matchday of a league season
export function seasonSpan(L, season, phase) {
  if (L.cal === "aug") return [day(season, ...L.start), day(season + 1, ...L.end)];
  if (L.cal === "year") return [day(season, ...L.start), day(season, ...L.end)];
  return phase === "Apertura" ? [day(season, 1, 23), day(season, 5, 17)] : [day(season, ...L.start), day(season, ...L.end)];
}
export function leagueRounds(G, rng, L) {
  if (!L.zones) return roundRobin(L.teams, rng, L.rounds || 2);
  const Z = L.zones.map((_, z) => L.teams.filter(id => G.clubs[id].zone === z));
  const rr = Z.map(t => roundRobin(t, rng, L.rounds || 2));
  const rounds = rr[0].map((r, i) => [...r, ...(rr[1][i] || [])]);
  const a = rng.shuffle([...Z[0]]), b = rng.shuffle([...Z[1]]);
  for (let k = 0; k < (L.cross || 0); k++) rounds.push(a.map((x, i) => (k % 2 ? [b[(i + k) % b.length], x] : [x, b[(i + k) % b.length]])));
  return rounds;
}
export function makeFixtures(G, rng, L, season, phase) {
  const rounds = leagueRounds(G, rng, L);
  const [first, last] = seasonSpan(L, season, phase);
  const blocked = new Set(G.blocked?.[L.nation] || []);
  const paused = n => (L.pause ? (() => { const { y } = ymd(n); return n >= day(y, ...L.pause[0]) && n <= day(y, ...L.pause[1]); })() : false);
  const ok = x => !isBreakWeek(x) && !paused(x) && !blocked.has(x) && !blocked.has(x + 1);
  const sats = [];
  for (let x = nextWeekday(first, 6); x <= last; x += 7) if (ok(x)) sats.push(x);
  const dates = [];
  if (sats.length >= rounds.length) {
    for (let i = 0; i < rounds.length; i++) dates.push(sats[Math.round(i * (sats.length - 1) / Math.max(1, rounds.length - 1))]);
  } else {
    const need = rounds.length - sats.length;
    const mids = [];
    for (let i = 0; i < need; i++) mids.push(sats[Math.min(sats.length - 1, Math.round((i + 1) * sats.length / (need + 1)))] - 3 - 7 * Math.floor(i / Math.max(1, sats.length)));
    dates.push(...[...sats, ...mids].sort((a, b) => a - b));
  }
  L.fixtures = [];
  const tag = phase ? phase[0] : "";
  rounds.forEach((rd, r) => rd.forEach(([h, a]) => {
    const off = ymd(dates[r]).wd === 6 && rng.chance(0.3) ? 1 : 0; // some Sunday games
    L.fixtures.push({ r: r + 1, d: dates[r] + off, h, a, res: null, id: `${L.id}-${season}${tag}-${r + 1}-${h}` });
  }));
  L.season = season; L.phase = phase || null; L.state = "run"; L.po = null;
  // league statistics start again with the new season
  for (const id of L.teams) for (const pid of G.clubs[id].squad) { const p = G.players[pid]; if (p) { p.st = newStats(); if (p.ycs) p.ycs.liga = 0; } }
}
export const leagueSeasonLabel = L => (L.cal === "aug" ? seasonLabelOf(L.season) : L.cal === "half" ? `${L.phase || "Clausura"} ${L.season}` : String(L.season));
const seasonLabelOf = s => `${s}/${String((s + 1) % 100).padStart(2, "0")}`;

// ---------- selection ----------
// suspensions are kept per competition: "liga", a cup/continental id, …
export const YC_LIMIT = key => (key === "liga" ? 5 : 3);
export const banned = (p, key = "liga") => (p.bans?.[key] || 0) > 0;
export const banTotal = p => Object.values(p.bans || {}).reduce((s, x) => s + x, 0);
export function available(G, pid, key = "liga") {
  const p = G.players[pid];
  return p && !p.retired && !p.injury && !banned(p, key);
}
export function pickTeam(G, clubId, rng, opts = {}) {
  const club = G.clubs[clubId];
  const key = opts.comp || "liga";
  const pool = (opts.youth ? club.youthSquad : club.squad).filter(id => available(G, id, key)).map(id => G.players[id]);
  if (!opts.youth && pool.length < 16) pool.push(...club.youthSquad.map(id => G.players[id]).filter(p => p && !p.injury && !banned(p, key)).sort((a, b) => b.ca - a.ca).slice(0, 16 - pool.length));
  const form = FORMATIONS[club.formation] || FORMATIONS["4-3-3"];
  const used = new Set();
  const xi = [];
  const val = (p, pos) => slotRating(p, pos) * (0.82 + 0.18 * (p.cond / 100)) * (1 + ((p.form.length ? avg(p.form.slice(-5)) : 6.8) - 6.8) * 0.02) * (1 + rng.normal(0, 0.025)) + (p.favour || 0);
  // fill slots: key slots first
  const order = form.map((s, i) => i).sort((a, b) => (form[a][0] === "GK" ? -1 : 0) - (form[b][0] === "GK" ? -1 : 0));
  for (const i of order) {
    const pos = form[i][0];
    let best = null, bv = -1;
    for (const p of pool) if (!used.has(p.id)) { const v = val(p, pos); if (v > bv) { bv = v; best = p; } }
    xi[i] = best; if (best) used.add(best.id);
  }
  const rest = pool.filter(p => !used.has(p.id)).sort((a, b) => b.ca - a.ca);
  const bench = [];
  const gkB = rest.find(p => p.main === "GK");
  if (gkB) bench.push(gkB);
  for (const p of rest) { if (bench.length >= 7) break; if (!bench.includes(p) && p.main !== "GK") bench.push(p); }
  // youngsters on the bench: managers give prospects a chance
  if (opts.prospect && !bench.includes(opts.prospect) && !xi.includes(opts.prospect) && pool.includes(opts.prospect)) bench[bench.length - 1] = opts.prospect;
  return { club: clubId, name: club.name, formation: club.formation, xi: xi.filter(Boolean), bench };
}
const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);

// ---------- quick sim (leagues the user isn't playing in) ----------
function poisson(rng, l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rng.next(); } while (p > L); return k - 1; }
const SCORE_W = { ST: 3.3, AMC: 3, AMR: 2.9, AML: 2.9, MR: 1.6, ML: 1.6, MC: 1.4, DM: 0.6, WBR: 0.8, WBL: 0.8, DR: 0.45, DL: 0.45, DC: 0.5, GK: 0.01 };
const AST_W = { AMC: 3.2, AMR: 3, AML: 3, MC: 2, MR: 2.2, ML: 2.2, ST: 2, WBR: 1.8, WBL: 1.8, DR: 1.2, DL: 1.2, DM: 1, DC: 0.4, GK: 0.05 };
export function quickSim(rng, H, Aw) {
  const form = t => FORMATIONS[t.formation] || FORMATIONS["4-3-3"];
  const str = t => avg(t.xi.map((p, i) => slotRating(p, form(t)[i][0])));
  const diff = str(H) + 3 - str(Aw);
  const g = [poisson(rng, 1.42 * Math.exp(diff / 41)), poisson(rng, 1.15 * Math.exp(-diff / 41))];
  const players = {};
  [H, Aw].forEach((t, side) => {
    const f = form(t);
    const lines = t.xi.map((p, i) => ({ p, pos: f[i][0], line: { side, pos: f[i][0], min: 90, start: true, gls: 0, ast: 0, yc: 0, rc: 0, conc: g[1 - side], injured: false, sav: 0 } }));
    // subs
    const nsub = rng.int(2, 5);
    const outs = rng.shuffle(lines.filter(l => l.pos !== "GK")).slice(0, Math.min(nsub, t.bench.length));
    outs.forEach((l, k) => {
      const sub = t.bench.filter(b => b.main !== "GK")[k];
      if (!sub) return;
      const m = rng.int(55, 85);
      l.line.min = m;
      lines.push({ p: sub, pos: l.pos, line: { side, pos: l.pos, min: 90 - m, start: false, gls: 0, ast: 0, yc: 0, rc: 0, conc: 0, injured: false, sav: 0 } });
    });
    for (let k = 0; k < g[side]; k++) {
      const sc = rng.weighted(lines, l => SCORE_W[l.pos] * (l.p.a[A.fin] + l.p.a[A.otb]) * l.line.min);
      sc.line.gls++;
      if (rng.chance(0.74)) {
        const as = rng.weighted(lines.filter(l => l !== sc), l => AST_W[l.pos] * (l.p.a[A.pas] + l.p.a[A.vis]) * l.line.min);
        if (as) as.line.ast++;
      }
    }
    const win = g[side] > g[1 - side], loss = g[side] < g[1 - side];
    const tavg = avg(t.xi.map(p => p.ca));
    for (const l of lines) {
      const L_ = l.line;
      if (rng.chance(0.075 * l.line.min / 90)) L_.yc = 1;
      if (rng.chance(0.004)) L_.rc = 1;
      if (rng.chance(0.012 * L_.min / 90 * (0.6 + l.p.hid.inj / 20))) L_.injured = true;
      if (l.pos === "GK") L_.sav = poisson(rng, 3);
      let r = 6.55 + rng.normal(0, 0.42) + L_.gls * 0.9 + L_.ast * 0.6 + (win ? 0.25 : loss ? -0.25 : 0) + (l.p.ca - tavg) / 45;
      if (["GK","DC","DR","DL","WBR","WBL"].includes(l.pos)) r += g[1 - side] === 0 ? 0.4 : -0.12 * g[1 - side];
      r -= L_.yc * 0.2 + L_.rc * 1.5;
      if (L_.min < 25) r = 6.5 + (r - 6.5) * L_.min / 25;
      L_.rating = clamp(Math.round(r * 10) / 10, 4, 10);
      L_.cond = Math.round(clamp(l.p.cond - L_.min * 0.13 * (1.45 - l.p.a[A.sta] / 20 * 0.9), 20, 100));
      players[l.p.id] = L_;
    }
  });
  let pom = null; for (const [id, l] of Object.entries(players)) if (!pom || l.rating > players[pom].rating) pom = id;
  return { score: g, players, pom: +pom, events: [], quick: true };
}

// ---------- world creation ----------
// home clubs for the "random" academy: Indonesian provinces → nearby clubs (top two tiers)
const PROV_CLUBS = {
  "Aceh": ["prsr"], "Sumatera Utara": ["psms"], "Sumatera Barat": ["smp"], "Riau": ["psps"], "Jambi": ["psps"], "Sumatera Selatan": ["ssu"], "Bengkulu": ["ssu"],
  "Lampung": ["bhy"], "Kepulauan Bangka Belitung": ["ssu"], "Kepulauan Riau": ["psps"], "Daerah Khusus Ibukota Jakarta": ["prj"], "Jawa Barat": ["prb", "bks", "pkd", "psgc"],
  "Jawa Tengah": ["jvu", "psis", "prjp", "prsl", "pku", "ktf"], "Daerah Istimewa Yogyakarta": ["psim", "pss"], "Jawa Timur": ["prs", "are", "prk", "mad", "prsla", "dlt", "dej"],
  "Banten": ["dew", "prt", "rns"], "Bali": ["bal"], "Nusa Tenggara Barat": ["bal"], "Nusa Tenggara Timur": ["bal"], "Kalimantan Barat": ["bfc"], "Kalimantan Tengah": ["isk"],
  "Kalimantan Selatan": ["bar2"], "Kalimantan Timur": ["bfc", "pba"], "Kalimantan Utara": ["bfc"], "Sulawesi Utara": ["psm"], "Sulawesi Tengah": ["psm"], "Sulawesi Selatan": ["psm"],
  "Sulawesi Tenggara": ["psm"], "Gorontalo": ["psm"], "Sulawesi Barat": ["psm"], "Maluku": ["psm"], "Maluku Utara": ["psm"], "Papua": ["ppr"], "Papua Barat": ["psb"],
  "Papua Selatan": ["ppr"], "Papua Tengah": ["psb"], "Papua Pegunungan": ["ppr"], "Papua Barat Daya": ["psb"],
};
export const CITY = {
  IDN: { "kota makassar": "psm", "kota bandung": "prb", bandung: "prb", "kota adm. jakarta pusat": "prj", "kota surabaya": "prs", "kota denpasar": "bal", gianyar: "bal", "kota malang": "are", malang: "are", "kota samarinda": "bfc", "kota surakarta": "prsl", "kota kediri": "prk", kediri: "prk", "kota tangerang": "prt", tangerang: "prt", "kota padang": "smp", "kota yogyakarta": "psim", sleman: "pss", jepara: "prjp", "biak numfor": "psb", "kota jayapura": "ppr", pamekasan: "mad", bangkalan: "mad", sampang: "mad", sumenep: "mad", "kota bekasi": "bks", "kota depok": "pkd", ciamis: "psgc", "kota medan": "psms", "kota pekanbaru": "psps", kudus: "pku", "kota banda aceh": "prsr", "kota semarang": "jvu", "kota banjarmasin": "bar2", lamongan: "prsla", "kota balikpapan": "pba", sidoarjo: "dlt", kendal: "ktf", "kota palembang": "ssu", "kota bandar lampung": "bhy", "kota palangka raya": "isk", "kota tangerang selatan": "dew", serang: "dew" },
  ESP: { madrid: "rma", barcelona: "bar", bilbao: "ath", sevilla: "sev", valencia: "val", "san sebastián": "rso", "san sebastian": "rso", vigo: "cel", pamplona: "osa", villarreal: "vil", getafe: "get", elche: "elc", vitoria: "ala", "a coruña": "dep", malaga: "mlg", "málaga": "mlg", santander: "rac" },
  ENG: { london: "ars", manchester: "mci", liverpool: "liv", birmingham: "avl", newcastle: "new", leeds: "lee", brighton: "bha", nottingham: "nfo", sunderland: "sun", bournemouth: "bou", coventry: "cov", hull: "hul", ipswich: "ips" },
  ITA: { milano: "mil", milan: "int", torino: "juv", turin: "juv", roma: "rom", rome: "rom", napoli: "nap", naples: "nap", bergamo: "ata", bologna: "bol", firenze: "fio", genova: "gen", como: "com", parma: "par", udine: "udi", frosinone: "fro", monza: "mon", venezia: "ven", lecce: "lec", cagliari: "cag" },
  GER: { "münchen": "fcb", munich: "fcb", dortmund: "bvb", leipzig: "rbl", leverkusen: "b04", frankfurt: "sge", stuttgart: "vfb", freiburg: "scf", berlin: "fcu", hamburg: "hsv", "köln": "koe", bremen: "svw", mainz: "m05", augsburg: "fca", gelsenkirchen: "s04", paderborn: "scp" },
  FRA: { paris: "psg", marseille: "om", lyon: "oly", lille: "los", monaco: "asm", nice: "ogc", lens: "rcl", rennes: "srf", strasbourg: "rcs", toulouse: "tfc", brest: "sb2", lorient: "fcl", auxerre: "aja", angers: "sco", "le havre": "hac", "le mans": "lms", troyes: "est" },
  POR: { lisboa: "slb", lisbon: "slb", porto: "fcp", braga: "brg", guimarães: "vsc" },
  NED: { amsterdam: "ajx", rotterdam: "fey", eindhoven: "psv", alkmaar: "az", enschede: "twe", utrecht: "utr" },
  BEL: { brussel: "rsca", bruxelles: "rsca", brugge: "cbr", genk: "krc", gent: "kaa", antwerpen: "ant", "liège": "sta" },
  KSA: { riyadh: "hil", jeddah: "itt", dammam: "ett" },
  JPN: { tokyo: "fct", osaka: "gam", kobe: "vis", yokohama: "yfm", kashima: "ksm", hiroshima: "san", kawasaki: "kaw", urawa: "ura", kyoto: "kyo", nagoya: "nag" },
  BRA: { "rio de janeiro": "fla", "são paulo": "pmr", "sao paulo": "pmr", "belo horizonte": "cru", "porto alegre": "gre", salvador: "bah", curitiba: "cap", santos: "sfc" },
  ARG: { "buenos aires": "carp", rosario: "rc", "la plata": "edlp", "córdoba": "tal", cordoba: "tal", avellaneda: "racc", mendoza: "irm" },
  USA: { "new york": "nyc", "los angeles": "lafc", miami: "mia", atlanta: "atl", seattle: "sea", columbus: "clb", philadelphia: "phi", dallas: "dal", houston: "hou" },
  MAS: { "johor bahru": "jdt", "kuala lumpur": "klc", "shah alam": "sel", kuching: "kch" },
  THA: { bangkok: "bgu", buriram: "brm", chonburi: "chb", ratchaburi: "rat" },
  ZAF: { johannesburg: "orp", soweto: "kc", pretoria: "mam", durban: "amz", "cape town": "ste" },
  EGY: { cairo: "ahly", kairo: "ahly", giza: "zam", alexandria: "iab" },
  MAR: { casablanca: "wac", rabat: "far", berkane: "rsb", "fès": "masf", fes: "masf" },
};

export function fifaU18Allowed(nat, age, clubNat) {
  if (age >= 18 || nat === clubNat) return { ok: true };
  if (age >= 16 && NATIONS[nat]?.eu && NATIONS[clubNat]?.eu) return { ok: true, note: "Pengecualian FIFA: transfer di dalam UE/EEE untuk usia 16–17." };
  return { ok: false, note: "Aturan FIFA melarang transfer internasional pemain di bawah 18 tahun (kecuali pengecualian sah)." };
}

export const START = day(2026, 7, 1);
export function createWorld(f) {
  const seed = f.seed ?? (Math.random() * 2 ** 32) >>> 0;
  const rng = new RNG(seed);
  const start = START;
  const G = {
    v: VERSION, seed, rs: 0, date: start, season: 2026, nextId: 1, players: {}, clubs: {}, leagues: {}, comps: {}, pools: {}, blocked: {},
    user: null, inbox: [], news: [], intl: { nt: {} }, flags: [], lastMatch: null,
    settings: { trainStop: true, currency: "IDR", textScale: 1, speed: 25 },
  };
  for (const L of LEAGUES) G.leagues[L.id] = { ...L, teams: [], fixtures: [], history: [] };
  for (const c of CLUBS) {
    if (G.leagues[c.league]) { buildClub(G, rng, c); G.leagues[c.league].teams.push(c.id); }
    else { buildClub(G, rng, c, true); (G.pools[c.league] = G.pools[c.league] || []).push(c.id); }
  }
  for (const c of EXTERNAL) buildClub(G, rng, c);

  // ---- the user ----
  const nat = f.nat;
  const hard = f.difficulty === "Keras";
  let birth = f.birth ?? birthForAge(rng, clamp(+f.age || 16, 15, 35), start);
  let age = ageOn(birth, start);
  if (age >= 19) { const band = POTENTIAL[f.potential] || POTENTIAL.Berbakat; f = { ...f, estCA: (band.pa[0] + band.pa[1]) / 2 * AGE_CURVE(age) }; }
  let clubId = f.club && f.club !== "acak" ? f.club : null;
  let note = null;
  const natsOf = cn => (f.nat2 === cn ? f.nat2 : nat);
  const bc = f.bcountry || nat;
  const homeNation = [bc, nat, f.nat2].find(n => n && LEAGUES.some(l => l.nation === n && l.tier === 1));
  if (clubId) {
    const cn = G.clubs[clubId].nation;
    const chk = fifaU18Allowed(natsOf(cn), age, cn);
    if (!chk.ok) { note = chk.note + " Kariermu dimulai di usia 18."; birth = birthForAge(rng, 18, start); age = 18; }
    else if (chk.note) note = chk.note;
  } else if (homeNation) {
    const city = (f.birthplace || "").trim().toLowerCase();
    const inLg = id => G.clubs[id] && G.leagues[G.clubs[id].league];
    clubId = CITY[homeNation]?.[city] || CITY[homeNation]?.[city.replace(/^kota /, "")];
    if (!clubId && homeNation === "IDN" && f.bprov) {
      const near = (PROV_CLUBS[f.bprov] || []).filter(inLg);
      if (near.length) clubId = rng.weighted(near, id => G.clubs[id].level);
    }
    if (!clubId || !inLg(clubId)) {
      if (age >= 19) {
        const teams = LEAGUES.filter(l => l.nation === homeNation).flatMap(l => G.leagues[l.id].teams);
        clubId = rng.weighted(teams, id => 1 / (4 + Math.abs(G.clubs[id].level - (f.estCA || 100))));
      } else {
        const teams = LEAGUES.filter(l => l.nation === homeNation && l.tier === 1).flatMap(l => G.leagues[l.id].teams);
        clubId = rng.weighted(teams, id => G.clubs[id].youth ** 2 / (hard ? G.clubs[id].level / 60 : 1));
      }
    }
  } else {
    const euOK = NATIONS[nat]?.eu && age >= 16;
    if (!euOK && age < 18) { note = "Aturan FIFA melarang transfer internasional di bawah 18 tahun, jadi kariermu dimulai di usia 18."; birth = birthForAge(rng, 18, start); age = 18; }
    const leagues = euOK && age < 18 ? ["ESP1", "ITA1", "GER1", "FRA1", "POR1", "NED1", "BEL1"] : ["ESP1", "ITA1", "GER1", "FRA1", "ENG1", "POR1", "NED1", "BEL1"];
    const teams = (age >= 19 ? Object.keys(G.leagues) : leagues).flatMap(l => G.leagues[l].teams).filter(id => clubNatOK(G.clubs[id], nat));
    clubId = age >= 19 ? rng.weighted(teams, id => 1 / (4 + Math.abs(G.clubs[id].level - (f.estCA || 100)))) : rng.weighted(teams, id => (hard ? 1 / G.clubs[id].level : 1) * G.clubs[id].youth);
  }
  const club = G.clubs[clubId];
  const u = buildUser(rng, { ...f, birth }, club, start, newPlayerId(G));
  G.players[u.id] = u;
  (u.squad === "A" ? club.squad : club.youthSquad).push(u.id);
  G.user = {
    pid: u.id, difficulty: hard ? "Keras" : "Normal", history: [], trophies: [], awards: [], int: { apps: 0, gls: 0, ast: 0, youth: {}, senior: [] },
    training: { focus: "Seimbang", intensity: "Normal", role: null }, cs: newCompStats(), minutes8: [], promises: [], loan: null, listed: false, debut: null, startDate: start, retired: false,
    fed: nat, styles: f.styles || [], traits: f.traits || [], trainRatings: [], injuries: [],
  };
  G.user.adapt = needsLanguage(u, club) ? { lang: needsLanguage(u, club), since: start } : null;
  const Lu = G.leagues[club.league];
  addMail(G, u.squad === "Y" ? "Selamat datang di akademi" : `Selamat datang di ${club.short}`, `${club.name} resmi menerimamu${u.squad === "Y" ? " di tim U-19" : " di skuad senior"}. Staf pelatih akan memantau perkembanganmu setiap pekan. ${Lu.name} ${Lu.cal === "aug" ? "musim 2026/27" : Lu.cal === "half" ? "Torneo Clausura 2026" : "2026"} ${Lu.cal === "aug" ? `dimulai ${fmt(day(2026, ...Lu.start))}` : "sedang berjalan"}.${note ? "\n\n" + note : ""}${G.user.adapt ? `\n\nKamu belum bisa berbahasa ${G.user.adapt.lang}; beberapa bulan pertama mungkin terasa berat.` : ""}`, "info", { from: u.squad === "Y" ? "Kepala Akademi" : "Direktur Olahraga", cat: "Klub" });
  if (note && /FIFA/.test(note)) G.flags.push("FIFA-18");
  G.rs = rng.s;
  return G;
}

// ---- player creation (shared by the world builder and the creation preview) ----
export const STYLES = {
  finisher: { label: "Penyelesai Klinis", desc: "Tenang di depan gawang dan tajam memanfaatkan peluang.", attrs: ["fin", "cmp", "otb", "ant"] },
  playmaker: { label: "Pengatur Serangan", desc: "Mengalirkan bola dan membuka pertahanan lewat umpan.", attrs: ["pas", "vis", "dec", "tec"] },
  dribbler: { label: "Penggiring Bola", desc: "Melewati lawan dengan bola lengket di kaki.", attrs: ["dri", "agi", "fla", "bal"] },
  creator: { label: "Kreator Sayap", desc: "Menyisir sisi lapangan dan mengirim umpan silang.", attrs: ["cro", "pac", "acc", "tec"] },
  engine: { label: "Mesin Lini Tengah", desc: "Berlari tanpa henti, membantu bertahan dan menyerang.", attrs: ["sta", "wor", "tea", "tck"] },
  wall: { label: "Tembok Pertahanan", desc: "Disiplin, kuat dalam duel, dan sulit dilewati.", attrs: ["mar", "tck", "pos", "cnt"] },
  aerial: { label: "Raja Udara", desc: "Mendominasi bola atas di kedua kotak penalti.", attrs: ["hea", "jum", "str", "bra"] },
  setpiece: { label: "Spesialis Bola Mati", desc: "Berbahaya dari tendangan bebas, pojok, dan penalti.", attrs: ["fre", "cor", "pen", "lon"] },
  athlete: { label: "Atlet", desc: "Cepat, kuat, dan cepat pulih setelah laga.", attrs: ["pac", "acc", "sta", "nat"] },
  shotstopper: { label: "Penghalau Tembakan", desc: "Refleks tajam dan tangkapan aman.", attrs: ["ref", "han", "aer", "pos"], gk: true },
  sweeperk: { label: "Kiper Modern", desc: "Aktif keluar sarang dan nyaman memainkan bola.", attrs: ["kic", "ovo", "rus", "fir"], gk: true },
};
export const TRAITS = {
  ambisius: { label: "Ambisius", desc: "Ingin bermain di level tertinggi dan cepat bosan dengan zona nyaman.", hid: { amb: [17, 20] }, attrs: { det: 2 } },
  profesional: { label: "Disiplin", desc: "Menjaga standar tinggi di latihan maupun di luar lapangan.", hid: { pro: [17, 20] }, attrs: { det: 1, wor: 1 } },
  tangguh: { label: "Tangguh", desc: "Bangkit dari kegagalan; tekanan justru membakar semangat.", hid: { pre: [16, 19] }, attrs: { det: 2, bra: 1 } },
  inspiratif: { label: "Inspiratif", desc: "Pemimpin alami yang mengangkat semangat rekan setim.", hid: {}, attrs: { ldr: 4, tea: 1 } },
  tenang: { label: "Tenang", desc: "Jarang emosi, pikiran tetap jernih di momen besar.", hid: { tem: [16, 19], pre: [14, 18] }, attrs: { cmp: 2 } },
  setia: { label: "Setia", desc: "Terikat kuat pada klub dan suporter yang membesarkannya.", hid: { loy: [17, 20] }, attrs: {} },
};
const WF = { Lemah: [4, 7], Sedang: [9, 12], Kuat: [14, 17] };
export const LANGS = Object.fromEntries(Object.entries(NATIONS).map(([k, v]) => [k, v.language]));
export function needsLanguage(p, club) {
  const l = LANGS[club.nation];
  return l && !(p.langs || []).includes(l) ? l : null;
}

// potential bands the player can pick when creating a career
export const POTENTIAL = {
  Biasa: { label: "Biasa", desc: "Pemain profesional biasa; puncaknya pemain solid di liga menengah.", pa: [100, 135] },
  Berbakat: { label: "Berbakat", desc: "Bisa menembus liga top bila berkembang dengan baik.", pa: [135, 162] },
  Wonderkid: { label: "Wonderkid", desc: "Bakat langka dengan peluang jadi bintang dunia.", pa: [165, 196] },
  Acak: { label: "Acak", desc: "Potensi dirahasiakan dan bisa sangat rendah atau sangat tinggi.", pa: [85, 200] },
};
// share of potential reached at each age for a player who started late
const AGE_CURVE = a => (a <= 18 ? 0 : a <= 24 ? 0.68 + (a - 19) * 0.05 : a <= 29 ? 0.95 : Math.max(0.78, 0.95 - (a - 29) * 0.025));
export function buildUser(rng, f, club, today, id) {
  const age = ageOn(f.birth, today);
  const pos = f.pos;
  const band = POTENTIAL[f.potential] || (f.difficulty === "Keras" ? POTENTIAL.Acak : POTENTIAL.Berbakat);
  let pa = rng.int(...band.pa);
  let ca;
  if (age <= 18) ca = clamp(Math.round(youthLevel(club, age) + rng.float(2, 10)), 40, 140);
  else ca = clamp(Math.round(pa * AGE_CURVE(age) + rng.normal(0, 4)), 45, 185);
  ca = Math.min(ca, pa - (age <= 18 ? 15 : age <= 23 ? 6 : 0));
  pa = Math.max(pa, ca + (age <= 23 ? 10 : 2));
  // every career up to age 18 starts in the U-19 academy
  const squad = age <= 18 ? "Y" : "A";
  const u = genPlayer(rng, { id, nat: f.nat, pos, ca, pa, birth: f.birth, club: club.id, squad, today, fn: f.fn, ln: f.ln, birthplace: f.birthplace });
  u.nat2 = f.nat2 && f.nat2 !== f.nat ? f.nat2 : null;
  u.nick = f.nick || "";
  u.langs = f.langs?.length ? [...new Set(f.langs)] : [LANGS[f.nat] || "Inggris"];
  u.look = f.look || null;
  if (f.foot && f.foot !== "Acak") u.foot = f.foot;
  if (f.wf && WF[f.wf]) u.wf = rng.int(...WF[f.wf]);
  if (u.foot === "Dua kaki") u.wf = Math.max(u.wf, 16);
  if (f.height) { u.height = clamp(+f.height, 150, 205); u.weight = Math.round(u.height - 105 + rng.normal(0, 3) - Math.max(0, 18 - age) * 2); }
  if (f.secondary) {
    for (const k of Object.keys(u.positions)) if (k !== pos) delete u.positions[k];
    for (const s2 of f.secondary.slice(0, 2)) if (s2 !== pos) u.positions[s2] = rng.int(14, 17);
  }
  // personality traits → hidden attributes
  for (const t of (f.traits || []).slice(0, 2)) {
    const T = TRAITS[t]; if (!T) continue;
    for (const [k, [a, b]] of Object.entries(T.hid)) u.hid[k] = rng.int(a, b);
    for (const [k, v] of Object.entries(T.attrs)) u.a[A[k]] = clamp(u.a[A[k]] + v, 1, 20);
  }
  // playing styles: fewer choices → stronger focus; overall ability is kept
  const st = (f.styles || []).filter(k => STYLES[k]).slice(0, 3);
  if (st.length) {
    const target = u.ca;
    const boost = { 1: 3, 2: 2, 3: 1.5 }[st.length];
    const boosted = new Set();
    for (const k of st) for (const a of STYLES[k].attrs) { u.a[A[a]] = clamp(u.a[A[a]] + boost, 1, 20); boosted.add(A[a]); }
    const w = WEIGHTS[pos];
    for (let guard = 0; guard < 400 && abilityFor(u.a, pos) > target; guard++) {
      const i = rng.weighted([...Array(N_ATTR).keys()].filter(i => !boosted.has(i) && w[i] > 0 && u.a[i] > 2), i => w[i] * u.a[i]);
      u.a[i] = Math.max(1, u.a[i] - 0.25);
    }
  }
  for (let i = 0; i < N_ATTR; i++) u.a[i] = Math.round(u.a[i] * 10) / 10;
  refreshCA(u);
  u.pa = Math.max(u.pa, u.ca + (age <= 23 ? 5 : 1));
  u.isUser = true;
  u.contract = age < 17 ? { end: seasonOf(today) + 1, wage: 0, youth: true } : { end: seasonOf(today) + (age <= 18 ? 2 : 3), wage: Math.max(250, Math.round(fairWage(u, club.league) * (age <= 18 ? 0.5 : 0.85) / 50) * 50), start: today };
  return u;
}
export const newCompStats = () => ({ liga: newStats(), u19: newStats(), timnas: newStats() });
export const compStats = (G, key) => G.user.cs[key] || (G.user.cs[key] = newStats());

export function addMail(G, title, body, kind = "info", extra = {}) {
  G.inbox.unshift({ id: (G.mailId = (G.mailId || 0) + 1), date: G.date, title, body, kind, read: false, ...extra });
  if (G.inbox.length > 80) G.inbox.length = 80;
}
// news: a string (headline only) or { title, body, tag, club, scope }
// scope: "me" (about the user/club), "world", "transfer"
export function addNews(G, n) {
  const item = typeof n === "string" ? { title: n } : n;
  G.news.unshift({ date: G.date, id: (G.newsId = (G.newsId || 0) + 1), scope: "world", tag: "Berita", ...item, text: item.title });
  if (G.news.length > 120) G.news.length = 120;
}

export const userP = G => G.players[G.user.pid];
export const userClub = G => G.clubs[userP(G).club];
export function leagueOfClub(G, cid) { return G.leagues[G.clubs[cid].league]; }

// ---------- standings ----------
// standings; `zone` filters a conference/zone, fixtures can be any list (league or group stage)
export function table(G, leagueId, zone = null) {
  const L = G.leagues[leagueId];
  const teams = zone == null ? L.teams : L.teams.filter(id => G.clubs[id].zone === zone);
  return standings(G, teams, L.fixtures);
}
export function standings(G, teams, fixtures) {
  const rows = Object.fromEntries(teams.map(id => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]));
  for (const f of fixtures) {
    if (!f.res || f.po || f.tie != null) continue;
    const [a, b] = f.res, h = rows[f.h], w = rows[f.a];
    if (!h || !w) continue;
    h.p++; w.p++; h.gf += a; h.ga += b; w.gf += b; w.ga += a;
    if (a > b) { h.w++; w.l++; h.pts += 3; h.form.push("M"); w.form.push("K"); }
    else if (a < b) { w.w++; h.l++; w.pts += 3; h.form.push("K"); w.form.push("M"); }
    else { h.d++; w.d++; h.pts++; w.pts++; h.form.push("S"); w.form.push("S"); }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || (G.clubs[x.id]?.name || x.id).localeCompare(G.clubs[y.id]?.name || y.id));
}

// ---------- applying match results to players ----------
const INJURIES = [["Memar paha", 3, 10, 30], ["Keseleo pergelangan kaki", 7, 21, 18], ["Cedera hamstring", 14, 35, 16], ["Cedera betis", 10, 28, 10], ["Cedera pangkal paha", 10, 30, 8], ["Cedera lutut ringan", 10, 25, 7], ["Gegar otak ringan", 7, 14, 3], ["Cedera bahu", 14, 42, 3], ["Patah tulang metatarsal", 42, 75, 3], ["Robek ligamen lutut (ACL)", 190, 280, 2]];
export function makeInjury(rng, p, hard) {
  const inj = rng.weighted(INJURIES, i => i[3]);
  let days = rng.int(inj[1], inj[2]);
  days = Math.round(days * (hard ? 1.15 : 1) * (1.15 - p.a[A.nat] / 20 * 0.3));
  return { name: inj[0], days, total: days };
}

export function applyLine(G, rng, p, L, comp, isUser) {
  if (!p) return;
  const st = comp === "liga" ? p.st : null;
  const add = s => {
    if (!s) return;
    if (L.start) s.apps++; else s.sub++;
    s.min += L.min; s.gls += L.gls || 0; s.ast += L.ast || 0; s.rsum += L.rating; s.rn++;
    s.yc += L.yc || 0; s.rc += L.rc || 0;
    if (L.pos === "GK" && L.conc === 0 && L.min >= 60) s.cs++;
  };
  add(st);
  if (isUser) add(compStats(G, comp));
  p.form.push(L.rating); if (p.form.length > 10) p.form.shift();
  p.cond = L.cond ?? clamp(p.cond - L.min * 0.12, 20, 100);
  p.sharp = clamp((p.sharp ?? 60) + L.min / 9, 0, 100);
  p.mins = (p.mins || 0) + L.min;
  if (!["timnas", "u19", "friendly"].includes(comp)) {
    p.bans = p.bans || {}; p.ycs = p.ycs || {};
    if (L.rc) p.bans[comp] = (p.bans[comp] || 0) + rng.int(1, 3);
    if (L.yc) { p.ycs[comp] = (p.ycs[comp] || 0) + 1; if (p.ycs[comp] % YC_LIMIT(comp) === 0) { p.bans[comp] = (p.bans[comp] || 0) + 1; if (isUser) addMail(G, "Akumulasi kartu kuning", `Kamu mendapat kartu kuning ke-${p.ycs[comp]} dan terkena skorsing satu laga.`, "bad", { cat: "Kompetisi" }); } }
    if (L.rc && isUser) addMail(G, "Kartu merah", `Kamu diusir wasit dan terkena skorsing ${p.bans[comp]} laga.`, "bad", { cat: "Kompetisi" });
  }
  if (L.injured && !p.injury) {
    p.injury = makeInjury(rng, p, G.user.difficulty === "Keras" && isUser);
    p.injury.since = G.date;
    if (G.clubs[p.club]) G.clubs[p.club].injCount = (G.clubs[p.club].injCount || 0) + 1;
    if (isUser) (G.user.injuries = G.user.injuries || []).push({ date: G.date, name: p.injury.name, days: p.injury.days });
    if (isUser) {
      addMail(G, "Cedera saat bertanding", `Kamu mengalami ${p.injury.name.toLowerCase()}. Tim medis memperkirakan absen sekitar ${weeksLabel(p.injury.days)}.`, "bad");
      if (p.injury.days > 150) { p.pa = Math.max(p.ca, p.pa - rng.int(2, 9)); }
    }
  }
}
export const weeksLabel = d => d < 10 ? `${d} hari` : d < 60 ? `${Math.round(d / 7)} pekan` : `${Math.round(d / 30)} bulan`;

// ---------- development ----------
const FOCUS = {
  Seimbang: {},
  Teknik: { dri: 1.8, fir: 1.8, tec: 1.8, pas: 1.4, cro: 1.3 },
  Penyelesaian: { fin: 2.2, cmp: 1.6, otb: 1.6, lon: 1.4, hea: 1.3 },
  Kreatif: { vis: 2, pas: 1.8, fla: 1.6, dec: 1.4, tec: 1.4 },
  Bertahan: { tck: 2, mar: 2, pos: 1.8, ant: 1.5, cnt: 1.5, hea: 1.3 },
  Fisik: { str: 2, sta: 2, pac: 1.6, acc: 1.6, agi: 1.5, jum: 1.5, nat: 1.4 },
  Mental: { dec: 2, cmp: 1.8, ant: 1.6, cnt: 1.6, tea: 1.5, wor: 1.4, ldr: 1.3 },
  "Bola Mati": { fre: 2.4, cor: 2.2, pen: 2.2, lth: 1.6, cro: 1.3 },
  Kiper: { ref: 1.8, han: 1.8, ovo: 1.6, aer: 1.6, cmd: 1.5, kic: 1.5, rus: 1.4 },
};
export const FOCUS_LIST = Object.keys(FOCUS);
const caFloat = (a, pos) => { const w = WEIGHTS[pos]; let s = 0; for (let i = 0; i < N_ATTR; i++) s += a[i] * w[i]; return (s / w.sum - 1) * 10.6; };

export function developPlayer(G, rng, p, weeks = 1, playedShare = 0.5, boost = 1) {
  const age = (G.date - p.birth) / 365.25;
  const club = G.clubs[p.club];
  const isUser = !!p.isUser;
  const hard = isUser && G.user.difficulty === "Keras";
  const caNow = caFloat(p.a, p.main);
  const gap = p.pa - caNow;
  let r = age < 17 ? 0.32 : age < 19 ? 0.28 : age < 21 ? 0.2 : age < 23 ? 0.12 : age < 25 ? 0.06 : age < 27 ? 0.025 : age < 29 ? 0.008 : 0;
  const prof = 0.65 + (p.hid.pro + p.a[A.det]) / 40 * 0.7;
  const playedWk = clamp(playedShare, 0, 1);
  const play = 0.7 + 0.55 * playedWk;
  const fac = club ? (age < 21 ? 0.85 + club.youth / 20 * 0.3 : 0.88 + club.level / 200 * 0.24) : 0.9;
  let intensity = 1;
  if (isUser) intensity = { Rendah: 0.85, Normal: 1, Tinggi: 1.15 }[G.user.training.intensity] || 1;
  const noise = Math.max(0, rng.normal(1, hard ? 0.45 : 0.3));
  let g = gap > 0 ? r * Math.min(1.6, gap / 38) * prof * play * fac * intensity * boost * noise * weeks : 0;
  if (p.injury && p.injury.days > 14) g *= 0.25;
  const focus = isUser ? FOCUS[G.user.training.focus] || {} : {};
  const w = WEIGHTS[p.main];
  const target = Math.min(g, Math.max(0, gap));
  const before = p.a.slice();
  if (target > 0) {
    // cumulative weights, refreshed every 25 picks (cheap enough for 20k players a month)
    let acc = 0, guard = 0, cdf = null, tot = 0;
    const step = 0.05;
    const build = () => {
      cdf = new Float64Array(N_ATTR); tot = 0;
      for (let i = 0; i < N_ATTR; i++) { tot += p.a[i] >= 20 ? 0 : w[i] * (focus[KEYS[i]] || 1) * (20.4 - p.a[i]) * (age < 21 && PHYS.has(i) ? 1.6 : 1); cdf[i] = tot; }
    };
    while (acc < target && guard < 400) {
      if (guard++ % 25 === 0) build();
      if (tot <= 0) break;
      const r = rng.next() * tot;
      let lo = 0, hi = N_ATTR - 1;
      while (lo < hi) { const mid = (lo + hi) >> 1; if (cdf[mid] < r) lo = mid + 1; else hi = mid; }
      const i = lo;
      if (p.a[i] >= 20) continue;
      p.a[i] = Math.min(20, p.a[i] + step);
      acc += 10.6 * w[i] * step / w.sum;
    }
  }
  // ageing
  if (age >= 29) {
    const nat = p.a[A.nat];
    const rate = (age - 28) * 0.0042 * (1.35 - nat / 20 * 0.6) * weeks * (hard ? 1.15 : 1);
    for (const i of PHYSICAL_DECLINE) p.a[i] = Math.max(1, p.a[i] - rate * rng.float(0.6, 1.4));
    if (age >= 32) for (const k of ["dri","fir","tec","fin","cro"]) p.a[A[k]] = Math.max(1, p.a[A[k]] - (age - 31) * 0.0018 * weeks * rng.float(0.5, 1.5));
  }
  if (age >= 23 && age < 34) for (const k of ["dec","cmp","ldr","pos","ant","tea"]) if (rng.chance(0.25)) p.a[A[k]] = Math.min(20, p.a[A[k]] + 0.012 * weeks);
  for (let i = 0; i < N_ATTR; i++) p.a[i] = Math.round(p.a[i] * 100) / 100;
  refreshCA(p);
  return before;
}
const KEYS = ATTRS.map(a => a[0]);
const idxs = Array.from({ length: N_ATTR }, (_, i) => i);
const PHYS = new Set(["str","sta","pac","acc","jum","agi","bal"].map(k => A[k]));

export { fullName, fmt };
