// Skuad, Klub, Kompetisi pages
import { register, go, save, S } from "./shell.js";
import { $, $$, esc, crest, pill, avatar, lookFor, natTag, flagEmoji, heading, jersey, compBadge, shortDay, moneyShort } from "./core.js";
import { NATIONS, POS_LABEL } from "../data.js";
import { fmt, ageOn, seasonLabel, ymd } from "../calendar.js";
import { userP, userClub, table, leagueSeasonLabel } from "../world.js";
import { compRingkasan, compJadwal, compTahap, compSejarah } from "./comps.js";
import { compStatus } from "./portal.js";
import { fullName, shortName } from "../player.js";
import { slotRating } from "../player.js";
import { FORMATIONS } from "../match.js";
import { shirtNumber } from "../sim.js";
import { positionString, moraleFace, clubReputation, REP_COLOR, facilities, clubCulture, clubExpectation, predictedFinish, staffOf, clubMatchDays } from "../meta.js";
import { miniTable, shortClub, newsRow } from "./portal.js";

const avgR = st => (st.rn ? st.rsum / st.rn : null);
const ORDER = { GK: 0, DR: 1, DC: 2, DL: 3, WBR: 4, WBL: 5, DM: 6, MR: 7, MC: 8, ML: 9, AMR: 10, AMC: 11, AML: 12, ST: 13 };
const heart = c => `<span style="color:${c >= 90 ? "var(--good)" : c >= 75 ? "var(--lime)" : c >= 60 ? "var(--amb)" : "var(--bad)"}">♥</span>`;

export function bestXI(G, clubId) {
  const club = G.clubs[clubId];
  const pool = club.squad.map(id => G.players[id]).filter(p => p && !p.injury && !(p.ban > 0));
  const form = FORMATIONS[club.formation] || FORMATIONS["4-3-3"];
  const used = new Set(), xi = [];
  const order = form.map((_, i) => i).sort((a, b) => (form[a][0] === "GK" ? -1 : 0) - (form[b][0] === "GK" ? -1 : 0));
  for (const i of order) {
    let best = null, bv = -1;
    for (const p of pool) if (!used.has(p.id)) { const v = slotRating(p, form[i][0]); if (v > bv) { bv = v; best = p; } }
    xi[i] = best ? { p: best, pos: form[i][0], sx: form[i][1], sy: form[i][2] } : null;
    if (best) used.add(best.id);
  }
  return xi.filter(Boolean);
}
export function formationPitch(G, slots, colors, opts = {}) {
  // slots: [{p|name, no, pos, sx, sy, rating}] in attacking-right frame; drawn bottom→top
  return `<div class="fpitch" style="${opts.h ? `aspect-ratio:auto;height:${opts.h}px` : ""}">${slots.map(s => {
    const x = 8 + (s.sy / 68) * 84, y = 92 - (s.sx / 92) * 84;
    const nm = s.name || (s.p ? s.p.ln : "");
    return `<div class="p ${s.me ? "me" : ""} ${s.pid ? "click" : ""}" ${s.pid ? `data-pid="${s.pid}"` : ""} style="left:${x}%;top:${y}%">${jersey(colors, s.no ?? "", 30, s.pos === "GK")}${s.rating != null || opts.showPos ? `<div class="pr">${s.rating != null ? pill(s.rating).replace("rpill", "rpill") : ""}${opts.showPos ? `<span class="pos">${s.pos}</span>` : ""}</div>` : ""}<div class="nm">${esc(nm)}</div></div>`;
  }).join("")}</div>`;
}

