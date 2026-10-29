// International football: call-ups in FIFA windows, youth national teams and tournaments.
import { clamp } from "./rng.js";
import { NATIONS } from "./data.js";
import { ymd, day, ageOn, seasonOf, fmt } from "./calendar.js";
import { addMail, addNews, userP, INTL_WINDOWS } from "./world.js";
import { ntFor, selectNational, posGroup } from "./career.js";
import { fullName } from "./player.js";

const TOURS = [
  { id: "WC", name: "Piala Dunia", conf: "ALL", years: y => y >= 2030 && (y - 2030) % 4 === 0, month: 6, start: 11, ko: ["Babak 32 Besar", "Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 100) / 40 + 0.25, 0.12, 0.97) },
  { id: "EURO", name: "Piala Eropa", conf: "UEFA", years: y => y >= 2028 && (y - 2028) % 4 === 0, month: 6, start: 12, ko: ["Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 110) / 30 + 0.4, 0.2, 0.98) },
  { id: "COPA", name: "Copa América", conf: "CONMEBOL", years: y => y >= 2028 && (y - 2028) % 4 === 0, month: 6, start: 14, ko: ["Perempat Final", "Semifinal", "Final"], q: () => 1 },
  { id: "ASIA", name: "Piala Asia", conf: "AFC", years: y => y >= 2027 && (y - 2027) % 4 === 0, month: 1, start: 9, ko: ["Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 85) / 30 + 0.35, 0.3, 0.98) },
  { id: "AFCON", name: "Piala Afrika", conf: "CAF", years: y => y >= 2027 && (y - 2027) % 2 === 0, month: 6, start: 19, ko: ["Babak 16 Besar", "Perempat Final", "Semifinal", "Final"], q: lv => clamp((lv - 100) / 25 + 0.4, 0.3, 0.98) },
  { id: "GOLD", name: "Gold Cup", conf: "CONCACAF", years: y => y >= 2027 && (y - 2027) % 2 === 0, month: 6, start: 16, ko: ["Perempat Final", "Semifinal", "Final"], q: () => 1 },
  { id: "AFF", name: "Piala AFF", conf: "AFF", years: y => y >= 2026 && (y - 2026) % 2 === 0, month: 12, start: 6, ko: ["Semifinal", "Final"], q: () => 1 },
];
const AFF = new Set(["IDN", "VIE", "THA", "MAS", "SGP", "PHI"]);

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
  if (conf === "UEFA" && TOURS[1].years(y + 1)) return "Kualifikasi Piala Eropa";
  if (conf === "UEFA" && TOURS[1].years(y + 2) && month >= 9) return "Kualifikasi Piala Eropa";
  return "Kualifikasi Piala Dunia";
}

// Called every day before matches
export function intlDay(G, rng) {
  const p = userP(G);
  if (G.user.retired || !p.club) return;
  const { y, m, d } = ymd(G.date);
  // tournaments
  for (const T of TOURS) {
    if (T.month === m && T.start === d && T.years(y) && (T.conf === "ALL" || (T.conf === "AFF" ? AFF.has(p.nat) : NATIONS[p.nat].conf === T.conf))) startTournament(G, rng, T);
  }
  // regular windows
  for (const [wm, wd] of INTL_WINDOWS) {
    if (wm === m && wd === d && !G.camp) {
      if (m === 6 && TOURS.some(T => T.month === 6 && T.years(y) && (T.conf === "ALL" || NATIONS[p.nat].conf === T.conf))) continue;
      startWindow(G, rng);
    }
  }
  if (G.camp && G.camp.end <= G.date) endCamp(G);
}

function callUp(G, team) {
  const p = userP(G);
  if (p.injury) return null;
  const squad = selectNational(G, p.nat, team);
  return squad.some(q => q.id === p.id) ? squad : null;
}

function startWindow(G, rng) {
  const p = userP(G);
  const team = ntFor(G, p);
  const squad = callUp(G, team);
  const nat = p.nat;
  if (!squad) {
    if (team.youth || p.ca > team.level - 20) G.user.lastSnub = G.date;
    return;
  }
  const comp = compName(G, nat, team, ymd(G.date).m);
  const conf = NATIONS[nat].conf;
  const matches = [3, 6].map(k => ({ d: G.date + k, opp: pickOpp(rng, nat, conf === "CONMEBOL" || conf === "CONCACAF" ? "ALL" : conf), comp }));
  G.camp = { team: team.name, youth: team.youth, level: team.level, max: team.max, nat, squad: squad.filter(q => !q.virtual).map(q => q.id), matches, end: G.date + 8 };
  p.away = true;
  const first = !(G.user.int.calls || {})[team.name];
  G.user.int.calls = G.user.int.calls || {}; G.user.int.calls[team.name] = (G.user.int.calls[team.name] || 0) + 1;
  addMail(G, `Panggilan timnas ${NATIONS[nat].name}${team.youth ? " " + team.name : ""}`, `${first ? "Untuk pertama kalinya, kamu" : "Kamu"} dipanggil ke skuad ${NATIONS[nat].name}${team.youth ? " " + team.name : ""} untuk ${comp.toLowerCase()} melawan ${NATIONS[matches[0].opp].name} (${fmt(matches[0].d)}) dan ${NATIONS[matches[1].opp].name} (${fmt(matches[1].d)}).`, "good");
}

function startTournament(G, rng, T) {
  const p = userP(G), nat = p.nat, lv = NATIONS[nat].level;
  const y = ymd(G.date).y;
  const team = { name: "Senior", max: 99, level: lv, youth: false };
  if (ageOn(p.birth, G.date) < 17) return;
  if (!rng.chance(T.q(lv))) { addNews(G, `${NATIONS[nat].name} gagal lolos ke ${T.name} ${y}.`); return; }
  const squad = callUp(G, team);
  if (!squad) { addNews(G, `${NATIONS[nat].name} tampil di ${T.name} ${y}, tapi kamu tidak masuk skuad.`); return; }
  const conf = T.conf;
  const groupOpp = [];
  while (groupOpp.length < 3) { const o = pickOpp(rng, nat, conf, false); if (!groupOpp.includes(o)) groupOpp.push(o); }
  const start = G.date;
  const matches = groupOpp.map((o, i) => ({ d: start + 1 + i * 4, opp: o, comp: `${T.name} ${y} · Grup` }));
  G.camp = {
    team: "Senior", youth: false, level: lv, max: 99, nat, squad: squad.filter(q => !q.virtual).map(q => q.id), matches, end: start + 60,
    tour: { id: T.id, name: `${T.name} ${y}`, ko: T.ko, stage: 0, group: [nat, ...groupOpp].map(n => ({ n, p: 0, gd: 0, gf: 0 })), alive: true, conf },
  };
  p.away = true;
  addMail(G, `${T.name} ${y}`, `Kamu masuk skuad ${NATIONS[nat].name} untuk ${T.name} ${y}! Lawan di fase grup: ${groupOpp.map(o => NATIONS[o].name).join(", ")}.`, "good");
  addNews(G, `${NATIONS[nat].name} mengumumkan skuad ${T.name}; ${fullName(p)} termasuk di dalamnya.`);
}

// After the user's national match is played
export function afterIntlMatch(G, rng, match, score) {
  const c = G.camp; if (!c) return;
  const T = c.tour;
  if (!T) return;
  const [gf, ga] = score;
  const nat = c.nat;
  if (T.stage === 0) {
    const row = T.group.find(r => r.n === nat), opp = T.group.find(r => r.n === match.opp);
    const res = (a, b, ra, rb) => { ra.gf += a; rb.gf += b; ra.gd += a - b; rb.gd += b - a; if (a > b) ra.p += 3; else if (a < b) rb.p += 3; else { ra.p++; rb.p++; } };
    res(gf, ga, row, opp);
    // the other two teams play each other on matchday
    const others = T.group.filter(r => r.n !== nat && r.n !== match.opp);
    if (others.length === 2) { const [a, b] = others; const [x, y] = quickScore(rng, a.n, b.n); res(x, y, a, b); }
    T.played = (T.played || 0) + 1;
    if (T.played === 3) {
      const tb = T.group.slice().sort((a, b) => b.p - a.p || b.gd - a.gd || b.gf - a.gf);
      const pos = tb.findIndex(r => r.n === nat) + 1;
      const thirdOK = pos === 3 && tb[2].p >= 4 && T.ko.length >= 4;
      if (pos <= 2 || thirdOK) { T.stage = 1; nextKO(G, rng); addMail(G, T.name, `${NATIONS[nat].name} lolos dari fase grup sebagai peringkat ${pos}.`, "good"); }
      else { T.alive = false; c.end = G.date + 1; addMail(G, T.name, `${NATIONS[nat].name} tersingkir di fase grup (peringkat ${pos}).`, "bad"); }
    }
    return;
  }
  // knockout
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
  const pool = nationsOf(T.conf).filter(k => k !== c.nat && !T.group.some(r => r.n === k));
  const opp = rng.weighted(pool, k => NATIONS[k].level ** (2 + strongBias * 4));
  c.matches.push({ d: G.date + 4, opp, comp: `${T.name} · ${T.ko[T.stage - 1]}`, ko: true });
  c.end = G.date + 6;
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
