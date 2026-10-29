// World creation, squads, fixtures, selection, and the day-by-day simulation loop.
import { RNG, clamp } from "./rng.js";
import { NATIONS, LEAGUES, CLUBS, SECOND_TIER } from "./data.js";
import { A, ATTRS, PHYSICAL_DECLINE, WEIGHTS, N_ATTR, abilityFor } from "./attributes.js";
import { genPlayer, refreshCA, slotRating, newStats, marketValue, fairWage, fullName } from "./player.js";
import { FORMATIONS, simulateMatch } from "./match.js";
import { day, ymd, ageOn, seasonOf, nextWeekday, fmt } from "./calendar.js";

export const VERSION = 1;

const DOMESTIC = { ENG1: 0.38, ESP1: 0.6, ITA1: 0.42, GER1: 0.5, FRA1: 0.55, IDN1: 0.8 };
const FOREIGN_W = { BRA: 3, ARG: 2.5, FRA: 3, ESP: 2, POR: 2, NED: 2, BEL: 1.5, GER: 1.5, ITA: 1, ENG: 1, CRO: 1, DEN: 1.2, URU: 1, COL: 1, MAR: 1.5, SEN: 1.5, CIV: 1.2, NGA: 1.2, JPN: 1, KOR: 0.8, USA: 0.8, IDN: 0.05 };
const FOREIGN_W_IDN = { BRA: 4, ARG: 2, JPN: 1.5, KOR: 1.5, NED: 1.5, ESP: 1, POR: 1, CRO: 0.6, NGA: 0.6, URU: 0.5, COL: 0.5 };
const SQUAD_SHAPE = ["GK","GK","GK","DC","DC","DC","DC","DR","DR","DL","DL","DM","DM","MC","MC","MC","MC","AMR","MR","AML","ML","AMC","ST","ST","ST"];
const YOUTH_SHAPE = ["GK","GK","DC","DC","DC","DR","DL","DM","MC","MC","MC","AMR","AML","AMC","ST","ST"];

export const leagueNation = id => (LEAGUES.find(l => l.id === id) || {}).nation;
export const clubNation = (G, cid) => leagueNation(G.clubs[cid].league) || (G.clubs[cid].nation);

export function birthForAge(rng, age, onDay) {
  const { y } = ymd(onDay);
  // random birthday such that age on `onDay` equals `age`
  const start = day(y - age - 1, 7, 2), end = day(y - age, 7, 1);
  return rng.int(start, end);
}

function pickNation(rng, leagueId, youth) {
  const dom = leagueNation(leagueId);
  const share = youth ? (leagueId === "IDN1" ? 1 : 0.9) : DOMESTIC[leagueId] ?? 0.6;
  if (rng.chance(share)) return dom;
  const W = leagueId === "IDN1" ? FOREIGN_W_IDN : FOREIGN_W;
  const keys = Object.keys(W).filter(k => k !== dom);
  return rng.weighted(keys, k => W[k]);
}

function newPlayerId(G) { return G.nextId++; }

export function genSenior(G, rng, club, pos, ca, nat) {
  const age = clamp(Math.round(rng.normal(26, 4)), 18, 35);
  const birth = birthForAge(rng, age, G.date);
  let gap = age < 21 ? rng.normal(28, 15) : age < 24 ? rng.normal(12, 8) : age < 27 ? rng.normal(4, 4) : 0;
  const p = genPlayer(rng, { id: newPlayerId(G), nat: nat || pickNation(rng, club.league), pos, ca: clamp(Math.round(ca), 20, 195), pa: clamp(Math.round(ca + Math.max(0, gap)), 20, 200), birth, club: club.id, squad: "A", today: G.date });
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
  const p = genPlayer(rng, { id: newPlayerId(G), nat: nat || pickNation(rng, club.league, true), pos, ca, pa: clamp(Math.round(ca + Math.max(8, gap)), 30, 200), birth, club: club.id, squad: "Y", today: G.date });
  p.contract = { end: seasonOf(G.date) + 2, wage: 0, youth: true };
  G.players[p.id] = p;
  return p;
}

export const clubNatOK = (club, nat) => club.policy !== "basque" || nat === "ESP";
function buildClub(G, rng, c) {
  const club = { ...c, colors: [...c.colors], squad: [], youthSquad: [], formation: rng.pick(["4-3-3", "4-2-3-1", "4-2-3-1", "4-4-2", "4-3-3"]), nation: leagueNation(c.league) || c.nation };
  if (club.id === "ath") club.policy = "basque";
  G.clubs[club.id] = club;
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
  YOUTH_SHAPE.forEach(pos => club.youthSquad.push(genYouth(G, rng, club, pos, rng.int(15, 18), nat()).id));
  return club;
}

