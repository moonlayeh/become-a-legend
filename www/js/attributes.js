// Attribute model (1–20 scale) and current-ability (CA, 1–200) maths.
import { clamp } from "./rng.js";

export const ATTRS = [
  // Teknik 0–13
  ["cor","Tendangan Pojok","T"],["cro","Umpan Silang","T"],["dri","Menggiring","T"],["fin","Penyelesaian","T"],
  ["fir","Kontrol Pertama","T"],["fre","Tendangan Bebas","T"],["hea","Sundulan","T"],["lon","Tembakan Jauh","T"],
  ["lth","Lemparan Jauh","T"],["mar","Menjaga Lawan","T"],["pas","Umpan","T"],["pen","Penalti","T"],
  ["tck","Tekel","T"],["tec","Teknik","T"],
  // Mental 14–27
  ["agg","Agresi","M"],["ant","Antisipasi","M"],["bra","Keberanian","M"],["cmp","Ketenangan","M"],
  ["cnt","Konsentrasi","M"],["dec","Keputusan","M"],["det","Determinasi","M"],["fla","Kreativitas","M"],
  ["ldr","Kepemimpinan","M"],["otb","Pergerakan","M"],["pos","Penempatan Posisi","M"],["tea","Kerja Sama","M"],
  ["vis","Visi","M"],["wor","Etos Kerja","M"],
  // Fisik 28–35
  ["acc","Akselerasi","F"],["agi","Kelincahan","F"],["bal","Keseimbangan","F"],["jum","Lompatan","F"],
  ["nat","Kebugaran Alami","F"],["pac","Kecepatan","F"],["sta","Stamina","F"],["str","Kekuatan","F"],
  // Kiper 36–46
  ["aer","Jangkauan Udara","K"],["cmd","Penguasaan Area","K"],["com","Komunikasi","K"],["ecc","Eksentrisitas","K"],
  ["han","Tangkapan","K"],["kic","Tendangan","K"],["ovo","Satu Lawan Satu","K"],["ref","Refleks","K"],
  ["rus","Keluar Sarang","K"],["pun","Kecenderungan Meninju","K"],["thr","Lemparan","K"],
];
export const A = Object.fromEntries(ATTRS.map((a, i) => [a[0], i]));
export const N_ATTR = ATTRS.length;
export const GROUPS = { T: "Teknik", M: "Mental", F: "Fisik", K: "Kiper" };
export const PHYSICAL_DECLINE = ["acc", "pac", "agi", "sta", "jum", "bal", "nat"].map(k => A[k]);

// Key attributes per position (weight 3), useful (1.5); the rest 1, set-piece & irrelevant lower.
const KEY = {
  GK: ["aer","cmd","com","han","kic","ovo","ref","rus","thr","pos","cnt","dec","agi"],
  DC: ["mar","tck","hea","pos","str","jum","ant","cnt","cmp","bra","dec"],
  DR: ["tck","mar","cro","pac","sta","acc","pos","wor","tea","ant"],
  WBR: ["cro","dri","pac","sta","acc","wor","tea","tck","otb","tec"],
  DM: ["tck","pos","pas","ant","dec","tea","wor","sta","cnt","mar"],
  MC: ["pas","vis","dec","fir","tec","tea","wor","sta","otb","cmp"],
  MR: ["cro","dri","pac","sta","acc","wor","tea","pas","tec","otb"],
  AMR: ["dri","cro","pac","acc","tec","fla","otb","agi","fir","fin"],
  AMC: ["vis","pas","tec","fla","fir","dri","otb","dec","cmp","lon"],
  ST: ["fin","otb","cmp","fir","ant","hea","pac","acc","dri","str"],
};
KEY.DL = KEY.DR; KEY.WBL = KEY.WBR; KEY.ML = KEY.MR; KEY.AML = KEY.AMR;
const USEFUL = ["dec","ant","cmp","tec","fir","pac","acc","agi","bal","str","sta","nat","pas","wor","tea","cnt","pos"];
const LOW = ["cor","fre","lth","pen","ldr","det","agg","ecc","pun"];
const GK_ONLY = ["aer","cmd","com","ecc","han","kic","ovo","ref","rus","pun","thr"];

export const WEIGHTS = {};
for (const p of Object.keys(KEY)) {
  const w = new Array(N_ATTR).fill(1);
  for (const k of LOW) w[A[k]] = 0.25;
  for (const k of USEFUL) w[A[k]] = 1.5;
  if (p !== "GK") for (const k of GK_ONLY) w[A[k]] = 0;
  else for (const [k, , g] of ATTRS) if (g === "T" && !["fir","pas"].includes(k)) w[A[k]] = 0.15;
  for (const k of KEY[p]) w[A[k]] = 3;
  w.sum = w.reduce((s, x) => s + x, 0);
  WEIGHTS[p] = w;
}

// CA from attributes for a given position (floats allowed)
export function abilityFor(attrs, pos) {
  const w = WEIGHTS[pos];
  let s = 0;
  for (let i = 0; i < N_ATTR; i++) s += attrs[i] * w[i];
  const mean = s / w.sum;
  return clamp(Math.round((mean - 1) * 10.6), 1, 200);
}

// Position familiarity 1–20 → multiplier on ability when playing there
export function familiarityFactor(f) {
  if (!f) return 0.6;
  if (f >= 18) return 1;
  if (f >= 13) return 0.95;
  if (f >= 9) return 0.88;
  if (f >= 5) return 0.78;
  return 0.68;
}

export function bestPosition(p) {
  let best = null, bv = -1;
  for (const [pos, f] of Object.entries(p.positions)) if (f > bv) { bv = f; best = pos; }
  return best;
}

export const band = v => (v <= 5 ? 1 : v <= 10 ? 2 : v <= 15 ? 3 : 4);
