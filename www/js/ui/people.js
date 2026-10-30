// Player profile tabs adapted from FM to a player career: Pribadi, Kontrak, Performa, Karier,
// Bandingkan; the contract negotiation screen; talks with the manager, agent and teammates.
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, pill1, stars, avatar, lookFor, natTag, flagEmoji, heading, toast, money, moneyShort, moneyM, bars, shortDay, silhouette, attrClass } from "./core.js";
import { NATIONS, POS_LABEL } from "../data.js";
import { ATTRS, A } from "../attributes.js";
import { fmt, fmtDay, ymd, ageOn, seasonLabel, seasonOf, day } from "../calendar.js";
import { userP, userClub, weeksLabel, YC_LIMIT, leagueSeasonLabel } from "../world.js";
import { fullName, shortName, personality, marketValue, fairWage } from "../player.js";
import { squadStatus, coachReport, fed, playShare, TALKS, talk, YOUTH_NT } from "../career.js";
import { canSwitch } from "../intl.js";
import { rngOf } from "../sim.js";
import { reputation, REP_COLOR, staffOf, agentName, severity, severityWord, moraleWord, moraleFace } from "../meta.js";
import {
  ROLE_PT, roleIndex, roleShare, BONUS_KEYS, CLAUSE_KEYS, proposeNegotiation, acceptClubOffer, cancelNegotiation, pph21Weekly, interestedClubs,
  AGENT_TOPICS, agentTalk, agentOf, homegrownStatus, permitOK, permitPoints, MATE_TOPICS, mateTalk, relWord,
} from "../contract.js";
import { header, ratingChart } from "./player.js";
import { mediaWord } from "../press.js";
import { PERF_VIEWS, perfView, careerTimeline, careerStatsHtml } from "./extra.js";

const avgR = st => (st && st.rn ? st.rsum / st.rn : null);
const own = p => !!p.isUser;
const card = (title, body, extra = "") => `<div class="card" ${extra}>${title ? `<div class="ch">${title}</div>` : ""}${body}</div>`;
const kv = rows => `<div class="kv" style="margin:0">${rows.filter(Boolean).map(([k, v]) => `<div><div class="k">${k}</div><div class="v" style="white-space:normal">${v}</div></div>`).join("")}</div>`;
const COMP_NAME = (G, key) => key === "liga" ? (G.leagues[G.clubs[userP(G).club]?.league]?.name || "Liga") : key === "u19" ? "Liga U-19" : key === "timnas" ? "Tim Nasional" : key === "friendly" ? "Nonkompetitif" : G.comps[key]?.name || key;

