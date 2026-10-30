// Contracts from the player's side: negotiation with clubs (wage, bonuses, clauses, playing-time
// promises), the agent, earnings, promises, residency/naturalisation, homegrown status and the
// (simplified) UK work permit.
import { clamp, RNG } from "./rng.js";
import { A } from "./attributes.js";
import { NATIONS } from "./data.js";
import { ageOn, seasonOf, seasonLabel, fmt, ymd, day } from "./calendar.js";
import { addMail, addNews, userP, userClub, fifaU18Allowed, clubNatOK, needsLanguage } from "./world.js";
import { squadStatus, squadRank, playShare, decision, doTransfer, natFor, W, F, fed } from "./career.js";
import { fairWage, marketValue, fullName } from "./player.js";
import { hash, staffOf, reputation, agentName } from "./meta.js";

// ---------- playing-time statuses (promises) ----------
export const ROLE_PT = [
  ["Pemain Kunci", 0.82], ["Pemain Inti", 0.65], ["Pemain Rotasi", 0.4], ["Prospek Tim Utama", 0.25], ["Prospek Muda", 0.12], ["Pemain Cadangan", 0.08],
];
export const roleIndex = r => ROLE_PT.findIndex(x => x[0] === r);
export const roleShare = r => (ROLE_PT.find(x => x[0] === r) || ROLE_PT[3])[1];
// what a club would offer this player (status if he joined their squad)
export function clubRoleFor(G, p, clubId) {
  const club = G.clubs[clubId];
  if (!club) return "Pemain Rotasi";
  const age = ageOn(p.birth, G.date);
  const mates = club.squad.map(id => G.players[id]).filter(q => q && q.id !== p.id && (q.main === p.main || q.positions?.[p.main] >= 15));
  const better = mates.filter(q => q.ca > p.ca + 2).length;
  if (better === 0 && p.ca >= club.level) return "Pemain Kunci";
  if (better <= 1) return "Pemain Inti";
  if (better <= 2) return age <= 21 ? "Prospek Tim Utama" : "Pemain Rotasi";
  return age <= 21 ? "Prospek Muda" : "Pemain Cadangan";
}

// ---------- terms ----------
export const BONUS_KEYS = [["app", "Bayaran Penampilan"], ["goal", "Bonus Gol"], ["assist", "Bonus Assist"], ["unused", "Bayaran Pemain Cadangan Tak Terpakai"], ["cs", "Bonus Nirbobol"]];
export const CLAUSE_KEYS = [["raise", "Kenaikan Gaji Tahunan"], ["release", "Klausul Pelepasan Biaya Minimum"], ["relegRelease", "Klausul Pelepasan saat Degradasi"], ["promoRaise", "Kenaikan Gaji karena Promosi"], ["relegCut", "Penurunan Gaji karena Degradasi"]];
const r50 = v => Math.max(0, Math.round(v / 50) * 50);
function expectedStats(p, role) {
  const share = roleShare(role), apps = 38 * share;
  const gpg = { ST: 0.45, AMC: 0.28, AMR: 0.25, AML: 0.25, MR: 0.15, ML: 0.15, MC: 0.1, DM: 0.05, WBR: 0.05, WBL: 0.05, DR: 0.03, DL: 0.03, DC: 0.04, GK: 0 }[p.main] ?? 0.1;
  return { apps, goals: apps * gpg, assists: apps * gpg * 0.7, unused: 38 * (1 - share) * 0.5, cs: ["GK", "DC", "DR", "DL"].includes(p.main) ? apps * 0.3 : 0 };
}
// total cost of a set of terms for the club (euro), used to judge offers
export function termsCost(G, p, t, valueM) {
  const yrs = t.years;
  let wageTotal = 0;
  for (let k = 0; k < yrs; k++) wageTotal += t.wage * 52 * (1 + (t.raise || 0) / 100) ** k;
  const e = expectedStats(p, t.role);
  const b = t.bonuses || {};
  const bonus = ((b.app || 0) * e.apps + (b.goal || 0) * e.goals + (b.assist || 0) * e.assists + (b.unused || 0) * e.unused + (b.cs || 0) * e.cs) * yrs;
  const value = valueM * 1e6;
  const release = t.release ? Math.max(0, value * 3 - t.release * 1e6) * 0.12 : 0;
  const releg = (t.relegRelease ? t.wage * 52 * 0.3 : 0) - (t.relegCut ? t.wage * 52 * 0.15 * t.relegCut / 25 : 0);
  const promo = t.promoRaise ? t.wage * 52 * 0.1 * t.promoRaise / 25 : 0;
  return wageTotal + (t.loyalty || 0) + bonus + release + releg + promo;
}

