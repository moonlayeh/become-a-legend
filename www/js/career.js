// The user's career: squad status, staff reports, contracts, transfers, loans, manager talks,
// national teams, season awards and history.
import { RNG, clamp } from "./rng.js";
import { NATIONS } from "./data.js";
import { A, ATTRS } from "./attributes.js";
import { genPlayer, slotRating, marketValue, fairWage, fullName, newStats } from "./player.js";
import { ymd, ageOn, seasonOf, seasonLabel, fmt, day } from "./calendar.js";
import { addMail, addNews, userP, userClub, table, fifaU18Allowed, birthForAge, newCompStats, clubNatOK, needsLanguage } from "./world.js";
import { sessionsFor, userMatchDays, SESS } from "./meta.js";
import { openNegotiation, cancelNegotiation, permitOK } from "./contract.js";

const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
// nationality that counts for a club in country `cn` (dual nationals use the matching one)
export const natFor = (p, cn) => (p.nat2 && p.nat2 === cn ? p.nat2 : p.nat);
// the national federation the user currently represents
export const fed = G => G.user.fed || G.players[G.user.pid].nat;
export const inWindow = n => { const { m } = ymd(n); return m === 7 || m === 8 || m === 1; };

// ---------- squad status ----------
export function squadRank(G, p) {
  const club = G.clubs[p.club];
  const pos = p.main;
  const group = posGroup(pos);
  const mates = club.squad.map(id => G.players[id]).filter(q => q && posGroup(q.main) === group);
  const me = slotRating(p, pos);
  const better = mates.filter(q => q.id !== p.id && slotRating(q, pos) > me).length;
  return { better, total: mates.length, group };
}
export const posGroup = pos => pos === "GK" ? "GK" : /^D|WB/.test(pos) ? "DEF" : /^(DM|MC|MR|ML)$/.test(pos) ? "MID" : "ATT";
const NEED = { GK: 1, DEF: 4, MID: 3, ATT: 3 };
export function squadStatus(G, p = userP(G)) {
  const age = ageOn(p.birth, G.date);
  if (p.squad === "Y") return age <= 18 ? "Pemain Akademi" : "Pemain Muda";
  const { better, group } = squadRank(G, p);
  const need = NEED[group];
  if (better === 0) return "Pemain Kunci";
  if (better < need) return "Pemain Inti";
  if (better < need + 2) return age <= 21 ? "Prospek Tim Utama" : "Pemain Rotasi";
  if (age <= 21) return "Prospek Muda";
  return "Pemain Cadangan";
}

// ---------- coach reports (stars, noisy, stable within a month) ----------
export function coachReport(G, p) {
  const club = G.clubs[p.club];
  const best = Math.max(...club.squad.map(id => G.players[id]?.ca || 0));
  const { y, m } = ymd(G.date);
  const r = new RNG(p.id * 7919 + y * 13 + m);
  const judge = 0.5 + club.level / 300; // better clubs, better staff
  const noise = (1 - judge) * 30;
  const caEst = p.ca + r.normal(0, noise * 0.35);
  const paEst = p.pa + r.normal(0, noise);
  const stars = v => clamp(Math.round(v / best * 10) / 2, 0.5, 5);
  const age = ageOn(p.birth, G.date);
  let text;
  const pe = paEst;
  if (pe >= 180) text = "Berpotensi menjadi salah satu pemain terbaik di dunia.";
  else if (pe >= 165) text = "Berpotensi menjadi pemain kelas dunia.";
  else if (pe >= 150) text = "Berpotensi menjadi pemain penting di klub papan atas.";
  else if (pe >= 130) text = "Berpotensi menjadi pemain yang solid di liga top.";
  else if (pe >= 110) text = "Berpotensi menjadi pemain yang baik di liga menengah.";
  else text = "Potensinya tampak terbatas.";
  if (age >= 27) text = "Sudah mendekati batas kemampuannya.";
  return { ca: stars(caEst), pa: stars(Math.max(paEst, caEst)), text };
}

// ---------- monthly & weekly hooks ----------
export function snapshotAttrs(G) { G.user.snap = userP(G).a.map(v => Math.round(v)); G.user.snapCA = userP(G).ca; }
export function monthlyReport(G) {
  const p = userP(G);
  if (!G.user.snap) return snapshotAttrs(G);
  const ch = [];
  p.a.forEach((v, i) => { const now = Math.round(v), was = G.user.snap[i]; if (now !== was) ch.push({ name: ATTRS[i][1], from: was, to: now }); });
  if (ch.length) {
    const up = ch.filter(c => c.to > c.from), down = ch.filter(c => c.to < c.from);
    addMail(G, "Laporan perkembangan bulanan", `${up.length ? "Naik: " + up.map(c => `${c.name} ${c.from}→${c.to}`).join(", ") + "." : ""}${down.length ? (up.length ? "\n" : "") + "Turun: " + down.map(c => `${c.name} ${c.from}→${c.to}`).join(", ") + "." : ""}`, up.length >= down.length ? "good" : "bad", { changes: ch });
  }
  snapshotAttrs(G);
}

function firstTeamThreshold(G, club) {
  const cas = club.squad.map(id => G.players[id]).filter(Boolean).map(p => p.ca).sort((a, b) => b - a);
  return cas[Math.min(cas.length - 1, 15)] || club.level - 10;
}