// ---------- SKUAD ----------
function squadTable(G, ids, opts = {}) {
  const u = userP(G);
  const ps = ids.map(id => G.players[id]).filter(Boolean).sort((a, b) => ORDER[a.main] - ORDER[b.main] || b.ca - a.ca);
  return `<div class="tscroll"><table class="tbl"><thead><tr><th class="n">#</th><th>Pemain</th><th>Posisi</th><th class="n">Usia</th><th class="c">Kon</th><th class="c">Mor</th><th class="n">Main</th><th class="n">Gol</th><th class="n">Ast</th><th>Rata2</th><th class="n">KK</th><th class="n">KM</th></tr></thead><tbody>
    ${ps.map(p => `<tr class="click ${p.id === u.id ? "me" : ""}" data-pid="${p.id}"><td class="n">${shirtNumber(G, p)}</td><td><span class="row" style="gap:6px">${esc(shortName(p))}${p.injury ? '<span class="chip inj">Cdr</span>' : ""}${p.ban > 0 ? '<span class="chip ban">Skr</span>' : ""}${p.away ? '<span class="chip nt">Tmn</span>' : ""}</span></td><td>${esc(positionString(p))}</td><td class="n">${ageOn(p.birth, G.date)}</td><td class="c">${p.injury ? '<span style="color:var(--bad)">✚</span>' : heart(p.cond)}</td><td class="c">${moraleFace(p.morale ?? 65)}</td><td class="n">${p.st.apps}${p.st.sub ? `(${p.st.sub})` : ""}</td><td class="n">${p.st.gls}</td><td class="n">${p.st.ast}</td><td>${pill(avgR(p.st))}</td><td class="n">${p.st.yc}</td><td class="n">${p.st.rc}</td></tr>`).join("")}
  </tbody></table></div>`;
}
register("skuad", "utama", (G, root) => {
  const club = userClub(G);
  const xi = bestXI(G, club.id);
  const nextFx = [...clubMatchDays(G, club.id)].filter(([d, m]) => !m.res && d >= G.date).sort((a, b) => a[0] - b[0])[0];
  const avgMor = club.squad.map(id => G.players[id]?.morale ?? 65).reduce((s, x) => s + x, 0) / Math.max(1, club.squad.length);
  root.innerHTML = `<div class="card"><div class="row">${crest(club, 40)}<div style="flex:1"><b style="font-size:18px">${esc(club.name)}</b><div class="muted" style="font-size:13px">Skuad Senior Pemain (${club.squad.length})</div></div>${nextFx ? `<span class="tag" style="border-color:var(--line-2)">${esc(G.clubs[nextFx[1].opp].short)} (${nextFx[1].ha}) ${nextFx[0] - G.date === 0 ? "hari ini" : `dalam ${nextFx[0] - G.date} hari`}</span>` : ""}</div></div>
  <div class="card">${squadTable(G, club.squad)}</div>
  <div class="card" style="background:linear-gradient(180deg,rgba(40,120,80,.25),rgba(0,0,0,.2))"><div class="ch">Taktik</div><div class="muted" style="font-size:13px;margin-bottom:6px">Susunan terkuat saat ini · ${club.formation}</div>${formationPitch(G, xi.map(s => ({ ...s, name: s.p.ln, no: shirtNumber(G, s.p), pid: s.p.id, me: s.p.isUser })), club.colors)}</div>
  <div class="card"><div class="ch">Dinamika</div><b style="font-size:18px;color:${avgMor >= 62 ? "var(--good)" : avgMor >= 48 ? "var(--yel)" : "var(--bad)"}">${avgMor >= 62 ? "Bagus" : avgMor >= 48 ? "Cukup" : "Buruk"}</b><p class="muted" style="margin:4px 0 0;font-size:13.5px">${avgMor >= 62 ? "Ada rasa kesatuan yang baik di ruang ganti; hanya sedikit alasan bagi pemain untuk mengeluh." : avgMor >= 48 ? "Suasana ruang ganti cukup stabil, tapi beberapa pemain mulai gelisah." : "Ruang ganti sedang tidak kompak dan banyak pemain kecewa."}</p></div>`;
});
register("skuad", "muda", (G, root) => {
  const club = userClub(G);
  root.innerHTML = `<div class="card"><div class="row">${crest(club, 40)}<div><b style="font-size:18px">${esc(club.name)} U-19</b><div class="muted" style="font-size:13px">Pemain akademi (${club.youthSquad.length})</div></div></div></div><div class="card">${squadTable(G, club.youthSquad)}</div>`;
});

