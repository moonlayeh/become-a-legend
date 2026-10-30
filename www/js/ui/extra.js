// More FM-style screens adapted to a player career: contacts, staff profiles, the player database,
// national team pages, and the deeper player tabs (transfer, development, performance views,
// career timeline, full comparison).
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, pill1, stars, avatar, lookFor, natTag, flagEmoji, toast, money, moneyShort, moneyM, bars, shortDay, silhouette, attrClass } from "./core.js";
import { NATIONS, POS_LABEL } from "../data.js";
import { ATTRS, A, WEIGHTS } from "../attributes.js";
import { fmt, ageOn, seasonLabel, seasonOf, day, ymd } from "../calendar.js";
import { userP, userClub, weeksLabel } from "../world.js";
import { fullName, shortName, personality, marketValue, fairWage } from "../player.js";
import { squadStatus, coachReport, fed, playShare, posGroup, selectNational, ntFor } from "../career.js";
import { RNG, clamp } from "../rng.js";
import { hash, reputation, REP_COLOR, staffOf, ntCoach, ROLES, roleStars, bestRole, PITCH_XY, famWord, fitnessWord, severity, severityWord, clubMatchDays, userMatchDays, clubReputation } from "../meta.js";
import { ROLE_PT, roleShare, interestedClubs, agentOf, homegrownStatus, relWord } from "../contract.js";
import { header } from "./player.js";

const card = (title, body, extra = "") => `<div class="card" ${extra}>${title ? `<div class="ch">${title}</div>` : ""}${body}</div>`;
const kv = rows => `<div class="kv" style="margin:0">${rows.filter(Boolean).map(([k, v]) => `<div><div class="k">${k}</div><div class="v" style="white-space:normal">${v}</div></div>`).join("")}</div>`;
const seg = (key, cur, opts) => `<div class="seg wscroll" style="margin-bottom:10px;overflow-x:auto">${opts.map(([v, l]) => `<button data-${key}="${v}" aria-pressed="${cur === v}">${l}</button>`).join("")}</div>`;
const caStars = ca => clamp(Math.round(((ca - 20) / 32) * 2) / 2, 0.5, 5);
const avg = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const meter = (v, of = 10, cls = "") => `<span class="segbar ${cls}">${Array.from({ length: of }, (_, i) => `<i class="${i < v ? "on" : ""}"></i>`).join("")}</span>`;