export function monthlyCareer(G, rng) {
  const p = userP(G), club = userClub(G), age = ageOn(p.birth, G.date), season = seasonOf(G.date);
  const { m } = ymd(G.date);
  // morale
  const share = playShare(G);
  const expected = p.squad === "Y" ? 0.5 : { "Pemain Kunci": 0.85, "Pemain Inti": 0.7, "Pemain Rotasi": 0.4, "Prospek Tim Utama": 0.3 }[squadStatus(G)] ?? 0.15;
  p.morale = clamp(Math.round((p.morale ?? 65) * 0.6 + (55 + (share - expected) * 60 + ((p.form.length ? avg(p.form.slice(-5)) : 6.8) - 6.8) * 20) * 0.4), 10, 100);

  // settling in: a new language takes about ten months
  if (G.user.adapt) {
    p.morale = clamp(p.morale - 4, 10, 100);
    if (G.date - G.user.adapt.since > 300) {
      (p.langs = p.langs || []).push(G.user.adapt.lang);
      addMail(G, "Bahasa baru", `Kamu kini cukup fasih berbahasa ${G.user.adapt.lang}. Beradaptasi dengan kehidupan di klub jadi jauh lebih mudah.`, "good", { cat: "Pribadi" });
      G.user.adapt = null;
    }
  }
  // youth → first team
  if (p.squad === "Y") {
    const thr = firstTeamThreshold(G, club);
    if (p.ca >= thr - 3 || (age >= 18 && p.ca >= thr - 10)) promote(G, "Pelatih tim utama memanggilmu naik ke skuad senior.");
    else if (age >= 19 && m === 5) addMail(G, "Masa depan di akademi", "Usiamu sudah melewati batas tim muda. Kalau belum menembus tim utama musim depan, klub bisa melepasmu atau meminjamkanmu.", "bad");
  }
  // first pro contract at 17
  if (p.contract.youth && age >= 17 && !G.user.offeredPro) {
    G.user.offeredPro = true;
    const wage = Math.max(300, Math.round(fairWage(p, club.league) * 0.7 / 50) * 50);
    openNegotiation(G, rng, { club: club.id, kind: "pro", wage, years: 3, intro: `${club.name} menawarkan kontrak profesional pertamamu.` });
  }
  // renewal in final season
  if (!p.contract.youth && p.contract.end === season && m >= 10 && !G.user.renewOffered && !G.user.leaving && !G.user.loan) {
    const st = squadStatus(G);
    if (["Pemain Kunci", "Pemain Inti", "Prospek Tim Utama", "Pemain Rotasi", "Prospek Muda"].includes(st) || rng.chance(0.3)) {
      G.user.renewOffered = true;
      const wage = Math.round(fairWage(p, club.league) * rng.float(0.9, 1.15) / 50) * 50;
      const years = age < 24 ? 4 : age < 30 ? 3 : age < 33 ? 2 : 1;
      openNegotiation(G, rng, { club: club.id, kind: "renew", wage, years, intro: `${club.name} ingin memperpanjang kontrakmu (gaji sekarang ${W(p.contract.wage)}/pekan).` });
    }
  }
}