// ---------- negotiation ----------
const KIND_LABEL = { pro: "Kontrak profesional pertama", renew: "Perpanjangan kontrak", transfer: "Kontrak pribadi (transfer)", free: "Kontrak pemain bebas" };
export function openNegotiation(G, rng, { club, kind, fee = 0, wage, years, role, intro }) {
  const p = userP(G), c = G.clubs[club];
  if (G.neg && ["open", "final"].includes(G.neg.status)) cancelNegotiation(G, rng, "Negosiasi lama ditutup karena ada tawaran baru.");
  const age = ageOn(p.birth, G.date);
  const valueM = marketValue(p, G.date, c.league);
  const rec = role || clubRoleFor(G, p, club);
  const base = {
    wage: r50(wage || fairWage(p, c.league) * (kind === "pro" ? 0.7 : 1)), years: years || (age < 24 ? 4 : age < 29 ? 3 : 2), loyalty: r50(fairWage(p, c.league) * 4),
    bonuses: { app: r50(fairWage(p, c.league) * 0.15), goal: ["ST", "AMC", "AMR", "AML"].includes(p.main) ? r50(fairWage(p, c.league) * 0.12) : 0 },
    raise: 0, release: null, relegRelease: false, promoRaise: 0, relegCut: c.level < 125 ? 25 : 0, role: rec,
  };
  // how far the club will go: better / younger / more important players get more
  const rank = rec ? roleIndex(rec) : 3;
  const importance = clamp((3 - rank) / 3, 0, 1);
  const youthBonus = age <= 21 ? clamp((p.pa - p.ca) / 80, 0, 0.4) : 0;
  const stretch = 1.1 + importance * 0.22 + youthBonus * 0.3 + rng.float(0, 0.06) - (G.user.difficulty === "Keras" ? 0.05 : 0);
  const baseCost = termsCost(G, p, base, valueM);
  const director = staffOf(G, club).find(s => s.role === "Direktur Olahraga")?.name || "Direktur Olahraga";
  G.neg = {
    id: (G.negId = (G.negId || 0) + 1), club, kind, fee, valueM, offer: JSON.parse(JSON.stringify(base)), ask: JSON.parse(JSON.stringify(base)),
    rec, max: baseCost * stretch, base: baseCost, opened: G.date, patience: G.user.difficulty === "Keras" ? 2 : 3, round: 0, status: "open", director,
    log: [{ who: "club", text: `${c.name} menawarkan kontrak ${base.years} tahun dengan gaji ${W(base.wage)} per pekan dan status ${rec}. Silakan ajukan permintaanmu.` }],
  };
  addMail(G, `${KIND_LABEL[kind]}: ${c.name}`, `${intro ? intro + "\n\n" : ""}${c.name} siap bernegosiasi kontrak denganmu. Buka layar negosiasi untuk mengatur gaji, bonus, klausul, dan janji waktu bermain.`, "decision", {
    options: [{ label: "Buka negosiasi", detail: "Atur sendiri syarat kontrakmu.", act: "openNeg", data: { neg: G.neg.id } }, { label: "Tolak tawaran", detail: kind === "renew" ? "Kamu bebas pergi saat kontrak habis." : "Tawaran batal.", act: "rejectNeg", data: { neg: G.neg.id } }],
    tag: "transfer", done: false, from: director, cat: "Kontrak",
  });
  return G.neg;
}
// the main sticking point of an ask compared to the club's current offer
function stickingPoint(G, p, ask, offer, valueM) {
  const parts = [
    ["gaji", termsCost(G, p, { ...offer, wage: ask.wage }, valueM) - termsCost(G, p, offer, valueM)],
    ["durasi kontrak", termsCost(G, p, { ...offer, years: ask.years }, valueM) - termsCost(G, p, offer, valueM)],
    ["bonus", termsCost(G, p, { ...offer, bonuses: ask.bonuses }, valueM) - termsCost(G, p, offer, valueM)],
    ["bonus loyalitas", (ask.loyalty || 0) - (offer.loyalty || 0)],
    ["klausul pelepasan", termsCost(G, p, { ...offer, release: ask.release }, valueM) - termsCost(G, p, offer, valueM)],
    ["kenaikan gaji tahunan", termsCost(G, p, { ...offer, raise: ask.raise }, valueM) - termsCost(G, p, offer, valueM)],
  ];
  return parts.sort((a, b) => b[1] - a[1])[0];
}
export function proposeNegotiation(G, rng) {
  const N = G.neg; if (!N || N.status !== "open") return null;
  const p = userP(G), c = G.clubs[N.club];
  const ask = N.ask;
  N.round++;
  N.log.push({ who: "you", text: `Permintaanmu: ${W(ask.wage)}/pekan, ${ask.years} tahun, status ${ask.role}${ask.release ? `, klausul pelepasan ${F(ask.release)}` : ""}.` });
  // playing-time promise
  const want = roleIndex(ask.role), canGive = roleIndex(N.rec);
  if (want < canGive - 1 || (want < canGive && rng.chance(0.55))) {
    N.offer.role = N.rec;
    return reply(G, rng, `Kami tidak bisa menjanjikan status ${ask.role}. Untuk saat ini kami melihatmu sebagai ${N.rec}.`);
  }
  const cost = termsCost(G, p, ask, N.valueM);
  if (cost <= N.max) {
    N.status = "agreed"; N.offer = JSON.parse(JSON.stringify(ask));
    N.log.push({ who: "club", text: "Kami sepakat dengan syarat-syarat itu. Selamat datang!" });
    return finalize(G, rng);
  }
  // counter: meet in the middle on the biggest item, trim the rest to fit
  const [what] = stickingPoint(G, p, ask, N.offer, N.valueM);
  const counter = JSON.parse(JSON.stringify(ask));
  counter.role = want < canGive ? N.rec : ask.role;
  if (counter.release != null && counter.release < N.valueM * 2) counter.release = Math.round(N.valueM * 2.5 * 10) / 10;
  counter.raise = Math.min(counter.raise || 0, 5);
  for (const k of Object.keys(counter.bonuses || {})) counter.bonuses[k] = r50(Math.min(counter.bonuses[k], (N.offer.bonuses?.[k] || 0) * 1.5 + 50));
  counter.loyalty = Math.min(counter.loyalty || 0, (N.offer.loyalty || 0) * 1.3);
  for (let guard = 0; guard < 40 && termsCost(G, p, counter, N.valueM) > N.max; guard++) {
    if (counter.years > N.offer.years && guard % 3 === 0) counter.years--;
    counter.wage = r50(counter.wage * 0.97);
  }
  counter.wage = Math.max(counter.wage, N.offer.wage);
  N.offer = counter;
  if (N.round >= N.patience) {
    N.status = "final";
    return reply(G, rng, `Ini tawaran terakhir kami: ${W(counter.wage)}/pekan selama ${counter.years} tahun. Kalau tidak cocok, kami akhiri pembicaraan.`);
  }
  return reply(G, rng, `Permintaanmu soal ${what} terlalu tinggi. Kami bisa memberi ${W(counter.wage)}/pekan selama ${counter.years} tahun.`);
}
function reply(G, rng, text) { G.neg.log.push({ who: "club", text }); return { ok: false, text }; }
export function acceptClubOffer(G, rng) {
  const N = G.neg; if (!N || !["open", "final"].includes(N.status)) return null;
  N.status = "agreed"; N.ask = JSON.parse(JSON.stringify(N.offer));
  N.log.push({ who: "you", text: "Aku terima tawaran kalian." });
  return finalize(G, rng);
}
export function cancelNegotiation(G, rng, why = "Kamu membatalkan negosiasi.") {
  const N = G.neg; if (!N) return;
  N.status = "failed"; N.log.push({ who: "you", text: why });
  if (N.kind === "renew") { G.user.renewOffered = true; G.user.lastNegFail = G.date; }
  if (N.kind === "pro") { G.user.leaving = true; }
  closeMail(G, N.id, why);
}
function closeMail(G, negId, result) {
  const m = G.inbox.find(x => x.options?.some(o => o.data?.neg === negId));
  if (m) { m.done = true; m.read = true; m.result = result; m.choice = 0; }
}
function finalize(G, rng) {
  const N = G.neg, p = userP(G), t = N.offer, season = seasonOf(G.date);
  const contract = { end: season + t.years, wage: t.wage, start: G.date, loyalty: t.loyalty, bonuses: { ...t.bonuses }, raise: t.raise || 0, release: t.release || null, relegRelease: !!t.relegRelease, promoRaise: t.promoRaise || 0, relegCut: t.relegCut || 0, role: t.role };
  if (N.kind === "transfer" || N.kind === "free") {
    doTransfer(G, N.club, N.kind === "free" ? 0 : N.fee, t.wage, t.years);
  }
  p.contract = contract;
  G.user.renewOffered = false; G.user.leaving = false; G.user.offeredPro = true;
  G.user.promise = { role: t.role, since: G.date, misses: 0 };
  const c = G.clubs[N.club];
  if (N.kind === "renew" || N.kind === "pro") addNews(G, { title: `${fullName(p)} teken kontrak baru`, body: `${fullName(p)} menandatangani kontrak baru bersama ${c.name} hingga ${seasonLabel(contract.end)}.`, tag: "Kontrak", club: c.id, scope: "me" });
  closeMail(G, N.id, `Kontrak disepakati: ${W(t.wage)}/pekan sampai ${seasonLabel(contract.end)}.`);
  return { ok: true, text: `Kontrak disepakati dengan ${c.name}.` };
}

