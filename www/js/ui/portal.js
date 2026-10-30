// Portal: Ringkasan, Pesan, Kalender, Berita, Kompetisi
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, flagEmoji, compBadge, avatar, lookFor, silhouette, heading, toast, shortDay, moneyShort, bars } from "./core.js";
import { NATIONS, LEAGUES } from "../data.js";
import { fmt, fmtDay, ymd, HARI, BULAN, BULAN_PANJANG, day, seasonLabel, ageOn } from "../calendar.js";
import { userP, userClub, table } from "../world.js";
import { fullName, shortName } from "../player.js";
import { squadStatus, resolveDecision, coachReport, fed } from "../career.js";
import { rngOf } from "../sim.js";
import { mailMeta, CAT_COLOR, clubMatchDays, userMatchDays, leagueZones, zoneOf, sessionsFor, SESS, SESS_COLOR, calendarEvents, fitnessWord, moraleWord, moraleFace, facilities, clubReputation, REP_COLOR, staffOf, predictedFinish } from "../meta.js";
import { compLabel } from "../comps.js";
import { CUPS, CONTINENTAL } from "../compdata.js";
import { leagueSeasonLabel } from "../world.js";

const avgR = st => (st.rn ? st.rsum / st.rn : null);
const wd3 = n => HARI[ymd(n).wd].slice(0, 3);

// ---------- shared bits ----------
export function miniTable(G, lid, opts = {}) {
  const L = G.leagues[lid]; const u = userP(G);
  if (L.zones && opts.zone == null) {
    const z = L.zones.map((name, k) => `<div class="lbl" style="margin:${k ? 12 : 0}px 0 4px">${esc(name)}</div>` + miniTable(G, lid, { ...opts, zone: k, noLegend: k === 0 }));
    return z.join("");
  }
  const tb = table(G, lid, opts.zone ?? null);
  const Z = leagueZones(G, lid);
  let rows = tb.map((r, i) => [r, i]);
  if (opts.around) { const me = tb.findIndex(r => r.id === u.club); const a = Math.max(0, Math.min(tb.length - opts.around, me - Math.floor(opts.around / 2))); rows = rows.slice(a, a + opts.around); }
  else if (opts.top) rows = rows.slice(0, opts.top);
  const zone = i => zoneOf(Z, i, tb.length);
  const legend = [...Z.top, ...Z.bottom].filter((x, i, a) => a.findIndex(y => y.label === x.label) === i);
  return `<table class="tbl"><thead><tr><th>Pos</th><th>Tim</th><th class="n">Main</th>${opts.full ? '<th class="n">M</th><th class="n">S</th><th class="n">K</th>' : ""}<th class="n">SG</th><th class="n">Pts</th></tr></thead><tbody>
    ${rows.map(([r, i]) => `<tr class="${r.id === u.club ? "me" : ""} click" data-club="${r.id}"><td class="${zone(i)}">${i + 1}</td><td><span class="row" style="gap:6px">${crest(G.clubs[r.id], 18)}<span>${esc(opts.full ? G.clubs[r.id].name : G.clubs[r.id].short.length > 4 ? G.clubs[r.id].short : shortClub(G.clubs[r.id]))}</span></span></td><td class="n">${r.p}</td>${opts.full ? `<td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td>` : ""}<td class="n">${r.gf - r.ga}</td><td class="n"><b>${r.pts}</b></td></tr>`).join("")}
  </tbody></table>${opts.noLegend || !legend.length ? "" : `<div class="legend">${legend.map(x => `<span><i class="${x.cls}" style="background:${ZC[x.cls]}"></i>${esc(x.label)}</span>`).join("")}</div>`}`;
}
const ZC = { zt: "var(--blue)", ze: "#c9a227", zr: "var(--bad)", zp: "#2fbf71", zo: "#e8873a", zc: "#2bb3c0" };
export const shortClub = c => c.name.replace(/^(FC|AC|AS|RC|CA|SC|RCD|UD|CF|AJ|OGC|LOSC|SV|VfL|VfB|TSG|1\. FC|1\. FSV|RB|SS|US|Real|Stade|Olympique|Borussia)\s/, "").replace(/ (FC|CF|United|City|Hotspur|Calcio)$/, m => (m === " United" ? " Utd" : m === " City" ? " City" : "")).slice(0, 16);

