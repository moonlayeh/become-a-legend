// Portal: Ringkasan, Pesan, Kalender, Berita, Kompetisi
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, flagEmoji, compBadge, avatar, lookFor, silhouette, heading, toast, shortDay, moneyShort, bars } from "./core.js";
import { NATIONS, LEAGUES } from "../data.js";
import { fmt, fmtDay, ymd, HARI, BULAN, BULAN_PANJANG, day, seasonLabel, ageOn } from "../calendar.js";
import { userP, userClub, table } from "../world.js";
import { fullName, shortName } from "../player.js";
import { squadStatus, resolveDecision, coachReport, fed } from "../career.js";
import { rngOf } from "../sim.js";
import { mailMeta, CAT_COLOR, clubMatchDays, sessionsFor, SESS, SESS_COLOR, calendarEvents, fitnessWord, moraleWord, moraleFace, facilities, clubReputation, REP_COLOR, staffOf, predictedFinish } from "../meta.js";

const avgR = st => (st.rn ? st.rsum / st.rn : null);
const wd3 = n => HARI[ymd(n).wd].slice(0, 3);

// ---------- shared bits ----------
export function miniTable(G, lid, opts = {}) {
  const L = G.leagues[lid]; const tb = table(G, lid); const u = userP(G);
  let rows = tb.map((r, i) => [r, i]);
  if (opts.around) { const me = tb.findIndex(r => r.id === u.club); const a = Math.max(0, Math.min(tb.length - opts.around, me - Math.floor(opts.around / 2))); rows = rows.slice(a, a + opts.around); }
  else if (opts.top) rows = rows.slice(0, opts.top);
  const zone = i => (i < (lid === "IDN1" ? 1 : 4) ? "zt" : i < (lid === "IDN1" ? 2 : 6) ? "ze" : i >= tb.length - L.relegate ? "zr" : "");
  return `<table class="tbl"><thead><tr><th>Pos</th><th>Tim</th><th class="n">Main</th>${opts.full ? '<th class="n">M</th><th class="n">S</th><th class="n">K</th>' : ""}<th class="n">SG</th><th class="n">Pts</th></tr></thead><tbody>
    ${rows.map(([r, i]) => `<tr class="${r.id === u.club ? "me" : ""} click" data-club="${r.id}"><td class="${zone(i)}">${i + 1}</td><td><span class="row" style="gap:6px">${crest(G.clubs[r.id], 18)}<span>${esc(opts.full ? G.clubs[r.id].name : G.clubs[r.id].short.length > 4 ? G.clubs[r.id].short : shortClub(G.clubs[r.id]))}</span></span></td><td class="n">${r.p}</td>${opts.full ? `<td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td>` : ""}<td class="n">${r.gf - r.ga}</td><td class="n"><b>${r.pts}</b></td></tr>`).join("")}
  </tbody></table><div class="legend"><span><i style="background:var(--blue)"></i>${lid === "IDN1" ? "Juara" : "UCL"}</span><span><i style="background:#c9a227"></i>${lid === "IDN1" ? "Asia" : "UEL"}</span><span><i style="background:var(--bad)"></i>Degr.</span></div>`;
}
export const shortClub = c => c.name.replace(/^(FC|AC|AS|RC|CA|SC|RCD|UD|CF|AJ|OGC|LOSC|SV|VfL|VfB|TSG|1\. FC|1\. FSV|RB|SS|US|Real|Stade|Olympique|Borussia)\s/, "").replace(/ (FC|CF|United|City|Hotspur|Calcio)$/, m => (m === " United" ? " Utd" : m === " City" ? " City" : "")).slice(0, 16);