// ---------- earnings ----------
export function payWeek(G) {
  const p = userP(G); const c = p.contract; if (!c || c.youth) return;
  const k = G.user.money || (G.user.money = { total: 0, season: 0, bonus: 0 });
  k.total += c.wage; k.season += c.wage;
}
export function payMatchBonus(G, line, cleanSheet) {
  const p = userP(G); const b = p.contract?.bonuses; if (!b) return;
  const k = G.user.money || (G.user.money = { total: 0, season: 0, bonus: 0 });
  let x = 0;
  if (line && line.min > 0) x += (b.app || 0) + (b.goal || 0) * (line.gls || 0) + (b.assist || 0) * (line.ast || 0) + (cleanSheet && line.min >= 60 ? b.cs || 0 : 0);
  else x += b.unused || 0;
  k.total += x; k.season += x; k.bonus += x;
}
// Indonesian PPh 21 for a resident employee (UU 7/2021 HPP Pasal 17 rates; PTKP TK/0 Rp54 juta;
// biaya jabatan 5% max Rp6 juta a year). Only used for clubs in Indonesia.
const IDR = 20088.08;
export function pph21Weekly(wageEur) {
  const gross = wageEur * IDR * 52;
  const jab = Math.min(gross * 0.05, 6e6);
  let pkp = Math.max(0, Math.floor((gross - jab - 54e6) / 1000) * 1000);
  const B = [[60e6, 0.05], [250e6, 0.15], [500e6, 0.25], [5e9, 0.3], [Infinity, 0.35]];
  let tax = 0, lo = 0;
  for (const [hi, r] of B) { if (pkp <= lo) break; tax += (Math.min(pkp, hi) - lo) * r; lo = hi; }
  return { taxEur: tax / 52 / IDR, netEur: wageEur - tax / 52 / IDR, rate: gross ? tax / gross : 0 };
}