function newsArt(G, n, size = 60) {
  const c = n.club && G.clubs[n.club];
  if (c) return crest(c, size);
  if (n.league && G.leagues[n.league]) return compBadge(G.leagues[n.league], size);
  if (n.comp && G.comps[n.comp]) return compBadge(G.comps[n.comp], size);
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
  const md = userMatchDays(G);
  const upcoming = [...md].filter(([d, m]) => !m.res && d >= G.date).sort((a, b) => a[0] - b[0]);
  const played = [...md].filter(([d, m]) => m.res).sort((a, b) => b[0] - a[0]);
  const next = upcoming[0];
  const unread = G.inbox.filter(m => !m.read).length;
  const status = squadStatus(G);
  const rep = coachReport(G, u);
  // opponent report
  let opp = "";
  if (next) {
    const oc = G.clubs[next[1].opp], OL = G.leagues[oc.league], tb = OL ? table(G, oc.league) : [], pos = tb.findIndex(r => r.id === oc.id) + 1;
    const form = tb.find(r => r.id === oc.id)?.form.slice(-5) || [];
    const key = oc.squad.map(id => G.players[id]).filter(Boolean).sort((a, b) => b.ca - a.ca)[0];
    opp = `<div class="card"><div class="ch">Laporan Lawan Berikutnya</div>
      <div class="row">${crest(oc, 46)}<div style="min-width:0"><b style="font-size:17px" class="click" data-club="${oc.id}">${esc(oc.name)} (${next[1].ha})</b> <span class="muted">· ${next[0] - G.date === 0 ? "hari ini" : `dalam ${next[0] - G.date} hari`}</span><div class="muted" style="font-size:13.5px">${OL ? `ke-${pos} di ${esc(OL.name)}` : `${flagEmoji(oc.nation)} ${esc(NATIONS[oc.nation]?.name || "")}`} · ${esc(next[1].compName)}</div></div></div>
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
    ${[...played.slice(0, 2).reverse(), ...upcoming.slice(0, 7)].map(([d, m]) => `<tr class="click" data-club="${m.opp}" title="${esc(m.compName)}"><td>${shortDay(d)}</td><td><span class="row" style="gap:6px">${crest(G.clubs[m.opp], 18)}${esc(shortClub(G.clubs[m.opp]))}</span></td><td class="c">${m.ha}</td><td class="c">${m.res ? `<span class="tag" style="border-color:${m.res[0] > m.res[1] ? "var(--good)" : m.res[0] < m.res[1] ? "var(--bad)" : "#888"}">${m.res[0]}-${m.res[1]}</span>` : "-"}</td><td>${esc(m.comp)}</td></tr>`).join("")}
    </tbody></table></div>
  ${L ? `<div class="card"><div class="spread"><div class="ch" style="margin:0">${heading("Kompetisi", true).replace('class="ch link"', 'class="ch link" style="margin:0"')}</div><button class="btn sm ghost" data-league="${club.league}">${esc(L.name)}</button></div><div style="margin-top:8px">${miniTable(G, club.league, { around: 7, zone: L.zones ? club.zone : undefined })}</div></div>` : ""}
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
    ${m.done && m.options?.some(o => o.act === "openPress") && G.press?.id === m.options[0].data?.press && !G.press.done ? `<div style="padding:0 12px 12px"><button class="btn pri" data-go="pers/konferensi" style="width:100%">Kembali ke konferensi pers</button></div>` : ""}
    ${m.done && m.options?.some(o => o.act === "openNeg") && G.neg?.id === m.options[0].data?.neg && ["open", "final"].includes(G.neg.status) ? `<div style="padding:0 12px 12px"><button class="btn pri" data-go="pemain/negosiasi" style="width:100%">Lanjutkan negosiasi</button></div>` : ""}
    ${extra}
  </div>`;
  $("#back", root).onclick = () => history.back();
  $$("[data-o]", root).forEach(b => (b.onclick = () => {
    const o = m.options[+b.dataset.o];
    const rng = rngOf(G); const msg = resolveDecision(G, m.id, +b.dataset.o, rng); G.rs = rng.s; save();
    if (o?.act === "openNeg") { go("pemain", "negosiasi"); return; }
    if (o?.act === "openPress") { go("pers", "konferensi"); return; }
    toast(msg || "Keputusan dicatat."); render();
  }));
}

// ---------- KALENDER ----------
register("portal", "kalender", (G, root, p) => {
  const mode = p.mode || "umum";
  const { y, m } = ymd(G.date);
  const cy = p.y ?? y, cm = p.m ?? m;
  const u = userP(G), club = userClub(G), md = userMatchDays(G);
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
        <div class="muted" style="text-align:center;font-size:13px">${sx.ha === "N" ? "Stadion netral" : `Kandang ${esc(H.name)}`}</div>
        ${[club, oc].filter(Boolean).map(c => `<div class="ch" style="font-size:14px;margin-top:12px">Berita tim ${esc(c.short)}</div>${inj(c).map(q => `<div style="font-size:13.5px">➕ <a class="click" data-pid="${q.id}">${esc(fullName(q))}</a> absen (${esc(q.injury.name.toLowerCase())})</div>`).join("") || '<div class="muted" style="font-size:13.5px">Tidak ada kabar tim</div>'}`).join("")}
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
  if ((G.newsSeen || 0) < (G.newsId || 0)) { G.newsSeen = G.newsId; save(); setTimeout(() => { const b = document.querySelector('.subtabs [data-tab="berita"] .badge'); b?.remove(); }, 0); }
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
  for (const L of [...Object.values(G.leagues), ...Object.values(G.comps).filter(c => !c.youth)]) for (const f of L.fixtures) if (f.d >= G.date && f.d <= G.date + 3) today.push([L, f]);
  today.sort((a, b) => a[1].d - b[1].d || (G.clubs[b[1].h].level + G.clubs[b[1].a].level) - (G.clubs[a[1].h].level + G.clubs[a[1].a].level));
  today.length = Math.min(today.length, 10);
  const me = G.news.filter(n => n.scope === "me"), world = G.news.filter(n => n.scope === "world"), trf = G.news.filter(n => n.scope === "transfer" || n.tag === "Transfer" || n.tag === "Rumor Transfer");
  const sec = (t, arr) => `<div class="card">${heading(t, true)}${arr[0] ? newsCard(G, arr[0]) : '<div class="empty">Belum ada berita.</div>'}${arr.length > 1 ? `<div style="margin-top:6px">${arr.slice(1, 7).map(n => newsRow(G, n)).join("")}</div>` : ""}</div>`;
  root.innerHTML = `<h2 class="disp" style="font-size:26px;margin:4px 2px 8px">Beranda Berita</h2>
    ${today.length ? `<div class="lbl" style="margin:0 2px 6px">Jadwal pertandingan teratas</div><div class="fxs">${today.map(([L, f]) => `<div class="fx click" ${L.kind ? `data-go="kompetisi/ringkasan" data-p='${JSON.stringify({ comp: L.id })}'` : `data-league="${L.id}"`}><div class="h"><span>${esc(L.short)}</span><span>${f.res ? "Selesai" : shortDay(f.d)}</span></div><div class="tm">${crest(G.clubs[f.h], 18)}<span>${esc(shortClub(G.clubs[f.h]))}</span><b>${f.res ? f.res[0] : ""}</b></div><div class="tm">${crest(G.clubs[f.a], 18)}<span>${esc(shortClub(G.clubs[f.a]))}</span><b>${f.res ? f.res[1] : ""}</b></div></div>`).join("")}</div>` : ""}
    ${sec("Untukmu", me)}${sec("Di Sekitar Dunia", world)}${sec("Ringkasan Transfer", trf)}
    ${G.leagues[userClub(G).league] ? `<div class="card">${heading("Pusat Kompetisi", true)}<div class="row" style="margin-bottom:6px">${compBadge(G.leagues[userClub(G).league], 28)}<b class="click" data-league="${userClub(G).league}">${esc(G.leagues[userClub(G).league].name)}</b></div>${miniTable(G, userClub(G).league, { top: 8, zone: G.leagues[userClub(G).league].zones ? userClub(G).zone : undefined })}</div>` : ""}`;
});

// ---------- KOMPETISI (overview) ----------
// status line for a cup / continental competition
export function compStatus(G, c) {
  if (!c) return "";
  if (c.state === "done") return `Juara: ${G.clubs[c.winner]?.short || "-"}`;
  const S = c.stages[c.cur ?? 0];
  if (!S) return "";
  const next = c.fixtures.filter(f => !f.res).sort((a, b) => a.d - b.d)[0];
  return `${S.name}${next ? ` · ${fmt(next.d)}` : ""}`;
}
function userComps(G) {
  const u = userP(G);
  const ids = new Set();
  for (const c of Object.values(G.comps)) if (c.kind !== "po" && c.teams.includes(u.club) && (!c.youth || u.squad === "Y")) ids.add(c.id);
  return [...ids].map(id => G.comps[id]);
}
const crow = (G, badge, name, sub, right, attrs) => `<div class="crow click" ${attrs}>${badge}<div class="cn"><b>${esc(name)}</b><span>${sub}</span></div><div class="cr">${right}</div></div>`;
register("portal", "kompetisi", (G, root) => {
  const club = userClub(G), u = userP(G);
  const L0 = G.leagues[club.league];
  const lgRow = L => { const last = L.history[L.history.length - 1], tb = table(G, L.id); const lead = tb[0]?.p ? `Puncak: ${esc(G.clubs[tb[0].id].short)} ${tb[0].pts}` : last ? `Juara: ${esc(G.clubs[last.champion].short)}` : ""; return crow(G, compBadge(L, 32), L.name, `${flagEmoji(L.nation)} ${esc(NATIONS[L.nation].name)} · ${L.tier === 2 ? "Divisi 2" : "Divisi 1"} · ${esc(leagueSeasonLabel(L))}`, lead, `data-league="${L.id}"`); };
  const cRow = c => crow(G, compBadge(c, 32), c.name, `${c.nation ? `${flagEmoji(c.nation)} ` : ""}${esc(compLabel(c))}${c.youth ? " · U-19" : ""}`, esc(compStatus(G, c)), `data-go="kompetisi/ringkasan" data-p='${JSON.stringify({ comp: c.id })}'`);
  const mine = userComps(G);
  const nations = [...new Set(Object.values(G.leagues).map(L => L.nation))];
  const cups = CUPS.map(d => G.comps[d.id]).filter(Boolean);
  const cont = CONTINENTAL.filter(d => !d.youth).map(d => G.comps[d.id]).filter(Boolean);
  const youth = CONTINENTAL.filter(d => d.youth).map(d => G.comps[d.id]).filter(Boolean);
  const nl = G.nl ? crow(G, compBadge({ color: "#0e1e5b" }, 32), "UEFA Nations League", `Liga A & B · ${esc(G.nl.season)}`, G.nl.winner ? `Juara: ${esc(NATIONS[G.nl.winner].name)}` : G.nl.ko.length ? `Fase gugur` : "Fase grup", `data-go="kompetisi/ringkasan" data-p='${JSON.stringify({ comp: "NL" })}'`) : "";
  root.innerHTML = `
    ${L0 ? `<div class="card flush" style="border-top:3px solid ${L0.color}"><div class="row click" data-league="${L0.id}" style="padding:12px;background:linear-gradient(90deg,${L0.color}66,transparent)">${compBadge(L0, 38)}<div><b style="font-size:19px">${esc(L0.name)}</b><div class="muted" style="font-size:13px">${flagEmoji(L0.nation)} ${esc(NATIONS[L0.nation].name)} · ${esc(leagueSeasonLabel(L0))}</div></div></div><div style="padding:0 12px 12px">${miniTable(G, L0.id, { top: 20 })}</div></div>` : ""}
    ${mine.length ? `<div class="grp-h">Kompetisi klubmu</div><div class="card flush clist">${mine.map(cRow).join("")}</div>` : ""}
    <div class="grp-h">Antarklub</div><div class="card flush clist">${cont.map(cRow).join("")}</div>
    <div class="grp-h">Tim nasional</div><div class="card flush clist">${nl}</div>
    <div class="grp-h">Kelompok umur</div><div class="card flush clist">${youth.map(cRow).join("") || '<div class="empty">-</div>'}</div>
    <div class="grp-h">Liga</div>${nations.map(n => `<div class="card flush clist">${Object.values(G.leagues).filter(L => L.nation === n).sort((a, b) => a.tier - b.tier).map(lgRow).join("")}${cups.filter(c => c.nation === n).map(cRow).join("")}</div>`).join("")}`;
});
