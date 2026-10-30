// International football: call-ups in FIFA windows, youth national teams and tournaments.
import { clamp } from "./rng.js";
import { NATIONS } from "./data.js";
import { ymd, day, ageOn, seasonOf, fmt } from "./calendar.js";
import { addMail, addNews, userP, INTL_WINDOWS, intlWindowAt } from "./world.js";
import { ntFor, selectNational, posGroup, fed, decision } from "./career.js";
import { fullName } from "./player.js";

const TOURS = [
  { id: "WC", name: "Piala Dunia", conf: "ALL", years: y => y >= 2030 && (y - 2030) % 4 === 0, month: 6, start: 11, ko: ["Babak 32 Besar", "Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 100) / 40 + 0.25, 0.12, 0.97) },
  { id: "EURO", name: "Piala Eropa", conf: "UEFA", years: y => y >= 2028 && (y - 2028) % 4 === 0, month: 6, start: 12, ko: ["Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 110) / 30 + 0.4, 0.2, 0.98) },
  { id: "COPA", name: "Copa América", conf: "CONMEBOL", years: y => y >= 2028 && (y - 2028) % 4 === 0, month: 6, start: 14, ko: ["Perempat Final", "Semifinal", "Final"], q: () => 1 },
  { id: "ASIA", name: "Piala Asia", conf: "AFC", years: y => y >= 2027 && (y - 2027) % 4 === 0, month: 1, start: 7, ko: ["Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 85) / 30 + 0.35, 0.3, 0.98) },
  { id: "AFCON", name: "Piala Afrika", conf: "CAF", years: y => y >= 2027 && (y - 2027) % 2 === 0, month: 6, start: 19, ko: ["Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 100) / 25 + 0.4, 0.3, 0.98) },
  { id: "GOLD", name: "Gold Cup", conf: "CONCACAF", years: y => y >= 2027 && (y - 2027) % 2 === 0, month: 6, start: 16, ko: ["Perempat Final", "Semifinal", "Final"], q: () => 1 },
  // ASEAN Championship 2026: 24 Jul – 26 Aug, two groups of five, two-legged semi-finals and final
  { id: "AFF", name: "Piala AFF", conf: "AFF", years: y => y >= 2026 && (y - 2026) % 2 === 0, month: 7, start: 24, ko: ["Semifinal", "Final"], legs: 2, q: () => 1,
    fixed: { 2026: { groups: [["IDN", "VIE", "SGP", "KHM", "TLS"], ["THA", "MAS", "PHI", "MMR", "LAO"]], dates: { IDN: [[7, 27], [7, 31], [8, 3], [8, 7]] }, ko: [[[8, 15], [8, 19]], [[8, 22], [8, 26]]] } } },
];
const AFF = new Set(["IDN", "VIE", "THA", "MAS", "SGP", "PHI", "MMR", "KHM", "LAO", "BRN", "TLS"]);

const nationsOf = conf => Object.keys(NATIONS).filter(k => conf === "ALL" || (conf === "AFF" ? AFF.has(k) : NATIONS[k].conf === conf));

function pickOpp(rng, nat, conf, near = true) {
  const pool = nationsOf(conf).filter(k => k !== nat);
  const lv = NATIONS[nat].level;
  return rng.weighted(pool, k => near ? 1 / (8 + Math.abs(NATIONS[k].level - lv)) : NATIONS[k].level ** 2);
}

function compName(G, nat, team, month) {
  const y = ymd(G.date).y, conf = NATIONS[nat].conf;
  if (team.youth) return `Laga Internasional ${team.name}`;
  if (month === 6) return "Uji Coba Internasional";
  if (conf === "UEFA" && y === 2026 && month >= 9) return "UEFA Nations League C/D";
  if (conf === "UEFA" && TOURS[1].years(y + 1)) return "Kualifikasi Piala Eropa";
  if (conf === "UEFA" && TOURS[1].years(y + 2) && month >= 9) return "Kualifikasi Piala Eropa";
  return "Kualifikasi Piala Dunia";
}

// Called every day before matches
export function intlDay(G, rng) {
  if (G.nl) nlDay(G, rng);
  const p = userP(G);
  if (G.user.retired || !p.club) return;
  const { y, m, d } = ymd(G.date);
  // tournaments
  for (const T of TOURS) {
    if (T.month === m && T.start === d && T.years(y) && (T.conf === "ALL" || (T.conf === "AFF" ? AFF.has(fed(G)) : NATIONS[fed(G)].conf === T.conf))) startTournament(G, rng, T);
  }
  // regular windows
  for (const [wm, wd, len, n] of INTL_WINDOWS) {
    if (wm === m && wd === d && !G.camp) {
      if (m === 6 && TOURS.some(T => T.month === 6 && T.years(y) && (T.conf === "ALL" || NATIONS[fed(G)].conf === T.conf))) continue;
      startWindow(G, rng, { start: G.date, len, n });
    }
  }
  if (G.camp && G.camp.end <= G.date) endCamp(G);
}

function callUp(G, team) {
  const p = userP(G);
  if (p.injury) return null;
  const squad = selectNational(G, fed(G), team);
  return squad.some(q => q.id === p.id) ? squad : null;
}

function startWindow(G, rng, win) {
  const p = userP(G);
  const team = ntFor(G, p);
  const squad = callUp(G, team);
  const nat = fed(G);
  if (!squad) { offerSwitch(G, team);
    if (team.youth || p.ca > team.level - 20) G.user.lastSnub = G.date;
    return;
  }
  const comp = compName(G, nat, team, ymd(G.date).m);
  const conf = NATIONS[nat].conf;
  const offs = win.n >= 4 ? [3, 6, 10, 13] : [3, 6];
  let matches = offs.map(k => ({ d: G.date + k, opp: pickOpp(rng, nat, conf === "CONMEBOL" || conf === "CONCACAF" ? "ALL" : conf), comp }));
  // Nations League games replace the generic fixtures of the senior side
  const nl = !team.youth && G.nl ? G.nl.fx.map((f, i) => [f, i]).filter(([f]) => (f.h === nat || f.a === nat) && f.d >= win.start && f.d < win.start + win.len + 5 && !f.res) : [];
  if (nl.length) {
    matches = nl.map(([f, i]) => ({ d: f.d, opp: f.h === nat ? f.a : f.h, comp: nlLabel(f), nl: i, ko: f.stage !== "G" }));
    const used = new Set(matches.map(x => x.d));
    for (const k of offs) if (matches.length < win.n && !matches.some(x => Math.abs(x.d - (G.date + k)) < 2) && !used.has(G.date + k)) matches.push({ d: G.date + k, opp: pickOpp(rng, nat, conf), comp: "Uji Coba Internasional" });
    matches.sort((a, b) => a.d - b.d);
  }
  G.camp = { team: team.name, youth: team.youth, level: team.level, max: team.max, nat, squad: squad.filter(q => !q.virtual).map(q => q.id), matches, end: Math.max(win.start + win.len, ...matches.map(x => x.d + 1)) };
  p.away = true;
  const first = !(G.user.int.calls || {})[team.name];
  G.user.int.calls = G.user.int.calls || {}; G.user.int.calls[team.name] = (G.user.int.calls[team.name] || 0) + 1;
  addMail(G, `Panggilan timnas ${NATIONS[nat].name}${team.youth ? " " + team.name : ""}`, `${first ? "Untuk pertama kalinya, kamu" : "Kamu"} dipanggil ke skuad ${NATIONS[nat].name}${team.youth ? " " + team.name : ""} untuk ${comp.toLowerCase()} melawan ${NATIONS[matches[0].opp].name} (${fmt(matches[0].d)}) dan ${NATIONS[matches[1].opp].name} (${fmt(matches[1].d)}).`, "good");
}

function startTournament(G, rng, T) {
  const p = userP(G), nat = fed(G), lv = NATIONS[nat].level;
  const y = ymd(G.date).y;
  const team = { name: "Senior", max: 99, level: lv, youth: false };
  if (ageOn(p.birth, G.date) < 17) return;
  if (!rng.chance(T.q(lv))) { addNews(G, `${NATIONS[nat].name} gagal lolos ke ${T.name} ${y}.`); return; }
  const squad = callUp(G, team);
  if (!squad) { addNews(G, `${NATIONS[nat].name} tampil di ${T.name} ${y}, tapi kamu tidak masuk skuad.`); return; }
  const conf = T.conf;
  const fixed = T.fixed?.[y];
  let groupOpp = [], other = null;
  if (fixed) {
    const grp = fixed.groups.find(g => g.includes(nat));
    if (!grp) { addNews(G, `${NATIONS[nat].name} tidak tampil di ${T.name} ${y}.`); return; }
    groupOpp = grp.filter(n => n !== nat);
    other = fixed.groups.filter(g => g !== grp).flat();
  } else while (groupOpp.length < 3) { const o = pickOpp(rng, nat, conf, false); if (!groupOpp.includes(o)) groupOpp.push(o); }
  const start = G.date;
  const ds = fixed?.dates?.[nat]?.map(([m, d]) => day(y, m, d)) || groupOpp.map((_, i) => start + 1 + i * 4);
  const matches = groupOpp.map((o, i) => ({ d: ds[i], opp: o, comp: `${T.name} ${y} · Grup` }));
  G.camp = {
    team: "Senior", youth: false, level: lv, max: 99, nat, squad: squad.filter(q => !q.virtual).map(q => q.id), matches, end: start + 60,
    tour: { id: T.id, name: `${T.name} ${y}`, ko: T.ko, legs: T.legs || 1, koDates: fixed?.ko?.map(l => l.map(([m, d]) => day(y, m, d))) || null, other, stage: 0, group: [nat, ...groupOpp].map(n => ({ n, p: 0, gd: 0, gf: 0 })), alive: true, conf },
  };
  p.away = true;
  addMail(G, `${T.name} ${y}`, `Kamu masuk skuad ${NATIONS[nat].name} untuk ${T.name} ${y}! Lawan di fase grup: ${groupOpp.map(o => NATIONS[o].name).join(", ")}.`, "good");
  addNews(G, `${NATIONS[nat].name} mengumumkan skuad ${T.name}; ${fullName(p)} termasuk di dalamnya.`);
}

// After the user's national match is played
export function afterIntlMatch(G, rng, match, score) {
  const c = G.camp; if (!c) return;
  if (match.nl != null && G.nl) {
    const f = G.nl.fx[match.nl];
    f.res = f.h === c.nat ? [score[0], score[1]] : [score[1], score[0]];
    if (f.stage === "SF" || f.stage === "F") { koPens(rng, f); if (f.pens) match.pens = (f.h === c.nat ? f.pens[0] > f.pens[1] : f.pens[1] > f.pens[0]) ? "menang adu penalti" : "kalah adu penalti"; }
    nlProgress(G, rng);
    return;
  }
  const T = c.tour;
  if (!T) return;
  const [gf, ga] = score;
  const nat = c.nat;
  if (T.stage === 0) {
    const row = T.group.find(r => r.n === nat), opp = T.group.find(r => r.n === match.opp);
    const res = (a, b, ra, rb) => { ra.gf += a; rb.gf += b; ra.gd += a - b; rb.gd += b - a; if (a > b) ra.p += 3; else if (a < b) rb.p += 3; else { ra.p++; rb.p++; } };
    res(gf, ga, row, opp);
    T.played = (T.played || 0) + 1;
    if (T.played === T.group.length - 1) {
      // the rest of the group plays out
      const others = T.group.filter(r => r.n !== nat);
      for (let i = 0; i < others.length; i++) for (let j = i + 1; j < others.length; j++) { const [x, y] = quickScore(rng, others[i].n, others[j].n); res(x, y, others[i], others[j]); }
      const tb = T.group.slice().sort((a, b) => b.p - a.p || b.gd - a.gd || b.gf - a.gf);
      const pos = tb.findIndex(r => r.n === nat) + 1;
      const thirdOK = pos === 3 && tb[2].p >= 4 && T.ko.length >= 4;
      if (pos <= 2 || thirdOK) { T.stage = 1; nextKO(G, rng); addMail(G, T.name, `${NATIONS[nat].name} lolos dari fase grup sebagai peringkat ${pos}.`, "good"); }
      else { T.alive = false; c.end = G.date + 1; addMail(G, T.name, `${NATIONS[nat].name} tersingkir di fase grup (peringkat ${pos}).`, "bad"); }
    }
    return;
  }
  // knockout (two-legged ties are decided on aggregate in the second leg)
  if (match.leg === 1) { T.firstLeg = [gf, ga]; return; }
  if (match.leg === 2 && T.firstLeg) { gf += T.firstLeg[0]; ga += T.firstLeg[1]; T.firstLeg = null; }
  let win = gf > ga;
  if (gf === ga) {
    win = rng.chance(0.5 + (NATIONS[nat].level - NATIONS[match.opp].level) * 0.004);
    match.pens = win ? "menang adu penalti" : "kalah adu penalti";
  }
  if (!win) { T.alive = false; c.end = G.date + 1; addMail(G, T.name, `${NATIONS[nat].name} tersingkir di ${T.ko[T.stage - 1].toLowerCase()}${match.pens ? " (" + match.pens + ")" : ""}.`, "bad"); return; }
  if (T.stage === T.ko.length) {
    T.alive = false; c.end = G.date + 1;
    G.user.trophies.push({ name: T.name, year: String(ymd(G.date).y), club: NATIONS[nat].name });
    G.user.tourWin = seasonOf(G.date - 30);
    addMail(G, `Juara ${T.name}!`, `${NATIONS[nat].name} juara ${T.name}${match.pens ? " lewat adu penalti" : ""}!`, "good");
    addNews(G, `${NATIONS[nat].name} juara ${T.name}.`);
    return;
  }
  T.stage++; nextKO(G, rng);
}
function nextKO(G, rng) {
  const c = G.camp, T = c.tour;
  const strongBias = T.stage / T.ko.length;
  const pool = (T.other && T.stage === 1 ? T.other : nationsOf(T.conf)).filter(k => k !== c.nat && !T.group.some(r => r.n === k));
  const opp = rng.weighted(pool, k => NATIONS[k].level ** (2 + strongBias * 4));
  const name = `${T.name} · ${T.ko[T.stage - 1]}`;
  const ds = T.koDates?.[T.stage - 1] || (T.legs === 2 ? [G.date + 4, G.date + 8] : [G.date + 4]);
  if (T.legs === 2) {
    c.matches.push({ d: ds[0], opp, comp: `${name} (leg 1)`, ko: true, leg: 1 }, { d: ds[1], opp, comp: `${name} (leg 2)`, ko: true, leg: 2 });
  } else c.matches.push({ d: ds[0], opp, comp: name, ko: true });
  c.end = ds[ds.length - 1] + 2;
}
function quickScore(rng, a, b) {
  const diff = NATIONS[a].level - NATIONS[b].level;
  const pois = l => { let L = Math.exp(-l), k = 0, p = 1; do { k++; p *= rng.next(); } while (p > L); return k - 1; };
  return [pois(1.3 * Math.exp(diff / 41)), pois(1.3 * Math.exp(-diff / 41))];
}

export function endCamp(G) {
  const p = userP(G);
  p.away = false;
  G.camp = null;
}

export function campMatchToday(G) {
  const c = G.camp; if (!c) return null;
  return c.matches.find(mt => mt.d === G.date && !mt.done) || null;
}

// ---------- dual nationality: FIFA eligibility (Regulations Governing the Application of the Statutes, art. 9) ----------
// A player may change association once if: he has played no more than 3 official A-level matches,
// all before turning 21, none at a final tournament, and at least 3 years have passed since the last one.
export function canSwitch(G) {
  const u = G.user, p = userP(G);
  if (!p.nat2 || u.switched) return { ok: false, why: u.switched ? "Kamu sudah pernah pindah federasi." : "Kamu tidak punya kewarganegaraan kedua." };
  const comp = (u.int.senior || []).filter(m => m.official);
  if (!comp.length) return { ok: true };
  if (comp.length > 3) return { ok: false, why: "Sudah lebih dari 3 laga resmi senior." };
  if (comp.some(m => m.age >= 21)) return { ok: false, why: "Pernah tampil di laga resmi senior setelah usia 21." };
  if (comp.some(m => m.tour)) return { ok: false, why: "Pernah tampil di putaran final turnamen." };
  const last = Math.max(...comp.map(m => m.date));
  if (G.date - last < 3 * 365) return { ok: false, why: "Belum 3 tahun sejak laga resmi terakhir." };
  return { ok: true };
}
function offerSwitch(G, team) {
  const p = userP(G), u = G.user;
  if (!p.nat2 || u.switchOffered === ymd(G.date).y) return;
  const other = fed(G) === p.nat ? p.nat2 : p.nat;
  if (!canSwitch(G).ok) return;
  const squad = selectNational(G, other, { ...team, level: team.youth ? NATIONS[other].level * (team.level / NATIONS[fed(G)].level) : NATIONS[other].level }, true);
  if (!squad.some(q => q.id === p.id)) return;
  u.switchOffered = ymd(G.date).y;
  decision(G, `Federasi ${NATIONS[other].name} menghubungimu`, `Pelatih timnas ${NATIONS[other].name} ingin memanggilmu. Kamu memenuhi syarat FIFA untuk pindah federasi (hanya boleh sekali). Laga timnas usia muda tidak mengikat.`, [
    { label: `Bela ${NATIONS[other].name}`, detail: "Panggilan berikutnya datang dari federasi ini.", act: "switchFed", data: { to: other } },
    { label: `Tetap ${NATIONS[fed(G)].name}`, detail: "Tolak dengan sopan.", act: "none" },
  ]);
}

// ---------- UEFA Nations League 2026/27 (League A and B; draw of 12 February 2026) ----------
const NL_2026 = {
  A: [["BEL", "FRA", "TUR", "ITA"], ["GRE", "NED", "GER", "SRB"], ["ESP", "CRO", "ENG", "CZE"], ["POR", "NOR", "DEN", "WAL"]],
  B: [["SCO", "SUI", "SVN", "MKD"], ["HUN", "UKR", "GEO", "NIR"], ["ISR", "AUT", "IRL", "XKK"], ["POL", "BIH", "ROU", "SWE"]],
  md: [[9, 24], [9, 27], [10, 1], [10, 4], [11, 12], [11, 15]], qf: [[3, 25], [3, 28]], sf: [6, 9], f: [6, 13],
};
const RR4 = [[[0, 3], [1, 2]], [[2, 0], [3, 1]], [[0, 1], [2, 3]], [[3, 0], [2, 1]], [[0, 2], [1, 3]], [[1, 0], [3, 2]]];
export function setupNL(G) {
  G.nl = { name: "UEFA Nations League", season: "2026/27", groups: { A: NL_2026.A, B: NL_2026.B }, fx: [], ko: [], winner: null };
  for (const lg of ["A", "B"]) NL_2026[lg].forEach((grp, g) => RR4.forEach((pairs, r) => pairs.forEach(([h, a]) => G.nl.fx.push({ stage: "G", lg, g, md: r + 1, d: day(2026, ...NL_2026.md[r]), h: grp[h], a: grp[a], res: null }))));
}
export const nlLabel = f => f.stage === "G" ? `UEFA Nations League ${f.lg} · Grup ${f.lg}${f.g + 1}` : `UEFA Nations League · ${f.stage === "QF" ? `Perempat Final (leg ${f.leg})` : f.stage === "SF" ? "Semifinal" : "Final"}`;
export function nlTable(G, lg, g) {
  const rows = Object.fromEntries(G.nl.groups[lg][g].map(n => [n, { n, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const f of G.nl.fx) {
    if (f.stage !== "G" || f.lg !== lg || f.g !== g || !f.res) continue;
    const h = rows[f.h], a = rows[f.a], [x, y] = f.res;
    h.p++; a.p++; h.gf += x; h.ga += y; a.gf += y; a.ga += x;
    if (x > y) { h.w++; a.l++; h.pts += 3; } else if (x < y) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Object.values(rows).sort((p, q) => q.pts - p.pts || (q.gf - q.ga) - (p.gf - p.ga) || q.gf - p.gf);
}
function userInCamp(G, f) { const c = G.camp; return c && !c.youth && (f.h === c.nat || f.a === c.nat) && c.matches.some(m => m.nl != null && G.nl.fx[m.nl] === f); }
function nlDay(G, rng) {
  for (const f of G.nl.fx) {
    if (f.d !== G.date || f.res || userInCamp(G, f)) continue;
    f.res = quickScore(rng, f.h, f.a);
    if (f.stage === "SF" || f.stage === "F") koPens(rng, f);
  }
  nlProgress(G, rng);
}
function koPens(rng, f) {
  if (f.res[0] !== f.res[1]) return;
  const hw = rng.chance(0.5 + (NATIONS[f.h].level - NATIONS[f.a].level) * 0.004);
  f.pens = hw ? [5, 4] : [3, 4];
}
const nlWinner = f => (f.res[0] > f.res[1] || (f.res[0] === f.res[1] && f.pens && f.pens[0] > f.pens[1]) ? f.h : f.a);
function nlProgress(G, rng) {
  const N = G.nl, fx = N.fx;
  const groupsDone = fx.filter(f => f.stage === "G").every(f => f.res);
  if (groupsDone && !N.ko.length) {
    const tabs = [0, 1, 2, 3].map(g => nlTable(G, "A", g));
    const pairs = [[0, 1], [1, 0], [2, 3], [3, 2]].map(([x, y]) => [tabs[x][0].n, tabs[y][1].n]);
    N.ko.push("QF");
    pairs.forEach(([w, r], t) => {
      fx.push({ stage: "QF", tie: t, leg: 1, d: day(2027, ...NL_2026.qf[0]), h: r, a: w, res: null });
      fx.push({ stage: "QF", tie: t, leg: 2, d: day(2027, ...NL_2026.qf[1]), h: w, a: r, res: null });
    });
    const up = [0, 1, 2, 3].map(g => nlTable(G, "B", g)[0].n), down = [0, 1, 2, 3].map(g => nlTable(G, "A", g)[3].n);
    addNews(G, { title: "Nations League: fase grup selesai", body: `Perempat final Liga A: ${pairs.map(([w, r]) => `${NATIONS[w].name} vs ${NATIONS[r].name}`).join(", ")}. Promosi ke Liga A: ${up.map(n => NATIONS[n].name).join(", ")}. Turun dari Liga A: ${down.map(n => NATIONS[n].name).join(", ")}.`, tag: "Timnas" });
  }
  const qf = fx.filter(f => f.stage === "QF");
  if (qf.length && qf.every(f => f.res) && !N.ko.includes("SF")) {
    const winners = [0, 1, 2, 3].map(t => {
      const [l1, l2] = qf.filter(f => f.tie === t);
      const w = l2.h, r = l2.a, gw = l1.res[1] + l2.res[0], gr = l1.res[0] + l2.res[1];
      if (gw !== gr) return gw > gr ? w : r;
      return rng.chance(0.5 + (NATIONS[w].level - NATIONS[r].level) * 0.004) ? w : r;
    });
    N.ko.push("SF");
    fx.push({ stage: "SF", tie: 0, d: day(2027, ...NL_2026.sf), h: winners[0], a: winners[1], res: null });
    fx.push({ stage: "SF", tie: 1, d: day(2027, ...NL_2026.sf) + 1, h: winners[2], a: winners[3], res: null });
    addNews(G, { title: "Empat semifinalis Nations League", body: `${winners.map(n => NATIONS[n].name).join(", ")} lolos ke putaran final Nations League (Juni 2027).`, tag: "Timnas" });
  }
  const sf = fx.filter(f => f.stage === "SF");
  if (sf.length === 2 && sf.every(f => f.res) && !N.ko.includes("F")) {
    N.ko.push("F");
    const f = { stage: "F", d: day(2027, ...NL_2026.f), h: nlWinner(sf[0]), a: nlWinner(sf[1]), res: null };
    fx.push(f);
    const c = G.camp;
    if (c && !c.youth && (f.h === c.nat || f.a === c.nat)) { c.matches.push({ d: f.d, opp: f.h === c.nat ? f.a : f.h, comp: nlLabel(f), nl: fx.length - 1, ko: true }); c.end = Math.max(c.end, f.d + 1); }
  }
  const fin = fx.find(f => f.stage === "F");
  if (fin && fin.res && !N.winner) {
    N.winner = nlWinner(fin);
    addNews(G, { title: `${NATIONS[N.winner].name} juara UEFA Nations League`, body: `${NATIONS[N.winner].name} menjuarai UEFA Nations League 2026/27 setelah mengalahkan ${NATIONS[N.winner === fin.h ? fin.a : fin.h].name} di final.`, tag: "Timnas" });
    const p = userP(G);
    if (G.camp && !G.camp.youth && G.camp.nat === N.winner && G.camp.matches.some(m => m.nl != null && m.done)) {
      G.user.trophies.push({ name: "UEFA Nations League", year: "2026/27", club: NATIONS[N.winner].name });
      addMail(G, "Juara Nations League!", `${NATIONS[N.winner].name} juara UEFA Nations League 2026/27!`, "good", { cat: "Timnas" });
    }
  }
}