// ---------- promises ----------
export function checkPromise(G) {
  const p = userP(G), pr = G.user.promise;
  if (!pr || p.squad !== "A" || p.injury || G.date - pr.since < 60) return;
  const exp = roleShare(pr.role), act = playShare(G);
  if (act < exp - 0.25) {
    pr.misses = (pr.misses || 0) + 1;
    p.morale = clamp((p.morale ?? 65) - 6, 10, 100);
    if (pr.misses === 2) decision(G, "Janji waktu bermain tidak ditepati", `Saat tanda tangan, klub menjanjikan status ${pr.role}, tapi kamu hanya bermain sekitar ${Math.round(act * 100)}% dari menit yang tersedia.`, [
      { label: "Minta masuk daftar transfer", detail: "Klub lain akan diberi tahu.", act: "listMe" },
      { label: "Bersabar dulu", detail: "Moral turun, tapi hubungan dengan pelatih terjaga.", act: "none" },
    ]);
  } else pr.misses = 0;
}

// ---------- agent ----------
export function agentOf(G) {
  const rep = reputation(G, userP(G));
  const level = { Lokal: "Agen Lokal", Regional: "Agen Regional", Nasional: "Agen Nasional", Kontinental: "Agen Kontinental", "Seluruh Dunia": "Agen Kelas Dunia" }[rep] || "Agen Lokal";
  return { name: agentName(G), level };
}
// clubs keeping an eye on the user (stable within a month)
export function interestedClubs(G) {
  const p = userP(G), age = ageOn(p.birth, G.date);
  const { y, m } = ymd(G.date);
  const r = new RNG(hash(`int${G.seed}${y}${m}${p.ca}`));
  const cands = Object.values(G.clubs).filter(c => c.id !== p.club && G.leagues[c.league] && c.level >= p.ca - 8 && c.level <= p.ca + 18 && fifaU18Allowed(natFor(p, c.nation), age, c.nation).ok && clubNatOK(c, natFor(p, c.nation)) && permitOK(G, c).ok);
  const form = p.form.length ? p.form.slice(-6).reduce((s, x) => s + x, 0) / p.form.slice(-6).length : 6.6;
  const appeal = (form - 6.6) * 0.3 + (G.user.listed ? 0.25 : 0) + (age <= 21 ? 0.1 : 0) + (G.user.agentPush ? 0.15 : 0);
  const n = clamp(Math.round(2 + appeal * 6 + r.int(0, 3)), 0, 10);
  return r.shuffle(cands).slice(0, n).map(c => {
    const s = clamp(0.35 + appeal + r.float(-0.25, 0.35) + (c.level - p.ca) / 100, 0, 1);
    return { id: c.id, score: s, level: s >= 0.75 ? "Sangat Tertarik" : s >= 0.55 ? "Tertarik" : s >= 0.35 ? "Agak Tertarik" : "Penasaran" };
  }).sort((a, b) => b.score - a.score);
}
export const AGENT_TOPICS = [
  ["move", "Carikan aku klub baru"], ["loan", "Carikan klub untuk peminjaman"], ["renew", "Negosiasikan kontrak baru dengan klubku"], ["value", "Berapa nilai pasarku sekarang?"], ["block", "Tolak semua tawaran untuk sementara"],
];
export function agentTalk(G, rng, topic) {
  const p = userP(G), club = userClub(G), age = ageOn(p.birth, G.date);
  const ints = interestedClubs(G);
  const win = ymd(G.date).m === 7 || ymd(G.date).m === 8 || ymd(G.date).m === 1;
  switch (topic) {
    case "move":
      if (p.contract.youth) return "Kamu masih terikat kontrak akademi. Begitu dapat kontrak profesional, aku bisa mulai bergerak.";
      G.user.agentPush = true; G.user.blockOffers = false;
      return ints.length ? `Siap. Ada ${ints.length} klub yang memantaumu, ${ints.filter(x => x.score >= 0.55).length} di antaranya serius. ${win ? "Jendela transfer sedang dibuka, tawaran bisa datang dalam beberapa pekan." : "Aku akan mendekati mereka saat jendela transfer dibuka."}` : "Saat ini belum banyak yang memantaumu. Tampil bagus dulu, nanti aku yang bergerak.";
    case "loan":
      if (age > 23) return "Di usiamu, peminjaman jarang masuk akal. Lebih baik kita cari kepindahan permanen.";
      G.user.wantLoan = true;
      return "Oke, aku akan menawarkanmu ke klub yang bisa memberi menit bermain.";
    case "renew": {
      if (p.contract.youth) return "Kontrak akademimu belum bisa diperbarui sebelum usia 17.";
      if (G.neg && G.neg.status === "open") return "Kita masih punya negosiasi yang berjalan. Selesaikan itu dulu.";
      if (G.user.lastNegFail && G.date - G.user.lastNegFail < 60) return "Klub baru saja menolak kita. Tunggu dua bulan sebelum mencoba lagi.";
      const st = squadStatus(G);
      const left = p.contract.end - seasonOf(G.date);
      const keen = ["Pemain Kunci", "Pemain Inti"].includes(st) || left <= 1 || (age <= 21 && p.pa - p.ca > 25);
      if (!keen && rng.chance(0.7)) { G.user.lastNegFail = G.date; return `${club.name} belum mau membuka pembicaraan kontrak. Tunjukkan dulu di lapangan bahwa kamu layak.`; }
      openNegotiation(G, rng, { club: club.id, kind: "renew" });
      return `${club.name} bersedia bicara. Aku sudah atur pertemuannya; buka layar negosiasi di Pesan.`;
    }
    case "value": {
      const v = marketValue(p, G.date, club.league);
      return `Perkiraanku nilai pasarmu sekitar ${F(Math.round(v * 0.7 * 10) / 10)}–${F(Math.round(v * 1.4 * 10) / 10)}. ${ints[0] ? `Yang paling serius sejauh ini: ${G.clubs[ints[0].id].name}.` : ""}`;
    }
    case "block":
      G.user.blockOffers = !G.user.blockOffers; G.user.agentPush = false;
      return G.user.blockOffers ? "Dimengerti. Aku akan menolak semua tawaran sampai kamu bilang lain." : "Oke, aku buka lagi pintunya untuk tawaran.";
  }
  return "";
}

