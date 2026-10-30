// Derived, read-only data for the interface: roles, reputation, words for numbers,
// training schedules, staff, message senders, club profiles.
import { RNG, clamp } from "./rng.js";
import { NATIONS, NAMES, LEAGUES, PROMO, POOL_DROP } from "./data.js";
import { CONTINENTAL, PLAYOFFS } from "./compdata.js";
import { A, WEIGHTS, ATTRS, abilityFor } from "./attributes.js";
import { ymd, ageOn, day, seasonOf } from "./calendar.js";
import { INTL_WINDOWS } from "./world.js";

export const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- roles ----------
const R = (name, key) => ({ name, key });
export const ROLES = {
  GK: [R("Kiper", ["ref", "han", "pos", "cnt", "aer"]), R("Kiper Penyapu", ["rus", "ovo", "kic", "acc", "ant"]), R("Kiper Pengumpan", ["kic", "pas", "fir", "vis", "cmp"])],
  DC: [R("Bek Tengah", ["mar", "tck", "hea", "pos", "jum", "str"]), R("Bek Pengumpan", ["pas", "cmp", "vis", "dec", "tck"]), R("Bek Tanpa Kompromi", ["hea", "str", "bra", "agg", "tck"])],
  DR: [R("Bek Sayap", ["tck", "mar", "pos", "cro", "ant"]), R("Bek Sayap Menyerang", ["cro", "dri", "sta", "pac", "otb"]), R("Bek Sayap Terbalik", ["pas", "dec", "cmp", "tck", "pos"])],
  WBR: [R("Wing-back", ["cro", "sta", "pac", "wor", "tck"]), R("Wing-back Menyerang", ["cro", "dri", "otb", "acc", "fla"])],
  DM: [R("Gelandang Penghancur", ["tck", "agg", "wor", "sta", "pos"]), R("Jangkar", ["pos", "ant", "cnt", "dec", "mar"]), R("Playmaker Dalam", ["pas", "vis", "cmp", "dec", "tec"])],
  MC: [R("Box-to-Box", ["sta", "wor", "pas", "otb", "tck"]), R("Playmaker", ["pas", "vis", "tec", "dec", "fla"]), R("Gelandang Pendukung", ["pas", "tea", "wor", "dec", "pos"])],
  MR: [R("Gelandang Sayap", ["cro", "sta", "wor", "pas", "pac"]), R("Pekerja Sayap", ["wor", "sta", "tck", "tea", "pos"])],
  AMR: [R("Penyerang Sayap", ["dri", "acc", "pac", "cro", "fla"]), R("Inside Forward", ["fin", "dri", "acc", "otb", "cmp"]), R("Playmaker Sayap", ["pas", "vis", "tec", "dri", "dec"])],
  AMC: [R("Gelandang Serang", ["otb", "fin", "lon", "dri", "pas"]), R("Trequartista", ["fla", "vis", "tec", "fir", "dri"]), R("Penyerang Bayangan", ["otb", "fin", "ant", "acc", "cmp"])],
  ST: [R("Penyerang Murni", ["fin", "otb", "cmp", "ant", "acc"]), R("Target Man", ["hea", "str", "jum", "bra", "fin"]), R("False 9", ["pas", "vis", "fir", "tec", "dec"]), R("Penyerang Pekerja", ["wor", "sta", "agg", "acc", "ant"])],
};
ROLES.DL = ROLES.DR; ROLES.WBL = ROLES.WBR; ROLES.ML = ROLES.MR; ROLES.AML = ROLES.AMR;
export function roleStars(p, role) {
  const avg = role.key.reduce((s, k) => s + p.a[A[k]], 0) / role.key.length;
  return clamp(Math.round((avg - 4) / 3 * 2) / 2, 0.5, 5);
}
export function bestRole(p, pos = p.main) { const rs = ROLES[pos] || []; return rs.slice().sort((a, b) => roleStars(p, b) - roleStars(p, a))[0]; }
// key = role attributes; preferred = the position's other important attributes
export function attrHighlights(p, role, pos = p.main) {
  const key = new Set((role?.key || []).map(k => A[k]));
  const w = WEIGHTS[pos], pref = new Set();
  for (let i = 0; i < w.length; i++) if (w[i] >= 3 && !key.has(i)) pref.add(i);
  return { key, pref };
}