export function weeklyCareer(G, rng) {
  const p = userP(G);
  if (G.user.retired) return;
  if (G.neg && ["open", "final"].includes(G.neg.status) && G.date - (G.neg.opened ?? G.date) > 21) cancelNegotiation(G, rng, "Klub menarik tawarannya karena tidak ada jawaban selama tiga pekan.");
  if (!inWindow(G.date)) return;
  const age = ageOn(p.birth, G.date);
  const club = userClub(G);
  if (G.inbox.some(x => x.kind === "decision" && !x.done && /transfer|pinjam/i.test(x.tag || ""))) return;
  const share = playShare(G);
  // loans
  if (!G.user.loan && age <= 21 && (p.squad === "A" ? share < 0.25 : p.ca > firstTeamThreshold(G, club) - (age >= 18 ? 38 : 26) && age >= 17) && rng.chance(G.user.wantLoan ? 0.45 : 0.2)) {
    const nat = G.clubs[p.club].nation;
    const cands = Object.values(G.clubs).filter(c => c.id !== p.club && !!G.leagues[c.league] && c.level <= p.ca + 8 && c.level >= p.ca - 16 && fifaU18Allowed(natFor(p, c.nation), age, c.nation).ok && clubNatOK(c, natFor(p, c.nation)) && permitOK(G, c).ok);
    if (cands.length) {
      const c = rng.pick(cands);
      decision(G, "Tawaran peminjaman", `${c.name} (${G.leagues[c.league].name}) ingin meminjammu sampai akhir musim. ${club.name} setuju karena ingin kamu mendapat menit bermain.`, [
        { label: `Berangkat ke ${c.short}`, detail: "Menit bermain lebih banyak, kembali akhir musim.", act: "loan", data: { to: c.id } },
        { label: "Tetap di sini", detail: "Bersaing untuk tempat di tim.", act: "stay" },
      ], "pinjam");
      return;
    }
  }
  // transfer interest
  const value = marketValue(p, G.date, club.league);
  const appeal = ((p.form.length ? avg(p.form.slice(-8)) : 6.6) - 6.6) * 0.15 + (p.ca - club.level) / 60 + (G.user.listed ? 0.25 : 0) + (age <= 23 ? 0.05 : 0);
  if (G.user.blockOffers || (G.neg && ["open", "final"].includes(G.neg.status))) return;
  if (p.squad === "A" && !G.user.loan && rng.chance(clamp(0.05 + appeal + (G.user.agentPush ? 0.12 : 0), 0.02, 0.45))) {
    const cands = Object.values(G.clubs).filter(c => c.id !== p.club && !!G.leagues[c.league] && c.level >= p.ca - 6 && c.level <= p.ca + 16 && fifaU18Allowed(natFor(p, c.nation), age, c.nation).ok && clubNatOK(c, natFor(p, c.nation)) && permitOK(G, c).ok);
    if (!cands.length) return;
    const c = rng.weighted(cands, c => c.level);
    let fee = Math.round(value * rng.float(0.85, 1.4) * 10) / 10;
    const rel = p.contract?.release;
    if (rel && c.level >= p.ca && rng.chance(0.35)) fee = Math.max(fee, rel);
    const accept = G.user.listed || (rel && fee >= rel) || fee >= value * 1.1 || ["Pemain Cadangan", "Prospek Muda"].includes(squadStatus(G));
    const wage = Math.round(fairWage(p, c.league) * rng.float(1, 1.25) / 50) * 50;
    const years = age < 26 ? 5 : age < 30 ? 3 : 2;
    if (accept) {
      openNegotiation(G, rng, { club: c.id, kind: "transfer", fee, wage, years, intro: `${c.name} (${G.leagues[c.league].name}) sepakat dengan ${club.name} soal biaya transfer ${F(fee)}${rel && fee >= rel ? " (klausul pelepasanmu terpenuhi)" : ""}.` });
      G.user.agentPush = false;
    } else {
      addMail(G, "Tawaran ditolak klub", `${club.name} menolak tawaran ${F(fee)} dari ${c.name} untukmu. Kamu dianggap terlalu penting untuk dilepas.`, "info");
      addNews(G, { title: `${club.short} tolak tawaran ${c.short} untuk ${fullName(p)}`, body: `${club.name} menolak tawaran ${F(fee)} dari ${c.name}. Klub menganggap ${fullName(p)} terlalu penting untuk dilepas.`, tag: "Rumor Transfer", club: c.id, scope: "me" });
    }
  }
}
// money tokens: converted to the chosen currency when shown (see ui/core.js esc)
export const W = v => `⟦w:${Math.round(v)}⟧`;
export const F = m => `⟦m:${m}⟧`;
export const fmtM = v => v >= 1 ? `${v.toFixed(1)} jt` : `${Math.round(v * 1000)} rb`;

export function playShare(G) {
  const m = G.user.minutes8 || [];
  if (!m.length) return 0.4;
  const games = m.reduce((s, w) => s + w.g, 0), mins = m.reduce((s, w) => s + w.min, 0);
  return games ? mins / (games * 90) : 0;
}

function promote(G, why) {
  const p = userP(G), club = userClub(G);
  club.youthSquad = club.youthSquad.filter(id => id !== p.id);
  if (!club.squad.includes(p.id)) club.squad.push(p.id);
  p.squad = "A";
  addMail(G, "Naik ke tim utama", why + " Mulai sekarang kamu berlatih dan bersaing bersama skuad senior.", "good");
  addNews(G, { title: `${fullName(p)} naik ke tim utama ${club.short}`, body: `${club.name} mempromosikan ${fullName(p)} dari akademi ke skuad senior. Staf pelatih menilai ia siap bersaing untuk menit bermain.`, tag: "Klub", club: club.id, scope: "me" });
}