// ---------- residency, naturalisation and homegrown ----------
export function weeklyResidency(G) {
  const p = userP(G), c = G.clubs[p.club]; if (!c) return;
  const age = ageOn(p.birth, G.date);
  const res = G.user.residence || (G.user.residence = {});
  const n = c.nation;
  if (age >= 18) {
    for (const k of Object.keys(res)) if (k !== n) res[k] = 0; // FIFA counts continuous residence
    res[n] = (res[n] || 0) + 7;
    if (res[n] >= 1825 && n !== p.nat && n !== p.nat2 && !p.nat2 && !G.user.natOffered?.[n] && NATIONS[n]) {
      (G.user.natOffered = G.user.natOffered || {})[n] = true;
      decision(G, `Kewarganegaraan ${NATIONS[n].name}`, `Kamu sudah tinggal lima tahun berturut-turut di ${NATIONS[n].name} setelah usia 18. Kamu bisa mengajukan kewarganegaraan, dan menurut aturan FIFA itu juga membuka jalan untuk membela timnas ${NATIONS[n].name}, selama kamu belum terikat dengan timnas lain.`, [
        { label: "Ajukan kewarganegaraan", detail: "Mendapat kewarganegaraan kedua.", act: "naturalise", data: { nat: n } },
        { label: "Tidak", detail: "Tetap dengan kewarganegaraanmu.", act: "none" },
      ]);
    }
  }
  if (age >= 15 && age <= 21) {
    const hg = G.user.homegrown || (G.user.homegrown = { club: {}, nation: {} });
    hg.club[c.id] = (hg.club[c.id] || 0) + 7; hg.nation[n] = (hg.nation[n] || 0) + 7;
  }
}
export const homegrownStatus = G => {
  const hg = G.user.homegrown || { club: {}, nation: {} };
  return {
    club: Object.entries(hg.club).filter(([, d]) => d >= 1095).map(([k]) => k),
    nation: Object.entries(hg.nation).filter(([, d]) => d >= 1095).map(([k]) => k),
    progressClub: hg.club, progressNation: hg.nation,
  };
};

