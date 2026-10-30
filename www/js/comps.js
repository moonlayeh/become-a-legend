// Competition engine: domestic cups, continental competitions (league phase / groups + knockout),
// youth competitions, league play-offs, league season lifecycle and qualification.
import { clamp } from "./rng.js";
import { NATIONS, LEAGUES, PROMO, POOL_DROP, RESERVES, POOLS, POOL_NAME as POOL_LABEL } from "./data.js";
import { CUPS, CONTINENTAL, PLAYOFFS, ROUND_NAME } from "./compdata.js";
import { day, ymd, seasonLabel, fmt } from "./calendar.js";
import {
  standings, table, addNews, addMail, ensureYouth, leagueSeasonLabel, makeFixtures, userP, fillSquad, compStats,
} from "./world.js";
import { posGroup } from "./career.js";
import { fullName } from "./player.js";

const seasonDay = (cal, season, [m, d]) => day(cal === "year" ? season : m >= 7 ? season : season + 1, m, d);
export const compLabel = c => (c.cal === "year" ? String(c.season) : c.phase ? `${c.phase} ${c.season}` : seasonLabel(c.season));
export const CONT_IDS = new Set(CONTINENTAL.map(d => d.id));
export const compDef = id => CUPS.find(d => d.id === id) || CONTINENTAL.find(d => d.id === id) || null;
const lv = (G, id, youth) => { const c = G.clubs[id]; if (!c) return 80; return youth ? c.level * 0.62 + c.youth * 1.6 : c.level; };
function pois(rng, l) { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rng.next(); } while (p > L); return k - 1; }

// ---------- building blocks ----------
function newComp(G, def, season, kind, extra = {}) {
  const old = G.comps[def.id];
  const c = {
    id: def.id, name: def.name, short: def.short, kind, color: def.color, nation: def.nation || null, conf: def.conf || null,
    cal: def.cal || "aug", season, youth: !!def.youth, stages: [], fixtures: [], state: "run", history: old?.history || [], teams: [], ki: 0, ...extra,
  };
  G.comps[def.id] = c;
  return c;
}
function addFix(c, st, d, h, a, extra = {}) {
  const f = { id: `${c.id}-${c.season}${c.phase ? c.phase[0] : ""}-${st}-${c.fixtures.length}`, d, h, a, res: null, st, comp: c.id, ...extra };
  if (c.youth) f.youth = true;
  c.fixtures.push(f);
  return c.fixtures.length - 1;
}
// pairs in `list` order: [0,1], [2,3], … ; the first of each pair is the higher seed
function koStage(c, list, name, legs, dates, neutralFinal = false) {
  const st = c.stages.length;
  const S = { name, type: "ko", legs, ties: [] };
  c.stages.push(S);
  for (let i = 0; i + 1 < list.length; i += 2) {
    const a = list[i], b = list[i + 1], ti = S.ties.length;
    const tie = { a, b, w: null, f: [] };
    if (legs === 2) { tie.f.push(addFix(c, st, dates[0], b, a, { tie: ti, leg: 1 })); tie.f.push(addFix(c, st, dates[1], a, b, { tie: ti, leg: 2 })); }
    else tie.f.push(addFix(c, st, dates[0], a, b, { tie: ti, leg: 1, ...(neutralFinal && name.includes("Final") && !name.includes("Wilayah") ? { neutral: true } : {}) }));
    S.ties.push(tie);
  }
  c.cur = st;
  return S;
}
function chunk(arr, n) { const k = Math.ceil(arr.length / n); return Array.from({ length: n }, (_, i) => arr.slice(i * k, i * k + k)); }