// ---------- positions ----------
export const FAM_WORDS = [[18, "Natural", "#6fd36b"], [15, "Mahir", "#b7e07a"], [12, "Cakap", "#e6d34a"], [8, "Kurang Meyakinkan", "#f1a33c"], [4, "Canggung", "#f07a3c"], [1, "Darurat", "#e5484d"]];
export const famWord = f => FAM_WORDS.find(([t]) => f >= t) || FAM_WORDS[FAM_WORDS.length - 1];
export function positionString(p, min = 13) {
  const has = k => (p.positions[k] || 0) >= min;
  const parts = [];
  if (has("GK")) parts.push(["GK", ""]);
  const grp = (label, R_, C_, L_) => { const s = (R_ && has(R_) ? "R" : "") + (L_ && has(L_) ? "L" : "") + (C_ && has(C_) ? "C" : ""); if (s) parts.push([label, s]); };
  grp("D", "DR", "DC", "DL"); grp("WB", "WBR", null, "WBL");
  if (has("DM")) parts.push(["DM", ""]);
  grp("M", "MR", "MC", "ML"); grp("AM", "AMR", "AMC", "AML");
  if (has("ST")) parts.push(["ST", "C"]);
  // merge M and AM with the same sides: "M/AM (C)"
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    const [l, s] = parts[i], nx = parts[i + 1];
    if (l === "M" && nx && nx[0] === "AM" && nx[1] === s) { out.push(`M/AM (${s})`); i++; continue; }
    out.push(s ? `${l} (${s})` : l);
  }
  return out.join(", ") || p.main;
}
export const PITCH_XY = { GK: [50, 93], DR: [86, 77], DC: [50, 79], DL: [14, 77], WBR: [88, 62], WBL: [12, 62], DM: [50, 64], MR: [86, 47], MC: [50, 49], ML: [14, 47], AMR: [84, 30], AMC: [50, 32], AML: [16, 30], ST: [50, 13] };