// ---------- UK work permit (simplified from the FA's points-based Governing Body Endorsement) ----------
const UK = new Set(["ENG", "SCO", "WAL", "NIR", "IRL"]);
export function permitOK(G, club) {
  const p = userP(G);
  if (!club || club.nation !== "ENG") return { ok: true, need: false };
  if (UK.has(p.nat) || UK.has(p.nat2)) return { ok: true, need: false, why: "Warga negara Britania Raya/Irlandia" };
  if ((G.user.residence?.ENG || 0) >= 1825) return { ok: true, need: false, why: "Status tinggal tetap" };
  const pts = permitPoints(G);
  return { ok: pts.total >= 15, need: true, ...pts };
}
export function permitPoints(G) {
  const p = userP(G), cur = userClub(G);
  const recent = (G.user.int.senior || []).filter(m => G.date - m.date <= 730 && m.official).length;
  const nl = NATIONS[fed(G)]?.level || 80;
  const intl = recent >= 5 && nl >= 125 ? 15 : recent >= 3 && nl >= 115 ? 10 : recent >= 1 ? 4 : 0;
  const share = playShare(G);
  const band = cur ? (["ENG1", "ESP1", "ITA1", "GER1", "FRA1"].includes(cur.league) ? 1 : ["POR1", "NED1", "BEL1", "BRA1", "ARG1", "ENG2", "USA1"].includes(cur.league) ? 0.7 : 0.4) : 0.4;
  const club = Math.round(12 * share * band);
  const cont = Object.values(G.comps || {}).some(c => ["UCL", "UEL", "UECL", "LIB"].includes(c.id) && c.teams.includes(p.club)) ? 4 : 0;
  const league = Math.round(6 * band);
  return { intl, club, cont, league, total: intl + club + cont + league };
}