// Swiss-model draw: `md` rounds, no repeat opponents, no same-nation games, at most md/pots opponents per pot.
function swissDraw(G, rng, teams, pots, md) {
  const potOf = {}; pots.forEach((p, i) => p.forEach(id => (potOf[id] = i)));
  const maxPer = Math.max(1, Math.ceil(md / pots.length));
  const nat = id => G.clubs[id].nation;
  for (let attempt = 0; attempt < 400; attempt++) {
    const relaxNat = attempt > 150, relaxPot = attempt > 250;
    const opp = Object.fromEntries(teams.map(t => [t, new Set()]));
    const pc = Object.fromEntries(teams.map(t => [t, new Array(pots.length).fill(0)]));
    const homes = Object.fromEntries(teams.map(t => [t, 0]));
    const ok = (x, y) => x !== y && !opp[x].has(y) && (relaxNat || nat(x) !== nat(y)) && (relaxPot || (pc[x][potOf[y]] < maxPer && pc[y][potOf[x]] < maxPer));
    const rounds = [];
    let failed = false;
    for (let r = 0; r < md && !failed; r++) {
      let nodes = 0;
      const free = new Set(teams);
      const pairs = [];
      const solve = () => {
        if (!free.size) return true;
        if (++nodes > 4000) return false;
        let best = null, bestOpts = null;
        for (const t of free) {
          const o = [...free].filter(y => ok(t, y));
          if (!best || o.length < bestOpts.length) { best = t; bestOpts = o; if (!o.length) return false; }
        }
        for (const y of rng.shuffle(bestOpts)) {
          free.delete(best); free.delete(y); pairs.push([best, y]);
          if (solve()) return true;
          pairs.pop(); free.add(best); free.add(y);
        }
        return false;
      };
      if (teams.length % 2 || !solve()) { failed = true; break; }
      for (const [x, y] of pairs) { opp[x].add(y); opp[y].add(x); pc[x][potOf[y]]++; pc[y][potOf[x]]++; }
      rounds.push(pairs.map(([x, y]) => { const hx = homes[x] < homes[y] || (homes[x] === homes[y] && rng.chance(0.5)); if (hx) { homes[x]++; return [x, y]; } homes[y]++; return [y, x]; }));
    }
    if (!failed) return rounds;
  }
  // fallback: plain round-robin slices
  const t = rng.shuffle([...teams]); const out = [];
  for (let r = 0; r < md; r++) { const pairs = []; for (let i = 0; i < t.length / 2; i++) pairs.push([t[i], t[t.length - 1 - i]]); out.push(pairs); t.splice(1, 0, t.pop()); }
  return out;
}

// groups of equal size with one team from each pot, avoiding same-nation where possible
function drawGroups(G, rng, teams, nGroups) {
  const sorted = teams.slice().sort((a, b) => lv(G, b) - lv(G, a));
  const pots = chunk(sorted, sorted.length / nGroups);
  for (let attempt = 0; attempt < 200; attempt++) {
    const groups = Array.from({ length: nGroups }, () => []);
    let bad = false;
    for (const pot of pots) {
      for (const id of rng.shuffle(pot.slice())) {
        const cands = groups.map((g, i) => i).filter(i => groups[i].length < pots.indexOf(pot) + 1 && (attempt > 120 || !groups[i].some(x => G.clubs[x].nation === G.clubs[id].nation)));
        if (!cands.length) { bad = true; break; }
        groups[rng.pick(cands)].push(id);
      }
      if (bad) break;
    }
    if (!bad) return groups;
  }
  return chunk(rng.shuffle(teams.slice()), nGroups);
}
function rrPairs(rng, ids, legs) {
  const t = rng.shuffle(ids.slice()); if (t.length % 2) t.push(null);
  const n = t.length, rounds = [];
  for (let r = 0; r < n - 1; r++) { const p = []; for (let i = 0; i < n / 2; i++) { const a = t[i], b = t[n - 1 - i]; if (a && b) p.push(r % 2 ? [b, a] : [a, b]); } rounds.push(p); t.splice(1, 0, t.pop()); }
  return legs === 2 ? [...rounds, ...rounds.map(rd => rd.map(([a, b]) => [b, a]))] : rounds;
}

// ---------- domestic cups ----------
const tierOf = (G, id) => G.leagues[G.clubs[id].league]?.tier || 3;
function cupDates(def, season, R) {
  const ds = def.dates.map(md => seasonDay(def.cal || "aug", season, md));
  while (ds.length < R) ds.unshift(ds[0] - 28);
  return ds.slice(-R);
}
export function setupCup(G, rng, def, season) {
  const teams = def.leagues.flatMap(l => G.leagues[l]?.teams || []);
  if (teams.length < 4) return null;
  const c = newComp(G, def, season, "cup");
  c.teams = teams.slice();
  const seeded = teams.slice().sort((a, b) => tierOf(G, a) - tierOf(G, b) || G.clubs[b].level - G.clubs[a].level);
  const R = Math.ceil(Math.log2(teams.length));
  c.dates = cupDates(def, season, R);
  const P = 2 ** Math.floor(Math.log2(teams.length));
  if (P === teams.length) koStage(c, rng.shuffle(seeded), ROUND_NAME(P), 1, [c.dates[0]]);
  else {
    const n = teams.length - P;
    c.byes = seeded.slice(0, teams.length - 2 * n);
    koStage(c, rng.shuffle(seeded.slice(-2 * n)), "Babak Pertama", 1, [c.dates[0]]);
  }
  return c;
}