// ---------- KLUB ----------
function kits(c) {
  const [a, b] = c.colors;
  const third = ["#1d1f26", a];
  return `<div class="kits">${[["Kandang", [a, b]], ["Tandang", [b, a]], ["Ketiga", third]].map(([l, cl]) => `<div>${jersey(cl, "", 56)}${l}</div>`).join("")}</div>`;
}
register("klub", "ringkasan", (G, root, p) => {
  const c = G.clubs[p.club] || userClub(G);
  const L = G.leagues[c.league];
  const tb = L ? table(G, c.league) : [];
  const pos = tb.findIndex(r => r.id === c.id) + 1;
  const rep = clubReputation(c);
  const staff = staffOf(G, c.id);
  const trf = G.news.filter(n => (n.tag === "Transfer") && n.club === c.id).slice(0, 4);
  const last = [...clubMatchDays(G, c.id)].filter(([d, m]) => m.res).sort((a, b) => b[0] - a[0]).slice(0, 5);
  root.innerHTML = `<div class="phead"><div class="top">${crest(c, 72)}<div style="flex:1;min-width:0"><div class="nm">${esc(c.name)}</div><div class="sub">${flagEmoji(c.nation)} ${esc(NATIONS[c.nation].name)} · ${esc(L?.name || "")}</div></div></div>
    <div class="kv"><div><div class="k">Reputasi</div><div class="v"><span style="color:${REP_COLOR[rep]}">●</span> ${rep}</div></div><div><div class="k">Ekspektasi</div><div class="v">${esc(clubExpectation(G, c))}</div></div>
    ${L ? `<div><div class="k">Posisi liga</div><div class="v">ke-${pos} di ${esc(L.short)}</div></div><div><div class="k">Prediksi awal musim</div><div class="v">ke-${predictedFinish(G, c)}</div></div>` : ""}</div></div>
  <div class="card"><div class="ch">Info Klub</div><div class="kv" style="margin:0"><div><div class="k">Divisi</div><div class="v ${L ? "click" : ""}" ${L ? `data-league="${c.league}"` : ""}>${esc(L?.name || "Liga luar negeri")}</div></div><div><div class="k">Formasi</div><div class="v">${c.formation}</div></div><div><div class="k">Skuad senior</div><div class="v">${c.squad.length} pemain</div></div><div><div class="k">Akademi</div><div class="v">${c.youthSquad.length} pemain</div></div></div>
    ${clubComps(G, c)}
    ${last.length ? `<div class="lbl" style="margin-top:10px">Hasil terakhir</div><div class="row wrap" style="gap:4px;margin-top:4px">${last.map(([d, m]) => `<span class="tag" style="border-color:${m.res[0] > m.res[1] ? "var(--good)" : m.res[0] < m.res[1] ? "var(--bad)" : "#888"}">${m.res[0]}-${m.res[1]} ${esc(G.clubs[m.opp].short)}</span>`).join("")}</div>` : ""}</div>
  <div class="card"><div class="ch">Kostum</div>${kits(c)}</div>
  <div class="card"><div class="ch">Budaya</div>${clubCulture(c).map(t => `<div style="padding:3px 0">🔥 ${esc(t)}</div>`).join("")}</div>
  <div class="card"><div class="ch">Fasilitas</div>${facilities(c).map(([k, v]) => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${k}</span><span class="tag" style="border-color:var(--good);color:var(--good);background:rgba(120,200,90,.12)">${v}</span></div>`).join("")}</div>
  <div class="card"><div class="spread"><div class="ch" style="margin:0">Staf Klub</div><button class="btn sm ghost" data-go="klub/staf" data-p='${JSON.stringify({ club: c.id })}'>Semua staf</button></div>${staff.slice(0, 5).map(s => `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>${esc(s.name)}<div class="muted" style="font-size:12px">${esc(s.role)}</div></span><span>${natTag(s.nat)}</span></div>`).join("")}</div>
  <div class="card"><div class="ch">Riwayat Transfer</div>${trf.length ? trf.map(n => newsRow(G, n)).join("") : '<div class="muted">Belum ada transfer yang tercatat musim ini.</div>'}</div>
  ${c.id !== userP(G).club ? `<div class="card"><div class="ch">Skuad</div>${squadTable(G, c.squad)}</div>` : ""}`;
});
// cups and continental competitions the club is in this season
function clubComps(G, c) {
  const list = Object.values(G.comps).filter(x => x.kind !== "po" && !x.youth && x.teams.includes(c.id));
  if (!list.length) return "";
  return `<div class="lbl" style="margin-top:10px">Kompetisi musim ini</div>${list.map(x => {
    const out = x.stages.some(S => S.type === "ko" && S.ties.some(t => t.w && t.w !== c.id && (t.a === c.id || t.b === c.id))) || (x.stages.length > 1 && !x.stages.slice(1).some(S => S.ties?.some(t => t.a === c.id || t.b === c.id)) && x.stages[0].type !== "ko");
    const won = x.winner === c.id;
    return `<div class="spread click" data-go="kompetisi/ringkasan" data-p='${JSON.stringify({ comp: x.id })}' style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span class="row" style="gap:6px">${compBadge(x, 18)}${esc(x.name)}</span><span class="muted" style="font-size:12.5px">${won ? "🏆 Juara" : out ? "Tersingkir" : esc(compStatus(G, x))}</span></div>`;
  }).join("")}`;
}
register("klub", "staf", (G, root, p) => {
  const c = G.clubs[p.club] || userClub(G);
  root.innerHTML = `<div class="card"><div class="row" style="margin-bottom:8px">${crest(c, 32)}<div><b>${esc(c.name)}</b><div class="muted" style="font-size:13px">Semua Staf</div></div></div><div class="tscroll"><table class="tbl"><thead><tr><th></th><th>Nama</th><th>Jabatan</th><th class="n">Usia</th><th>Negara</th><th>Berakhir</th></tr></thead><tbody>
    ${staffOf(G, c.id).map(s => `<tr><td></td><td>${esc(s.name)}</td><td>${esc(s.role)}</td><td class="n">${s.age}</td><td>${natTag(s.nat)}</td><td>30/6/${s.until + 1}</td></tr>`).join("")}</tbody></table></div></div>`;
});
register("klub", "sejarah", (G, root, p) => {
  const c = G.clubs[p.club] || userClub(G);
  const hist = Object.values(G.leagues).flatMap(L => L.history.map(h => ({ L, s: h.season, label: h.label || seasonLabel(h.season), pos: h.table ? h.table.findIndex(r => r[0] === c.id) + 1 : null, pts: h.table ? (h.table.find(r => r[0] === c.id) || [])[1] : null, champ: h.champion === c.id, n: h.table?.length || 20, tier: L.tier }))).filter(h => h.pos).sort((a, b) => a.s - b.s);
  const cups = Object.values(G.comps).flatMap(x => x.history.filter(h => h.winner === c.id).map(h => ({ name: x.name, season: h.season })));
  let chart = '<div class="muted">Riwayat liga akan tampil setelah musim pertama selesai.</div>';
  if (hist.length >= 1) {
    const W = 320, H = 140, n = Math.max(...hist.map(h => h.n));
    const x = i => 26 + (hist.length === 1 ? (W - 40) / 2 : i * ((W - 40) / (hist.length - 1))), y = pos => 10 + ((pos - 1) / (n - 1)) * (H - 30);
    chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Posisi liga per musim"><line x1="22" y1="8" x2="22" y2="${H - 18}" stroke="#ccc"/><line x1="22" y1="${H - 18}" x2="${W - 6}" y2="${H - 18}" stroke="#ccc"/><text x="2" y="${y(1) + 4}" font-size="10" fill="#aaa">1</text><text x="2" y="${y(n) + 4}" font-size="10" fill="#aaa">${n}</text>
      <polyline fill="none" stroke="#bbb" stroke-width="1.5" points="${hist.map((h, i) => `${x(i)},${y(h.pos)}`).join(" ")}"/>${hist.map((h, i) => `<circle cx="${x(i)}" cy="${y(h.pos)}" r="4" fill="${h.champ ? "#f1c232" : "#ddd"}"/><text x="${x(i)}" y="${H - 4}" font-size="9" fill="#aaa" text-anchor="middle">${esc(String(h.label).replace(/^(\d\d)(\d\d)\/(\d\d)$/, "$2/$3").slice(-5))}</text>`).join("")}</svg>`;
  }
  root.innerHTML = `<div class="card"><div class="ch">Riwayat Liga</div>${chart}</div><div class="card"><div class="ch">Musim demi musim</div>${hist.length ? `<table class="tbl"><thead><tr><th>Musim</th><th>Divisi</th><th class="n">Posisi</th><th class="n">Poin</th></tr></thead><tbody>${hist.slice().reverse().map(h => `<tr><td>${esc(h.label)}</td><td>${esc(h.L.name)}</td><td class="n">${h.champ ? "🏆 " : ""}${h.pos}</td><td class="n">${h.pts ?? "-"}</td></tr>`).join("")}</tbody></table>` : '<div class="muted">Belum ada musim yang selesai.</div>'}</div>
  ${cups.length ? `<div class="card"><div class="ch">Gelar Piala</div>${cups.map(x => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🏆 ${esc(x.name)}</span><span class="muted">${esc(x.season)}</span></div>`).join("")}</div>` : ""}`;
});

// ---------- KOMPETISI ----------
function compHeader(G, L) {
  const champ = L.history[L.history.length - 1];
  const rounds = Math.max(...L.fixtures.map(f => f.r));
  const curR = (L.fixtures.find(f => !f.res) || { r: rounds }).r;
  const strip = L.fixtures.filter(f => f.r === curR || f.r === curR - 1).sort((a, b) => a.d - b.d);
  return `<div class="phead" style="background:linear-gradient(180deg,${L.color}aa,rgba(0,0,0,0))"><div class="top">${compBadge(L, 64)}<div style="flex:1"><div class="nm">${esc(L.name)}</div><div class="sub">🛡 ${L.teams.length} Klub · ${flagEmoji(L.nation)} ${esc(NATIONS[L.nation].name)}${L.tier === 2 ? " · Divisi 2" : ""}</div></div></div>
    <div class="kv"><div><div class="k">Juara Bertahan</div><div class="v">${champ ? `<span class="row" style="gap:6px">${crest(G.clubs[champ.champion], 16)}${esc(G.clubs[champ.champion].short)}</span>` : "-"}</div></div><div><div class="k">Musim</div><div class="v">${esc(leagueSeasonLabel(L))}</div></div></div></div>
  <div class="fxs">${strip.map(f => `<div class="fx"><div class="h"><span>${shortDay(f.d)}</span><span>${f.res ? "Waktu Normal" : "15:00"}</span></div><div class="tm click" data-club="${f.h}">${crest(G.clubs[f.h], 16)}<span>${esc(shortClub(G.clubs[f.h]))}</span><b>${f.res ? f.res[0] : ""}</b></div><div class="tm click" data-club="${f.a}">${crest(G.clubs[f.a], 16)}<span>${esc(shortClub(G.clubs[f.a]))}</span><b>${f.res ? f.res[1] : ""}</b></div></div>`).join("")}</div>`;
}
function leaguePlayers(G, L) { return L.teams.flatMap(id => G.clubs[id].squad.map(pid => G.players[pid])).filter(Boolean); }
function statList(G, title, list, val, n = 3) {
  return `<div style="margin-bottom:10px"><div style="font-weight:700;margin-bottom:4px">${title}</div>${list.slice(0, n).map(p => `<div class="spread click" data-pid="${p.id}" style="padding:4px 0;font-size:14px"><span class="row" style="gap:6px;min-width:0">${avatar(lookFor(p), G.clubs[p.club].colors, 26, 25)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(fullName(p))}</span></span><span>${val(p)}</span></div>`).join("") || '<div class="muted" style="font-size:13px">Tidak ada data yang tersedia</div>'}</div>`;
}
register("kompetisi", "ringkasan", (G, root, p) => {
  if (p.comp) return compRingkasan(G, root, p);
  const L = G.leagues[p.league || userClub(G).league] || G.leagues[Object.keys(G.leagues)[0]];
  const ps = leaguePlayers(G, L);
  const played = Math.max(0, ...L.fixtures.filter(f => f.res).map(f => f.r));
  const minR = Math.max(1, played * 0.4);
  const rated = ps.filter(q => q.st.rn >= minR).sort((a, b) => avgR(b.st) - avgR(a.st));
  // dream eleven: 4-3-3 by best average rating per slot group
  const pick = (pos, n, used) => rated.filter(q => !used.has(q.id) && (pos === "DEF" ? /^D|WB/.test(q.main) : pos === "MID" ? /^(DM|MC|MR|ML|AMC)$/.test(q.main) : pos === "ATT" ? /^(ST|AMR|AML)$/.test(q.main) : q.main === "GK")).slice(0, n);
  const used = new Set(); const xi = [];
  const F = FORMATIONS["4-3-3"];
  const take = (g, n, idx) => { const arr = pick(g, n, used); arr.forEach((q, k) => { used.add(q.id); xi.push({ p: q, pos: F[idx[k]][0], sx: F[idx[k]][1], sy: F[idx[k]][2] }); }); };
  take("GK", 1, [0]); take("DEF", 4, [1, 2, 3, 4]); take("MID", 3, [5, 6, 7]); take("ATT", 3, [8, 9, 10]);
  const teams = table(G, L.id);
  const tstat = (title, arr, val) => `<div style="margin-bottom:10px"><div style="font-weight:700;margin-bottom:4px">${title}</div>${arr.slice(0, 3).map(r => `<div class="spread click" data-club="${r.id}" style="padding:4px 0;font-size:14px"><span class="row" style="gap:6px">${crest(G.clubs[r.id], 20)}${esc(G.clubs[r.id].name)}</span><b class="num">${val(r)}</b></div>`).join("")}</div>`;
  const po = G.comps[L.id + "PO"];
  const poCard = po && po.season === L.season && (po.phase || null) === (L.phase || null) ? `<div class="card click" data-go="kompetisi/tahap" data-p='${JSON.stringify({ comp: po.id })}'><div class="spread"><b>Fase gugur ${esc(L.name)}</b><span class="muted">${esc(compStatus(G, po))} ›</span></div></div>` : "";
  root.innerHTML = compHeader(G, L) + poCard + `
  <div class="card">${heading(L.name, true)}${miniTable(G, L.id, { full: true })}</div>
  ${xi.length >= 11 ? `<div class="card">${heading("Dream Eleven Media", true)}${formationPitch(G, xi.map(s => ({ ...s, name: s.p.ln, no: shirtNumber(G, s.p), pid: s.p.id, me: s.p.isUser, rating: avgR(s.p.st) })), ["#1f2a6b", "#fff"])}</div>` : ""}
  <div class="card">${heading("Statistik Pemain", true)}
    ${statList(G, "Gol", ps.filter(q => q.st.gls).sort((a, b) => b.st.gls - a.st.gls), q => `<b class="num">${q.st.gls}</b>`)}
    ${statList(G, "Assist", ps.filter(q => q.st.ast).sort((a, b) => b.st.ast - a.st.ast), q => `<b class="num">${q.st.ast}</b>`)}
    ${statList(G, "Nilai Rata-Rata", rated, q => pill(avgR(q.st)))}
    ${statList(G, "Pemain Terbaik Pertandingan", ps.filter(q => q.st.pom).sort((a, b) => b.st.pom - a.st.pom), q => `<b class="num">${q.st.pom}</b>`)}
    ${statList(G, "Nirbobol", ps.filter(q => q.main === "GK" && q.st.cs).sort((a, b) => b.st.cs - a.st.cs), q => `<b class="num">${q.st.cs}</b>`)}</div>
  <div class="card">${heading("Statistik Tim", true)}
    ${tstat("Gol", teams.slice().sort((a, b) => b.gf - a.gf), r => r.gf)}
    ${tstat("Kebobolan Tersedikit", teams.filter(r => r.p).sort((a, b) => a.ga - b.ga), r => r.ga)}
    ${tstat("Kemenangan", teams.slice().sort((a, b) => b.w - a.w), r => r.w)}</div>
  <div class="card">${heading(`Berita ${L.name}`, true)}${G.news.filter(n => n.league === L.id || (n.club && G.clubs[n.club]?.league === L.id)).slice(0, 5).map(n => newsRow(G, n)).join("") || '<div class="empty">Tidak ada berita yang ditemukan</div>'}</div>`;
});
register("kompetisi", "jadwal", (G, root, p) => {
  if (p.comp) return compJadwal(G, root, p);
  const L = G.leagues[p.league || userClub(G).league] || G.leagues[Object.keys(G.leagues)[0]];
  const maxR = Math.max(...L.fixtures.map(f => f.r));
  const nextR = (L.fixtures.find(f => !f.res) || { r: maxR }).r;
  const r = p.r && p.r <= maxR && p.r >= 1 ? p.r : nextR;
  const fx = L.fixtures.filter(f => f.r === r).sort((a, b) => a.d - b.d);
  const u = userP(G);
  root.innerHTML = compHeader(G, L) + `<div class="card"><div class="spread" style="margin-bottom:6px"><button class="btn sm" data-r="${r - 1}" ${r <= 1 ? "disabled" : ""}>←</button><b class="disp" style="font-size:20px">Pekan ${r}</b><button class="btn sm" data-r="${r + 1}" ${r >= maxR ? "disabled" : ""}>→</button></div>
    <div class="muted" style="text-align:center;font-size:13px;margin-bottom:6px">${fx[0] ? fmt(fx[0].d) : ""}</div>
    ${fx.map(f => `<div class="vs ${f.h === u.club || f.a === u.club ? "me" : ""}" style="${f.h === u.club || f.a === u.club ? "background:rgba(108,43,217,.25);border-radius:4px" : ""}"><span class="l click" data-club="${f.h}">${esc(shortClub(G.clubs[f.h]))}</span><span class="row" style="gap:4px">${crest(G.clubs[f.h], 18)}<span class="g">${f.res ? f.res[0] : ""}</span></span><span class="v">V</span><span class="row" style="gap:4px"><span class="g">${f.res ? f.res[1] : ""}</span>${crest(G.clubs[f.a], 18)}</span><span class="r click" data-club="${f.a}">${esc(shortClub(G.clubs[f.a]))}</span></div>`).join("")}</div>`;
  $$("[data-r]", root).forEach(b => (b.onclick = () => go("kompetisi", "jadwal", { ...p, r: +b.dataset.r }, true)));
});
register("kompetisi", "statistik", (G, root, p) => {
  if (p.comp) return compRingkasan(G, root, p);
  const L = G.leagues[p.league || userClub(G).league] || G.leagues[Object.keys(G.leagues)[0]];
  const ps = leaguePlayers(G, L);
  const k = p.k || "gls";
  const KEYS = [["gls", "Gol"], ["ast", "Assist"], ["rat", "Rata-rata"], ["pom", "PTP"], ["cs", "Nirbobol"], ["yc", "Kartu Kuning"]];
  const val = q => (k === "rat" ? avgR(q.st) : q.st[k]);
  const played = Math.max(0, ...L.fixtures.filter(f => f.res).map(f => f.r));
  const list = ps.filter(q => (k === "rat" ? q.st.rn >= Math.max(1, played * 0.4) : q.st[k] > 0) && (k !== "cs" || q.main === "GK")).sort((a, b) => val(b) - val(a)).slice(0, 25);
  const u = userP(G);
  root.innerHTML = compHeader(G, L) + `<div class="card"><div class="hscroll" style="margin-bottom:10px">${KEYS.map(([kk, l]) => `<button class="btn sm ${k === kk ? "sel" : ""}" data-k="${kk}">${l}</button>`).join("")}</div>
    <table class="tbl"><thead><tr><th class="n">#</th><th>Pemain</th><th>Klub</th><th class="n">Main</th><th class="n">${KEYS.find(x => x[0] === k)[1]}</th></tr></thead><tbody>
    ${list.map((q, i) => `<tr class="click ${q.id === u.id ? "me" : ""}" data-pid="${q.id}"><td class="n">${i + 1}</td><td>${esc(shortName(q))}</td><td>${esc(G.clubs[q.club].short)}</td><td class="n">${q.st.apps + q.st.sub}</td><td class="n"><b>${k === "rat" ? pill(val(q)) : val(q)}</b></td></tr>`).join("") || '<tr><td colspan="5" class="muted">Belum ada data.</td></tr>'}</tbody></table></div>`;
  $$("[data-k]", root).forEach(b => (b.onclick = () => go("kompetisi", "statistik", { ...p, k: b.dataset.k }, true)));
});
register("kompetisi", "sejarah", (G, root, p) => {
  if (p.comp) return compSejarah(G, root, p);
  const L = G.leagues[p.league || userClub(G).league] || G.leagues[Object.keys(G.leagues)[0]];
  root.innerHTML = compHeader(G, L) + `<div class="card">${heading("Pemenang Sebelumnya", true)}${L.history.length ? `<table class="tbl"><thead><tr><th>Tahun</th><th>Juara</th><th>Runner-Up</th><th>Top Skor</th></tr></thead><tbody>${L.history.slice().reverse().map(h => `<tr><td>${esc(h.label || seasonLabel(h.season))}</td><td><span class="row click" style="gap:6px" data-club="${h.champion}">${crest(G.clubs[h.champion], 18)}${esc(shortClub(G.clubs[h.champion]))}</span></td><td><span class="row" style="gap:6px">${crest(G.clubs[h.runnerUp], 18)}${esc(shortClub(G.clubs[h.runnerUp]))}</span></td><td>${h.topScorer && G.players[h.topScorer] ? `${esc(shortName(G.players[h.topScorer]))} (${h.topGoals})` : `${h.topGoals ?? "-"} gol`}</td></tr>`).join("")}</tbody></table>` : '<div class="muted">Juara pertama akan tercatat di akhir musim ini.</div>'}</div>
    <div class="card">${heading("Tim", true)}<table class="tbl"><thead><tr><th>Tim</th><th>Reputasi</th></tr></thead><tbody>${L.teams.map(id => G.clubs[id]).sort((a, b) => a.name.localeCompare(b.name)).map(c => `<tr class="click" data-club="${c.id}"><td><span class="row" style="gap:6px">${crest(c, 20)}${esc(c.name)}</span></td><td><span style="color:${REP_COLOR[clubReputation(c)]}">●</span> ${clubReputation(c)}</td></tr>`).join("")}</tbody></table></div>`;
});
register("kompetisi", "tahap", (G, root, p) => compTahap(G, root, p));