// ---------- decisions ----------
export function decision(G, title, body, options, tag = "") {
  addMail(G, title, body, "decision", { options, tag, done: false });
}
export function resolveDecision(G, mailId, idx, rng) {
  const mail = G.inbox.find(x => x.id === mailId);
  if (!mail || mail.done) return null;
  const o = mail.options[idx];
  mail.done = true; mail.choice = idx; mail.read = true;
  const p = userP(G), club = userClub(G), season = seasonOf(G.date);
  const d = o.data || {};
  let msg = "";
  switch (o.act) {
    case "signContract":
      p.contract = { end: season + d.years, wage: d.wage };
      G.user.renewOffered = false;
      msg = `Kontrak ditandatangani sampai ${seasonLabel(p.contract.end)}.`;
      addNews(G, { title: `${fullName(p)} teken kontrak baru`, body: `${fullName(p)} menandatangani kontrak baru bersama ${club.name} hingga ${seasonLabel(p.contract.end)}.`, tag: "Kontrak", club: club.id, scope: "me" });
      break;
    case "negotiate":
      if (rng.chance(G.user.difficulty === "Keras" ? 0.45 : 0.65)) {
        const wage = Math.round(d.wage * rng.float(1.08, 1.22) / 50) * 50;
        p.contract = { end: season + d.years, wage };
        msg = `Klub setuju menaikkan gaji jadi ${W(wage)}/pekan.`;
      } else { msg = "Klub tidak mau menaikkan tawaran dan menarik tawarannya. Kontrakmu akan habis."; G.user.leaving = true; p.morale = Math.max(10, p.morale - 10); }
      break;
    case "refuseContract":
      G.user.leaving = true;
      msg = "Kamu menolak. Klub akan melepasmu saat kontrak habis.";
      break;
    case "loan":
      doLoan(G, d.to);
      msg = `Kamu dipinjamkan ke ${G.clubs[d.to].name} sampai akhir musim.`;
      break;
    case "transfer":
      doTransfer(G, d.to, d.fee, d.wage, d.years);
      msg = `Resmi! Kamu pindah ke ${G.clubs[d.to].name}.`;
      break;
    case "transferNeg":
      if (rng.chance(0.6)) { const wage = Math.round(d.wage * rng.float(1.1, 1.2) / 50) * 50; doTransfer(G, d.to, d.fee, wage, d.years); msg = `Mereka setuju gaji ${W(wage)}/pekan. Kamu pindah ke ${G.clubs[d.to].name}.`; }
      else msg = `${G.clubs[d.to].name} mundur dari negosiasi.`;
      break;
    case "freeAgent":
      doTransfer(G, d.to, 0, d.wage, d.years);
      msg = `Kamu bergabung dengan ${G.clubs[d.to].name} secara gratis.`;
      break;
    case "switchFed":
      G.user.fed = d.to; G.user.switched = true;
      msg = `Kamu kini membela ${NATIONS[d.to].name}.`;
      addNews(G, { title: `${fullName(p)} pilih ${NATIONS[d.to].name}`, body: `${fullName(p)} resmi memilih membela timnas ${NATIONS[d.to].name} setelah FIFA menyetujui perpindahan federasi.`, tag: "Timnas", scope: "me" });
      break;
    case "openNeg":
      msg = "Negosiasi dibuka.";
      break;
    case "rejectNeg":
      cancelNegotiation(G, rng, "Kamu menolak tawaran itu.");
      msg = "Tawaran ditolak.";
      break;
    case "listMe":
      G.user.listed = true; msg = "Namamu masuk daftar transfer."; break;
    case "naturalise":
      p.nat2 = d.nat; msg = `Kamu kini juga warga negara ${NATIONS[d.nat].name}.`;
      addNews(G, { title: `${fullName(p)} resmi jadi warga negara ${NATIONS[d.nat].name}`, body: `Setelah lima tahun tinggal di ${NATIONS[d.nat].name}, ${fullName(p)} resmi mendapat kewarganegaraan negara itu.`, tag: "Pribadi", scope: "me" });
      break;
    case "relegRelease":
      p.contract.end = seasonOf(G.date) - (ymd(G.date).m >= 7 ? 1 : 0); G.user.leaving = true; userContractExpiry(G, rng); msg = "Klausul degradasi diaktifkan; kamu bebas mencari klub."; break;
    case "retire":
      G.user.retired = true; G.user.retiredOn = G.date;
      msg = "Kamu mengumumkan pensiun. Terima kasih untuk semua kenangannya.";
      break;
    default: msg = "Keputusan dicatat.";
  }
  mail.result = msg;
  return msg;
}

export function doTransfer(G, to, fee, wage, years) {
  const p = userP(G), from = G.clubs[p.club], dest = G.clubs[to];
  from.squad = from.squad.filter(id => id !== p.id); from.youthSquad = from.youthSquad.filter(id => id !== p.id);
  if (G.user.loan) { const par = G.clubs[G.user.loan.parent]; par.squad = par.squad.filter(id => id !== p.id); G.user.loan = null; }
  p.club = to; p.squad = "A"; dest.squad.push(p.id);
  p.contract = { end: seasonOf(G.date) + years, wage };
  G.user.listed = false; G.user.leaving = false; G.user.renewOffered = false; G.user.wantLoan = false; G.user.minutes8 = [];
  { const l = needsLanguage(p, dest); G.user.adapt = l ? { lang: l, since: G.date } : null; }
  p.favour = 0;
  G.user.moves = G.user.moves || [];
  G.user.moves.push({ date: G.date, from: from.id, to, fee, type: "transfer" });
  addNews(G, { title: `${dest.short} resmi rekrut ${fullName(p)}`, body: `${dest.name} merekrut ${fullName(p)} dari ${from.name}${fee ? ` dengan biaya ${F(fee)}` : " secara gratis"}. Kontraknya berlaku ${years} tahun.`, tag: "Transfer", club: to, scope: "me", fee });
}
export function doLoan(G, to) {
  const p = userP(G), from = G.clubs[p.club], dest = G.clubs[to];
  from.squad = from.squad.filter(id => id !== p.id); from.youthSquad = from.youthSquad.filter(id => id !== p.id);
  G.user.loan = { parent: from.id, wasYouth: p.squad === "Y", until: seasonOf(G.date) + 1 };
  p.club = to; p.squad = "A"; dest.squad.push(p.id);
  G.user.wantLoan = false; G.user.minutes8 = [];
  { const l = needsLanguage(p, dest); G.user.adapt = l ? { lang: l, since: G.date } : null; }
  G.user.moves = G.user.moves || [];
  G.user.moves.push({ date: G.date, from: from.id, to, fee: 0, type: "loan" });
  addNews(G, { title: `${fullName(p)} dipinjamkan ke ${dest.short}`, body: `${from.name} meminjamkan ${fullName(p)} ke ${dest.name} hingga akhir musim agar mendapat menit bermain.`, tag: "Transfer", club: dest.id, scope: "me" });
}
export function endLoan(G) {
  const p = userP(G), L = G.user.loan; if (!L) return;
  const cur = G.clubs[p.club], par = G.clubs[L.parent];
  cur.squad = cur.squad.filter(id => id !== p.id);
  p.club = par.id;
  const thr = firstTeamThreshold(G, par);
  if (L.wasYouth && p.ca < thr - 15 && ageOn(p.birth, G.date) < 19) { p.squad = "Y"; par.youthSquad.push(p.id); }
  else { p.squad = "A"; par.squad.push(p.id); }
  G.user.loan = null;
  addMail(G, "Kembali dari peminjaman", `Masa pinjamanmu di ${cur.name} selesai. Kamu kembali ke ${par.name}.`, "info");
}