// ---------- continental ----------
const AFC_WEST = new Set(["KSA", "ARE", "QAT", "IRN", "UZB", "IRQ", "KWT", "BHR", "TKM", "JOR", "OMN", "IND", "SYR", "LBN", "TJK", "KGZ", "PSE", "YEM", "AFG", "BGD", "NPL", "MDV", "LKA", "BTN", "PAK"]);
function qualifiers(G, def, used) {
  const out = [];
  for (const [lid, n] of Object.entries(def.slots || {})) {
    const L = G.leagues[lid]; if (!L) continue;
    const last = L.history[L.history.length - 1];
    const order = last ? last.table.map(r => r[0]) : table(G, lid).map(r => r.id);
    let k = 0;
    for (const id of order) { if (k >= n) break; if (used.has(id) || G.clubs[id]?.league !== lid) continue; out.push(id); used.add(id); k++; }
  }
  return out;
}
export function setupContinental(G, rng, def, season, used = new Set()) {
  if (def.fromYear && season < def.fromYear) return null;
  const prev = G.comps[def.id];
  const first = !prev || !prev.teams.length;
  let c;
  if (def.mirror) {
    const src = G.comps[def.mirror]; if (!src) return null;
    const teams = src.teams.slice().sort((a, b) => G.clubs[b].youth - G.clubs[a].youth || G.clubs[b].level - G.clubs[a].level);
    teams.forEach(id => ensureYouth(G, rng, G.clubs[id]));
    c = newComp(G, def, season, "cont");
    c.teams = teams;
    swissStage(G, rng, c, def, [teams]);
    return c;
  }
  if (def.perNation) {
    const teams = [];
    for (const [n, k] of Object.entries(def.perNation)) teams.push(...Object.values(G.clubs).filter(x => x.nation === n && (G.leagues[x.league] || x.ext)).sort((a, b) => b.youth - a.youth || b.level - a.level).slice(0, k).map(x => x.id));
    teams.forEach(id => ensureYouth(G, rng, G.clubs[id]));
    c = newComp(G, def, season, "cont");
    c.teams = teams;
    groupStage(G, rng, c, def, drawGroups(G, rng, teams, teams.length / 4));
    return c;
  }
  if (def.format === "swiss") {
    let teams;
    if (first) teams = def.first.slice();
    else {
      const internal = qualifiers(G, def, used);
      const ext = prev.teams.filter(id => G.clubs[id]?.ext);
      teams = [...internal, ...ext].sort((a, b) => lv(G, b) - lv(G, a));
    }
    teams.forEach(id => used.add(id));
    c = newComp(G, def, season, "cont");
    c.teams = teams;
    swissStage(G, rng, c, def, [teams]);
  } else if (def.format === "regions") {
    let regions;
    if (first) regions = def.regions.map(r => r.slice());
    else {
      const internal = qualifiers(G, def, used);
      const prevR = prev.stages[0]?.groups || def.regions;
      regions = prevR.map((r, i) => [...internal.filter(id => (i === 0) === AFC_WEST.has(G.clubs[id].nation)), ...r.filter(id => G.clubs[id]?.ext)].sort((a, b) => lv(G, b) - lv(G, a)));
    }
    regions.flat().forEach(id => used.add(id));
    c = newComp(G, def, season, "cont");
    c.teams = regions.flat();
    swissStage(G, rng, c, def, regions, def.regionNames);
  } else {
    let groups;
    if (first && def.groups) groups = def.groups.map(g => g.slice());
    else if (first && def.pots) {
      groups = Array.from({ length: def.pots[0].length }, () => []);
      for (const pot of def.pots) {
        for (let attempt = 0; attempt < 100; attempt++) {
          const order = rng.shuffle(pot.slice());
          const okNat = order.every((id, gi) => !groups[gi].some(x => G.clubs[x].nation === G.clubs[id].nation));
          if (okNat || attempt === 99) { order.forEach((id, gi) => groups[gi].push(id)); break; }
        }
      }
    } else {
      const internal = qualifiers(G, def, used);
      const ext = prev.teams.filter(id => G.clubs[id]?.ext);
      const all = [...internal, ...ext];
      const ng = Math.max(1, Math.round(all.length / 4));
      if (def.id === "ACL2") {
        const W = all.filter(id => AFC_WEST.has(G.clubs[id].nation)), E = all.filter(id => !AFC_WEST.has(G.clubs[id].nation));
        groups = [...drawGroups(G, rng, W, Math.max(1, Math.round(W.length / 4))), ...drawGroups(G, rng, E, Math.max(1, Math.round(E.length / 4)))];
      } else groups = drawGroups(G, rng, all, ng);
    }
    groups.flat().forEach(id => used.add(id));
    c = newComp(G, def, season, "cont");
    c.teams = groups.flat();
    groupStage(G, rng, c, def, groups);
  }
  return c;
}
function swissStage(G, rng, c, def, regions, names) {
  const S = { name: "Fase Liga", type: "league", groups: regions.map(r => r.slice()), names: names || null };
  c.stages.push(S);
  regions.forEach((teams, g) => {
    const pots = chunk(teams, def.pots);
    const rounds = swissDraw(G, rng, teams, pots, def.md);
    rounds.forEach((pairs, r) => pairs.forEach(([h, a], i) => {
      let d = seasonDay(c.cal, c.season, def.mdDates[r]);
      if (def.split && i % 2) d += 1;
      addFix(c, 0, d, h, a, { md: r + 1, g });
    }));
  });
  c.cur = 0;
}
function groupStage(G, rng, c, def, groups) {
  const S = { name: "Fase Grup", type: "groups", groups };
  c.stages.push(S);
  groups.forEach((ids, g) => rrPairs(rng, ids, def.legs).forEach((pairs, r) => pairs.forEach(([h, a]) => addFix(c, 0, seasonDay(c.cal, c.season, def.mdDates[r]), h, a, { md: r + 1, g }))));
  c.cur = 0;
}
export function groupTable(G, c, g) {
  const S = c.stages[0];
  return standings(G, S.groups[g], c.fixtures.filter(f => f.st === 0 && f.g === g));
}