// ---------- words ----------
export const reputation = (G, p) => {
  const lg = G.clubs[p.club]?.league;
  const s = p.ca + (["IDN1", "IDN2", "MAS1", "THA1"].includes(lg) ? -15 : lg ? 6 : 0) + Math.min(20, (p.caps || 0) * 0.4) + ((p.isUser ? G.user.awards.length : 0) * 4);
  return s >= 165 ? "Seluruh Dunia" : s >= 148 ? "Kontinental" : s >= 128 ? "Nasional" : s >= 100 ? "Regional" : "Lokal";
};
export const clubReputation = c => { const v = c.level + (["IDN", "MAS", "THA", "BRN"].includes(c.nation) ? 38 : ["ZAF", "EGY", "MAR", "KSA"].includes(c.nation) ? 18 : 0); return v >= 158 ? "Seluruh Dunia" : v >= 142 ? "Kontinental" : v >= 118 ? "Nasional" : v >= 100 ? "Regional" : "Lokal"; };
export const REP_COLOR = { "Seluruh Dunia": "#7ad36b", Kontinental: "#a6d84f", Nasional: "#e6d34a", Regional: "#e8a23c", Lokal: "#b9b9b9" };
export const footWord = v => (v >= 18 ? "Sangat Kuat" : v >= 15 ? "Kuat" : v >= 12 ? "Sedang" : v >= 9 ? "Cukup" : v >= 5 ? "Lemah" : "Sangat Lemah");
export const footLevel = v => clamp(Math.round(v / 20 * 6), 1, 6);
export const fitnessWord = c => (c >= 95 ? "Puncak" : c >= 86 ? "Bugar" : c >= 76 ? "Agak lelah" : c >= 62 ? "Lelah" : "Sangat lelah");
export const moraleWord = m => (m >= 82 ? "Senang sekali" : m >= 66 ? "Senang" : m >= 50 ? "Puas" : m >= 35 ? "Kurang senang" : "Kecewa");
export const moraleFace = m => (m >= 82 ? "😄" : m >= 66 ? "🙂" : m >= 50 ? "😐" : m >= 35 ? "🙁" : "😠");
export const abilityWord = v => (v >= 16 ? "Luar Biasa" : v >= 13.5 ? "Sangat Baik" : v >= 11 ? "Baik" : v >= 8.5 ? "Rata-rata" : v >= 6 ? "Kurang" : "Lemah");
export const WORD_COLOR = { "Luar Biasa": "#6fd36b", "Sangat Baik": "#a6d84f", Baik: "#e6d34a", "Rata-rata": "#cfcfcf", Kurang: "#f1a33c", Lemah: "#e5484d" };
export const facilityWord = v => (v >= 18 ? "Luar biasa" : v >= 15.5 ? "Sangat baik" : v >= 13 ? "Baik" : v >= 10 ? "Cukup" : v >= 7 ? "Memadai" : "Dasar");
export function facilities(c) {
  const train = clamp((c.level - 60) / 6, 1, 20);
  return [["Latihan", facilityWord(train)], ["Pemain Muda", facilityWord(c.youth + 1)], ["Rekrutmen Pemain Muda", facilityWord(c.youth)], ["Stadion", facilityWord(clamp((c.level - 50) / 6, 1, 20))]];
}
export const severity = days => (days >= 60 ? 4 : days >= 21 ? 3 : days >= 8 ? 2 : 1);
export const severityWord = d => ["", "Ringan", "Sedang", "Serius", "Parah"][severity(d)];
export function returnRange(days) {
  if (days < 7) return `${days} hari`;
  const w = days / 7;
  if (w < 9) return `${Math.max(1, Math.floor(w * 0.8))}–${Math.ceil(w * 1.2)} minggu`;
  const m = days / 30;
  return `${Math.max(1, Math.floor(m * 0.85))}–${Math.ceil(m * 1.15)} bulan`;
}

// ---------- club profile ----------
export function clubExpectation(G, c) {
  const L = G.leagues[c.league]; if (!L) return "";
  const ranked = L.teams.slice().sort((a, b) => G.clubs[b].level - G.clubs[a].level);
  const r = ranked.indexOf(c.id) + 1, n = ranked.length;
  return r <= 3 ? "Tantangan Gelar" : r <= 6 ? "Kualifikasi Eropa" : r <= Math.ceil(n / 2) ? "Paruh atas" : r <= n - 4 ? "Papan tengah" : "Pejuang Degradasi";
}
export function predictedFinish(G, c) {
  const L = G.leagues[c.league]; if (!L) return null;
  return L.teams.slice().sort((a, b) => G.clubs[b].level - G.clubs[a].level).indexOf(c.id) + 1;
}
export function clubCulture(c) {
  const out = [];
  if (c.policy === "basque") out.push("Hanya merekrut pemain asal Basque/Spanyol");
  if (c.youth >= 17) out.push("Memberi kesempatan pemain akademi di tim utama");
  else if (c.youth >= 14) out.push("Mengembangkan pemain muda");
  if (c.level >= 150) out.push("Bersaing memperebutkan gelar setiap musim");
  out.push(`Bermain dengan formasi ${c.formation}`);
  return out;
}