// ============ KONTAK ============
register("portal", "kontak", (G, root) => {
  const u = userP(G), club = userClub(G), ag = agentOf(G);
  const staff = staffOf(G, club.id);
  const rows = [];
  rows.push({ name: ag.name, club: "-", nat: u.nat, job: "Agen", rel: "Memiliki relasi yang ramah denganmu", good: true });
  const coachRole = u.squad === "Y" ? "Pelatih U-19" : "Manajer";
  staff.forEach((s, i) => { if (["Manajer", "Asisten Manajer", "Pelatih U-19", "Pelatih Kepala Akademi", "Direktur Olahraga"].includes(s.role)) rows.push({ name: s.name, club: club.id, nat: s.nat, job: s.role, rel: s.role === coachRole ? coachRel(G) : "Hubungan profesional", good: s.role === coachRole, go: { club: club.id, i } }); });
  if (u.caps || G.camp) rows.push({ name: ntCoach(fed(G)), club: "-", nat: fed(G), job: `Pelatih Timnas ${NATIONS[fed(G)].name}`, rel: u.caps ? "Mengenalmu dari pemusatan latihan" : "Pernah memantaumu", good: !!u.caps });
  for (const [id, v] of Object.entries(G.user.rel || {})) { const q = G.players[id]; if (q && v) rows.push({ pid: q.id, name: fullName(q), club: q.club, nat: q.nat, job: "Pemain", rel: relWord(v), good: v > 0 }); }
  for (const m of G.user.moves || []) { const s = staffOf(G, m.from).find(x => x.role === "Manajer"); if (s && G.clubs[m.from]) rows.push({ name: s.name, club: m.from, nat: s.nat, job: "Manajer (mantan klub)", rel: "Mantan pelatihmu", good: true, go: { club: m.from, i: staffOf(G, m.from).indexOf(s) } }); }
  root.innerHTML = card(`Kontak (${rows.length})`, `<div class="tscroll"><table class="tbl"><thead><tr><th>Nama</th><th>Klub</th><th>Negara</th><th>Pekerjaan</th><th>Hubungan</th></tr></thead><tbody>${rows.map((r, i) => `<tr class="${r.pid || r.go ? "click" : ""}" ${r.pid ? `data-pid="${r.pid}"` : r.go ? `data-staff="${i}"` : ""}><td>${esc(r.name)}</td><td>${r.club !== "-" && G.clubs[r.club] ? `<span class="row" style="gap:6px">${crest(G.clubs[r.club], 16)}${esc(G.clubs[r.club].short)}</span>` : "-"}</td><td>${natTag(r.nat)}</td><td>${esc(r.job)}</td><td style="white-space:normal;min-width:150px;color:${r.good ? "#c5d84a" : "inherit"}">${r.good ? "🙂 " : ""}${esc(r.rel)}</td></tr>`).join("")}</tbody></table></div><p class="muted" style="font-size:12.5px;margin-top:8px">Rekan setim muncul di sini setelah kamu berinteraksi dengan mereka (puji, tegur, minta saran, ajak latihan).</p>`);
  $$("[data-staff]", root).forEach(tr => (tr.onclick = () => go("staf", "profil", rows[+tr.dataset.staff].go)));
});
function coachRel(G) {
  const tr = G.user.trainRatings || [], ta = tr.length ? avg(tr.slice(-6)) : 6.6;
  const v = (ta - 6.6) * 40 + (G.user.coachRel || 0);
  return v >= 30 ? "Sangat menghargaimu" : v >= 10 ? "Memiliki relasi yang ramah denganmu" : v <= -25 ? "Hubungan tegang" : "Belum punya pendapat jelas tentangmu";
}

// ============ PROFIL STAF ============
const COACH_ATTR = [["yng", "Bekerja dengan Pemain Muda"], ["def", "Bertahan"], ["spc", "Bola Mati"], ["fit", "Kebugaran"], ["gkp", "Kemampuan Jaga Gawang"], ["atk", "Menyerang"], ["pos", "Penguasaan"], ["tac", "Taktis"], ["tec", "Teknis"]];
const COACH_MENTAL = [["adp", "Kemampuan Adaptasi"], ["man", "Manajemen SDM"], ["mot", "Motivasi"], ["aut", "Otoritas"], ["det", "Tekad"]];
const cWord = v => (v >= 17 ? "Istimewa" : v >= 14 ? "Sangat Bagus" : v >= 11 ? "Bagus" : v >= 8 ? "Kompeten" : v >= 5 ? "Sedang" : "Lemah");
const cCol = v => (v >= 17 ? "#6fd36b" : v >= 14 ? "#a6d84f" : v >= 11 ? "#e6d34a" : v >= 8 ? "#cfcfcf" : "#f1a33c");
export function coachProfile(G, clubId, i) {
  const c = G.clubs[clubId], s = staffOf(G, clubId)[i];
  const r = new RNG(hash("coach" + clubId + i + s.name));
  const lvl = clamp((c.level - 38) / 7, 6, 17);
  const tilt = { "Pelatih Kiper": { gkp: 4 }, "Pelatih Kebugaran": { fit: 4 }, "Pelatih U-19": { yng: 3 }, "Pelatih Kepala Akademi": { yng: 4 }, "Analis Performa": { tac: 2 } }[s.role] || {};
  const at = {};
  for (const [k] of [...COACH_ATTR, ...COACH_MENTAL]) at[k] = clamp(Math.round(lvl + r.normal(0, 2.4) + (tilt[k] || 0)), 1, 20);
  const tend = [];
  if (at.spc >= 13) tend.push("Memaksimalkan bola mati");
  if (at.yng >= 13) tend.push("Memberi perhatian besar pada pengembangan pemain muda");
  if (at.tac >= 14) tend.push("Pengutak-atik taktik");
  if (at.adp >= 13) tend.push("Membentuk pemain agar mampu bermain baik di posisi yang bukan posisi alaminya");
  if (at.mot >= 14) tend.push("Motivator ulung");
  if (at.aut >= 15) tend.push("Disiplin dan tegas di ruang ganti");
  if (at.man >= 15) tend.push("Inspirator");
  if (at.fit >= 14) tend.push("Menuntut kebugaran tinggi");
  if (!tend.length) tend.push("Pendekatan seimbang");
  const style = at.pos >= at.atk && at.pos >= at.def ? "Penguasaan Bola" : at.atk >= at.def ? "Menyerang Langsung" : "Bertahan Rapat";
  const lic = c.level >= 140 ? "Lisensi Pro Kontinental" : c.level >= 110 ? "Lisensi A Kontinental" : c.level >= 85 ? "Lisensi B Nasional" : "Lisensi C Nasional";
  const pers = ["Seimbang", "Ambisius", "Profesional", "Tegas", "Santai", "Penuh Semangat"][r.int(0, 5)];
  const fav = Object.values(G.clubs).filter(x => x.nation === s.nat && G.leagues[x.league]);
  return { s, c, at, tend, style, lic, pers, fav: fav.length ? r.pick(fav) : null };
}
register("staf", "profil", (G, root, prm) => {
  const clubId = prm.club || userClub(G).id, i = prm.i ?? 0;
  const P = coachProfile(G, clubId, i), { s, c, at } = P;
  const isMine = clubId === userP(G).club;
  root.innerHTML = `<div class="phead"><div class="top">${silhouette(72)}<div style="min-width:0;flex:1"><div class="nm">${esc(s.name)}</div><div class="sub">${esc(s.role)}</div><div class="sub" style="margin-top:2px">${natTag(s.nat)} · ${s.age} tahun</div></div></div>
    <div class="kv"><div class="click" data-club="${c.id}"><div class="k">Klub</div><div class="v"><span class="row" style="gap:6px">${crest(c, 18)}${esc(c.name)}</span></div></div><div><div class="k">Kontrak</div><div class="v">s.d. 30/6/${s.until + 1}</div></div><div><div class="k">Reputasi</div><div class="v"><span style="color:${REP_COLOR[clubReputation(c)]}">●</span> ${clubReputation(c)}</div></div></div>
    ${isMine && ["Manajer", "Pelatih U-19"].includes(s.role) ? `<div class="row" style="gap:8px;padding:0 12px 12px"><button class="btn sm" data-act="coach" style="flex:1">💬 Bicara</button></div>` : ""}</div>` +
    card("Atribut Kepelatihan", COACH_ATTR.map(([k, l]) => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${l}</span><b style="color:${cCol(at[k])}">${cWord(at[k])}</b></div>`).join("")) +
    card("Atribut Mental", COACH_MENTAL.map(([k, l]) => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${l}</span><b style="color:${cCol(at[k])}">${cWord(at[k])}</b></div>`).join("")) +
    card("Kecenderungan", P.tend.map(t => `<div style="padding:5px 0;border-top:1px solid var(--line);font-size:14px">${esc(t)}</div>`).join("")) +
    card("Info", kv([["Kepribadian", P.pers], ["Formasi pilihan", esc(c.formation || "4-3-3")], ["Gaya taktik", P.style], ["Kualifikasi", P.lic], ["Bahasa", `${esc(NATIONS[s.nat].language)} (Fasih)`], ["Klub favorit", P.fav ? esc(P.fav.name) : "-"]])) +
    `<p class="muted" style="font-size:12px;margin:0 4px 12px">Atribut staf dibuat dari kekuatan klub dan bersifat tetap; dipakai sebagai gambaran gaya pelatih.</p>`;
});

// ============ DATABASE PEMAIN ============
register("cari", "pemain", (G, root, prm) => {
  const f = { q: "", pos: "", amin: 15, amax: 45, league: "", nat: "", contract: "", sort: "ca", n: 50, ...prm };
  const u = userP(G);
  const today = G.date, season = seasonOf(today);
  const leagues = Object.values(G.leagues).sort((a, b) => a.name.localeCompare(b.name));
  const nats = [...new Set(Object.values(G.players).map(p => p.nat))].sort((a, b) => NATIONS[a].name.localeCompare(NATIONS[b].name));
  const q = f.q.trim().toLowerCase();
  let list = Object.values(G.players).filter(p => !p.retired && G.clubs[p.club] && G.leagues[G.clubs[p.club].league]);
  list = list.filter(p => {
    const age = ageOn(p.birth, today);
    if (age < f.amin || age > f.amax) return false;
    if (f.pos && !(p.main === f.pos || (p.positions?.[f.pos] || 0) >= 15)) return false;
    if (f.league && G.clubs[p.club].league !== f.league) return false;
    if (f.nat && p.nat !== f.nat) return false;
    if (f.contract === "habis" && (p.contract?.end ?? 99) > season) return false;
    if (f.contract === "akademi" && p.squad !== "Y") return false;
    if (q && !fullName(p).toLowerCase().includes(q)) return false;
    return true;
  });
  const val = p => marketValue(p, today, G.clubs[p.club].league);
  const key = { ca: p => -p.ca, usia: p => ageOn(p.birth, today), nilai: p => -val(p), nama: p => p.ln }[f.sort];
  list.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const total = list.length;
  const shown = list.slice(0, f.n);
  const known = p => p.club === u.club || G.clubs[p.club].league === userClub(G).league || p.nat === u.nat;
  const POSS = ["GK", "DR", "DC", "DL", "WBR", "WBL", "DM", "MR", "MC", "ML", "AMR", "AMC", "AML", "ST"];
  root.innerHTML = `<div class="card"><div class="ch">Filter</div>
    <label class="fld"><span>Nama</span><input id="fq" value="${esc(f.q)}" placeholder="Cari nama pemain"></label>
    <div class="grid2"><label class="fld"><span>Posisi</span><select id="fpos"><option value="">Apa pun</option>${POSS.map(x => `<option value="${x}" ${f.pos === x ? "selected" : ""}>${x} · ${POS_LABEL[x]}</option>`).join("")}</select></label>
    <label class="fld"><span>Umur</span><span class="row" style="gap:6px"><select id="famin">${Array.from({ length: 31 }, (_, i) => i + 15).map(a => `<option ${a === f.amin ? "selected" : ""}>${a}</option>`).join("")}</select>–<select id="famax">${Array.from({ length: 31 }, (_, i) => i + 15).map(a => `<option ${a === f.amax ? "selected" : ""}>${a}</option>`).join("")}</select></span></label>
    <label class="fld"><span>Liga</span><select id="flg"><option value="">Semua liga</option>${leagues.map(L => `<option value="${L.id}" ${f.league === L.id ? "selected" : ""}>${esc(L.name)}</option>`).join("")}</select></label>
    <label class="fld"><span>Negara</span><select id="fnat"><option value="">Semua</option>${nats.map(n => `<option value="${n}" ${f.nat === n ? "selected" : ""}>${esc(NATIONS[n].name)}</option>`).join("")}</select></label>
    <label class="fld"><span>Status kontrak</span><select id="fct"><option value="">Apa pun</option><option value="habis" ${f.contract === "habis" ? "selected" : ""}>Habis musim ini</option><option value="akademi" ${f.contract === "akademi" ? "selected" : ""}>Pemain akademi</option></select></label>
    <label class="fld"><span>Urutkan</span><select id="fsort">${[["ca", "Kemampuan"], ["nilai", "Nilai transfer"], ["usia", "Termuda"], ["nama", "Nama"]].map(([k, l]) => `<option value="${k}" ${f.sort === k ? "selected" : ""}>${l}</option>`).join("")}</select></label></div>
    <button class="btn sm" id="fclr">Bersihkan</button></div>
  <div class="card"><div class="ch">${total.toLocaleString("id-ID")} pemain ditemukan</div><div class="tscroll"><table class="tbl"><thead><tr><th>Pemain</th><th>Negara</th><th>Klub</th><th>Posisi</th><th class="n">Usia</th><th>Kemampuan</th><th>Potensi</th><th>Nilai</th><th>Gaji</th></tr></thead><tbody>
    ${shown.map(p => { const v = val(p) * 1e6, k = known(p); return `<tr class="click ${p.isUser ? "me" : ""}" data-pid="${p.id}"><td>${esc(fullName(p))}</td><td>${natTag(p.nat)}</td><td><span class="row" style="gap:6px">${crest(G.clubs[p.club], 16)}${esc(G.clubs[p.club].short)}</span></td><td>${p.main}</td><td class="n">${ageOn(p.birth, today)}</td><td>${k ? stars(caStars(p.ca)) : '<span class="muted">Tidak diketahui</span>'}</td><td>${p.club === u.club ? stars(caStars(p.pa)) : '<span class="muted">Tidak diketahui</span>'}</td><td>${moneyShort(v * 0.8)}–${moneyShort(v * 1.2)}</td><td>${p.contract?.youth ? "Akademi" : moneyShort(p.contract?.wage || 0)}</td></tr>`; }).join("")}
  </tbody></table></div>${total > f.n ? `<button class="btn" id="more" style="width:100%;margin-top:8px">Tampilkan ${Math.min(50, total - f.n)} lagi</button>` : ""}
  <p class="muted" style="font-size:12px;margin-top:8px">Kemampuan hanya diketahui untuk pemain di ligamu, senegaramu, atau klubmu; potensi hanya untuk rekan satu klub.</p></div>`;
  const upd = ch => go("cari", "pemain", { ...f, ...ch, n: ch.n || 50 }, true);
  let tq; $("#fq", root).oninput = e => { clearTimeout(tq); tq = setTimeout(() => upd({ q: e.target.value }), 400); };
  $("#fpos", root).onchange = e => upd({ pos: e.target.value });
  $("#famin", root).onchange = e => upd({ amin: +e.target.value });
  $("#famax", root).onchange = e => upd({ amax: +e.target.value });
  $("#flg", root).onchange = e => upd({ league: e.target.value });
  $("#fnat", root).onchange = e => upd({ nat: e.target.value });
  $("#fct", root).onchange = e => upd({ contract: e.target.value });
  $("#fsort", root).onchange = e => upd({ sort: e.target.value });
  $("#fclr", root).onclick = () => go("cari", "pemain", {}, true);
  $("#more", root)?.addEventListener("click", () => upd({ n: f.n + 50 }));
});

// ============ TIM NASIONAL ============
const natRank = nat => Object.keys(NATIONS).sort((a, b) => NATIONS[b].level - NATIONS[a].level).indexOf(nat) + 1;
const CONF_NAME = { UEFA: "Eropa", AFC: "Asia", CAF: "Afrika", CONMEBOL: "Amerika Selatan", CONCACAF: "Amerika Utara & Tengah", OFC: "Oseania" };
function ntHead(G, nat) {
  const N = NATIONS[nat];
  const nl = G.nl && Object.values(G.nl.groups).some(gs => gs.some(g => g.includes(nat)));
  return `<div class="phead"><div class="top"><div style="font-size:56px;line-height:1">${flagEmoji(nat)}</div><div style="min-width:0;flex:1"><div class="nm">${esc(N.name)}</div><div class="sub">${esc(CONF_NAME[N.conf] || N.conf)}</div></div></div>
    <div class="kv"><div><div class="k">Peringkat kekuatan</div><div class="v">#${natRank(nat)} <span class="muted" style="font-size:12px">(perkiraan gim)</span></div></div><div><div class="k">Kompetisi saat ini</div><div class="v">${nl ? "UEFA Nations League" : "Kualifikasi & uji coba"}</div></div><div><div class="k">Pelatih</div><div class="v">${esc(ntCoach(nat))}</div></div><div><div class="k">Bahasa</div><div class="v">${esc(N.language)}</div></div></div></div>`;
}
register("timnas", "ringkasan", (G, root, prm) => {
  const nat = prm.nat || fed(G);
  const team = { name: "Senior", max: 99, level: NATIONS[nat].level, youth: false };
  const squad = selectNational(G, nat, team);
  const u = userP(G);
  const order = { GK: 0, DEF: 1, MID: 2, ATT: 3 };
  squad.sort((a, b) => order[posGroup(a.main)] - order[posGroup(b.main)] || b.ca - a.ca);
  const mine = u.isUser && fed(G) === nat;
  const myHist = (G.user.int.senior || []).filter(m => m.nat === nat);
  root.innerHTML = ntHead(G, nat) +
    (mine ? card("Kamu & Timnas", kv([["Penampilan senior", `${u.caps || 0} laga, ${u.intGoals || 0} gol`], ["Debut", G.user.debut ? `${fmt(G.user.debut.date)} vs ${esc(NATIONS[G.user.debut.opp]?.name || "")}` : "Belum"], ["Status", squad.some(p => p.id === u.id) ? "Masuk perhitungan pelatih" : "Belum masuk skuad"], ["Laga resmi", `${myHist.filter(m => m.official).length}`]])) : "") +
    card(`Skuad Tim Utama (${squad.length})`, `<div class="tscroll"><table class="tbl"><thead><tr><th>Pemain</th><th>Posisi</th><th class="n">Usia</th><th>Kemampuan</th><th>Klub</th></tr></thead><tbody>${squad.map(p => `<tr class="${p.virtual ? "" : "click"} ${p.isUser ? "me" : ""}" ${p.virtual ? "" : `data-pid="${p.id}"`}><td>${esc(fullName(p))}</td><td>${p.main}</td><td class="n">${ageOn(p.birth, G.date)}</td><td>${stars(caStars(p.ca))}</td><td>${G.clubs[p.club] ? `<span class="row" style="gap:6px">${crest(G.clubs[p.club], 16)}${esc(G.clubs[p.club].short)}</span>` : '<span class="muted">Klub luar database</span>'}</td></tr>`).join("")}</tbody></table></div><p class="muted" style="font-size:12px;margin-top:6px">Perkiraan pilihan pelatih berdasarkan kemampuan dan performa terkini. Pemain dari klub di luar database dibuat otomatis.</p>`) +
    card("Prestasi di gim ini", (G.user.trophies || []).filter(t => t.club === NATIONS[nat].name).map(t => `<div style="padding:5px 0;border-top:1px solid var(--line)">🏆 ${esc(t.name)} · ${esc(t.year)}</div>`).join("") || (G.nl?.winner === nat ? "🏆 UEFA Nations League 2026/27" : '<div class="muted">Belum ada gelar yang tercatat sejak awal kariermu.</div>'));
});
register("timnas", "jadwal", (G, root, prm) => {
  const nat = prm.nat || fed(G);
  const rows = [];
  if (G.nl) G.nl.fx.forEach(f => { if (f.h === nat || f.a === nat) rows.push({ d: f.d, opp: f.h === nat ? f.a : f.h, ha: f.h === nat ? "K" : "T", comp: f.stage === "G" ? `Nations League ${f.lg}` : `Nations League ${f.stage}`, res: f.res ? (f.h === nat ? f.res : [f.res[1], f.res[0]]) : null }); });
  if (G.camp && G.camp.nat === nat) G.camp.matches.forEach(m => { if (m.nl == null) rows.push({ d: m.d, opp: m.opp, ha: "-", comp: m.comp, res: m.score || null, mine: true }); });
  rows.sort((a, b) => a.d - b.d);
  const by = {}; for (const r of rows) { const { y, m } = ymd(r.d); (by[`${y}-${m}`] = by[`${y}-${m}`] || []).push(r); }
  const BUL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  root.innerHTML = ntHead(G, nat) + card("Jadwal Pertandingan", Object.entries(by).map(([k, rs]) => { const [y, m] = k.split("-"); return `<div class="lbl" style="margin:10px 0 4px">${BUL[m - 1]} ${y}</div>${rs.map(r => `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>${shortDay(r.d)} · ${flagEmoji(r.opp)} ${esc(NATIONS[r.opp]?.name || r.opp)} <span class="muted">(${r.ha})</span></span><span class="muted" style="text-align:right">${r.res ? `<b style="color:var(--ink)">${r.res[0]}-${r.res[1]}</b> · ` : ""}${esc(r.comp)}</span></div>`).join("")}`; }).join("") || '<div class="muted">Jadwal timnas muncul saat jeda internasional FIFA mendekat (September, Oktober, November, Maret, Juni).</div>');
});

// ============ TRANSFER (player tab) ============
register("pemain", "transfer", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G), own = p.isUser;
  const club = G.clubs[p.club];
  const v = marketValue(p, G.date, club?.league) * 1e6;
  if (!own) { root.innerHTML = header(G, p) + card("Transfer", kv([["Terikat kontrak dengan", esc(club?.name || "-")], ["Nilai transfer", `${moneyShort(v * 0.8)} – ${moneyShort(v * 1.2)}`], ["Kontrak berakhir", `30/6/${(p.contract?.end || 0) + 1}`]])); return; }
  const ints = interestedClubs(G), ag = agentOf(G);
  const offers = G.inbox.filter(m => m.kind === "decision" && !m.done && /transfer|pinjam/i.test(m.tag || ""));
  const active = ints.filter(x => x.score >= 0.55), rumour = ints.filter(x => x.score < 0.55);
  const tabv = prm.tv || "tawaran";
  const list = tabv === "tawaran" ? offers.map(m => `<div class="spread click" data-go="portal/pesan" data-p='{"mail":${m.id}}' style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>📨 ${esc(m.title)}</span><span class="muted">${fmt(m.date)}</span></div>`) : (tabv === "aktif" ? active : rumour).map(x => `<div class="spread click" data-club="${x.id}" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span class="row" style="gap:6px">${crest(G.clubs[x.id], 18)}${esc(G.clubs[x.id].name)} <span class="muted" style="font-size:12px">${esc(G.leagues[G.clubs[x.id].league]?.short || "")}</span></span><span class="muted">${x.level}</span></div>`);
  const hg = homegrownStatus(G);
  const st = G.user.listed ? "listed" : G.user.blockOffers ? "block" : "none";
  root.innerHTML = header(G, p) +
    card("", kv([["Terikat kontrak dengan", `<span class="row" style="gap:6px">${crest(club, 16)}${esc(club.name)}</span>`], ["Nilai transfer", `${moneyShort(v * 0.8)} – ${moneyShort(v * 1.2)}`], ["Status transfer", st === "listed" ? "Masuk daftar transfer" : st === "block" ? "Tidak mau pindah" : "Belum ditetapkan"], ["Status pinjaman", G.user.wantLoan ? "Ingin dipinjamkan" : "Belum ditetapkan"]])) +
    `<div class="card"><div class="ch">Klub Peminat</div>${seg("tv", tabv, [["tawaran", `Tawaran (${offers.length})`], ["aktif", `Minat Aktif (${active.length})`], ["kabar", `Minat Dikabarkan (${rumour.length})`]])}${list.join("") || '<div class="empty">Tidak ada data tersedia.</div>'}</div>` +
    card("Agen", `<div class="row" style="gap:10px;margin-bottom:8px">${silhouette(40)}<div><b>${esc(ag.name)}</b><div class="muted" style="font-size:12.5px">${esc(ag.level)}</div></div></div><button class="btn" data-act="agent" style="width:100%">💬 Minta agen mencarikan klub</button>`) +
    `<div class="card"><div class="ch">Keinginanmu</div><div class="lbl" style="margin-bottom:6px">Status transfer</div>${seg("ts", st, [["none", "Terbuka"], ["listed", "Minta dijual"], ["block", "Tidak mau pindah"]])}
      <div class="lbl" style="margin:4px 0 6px">Status pinjaman</div>${seg("ls", G.user.wantLoan ? "yes" : "no", [["no", "Tidak"], ["yes", "Ingin dipinjamkan"]])}
      <p class="muted" style="font-size:12.5px;margin:0">Minta dijual menaikkan minat klub lain tapi sedikit menurunkan suasana hatimu di klub. "Tidak mau pindah" membuat agen menolak semua tawaran.</p></div>` +
    card("Aturan Pemilihan Skuad", `<div style="font-size:14px">${hg.club.includes(p.club) ? '<span style="color:var(--good)">✓</span> Terhitung pemain binaan klub' : `✗ Belum pemain binaan klub (${Math.round(hg.progressClub[p.club] || 0)}/1095 hari, usia 15–21)`}</div><div style="font-size:14px;margin-top:4px">${hg.nation.includes(club.nation) ? `<span style="color:var(--good)">✓</span> Terhitung binaan ${esc(NATIONS[club.nation].name)}` : `✗ Belum binaan ${esc(NATIONS[club.nation].name)}`}</div>`);
  $$("[data-tv]", root).forEach(b => (b.onclick = () => go("pemain", "transfer", { ...prm, tv: b.dataset.tv }, true)));
  $$("[data-ts]", root).forEach(b => (b.onclick = () => { const v2 = b.dataset.ts; G.user.listed = v2 === "listed"; G.user.blockOffers = v2 === "block"; if (v2 === "listed") p.morale = clamp((p.morale ?? 65) - 3, 0, 100); save(); toast("Status transfer diperbarui."); render(); }));
  $$("[data-ls]", root).forEach(b => (b.onclick = () => { G.user.wantLoan = b.dataset.ls === "yes"; save(); render(); }));
});