// ---------- league play-offs ----------
function setupPlayoff(G, rng, L) {
  const def = PLAYOFFS[L.id];
  const c = newComp(G, { id: L.id + "PO", name: `${L.name} · ${def.name}`, short: L.short, color: L.color, nation: L.nation, cal: L.cal === "half" ? "year" : L.cal }, L.season, "po", { league: L.id, phase: L.phase || null });
  const dates = (L.phase === "Apertura" && def.apertura ? def.apertura : def.stages.map(s => s[1])).map(md => day(L.season, md[0], md[1]));
  c.poDates = dates; c.poNames = def.stages.map(s => s[0]);
  const z0 = table(G, L.id, 0).slice(0, 8).map(r => r.id), z1 = table(G, L.id, 1).slice(0, 8).map(r => r.id);
  // bracket order 1v8, 4v5, 2v7, 3v6 (per conference for MLS; zone A vs zone B for Argentina)
  const list = def.byZone
    ? [...[0, 3, 1, 2].flatMap(i => [z0[i], z0[7 - i]]), ...[0, 3, 1, 2].flatMap(i => [z1[i], z1[7 - i]])]
    : [...[0, 3, 1, 2].flatMap(i => [z0[i], z1[7 - i]]), ...[0, 3, 1, 2].flatMap(i => [z1[i], z0[7 - i]])];
  c.teams = list.slice();
  koStage(c, list, c.poNames[0], 1, [dates[0]]);
  L.state = "po";
  addNews(G, { title: `${L.name}: fase gugur dimulai`, body: `Musim reguler ${L.name} ${leagueSeasonLabel(L)} selesai. 16 tim melaju ke fase gugur.`, tag: "Kompetisi", league: L.id });
}

// ---------- knockout progress ----------
// called after every result of a fixture that belongs to a tie
export function afterTieFixture(G, rng, c, f) {
  const S = c.stages[f.st], tie = S.ties[f.tie];
  const fx = tie.f.map(i => c.fixtures[i]);
  if (fx.some(x => !x.res)) return;
  let ga = 0, gb = 0;
  for (const x of fx) { if (x.h === tie.a) { ga += x.res[0]; gb += x.res[1]; } else { ga += x.res[1]; gb += x.res[0]; } }
  const last = fx[fx.length - 1];
  if (ga === gb) {
    const la = lv(G, tie.a, c.youth), lb = lv(G, tie.b, c.youth), diff = la - lb;
    const ea = pois(rng, 0.32 * Math.exp(diff / 45)), eb = pois(rng, 0.32 * Math.exp(-diff / 45));
    last.aet = true;
    if (last.h === tie.a) { last.res = [last.res[0] + ea, last.res[1] + eb]; } else { last.res = [last.res[0] + eb, last.res[1] + ea]; }
    ga += ea; gb += eb;
    if (ga === gb) {
      const aWins = rng.chance(clamp(0.5 + diff * 0.003, 0.3, 0.7));
      const loser = rng.int(2, 4), winner = loser + (rng.chance(0.7) ? 1 : 2);
      const pa = aWins ? winner : loser, pb = aWins ? loser : winner;
      last.pens = last.h === tie.a ? [pa, pb] : [pb, pa];
      tie.w = aWins ? tie.a : tie.b;
    }
  }
  if (!tie.w) tie.w = ga > gb ? tie.a : tie.b;
  tie.agg = [ga, gb];
}
const stageDone = (c, st) => c.stages[st].type === "ko" ? c.stages[st].ties.every(t => t.w) : c.fixtures.every(f => f.st !== st || f.res);