// ---------- staff (generated, stable per club) ----------
const STAFF_ROLES = [["Manajer", 1, 42, 62], ["Asisten Manajer", 1, 40, 60], ["Pelatih Kepala Akademi", 1, 38, 60], ["Pelatih U-19", 1, 32, 55], ["Pelatih", 3, 30, 58], ["Pelatih Kiper", 1, 35, 58], ["Pelatih Kebugaran", 2, 28, 50], ["Dokter Tim", 1, 35, 62], ["Fisioterapis", 2, 26, 55], ["Direktur Olahraga", 1, 40, 65], ["Kepala Pemandu Bakat", 1, 35, 60], ["Analis Performa", 2, 24, 45]];
const staffCache = {};
export function staffOf(G, clubId) {
  if (staffCache[clubId]) return staffCache[clubId];
  const c = G.clubs[clubId]; const r = new RNG(hash("staff" + clubId));
  const out = [];
  for (const [role, n, a0, a1] of STAFF_ROLES) for (let i = 0; i < n; i++) {
    const nat = r.chance(0.72) ? c.nation : r.pick(Object.keys(NATIONS).filter(k => NATIONS[k].level >= 110));
    const pool = NAMES[NATIONS[nat].lang];
    out.push({ role, name: `${r.pick(pool.first)} ${r.pick(pool.last)}`, nat, age: r.int(a0, a1), until: seasonOf(G.date) + r.int(1, 4) });
  }
  return (staffCache[clubId] = out);
}
const NT_COACH = {};
export function ntCoach(nat) {
  if (NT_COACH[nat]) return NT_COACH[nat];
  const r = new RNG(hash("nt" + nat)); const pool = NAMES[NATIONS[nat].lang];
  return (NT_COACH[nat] = `${r.pick(pool.first)} ${r.pick(pool.last)}`);
}
export function agentName(G) { const r = new RNG(hash("agent" + G.seed)); const pool = NAMES[NATIONS[G.players[G.user.pid].nat].lang]; return `${r.pick(pool.first)} ${r.pick(pool.last)}`; }

