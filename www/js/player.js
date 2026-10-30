// Player generation, ability, value, personality.
import { clamp } from "./rng.js";
import { NATIONS, NAMES, BLOCKED_NAMES } from "./data.js";
import { ATTRS, A, N_ATTR, WEIGHTS, abilityFor, familiarityFactor } from "./attributes.js";
import { ageOn } from "./calendar.js";

const SECONDARY = {
  GK: [], DC: ["DR","DL","DM"], DR: ["WBR","DC","MR"], DL: ["WBL","DC","ML"], WBR: ["DR","MR"], WBL: ["DL","ML"],
  DM: ["MC","DC"], MC: ["DM","AMC","MR","ML"], MR: ["AMR","WBR","MC"], ML: ["AML","WBL","MC"],
  AMR: ["MR","AML","ST","AMC"], AML: ["ML","AMR","ST","AMC"], AMC: ["MC","ST","AMR","AML"], ST: ["AMC","AMR","AML"],
};

const HEIGHT = { GK: [186, 6], DC: [187, 5], DR: [178, 5], DL: [178, 5], WBR: [176, 5], WBL: [176, 5], DM: [182, 5], MC: [178, 6], MR: [175, 6], ML: [175, 6], AMR: [174, 6], AML: [174, 6], AMC: [175, 6], ST: [182, 7] };

export function ability(p, pos) {
  const base = abilityFor(p.a, pos || p.main);
  return base;
}
// Ability actually delivered in a slot, including familiarity
export function slotRating(p, pos) {
  const f = p.positions[pos] || 0;
  return abilityFor(p.a, pos) * familiarityFactor(f);
}

export function refreshCA(p) { p.ca = abilityFor(p.a, p.main); return p.ca; }

export function genName(rng, nat) {
  const pool = NAMES[NATIONS[nat].lang];
  for (let i = 0; ; i++) {
    const fn = rng.pick(pool.first), ln = rng.pick(pool.last);
    const full = NATIONS[nat].lang === "kr" || NATIONS[nat].lang === "vn" ? `${ln} ${fn}` : `${fn} ${ln}`;
    if (!BLOCKED_NAMES.has(full) && !BLOCKED_NAMES.has(`${fn} ${ln}`) || i > 8) return { fn, ln };
  }
}

export function shapeAttributes(rng, pos, targetCA, age) {
  const w = WEIGHTS[pos];
  const isGK = pos === "GK";
  const mean = targetCA / 10.6 + 1;
  const a = new Array(N_ATTR);
  for (let i = 0; i < N_ATTR; i++) {
    const [key, , g] = ATTRS[i];
    let v;
    if (!isGK && g === "K") v = rng.float(1, 4);
    else if (isGK && g === "T" && !["fir", "pas", "pen"].includes(key)) v = rng.float(1, mean * 0.55 + 2);
    else if (w[i] >= 3) v = mean + 1.2 + rng.normal(0, 1.6);
    else if (w[i] >= 1.5) v = mean + rng.normal(0, 1.8);
    else v = mean - 1 + rng.normal(0, 3);
    a[i] = v;
  }
  // youngsters are physically raw, mentally inexperienced
  if (age < 20) {
    const y = 20 - age;
    a[A.str] -= y * 0.7; a[A.sta] -= y * 0.4; a[A.cmp] -= y * 0.35; a[A.dec] -= y * 0.3; a[A.ldr] -= y * 0.4;
    a[A.acc] += y * 0.15; a[A.agi] += y * 0.15;
  }
  if (age > 30) { const o = age - 30; a[A.pac] -= o * 0.4; a[A.acc] -= o * 0.4; a[A.dec] += o * 0.2; a[A.ldr] += o * 0.3; }
  for (let i = 0; i < N_ATTR; i++) a[i] = clamp(a[i], 1, 20);
  // nudge onto target CA
  for (let it = 0; it < 25; it++) {
    const ca = abilityFor(a, pos);
    const diff = targetCA - ca;
    if (Math.abs(diff) <= 1) break;
    const step = diff / 10.6;
    for (let i = 0; i < N_ATTR; i++) if (w[i] >= 1) a[i] = clamp(a[i] + step * (0.6 + rng.next() * 0.8), 1, 20);
  }
  for (let i = 0; i < N_ATTR; i++) a[i] = Math.round(a[i] * 10) / 10;
  return a;
}