function advance(G, rng, c) {
  const st = c.cur, S = c.stages[st];
  if (!stageDone(c, st)) return;
  const def = compDef(c.id);
  const date = d => seasonDay(c.cal, c.season, d);
  if (c.kind === "cup") {
    let next = S.ties.map(t => t.w);
    if (c.byes) { next = [...c.byes, ...next]; c.byes = null; }
    if (next.length === 1) return finishComp(G, c, next[0], S.ties[0]);
    koStage(c, rng.shuffle(next), ROUND_NAME(next.length), 1, [c.dates[c.stages.length]] , true);
    return drawNews(G, c);
  }
  if (c.kind === "po") {
    const next = S.ties.map(t => t.w);
    if (next.length === 1) return finishPlayoff(G, c, next[0], S.ties[0]);
    const i = c.stages.length;
    // the better regular-season record hosts
    const L = G.leagues[c.league], tb = table(G, L.id), rank = id => tb.findIndex(r => r.id === id);
    const list = [];
    for (let k = 0; k + 1 < next.length; k += 2) { const [x, y] = [next[k], next[k + 1]]; list.push(...(rank(x) <= rank(y) ? [x, y] : [y, x])); }
    koStage(c, list, c.poNames[i], 1, [c.poDates[i]], L.id === "ARG1");
    return;
  }
  // continental
  if (S.type === "ko") {
    const next = S.ties.map(t => t.w);
    if (next.length === 1) return finishComp(G, c, next[0], S.ties[0]);
    const k = def.ko[c.ki++];
    const list = [];
    if (c.direct) { for (const i of [0, 7, 3, 4, 1, 6, 2, 5]) list.push(c.direct[i], next[7 - i]); c.direct = null; }
    else for (let i = 0; i + 1 < next.length; i += 2) list.push(next[i], next[i + 1]);
    koStage(c, list, k[0], k[1], k.slice(2).map(date), true);
    return drawNews(G, c);
  }
  // after league phase / groups
  let list = [];
  if (S.type === "league" && S.groups.length === 1) {
    const tb = standings(G, S.groups[0], c.fixtures.filter(f => f.st === 0)).map(r => r.id);
    if (def.qualify === 16) {
      const top = tb.slice(0, 16), o = [[0, 15], [7, 8], [3, 12], [4, 11], [1, 14], [6, 9], [2, 13], [5, 10]];
      list = o.flatMap(([x, y]) => [top[x], top[y]]);
    } else {
      // play-off: 9–24, then the top eight meet the winners
      const po = []; for (let i = 0; i < 8; i++) po.push(tb[8 + i], tb[23 - i]);
      c.direct = tb.slice(0, 8);
      list = po;
    }
  } else if (S.type === "league") {
    for (let g = 0; g < S.groups.length; g++) {
      const tb = standings(G, S.groups[g], c.fixtures.filter(f => f.st === 0 && f.g === g)).map(r => r.id).slice(0, 8);
      list.push(...[[0, 7], [3, 4], [1, 6], [2, 5]].flatMap(([x, y]) => [tb[x], tb[y]]));
    }
  } else {
    const tabs = S.groups.map((_, g) => groupTable(G, c, g));
    if (def.adv === 1) {
      const firsts = tabs.map(t => t[0]), second = tabs.map(t => t[1]).sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga))[0];
      const q = [...firsts.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga)), second].map(r => r.id);
      list = [q[0], q[3], q[1], q[2]];
    } else for (let g = 0; g < tabs.length; g += 2) list.push(tabs[g][0].id, tabs[g + 1][1].id, tabs[g + 1][0].id, tabs[g][1].id);
  }
  const k = def.ko[c.ki++];
  koStage(c, list, k[0], k[1], k.slice(2).map(date));
  drawNews(G, c);
}
function drawNews(G, c) {
  const S = c.stages[c.cur], u = userP(G);
  const mine = S.ties.find(t => t.a === u.club || t.b === u.club);
  if (mine && (!c.youth || u.squad === "Y")) {
    const opp = G.clubs[mine.a === u.club ? mine.b : mine.a];
    addMail(G, `${c.name}: ${S.name}`, `Hasil undian ${S.name.toLowerCase()} ${c.name}${c.youth ? " (U-19)" : ""}: ${G.clubs[u.club].name} melawan ${opp.name}. ${S.legs === 2 ? `Leg pertama ${fmt(c.fixtures[mine.f[0]].d)}, leg kedua ${fmt(c.fixtures[mine.f[1]].d)}.` : `Laga digelar ${fmt(c.fixtures[mine.f[0]].d)}.`}`, "info", { from: c.name, cat: "Kompetisi" });
  }
  if (!c.youth && (c.kind === "cont" || S.ties.length <= 4)) addNews(G, { title: `Undian ${S.name} ${c.name}`, body: S.ties.map(t => `${G.clubs[t.a].name} vs ${G.clubs[t.b].name}`).join("; ") + ".", tag: "Kompetisi", comp: c.id, scope: mine ? "me" : "world" });
}