// ---------- manager talks ----------
export const TALKS = [
  ["minutes", "Minta menit bermain lebih"],
  ["loan", "Minta dipinjamkan"],
  ["list", "Minta masuk daftar transfer"],
  ["promote", "Minta naik ke tim utama"],
  ["contract", "Minta kontrak baru"],
];
export function talk(G, topic, rng) {
  const p = userP(G), club = userClub(G), age = ageOn(p.birth, G.date);
  const hard = G.user.difficulty === "Keras";
  const last = G.user.lastTalk || -999;
  if (G.date - last < 21) return "Pelatih: \"Kita baru saja bicara. Fokus saja di latihan dulu.\"";
  G.user.lastTalk = G.date;
  const { better, group } = p.squad === "A" ? squadRank(G, p) : { better: 9, group: "" };
  switch (topic) {
    case "minutes":
      if (p.squad === "Y") return "Pelatih: \"Kamu masih di tim muda. Main bagus di U-19 dulu, nanti kesempatan datang.\"";
      if (better <= NEED[group] + 1 && rng.chance(hard ? 0.4 : 0.7)) {
        p.favour = 3; G.user.favourUntil = G.date + 56;
        p.morale = clamp(p.morale + 8, 0, 100);
        return "Pelatih: \"Oke, kamu akan dapat lebih banyak kesempatan beberapa pekan ke depan. Jangan sia-siakan.\"";
      }
      p.morale = clamp(p.morale - 5, 0, 100);
      return "Pelatih: \"Saat ini ada pemain yang lebih siap. Tunjukkan di latihan kalau kamu layak.\"";
    case "loan":
      if (age > 23) return "Pelatih: \"Di usiamu, lebih baik cari klub permanen daripada pinjaman.\"";
      G.user.wantLoan = true;
      return "Pelatih: \"Kami akan mencari klub yang cocok saat jendela transfer dibuka.\"";
    case "list":
      G.user.listed = true; p.morale = clamp(p.morale - 3, 0, 100);
      return `Pelatih: \"Sayang sekali. Kami masukkan namamu ke daftar transfer; klub lain akan diberi tahu.\"`;
    case "promote":
      if (p.squad === "A") return "Pelatih: \"Kamu sudah di tim utama.\"";
      if (p.ca >= firstTeamThreshold(G, club) - (hard ? 6 : 9)) { promote(G, "Setelah pembicaraanmu, pelatih memutuskan memberimu kesempatan."); return "Pelatih: \"Baik, mulai pekan ini kamu berlatih dengan tim utama.\""; }
      return "Pelatih: \"Belum. Kamu masih perlu berkembang, terutama secara fisik dan pengambilan keputusan.\"";
    case "contract": {
      const st = squadStatus(G);
      if (p.contract.youth) return "Pelatih: \"Kontrak profesional baru bisa diberikan setelah usiamu 17 tahun.\"";
      if (["Pemain Kunci", "Pemain Inti"].includes(st) && p.contract.wage < fairWage(p, club.league) * 0.85) {
        G.user.renewOffered = false;
        openNegotiation(G, rng, { club: club.id, kind: "renew", wage: Math.round(fairWage(p, club.league) / 50) * 50, years: 4 });
        return "Direktur olahraga: \"Baik, kita duduk bersama. Cek pesan untuk membuka negosiasi.\"";
      }
      return "Direktur olahraga: \"Kontrakmu saat ini sudah sesuai dengan peranmu di tim.\"";
    }
  }
  return "";
}

// ---------- national teams ----------
export const YOUTH_NT = [["U-17", 16, 0.66], ["U-19", 18, 0.75], ["U-21", 20, 0.85]];
export function ntFor(G, p) {
  const age = ageOn(p.birth, G.date);
  const n = p.isUser ? fed(G) : p.nat;
  for (const [name, max, k] of YOUTH_NT) if (age <= max) return { name, max, level: NATIONS[n].level * k, youth: true };
  return { name: "Senior", max: 99, level: NATIONS[n].level, youth: false };
}
// Build a national squad from the database plus generated players based abroad.
export function nationalSquad(G, nat, team, forceUser = false) {
  const age = p => ageOn(p.birth, G.date);
  const pool = Object.values(G.players).filter(p => (p.isUser ? forceUser || fed(G) === nat : p.nat === nat) && !p.retired && !p.injury && (team.youth ? age(p) <= team.max : age(p) >= 17));
  const season = seasonOf(G.date);
  const r = new RNG(hash(nat + team.name + season));
  const virt = [];
  const good = pool.filter(p => p.ca >= team.level - 12).length;
  const shape = ["GK","GK","DC","DC","DC","DR","DL","DM","MC","MC","MC","AMR","AML","AMC","ST","ST","DC","MC","ST","GK"];
  for (let i = 0; i < Math.max(0, 24 - good); i++) {
    const pos = shape[i % shape.length];
    const ageV = team.youth ? r.int(team.max - 2, team.max) : r.int(21, 32);
    const vp = genPlayer(r, { id: -(i + 1) - hash(nat) % 1000 * 100, nat, pos, ca: Math.round(team.level + r.normal(2, 9)), pa: 200, birth: birthForAge(r, ageV, G.date), club: null, squad: "A", today: G.date });
    vp.virtual = true;
    virt.push(vp);
  }
  return [...pool, ...virt];
}
const hash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

