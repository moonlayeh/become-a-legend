// The user's career: squad status, staff reports, contracts, transfers, loans, manager talks,
// national teams, season awards and history.
import { RNG, clamp } from "./rng.js";
import { NATIONS, LEAGUES } from "./data.js";
import { A, ATTRS } from "./attributes.js";
import { genPlayer, slotRating, marketValue, fairWage, fullName, newStats } from "./player.js";
import { ymd, ageOn, seasonOf, seasonLabel, fmt, day } from "./calendar.js";
import { addMail, addNews, userP, userClub, table, fifaU18Allowed, birthForAge, newCompStats, clubNatOK } from "./world.js";

const avg = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
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
    decision(G, "Kontrak profesional pertama", `${club.name} menawarkan kontrak profesional pertamamu: ${3} tahun, €${wage.toLocaleString("id-ID")}/pekan.`, [
      { label: "Tanda tangani", detail: "Kontrak sampai akhir musim " + seasonLabel(season + 3) + ".", act: "signContract", data: { years: 3, wage } },
      { label: "Minta gaji lebih tinggi", detail: "Bisa naik, tapi klub bisa tersinggung.", act: "negotiate", data: { years: 3, wage } },
      { label: "Tolak dan cari klub lain", detail: "Kamu akan dilepas akhir musim.", act: "refuseContract" },
    ]);
  }
  // renewal in final season
  if (!p.contract.youth && p.contract.end === season && m >= 10 && !G.user.renewOffered && !G.user.leaving && !G.user.loan) {
    const st = squadStatus(G);
    if (["Pemain Kunci", "Pemain Inti", "Prospek Tim Utama", "Pemain Rotasi", "Prospek Muda"].includes(st) || rng.chance(0.3)) {
      G.user.renewOffered = true;
      const wage = Math.round(fairWage(p, club.league) * rng.float(0.9, 1.15) / 50) * 50;
      const years = age < 24 ? 4 : age < 30 ? 3 : age < 33 ? 2 : 1;
      decision(G, "Tawaran perpanjangan kontrak", `${club.name} ingin memperpanjang kontrakmu ${years} tahun dengan gaji €${wage.toLocaleString("id-ID")}/pekan (sekarang €${p.contract.wage.toLocaleString("id-ID")}).`, [
        { label: "Perpanjang", detail: `Bertahan sampai ${seasonLabel(season + years)}.`, act: "signContract", data: { years, wage } },
        { label: "Minta gaji lebih tinggi", detail: "Klub bisa menolak.", act: "negotiate", data: { years, wage } },
        { label: "Tolak", detail: "Kamu bebas pergi saat kontrak habis.", act: "refuseContract" },
      ]);
    }
  }
}