function finishComp(G, c, winner, finalTie) {
  c.state = "done"; c.winner = winner;
  const runner = finalTie.a === winner ? finalTie.b : finalTie.a;
  c.history.push({ season: compLabel(c), winner, runnerUp: runner });
  const W = G.clubs[winner];
  addNews(G, { title: `${W.name} juara ${c.name}${c.youth ? "" : ""}`, body: `${W.name} menjuarai ${c.name} ${compLabel(c)} setelah mengalahkan ${G.clubs[runner].name} di final.`, tag: "Kompetisi", club: winner, comp: c.id, scope: winner === userP(G).club ? "me" : "world" });
  userTrophy(G, c, winner, c.name);
}
function userTrophy(G, c, winner, name) {
  const u = userP(G);
  if (G.user.retired || u.club !== winner) return;
  const st = G.user.cs[c.id];
  if (!st || st.apps + st.sub === 0) return;
  G.user.trophies.push({ name, year: compLabel(c), club: G.clubs[winner].name, comp: c.id });
  (G.user.seasonNotes = G.user.seasonNotes || []).push(`Juara ${name}`);
  addMail(G, `Juara ${name}!`, `Selamat! ${G.clubs[winner].name} menjuarai ${name} ${compLabel(c)} dan kamu ikut ambil bagian.`, "good", { cat: "Penghargaan" });
}
function finishPlayoff(G, c, winner, finalTie) {
  c.state = "done"; c.winner = winner;
  const L = G.leagues[c.league];
  const runner = finalTie.a === winner ? finalTie.b : finalTie.a;
  finishLeague(G, L, winner, runner);
}

// ---------- league lifecycle ----------
export function finishLeague(G, L, champ = null, runner = null) {
  const tb = table(G, L.id);
  const champion = champ || tb[0].id, runnerUp = runner || (tb[0].id === champion ? tb[1].id : tb[0].id);
  const players = L.teams.flatMap(id => G.clubs[id].squad.map(pid => G.players[pid])).filter(Boolean);
  const nMatches = Math.max(...tb.map(r => r.p));
  const elig = players.filter(p => p.st.apps >= nMatches * 0.5);
  const ar = p => p.st.rsum / Math.max(1, p.st.rn);
  const topScorer = players.slice().sort((a, b) => b.st.gls - a.st.gls || b.st.ast - a.st.ast)[0];
  const potm = elig.slice().sort((a, b) => ar(b) - ar(a))[0];
  const ageAt = p => (G.date - p.birth) / 365.25;
  const young = elig.filter(p => ageAt(p) < 22).sort((a, b) => ar(b) - ar(a))[0];
  const tots = [];
  for (const [g, n] of [["GK", 1], ["DEF", 4], ["MID", 3], ["ATT", 3]]) tots.push(...elig.filter(p => posGroup(p.main) === g).sort((a, b) => ar(b) - ar(a)).slice(0, n).map(p => p.id));
  const entry = { season: L.season, label: leagueSeasonLabel(L), champion, runnerUp, topScorer: topScorer?.id, topGoals: topScorer?.st.gls, potm: potm?.id, young: young?.id, tots, table: tb.map(r => [r.id, r.pts]) };
  L.history.push(entry);
  L.state = "done";
  const C1 = G.clubs[champion];
  addNews(G, { title: `${C1.name} juara ${L.name}`, body: `${C1.name} menjadi juara ${L.name} ${entry.label}${champ ? ` setelah menang di final fase gugur atas ${G.clubs[runnerUp].name}` : ` dengan ${tb[0].pts} poin, unggul ${tb[0].pts - tb[1].pts} poin atas ${G.clubs[tb[1].id].name}`}.`, tag: "Kompetisi", club: champion, league: L.id, scope: champion === userP(G).club ? "me" : "world" });
  // the user's honours
  const u = userP(G);
  if (!G.user.retired && L.teams.includes(u.club)) {
    const notes = (G.user.seasonNotes = G.user.seasonNotes || []);
    const played = u.st.apps + u.st.sub > 0;
    G.user.leaguePos = { league: L.id, label: entry.label, pos: tb.findIndex(r => r.id === u.club) + 1 };
    if (champion === u.club && played) { G.user.trophies.push({ name: L.name, year: entry.label, club: G.clubs[u.club].name }); notes.push("Juara liga"); addMail(G, `Juara ${L.name}!`, `${G.clubs[u.club].name} juara ${L.name} ${entry.label}!`, "good", { cat: "Penghargaan" }); }
    if (entry.topScorer === u.id) { G.user.awards.push({ name: `Top Skor ${L.name}`, year: entry.label, detail: `${entry.topGoals} gol` }); notes.push("Top skor"); }
    if (entry.potm === u.id) { G.user.awards.push({ name: `Pemain Terbaik ${L.name}`, year: entry.label }); notes.push("Pemain terbaik liga"); }
    if (entry.young === u.id) { G.user.awards.push({ name: `Pemain Muda Terbaik ${L.name}`, year: entry.label }); notes.push("Pemain muda terbaik"); }
    if (tots.includes(u.id)) G.user.awards.push({ name: `Tim Terbaik Musim ${L.name}`, year: entry.label });
  }
}