// ---------- teammates ----------
export const MATE_TOPICS = [["praise", "Puji performanya"], ["warn", "Tegur soal performanya"], ["advice", "Minta saran"], ["extra", "Ajak latihan tambahan"]];
export function mateTalk(G, rng, pid, topic) {
  const u = userP(G), q = G.players[pid]; if (!q) return "";
  const rel = (G.user.rel = G.user.rel || {});
  const cur = rel[pid] || 0;
  const form = q.form.length ? q.form.slice(-5).reduce((s, x) => s + x, 0) / q.form.slice(-5).length : 6.7;
  const age = ageOn(q.birth, G.date), uage = ageOn(u.birth, G.date);
  const last = (G.user.mateLast = G.user.mateLast || {});
  if (G.date - (last[pid] || -99) < 7) return `${q.fn}: "Kita baru saja ngobrol. Nanti lagi, ya."`;
  last[pid] = G.date;
  const bump = v => (rel[pid] = clamp(cur + v, -100, 100));
  switch (topic) {
    case "praise":
      if (form >= 6.9) { bump(12); q.morale = clamp((q.morale ?? 65) + 3, 0, 100); return `${q.fn}: "Makasih! Senang dengar itu dari kamu."`; }
      bump(-4); return `${q.fn}: "Hmm, aku sendiri belum puas dengan permainanku akhir-akhir ini."`;
    case "warn":
      if (form < 6.5 && uage >= age - 2 && rng.chance(0.55)) { bump(-3); q.morale = clamp((q.morale ?? 65) + 2, 0, 100); return `${q.fn}: "Oke, kamu benar. Aku akan berusaha lebih keras."`; }
      bump(-15); q.morale = clamp((q.morale ?? 65) - 4, 0, 100); return `${q.fn}: "Urus saja permainanmu sendiri."`;
    case "advice":
      if (age >= uage + 4 && q.ca >= u.ca) {
        bump(6);
        if (rng.chance(0.35)) { const k = rng.pick(["dec", "cmp", "pos", "ant", "tea"]); u.a[A[k]] = Math.min(20, u.a[A[k]] + 0.2); }
        return `${q.fn}: "Tetap tenang saat menguasai bola dan selalu lihat sekeliling sebelum menerima umpan. Itu yang dulu membantuku."`;
      }
      return `${q.fn}: "Aku rasa kamu lebih tahu dari aku, haha."`;
    case "extra":
      bump(8); u.cond = clamp(u.cond - 6, 35, 100); G.user.trainBoost = (G.user.trainBoost || 0) + 0.02;
      return `${q.fn}: "Ayo! Sepulang latihan kita tambah 30 menit."`;
  }
  return "";
}
export const relWord = v => (v >= 50 ? "Teman dekat" : v >= 20 ? "Akrab" : v <= -40 ? "Tidak akur" : v <= -15 ? "Renggang" : "Biasa saja");