const QUOTA = { GK: 3, DEF: 8, MID: 8, ATT: 6 };
export function selectNational(G, nat, team, forceUser = false) {
  const all = nationalSquad(G, nat, team, forceUser);
  const by = { GK: [], DEF: [], MID: [], ATT: [] };
  const score = p => p.ca * (1 + ((p.form.length ? avg(p.form.slice(-6)) : 6.8) - 6.8) * 0.03);
  for (const p of all) by[posGroup(p.main)].push(p);
  const squad = [];
  for (const g of Object.keys(by)) squad.push(...by[g].sort((a, b) => score(b) - score(a)).slice(0, QUOTA[g]));
  return squad;
}
export function nationalLineup(squad, formation = "4-3-3") {
  const club = { formation };
  const form = [["GK"],["DR"],["DC"],["DC"],["DL"],["DM"],["MC"],["MC"],["AMR"],["ST"],["AML"]];
  const used = new Set(); const xi = [];
  for (const [pos] of form) {
    let best = null, bv = -1;
    for (const p of squad) if (!used.has(p.id)) { const v = slotRating(p, pos) * (0.85 + 0.15 * (p.cond ?? 100) / 100); if (v > bv) { bv = v; best = p; } }
    xi.push(best); used.add(best.id);
  }
  const bench = squad.filter(p => !used.has(p.id)).sort((a, b) => b.ca - a.ca).slice(0, 9);
  return { xi, bench, formation: "4-3-3" };
}

// ---------- season end: awards & history ----------
// global awards on 1 June (league honours are handed out when each league finishes)
const COEF = { ENG1: 1, ESP1: 1, ITA1: 0.95, GER1: 0.95, FRA1: 0.9, POR1: 0.75, NED1: 0.72, BEL1: 0.66, BRA1: 0.7, ARG1: 0.66, KSA1: 0.56, USA1: 0.55, JPN1: 0.52, ENG2: 0.5, ESP2: 0.42, ITA2: 0.42, GER2: 0.44, FRA2: 0.4, EGY1: 0.45, MAR1: 0.45, RSA1: 0.42, IDN1: 0.35, MAS1: 0.3, THA1: 0.32, IDN2: 0.2 };
export function seasonAwards(G) {
  const season = G.season;
  const res = { leagues: {}, global: {} };
  const ageAt = p => ageOn(p.birth, day(season + 1, 6, 1));
  const champions = new Set(Object.values(G.leagues).map(L => L.history[L.history.length - 1]?.champion).filter(Boolean));
  for (const L of Object.values(G.leagues)) if (L.cal === "aug" && L.history.length) res.leagues[L.id] = L.history[L.history.length - 1];
  // continental runs: winners and finalists of the big club competitions get a boost
  const cont = {};
  for (const [id, w] of [["UCL", 9], ["UEL", 4], ["ACLE", 3], ["LIB", 4], ["CAFCL", 2], ["UECL", 2]]) {
    const c = G.comps[id]; if (!c || !c.stages.length) continue;
    const S = c.stages[c.stages.length - 1];
    if (S.type === "ko" && S.ties.length === 1) { const t = S.ties[0]; for (const x of [t.a, t.b]) cont[x] = (cont[x] || 0) + (t.w ? (t.w === x ? w : w * 0.4) : w * 0.6); }
  }
  const all = Object.values(G.players).filter(p => !p.retired && p.club && G.clubs[p.club] && COEF[G.clubs[p.club].league] && (p.st.apps + p.st.sub) >= 15);
  const sc = p => {
    const lg = G.clubs[p.club].league;
    const ar = p.st.rsum / Math.max(1, p.st.rn);
    const champ = champions.has(p.club) ? 6 : 0;
    const intl = p.isUser && G.user.tourWin === season ? 10 : 0;
    return ((ar - 6.5) * 22 + p.st.gls * 0.55 + p.st.ast * 0.35 + champ + (cont[p.club] || 0) + p.ca / 8 + intl) * COEF[lg];
  };
  const ranked = all.map(p => ({ p, s: sc(p) })).sort((a, b) => b.s - a.s);
  res.global.ballon = ranked.slice(0, 30).map(x => x.p.id);
  res.global.young = ranked.filter(x => ageAt(x.p) <= 21 && COEF[G.clubs[x.p.club].league] >= 0.6).slice(0, 10).map(x => x.p.id);
  const shoe = all.map(p => ({ p, s: p.st.gls * (COEF[G.clubs[p.club].league] >= 0.9 ? 2 : COEF[G.clubs[p.club].league] >= 0.6 ? 1.5 : 1) })).sort((a, b) => b.s - a.s);
  res.global.shoe = shoe[0]?.p.id;
  G.lastAwards = res;
  if (res.global.ballon.length) addNews(G, { title: `Bola Emas ${season + 1}: ${fullName(G.players[res.global.ballon[0]])}`, body: `${fullName(G.players[res.global.ballon[0]])} (${G.clubs[G.players[res.global.ballon[0]].club].name}) dinobatkan sebagai pemain terbaik dunia.`, tag: "Penghargaan", club: G.players[res.global.ballon[0]].club });
  return res;
}