export function weeklyCareer(G, rng) {
  const p = userP(G);
  if (G.user.retired) return;
  if (!inWindow(G.date)) return;
  const age = ageOn(p.birth, G.date);
  const club = userClub(G);
  if (G.inbox.some(x => x.kind === "decision" && !x.done && /transfer|pinjam/i.test(x.tag || ""))) return;
  const share = playShare(G);
  // loans
  if (!G.user.loan && age <= 21 && (p.squad === "A" ? share < 0.25 : p.ca > firstTeamThreshold(G, club) - 22 && age >= 17) && rng.chance(G.user.wantLoan ? 0.45 : 0.18)) {
    const nat = G.clubs[p.club].nation;
    const cands = Object.values(G.clubs).filter(c => c.id !== p.club && LEAGUES.some(l => l.id === c.league) && c.level <= p.ca + 10 && c.level >= p.ca - 12 && fifaU18Allowed(p.nat, age, c.nation).ok && clubNatOK(c, p.nat));
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
  if (p.squad === "A" && !G.user.loan && rng.chance(clamp(0.05 + appeal, 0.02, 0.35))) {
    const cands = Object.values(G.clubs).filter(c => c.id !== p.club && LEAGUES.some(l => l.id === c.league) && c.level >= p.ca - 6 && c.level <= p.ca + 16 && fifaU18Allowed(p.nat, age, c.nation).ok && clubNatOK(c, p.nat));
    if (!cands.length) return;
    const c = rng.weighted(cands, c => c.level);
    const fee = Math.round(value * rng.float(0.85, 1.4) * 10) / 10;
    const accept = G.user.listed || fee >= value * 1.1 || ["Pemain Cadangan", "Prospek Muda"].includes(squadStatus(G));
    const wage = Math.round(fairWage(p, c.league) * rng.float(1, 1.25) / 50) * 50;
    const years = age < 26 ? 5 : age < 30 ? 3 : 2;
    if (accept) {
      decision(G, `Tawaran transfer: ${c.name}`, `${c.name} (${G.leagues[c.league].name}) sepakat dengan ${club.name} soal biaya transfer €${fmtM(fee)}. Mereka menawarkan kontrak ${years} tahun, €${wage.toLocaleString("id-ID")}/pekan.`, [
        { label: `Gabung ${c.short}`, detail: `Pindah ke ${c.name} hari ini.`, act: "transfer", data: { to: c.id, fee, wage, years } },
        { label: "Minta gaji lebih tinggi", detail: "Bisa naik 10–20%, bisa juga batal.", act: "transferNeg", data: { to: c.id, fee, wage, years } },
        { label: "Tolak", detail: `Bertahan di ${club.short}.`, act: "stay" },
      ], "transfer");
    } else {
      addMail(G, "Tawaran ditolak klub", `${club.name} menolak tawaran €${fmtM(fee)} dari ${c.name} untukmu. Kamu dianggap terlalu penting untuk dilepas.`, "info");
      addNews(G, `${club.short} menolak tawaran ${c.short} untuk ${fullName(p)}.`);
    }
  }
}
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
  addNews(G, `${club.short} mempromosikan ${fullName(p)} ke tim utama.`);
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
      addNews(G, `${fullName(p)} menandatangani kontrak baru dengan ${club.short}.`);
      break;
    case "negotiate":
      if (rng.chance(G.user.difficulty === "Keras" ? 0.45 : 0.65)) {
        const wage = Math.round(d.wage * rng.float(1.08, 1.22) / 50) * 50;
        p.contract = { end: season + d.years, wage };
        msg = `Klub setuju menaikkan gaji jadi €${wage.toLocaleString("id-ID")}/pekan.`;
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
      if (rng.chance(0.6)) { const wage = Math.round(d.wage * rng.float(1.1, 1.2) / 50) * 50; doTransfer(G, d.to, d.fee, wage, d.years); msg = `Mereka setuju gaji €${wage.toLocaleString("id-ID")}/pekan. Kamu pindah ke ${G.clubs[d.to].name}.`; }
      else msg = `${G.clubs[d.to].name} mundur dari negosiasi.`;
      break;
    case "freeAgent":
      doTransfer(G, d.to, 0, d.wage, d.years);
      msg = `Kamu bergabung dengan ${G.clubs[d.to].name} secara gratis.`;
      break;
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
  p.favour = 0;
  G.user.moves = G.user.moves || [];
  G.user.moves.push({ date: G.date, from: from.id, to, fee, type: "transfer" });
  addNews(G, `${dest.name} merekrut ${fullName(p)} dari ${from.name}${fee ? ` (€${fmtM(fee)})` : " (gratis)"}.`);
}
export function doLoan(G, to) {
  const p = userP(G), from = G.clubs[p.club], dest = G.clubs[to];
  from.squad = from.squad.filter(id => id !== p.id); from.youthSquad = from.youthSquad.filter(id => id !== p.id);
  G.user.loan = { parent: from.id, wasYouth: p.squad === "Y", until: seasonOf(G.date) + 1 };
  p.club = to; p.squad = "A"; dest.squad.push(p.id);
  G.user.wantLoan = false; G.user.minutes8 = [];
  G.user.moves = G.user.moves || [];
  G.user.moves.push({ date: G.date, from: from.id, to, fee: 0, type: "loan" });
  addNews(G, `${fullName(p)} dipinjamkan ${from.short} ke ${dest.name}.`);
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
        const wage = Math.round(fairWage(p, club.league) / 50) * 50;
        decision(G, "Kontrak baru", `${club.name} setuju memperbarui kontrakmu: 4 tahun, €${wage.toLocaleString("id-ID")}/pekan.`, [
          { label: "Tanda tangani", detail: "Gaji naik, kontrak lebih panjang.", act: "signContract", data: { years: 4, wage } },
          { label: "Tolak", detail: "Kontrak lama tetap berlaku.", act: "none" },
        ]);
        return "Direktur olahraga: \"Kami sudah kirim tawaran ke agenmu.\"";
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
  for (const [name, max, k] of YOUTH_NT) if (age <= max) return { name, max, level: NATIONS[p.nat].level * k, youth: true };
  return { name: "Senior", max: 99, level: NATIONS[p.nat].level, youth: false };
}
// Build a national squad from the database plus generated players based abroad.
export function nationalSquad(G, nat, team) {
  const age = p => ageOn(p.birth, G.date);
  const pool = Object.values(G.players).filter(p => p.nat === nat && !p.retired && !p.injury && (team.youth ? age(p) <= team.max : age(p) >= 17));
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
export function selectNational(G, nat, team) {
  const all = nationalSquad(G, nat, team);
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
export function seasonAwards(G) {
  const season = G.season;
  const res = { leagues: {}, global: {} };
  const ageAt = p => ageOn(p.birth, day(season + 1, 6, 1));
  const champions = {};
  for (const L of Object.values(G.leagues)) {
    const tb = table(G, L.id);
    champions[L.id] = tb[0].id;
    const players = L.teams.flatMap(id => G.clubs[id].squad.map(pid => G.players[pid])).filter(Boolean);
    const nMatches = (L.teams.length - 1) * 2;
    const elig = players.filter(p => p.st.apps >= nMatches * 0.5);
    const ar = p => p.st.rsum / Math.max(1, p.st.rn);
    const topScorer = players.slice().sort((a, b) => b.st.gls - a.st.gls || b.st.ast - a.st.ast)[0];
    const potm = elig.slice().sort((a, b) => ar(b) - ar(a))[0];
    const young = elig.filter(p => ageAt(p) <= 21).sort((a, b) => ar(b) - ar(a))[0];
    const tots = [];
    for (const [g, n] of [["GK", 1], ["DEF", 4], ["MID", 3], ["ATT", 3]]) tots.push(...elig.filter(p => posGroup(p.main) === g).sort((a, b) => ar(b) - ar(a)).slice(0, n).map(p => p.id));
    res.leagues[L.id] = { champion: tb[0].id, runnerUp: tb[1].id, topScorer: topScorer?.id, topGoals: topScorer?.st.gls, potm: potm?.id, young: young?.id, tots };
    L.history.push({ season, champion: tb[0].id, runnerUp: tb[1].id, topScorer: topScorer?.id, topGoals: topScorer?.st.gls, potm: potm?.id });
    addNews(G, `${G.clubs[tb[0].id].name} juara ${L.name} ${seasonLabel(season)}.`);
  }
  // global awards
  const coef = { ENG1: 1, ESP1: 1, ITA1: 0.95, GER1: 0.95, FRA1: 0.9, IDN1: 0.35 };
  const all = Object.values(G.players).filter(p => !p.retired && p.club && G.clubs[p.club] && coef[G.clubs[p.club].league] && (p.st.apps + p.st.sub) >= 15);
  const sc = p => {
    const lg = G.clubs[p.club].league;
    const ar = p.st.rsum / Math.max(1, p.st.rn);
    const champ = champions[lg] === p.club ? 6 : 0;
    const intl = p.isUser && G.user.tourWin === season ? 10 : 0;
    return ((ar - 6.5) * 22 + p.st.gls * 0.55 + p.st.ast * 0.35 + champ + p.ca / 8 + intl) * coef[lg];
  };
  const ranked = all.map(p => ({ p, s: sc(p) })).sort((a, b) => b.s - a.s);
  res.global.ballon = ranked.slice(0, 30).map(x => x.p.id);
  res.global.young = ranked.filter(x => ageAt(x.p) <= 21 && G.clubs[x.p.club].league !== "IDN1").slice(0, 10).map(x => x.p.id);
  const shoe = all.map(p => ({ p, s: p.st.gls * (G.clubs[p.club].league === "IDN1" ? 1 : 2) })).sort((a, b) => b.s - a.s);
  res.global.shoe = shoe[0]?.p.id;
  G.lastAwards = res;
  addNews(G, `Bola Emas ${season + 1}: ${fullName(G.players[res.global.ballon[0]])} (${G.clubs[G.players[res.global.ballon[0]].club].short}).`);
  return res;
}

export function userSeasonEnd(G, awards) {
  const p = userP(G), season = G.season, u = G.user;
  const club = userClub(G);
  const L = G.leagues[club.league];
  const cs = u.cs;
  const ar = s => s.rn ? +(s.rsum / s.rn).toFixed(2) : null;
  const row = {
    season: seasonLabel(season), club: club.id, clubName: club.name, league: L?.name || "", loan: !!u.loan,
    apps: cs.liga.apps, sub: cs.liga.sub, gls: cs.liga.gls, ast: cs.liga.ast, rating: ar(cs.liga), min: cs.liga.min, pom: cs.liga.pom,
    u19: cs.u19.apps + cs.u19.sub ? { apps: cs.u19.apps + cs.u19.sub, gls: cs.u19.gls, ast: cs.u19.ast, rating: ar(cs.u19) } : null,
    intl: cs.timnas.apps + cs.timnas.sub ? { apps: cs.timnas.apps + cs.timnas.sub, gls: cs.timnas.gls, ast: cs.timnas.ast, rating: ar(cs.timnas) } : null,
    ca: p.ca, notes: [],
  };
  const la = awards.leagues[club.league];
  if (la) {
    const pos = table(G, club.league).findIndex(r => r.id === club.id) + 1;
    row.pos = pos;
    if (la.champion === club.id && cs.liga.apps + cs.liga.sub > 0) { u.trophies.push({ name: L.name, year: seasonLabel(season), club: club.name }); row.notes.push("Juara liga"); }
    if (la.topScorer === p.id) { u.awards.push({ name: `Top Skor ${L.name}`, year: seasonLabel(season), detail: `${la.topGoals} gol` }); row.notes.push("Top skor"); }
    if (la.potm === p.id) { u.awards.push({ name: `Pemain Terbaik ${L.name}`, year: seasonLabel(season) }); row.notes.push("Pemain terbaik liga"); }
    if (la.young === p.id) { u.awards.push({ name: `Pemain Muda Terbaik ${L.name}`, year: seasonLabel(season) }); row.notes.push("Pemain muda terbaik"); }
    if (la.tots.includes(p.id)) { u.awards.push({ name: `Tim Terbaik Musim ${L.name}`, year: seasonLabel(season) }); }
  }
  const br = awards.global.ballon.indexOf(p.id);
  if (br === 0) { u.awards.push({ name: "Bola Emas", year: String(season + 1) }); row.notes.push("Bola Emas"); }
  else if (br > 0) { row.ballon = br + 1; addMail(G, "Bola Emas", `Kamu masuk nominasi Bola Emas dan finis di peringkat ${br + 1}.`, "good"); }
  const yr = awards.global.young.indexOf(p.id);
  if (yr === 0) u.awards.push({ name: "Trofi Pemain Muda Eropa", year: String(season + 1) });
  if (awards.global.shoe === p.id) u.awards.push({ name: "Sepatu Emas", year: seasonLabel(season), detail: `${cs.liga.gls} gol` });
  u.history.push(row);
  const msg = `Musim ${row.season} selesai. ${row.apps + row.sub} penampilan liga, ${row.gls} gol, ${row.ast} assist${row.rating ? `, rating rata-rata ${row.rating.toFixed(2)}` : ""}.${row.notes.length ? " " + row.notes.join(", ") + "!" : ""}`;
  addMail(G, "Ringkasan musim", msg, row.notes.length ? "good" : "info");
  u.cs = newCompStats();
}

// End-of-contract handling for the user (June)
export function userContractExpiry(G, rng) {
  const p = userP(G), season = seasonOf(G.date);
  if (G.user.loan) return;
  if (p.contract.end > season) return;
  const age = ageOn(p.birth, G.date);
  const cands = Object.values(G.clubs).filter(c => c.id !== p.club && LEAGUES.some(l => l.id === c.league) && c.level <= p.ca + 12 && c.level >= p.ca - 25 && fifaU18Allowed(p.nat, age, c.nation).ok && clubNatOK(c, p.nat));
  const picks = rng.shuffle(cands).slice(0, 6).sort((a, b) => b.level - a.level).slice(0, 3);
  if (!picks.length) { p.contract = { end: season + 1, wage: fairWage(p, userClub(G).league) }; addMail(G, "Kontrak diperpanjang", "Tidak ada klub lain yang serius, jadi kamu menandatangani kontrak baru 1 musim dengan klubmu.", "info"); return; }
  decision(G, "Kamu pemain bebas", `Kontrakmu dengan ${userClub(G).name} habis. Beberapa klub menawarimu kontrak:`, picks.map(c => {
    const wage = Math.round(fairWage(p, c.league) * rng.float(0.95, 1.2) / 50) * 50;
    const years = age < 28 ? 3 : 2;
    return { label: `${c.name}`, detail: `${G.leagues[c.league].name} · ${years} tahun · €${wage.toLocaleString("id-ID")}/pekan`, act: "freeAgent", data: { to: c.id, wage, years } };
  }), "transfer");
}