// every day after the matches: finished stages, finished league seasons
export function compsAfterDay(G, rng) {
  for (const c of Object.values(G.comps)) if (c.state === "run" && c.stages.length) advance(G, rng, c);
  for (const L of Object.values(G.leagues)) {
    if (L.state !== "run" || !L.fixtures.length || L.fixtures.some(f => !f.res)) continue;
    if (PLAYOFFS[L.id]) setupPlayoff(G, rng, L);
    else finishLeague(G, L);
  }
}

// ---------- season set-up ----------
export function cupWeekends(season) {
  const out = {};
  for (const def of CUPS) {
    if (def.cal === "year") continue;
    for (const md of def.dates) { const d = seasonDay("aug", season, md), wd = ymd(d).wd; if (wd === 6 || wd === 0) (out[def.nation] = out[def.nation] || []).push(wd === 0 ? d - 1 : d); }
  }
  return out;
}
// Aug–May competitions for `season` (2026 = 2026/27)
export function setupSeasonComps(G, rng, season) {
  for (const def of CUPS) if (!def.cal && def.leagues.every(l => G.leagues[l])) setupCup(G, rng, def, season);
  const used = new Set();
  for (const def of CONTINENTAL) if (!def.cal) setupContinental(G, rng, def, season, used);
}
// calendar-year competitions for `year`
export function setupYearComps(G, rng, year) {
  for (const def of CUPS) if (def.cal === "year" && def.leagues.every(l => G.leagues[l])) setupCup(G, rng, def, year);
  const used = new Set();
  for (const def of CONTINENTAL) if (def.cal === "year") setupContinental(G, rng, def, year, used);
}