// ============ PENGEMBANGAN: efektivitas taktik ============
function nextMatch(G) {
  const md = userMatchDays(G); let best = null;
  for (const [d, m] of md) if (d >= G.date && !m.res && (!best || d < best[0])) best = [d, m];
  return best;
}
register("pemain", "pengembangan", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G), own = p.isUser;
  const club = G.clubs[p.club];
  const role = (ROLES[p.main] || []).find(r => r.name === (own && G.user.training.role)) || bestRole(p);
  const tenureDays = own ? G.date - ((G.user.moves || []).filter(m => m.to === p.club).slice(-1)[0]?.date ?? G.user.startDate) : 400;
  const g = k => p.a[A[k]];
  // 1-10 gauges derived from attributes and context
  const und = clamp(Math.round(((g("dec") + g("ant") + g("pos") + g("tea")) / 4 - 4) / 1.4 + Math.min(2, tenureDays / 200)), 1, 10);
  const abil = clamp(Math.round(roleStars(p, role) * 2), 1, 10);
  const fam = clamp(Math.round((p.positions?.[p.main] || 20) / 2), 1, 10);
  const tr = own ? G.user.trainRatings || [] : [];
  const supp = clamp(Math.round(((p.morale ?? 65) / 10 + (own ? (avg(tr.slice(-6)) ?? 6.6) - 6.6 : 0) * 4 + (own ? Object.values(G.user.rel || {}).reduce((s, x) => s + x, 0) / 40 : 0)) * 0.9), 1, 10);
  const nm = own ? nextMatch(G) : null;
  const oppKnown = nm && G.clubs[nm[1].opp] && G.clubs[nm[1].opp].league === club.league;
  const info = clamp(nm ? (oppKnown ? 7 : 4) + Math.round((g("dec") - 10) / 4) : 5, 1, 10);
  const overall = Math.round((und + abil + fam + supp + info) / 5);
  const col = v => (v >= 8 ? "g" : v >= 5 ? "y" : "r");
  const box = (title, v, desc, factors, note) => `<div class="card"><div class="spread"><b>${title}</b>${meter(v, 10, col(v))}</div><p class="muted" style="font-size:13px;margin:6px 0">${desc}</p>${factors.map(([l, x]) => `<div class="spread" style="padding:4px 0;border-top:1px solid var(--line);font-size:13.5px"><span>${l}</span>${meter(x, 5, col(x * 2))}</div>`).join("")}<div style="margin-top:8px;font-size:13px;background:rgba(111,211,107,.08);border:1px solid rgba(111,211,107,.25);border-radius:8px;padding:8px">${note}</div></div>`;
  const h = v => clamp(Math.round(v / 2), 1, 5);
  root.innerHTML = header(G, p) +
    card("", kv([["Taktik tim", `${esc(club.formation || "4-3-3")} · ${esc(club.style || "Seimbang")}`], ["Posisi (peran)", `${p.main} (${esc(role?.name || "-")})`], ["Efektivitas keseluruhan", `${meter(overall, 10, col(overall))}`]]) + `<p class="muted" style="font-size:12.5px;margin-top:8px">Efektivitas taktik menggambarkan seberapa baik kamu memahami dan mampu menjalankan instruksi pelatih di hari pertandingan.</p>`) +
    box("Pemahaman Taktik", und, "Kemampuan memahami apa yang diminta secara taktis di level tim.", [["Kemampuan taktik pemain", h((g("dec") + g("ant")) / 2 - 2)], ["Kerja sama & penempatan", h((g("tea") + g("pos")) / 2 - 2)], ["Waktu di klub", clamp(Math.round(tenureDays / 120), 1, 5)]], und >= 7 ? `${esc(shortName(p))} punya pemahaman taktik yang tajam.` : "Perlu lebih banyak waktu latihan taktik bersama tim.") +
    box("Kemampuan Pemain", Math.round((abil + fam) / 2), "Kombinasi kemampuan pemain dan kecocokannya dengan peran yang diminta.", [["Kemampuan untuk peran", h(abil)], ["Kecocokan posisi", h(fam)]], abil >= 7 ? `Sangat cocok untuk peran ${esc(role?.name || "")}.` : `Latih atribut kunci peran ${esc(role?.name || "")} di Latihan Individu.`) +
    box("Dukungan Pemain", supp, "Kemauan, bukan kemampuan, untuk menjalankan taktik pelatih.", [["Suasana hati", h((p.morale ?? 65) / 10)], ["Hubungan dengan pelatih", own ? h(5 + ((avg(tr.slice(-6)) ?? 6.6) - 6.6) * 8) : 3], ["Hubungan dengan rekan setim", own ? h(5 + Object.values(G.user.rel || {}).reduce((s, x) => s + x, 0) / 20) : 3]], supp >= 7 ? "Memberi pengaruh positif pada tim." : "Bangun hubungan dengan pelatih dan rekan setim lewat menu Tindakan.") +
    box("Info Laga Berikutnya", info, nm ? `Lawan berikutnya: ${esc(G.clubs[nm[1].opp]?.name || "")} (${shortDay(nm[0])}).` : "Belum ada laga terjadwal.", [["Laporan lawan", oppKnown ? 4 : 2], ["Pengetahuan tentang pemain lawan", oppKnown ? 3 : 1]], oppKnown ? "Lawan dari liga yang sama, staf sudah punya laporan." : "Kita perlu menambah pengetahuan tentang lawan ini.");
});