function newsArt(G, n, size = 60) {
  const c = n.club && G.clubs[n.club];
  if (c) return crest(c, size);
  if (n.league && G.leagues[n.league]) return compBadge(G.leagues[n.league], size);
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>`;
}
export function newsCard(G, n) {
  return `<a class="ncard click" data-go="portal/berita" data-p='${JSON.stringify({ news: n.id })}'><div class="art"><div class="big">${newsArt(G, n, 74)}</div></div><div class="bd"><h4>${esc(n.title)}</h4>${n.body ? `<p>${esc(n.body)}</p>` : ""}<div class="meta"><span>${fmt(n.date)}</span><i>|</i><span>${esc(n.tag || "Berita")}</span>${n.club && G.clubs[n.club] ? `<i>|</i><span>${esc(G.clubs[n.club].short)}</span>` : ""}</div></div></a>`;
}
export function newsRow(G, n) {
  return `<div class="nrow click" data-go="portal/berita" data-p='${JSON.stringify({ news: n.id })}'><div class="th">${newsArt(G, n, 40)}</div><div style="min-width:0"><b>${esc(n.title)}</b><div class="meta" style="margin-top:4px"><span>${fmt(n.date)}</span><i>|</i><span>${esc(n.tag || "Berita")}</span></div></div></div>`;
}
function msgItem(G, m, cur) {
  const mm = mailMeta(G, m);
  const col = CAT_COLOR[mm.cat] || "#666";
  return `<div class="msg click ${m.read ? "read" : "unread"} ${m.kind === "decision" && !m.done ? "dec" : ""} ${cur ? "cur" : ""}" data-mail="${m.id}">
    <div class="from"><span>${esc(mm.from)}</span><span class="tag" style="border-color:${col};color:#fff;background:${col}55">${esc(mm.cat)}</span></div>
    <div class="ti">${esc(m.title)}<span>${mm.time}</span></div></div>`;
}

// ---------- RINGKASAN ----------
register("portal", "ringkasan", (G, root) => {
  const u = userP(G), club = userClub(G), L = G.leagues[club.league];
  const md = clubMatchDays(G, club.id);
  const upcoming = [...md].filter(([d, m]) => !m.res && d >= G.date).sort((a, b) => a[0] - b[0]);
  const played = [...md].filter(([d, m]) => m.res).sort((a, b) => b[0] - a[0]);
  const next = upcoming[0];
  const unread = G.inbox.filter(m => !m.read).length;
  const status = squadStatus(G);
  const rep = coachReport(G, u);
  // opponent report
  let opp = "";
  if (next) {
    const oc = G.clubs[next[1].opp], tb = table(G, oc.league), pos = tb.findIndex(r => r.id === oc.id) + 1;
    const form = tb.find(r => r.id === oc.id).form.slice(-5);
    const key = oc.squad.map(id => G.players[id]).filter(Boolean).sort((a, b) => b.ca - a.ca)[0];
    opp = `<div class="card"><div class="ch">Laporan Lawan Berikutnya</div>
      <div class="row">${crest(oc, 46)}<div style="min-width:0"><b style="font-size:17px" class="click" data-club="${oc.id}">${esc(oc.name)} (${next[1].ha})</b> <span class="muted">· ${next[0] - G.date === 0 ? "hari ini" : `dalam ${next[0] - G.date} hari`}</span><div class="muted" style="font-size:13.5px">ke-${pos} di ${esc(G.leagues[oc.league].name)}</div></div></div>
      <div class="grid2" style="margin-top:10px;font-size:13.5px"><div><div class="lbl">Performa</div>${form.length ? form.map(f => `<span class="tag" style="border-color:${f === "M" ? "var(--good)" : f === "K" ? "var(--bad)" : "#888"};margin-right:2px">${f}</span>`).join("") : "Tidak ada data"}</div><div><div class="lbl">Formasi paling sering</div>◆ ${oc.formation}</div></div>
      ${key ? `<div style="margin-top:8px;font-size:13.5px"><span class="lbl">Pemain kunci:</span> <a class="click" data-pid="${key.id}"><b>${esc(fullName(key))}</b></a> <span class="muted">(${key.main})</span></div>` : ""}</div>`;
  }
  // week training
  const wd = (ymd(G.date).wd + 6) % 7, mon = G.date - wd;
  let wk = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;text-align:center;font-size:11.5px">';
  for (let i = 0; i < 7; i++) {
    const n = mon + i, s = sessionsFor(G, club.id, n, md);
    wk += `<div style="border-radius:3px;padding:3px 0;${n === G.date ? "background:var(--go-a)" : "background:rgba(255,255,255,.05)"}">${["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][i]}<div style="display:flex;flex-direction:column;gap:2px;align-items:center;margin-top:3px">${s.match ? `<span style="font-size:10px;background:#6e1f3c;border-radius:2px;padding:1px 2px">${esc(G.clubs[s.match.opp].short)}</span>` : s.off ? '<span class="dim">—</span>' : s.s.map(k => `<i style="display:block;width:16px;height:9px;border-radius:2px;background:${SESS_COLOR[SESS[k][1]]}"></i>`).join("")}</div></div>`;
  }
  wk += "</div>";
  const news = G.news.slice(0, 3);
  root.innerHTML = `
  <div class="bcards" style="margin-bottom:10px">
    <div class="bcard click" data-go="pemain/ringkasan"><div class="ch">Status</div><div class="big">${esc(status)}</div><div class="muted" style="font-size:12.5px">${esc(club.short)}${u.squad === "Y" ? " U-19" : ""}</div></div>
    <div class="bcard click" data-go="latihan/individu"><div class="ch">Kemampuan</div><div>${starsTxt(rep.ca)}</div><div class="muted" style="font-size:12.5px">Potensi ${starsTxt(rep.pa)}</div></div>
    <div class="bcard"><div class="ch">Kebugaran</div><div class="big">${u.injury ? "Cedera" : fitnessWord(u.cond)}</div><div class="muted" style="font-size:12.5px">${u.injury ? esc(u.injury.name) : `Kondisi ${Math.round(u.cond)}%`}</div></div>
    <div class="bcard"><div class="ch">Kebahagiaan</div><div class="big">${moraleFace(u.morale)} ${moraleWord(u.morale)}</div><div class="muted" style="font-size:12.5px">${u.contract.youth ? "Kontrak akademi" : `${moneyShort(u.contract.wage)} p/mgg`}</div></div>
  </div>
  <div class="card flush"><div class="spread" style="padding:12px 12px 6px"><div class="ch" style="margin:0">Pesan</div><button class="btn sm ghost" data-go="portal/pesan">Semua${unread ? ` · ${unread} baru` : ""}</button></div>
    ${G.inbox.slice(0, 4).map(m => msgItem(G, m)).join("") || '<div class="empty">Belum ada pesan.</div>'}</div>
  ${opp}
  <div class="card">${heading("Berita", true)}${news[0] ? newsCard(G, news[0]) : '<div class="empty">Belum ada berita.</div>'}${news.slice(1).map(n => newsRow(G, n)).join("")}</div>
  <div class="card">${heading("Jadwal Pertandingan", true)}
    <table class="tbl"><thead><tr><th>Tanggal</th><th>Klub</th><th class="c">Tempat</th><th class="c">Hasil</th><th>Komp.</th></tr></thead><tbody>
    ${[...played.slice(0, 2).reverse(), ...upcoming.slice(0, 7)].map(([d, m]) => `<tr class="click" data-club="${m.opp}"><td>${shortDay(d)}</td><td><span class="row" style="gap:6px">${crest(G.clubs[m.opp], 18)}${esc(shortClub(G.clubs[m.opp]))}</span></td><td class="c">${m.ha}</td><td class="c">${m.res ? `<span class="tag" style="border-color:${m.res[0] > m.res[1] ? "var(--good)" : m.res[0] < m.res[1] ? "var(--bad)" : "#888"}">${m.res[0]}-${m.res[1]}</span>` : "-"}</td><td>${esc(m.comp)}</td></tr>`).join("")}
    </tbody></table></div>
  <div class="card"><div class="spread"><div class="ch" style="margin:0">${heading("Kompetisi", true).replace('class="ch link"', 'class="ch link" style="margin:0"')}</div><button class="btn sm ghost" data-league="${club.league}">${esc(L.name)}</button></div><div style="margin-top:8px">${miniTable(G, club.league, { around: 7 })}</div></div>
  <div class="card click" data-go="latihan/kalender"><div class="ch">Latihan</div>${wk}</div>`;
  $$("[data-mail]", root).forEach(el => (el.onclick = () => go("portal", "pesan", { mail: +el.dataset.mail })));
});
const starsTxt = v => { let s = ""; for (let i = 1; i <= 5; i++) s += v >= i ? '<i class="s full">★</i>' : v >= i - 0.5 ? '<i class="s half">★</i>' : '<i class="s">★</i>'; return `<span class="stars">${s}</span>`; };