// ---------- team talk: the player's mindset before a match ----------
export const MINDSETS = {
  Termotivasi: { desc: "Penuh energi: kerja keras dan agresif, sedikit lebih rawan kartu.", attrs: { wor: 1.5, agg: 1.5, sta: 0.5 } },
  Fokus: { desc: "Tenang dan tajam saat mengambil keputusan.", attrs: { cmp: 1.5, dec: 1, cnt: 1 } },
  Santai: { desc: "Menikmati laga tanpa beban; kreativitas lebih lepas.", attrs: { fla: 1.5, vis: 0.5, cmp: 0.5 } },
};
export function teamTalkLine(G, pd, H, A) {
  const u = userP(G);
  const mine = H.club === u.club || H.nat ? H : A, opp = mine === H ? A : H;
  const lvl = t => (t.xi || []).reduce((s, p) => s + p.ca, 0) / Math.max(1, (t.xi || []).length);
  const diff = lvl(mine) - lvl(opp);
  if (pd.kind === "friendly") return "Ini hanya laga persahabatan. Fokus pada kebugaran dan bangun fondasi untuk musim ini.";
  if (/Final/.test(pd.comp || "")) return "Ini final. Laga seperti ini yang akan diingat orang. Berikan semuanya di lapangan!";
  if (diff > 8) return "Kita tim unggulan dan seharusnya menang. Jangan anggap remeh lawan, kerjakan tugas kalian.";
  if (diff < -8) return "Tidak ada yang mengharapkan kita menang hari ini. Buktikan mereka salah!";
  return "Laga ini bisa ke mana saja. Siapa yang paling disiplin dan paling lapar, dia yang menang.";
}