// ============ PERFORMA sub-views ============
export const PERF_VIEWS = [["statistik", "Statistik"], ["kondisi", "Kondisi"], ["jam", "Jam Terbang"], ["rating", "Rating Laga"], ["laporan", "Laporan"]];
export function perfView(G, p, v, prm) {
  if (v === "kondisi") return perfKondisi(G, p);
  if (v === "jam") return perfJam(G, p);
  if (v === "rating") return perfRating(G, p, prm);
  if (v === "laporan") return perfLaporan(G, p);
  return "";
}
function perfKondisi(G, p) {
  const own = p.isUser;
  const log = own ? (G.user.matchLog || []).filter(m => G.date - m.date <= 14) : [];
  const mins = log.reduce((s, m) => s + m.min, 0);
  const load = mins >= 250 ? ["Berat", 4] : mins >= 150 ? ["Sedang", 3] : mins >= 60 ? ["Ringan", 2] : ["Sangat ringan", 1];
  const inten = own ? G.user.training.intensity : "Normal";
  const tload = { Rendah: ["Ringan", 3], Normal: ["Sedang", 5], Tinggi: ["Berat", 7] }[inten];
  const risk = p.cond < 70 || inten === "Tinggi" ? ["Tinggi", 3] : p.cond < 85 || mins >= 250 ? ["Sedang", 2] : ["Minimal", 1];
  const sharp = p.sharp ?? 60;
  const inj = own ? G.user.injuries || [] : [];
  const daysOut = inj.reduce((s, i) => s + (i.days || 0), 0), since = own ? Math.max(1, G.date - G.user.startDate) : 1;
  const tile = (t, big, sub, extra = "") => `<div class="bcard"><div class="ch">${t}</div><div class="big">${big}</div>${extra}<div class="muted" style="font-size:12.5px">${sub}</div></div>`;
  return card("", `<div class="row" style="gap:10px"><span style="font-size:30px;color:${p.injury ? "var(--bad)" : "var(--good)"}">${p.injury ? "✚" : "♥"}</span><div><b style="font-size:17px">${p.injury ? `Cedera: ${esc(p.injury.name)}` : `${fitnessWord(p.cond)} · kondisi keseluruhan`}</b><div class="muted" style="font-size:13px">${p.injury ? `Absen sekitar ${weeksLabel(p.injury.days)}` : sharp < 60 ? "Butuh ketajaman pertandingan" : "Siap bertanding"}</div></div></div>`) +
    `<div class="bcards">${tile("Ketajaman Bertanding", sharp >= 80 ? "Tajam" : sharp >= 60 ? "Menambah ketajaman" : "Kurang tajam", `${Math.round(sharp)}%`)}
      ${tile("Beban Pertandingan", load[0], `${log.length} laga (${mins} menit) dalam 14 hari terakhir`, meter(load[1], 4, "g"))}
      ${tile("Kerentanan Cedera", p.hid.inj >= 15 ? "Rawan" : p.hid.inj >= 9 ? "Rata-rata" : "Jarang cedera", "Bawaan fisik pemain", meter(Math.round(p.hid.inj / 20 * 7), 7, p.hid.inj >= 15 ? "r" : "g"))}
      ${tile("Energi", fitnessWord(p.cond), `Kondisi ${Math.round(p.cond)}%`)}
      ${tile("Beban Latihan", tload[0], own ? `Intensitas ${inten.toLowerCase()}` : "Latihan tim", meter(tload[1], 8, "y"))}
      ${tile("Risiko Cedera", risk[0], "Berdasarkan kondisi dan beban saat ini", meter(risk[1], 3, risk[1] >= 3 ? "r" : "g"))}</div>` +
    (own ? card("Riwayat Cedera", `<div class="row" style="gap:10px;margin-bottom:8px"><b style="font-size:20px">${(daysOut / since * 100).toFixed(1).replace(".", ",")}% absen</b><span class="muted">${daysOut} hari total</span></div>${inj.slice().reverse().slice(0, 8).map(i => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${shortDay(i.date)} · ${esc(i.name)}</span><span class="tag">${weeksLabel(i.days)}</span></div>`).join("") || '<div class="muted">Belum pernah cedera.</div>'}`) : "");
}
function perfJam(G, p) {
  const own = p.isUser;
  const cur = own ? (p.squad === "Y" ? "Pemain Akademi" : squadStatus(G)) : squadStatus(G, p);
  const agreed = own ? G.user.promise?.role || null : null;
  const share = own ? playShare(G) : null;
  const expect = agreed || cur;
  const dots = n => `<div class="row" style="gap:4px;margin-top:6px">${Array.from({ length: 9 }, (_, i) => `<i style="width:14px;height:14px;border-radius:50%;border:2px dashed #7b5bd6;${i < n ? "background:#7b5bd6" : ""}"></i>`).join("")}</div>`;
  const effective = share == null ? cur : ROLE_PT.slice().sort((a, b) => Math.abs(a[1] - share) - Math.abs(b[1] - share))[0][0];
  const mood = !agreed || share == null ? "Saat ini tidak punya pendapat kuat soal jam terbang bermainnya." : share >= roleShare(agreed) - 0.08 ? "Puas dengan jam terbang bermainnya." : "Merasa jam terbangnya di bawah yang dijanjikan.";
  return `<div class="card"><div class="ch">Status Menit Bermain</div>${ROLE_PT.map(([r]) => `<div class="row" style="gap:8px;padding:5px 0;font-size:14px;${r === effective ? "color:#c9b6ff;font-weight:700" : ""}"><span style="width:16px;height:16px;border-radius:50%;border:2px dashed #7b5bd6;${r === effective ? "background:#7b5bd6" : r === agreed ? "outline:2px solid #ffd54a" : ""}"></span>${esc(r)}${r === agreed ? ' <span class="muted" style="font-size:12px">(disepakati)</span>' : ""}</div>`).join("")}<div class="muted" style="font-size:12px;margin-top:6px">● ungu = saat ini · bingkai kuning = disepakati di kontrak</div></div>` +
    card("Jalur Waktu Bermain", kv([["Waktu efektif bermain", `<b style="color:#c9b6ff">${esc(effective)}</b>`], ["Status di skuad", esc(cur)], ["Waktu bermain yang disepakati", agreed ? esc(agreed) : "Tidak ada"], ["Ekspektasi (5 laga berikutnya)", esc(expect)]]) + (share != null ? `<div class="muted" style="font-size:13px;margin-top:8px">Menit dari 8 laga terakhir: ${Math.round(share * 100)}%</div>${dots(Math.round(share * 9))}` : "") + `<p style="font-size:14px;margin:10px 0 0">${esc(mood)}</p>`) +
    (own ? card("Janji", G.user.promise ? `<div style="font-size:14px">Peran ${esc(G.user.promise.role)} (dicek tiap bulan)${G.user.promise.misses ? ` · <span style="color:var(--bad)">${G.user.promise.misses}× belum ditepati</span>` : ""}</div>` : '<div class="muted">Tidak ada rencana untuk masa depan. Janji jam terbang dibuat saat negosiasi kontrak.</div>') : "");
}
function perfRating(G, p, prm) {
  if (!p.isUser) return card("Rating Pertandingan", `<div class="muted">Riwayat laga lengkap hanya dicatat untuk kariermu sendiri.</div>`);
  const all = G.user.matchLog || [];
  const comps = [...new Set(all.map(m => m.comp))];
  const sel = prm.rc || "";
  const log = sel ? all.filter(m => m.comp === sel) : all;
  const rs = log.map(m => m.rating);
  const W = 320, H = 110, n = Math.min(20, log.length), pts = log.slice(0, n).reverse();
  const chart = n ? `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating per laga">${[6, 7, 8].map(v => `<line x1="18" x2="${W}" y1="${H - 14 - (v - 5) * 18}" y2="${H - 14 - (v - 5) * 18}" stroke="rgba(255,255,255,.08)"/><text x="2" y="${H - 10 - (v - 5) * 18}" font-size="9" fill="#888">${v}</text>`).join("")}${pts.map((m, i) => { const bw = (W - 24) / n, h = Math.max(2, (m.rating - 5) * 18); return `<rect x="${20 + i * bw + 1}" y="${H - 14 - h}" width="${bw - 3}" height="${h}" fill="${m.rating >= 7.5 ? "#8fd14f" : m.rating >= 6.8 ? "#b5b33a" : "#c9703c"}"/>`; }).join("")}</svg>` : '<div class="muted">Belum ada laga.</div>';
  return `<div class="card"><div class="spread" style="margin-bottom:8px"><div class="ch" style="margin:0">Rating Pertandingan</div><select id="rc" style="max-width:55%"><option value="">Semua kompetisi</option>${comps.map(c => `<option ${sel === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></div>
    <div class="grid3" style="text-align:center;margin-bottom:8px"><div><div class="lbl">Penampilan</div><b>${log.length}</b></div><div><div class="lbl">Rating maks.</div>${pill1(rs.length ? Math.max(...rs) : null)}</div><div><div class="lbl">Rating min.</div>${pill1(rs.length ? Math.min(...rs) : null)}</div><div><div class="lbl">Rata-rata</div>${pill(avg(rs))}</div><div><div class="lbl">Gol</div><b>${log.reduce((s, m) => s + (m.gls || 0), 0)}</b></div><div><div class="lbl">Assist</div><b>${log.reduce((s, m) => s + (m.ast || 0), 0)}</b></div></div>${chart}</div>` +
    card("Pertandingan", log.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>Tanggal</th><th>Pertandingan</th><th class="c">Skor</th><th class="n">Mnt</th><th class="n">G</th><th class="n">A</th><th>Nilai</th></tr></thead><tbody>${log.map((m, i) => `<tr><td>${i + 1}</td><td>${shortDay(m.date)}</td><td>${esc(m.opp)} <span class="muted">(${m.ha})</span><div class="muted" style="font-size:11.5px">${esc(m.comp)}</div></td><td class="c"><span style="color:${m.score[0] > m.score[1] ? "var(--good)" : m.score[0] < m.score[1] ? "var(--bad)" : "inherit"}">●</span> ${m.score[0]}-${m.score[1]}</td><td class="n">${m.min}</td><td class="n">${m.gls || ""}</td><td class="n">${m.ast || ""}</td><td>${pill1(m.rating)}${m.pom ? " ★" : ""}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Belum ada laga.</div>');
}
// strengths and weaknesses, written like a coach's scouting report
const ATTR_PRO = { fin: "Penyelesaian akhir yang tajam", dri: "Menggiring bola dengan sangat baik", pas: "Umpan-umpannya akurat", vis: "Visi bermain di atas rata-rata", tck: "Tekel yang bersih dan tegas", mar: "Disiplin menjaga lawan", hea: "Kuat dalam duel udara", pac: "Sangat cepat", acc: "Akselerasi yang eksplosif", sta: "Stamina luar biasa", str: "Kuat secara fisik", cmp: "Tenang di bawah tekanan", dec: "Pengambilan keputusan yang baik", ant: "Membaca permainan dengan baik", pos: "Penempatan posisi yang cerdas", otb: "Pergerakan tanpa bola yang cerdik", cro: "Umpan silang berbahaya", tec: "Teknik yang halus", fir: "Kontrol pertama yang rapi", wor: "Etos kerja tinggi", ref: "Kemampuan menghentikan tembakan dengan refleksnya", han: "Tangkapan yang aman", kic: "Distribusi bola yang baik", ovo: "Unggul dalam situasi satu lawan satu", lon: "Tembakan jarak jauh berbahaya", fla: "Kreatif dan tak terduga", det: "Determinasi tinggi", ldr: "Pemimpin di lapangan" };
const ATTR_CON = { fin: "penyelesaian akhirnya", dri: "kemampuan menggiring bolanya", pas: "akurasi umpannya", tck: "tekelnya", mar: "kemampuan menjaga lawan", hea: "sundulannya", pac: "kecepatannya", acc: "akselerasinya", sta: "staminanya", str: "kekuatan fisiknya", cmp: "ketenangannya", dec: "pengambilan keputusannya", pos: "penempatan posisinya", fir: "kontrol pertamanya", kic: "distribusinya", han: "kemampuan menangkap bolanya", ref: "refleksnya", cro: "umpan silangnya", tec: "tekniknya", ant: "antisipasinya" };
export function scoutReport(G, p) {
  const w = WEIGHTS[p.main];
  const idx = ATTRS.map((a, i) => i).filter(i => w[i] >= 1.5);
  const sorted = idx.slice().sort((a, b) => p.a[b] - p.a[a]);
  const club = G.clubs[p.club], L = club && G.leagues[club.league];
  const levels = L ? Object.values(G.clubs).filter(c => c.league === L.id).map(c => c.level) : [100];
  const lvAvg = avg(levels), lvMax = Math.max(...levels), age = ageOn(p.birth, G.date);
  const pros = [], cons = [];
  const lname = L?.name || "liga ini";
  if (p.ca >= lvMax) pros.push(`Pemain bintang untuk sebagian besar tim ${lname}.`); else if (p.ca >= lvAvg) pros.push(`Pemain bagus untuk sebagian besar tim ${lname}.`);
  for (const i of sorted.slice(0, 5)) if (p.a[i] >= 13 && ATTR_PRO[ATTRS[i][0]]) pros.push(`${ATTR_PRO[ATTRS[i][0]]}.`);
  if (p.hid.pro >= 15) pros.push("Menangani dirinya dengan sangat profesional."); else if (p.hid.pro >= 12) pros.push("Menangani dirinya dengan cukup profesional.");
  if (p.hid.pre >= 15) pros.push("Menikmati laga-laga besar.");
  if (p.hid.con >= 15) pros.push("Performa sangat konsisten."); else if (p.hid.con <= 6) cons.push("Performanya naik-turun.");
  if (p.isUser) { const tr = avg((G.user.trainRatings || []).slice(-4)); if (tr && tr >= 7) pros.push("Belakangan ini tampil oke dalam latihan."); }
  if (p.ca < lvAvg - 12) cons.push(`Belum cukup baik untuk tim inti di ${lname}.`);
  if (age >= 29 && p.pa - p.ca < 5) cons.push("Tidak mungkin meningkat di masa depan.");
  for (const i of sorted.slice(-4).reverse()) if (p.a[i] <= 10 && ATTR_CON[ATTRS[i][0]]) cons.push(`Perlu diberi program latihan individu untuk meningkatkan ${ATTR_CON[ATTRS[i][0]]}.`);
  if (p.isUser && G.user.adapt) cons.push(`Masih kesulitan beradaptasi (belajar bahasa ${G.user.adapt.lang}).`);
  if (p.hid.inj >= 15) cons.push("Rawan cedera.");
  if (p.a[A.agg] >= 16 && p.a[A.tck] < 12) cons.push("Cenderung ceroboh dalam duel, rawan kartu.");
  const rep = coachReport(G, p);
  const verdict = p.ca >= lvMax ? ["A+", "Pemain penting yang sedang di masa puncaknya"] : p.ca >= lvAvg + 8 ? ["A", "Pemain penting untuk tim"] : p.ca >= lvAvg ? ["B", "Pemain rotasi yang andal"] : p.pa - p.ca > 25 && age <= 21 ? ["B+", "Prospek dengan potensi besar"] : ["C+", "Pemain pinggiran"];
  return { pros: pros.slice(0, 7), cons: cons.slice(0, 5), verdict, rep };
}
function perfLaporan(G, p) {
  const R = scoutReport(G, p), club = G.clubs[p.club];
  const grp = posGroup(p.main);
  const mates = club ? [...club.squad, ...club.youthSquad].map(id => G.players[id]).filter(q => q && posGroup(q.main) === grp).sort((a, b) => b.ca - a.ca).slice(0, 10) : [];
  const staff = club ? staffOf(G, club.id).find(s => s.role === "Asisten Manajer") : null;
  return `<div class="card"><div class="muted" style="font-size:12.5px">Dilaporkan oleh</div><b>${esc(staff?.name || "Staf pelatih")}</b> <span class="muted">Asisten Manajer</span>
      <div style="margin-top:10px;background:rgba(197,216,74,.1);border:1px solid rgba(197,216,74,.35);border-radius:8px;padding:10px"><b>Rekomendasi</b><div style="margin-top:4px"><span class="tag" style="border-color:#c5d84a;color:#c5d84a">${R.verdict[0]}</span> ${esc(R.verdict[1])}</div></div>
      <div class="grid2" style="margin-top:10px"><div><div class="lbl">Kemampuan saat ini</div>${stars(R.rep.ca)}</div><div><div class="lbl">Potensi</div>${stars(R.rep.pa)}</div></div></div>` +
    card(`<span style="color:var(--good)">👍 Kelebihan (${R.pros.length})</span>`, R.pros.map(t => `<div style="padding:5px 0;border-top:1px solid var(--line);font-size:14px">★ ${esc(t)}</div>`).join("") || '<div class="muted">-</div>') +
    card(`<span style="color:var(--bad)">👎 Kekurangan (${R.cons.length})</span>`, R.cons.map(t => `<div style="padding:5px 0;border-top:1px solid var(--line);font-size:14px">✚ ${esc(t)}</div>`).join("") || '<div class="muted">Tidak ada kekurangan mencolok.</div>') +
    card(`Perbandingan Skuad · ${{ GK: "Kiper", DEF: "Bek", MID: "Gelandang", ATT: "Penyerang" }[grp]}`, `<table class="tbl"><thead><tr><th>#</th><th>Nama</th><th>Kemampuan</th><th>Potensi</th></tr></thead><tbody>${mates.map((q, i) => { const r = coachReport(G, q); return `<tr class="click ${q.id === p.id ? "me" : ""}" data-pid="${q.id}"><td>${i + 1}</td><td>${esc(fullName(q))}</td><td>${stars(r.ca)}</td><td>${stars(r.pa)}</td></tr>`; }).join("")}</tbody></table>`);
}

// ============ KARIER: timeline ============
export function careerTimeline(G, f) {
  const u = G.user, p = userP(G);
  const ev = [];
  const y = d => ymd(d).y;
  ev.push({ d: u.startDate, kind: "landmark", icon: "🏁", text: `Bergabung dengan akademi ${G.clubs[(u.moves || [])[0]?.from || p.club]?.name || ""}`, club: (u.moves || [])[0]?.from || p.club });
  if (u.debutClub) ev.push({ d: u.debutClub.date, kind: "landmark", icon: "⭐", text: `Debut senior untuk ${G.clubs[u.debutClub.club]?.name || ""}`, club: u.debutClub.club });
  if (u.debut) ev.push({ d: u.debut.date, kind: "landmark", icon: "🏳", text: `Debut timnas melawan ${NATIONS[u.debut.opp]?.name || ""}`, nat: fed(G) });
  for (const m of u.moves || []) ev.push({ d: m.date, kind: "transfer", icon: "🔁", text: `${m.type === "loan" ? "Dipinjamkan ke" : "Pindah ke"} ${G.clubs[m.to]?.name || ""}${m.type !== "loan" ? ` (${m.fee ? moneyM(m.fee) : "gratis"})` : ""}`, club: m.to });
  const seasonEnd = s => { const m = /^(\d{4})/.exec(String(s)); return m ? day(+m[1] + (String(s).includes("/") ? 1 : 0), 6, 1) : G.date; };
  for (const t of u.trophies || []) ev.push({ d: seasonEnd(t.year), kind: "kompetisi", icon: "🏆", text: `Juara ${t.name}`, clubName: t.club, star: true });
  for (const a of u.awards || []) ev.push({ d: seasonEnd(a.year), kind: "penghargaan", icon: "🎖", text: `${a.name}${a.detail ? ` (${a.detail})` : ""}`, star: true });
  for (const h of u.history || []) if (h.pos && h.pos <= 3) ev.push({ d: seasonEnd(h.season), kind: "kompetisi", icon: "🏆", text: `Finis ke-${h.pos} di ${h.league}`, club: h.club });
  // milestones from the season history
  let apps = 0, gls = 0; const MS = [1, 50, 100, 150, 200, 300, 400, 500];
  for (const h of u.history || []) { const a0 = apps, g0 = gls; apps += h.apps + h.sub; gls += h.gls; for (const m of MS) { if (a0 < m && apps >= m && m > 1) ev.push({ d: seasonEnd(h.season), kind: "landmark", icon: "🚩", text: `Mencapai ${m} penampilan liga`, club: h.club }); if (g0 < m && gls >= m) ev.push({ d: seasonEnd(h.season), kind: "landmark", icon: "⚽", text: m === 1 ? "Gol liga pertama" : `Mencapai ${m} gol liga`, club: h.club, star: m >= 50 }); } }
  const keep = f === "semua" ? () => true : f === "menonjol" ? e => e.star || e.kind === "transfer" || e.icon === "⭐" : e => e.kind === f;
  return ev.filter(keep).sort((a, b) => b.d - a.d);
}

// ============ PERBANDINGAN (full) ============
const RADAR = p => p.main === "GK"
  ? [["Refleks", ["ref", "ovo", "agi"]], ["Fisik", ["str", "jum", "bal", "sta"]], ["Kecepatan", ["acc", "pac"]], ["Mental", ["cmp", "cnt", "dec", "pos"]], ["Komunikasi", ["com", "cmd"]], ["Eksentrisitas", ["ecc"]], ["Udara", ["aer", "jum"]], ["Distribusi", ["kic", "thr", "pas"]]]
  : [["Penyerangan", ["fin", "otb", "cmp"]], ["Teknik", ["tec", "fir", "dri"]], ["Kreativitas", ["vis", "pas", "fla"]], ["Kecepatan", ["acc", "pac", "agi"]], ["Fisik", ["str", "sta", "bal", "jum"]], ["Mental", ["dec", "ant", "det", "wor"]], ["Udara", ["hea", "jum"]], ["Bertahan", ["tck", "mar", "pos"]]];
function radarSvg(p, q) {
  const axes = RADAR(p), n = axes.length, W = 300, c = 150, R = 105;
  const val = (pl, ks) => ks.reduce((s, k) => s + pl.a[A[k]], 0) / ks.length;
  const pt = (i, v) => { const ang = -Math.PI / 2 + (i / n) * Math.PI * 2, r = (v / 20) * R; return [c + Math.cos(ang) * r, c + Math.sin(ang) * r]; };
  const poly = pl => axes.map(([, ks], i) => pt(i, val(pl, ks)).join(",")).join(" ");
  const ring = k => axes.map((_, i) => pt(i, k).join(",")).join(" ");
  return `<svg viewBox="0 0 ${W} ${W}" class="chart" role="img" aria-label="Radar atribut">${[5, 10, 15, 20].map(k => `<polygon points="${ring(k)}" fill="none" stroke="rgba(255,255,255,.12)"/>`).join("")}
    <polygon points="${poly(q)}" fill="rgba(232,135,58,.25)" stroke="#e8873a" stroke-width="2"/><polygon points="${poly(p)}" fill="rgba(77,208,199,.25)" stroke="#4dd0c7" stroke-width="2"/>
    ${axes.map(([l, ks], i) => { const [x, y] = pt(i, 24.5); return `<text x="${x}" y="${y}" font-size="10.5" fill="#ddd" text-anchor="middle">${l}</text><text x="${x}" y="${y + 12}" font-size="10" text-anchor="middle"><tspan fill="#4dd0c7">${Math.round(val(p, ks))}</tspan> <tspan fill="#e8873a">${Math.round(val(q, ks))}</tspan></text>`; }).join("")}</svg>`;
}
register("pemain", "bandingkan", (G, root, prm) => {
  const u = userP(G);
  const club = userClub(G);
  const pool = [...club.squad, ...club.youthSquad].map(id => G.players[id]).filter(q => q && q.id !== u.id).sort((a, b) => (b.main === u.main) - (a.main === u.main) || b.ca - a.ca);
  const left = G.players[prm.lid] || u;
  const right = G.players[prm.pid] && prm.pid !== left.id ? G.players[prm.pid] : pool.find(q => q.id !== left.id);
  const v = prm.bv || "ringkasan";
  const opts = [...new Map([u, left, right, ...pool].map(q => [q.id, q])).values()];
  const sel = (id, cur) => `<select id="${id}" style="max-width:100%">${opts.map(q => `<option value="${q.id}" ${q.id === cur.id ? "selected" : ""}>${esc(shortName(q))} · ${q.main}</option>`).join("")}</select>`;
  const head = side => { const q = side ? right : left, c = G.clubs[q.club], val = marketValue(q, G.date, c?.league) * 1e6; return `<div style="text-align:${side ? "right" : "left"}">${avatar(lookFor(q), c?.colors || ["#333", "#fff"], 44, ageOn(q.birth, G.date))}<div style="margin:4px 0">${sel(side ? "cr" : "cl", q)}</div><div class="muted" style="font-size:12.5px">${natTag(q.nat)} · ${ageOn(q.birth, G.date)} th · ${esc(c?.short || "")}</div><div style="font-size:12.5px">${moneyShort(val * 0.8)}–${moneyShort(val * 1.2)}</div><div style="font-size:12.5px">${q.contract?.youth ? "Akademi" : `${moneyShort(q.contract?.wage || 0)} p/mgg`}</div><div style="font-size:12.5px;color:#c9b6ff">${esc(q.isUser ? squadStatus(G) : squadStatus(G, q))}</div></div>`; };
  let body = "";
  if (v === "ringkasan") {
    const st = q => (q.isUser ? G.user.cs.liga : q.st);
    const line = q => { const s = st(q); return `<div class="muted" style="font-size:12.5px">Main ${s.apps}${s.sub ? `(${s.sub})` : ""} · Gol ${s.gls} · Ast ${s.ast} · Rata2 ${s.rn ? (s.rsum / s.rn).toFixed(2).replace(".", ",") : "-"}</div>`; };
    body = card("", `<div class="grid2"><div><div class="lbl">Laporan pelatih</div>${stars(coachReport(G, left).ca)}<div style="font-size:12.5px">${scoutReport(G, left).pros.length} pro / ${scoutReport(G, left).cons.length} kontra</div>${line(left)}</div><div style="text-align:right"><div class="lbl">Laporan pelatih</div>${stars(coachReport(G, right).ca)}<div style="font-size:12.5px">${scoutReport(G, right).pros.length} pro / ${scoutReport(G, right).cons.length} kontra</div>${line(right)}</div></div>`) +
      card("Atribut", `${radarSvg(left, right)}<div class="spread" style="font-size:13px"><span>Kaki: <b style="color:#4dd0c7">${left.foot}</b> · ${left.height} cm</span><span><b style="color:#e8873a">${right.foot}</b> · ${right.height} cm</span></div>`);
  } else if (v === "atribut") {
    const groups = left.main === "GK" || right.main === "GK" ? ["K", "M", "F"] : ["T", "M", "F"];
    const L = { T: "Teknik", M: "Mental", F: "Fisik", K: "Kiper" };
    body = groups.map(g => card(L[g], ATTRS.map((a, i) => [a, i]).filter(([a]) => a[2] === g).map(([a, i]) => { const x = Math.round(left.a[i]), y = Math.round(right.a[i]), d = x - y; return `<div style="display:grid;grid-template-columns:30px 1fr 30px;gap:8px;align-items:center;padding:3px 0;font-size:13.5px"><b class="${attrClass(x)}" style="text-align:center">${x}</b><div><div style="text-align:center">${esc(a[1])}</div><div style="position:relative;height:6px;background:rgba(255,255,255,.08);border-radius:3px"><i style="position:absolute;top:0;height:6px;border-radius:3px;${d >= 0 ? `right:50%;width:${Math.abs(d) * 5}%;background:#4dd0c7` : `left:50%;width:${Math.abs(d) * 5}%;background:#e8873a`}"></i></div></div><b class="${attrClass(y)}" style="text-align:center">${y}</b></div>`; }).join(""))).join("") +
      card("", `<div class="spread" style="font-size:14px"><span>Rerata: <b>${(avg(left.a.slice(0, 36)) || 0).toFixed(1)}</b></span><span>Tinggi ${left.height} – ${right.height} cm</span><span><b>${(avg(right.a.slice(0, 36)) || 0).toFixed(1)}</b></span></div>`);
  } else if (v === "statistik") {
    const st = q => (q.isUser ? G.user.cs.liga : q.st);
    const a = st(left), b = st(right);
    const r = (l, x, y, f = z => z) => `<div style="display:grid;grid-template-columns:1fr 2fr 1fr;padding:6px 0;border-top:1px solid var(--line);font-size:14px"><b>${f(x)}</b><span style="text-align:center">${l}</span><b style="text-align:right">${f(y)}</b></div>`;
    const per90 = (s, k) => (s.min ? (s[k] / s.min * 90).toFixed(2).replace(".", ",") : "-");
    body = card("Statistik liga musim ini", r("Total penampilan", a.apps + a.sub, b.apps + b.sub) + r("Gol", a.gls, b.gls) + r("Assist", a.ast, b.ast) + r("Kartu kuning", a.yc, b.yc) + r("Kartu merah", a.rc, b.rc) + r("Pemain terbaik", a.pom || 0, b.pom || 0) + r("Gol per 90 menit", per90(a, "gls"), per90(b, "gls")) + r("Assist per 90 menit", per90(a, "ast"), per90(b, "ast")) + r("Nilai rata-rata", a.rn ? (a.rsum / a.rn).toFixed(2) : "-", b.rn ? (b.rsum / b.rn).toFixed(2) : "-"));
  } else if (v === "posisi") {
    const col = q => { const roles = ROLES[q.main] || []; return `<div><b>${esc(POS_LABEL[q.main])}</b><div style="color:${famWord(q.positions?.[q.main] || 20)[2]};font-size:13px">● ${famWord(q.positions?.[q.main] || 20)[1]}</div>${roles.slice().sort((x, y) => roleStars(q, y) - roleStars(q, x)).map(r => `<div style="padding:4px 0;border-top:1px solid var(--line);font-size:13px">${stars(roleStars(q, r))} ${esc(r.name)}</div>`).join("")}<div class="muted" style="font-size:12.5px;margin-top:6px">Posisi lain: ${Object.entries(q.positions || {}).filter(([k, x]) => k !== q.main && x >= 12).map(([k]) => k).join(", ") || "-"}</div></div>`; };
    body = card("Posisi & Peran", `<div class="grid2">${col(left)}${col(right)}</div>`);
  } else {
    const rep = q => { const R = scoutReport(G, q); return `<div><span class="tag" style="border-color:#c5d84a;color:#c5d84a">${R.verdict[0]}</span> <span style="font-size:13px">${esc(R.verdict[1])}</span><div class="lbl" style="color:var(--good);margin-top:8px">Kelebihan</div>${R.pros.map(t => `<div style="font-size:13px;padding:3px 0">★ ${esc(t)}</div>`).join("")}<div class="lbl" style="color:var(--bad);margin-top:8px">Kekurangan</div>${R.cons.map(t => `<div style="font-size:13px;padding:3px 0">✚ ${esc(t)}</div>`).join("") || '<div class="muted" style="font-size:13px">-</div>'}</div>`; };
    body = card("Laporan", `<div class="grid2" style="align-items:start">${rep(left)}${rep(right)}</div>`);
  }
  root.innerHTML = `<div class="card"><div class="grid2" style="align-items:start">${head(0)}${head(1)}</div></div>${seg("bv", v, [["ringkasan", "Ringkasan"], ["atribut", "Atribut"], ["statistik", "Statistik"], ["posisi", "Posisi & Peran"], ["laporan", "Laporan"]])}${body}`;
  $("#cl", root).onchange = e => go("pemain", "bandingkan", { ...prm, lid: +e.target.value }, true);
  $("#cr", root).onchange = e => go("pemain", "bandingkan", { ...prm, pid: +e.target.value }, true);
  $$("[data-bv]", root).forEach(b => (b.onclick = () => go("pemain", "bandingkan", { ...prm, bv: b.dataset.bv }, true)));
});