// ---------- promotion & relegation (Aug–May leagues, called on 1 June) ----------
export function promotions(G, rng, quick) {
  const u = userP(G);
  // 1) decide everything from this season's final tables
  const plan = [];
  for (const P of PROMO) {
    const up = G.leagues[P.up], down = G.leagues[P.down];
    if (!up || !down) continue;
    const tu = table(G, up.id).map(r => r.id);
    const eligible = id => !RESERVES[id] || G.clubs[RESERVES[id]]?.league !== up.id;
    let relegated, promoted, note = "";
    if (P.mode === "zones") {
      const z0 = table(G, down.id, 0).map(r => r.id), z1 = table(G, down.id, 1).map(r => r.id);
      const w = quick(z0[1], z1[1]);
      promoted = [z0[0], z1[0], w]; note = `play-off promosi: ${G.clubs[z0[1]].name} vs ${G.clubs[z1[1]].name}`;
      relegated = tu.slice(-P.n);
    } else {
      const td = table(G, down.id).map(r => r.id).filter(eligible);
      promoted = td.slice(0, P.n - 1);
      if (P.mode === "po") {
        const s1 = quick(td[2], td[5]), s2 = quick(td[3], td[4]);
        promoted.push(quick(s1, s2)); note = `final play-off: ${G.clubs[s1].name} vs ${G.clubs[s2].name}`;
        relegated = tu.slice(-P.n);
      } else {
        const a = tu[tu.length - P.n], b = td[P.n - 1];
        const w = quick(a, b);
        relegated = tu.slice(-(P.n - 1));
        if (w === b) { promoted.push(b); relegated.push(a); }
        note = `play-off degradasi: ${G.clubs[a].name} vs ${G.clubs[b].name} (${G.clubs[w].name} di ${w === b ? up.name : up.name})`;
      }
    }
    plan.push({ up, down, promoted, relegated, note });
  }
  const drops = [];
  for (const [lid, n] of Object.entries(POOL_DROP)) {
    const L = G.leagues[lid]; if (!L) continue;
    const poolId = Object.keys(POOLS).find(k => POOLS[k] === lid);
    const moving = new Set(plan.flatMap(p => p.promoted));
    let down;
    if (L.zones) {
      const z0 = table(G, lid, 0).map(r => r.id), z1 = table(G, lid, 1).map(r => r.id);
      const a = z0[z0.length - 2], b = z1[z1.length - 2];
      const w = quick(a, b);
      down = [z0[z0.length - 1], z1[z1.length - 1], w === a ? b : a];
    } else down = table(G, lid).map(r => r.id).filter(id => !moving.has(id)).slice(-n);
    drops.push({ L, poolId, down });
  }
  // 2) apply
  const moves = [];
  for (const { up, down, promoted, relegated, note } of plan) {
    for (const id of promoted) moveClub(G, id, down, up);
    for (const id of relegated) moveClub(G, id, up, down);
    moves.push({ up: up.id, down: down.id, promoted, relegated, note });
    addNews(G, { title: `Promosi & degradasi ${up.name}`, body: `Naik ke ${up.name}: ${promoted.map(id => G.clubs[id].name).join(", ")}. Turun ke ${down.name}: ${relegated.map(id => G.clubs[id].name).join(", ")}.${note ? ` (${note})` : ""}`, tag: "Kompetisi", league: up.id, scope: [...promoted, ...relegated].includes(u.club) ? "me" : "world" });
    if (promoted.includes(u.club)) addMail(G, "Promosi!", `${G.clubs[u.club].name} promosi ke ${up.name}!`, "good", { cat: "Kompetisi" });
    if (relegated.includes(u.club)) addMail(G, "Degradasi", `${G.clubs[u.club].name} terdegradasi ke ${down.name}.`, "bad", { cat: "Kompetisi" });
  }
  for (const { L, poolId, down } of drops) {
    const pool = G.pools[poolId] = G.pools[poolId] || [];
    const upc = pool.slice().sort((a, b) => G.clubs[b].level - G.clubs[a].level + rng.normal(0, 4)).slice(0, down.length);
    const zones = down.map(id => G.clubs[id].zone);
    for (const id of down) {
      L.teams = L.teams.filter(x => x !== id);
      G.clubs[id].league = poolId; delete G.clubs[id].zone; pool.push(id);
      if (id === u.club) G.user.outOfPyramid = { club: id, league: L.id };
      else retireSquad(G, G.clubs[id]);
    }
    upc.forEach((id, i) => {
      const c = G.clubs[id]; c.league = L.id; L.teams.push(id);
      if (L.zones) c.zone = zones[i] ?? 0;
      fillSquad(G, rng, c);
    });
    G.pools[poolId] = pool.filter(x => !upc.includes(x));
    addNews(G, { title: `${L.name}: pergantian klub`, body: `Turun ke ${POOL_LABEL[poolId] || "divisi bawah"}: ${down.map(id => G.clubs[id].name).join(", ")}. Naik: ${upc.map(id => G.clubs[id].name).join(", ")}.`, tag: "Kompetisi", league: L.id, scope: down.includes(u.club) ? "me" : "world" });
    if (down.includes(u.club)) addMail(G, "Degradasi", `${G.clubs[u.club].name} terdegradasi ke ${POOL_LABEL[poolId] || "divisi bawah"}, divisi yang tidak dimainkan di gim ini.`, "bad", { cat: "Kompetisi" });
  }
  // keep zones (conferences/regions) the same size
  for (const L of Object.values(G.leagues)) {
    if (!L.zones) continue;
    for (let guard = 0; guard < 10; guard++) {
      const z = [0, 1].map(k => L.teams.filter(id => G.clubs[id].zone === k));
      if (Math.abs(z[0].length - z[1].length) <= 1) break;
      const big = z[0].length > z[1].length ? 0 : 1;
      G.clubs[rng.pick(z[big])].zone = 1 - big;
    }
  }
  return moves;
}
function moveClub(G, id, from, to) {
  from.teams = from.teams.filter(x => x !== id);
  to.teams.push(id);
  const c = G.clubs[id];
  c.league = to.id;
  if (to.zones) {
    const z = [0, 1].map(k => to.teams.filter(x => G.clubs[x].zone === k).length);
    c.zone = z[0] <= z[1] ? 0 : 1;
  } else delete c.zone;
}
function retireSquad(G, club) {
  for (const id of [...club.squad, ...club.youthSquad]) if (!G.players[id]?.isUser) delete G.players[id];
  club.squad = []; club.youthSquad = [];
}