// ---------- fixtures ----------
function roundRobin(teams, rng) {
  const t = rng.shuffle([...teams]);
  if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i], b = t[n - 1 - i];
      if (a && b) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop());
  }
  const second = rounds.map(rd => rd.map(([a, b]) => [b, a]));
  return [...rounds, ...second];
}
export const INTL_WINDOWS = [[9, 4], [10, 9], [11, 13], [3, 23], [6, 5]]; // [month, start day]
function isBreakWeek(n) {
  const { m, d } = ymd(n);
  return INTL_WINDOWS.some(([wm, wd]) => m === wm && d >= wd && d <= wd + 6);
}
export function makeFixtures(G, rng, league, season) {
  const rounds = roundRobin(league.teams, rng);
  let d = nextWeekday(day(season, 8, 15), 6);
  const end = day(season + 1, 5, 24);
  const sats = [];
  for (let x = d; x <= end; x += 7) if (!isBreakWeek(x)) sats.push(x);
  const dates = [];
  if (sats.length >= rounds.length) {
    for (let i = 0; i < rounds.length; i++) dates.push(sats[Math.round(i * (sats.length - 1) / (rounds.length - 1))]);
  } else {
    const need = rounds.length - sats.length;
    const mids = [];
    for (let i = 0; i < need; i++) mids.push(sats[Math.round((i + 1) * sats.length / (need + 1))] - 3);
    dates.push(...[...sats, ...mids].sort((a, b) => a - b));
  }
  league.fixtures = [];
  rounds.forEach((rd, r) => rd.forEach(([h, a]) => {
    const off = ymd(dates[r]).wd === 6 && rng.chance(0.3) ? 1 : 0; // some Sunday games
    league.fixtures.push({ r: r + 1, d: dates[r] + off, h, a, res: null, id: `${league.id}-${season}-${r + 1}-${h}` });
  }));
  league.season = season;
}