export function genPlayer(rng, o) {
  // o: { id, nat, pos, ca, pa, birth, club, squad, today }
  const pos = o.pos;
  const age = ageOn(o.birth, o.today);
  const { fn, ln } = o.fn ? o : genName(rng, o.nat);
  const positions = { [pos]: 20 };
  const sec = SECONDARY[pos] || [];
  for (const s of sec) if (rng.chance(0.45)) positions[s] = rng.int(8, 17);
  if (rng.chance(0.15) && sec.length) positions[rng.pick(sec)] = rng.int(17, 19);
  const [hm, hs] = HEIGHT[pos];
  const height = Math.round(clamp(rng.normal(hm, hs) - Math.max(0, 18 - age) * 2, 155, 203));
  const weight = Math.round(height - 105 + rng.normal(0, 4) - Math.max(0, 18 - age) * 2);
  let foot = rng.chance(0.74) ? "Kanan" : rng.chance(0.85) ? "Kiri" : "Dua kaki";
  if (["DL", "WBL", "ML", "AML"].includes(pos) && rng.chance(0.5)) foot = "Kiri";
  const wf = foot === "Dua kaki" ? rng.int(15, 19) : Math.round(clamp(rng.normal(8, 3.5), 1, 16));
  const a = shapeAttributes(rng, pos, o.ca, age);
  if (height > 188) { a[A.jum] = clamp(a[A.jum] + 1.5, 1, 20); a[A.hea] = clamp(a[A.hea] + 1, 1, 20); a[A.agi] = clamp(a[A.agi] - 1, 1, 20); }
  const hid = {
    con: rngAttr(rng), imp: rngAttr(rng), inj: rngAttr(rng), pro: rngAttr(rng), amb: rngAttr(rng),
    pre: rngAttr(rng), tem: rngAttr(rng), adp: rngAttr(rng), loy: rngAttr(rng), spo: rngAttr(rng),
  };
  const p = {
    id: o.id, fn, ln, nat: o.nat, birth: o.birth, birthplace: o.birthplace || "",
    club: o.club, squad: o.squad || "A", main: pos, positions, foot, wf, height, weight,
    a, ca: 0, pa: o.pa, hid, cond: 100, sharp: 60, morale: 65, injury: null, ban: 0,
    contract: null, form: [], st: newStats(), caps: 0, intGoals: 0, retired: false,
  };
  refreshCA(p);
  p.pa = Math.max(p.pa, p.ca);
  return p;
}
const rngAttr = rng => Math.round(clamp(rng.normal(11, 4), 1, 20));

export const newStats = () => ({ apps: 0, sub: 0, min: 0, gls: 0, ast: 0, rsum: 0, rn: 0, motm: 0, yc: 0, rc: 0, cs: 0, pom: 0 });

export function personality(p) {
  const h = p.hid, det = p.a[A.det];
  if (h.pro >= 18 && det >= 16) return "Profesional Teladan";
  if (h.pro >= 15 && h.amb >= 15) return "Sangat Profesional";
  if (det >= 16 && h.amb >= 16) return "Ambisius Keras";
  if (h.amb >= 16) return "Ambisius";
  if (h.pro >= 15) return "Profesional";
  if (det >= 15 && h.pre >= 14) return "Ulet";
  if (h.loy >= 16 && h.pro >= 12) return "Setia";
  if (h.tem <= 6) return "Temperamental";
  if (h.pro <= 6 && det <= 8) return "Santai";
  if (h.amb <= 6) return "Tidak Ambisius";
  if (h.pro <= 7) return "Kurang Profesional";
  return "Seimbang";
}

// relative wage level per league (Premier League highest)
const LEAGUE_PAY = { ENG1: 1.25, ESP1: 1, ITA1: 0.95, GER1: 1, FRA1: 0.85, ENG2: 0.6, ESP2: 0.35, ITA2: 0.35, GER2: 0.45, FRA2: 0.3, POR1: 0.45, NED1: 0.5, BEL1: 0.45, KSA1: 1.1, USA1: 0.6, BRA1: 0.45, ARG1: 0.25, JPN1: 0.4, MAS1: 0.15, THA1: 0.15, RSA1: 0.18, EGY1: 0.2, MAR1: 0.18, IDN1: 0.12, IDN2: 0.05 };
// transfer-market level per league
const LEAGUE_VALUE = { IDN1: 0.35, IDN2: 0.2, MAS1: 0.35, THA1: 0.4, RSA1: 0.5, EGY1: 0.5, MAR1: 0.5, ARG1: 0.8, BRA1: 0.85, USA1: 0.8, JPN1: 0.75, KSA1: 0.9, ENG2: 0.9 };
export function marketValue(p, today, leagueId) {
  const age = ageOn(p.birth, today);
  let v = 0.002 * Math.exp(0.065 * p.ca); // € juta
  if (age <= 23) v *= 1 + Math.max(0, p.pa - p.ca) / 120 * (24 - age) / 6;
  if (age >= 29) v *= Math.max(0.15, 1 - (age - 28) * 0.13);
  v *= LEAGUE_VALUE[leagueId] ?? 1;
  return Math.max(0.01, v);
}
export function fairWage(p, leagueId) { // € per minggu
  return Math.round(120 * Math.exp(0.045 * p.ca) * (LEAGUE_PAY[leagueId] ?? 0.6) / 50) * 50;
}

export const fullName = p => `${p.fn} ${p.ln}`;
export const shortName = p => `${p.fn[0]}. ${p.ln}`;