// ---------- messages: category & sender ----------
const CAT_RULES = [
  [/cedera|pulih|medis/i, "Cedera", "Dokter Tim"], [/kontrak|gaji/i, "Kontrak", "Direktur Olahraga"],
  [/transfer|tawaran|pinjam|bebas|federasi/i, "Transfer", "agen"], [/timnas|panggilan|piala|kualifikasi|juara.*!$/i, "Timnas", "nt"],
  [/perkembangan|latihan/i, "Latihan", "Pelatih"], [/musim|ringkasan/i, "Kompetisi", "Asisten Manajer"],
  [/bola emas|penghargaan/i, "Penghargaan", "Media"], [/bahasa/i, "Pribadi", "agen"], [/pensiun/i, "Karier", "agen"],
  [/debut|naik|akademi|selamat datang|dilepas/i, "Klub", "Pelatih Kepala Akademi"],
];
export function mailMeta(G, m) {
  let cat = m.cat, role = null;
  if (!cat) for (const [re, c, r] of CAT_RULES) if (re.test(m.title)) { cat = c; role = r; break; }
  if (!cat) { cat = "Klub"; role = "Asisten Manajer"; }
  if (!role) role = (CAT_RULES.find(x => x[1] === cat) || [])[2] || "Asisten Manajer";
  let from = m.from;
  if (!from) {
    if (role === "agen") from = `${agentName(G)} (Agen)`;
    else if (role === "nt") from = `${ntCoach(G.user.fed || G.players[G.user.pid].nat)} (Pelatih Timnas)`;
    else if (role === "Media") from = "Redaksi Sepak Bola";
    else { const club = G.clubs[G.players[G.user.pid].club]; const s = club && staffOf(G, club.id).find(x => x.role === role); from = s ? s.name : role; }
  } else if (!/\(/.test(from)) {
    const club = G.clubs[G.players[G.user.pid].club]; const s = club && staffOf(G, club.id).find(x => x.role === from); if (s) from = s.name;
  }
  const time = `${String(8 + (m.id * 7) % 12).padStart(2, "0")}:${String((m.id * 13) % 60).padStart(2, "0")}`;
  return { cat, from, time };
}
export const CAT_COLOR = { Cedera: "#2c6fd6", Kontrak: "#7b3fd6", Transfer: "#1f8a5b", Timnas: "#c23b3b", Latihan: "#2a7f8f", Kompetisi: "#b03a6b", Penghargaan: "#b8860b", Pribadi: "#6b6b6b", Karier: "#6b6b6b", Klub: "#4a5bd6" };

// ---------- training schedule (club-wide, derived from fixtures) ----------
export const SESS = {
  fis: ["Kondisi Fisik", "fis"], fisB: ["Kondisi Fisik Berat", "fis"], fisR: ["Kondisi Fisik Ringan", "fis"], pul: ["Pemulihan", "fis"],
  ist: ["Istirahat", "rest"], ser: ["Membangun Serangan", "tak"], pel: ["Menciptakan Peluang", "tak"], pre: ["Intensitas Pressing", "tak"],
  jeb: ["Jebakan Pressing", "tak"], bmb: ["Bentuk Saat Menguasai Bola", "tak"], btm: ["Bentuk Saat Tidak Menguasai Bola", "tak"],
  gop: ["Gaya Operan", "tak"], gar: ["Garis Tekanan", "tak"], lbm: ["Latihan Bola Menyerang", "bola"], lbb: ["Latihan Bola Bertahan", "bola"],
  lpb: ["Latihan Penguasaan Bola", "bola"], ind: ["Pengembangan Individu", "ind"], mat: ["Persiapan Laga", "tak"], bmt: ["Bola Mati", "tak"],
};
const WEEK = [["fisR", "gop", "gar"], ["fis", "ser", "pre"], ["fisB", "pel", "jeb"], ["fisB", "bmb", "btm"], ["lbm", "lbb", "lpb"], ["fisB", "ind", "ind"], ["pul", "ist", "ist"]];
const SEASON_WEEK = [["fisR", "gop", "lpb"], ["fis", "ser", "pel"], ["ind", "bmb", "btm"], ["fisR", "lbm", "pre"], ["fisR", "mat", "bmt"], ["fis", "ind", "lpb"], ["pul", "ist", "ist"]];
// all fixtures of a club: league, play-offs, cups and continental games (youth = U-19 competitions)
export function clubMatchDays(G, clubId, youth = false) {
  const c = G.clubs[clubId]; const L = c && G.leagues[c.league];
  const out = new Map();
  const put = (f, comp, compName, src) => out.set(f.d, { opp: f.h === clubId ? f.a : f.h, ha: f.neutral ? "N" : f.h === clubId ? "K" : "T", comp, compName, res: f.res ? (f.h === clubId ? f.res : [f.res[1], f.res[0]]) : null, f, src });
  if (L && !youth) for (const f of L.fixtures) if (f.h === clubId || f.a === clubId) put(f, L.short, L.name, L.id);
  if (G.friendly && G.friendly.club === clubId) for (const f of G.friendly.fixtures) if (!!f.youth === youth) put(f, "PS", youth ? "Laga Persahabatan U-19" : "Laga Persahabatan", "friendly");
  for (const cp of Object.values(G.comps || {})) {
    if (!!cp.youth !== youth) continue;
    for (const f of cp.fixtures) if (f.h === clubId || f.a === clubId) {
      const S = cp.stages[f.st];
      put(f, cp.short, `${cp.name}${S ? " · " + (S.type === "groups" ? `Grup ${String.fromCharCode(65 + f.g)}` : S.type === "league" && S.names ? S.names[f.g] : S.name) : ""}`, cp.id);
    }
  }
  return out;
}
// the user's calendar: academy players also see their U-19 competition games
export function userMatchDays(G) {
  const u = G.players[G.user.pid];
  const md = clubMatchDays(G, u.club);
  if (u.squad === "Y") for (const [d, m] of clubMatchDays(G, u.club, true)) if (!md.has(d)) md.set(d, { ...m, youth: true, comp: m.comp + " U-19" });
  return md;
}
// table zones: continental places, promotion, play-offs, relegation → [{n, cls, label}] from the top and from the bottom
export function leagueZones(G, lid) {
  const L = G.leagues[lid]; if (!L) return { top: [], bottom: [] };
  const top = [], bottom = [];
  if (PLAYOFFS[lid]) top.push({ n: 8, cls: "zc", label: "Fase gugur" });
  else {
    for (const def of CONTINENTAL) { const n = def.slots?.[lid]; if (n) top.push({ n, cls: top.length ? "ze" : "zt", label: def.short }); }
    const up = PROMO.find(p => p.down === lid);
    if (up && up.mode !== "zones") { top.push({ n: up.n - 1, cls: "zp", label: "Promosi" }); top.push({ n: up.mode === "po" ? 4 : 1, cls: "zo", label: "Play-off" }); }
    if (up && up.mode === "zones") { top.push({ n: 1, cls: "zp", label: "Promosi" }); top.push({ n: 1, cls: "zo", label: "Play-off" }); }
  }
  const down = PROMO.find(p => p.up === lid);
  if (down) { if (down.mode === "rpo") { bottom.push({ n: 1, cls: "zo", label: "Play-off" }); bottom.push({ n: down.n - 1, cls: "zr", label: "Degradasi" }); } else bottom.push({ n: down.n, cls: "zr", label: "Degradasi" }); }
  if (POOL_DROP[lid]) { if (L.zones) { bottom.push({ n: 1, cls: "zo", label: "Play-off" }); bottom.push({ n: 1, cls: "zr", label: "Degradasi" }); } else bottom.push({ n: POOL_DROP[lid], cls: "zr", label: "Degradasi" }); }
  return { top, bottom };
}
export function zoneOf(z, i, n) {
  let k = 0;
  for (const t of z.top) { if (i < k + t.n) return t.cls; k += t.n; }
  k = 0;
  for (const b of z.bottom.slice().reverse()) { if (i >= n - k - b.n) return b.cls; k += b.n; }
  return "";
}
export function sessionsFor(G, clubId, n, md = clubMatchDays(G, clubId)) {
  const { m, d, wd } = ymd(n);
  if (m === 6 || (m === 7 && d < 6)) return { off: true, label: "Libur akhir musim skuad" };
  if (md.has(n)) return { match: md.get(n) };
  if (md.has(n - 1)) return { s: ["pul", "ist", "ist"] };
  if (md.has(n + 1)) return { s: ["fisR", "mat", "bmt"] };
  const idx = (wd + 6) % 7;
  const pre = m === 7 || (m === 8 && d < 12);
  return { s: (pre ? WEEK : SEASON_WEEK)[idx] };
}
export const SESS_COLOR = { fis: "#7a2633", tak: "#1f5a3d", bola: "#5a2a6b", ind: "#5a2a6b", rest: "#3a3f47" };

// ---------- calendar events for a month view ----------
export function calendarEvents(G, n) {
  const u = G.players[G.user.pid];
  const ev = [];
  const { m, d } = ymd(n);
  if ((m === 7 && d === 1) || (m === 1 && d === 1)) ev.push({ t: "Jendela transfer dibuka", k: "trf" });
  if ((m === 9 && d === 1) || (m === 2 && d === 1)) ev.push({ t: "Jendela transfer ditutup", k: "trf" });
  if (INTL_WINDOWS.some(([wm, wd]) => m === wm && d === wd)) ev.push({ t: "Jeda internasional", k: "nt" });
  if (m === 6 && d === 1) ev.push({ t: "Akhir musim", k: "season" });
  if (m === 7 && d === 6) ev.push({ t: "Awal pramusim", k: "season" });
  const b = ymd(u.birth); if (b.m === m && b.d === d) ev.push({ t: `Ulang tahun ke-${ageOn(u.birth, n)}`, k: "me" });
  if (u.injury && u.injury.since != null && n === G.date + u.injury.days) ev.push({ t: "Perkiraan pulih", k: "med" });
  if (G.camp) for (const mt of G.camp.matches) if (mt.d === n) ev.push({ t: `${mt.comp}: vs ${NATIONS[mt.opp].name}`, k: "nt" });
  return ev;
}

// ---------- league attribute words for the creation preview ----------
export function groupWords(p) {
  const g = { T: [], M: [], F: [], K: [] };
  ATTRS.forEach(([k, , grp], i) => g[grp].push(p.a[i]));
  const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
  return { T: avg(g.T), M: avg(g.M), F: avg(g.F), K: avg(g.K) };
}