export function userSeasonEnd(G, awards) {
  const p = userP(G), season = G.season, u = G.user;
  const club = userClub(G);
  const L = G.leagues[club.league];
  const cs = u.cs;
  const ar = s => s.rn ? +(s.rsum / s.rn).toFixed(2) : null;
  const sum = s => (s ? { apps: s.apps + s.sub, gls: s.gls, ast: s.ast, rating: ar(s) } : null);
  const cups = Object.entries(cs).filter(([k, s]) => !["liga", "u19", "timnas"].includes(k) && s.apps + s.sub > 0).map(([k, s]) => ({ comp: k, ...sum(s) }));
  const row = {
    season: seasonLabel(season), club: club.id, clubName: club.name, league: L?.name || "", loan: !!u.loan,
    apps: cs.liga.apps, sub: cs.liga.sub, gls: cs.liga.gls, ast: cs.liga.ast, rating: ar(cs.liga), min: cs.liga.min, pom: cs.liga.pom,
    u19: cs.u19.apps + cs.u19.sub ? sum(cs.u19) : null,
    intl: cs.timnas.apps + cs.timnas.sub ? sum(cs.timnas) : null,
    cups, ca: p.ca, notes: [...(u.seasonNotes || [])],
  };
  if (u.leaguePos && u.leaguePos.league === club.league) row.pos = u.leaguePos.pos;
  const br = awards.global.ballon.indexOf(p.id);
  if (br === 0) { u.awards.push({ name: "Bola Emas", year: String(season + 1) }); row.notes.push("Bola Emas"); }
  else if (br > 0) { row.ballon = br + 1; addMail(G, "Bola Emas", `Kamu masuk nominasi Bola Emas dan finis di peringkat ${br + 1}.`, "good"); }
  const yr = awards.global.young.indexOf(p.id);
  if (yr === 0) u.awards.push({ name: "Trofi Pemain Muda Terbaik Dunia", year: String(season + 1) });
  if (awards.global.shoe === p.id) u.awards.push({ name: "Sepatu Emas", year: seasonLabel(season), detail: `${p.st.gls} gol` });
  u.history.push(row);
  const cupLine = cups.length ? ` Di kompetisi lain: ${cups.reduce((s, c) => s + c.apps, 0)} laga, ${cups.reduce((s, c) => s + c.gls, 0)} gol.` : "";
  const msg = `Musim ${row.season} selesai. ${row.apps + row.sub} penampilan liga, ${row.gls} gol, ${row.ast} assist${row.rating ? `, rating rata-rata ${row.rating.toFixed(2)}` : ""}.${cupLine}${row.notes.length ? " " + row.notes.join(", ") + "!" : ""}`;
  addMail(G, "Ringkasan musim", msg, row.notes.length ? "good" : "info");
  u.cs = newCompStats();
  u.seasonNotes = [];
}

// End-of-contract handling for the user (June)
export function userContractExpiry(G, rng) {
  const p = userP(G), season = seasonOf(G.date);
  if (G.user.loan) return;
  if (p.contract.end > season) return;
  const age = ageOn(p.birth, G.date);
  const cands = Object.values(G.clubs).filter(c => c.id !== p.club && !!G.leagues[c.league] && c.level <= p.ca + 12 && c.level >= p.ca - 25 && fifaU18Allowed(natFor(p, c.nation), age, c.nation).ok && clubNatOK(c, natFor(p, c.nation)));
  const picks = rng.shuffle(cands).slice(0, 6).sort((a, b) => b.level - a.level).slice(0, 3);
  if (!picks.length) { p.contract = { end: season + 1, wage: fairWage(p, userClub(G).league) }; addMail(G, "Kontrak diperpanjang", "Tidak ada klub lain yang serius, jadi kamu menandatangani kontrak baru 1 musim dengan klubmu.", "info"); return; }
  decision(G, "Kamu pemain bebas", `Kontrakmu dengan ${userClub(G).name} habis. Beberapa klub menawarimu kontrak:`, picks.map(c => {
    const wage = Math.round(fairWage(p, c.league) * rng.float(0.95, 1.2) / 50) * 50;
    const years = age < 28 ? 3 : 2;
    return { label: `${c.name}`, detail: `${G.leagues[c.league].name} · ${years} tahun · ${W(wage)}/pekan`, act: "freeAgent", data: { to: c.id, wage, years } };
  }), "transfer");
}