// ---------- PESAN ----------
register("portal", "pesan", (G, root, p) => {
  const filt = p.f || "semua";
  const tasks = G.inbox.filter(m => m.kind === "decision" && !m.done);
  const unread = G.inbox.filter(m => !m.read);
  if (p.mail) return mailDetail(G, root, p);
  const list = filt === "baru" ? unread : filt === "tugas" ? tasks : G.inbox;
  let html = `<div class="card flush"><div style="padding:12px 12px 8px"><div class="ch">Pesan</div><div class="seg">
    <button data-f="semua" aria-pressed="${filt === "semua"}">Semua</button><button data-f="tugas" aria-pressed="${filt === "tugas"}">Tugas (${tasks.length})</button><button data-f="baru" aria-pressed="${filt === "baru"}">Belum Dibaca (${unread.length})</button></div>
    <button class="btn sm ghost" id="readall" style="margin-top:8px">✓ Tandai semua dibaca</button></div>`;
  let lastDay = null;
  for (const m of list.slice(0, 60)) {
    if (m.date !== lastDay) { html += `<div class="msgday">${wd3(m.date)} ${ymd(m.date).d} ${BULAN[ymd(m.date).m - 1]}</div>`; lastDay = m.date; }
    html += msgItem(G, m);
  }
  if (!list.length) html += '<div class="empty">Tidak ada pesan di sini.</div>';
  root.innerHTML = html + "</div>";
  $$("[data-f]", root).forEach(b => (b.onclick = () => go("portal", "pesan", { f: b.dataset.f }, true)));
  $$("[data-mail]", root).forEach(el => (el.onclick = () => go("portal", "pesan", { mail: +el.dataset.mail, f: filt })));
  $("#readall", root).onclick = () => { G.inbox.forEach(m => (m.read = true)); save(); render(); };
});
function mailDetail(G, root, p) {
  const m = G.inbox.find(x => x.id === p.mail);
  if (!m) { go("portal", "pesan", {}, true); return; }
  if (!m.read) { m.read = true; save(); }
  const mm = mailMeta(G, m);
  const col = CAT_COLOR[mm.cat] || "#666";
  const club = userClub(G);
  let extra = "";
  if (/Selamat datang/.test(m.title)) {
    extra = `<div class="card" style="margin:0 12px 12px;background:rgba(255,255,255,.05)"><div class="row">${crest(club, 44)}<div><b style="font-size:18px">${esc(club.name)}</b><div class="muted">${flagEmoji(club.nation)} ${esc(NATIONS[club.nation].name)} · ${esc(G.leagues[club.league].name)}</div></div></div>
      <div class="grid2" style="margin-top:10px;font-size:13.5px"><div><div class="lbl">Reputasi</div><span style="color:${REP_COLOR[clubReputation(club)]}">●</span> ${clubReputation(club)}</div><div><div class="lbl">Prediksi musim ini</div>ke-${predictedFinish(G, club)}</div></div>
      <div class="ch" style="font-size:14px;margin-top:12px">Fasilitas</div>${facilities(club).map(([k, v]) => `<div class="spread" style="font-size:13.5px;padding:3px 0"><span>${k}</span><span class="tag" style="border-color:var(--good);color:var(--good)">${v}</span></div>`).join("")}</div>`;
  }
  root.innerHTML = `<button class="btn sm" id="back" style="margin-bottom:8px">← Kembali ke pesan</button>
  <div class="card flush"><div class="mailhead">${silhouette(40)}<div style="min-width:0;flex:1"><div class="muted" style="font-size:12.5px">${esc(mm.from)}</div><b>${esc(m.title)}</b></div><span class="muted" style="font-size:12px">${fmt(m.date)}<br>${mm.time}</span></div>
    <div style="padding:10px 12px 0"><span class="tag" style="border-color:${col};background:${col}55;color:#fff">${esc(mm.cat)}</span></div>
    <div class="mailbody">${esc(m.body)}</div>
    ${m.changes ? `<div style="padding:0 12px 12px;display:flex;flex-wrap:wrap;gap:6px">${m.changes.map(c => `<span class="tag" style="border-color:${c.to > c.from ? "var(--good)" : "var(--bad)"};color:${c.to > c.from ? "var(--good)" : "var(--bad)"}">${esc(c.name)} ${c.from}→${c.to}</span>`).join("")}</div>` : ""}
    ${m.kind === "decision" ? `<div style="padding:0 12px 12px">${m.done ? `<div class="card" style="margin:0;background:rgba(255,255,255,.05)"><b>${esc(m.options[m.choice]?.label || "")}</b><div class="muted">${esc(m.result || "")}</div></div>` : m.options.map((o, i) => `<button class="opt" data-o="${i}"><b>${esc(o.label)}</b><span>${esc(o.detail || "")}</span></button>`).join("")}</div>` : ""}
    ${extra}
  </div>`;
  $("#back", root).onclick = () => history.back();
  $$("[data-o]", root).forEach(b => (b.onclick = () => {
    const rng = rngOf(G); const msg = resolveDecision(G, m.id, +b.dataset.o, rng); G.rs = rng.s; save();
    toast(msg || "Keputusan dicatat."); render();
  }));
}