// ---------- selection ----------
export function available(G, pid, date) {
  const p = G.players[pid];
  return p && !p.retired && !p.injury && !(p.ban > 0);
}
export function pickTeam(G, clubId, rng, opts = {}) {
  const club = G.clubs[clubId];
  const pool = (opts.youth ? club.youthSquad : club.squad).filter(id => available(G, id)).map(id => G.players[id]);
  if (!opts.youth && pool.length < 16) pool.push(...club.youthSquad.map(id => G.players[id]).filter(p => !p.injury && !(p.ban > 0)).sort((a, b) => b.ca - a.ca).slice(0, 16 - pool.length));
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
export const CITY = {
  IDN: { makassar: "psm", bandung: "prb", jakarta: "prj", surabaya: "prs", denpasar: "bal", gianyar: "bal", singaraja: "bal", bali: "bal", malang: "are", samarinda: "bfc", solo: "prsl", surakarta: "prsl", kediri: "prk", tangerang: "prt", padang: "smp", yogyakarta: "psim", jogja: "psim", jepara: "prjp", biak: "psb", jayapura: "psb", pamekasan: "mad", madura: "mad", ternate: "mal", bekasi: "bhy", tangsel: "dew" },
  ESP: { madrid: "rma", barcelona: "bar", bilbao: "ath", sevilla: "sev", valencia: "val", "san sebastián": "rso", "san sebastian": "rso", vigo: "cel", girona: "gir", pamplona: "osa", villarreal: "vil", getafe: "get", oviedo: "ovi", elche: "elc", palma: "mll", vitoria: "ala" },
  ENG: { london: "ars", manchester: "mci", liverpool: "liv", birmingham: "avl", newcastle: "new", leeds: "lee", brighton: "bha", nottingham: "nfo", sunderland: "sun", wolverhampton: "wol", bournemouth: "bou", burnley: "bur" },
  ITA: { milano: "mil", milan: "int", torino: "juv", turin: "juv", roma: "rom", rome: "rom", napoli: "nap", naples: "nap", bergamo: "ata", bologna: "bol", firenze: "fio", genova: "gen", como: "com", parma: "par", udine: "udi" },
  GER: { münchen: "fcb", munich: "fcb", dortmund: "bvb", leipzig: "rbl", leverkusen: "b04", frankfurt: "sge", stuttgart: "vfb", freiburg: "scf", berlin: "fcu", hamburg: "hsv", köln: "koe", bremen: "svw", mainz: "m05", wolfsburg: "wob", augsburg: "fca" },
  FRA: { paris: "psg", marseille: "om", lyon: "oly", lille: "los", monaco: "asm", nice: "ogc", lens: "rcl", rennes: "srf", strasbourg: "rcs", nantes: "fcn", toulouse: "tfc", brest: "sb2", metz: "fcm", lorient: "fcl", auxerre: "aja", angers: "sco", "le havre": "hac" },
};

export function fifaU18Allowed(nat, age, clubNat) {
  if (age >= 18 || nat === clubNat) return { ok: true };
  if (age >= 16 && NATIONS[nat]?.eu && NATIONS[clubNat]?.eu) return { ok: true, note: "Pengecualian FIFA: transfer di dalam UE/EEE untuk usia 16–17." };
  return { ok: false, note: "Aturan FIFA melarang transfer internasional pemain di bawah 18 tahun (kecuali pengecualian sah)." };
}

export function createWorld(f) {
  const seed = f.seed ?? (Math.random() * 2 ** 32) >>> 0;
  const rng = new RNG(seed);
  const start = day(2026, 7, 1);
  const G = {
    v: VERSION, seed, rs: 0, date: start, season: 2026, nextId: 1, players: {}, clubs: {}, leagues: {}, pools: {},
    user: null, inbox: [], news: [], intl: { nt: {} }, flags: [], lastMatch: null,
  };
  for (const L of LEAGUES) {
    G.leagues[L.id] = { ...L, teams: [], fixtures: [], history: [] };
  }
  for (const c of CLUBS) { buildClub(G, rng, c); G.leagues[c.league].teams.push(c.id); }
  for (const [lid, arr] of Object.entries(SECOND_TIER)) G.pools[lid] = arr.map(c => ({ ...c, nation: leagueNation(lid) }));
  for (const L of Object.values(G.leagues)) makeFixtures(G, rng, L, 2026);

  // ---- the user ----
  const nat = f.nat;
  const hard = f.difficulty === "Keras";
  let birth = f.birth ?? birthForAge(rng, clamp(+f.age || 16, 15, 18), start);
  let age = ageOn(birth, start);
  let clubId = f.club && f.club !== "acak" ? f.club : null;
  let note = null;
  const natsOf = cn => (f.nat2 === cn ? f.nat2 : nat);
  const domesticLeague = LEAGUES.find(l => l.nation === nat) || (f.nat2 && LEAGUES.find(l => l.nation === f.nat2));
  if (clubId) {
    const cn = G.clubs[clubId].nation;
    const chk = fifaU18Allowed(natsOf(cn), age, cn);
    if (!chk.ok) { note = chk.note + " Kariermu dimulai di usia 18."; birth = birthForAge(rng, 18, start); age = 18; }
    else if (chk.note) note = chk.note;
  } else {
    const city = (f.birthplace || "").trim().toLowerCase();
    if (domesticLeague) {
      clubId = CITY[domesticLeague.nation]?.[city];
      if (!clubId) {
        const teams = G.leagues[domesticLeague.id].teams;
        clubId = rng.weighted(teams, id => G.clubs[id].youth ** 2 / (hard ? G.clubs[id].level / 60 : 1));
      }
    } else {
      const euOK = NATIONS[nat]?.eu && age >= 16;
      if (!euOK && age < 18) { note = "Aturan FIFA melarang transfer internasional di bawah 18 tahun, jadi kariermu dimulai di usia 18."; birth = birthForAge(rng, 18, start); age = 18; }
      const leagues = euOK && age < 18 ? ["ESP1", "ITA1", "GER1", "FRA1"] : ["ESP1", "ITA1", "GER1", "FRA1", "ENG1"];
      const teams = leagues.flatMap(l => G.leagues[l].teams).filter(id => clubNatOK(G.clubs[id], nat));
      clubId = rng.weighted(teams, id => (hard ? 1 / G.clubs[id].level : 1) * G.clubs[id].youth);
    }
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
  addMail(G, "Selamat datang di akademi", `${club.name} resmi menerimamu${u.squad === "Y" ? " di tim U-19" : " di skuad senior"}. Staf pelatih akan memantau perkembanganmu setiap pekan. Musim 2026/27 dimulai pertengahan Agustus.${note ? "\n\n" + note : ""}${G.user.adapt ? `\n\nKamu belum bisa berbahasa ${G.user.adapt.lang}; beberapa bulan pertama mungkin terasa berat.` : ""}`, "info", { from: "Kepala Akademi", cat: "Klub" });
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
export const LANGS = { IDN: "Indonesia", ESP: "Spanyol", ENG: "Inggris", FRA: "Prancis", GER: "Jerman", ITA: "Italia", POR: "Portugis", NED: "Belanda", BEL: "Prancis", CRO: "Kroasia", DEN: "Denmark", BRA: "Portugis", ARG: "Spanyol", URU: "Spanyol", COL: "Spanyol", MAR: "Arab", SEN: "Prancis", CIV: "Prancis", NGA: "Inggris", JPN: "Jepang", KOR: "Korea", USA: "Inggris" };
export function needsLanguage(p, club) {
  const l = LANGS[club.nation];
  return l && !(p.langs || []).includes(l) ? l : null;
}

export function buildUser(rng, f, club, today, id) {
  const age = ageOn(f.birth, today);
  const hard = f.difficulty === "Keras";
  const pos = f.pos;
  const ca = clamp(Math.round(youthLevel(club, Math.min(age, 18)) + (age >= 18 ? 8 : 0) + (hard ? rng.normal(0, 9) : rng.float(4, 12))), 40, 140);
  let pa = hard ? rng.int(85, 200) : Math.round(clamp(rng.normal(168, 14), 140, 196));
  pa = Math.max(pa, ca + 10);
  const squad = age >= 18 && ca >= club.level - 25 ? "A" : "Y";
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
  u.pa = Math.max(u.pa, u.ca + 5);
  u.isUser = true;
  u.contract = age < 17 ? { end: seasonOf(today) + 1, wage: 0, youth: true } : { end: seasonOf(today) + 3, wage: Math.max(250, Math.round(fairWage(u, club.league) * 0.6 / 50) * 50) };
  return u;
}
export const newCompStats = () => ({ liga: newStats(), u19: newStats(), timnas: newStats() });

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
export function table(G, leagueId) {
  const L = G.leagues[leagueId];
  const rows = Object.fromEntries(L.teams.map(id => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] }]));
  for (const f of L.fixtures) {
    if (!f.res) continue;
    const [a, b] = f.res, h = rows[f.h], w = rows[f.a];
    if (!h || !w) continue;
    h.p++; w.p++; h.gf += a; h.ga += b; w.gf += b; w.ga += a;
    if (a > b) { h.w++; w.l++; h.pts += 3; h.form.push("M"); w.form.push("K"); }
    else if (a < b) { w.w++; h.l++; w.pts += 3; h.form.push("K"); w.form.push("M"); }
    else { h.d++; w.d++; h.pts++; w.pts++; h.form.push("S"); w.form.push("S"); }
  }
  return Object.values(rows).sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || G.clubs[x.id].name.localeCompare(G.clubs[y.id].name));
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
  if (isUser) add(G.user.cs[comp]);
  p.form.push(L.rating); if (p.form.length > 10) p.form.shift();
  p.cond = L.cond ?? clamp(p.cond - L.min * 0.12, 20, 100);
  p.sharp = clamp((p.sharp ?? 60) + L.min / 9, 0, 100);
  p.mins = (p.mins || 0) + L.min;
  if (L.rc) p.ban = (p.ban || 0) + rng.int(1, 3);
  if (comp === "liga" && L.yc) { p.ycCount = (p.ycCount || 0) + 1; if (p.ycCount % 5 === 0) p.ban = (p.ban || 0) + 1; }
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

export function developPlayer(G, rng, p, weeks = 1, playedShare = 0.5) {
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
  let g = gap > 0 ? r * Math.min(1.6, gap / 38) * prof * play * fac * intensity * noise * weeks : 0;
  if (p.injury && p.injury.days > 14) g *= 0.25;
  const focus = isUser ? FOCUS[G.user.training.focus] || {} : {};
  const w = WEIGHTS[p.main];
  const target = Math.min(g, Math.max(0, gap));
  const before = p.a.slice();
  if (target > 0) {
    let acc = 0, guard = 0;
    while (acc < target && guard++ < 400) {
      const i = rng.weighted(idxs, i => w[i] * (focus[KEYS[i]] || 1) * (20.4 - p.a[i]) * (age < 21 && PHYS.has(i) ? 1.6 : 1));
      if (p.a[i] >= 20) continue;
      const step = 0.05;
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