// ---------- daily training sessions ----------
// effort per day: rating shift, fatigue per physical session, injury risk, development weight
export const EFFORT = {
  Santai: { r: -0.3, c: 2, inj: 0.35, dev: 0.75, label: "Santai", desc: "Hemat tenaga, risiko cedera kecil, perkembangan lebih lambat." },
  Normal: { r: 0, c: 4, inj: 1, dev: 1, label: "Normal", desc: "Ikuti program pelatih seperti biasa." },
  Maksimal: { r: 0.35, c: 7, inj: 2.2, dev: 1.3, label: "Maksimal", desc: "Kesan bagus di mata pelatih dan perkembangan lebih cepat, tapi lebih lelah dan rawan cedera." },
};
const SESS_ATTR = { fis: ["sta", "nat", "acc", "str"], tak: ["dec", "pos", "tea", "ant"], bola: ["fir", "pas", "tec", "dri"], ind: ["det", "wor", "cmp"], rest: [] };
export function trainingSessionsToday(G) {
  const u = userP(G);
  if (G.user.retired || !u.club || u.injury || u.away) return null;
  const s = sessionsFor(G, u.club, G.date, userMatchDays(G));
  if (!s.s || s.match || s.off || !s.s.some(k => k !== "ist")) return null;
  return s.s;
}
export function doTraining(G, rng, effort = "Normal", extra = false, auto = false) {
  const u = userP(G), E = EFFORT[effort] || EFFORT.Normal;
  const list = trainingSessionsToday(G);
  if (!list) return null;
  const condBefore = u.cond;
  const sessions = list.map(k => {
    const [name, cat] = SESS[k];
    if (k === "ist") return { k, name, cat, rating: null };
    const rel = SESS_ATTR[cat] || [];
    const attr = rel.length ? rel.reduce((s, a) => s + u.a[A[a]], 0) / rel.length : 10;
    let r = 6.25 + (u.hid.pro - 10) * 0.05 + (u.a[A.det] - 10) * 0.04 + (u.a[A.wor] - 10) * 0.03 + (attr - 11) * 0.05 + E.r + rng.normal(0, 0.35);
    if (u.cond < 70) r -= 0.3;
    if (G.user.adapt) r -= 0.1;
    return { k, name, cat, rating: Math.round(clamp(r, 4.5, 9.8) * 100) / 100 };
  });
  const rated = sessions.filter(x => x.rating != null);
  const avg = rated.length ? rated.reduce((s, x) => s + x.rating, 0) / rated.length : 6.5;
  const fis = sessions.filter(x => x.cat === "fis").length, oth = rated.length - fis;
  u.cond = clamp(u.cond - (E.c * fis + Math.ceil(E.c / 2) * oth + (extra ? 4 : 0)), 35, 100);
  u.sharp = clamp((u.sharp ?? 60) + oth * 1.5, 0, 100);
  G.user.trainBoost = (G.user.trainBoost || 0) + (avg - 6.6) * 0.03 * E.dev + (E.dev - 1) * 0.04 + (extra ? 0.03 : 0);
  G.user.trainedWeek = (G.user.trainedWeek || 0) + 1;
  // training injury
  let injury = null;
  if (rng.chance(0.0012 * rated.length * E.inj * (0.6 + u.hid.inj / 20) * (u.cond < 70 ? 1.8 : 1) * (extra ? 1.5 : 1) * (G.user.difficulty === "Keras" ? 1.3 : 1))) {
    const days = rng.int(3, 21);
    u.injury = { name: rng.pick(["Cedera ringan saat latihan", "Otot paha tertarik", "Pergelangan kaki terkilir"]), days, total: days, since: G.date };
    G.user.injuries.push({ date: G.date, name: u.injury.name, days });
    injury = u.injury;
  }
  // teammates on the same pitch
  const club = G.clubs[u.club];
  const mates = (u.squad === "Y" ? club.youthSquad : club.squad).map(id => G.players[id]).filter(p => p && !p.isUser && !p.injury);
  const sample = rng.shuffle(mates).slice(0, 10).map(p => ({ id: p.id, name: `${p.fn[0]}. ${p.ln}`, rating: Math.round(clamp(6.3 + (p.hid.pro - 10) * 0.05 + rng.normal(0, 0.4), 5, 9.5) * 100) / 100 }));
  const board = [...sample, { id: u.id, name: `${u.fn[0]}. ${u.ln}`, rating: Math.round(avg * 100) / 100, me: true }].sort((a, b) => b.rating - a.rating);
  const rank = board.findIndex(x => x.me) + 1;
  const coach = avg >= 7.6 ? "Luar biasa hari ini. Kalau begini terus, kamu akan dapat kesempatan." : avg >= 7 ? "Latihan yang bagus. Pertahankan intensitas seperti ini." : avg >= 6.5 ? "Cukup baik, tapi aku tahu kamu bisa lebih." : avg >= 6 ? "Kurang fokus hari ini. Besok harus lebih baik." : "Itu latihan yang buruk. Kita perlu bicara kalau ini berlanjut.";
  if (avg >= 7.4) u.morale = clamp((u.morale ?? 65) + 1, 0, 100);
  if (avg < 6) u.morale = clamp((u.morale ?? 65) - 1, 0, 100);
  const out = { date: G.date, effort, extra, sessions, avg: Math.round(avg * 100) / 100, condBefore: Math.round(condBefore), condAfter: Math.round(u.cond), board, rank, coach, injury: injury ? { name: injury.name, days: injury.days } : null, auto };
  G.user.lastTraining = out;
  (G.user.trainRatings = G.user.trainRatings || []).push(out.avg); if (G.user.trainRatings.length > 12) G.user.trainRatings.shift();
  G.user.trainDone = G.date;
  G.trainingDue = false;
  if (injury && !auto) addMail(G, "Cedera di latihan", `Kamu mengalami ${injury.name.toLowerCase()} dan absen sekitar ${injury.days} hari.`, "bad", { cat: "Cedera" });
  return out;
}