// ---------- PRIBADI ----------
function langLevel(G, p, l) {
  if (!p.isUser) return l === NATIONS[p.nat]?.language ? "Fasih" : "Bagus";
  if (G.user.adapt?.lang === l) return `Belajar (${Math.min(95, Math.round((G.date - G.user.adapt.since) / 300 * 100))}%)`;
  return (p.langs || []).indexOf(l) === 0 ? "Fasih" : "Bagus";
}
function mediaDesc(G, p) {
  const age = ageOn(p.birth, G.date), pos = POS_LABEL[p.main].toLowerCase();
  const moves = p.isUser ? (G.user.moves || []).length : 0;
  if (age <= 19 && p.pa - p.ca > 40) return `Bakat muda ${pos}`;
  if (age <= 23) return `${POS_LABEL[p.main]} muda`;
  if (moves >= 4) return `${POS_LABEL[p.main]} pengembara`;
  if (age >= 32) return `${POS_LABEL[p.main]} veteran`;
  return `${POS_LABEL[p.main]} berpengalaman`;
}
function happiness(G, p) {
  const pos = [], neg = [];
  if (!p.isUser) return { pos: ["Belum ada data"], neg: [] };
  const share = playShare(G), st = squadStatus(G);
  const exp = p.squad === "Y" ? 0.5 : roleShare(G.user.promise?.role || st);
  if (share >= exp - 0.05) pos.push("Puas dengan menit bermainnya"); else neg.push("Ingin lebih banyak menit bermain");
  const form = p.form.slice(-5); const fa = form.length ? form.reduce((s, x) => s + x, 0) / form.length : null;
  if (fa != null && fa >= 7) pos.push("Sedang dalam performa bagus"); else if (fa != null && fa < 6.4) neg.push("Kecewa dengan performanya sendiri");
  if (G.user.adapt) neg.push(`Masih belajar bahasa ${G.user.adapt.lang}`);
  const tr = G.user.trainRatings || []; const ta = tr.length ? tr.slice(-5).reduce((s, x) => s + x, 0) / Math.min(5, tr.length) : null;
  if (ta != null && ta >= 7) pos.push("Menikmati latihan bersama tim");
  if (!p.contract.youth && p.contract.wage < fairWage(p, G.clubs[p.club].league) * 0.75) neg.push("Merasa gajinya di bawah nilainya");
  if (G.user.promise?.misses) neg.push("Janji waktu bermain belum ditepati");
  if ((G.user.trophies || []).some(t => t.club === G.clubs[p.club].name)) pos.push("Bangga dengan trofi bersama klub");
  if (p.caps) pos.push("Bangga membela tim nasional");
  if (!pos.length) pos.push("Gembira bisa berada di klub");
  return { pos, neg };
}
function hierarchy(G, p) {
  const club = G.clubs[p.club]; if (!club) return ["-", ""];
  const age = ageOn(p.birth, G.date), tenure = p.isUser ? (G.date - ((G.user.moves || []).filter(m => m.to === p.club).slice(-1)[0]?.date ?? G.user.startDate)) / 365 : 2;
  const score = (p.a[A.ldr] || 10) + tenure * 2 + (age - 20) * 0.5 + (squadStatus(G, p) === "Pemain Kunci" ? 4 : 0);
  return score >= 22 ? ["Pemimpin Tim", "Suaranya didengar di ruang ganti."] : score >= 17 ? ["Pemain Berpengaruh", "Dihormati rekan-rekan setim."] : score >= 13 ? ["Pemain Mapan", "Sudah diterima sebagai bagian dari skuad."] : ["Pemain Baru/Muda", "Masih membangun tempatnya di ruang ganti."];
}
function socialGroup(G, p) {
  const club = G.clubs[p.club]; if (!club) return [];
  const pool = (p.squad === "Y" ? club.youthSquad : club.squad).map(id => G.players[id]).filter(q => q && q.id !== p.id);
  const langs = new Set(p.langs || [NATIONS[p.nat]?.language]);
  return pool.filter(q => q.nat === p.nat || langs.has(NATIONS[q.nat]?.language)).slice(0, 6);
}
function plans(G, p) {
  if (!p.isUser) return ["Tidak ada rencana yang diketahui", ""];
  const age = ageOn(p.birth, G.date), st = squadStatus(G), amb = p.hid.amb;
  const short = p.squad === "Y" ? "Menembus tim utama" : ["Pemain Cadangan", "Prospek Muda"].includes(st) ? "Mendapat lebih banyak menit bermain" : amb >= 15 && p.ca > G.clubs[p.club].level + 5 ? "Pindah ke klub yang lebih besar" : "Mempertahankan tempat di tim inti";
  const long = age >= 31 ? (p.hid.pro >= 14 ? "Meninjau kemungkinan menjadi pelatih setelah pensiun" : "Menutup karier dengan baik") : age <= 22 ? "Bermain di liga top dan membela tim nasional" : amb >= 15 ? "Memenangi trofi besar" : "Menjadi pemain penting di klubnya";
  return [short, long];
}
register("pemain", "pribadi", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  const club = G.clubs[p.club];
  const hp = happiness(G, p), [hier, hierTxt] = hierarchy(G, p), grp = socialGroup(G, p), [pShort, pLong] = plans(G, p);
  const langs = p.isUser ? p.langs || [] : [NATIONS[p.nat]?.language].filter(Boolean);
  const u = G.user;
  let nt = "";
  if (own(p)) {
    const caps = p.caps || 0, youthCaps = Object.entries(u.int.youth || {});
    const sw = canSwitch(G), hg = homegrownStatus(G), res = u.residence || {};
    const club0 = G.clubs[p.club];
    const elig = [[p.nat, "Kewarganegaraan"], ...(p.nat2 ? [[p.nat2, "Kewarganegaraan kedua"]] : [])];
    nt = card("Tim Nasional", `<div class="row" style="gap:10px">${flagEmoji(fed(G))}<div><b>Bermain untuk ${esc(NATIONS[fed(G)].name)}</b><div class="muted" style="font-size:13px">${caps} penampilan / ${p.intGoals || 0} gol${youthCaps.length ? ` (${youthCaps.map(([k, v]) => `${v} caps ${k}`).join(", ")})` : ""}</div></div></div>
      ${kv([["Debut senior", u.debut ? `${flagEmoji(u.debut.opp)} ${esc(NATIONS[u.debut.opp]?.name || "")} (${fmt(u.debut.date)})` : "Belum"], ["Opini media", caps >= 10 ? "Pilihan reguler timnas" : caps ? "Mulai dipercaya pelatih timnas" : "Tidak ada"]])}
      <div class="lbl" style="margin:12px 0 4px">Kelayakan untuk Tim Nasional</div>
      ${elig.map(([n, why]) => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${flagEmoji(n)} ${esc(NATIONS[n].name)}</span><span class="muted">${why} · ${n === fed(G) ? "✓ federasi saat ini" : sw.ok ? "✓ memenuhi syarat" : "✗ " + esc(sw.why || "")}</span></div>`).join("")}
      <div class="lbl" style="margin:12px 0 4px">Pemain binaan (15–21 tahun, 3 tahun)</div>
      ${Object.entries(hg.progressNation).map(([n, d]) => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${flagEmoji(n)} Binaan ${esc(NATIONS[n]?.name || n)}</span><span class="row" style="gap:6px">${d >= 1095 ? '<span style="color:var(--good)">✓ Memenuhi syarat</span>' : `${Math.round(d)}/1095 hari`}</span></div>`).join("")}
      ${Object.entries(hg.progressClub).map(([c, d]) => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${crest(G.clubs[c], 16)} Binaan ${esc(G.clubs[c]?.short || c)}</span><span>${d >= 1095 ? '<span style="color:var(--good)">✓ Memenuhi syarat</span>' : `${Math.round(d)}/1095 hari`}</span></div>`).join("") || '<div class="muted" style="font-size:13px">Belum ada catatan.</div>'}
      <button class="btn sm" data-go="timnas/ringkasan" style="margin-top:10px">Lihat halaman timnas ${esc(NATIONS[fed(G)].name)}</button>
      ${club0 && club0.nation !== p.nat && club0.nation !== p.nat2 ? `<div class="lbl" style="margin:12px 0 4px">Kelayakan kewarganegaraan</div><div class="spread" style="font-size:14px"><span>${flagEmoji(club0.nation)} ${esc(NATIONS[club0.nation].name)} · 5 tahun tinggal setelah usia 18</span><span>${Math.round(res[club0.nation] || 0)}/1825 hari</span></div>${bars(Math.min(10, Math.round((res[club0.nation] || 0) / 182.5)), 10, "g")}` : ""}`);
  }
  const money = own(p) && u.money ? u.money : null;
  const tax = own(p) && club?.nation === "IDN" && !p.contract.youth ? pph21Weekly(p.contract.wage) : null;
  root.innerHTML = header(G, p) +
    card("Info Pribadi", kv([
      ["Nama lengkap", esc(fullName(p))], ["Usia", `${ageOn(p.birth, G.date)} tahun (${fmt(p.birth)})`],
      ["Tempat lahir", `${p.birthplace ? esc(p.birthplace) + ", " : ""}${esc(NATIONS[p.nat].name)}`], ["Kewarganegaraan", `${natTag(p.nat)}${p.nat2 ? ` · ${natTag(p.nat2)}` : ""}`],
      ["Bahasa", esc(langs.map(l => `${l} (${langLevel(G, p, l)})`).join(", ") || "-")], ["Reputasi", `<span style="color:${REP_COLOR[reputation(G, p)]}">●</span> ${reputation(G, p)}`],
      ["Kepribadian", esc(personality(p))], ["Berbasis di", club ? `${flagEmoji(club.nation)} ${esc(NATIONS[club.nation].name)}` : "-"],
      own(p) ? ["Agen", `${esc(agentOf(G).name)} <span class="muted">(${esc(agentOf(G).level)})</span>`] : null, ["Deskripsi media", esc(mediaDesc(G, p))], own(p) ? ["Citra di media", esc(mediaWord(G.user.media || 0))] : null,
    ])) +
    card("Kebahagiaan", `<div class="row" style="gap:10px;margin-bottom:8px"><span style="font-size:30px">${moraleFace(p.morale ?? 65)}</span><b style="font-size:18px">${moraleWord(p.morale ?? 65)}</b></div>
      <div class="lbl" style="color:var(--good)">Hal positif</div>${hp.pos.map(t => `<div style="font-size:14px;padding:3px 0">🙂 ${esc(t)}</div>`).join("")}
      ${hp.neg.length ? `<div class="lbl" style="color:var(--bad);margin-top:8px">Hal negatif</div>${hp.neg.map(t => `<div style="font-size:14px;padding:3px 0">🙁 ${esc(t)}</div>`).join("")}` : ""}`) +
    card("Dinamika", kv([
      own(p) ? ["Hubungan dengan pelatih", esc(coachRelWord(G))] : ["Hubungan denganmu", esc(relWord(G.user.rel?.[p.id] || 0))],
      ["Hierarki", `${esc(hier)}<div class="muted" style="font-size:12.5px">${esc(hierTxt)}</div>`],
    ]) + `<div class="lbl" style="margin:10px 0 4px">Grup sosial</div>${grp.length ? grp.map(q => `<span class="tag click" data-pid="${q.id}" style="margin:0 4px 4px 0">${flagEmoji(q.nat)} ${esc(shortName(q))}${own(p) && G.user.rel?.[q.id] ? ` · ${esc(relWord(G.user.rel[q.id]))}` : ""}</span>`).join("") : '<div class="muted" style="font-size:13px">Belum punya kelompok dekat di skuad.</div>'}`) +
    card("Rencana", kv([["Jangka pendek", esc(pShort)], ["Jangka panjang", esc(pLong)]])) +
    (own(p) ? card("Klub Favorit", (G.user.history.length || G.user.moves?.length ? [...new Set([G.user.moves?.[0]?.from || p.club])] : [p.club]).map(c => `<div class="spread" style="font-size:14px"><span class="row" style="gap:6px">${crest(G.clubs[c], 18)}${esc(G.clubs[c]?.name || "")}</span><span class="muted">Klub masa muda</span></div>`).join("")) : "") +
    nt +
    (money ? card("Keuangan Pribadi", kv([["Gaji", `${moneyShort(p.contract.wage)} p/mgg`], tax ? ["Setelah PPh 21 (perkiraan)", `${moneyShort(tax.netEur)} p/mgg <div class="muted" style="font-size:12px">tarif efektif ${(tax.rate * 100).toFixed(1).replace(".", ",")}%</div>`] : null, ["Pendapatan musim ini", moneyShort(money.season)], ["Bonus musim ini", moneyShort(money.bonus)], ["Total sepanjang karier", moneyShort(money.total)]]) + (tax ? `<p class="muted" style="font-size:12px;margin-top:8px">PPh 21 dihitung tahunan dengan tarif Pasal 17 UU HPP, PTKP TK/0 Rp54 juta, dan biaya jabatan 5% (maks. Rp6 juta).</p>` : "")) : "");
});
function coachRelWord(G) {
  const tr = G.user.trainRatings || [], ta = tr.length ? tr.slice(-6).reduce((s, x) => s + x, 0) / Math.min(6, tr.length) : 6.6;
  const v = (ta - 6.6) * 40 + (G.user.coachRel || 0);
  return v >= 30 ? "Sangat dihargai pelatih" : v >= 10 ? "Dipercaya pelatih" : v <= -25 ? "Hubungan tegang" : "Tidak punya pendapat jelas tentangmu";
}

// ---------- KONTRAK ----------
register("pemain", "kontrak", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  const c = p.contract || {}, club = G.clubs[p.club];
  const endD = day((c.end || seasonOf(G.date)) + 1, 6, 30), left = endD - G.date;
  const leftTxt = left > 365 ? `${Math.floor(left / 365)} tahun, ${left % 365} hari` : `${left} hari`;
  const b = c.bonuses || {};
  const share = own(p) ? playShare(G) : null;
  const role = own(p) ? G.user.promise?.role || (p.squad === "Y" ? "Pemain Akademi" : squadStatus(G)) : squadStatus(G, p);
  const dots = n => `<div class="row" style="gap:4px;margin-top:6px">${Array.from({ length: 9 }, (_, i) => `<i style="width:14px;height:14px;border-radius:50%;border:2px dashed #7b5bd6;${i < n ? "background:#7b5bd6" : ""}"></i>`).join("")}</div>`;
  const ints = own(p) ? interestedClubs(G) : [];
  const perm = own(p) ? permitOK(G, { nation: "ENG" }) : null;
  const pts = own(p) && perm?.need ? permitPoints(G) : null;
  const tax = own(p) && club?.nation === "IDN" && !c.youth ? pph21Weekly(c.wage) : null;
  root.innerHTML = header(G, p) +
    card("Rincian Kontrak", kv([
      ["Gaji", c.youth ? "Kontrak akademi" : `${moneyShort(c.wage || 0)} p/mgg${tax ? `<div class="muted" style="font-size:12px">${moneyShort(tax.netEur)} setelah PPh 21</div>` : ""}`],
      ["Jenis kontrak", c.youth ? "Kontrak Akademi" : own(p) && G.user.loan ? "Pinjaman" : "Kontrak Penuh Waktu"],
      ["Tanggal mulai", c.start ? fmt(c.start) : own(p) && G.user.startDate != null ? fmt(G.user.startDate) : "-"], ["Tanggal kedaluwarsa", fmt(endD)], ["Sisa waktu kontrak", leftTxt],
      own(p) && !c.youth ? ["Persentase anggaran gaji", `${(c.wage / Math.max(1, G.clubs[p.club].squad.reduce((s, id) => s + (G.players[id]?.contract?.wage || 0), 0)) * 100).toFixed(1).replace(".", ",")}%`] : null,
    ])) +
    card("Bonus & Klausul", `${BONUS_KEYS.filter(([k]) => b[k]).map(([k, l]) => `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>${l}</span><b>${money(b[k])}</b></div>`).join("")}
      ${c.loyalty ? `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>Bonus Loyalitas</span><b>${moneyShort(c.loyalty)}</b></div>` : ""}
      ${c.raise ? `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>Kenaikan Gaji Tahunan</span><b>${c.raise}%</b></div>` : ""}
      ${c.release ? `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>Klausul Pelepasan Biaya Minimum</span><b>${moneyM(c.release)}</b></div>` : ""}
      ${c.relegRelease ? `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>Klausul Pelepasan saat Degradasi</span><b>Ya</b></div>` : ""}
      ${c.relegCut ? `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>Penurunan Gaji Degradasi</span><b>${c.relegCut}%</b></div>` : ""}
      ${c.promoRaise ? `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>Kenaikan Gaji karena Promosi</span><b>${c.promoRaise}%</b></div>` : ""}
      ${!Object.keys(b).length && !c.release && !c.raise ? '<div class="muted" style="font-size:13.5px">Tidak ada bonus atau klausul khusus.</div>' : ""}`) +
    card("Jam Terbang Bermain", `<div style="font-size:16px"><b>${esc(role)}</b></div>${own(p) && p.squad === "A" ? `<div class="muted" style="font-size:13px">Menit bermain dari 8 laga terakhir: ${Math.round((share || 0) * 100)}%${G.user.promise ? ` · janji: ${Math.round(roleShare(G.user.promise.role) * 100)}%` : ""}</div>${dots(Math.round((share || 0) * 9))}` : ""}`) +
    (own(p) ? card("Status Transfer", kv([["Status transfer", G.user.listed ? "Masuk daftar transfer" : G.user.blockOffers ? "Tidak mau dijual" : "Belum ditetapkan"], ["Status pinjaman", G.user.wantLoan ? "Tersedia untuk dipinjamkan" : "Belum ditetapkan"]]) +
      `<div class="lbl" style="margin:10px 0 4px">Klub peminat (${ints.length})</div>${ints.slice(0, 6).map(x => `<div class="spread click" data-club="${x.id}" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span class="row" style="gap:6px">${crest(G.clubs[x.id], 16)}${esc(G.clubs[x.id].name)}</span><span class="muted">${x.level}</span></div>`).join("") || '<div class="muted" style="font-size:13px">Tidak ada klub yang berminat.</div>'}`) : "") +
    (own(p) && perm ? card("Izin Kerja (Inggris)", perm.need ? `<div style="font-size:14px">${perm.ok ? '<span style="color:var(--good)">✓ Kemungkinan lolos</span>' : '<span style="color:var(--bad)">✗ Belum memenuhi syarat</span>'} · ${pts.total}/15 poin</div>
      ${kv([["Penampilan internasional", `${pts.intl} poin`], ["Penampilan untuk klub", `${pts.club} poin`], ["Kompetisi kontinental", `${pts.cont} poin`], ["Kualitas liga", `${pts.league} poin`]])}
      <p class="muted" style="font-size:12px;margin-top:8px">Disederhanakan dari sistem poin Governing Body Endorsement (GBE) FA. Setelah 5 tahun tinggal di Inggris kamu mendapat status tinggal tetap.</p>` : `<div style="font-size:14px">Tidak perlu: ${esc(perm.why || "")}</div>`) : "") +
    (own(p) ? `<div class="card"><button class="btn pri" data-act="agent" style="width:100%;min-height:46px">Diskusikan Kontrak Baru dengan Agen</button>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn" data-go="pemain/transfer" style="flex:1">Atur status transfer</button><button class="btn danger" data-act="retire" style="flex:1">Pensiun…</button></div>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn" data-act="coach" style="flex:1">Bicara dengan Pelatih</button>${G.neg && ["open", "final"].includes(G.neg.status) ? '<button class="btn" data-go="pemain/negosiasi" style="flex:1">Lanjutkan Negosiasi</button>' : ""}</div></div>` : "");
});

// ---------- PERFORMA ----------
register("pemain", "performa", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  const pv = prm.pv || "statistik";
  const tabs = `<div class="seg wscroll" style="margin-bottom:10px;overflow-x:auto">${PERF_VIEWS.map(([k, l]) => `<button data-pv="${k}" aria-pressed="${pv === k}">${l}</button>`).join("")}</div>`;
  const wire = () => { $$("[data-pv]", root).forEach(b => (b.onclick = () => go("pemain", "performa", { ...prm, pv: b.dataset.pv }, true))); $("#rc", root)?.addEventListener("change", e => go("pemain", "performa", { ...prm, rc: e.target.value }, true)); };
  if (pv !== "statistik") { root.innerHTML = header(G, p) + tabs + perfView(G, p, pv, prm); wire(); return; }
  const head = `<tr><th>Kompetisi</th><th class="n">Main</th><th class="n">Gol</th><th class="n">Ast</th><th class="n">PTP</th><th class="n">KK</th><th class="n">KM</th><th>Rata2</th></tr>`;
  const row = (name, s, cls = "") => `<tr class="${cls}"><td>${esc(name)}</td><td class="n">${s.apps}${s.sub ? ` (${s.sub})` : ""}</td><td class="n">${s.gls}</td><td class="n">${s.ast}</td><td class="n">${s.pom || 0}</td><td class="n">${s.yc}</td><td class="n">${s.rc}</td><td>${pill(avgR(s))}</td></tr>`;
  let body;
  if (own(p)) {
    const cs = G.user.cs;
    const keys = Object.keys(cs).filter(k => cs[k].apps + cs[k].sub > 0 || k === "liga");
    const order = k => (k === "friendly" ? 0 : k === "liga" ? 1 : k === "timnas" ? 9 : k === "u19" ? 2 : 5);
    keys.sort((a, b) => order(a) - order(b));
    const clubKeys = keys.filter(k => !["timnas", "friendly"].includes(k));
    const tot = clubKeys.reduce((t, k) => { for (const f of Object.keys(cs[k])) t[f] = (t[f] || 0) + cs[k][f]; return t; }, {});
    body = card(`Statistik Musim ${seasonLabel(G.season)}`, `<div class="tscroll"><table class="tbl"><thead>${head}</thead><tbody>${keys.map(k => row(COMP_NAME(G, k), cs[k], k === "friendly" ? "" : "")).join("")}${row("Keseluruhan (Klub)", { apps: 0, sub: 0, gls: 0, ast: 0, pom: 0, yc: 0, rc: 0, rsum: 0, rn: 0, ...tot }, "me")}</tbody></table></div><div class="muted" style="font-size:12px;margin-top:6px">PTP = pemain terbaik pertandingan · KK/KM = kartu kuning/merah</div>`);
    // suspensions per competition
    const myComps = ["liga", ...Object.values(G.comps).filter(c => c.kind !== "po" && c.teams.includes(p.club) && !c.youth).map(c => c.id)];
    body += card("Larangan Bermain", myComps.map(k => { const n = (p.ycs?.[k] || 0) % YC_LIMIT(k), lim = YC_LIMIT(k); return `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>${esc(COMP_NAME(G, k))}</span><span class="row" style="gap:8px">${p.bans?.[k] > 0 ? `<b style="color:var(--bad)">Skorsing ${p.bans[k]} laga</b>` : `${n}/${lim}`} ${bars(n, lim, "y")}</span></div>`; }).join("") + `<p class="muted" style="font-size:12px;margin-top:6px">Akumulasi ${YC_LIMIT("liga")} kartu kuning di liga atau ${YC_LIMIT("x")} di piala/antarklub = skorsing satu laga di kompetisi itu.</p>`);
    const inj = (G.user.injuries || []).slice().reverse();
    body += card("Riwayat Cedera", inj.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Tanggal</th><th>Cedera</th><th>Keparahan</th><th>Absen</th></tr></thead><tbody>${inj.map(i => `<tr><td>${fmt(i.date)}</td><td>${esc(i.name)}</td><td>${severityWord(i.days)} ${bars(severity(i.days), 4, "r")}</td><td>${weeksLabel(i.days)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="muted">Belum pernah cedera.</div>');
    body += `<div class="bcards"><div class="bcard"><div class="ch">Risiko Cedera</div><div class="big">${p.cond < 70 || G.user.training.intensity === "Tinggi" ? "Tinggi" : p.cond < 85 ? "Sedang" : "Minimal"}</div><div class="muted" style="font-size:12.5px">Berdasarkan kondisi dan beban latihan</div></div>
      <div class="bcard"><div class="ch">Kerentanan Cedera</div><div class="big">${p.hid.inj >= 15 ? "Rawan" : p.hid.inj >= 9 ? "Rata-rata" : "Jarang cedera"}</div>${bars(Math.round(p.hid.inj / 20 * 7), 7, p.hid.inj >= 15 ? "r" : "g")}</div></div>`;
    body += card("Laga Terakhir", (G.user.matchLog || []).length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Tgl</th><th>Lawan</th><th class="c">K/T</th><th class="c">Skor</th><th class="n">Mnt</th><th class="n">G</th><th class="n">A</th><th>Rating</th></tr></thead><tbody>${G.user.matchLog.slice(0, 15).map(m => `<tr><td>${shortDay(m.date)}</td><td>${esc(m.opp)}<div class="muted" style="font-size:11.5px">${esc(m.comp)}</div></td><td class="c">${m.ha}</td><td class="c"><span class="tag" style="border-color:${m.score[0] > m.score[1] ? "var(--good)" : m.score[0] < m.score[1] ? "var(--bad)" : "#888"}">${m.score[0]}-${m.score[1]}</span></td><td class="n">${m.min}</td><td class="n">${m.gls || ""}</td><td class="n">${m.ast || ""}</td><td>${pill1(m.rating)}${m.pom ? " ★" : ""}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Belum ada laga.</div>');
    body += card("Grafik Rating", ratingChart(G.user.matchLog || []));
  } else body = card(`Statistik Musim ${seasonLabel(G.season)}`, `<div class="tscroll"><table class="tbl"><thead>${head}</thead><tbody>${row(COMP_NAME(G, "liga"), p.st)}</tbody></table></div>`);
  root.innerHTML = header(G, p) + tabs + body;
  wire();
});

// ---------- KARIER (narrative + table) ----------
function bio(G, p) {
  const u = G.user, H = u.history, moves = u.moves || [];
  const first = H[0]?.clubName || G.clubs[p.club]?.name;
  const apps = H.reduce((s, h) => s + h.apps + h.sub, 0) + p.st.apps + p.st.sub, gls = H.reduce((s, h) => s + h.gls, 0) + p.st.gls;
  const parts = [];
  parts.push(`${esc(fullName(p))} memulai kariernya di ${esc(first || "akademi")} pada ${seasonLabel(seasonOf(u.startDate))}${p.squad === "Y" && !H.length ? " sebagai pemain akademi" : ""}.`);
  if (u.debutClub) parts.push(`Ia melakoni debut senior bersama ${esc(G.clubs[u.debutClub.club]?.name || "")} pada ${fmt(u.debutClub.date)}.`);
  const loans = moves.filter(m => m.type === "loan"), trf = moves.filter(m => m.type === "transfer");
  if (loans.length) parts.push(`Ia sempat dipinjamkan ke ${loans.map(m => esc(G.clubs[m.to]?.name || "")).join(", ")}.`);
  if (trf.length) parts.push(`Kepindahannya: ${trf.map(m => `${esc(G.clubs[m.to]?.name || "")} (${m.fee ? esc(moneyM(m.fee)) : "gratis"}, ${ymd(m.date).y})`).join(", ")}.`);
  parts.push(`Sejauh ini ia mencatat ${apps} penampilan liga dan ${gls} gol.`);
  if (p.caps) parts.push(`Di level internasional, ia sudah ${p.caps} kali membela ${esc(NATIONS[fed(G)].name)}${u.debut ? `, debut melawan ${esc(NATIONS[u.debut.opp]?.name || "")} pada ${fmt(u.debut.date)}` : ""}.`);
  if (u.trophies.length) parts.push(`Gelar yang sudah diraih: ${u.trophies.map(t => `${esc(t.name)} (${esc(t.club)} ${esc(t.year)})`).join(", ")}.`);
  return parts.join(" ");
}
register("pemain", "karier", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  if (!own(p)) { root.innerHTML = header(G, p) + card("Karier", `<table class="tbl"><tbody><tr><td>${seasonLabel(G.season)}</td><td>${esc(G.clubs[p.club]?.name || "")}</td><td class="n">${p.st.apps + p.st.sub}</td><td class="n">${p.st.gls}</td></tr></tbody></table><p class="muted" style="font-size:13px">Riwayat lengkap hanya dicatat untuk kariermu sendiri.</p>`); return; }
  const kv0 = prm.kv || "ringkasan";
  const ktabs = `<div class="seg" style="margin-bottom:10px">${[["ringkasan", "Ringkasan"], ["linimasa", "Linimasa"], ["statistik", "Statistik"]].map(([k, l]) => `<button data-kv="${k}" aria-pressed="${kv0 === k}">${l}</button>`).join("")}</div>`;
  if (kv0 === "statistik") {
    root.innerHTML = header(G, p) + ktabs + careerStatsHtml(G);
    $$("[data-kv]", root).forEach(b => (b.onclick = () => go("pemain", "karier", { ...prm, kv: b.dataset.kv }, true)));
    return;
  }
  if (kv0 === "linimasa") {
    const f = prm.kf || "semua";
    const ev = careerTimeline(G, f);
    let lastY = null;
    root.innerHTML = header(G, p) + ktabs + `<div class="card"><div class="seg wscroll" style="margin-bottom:10px;overflow-x:auto">${[["semua", "Semua"], ["menonjol", "✓ Menonjol"], ["penghargaan", "Penghargaan"], ["landmark", "Landmark"], ["kompetisi", "Kompetisi"], ["transfer", "Transfer"]].map(([k, l]) => `<button data-kf="${k}" aria-pressed="${f === k}">${l}</button>`).join("")}</div>${ev.map(e => { const y = ymd(e.d).y; const hd = y !== lastY ? `<div style="text-align:center;margin:14px 0 6px"><span class="tag" style="font-size:15px;padding:4px 14px">${y}</span></div>` : ""; lastY = y; return hd + `<div class="spread" style="padding:7px 0;border-top:1px solid var(--line);font-size:14px;gap:8px"><span>${e.icon} ${esc(e.text)} <span class="muted">(${fmt(e.d)})</span></span><span class="muted" style="white-space:nowrap">${e.club && G.clubs[e.club] ? `${crest(G.clubs[e.club], 14)} ${esc(G.clubs[e.club].short)}` : e.clubName ? esc(e.clubName) : e.nat ? flagEmoji(e.nat) : ""}</span></div>`; }).join("") || '<div class="empty">Belum ada catatan.</div>'}</div>`;
    $$("[data-kv]", root).forEach(b => (b.onclick = () => go("pemain", "karier", { ...prm, kv: b.dataset.kv }, true)));
    $$("[data-kf]", root).forEach(b => (b.onclick = () => go("pemain", "karier", { ...prm, kf: b.dataset.kf }, true)));
    return;
  }
  const u = G.user, H = u.history;
  const cur = G.clubs[p.club], L = G.leagues[cur?.league];
  const moveInfo = (club, season) => { const m = (u.moves || []).find(x => x.to === club && seasonLabel(seasonOf(x.date)) === season); return m ? (m.type === "loan" ? "Pinjaman" : m.fee ? esc(moneyM(m.fee)) : "Gratis") : ""; };
  const rows = [...H.map(h => ({ season: h.season, club: h.club, name: h.clubName, info: h.loan ? "Pinjaman" : moveInfo(h.club, h.season), nation: G.clubs[h.club]?.nation, div: h.league, apps: h.apps + h.sub, gls: h.gls, rating: h.rating, pos: h.pos })),
    { season: seasonLabel(G.season), club: p.club, name: cur?.name, info: u.loan ? "Pinjaman" : moveInfo(p.club, seasonLabel(G.season)), nation: cur?.nation, div: L?.name || "", apps: u.cs.liga.apps + u.cs.liga.sub, gls: u.cs.liga.gls, rating: avgR(u.cs.liga), current: true }].reverse();
  const tot = rows.reduce((t, r) => ({ apps: t.apps + r.apps, gls: t.gls + r.gls }), { apps: 0, gls: 0 });
  root.innerHTML = header(G, p) + ktabs +
    card("", `<b style="font-size:16px">${esc(fullName(p))} ${reputation(G, p) === "Lokal" ? "masih merintis jalan menuju sorotan publik." : `dikenal di level ${reputation(G, p).toLowerCase()}.`}</b><p style="font-size:14.5px;line-height:1.55;margin:8px 0 0">${bio(G, p)}</p>`) +
    card("Rangkuman Riwayat", `<div class="tscroll"><table class="tbl"><thead><tr><th>Tahun</th><th>Tim</th><th>Info</th><th>Negara</th><th>Divisi</th><th class="n">Main</th><th class="n">Gol</th><th>Rata2</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.current ? "me" : ""}"><td>${esc(r.season)}</td><td><span class="row click" data-club="${r.club}" style="gap:6px">${crest(G.clubs[r.club], 16)}${esc(r.name || "")}</span></td><td>${r.info}</td><td>${r.nation ? `${flagEmoji(r.nation)} ${esc(NATIONS[r.nation].name)}` : ""}</td><td>${esc(r.div)}${r.pos ? ` <span class="muted">(ke-${r.pos})</span>` : ""}</td><td class="n">${r.apps}</td><td class="n">${r.gls}</td><td>${pill(r.rating)}</td></tr>`).join("")}<tr><td colspan="5"><b>Total</b></td><td class="n"><b>${tot.apps}</b></td><td class="n"><b>${tot.gls}</b></td><td></td></tr></tbody></table></div>`) +
    card("Perpindahan", (u.moves || []).map(m => `<div style="padding:5px 0;border-top:1px solid var(--line);font-size:14px">${fmt(m.date)} · ${esc(G.clubs[m.from]?.short || "")} → <b>${esc(G.clubs[m.to]?.name || "")}</b> <span class="muted">${m.type === "loan" ? "pinjaman" : m.fee ? esc(moneyM(m.fee)) : "gratis"}</span></div>`).join("") || '<div class="muted">Belum pernah pindah klub.</div>') +
    card("Trofi", u.trophies.map(t => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🏆 ${esc(t.name)} <span class="muted">· ${esc(t.club)}</span></span><span class="num muted">${esc(t.year)}</span></div>`).join("") || '<div class="muted">Belum ada trofi.</div>') +
    card("Penghargaan", u.awards.map(t => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🎖 ${esc(t.name)}${t.detail ? ` <span class="muted">· ${esc(t.detail)}</span>` : ""}</span><span class="num muted">${esc(t.year)}</span></div>`).join("") || '<div class="muted">Belum ada penghargaan.</div>');
  $$("[data-kv]", root).forEach(b => (b.onclick = () => go("pemain", "karier", { ...prm, kv: b.dataset.kv }, true)));
});

// ---------- NEGOSIASI ----------
const step = (v, k) => (k === "wage" ? Math.max(50, Math.round(v * 0.05 / 50) * 50) : k === "loyalty" ? Math.max(500, Math.round(v * 0.1 / 500) * 500) : 50);
register("pemain", "negosiasi", (G, root) => {
  const N = G.neg;
  if (!N) { root.innerHTML = card("", '<div class="muted">Tidak ada negosiasi yang berjalan.</div>'); return; }
  const p = userP(G), c = G.clubs[N.club], A = N.ask, O = N.offer;
  const rep = coachReport(G, p);
  const done = !["open", "final"].includes(N.status);
  const row = (key, label, valHtml, controls = true, removable = false) => `<div class="spread" style="padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:14.5px">${label}</span><span class="row" style="gap:6px">${controls && !done ? `<button class="btn sm" data-dec="${key}">−</button>` : ""}<b style="min-width:84px;text-align:center">${valHtml}</b>${controls && !done ? `<button class="btn sm" data-inc="${key}">+</button>` : ""}${removable && !done ? `<button class="btn sm ghost" data-del="${key}" aria-label="Hapus">🗑</button>` : ""}</span></div>`;
  const bonusRows = BONUS_KEYS.filter(([k]) => A.bonuses?.[k]).map(([k, l]) => row("b." + k, l, money(A.bonuses[k]), true, true)).join("");
  const clauseVal = k => (k === "release" ? (A.release ? esc(moneyM(A.release)) : "-") : k === "relegRelease" ? (A.relegRelease ? "Ya" : "Tidak") : `${A[k] || 0}%`);
  const clauseOn = k => (k === "release" ? A.release != null : k === "relegRelease" ? A.relegRelease : !!A[k]);
  const clauseRows = CLAUSE_KEYS.filter(([k]) => clauseOn(k)).map(([k, l]) => row("c." + k, l, clauseVal(k), k !== "relegRelease", true)).join("");
  const addB = BONUS_KEYS.filter(([k]) => !A.bonuses?.[k]), addC = CLAUSE_KEYS.filter(([k]) => !clauseOn(k));
  const offerTxt = `${esc(money(O.wage))}/pekan · ${O.years} tahun · ${esc(O.role)}${O.release ? ` · klausul ${esc(moneyM(O.release))}` : ""}`;
  root.innerHTML = `<div class="card"><div class="row" style="gap:10px">${crest(c, 44)}<div style="flex:1;min-width:0"><b style="font-size:17px">${esc(c.name)}</b><div class="muted" style="font-size:13px">${esc({ pro: "Kontrak profesional pertama", renew: "Perpanjangan kontrak", transfer: `Kontrak pribadi · biaya transfer ${moneyM(N.fee)}`, free: "Kontrak pemain bebas" }[N.kind])}</div></div></div>
      <div class="grid2" style="margin-top:10px;font-size:13.5px"><div><div class="lbl">Kemampuan</div>${stars(rep.ca)}</div><div><div class="lbl">Potensi</div>${stars(rep.pa)}</div><div><div class="lbl">Gaji sekarang</div>${p.contract.youth ? "Akademi" : `${moneyShort(p.contract.wage)} p/mgg`}</div><div><div class="lbl">Nilai pasar</div>${moneyM(Math.round(N.valueM * 10) / 10)}</div></div></div>
    <div class="card"><div class="row" style="gap:8px;margin-bottom:8px">${silhouette(34)}<div><b>${esc(N.director)}</b><div class="muted" style="font-size:12.5px">Direktur Olahraga · putaran ${N.round}/${N.patience}</div></div></div>
      ${N.log.slice(-4).map(m => `<div style="margin:6px 0;${m.who === "you" ? "margin-left:40px;background:#3b5bdb" : "margin-right:20px;background:#2a2735"};padding:8px 10px;border-radius:10px;font-size:14px">${esc(m.text)}</div>`).join("")}</div>
    ${done ? card("", N.status === "agreed" ? `<b style="color:var(--good)">Kontrak disepakati.</b><p class="muted" style="font-size:13.5px">Gaji ${money(O.wage)}/pekan sampai ${seasonLabel(p.contract.end)}.</p><button class="btn pri" data-go="pemain/kontrak">Lihat kontrak</button>` : `<b style="color:var(--bad)">Negosiasi berakhir.</b>`) : `
    <div class="card"><div class="ch">Tawaran klub saat ini</div><div style="font-size:14px">${offerTxt}</div></div>
    <div class="card"><div class="ch">Permintaanmu</div>
      ${row("status", "Status kontrak", "Waktu Penuh", false)}
      ${row("wage", "Gaji", money(A.wage) + "<small class='muted'>/mgg</small>")}
      ${row("loyalty", "Bonus Loyalitas", moneyShort(A.loyalty || 0))}
      ${row("years", "Durasi Kontrak", `${A.years} tahun`)}
      <div class="spread" style="padding:8px 0;border-top:1px solid var(--line)"><span style="font-size:14.5px">Janji jam terbang bermain</span><select id="role" style="max-width:55%;min-width:0">${ROLE_PT.map(([r]) => `<option ${A.role === r ? "selected" : ""}>${r}${r === N.rec ? " (direkomendasikan)" : ""}</option>`).join("")}</select></div>
      <div class="ch" style="font-size:14px;margin-top:12px">Bonus & Klausul</div>${bonusRows}${clauseRows}
      <div style="display:grid;gap:8px;margin-top:8px">${addB.length ? `<select id="addb" style="width:100%;min-width:0"><option value="">+ Tambahkan bonus</option>${addB.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>` : ""}${addC.length ? `<select id="addc" style="width:100%;min-width:0"><option value="">+ Tambahkan klausul</option>${addC.map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select>` : ""}</div></div>
    <div class="card"><button class="btn pri" id="propose" style="width:100%;min-height:48px;font-family:var(--display);font-size:19px">Ajukan Permintaan</button>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn" id="acceptc" style="flex:1">Terima tawaran klub</button><button class="btn" id="reset" style="flex:1">Reset</button></div>
      <button class="btn danger sm" id="cancel" style="width:100%;margin-top:8px">Batalkan negosiasi</button></div>`}`;
  if (done) return;
  const upd = () => { save(); render(); };
  const adjust = (key, dir) => {
    if (key === "wage") A.wage = Math.max(50, A.wage + dir * step(A.wage, "wage"));
    else if (key === "loyalty") A.loyalty = Math.max(0, (A.loyalty || 0) + dir * step(A.loyalty || 5000, "loyalty"));
    else if (key === "years") A.years = Math.min(5, Math.max(1, A.years + dir));
    else if (key.startsWith("b.")) { const k = key.slice(2); A.bonuses[k] = Math.max(50, A.bonuses[k] + dir * Math.max(50, Math.round(A.wage * 0.02 / 50) * 50)); }
    else if (key.startsWith("c.")) {
      const k = key.slice(2);
      if (k === "release") A.release = Math.max(0.1, Math.round((A.release + dir * Math.max(0.1, N.valueM * 0.1)) * 10) / 10);
      else A[k] = Math.min(50, Math.max(5, (A[k] || 0) + dir * 5));
    }
    upd();
  };
  $$("[data-inc]", root).forEach(b => (b.onclick = () => adjust(b.dataset.inc, 1)));
  $$("[data-dec]", root).forEach(b => (b.onclick = () => adjust(b.dataset.dec, -1)));
  $$("[data-del]", root).forEach(b => (b.onclick = () => { const k = b.dataset.del; if (k.startsWith("b.")) delete A.bonuses[k.slice(2)]; else { const c2 = k.slice(2); if (c2 === "release") A.release = null; else if (c2 === "relegRelease") A.relegRelease = false; else A[c2] = 0; } upd(); }));
  $("#role", root).onchange = e => { A.role = e.target.value.replace(" (direkomendasikan)", ""); upd(); };
  $("#addb", root)?.addEventListener("change", e => { const k = e.target.value; if (!k) return; A.bonuses = A.bonuses || {}; A.bonuses[k] = Math.max(50, Math.round(A.wage * 0.1 / 50) * 50); upd(); });
  $("#addc", root)?.addEventListener("change", e => { const k = e.target.value; if (!k) return; if (k === "release") A.release = Math.round(N.valueM * 3 * 10) / 10; else if (k === "relegRelease") A.relegRelease = true; else A[k] = k === "raise" ? 5 : 25; upd(); });
  $("#propose", root).onclick = () => { const rng = rngOf(G); const r = proposeNegotiation(G, rng); G.rs = rng.s; save(); if (r?.ok) toast("Kontrak disepakati!"); render(); };
  $("#acceptc", root).onclick = () => { const rng = rngOf(G); acceptClubOffer(G, rng); G.rs = rng.s; save(); toast("Kontrak disepakati!"); render(); };
  $("#reset", root).onclick = () => { N.ask = JSON.parse(JSON.stringify(N.offer)); upd(); };
  $("#cancel", root).onclick = () => { if (!confirm("Batalkan negosiasi? Tawaran ini akan hilang.")) return; const rng = rngOf(G); cancelNegotiation(G, rng); G.rs = rng.s; save(); render(); };
});

// ---------- talks: manager, agent, teammates (chat sheet) ----------
export function chatSheet(G, { title, sub, avatarHtml, mood, opener, topics, onTopic }) {
  const el = document.createElement("div"); el.className = "sheet";
  const log = [{ who: "them", text: opener }];
  const paint = () => {
    el.innerHTML = `<div style="max-width:640px;margin:0 auto;padding:12px">
      <div class="spread" style="margin-bottom:10px"><div class="row" style="gap:10px">${avatarHtml}<div><b style="font-size:18px">${esc(title)}</b><div class="muted" style="font-size:13px">${esc(sub)}</div></div></div><button class="ibtn" id="xclose" aria-label="Tutup">✕</button></div>
      ${mood ? `<div class="muted" style="font-size:13px;margin-bottom:8px">${mood}</div>` : ""}
      <div id="chat">${log.map(m => `<div style="margin:8px 0;${m.who === "you" ? "margin-left:48px;background:#3b5bdb" : "margin-right:28px;background:#2a2735"};padding:10px 12px;border-radius:12px;font-size:14.5px">${esc(m.text)}</div>`).join("")}</div>
      <div class="lbl" style="margin:14px 0 6px">Pilih topik</div>${topics.map(([k, l]) => `<button class="opt" data-t="${k}"><b>${esc(l)}</b></button>`).join("")}</div>`;
    $("#xclose", el).onclick = close;
    $$("[data-t]", el).forEach(b => (b.onclick = () => {
      const [k, l] = topics.find(t => t[0] === b.dataset.t);
      log.push({ who: "you", text: l });
      const rng = rngOf(G); const r = onTopic(k, rng); G.rs = rng.s; save();
      log.push({ who: "them", text: r || "…" });
      paint(); el.scrollTop = el.scrollHeight;
    }));
  };
  const close = () => { el.remove(); window.removeEventListener("popstate", onPop); render(); };
  const onPop = () => close();
  document.body.appendChild(el); history.pushState({ sheet: true }, ""); window.addEventListener("popstate", onPop, { once: true });
  paint();
}
export function openCoachTalk(G) {
  const club = userClub(G), coach = staffOf(G, club.id).find(s => s.role === (userP(G).squad === "Y" ? "Pelatih U-19" : "Manajer"));
  chatSheet(G, {
    title: coach?.name || "Pelatih", sub: userP(G).squad === "Y" ? "Pelatih U-19" : "Manajer", avatarHtml: silhouette(44), mood: `Bahasa tubuh: <b>${esc(coachRelWord(G))}</b>`,
    opener: "Kamu ingin bertemu denganku? Kita langsung ke intinya.",
    topics: [...TALKS, ["feedback", "Minta umpan balik soal perkembanganku"], ["role", "Apa peranku di tim?"]],
    onTopic: (k, rng) => {
      if (k === "feedback") { const r = coachReport(G, userP(G)); return r.text + " Fokus latihanmu saat ini: " + G.user.training.focus + "."; }
      if (k === "role") { const st = squadStatus(G); return `Saat ini aku melihatmu sebagai ${st}.${G.user.promise ? ` Di kontrakmu tertulis ${G.user.promise.role}; aku tahu itu.` : ""}`; }
      const r = talk(G, k, rng); G.user.coachRel = (G.user.coachRel || 0) + (/Oke|Baik|akan/.test(r) ? 3 : -2);
      return r.replace(/^Pelatih: |^Direktur olahraga: /, "").replace(/^"|"$/g, "");
    },
  });
}
export function openAgentTalk(G) {
  const ag = agentOf(G), ints = interestedClubs(G);
  chatSheet(G, {
    title: ag.name, sub: `Agen · ${ag.level}`, avatarHtml: silhouette(44),
    mood: ints.length ? `Klub yang memantaumu: ${ints.slice(0, 4).map(x => `${esc(G.clubs[x.id].short)} (${x.level.toLowerCase()})`).join(", ")}` : "Belum ada klub yang memantaumu.",
    opener: "Aku dengar kamu ingin bicara? Ayo!", topics: AGENT_TOPICS,
    onTopic: (k, rng) => { const r = agentTalk(G, rng, k); setTimeout(() => { if (k === "renew" && G.neg?.status === "open") toast("Negosiasi kontrak dibuka. Cek pesan."); }, 0); return r; },
  });
}
export function openMateTalk(G, pid) {
  const q = G.players[pid];
  chatSheet(G, {
    title: fullName(q), sub: `${POS_LABEL[q.main]} · ${esc(relWord(G.user.rel?.[pid] || 0))}`, avatarHtml: avatar(lookFor(q), G.clubs[q.club]?.colors || ["#333", "#fff"], 44, ageOn(q.birth, G.date)),
    opener: `${q.fn}: "Ada apa?"`, topics: MATE_TOPICS, onTopic: (k, rng) => mateTalk(G, rng, pid, k),
  });
}