// ---------- KALENDER ----------
register("portal", "kalender", (G, root, p) => {
  const mode = p.mode || "umum";
  const { y, m } = ymd(G.date);
  const cy = p.y ?? y, cm = p.m ?? m;
  const u = userP(G), club = userClub(G), md = clubMatchDays(G, club.id);
  const head = `<div class="card"><div class="seg" style="margin-bottom:10px"><button data-mode="umum" aria-pressed="${mode === "umum"}">Umum</button><button data-mode="latihan" aria-pressed="${mode === "latihan"}">Latihan</button><button data-mode="jadwal" aria-pressed="${mode === "jadwal"}">Jadwal Pertandingan</button></div>`;
  let body = "";
  if (mode === "umum") {
    const first = day(cy, cm, 1), last = day(cm === 12 ? cy + 1 : cy, cm === 12 ? 1 : cm + 1, 1) - 1;
    const lead = (ymd(first).wd + 6) % 7;
    let grid = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(d => `<div class="hd">${d}</div>`).join("");
    for (let n = first - lead; n <= last || (n - first + lead) % 7; n++) {
      const dd = ymd(n), out = dd.m !== cm;
      const ev = calendarEvents(G, n);
      const mt = md.get(n);
      grid += `<div class="d ${out ? "out" : ""} ${n === G.date ? "today" : ""}"><div class="n">${dd.d}</div>${mt ? `<span class="e m">${esc(mt.comp)} ${mt.ha} ${esc(G.clubs[mt.opp].short)}${mt.res ? ` ${mt.res[0]}-${mt.res[1]}` : ""}</span>` : ""}${ev.map(e => `<span class="e ${e.k}">${esc(e.t)}</span>`).join("")}</div>`;
    }
    body = `${monthNav(cy, cm)}<div class="cal">${grid}</div>`;
  } else if (mode === "latihan") {
    const wk = p.wk ?? 0;
    const mon = G.date - ((ymd(G.date).wd + 6) % 7) + wk * 7;
    let rows = "";
    for (let i = 0; i < 7; i++) {
      const n = mon + i, s = sessionsFor(G, club.id, n, md), dd = ymd(n);
      rows += `<div class="wkrow ${n === G.date ? "today" : ""}"><div class="dd">${HARI[dd.wd].slice(0, 3)}<b>${dd.d}</b>${BULAN[dd.m - 1]}</div><div>${s.off ? `<span class="muted">${esc(s.label)}</span>` : s.match ? `<span class="ses" style="background:#6e1f3c">${esc(s.match.compName)} · ${esc(G.clubs[s.match.opp].name)} (${s.match.ha})</span>` : s.s.map(k => `<span class="ses" style="background:${SESS_COLOR[SESS[k][1]]}">${SESS[k][0]}</span>`).join("")}</div></div>`;
    }
    body = `<div class="spread" style="margin-bottom:6px"><button class="btn sm" data-wk="${wk - 1}">←</button><b>Minggu ${fmt(mon)} – ${fmt(mon + 6)}</b><button class="btn sm" data-wk="${wk + 1}">→</button></div>
      <div class="muted" style="font-size:13px">Fokus jadwal: <b style="color:#fff">${ymd(G.date).m === 7 ? "Pramusim" : "Musim reguler"}</b> · Intensitas latihan individumu: <b style="color:#fff">${esc(G.user.training.intensity)}</b></div>${rows}
      <div class="legend"><span><i style="background:${SESS_COLOR.fis}"></i>Fisik</span><span><i style="background:${SESS_COLOR.tak}"></i>Taktik</span><span><i style="background:${SESS_COLOR.bola}"></i>Bola</span><span><i style="background:${SESS_COLOR.rest}"></i>Istirahat</span></div>`;
  } else {
    const all = [...md].sort((a, b) => a[0] - b[0]);
    const sel = p.fx ?? (all.find(([d, x]) => !x.res && d >= G.date) || all[all.length - 1])?.[0];
    let lastM = null, rows = "";
    for (const [d, x] of all) {
      const dm = ymd(d);
      if (dm.m !== lastM) { rows += `<tr><td colspan="5" style="font-weight:700;padding-top:12px">${BULAN_PANJANG[dm.m - 1]} ${dm.y}</td></tr>`; lastM = dm.m; }
      rows += `<tr class="click ${d === sel ? "me" : ""}" data-fx="${d}"><td>${wd3(d)} ${dm.d} ${BULAN[dm.m - 1]}</td><td><span class="row" style="gap:6px">${crest(G.clubs[x.opp], 18)}${esc(shortClub(G.clubs[x.opp]))}</span></td><td class="c">${x.ha}</td><td class="c">${x.res ? `${x.res[0]}-${x.res[1]}` : "-"}</td><td>${esc(x.comp)}</td></tr>`;
    }
    const sx = md.get(sel);
    let det = "";
    if (sx) {
      const oc = G.clubs[sx.opp], H = sx.ha === "K" ? club : oc, A2 = sx.ha === "K" ? oc : club;
      const inj = c => c.squad.map(id => G.players[id]).filter(q => q && q.injury).slice(0, 4);
      const rev = [...md].find(([d, x]) => x.opp === sx.opp && d !== sel);
      det = `<div class="card" style="background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(0,0,0,.1))"><div class="muted" style="text-align:center;font-size:13px">${fmtDay(sel)} · ${esc(sx.compName)}</div>
        <div class="row" style="justify-content:center;gap:10px;margin:8px 0"><b class="disp" style="font-size:20px">${esc(shortClub(H))}</b>${crest(H, 30)}<b class="disp" style="font-size:22px">${sx.res ? `${sx.ha === "K" ? sx.res[0] : sx.res[1]} - ${sx.ha === "K" ? sx.res[1] : sx.res[0]}` : "15:00"}</b>${crest(A2, 30)}<b class="disp" style="font-size:20px">${esc(shortClub(A2))}</b></div>
        <div class="muted" style="text-align:center;font-size:13px">Kandang ${esc(H.name)}</div>
        ${[club, oc].map(c => `<div class="ch" style="font-size:14px;margin-top:12px">Berita tim ${esc(c.short)}</div>${inj(c).map(q => `<div style="font-size:13.5px">➕ <a class="click" data-pid="${q.id}">${esc(fullName(q))}</a> absen (${esc(q.injury.name.toLowerCase())})</div>`).join("") || '<div class="muted" style="font-size:13.5px">Tidak ada kabar tim</div>'}`).join("")}
        <div class="ch" style="font-size:14px;margin-top:12px">Pertemuan sebelumnya</div><div class="muted" style="font-size:13.5px">${rev && rev[1].res ? `${fmt(rev[0])}: ${rev[1].ha === "K" ? `${club.short} ${rev[1].res[0]}-${rev[1].res[1]} ${oc.short}` : `${oc.short} ${rev[1].res[1]}-${rev[1].res[0]} ${club.short}`}` : "Belum ada pertandingan yang dimainkan."}</div></div>`;
    }
    body = `${det}<div class="tscroll"><table class="tbl"><thead><tr><th>Tanggal</th><th>Lawan</th><th class="c">Tempat</th><th class="c">Hasil</th><th>Kompetisi</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  root.innerHTML = head + body + "</div>";
  $$("[data-mode]", root).forEach(b => (b.onclick = () => go("portal", "kalender", { mode: b.dataset.mode }, true)));
  $$("[data-mn]", root).forEach(b => (b.onclick = () => { let [yy, mm] = b.dataset.mn.split("-").map(Number); go("portal", "kalender", { mode, y: yy, m: mm }, true); }));
  $$("[data-wk]", root).forEach(b => (b.onclick = () => go("portal", "kalender", { mode, wk: +b.dataset.wk }, true)));
  $$("[data-fx]", root).forEach(r => (r.onclick = () => go("portal", "kalender", { mode, fx: +r.dataset.fx }, true)));
});
function monthNav(y, m) {
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${m - 1}`, next = m === 12 ? `${y + 1}-1` : `${y}-${m + 1}`;
  return `<div class="spread" style="margin-bottom:8px"><button class="btn sm" data-mn="${prev}">←</button><b class="disp" style="font-size:20px">${BULAN_PANJANG[m - 1]} ${y}</b><button class="btn sm" data-mn="${next}">→</button></div>`;
}

// ---------- BERITA ----------
register("portal", "berita", (G, root, p) => {
  if (p.news) {
    const n = G.news.find(x => x.id === p.news);
    if (n) {
      root.innerHTML = `<button class="btn sm" id="back" style="margin-bottom:8px">← Kembali</button><div class="card flush"><div class="ncard" style="border:0;border-radius:0"><div class="art" style="height:150px"><div class="big">${newsArt(G, n, 96)}</div></div><div class="bd"><div class="meta" style="margin:0 0 6px"><span>${fmtDay(n.date)}</span><i>|</i><span>${esc(n.tag || "Berita")}</span></div><h4 style="font-size:22px">${esc(n.title)}</h4><p style="-webkit-line-clamp:unset;color:#dfe2e8;font-size:15.5px;line-height:1.55;margin-top:8px">${esc(n.body || "")}</p></div></div></div>`;
      $("#back", root).onclick = () => history.back();
      return;
    }
  }
  // today's top fixtures
  const today = [];
  for (const L of Object.values(G.leagues)) for (const f of L.fixtures) if (f.d >= G.date && f.d <= G.date + 3 && today.length < 8) today.push([L, f]);
  today.sort((a, b) => a[1].d - b[1].d || G.clubs[b[1].h].level - G.clubs[a[1].h].level);
  const me = G.news.filter(n => n.scope === "me"), world = G.news.filter(n => n.scope === "world"), trf = G.news.filter(n => n.scope === "transfer" || n.tag === "Transfer" || n.tag === "Rumor Transfer");
  const sec = (t, arr) => `<div class="card">${heading(t, true)}${arr[0] ? newsCard(G, arr[0]) : '<div class="empty">Belum ada berita.</div>'}${arr.length > 1 ? `<div style="margin-top:6px">${arr.slice(1, 7).map(n => newsRow(G, n)).join("")}</div>` : ""}</div>`;
  root.innerHTML = `<h2 class="disp" style="font-size:26px;margin:4px 2px 8px">Beranda Berita</h2>
    ${today.length ? `<div class="lbl" style="margin:0 2px 6px">Jadwal pertandingan teratas</div><div class="fxs">${today.map(([L, f]) => `<div class="fx click" data-league="${L.id}"><div class="h"><span>${esc(L.short)}</span><span>${f.res ? "Selesai" : shortDay(f.d)}</span></div><div class="tm">${crest(G.clubs[f.h], 18)}<span>${esc(shortClub(G.clubs[f.h]))}</span><b>${f.res ? f.res[0] : ""}</b></div><div class="tm">${crest(G.clubs[f.a], 18)}<span>${esc(shortClub(G.clubs[f.a]))}</span><b>${f.res ? f.res[1] : ""}</b></div></div>`).join("")}</div>` : ""}
    ${sec("Untukmu", me)}${sec("Di Sekitar Dunia", world)}${sec("Ringkasan Transfer", trf)}
    <div class="card">${heading("Pusat Kompetisi", true)}<div class="row" style="margin-bottom:6px">${compBadge(G.leagues[userClub(G).league], 28)}<b class="click" data-league="${userClub(G).league}">${esc(G.leagues[userClub(G).league].name)}</b></div>${miniTable(G, userClub(G).league, { top: 8 })}</div>`;
});

// ---------- KOMPETISI (overview) ----------
register("portal", "kompetisi", (G, root) => {
  const club = userClub(G);
  const order = [club.league, ...Object.keys(G.leagues).filter(k => k !== club.league)];
  root.innerHTML = order.map(lid => {
    const L = G.leagues[lid];
    const champ = L.history[L.history.length - 1];
    const players = L.teams.flatMap(id => G.clubs[id].squad.map(pid => G.players[pid])).filter(q => q && q.st.rn >= 3);
    const best = players.sort((a, b) => b.st.rsum / b.st.rn - a.st.rsum / a.st.rn)[0];
    return `<div class="card flush" style="border-top:3px solid ${L.color}"><div class="row click" data-league="${lid}" style="padding:12px;background:linear-gradient(90deg,${L.color}66,transparent)">${compBadge(L, 38)}<div><b style="font-size:19px">${esc(L.name)}</b><div class="muted" style="font-size:13px">${flagEmoji(L.nation)} ${esc(NATIONS[L.nation].name)}</div></div></div>
      <div style="padding:0 12px"><div class="spread" style="padding:8px 0;border-bottom:1px solid var(--line);font-size:14px"><b>Juara Bertahan</b><span>${champ ? `${crest(G.clubs[champ.champion], 16).replace("<svg", '<svg style="display:inline;vertical-align:-3px;margin-right:4px"')}${esc(G.clubs[champ.champion].short)}` : "-"}</span></div>
      <div class="spread" style="padding:8px 0;font-size:14px"><b>Nilai Rata-Rata Tertinggi</b><span>${best ? `<a class="click" data-pid="${best.id}">${esc(shortName(best))}</a> ${pill(best.st.rsum / best.st.rn)}` : "-"}</span></div>
      ${miniTable(G, lid, lid === club.league ? { top: 20 } : { top: 6 })}<div style="height:10px"></div></div></div>`;
  }).join("");
});
