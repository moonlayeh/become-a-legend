// Player profile (any player), Latihan (individual training, calendar, medical centre)
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, pill1, stars, avatar, lookFor, natTag, flagEmoji, heading, toast, moneyShort, attrClass, bars, shortDay, jersey } from "./core.js";
import { NATIONS, POS_LABEL } from "../data.js";
import { ATTRS, A, GROUPS } from "../attributes.js";
import { fmt, fmtDay, ymd, ageOn, seasonLabel, BULAN } from "../calendar.js";
import { userP, userClub, FOCUS_LIST, weeksLabel } from "../world.js";
import { fullName, shortName, personality, marketValue } from "../player.js";
import { squadStatus, coachReport, fed, fmtM } from "../career.js";
import { canSwitch } from "../intl.js";
import { shirtNumber } from "../sim.js";
import { ROLES, roleStars, bestRole, attrHighlights, positionString, PITCH_XY, famWord, FAM_WORDS, reputation, REP_COLOR, footWord, footLevel, fitnessWord, moraleWord, moraleFace, severity, severityWord, returnRange, clubMatchDays } from "../meta.js";
import { STYLES } from "../world.js";

const FOCUS_ATTRS = {
  Teknik: ["dri", "fir", "tec", "pas", "cro"], Penyelesaian: ["fin", "cmp", "otb", "lon", "hea"], Kreatif: ["vis", "pas", "fla", "dec", "tec"],
  Bertahan: ["tck", "mar", "pos", "ant", "cnt", "hea"], Fisik: ["str", "sta", "pac", "acc", "agi", "jum", "nat"], Mental: ["dec", "cmp", "ant", "cnt", "tea", "wor", "ldr"],
  "Bola Mati": ["fre", "cor", "pen", "lth", "cro"], Kiper: ["ref", "han", "ovo", "aer", "cmd", "kic", "rus"],
};
const avgR = st => (st.rn ? st.rsum / st.rn : null);
const sumStats = (...a) => a.reduce((t, s) => { for (const k of Object.keys(s)) t[k] = (t[k] || 0) + s[k]; return t; }, {});

export function attrGrid(p, hl = {}, focus = new Set(), changes = {}) {
  const groups = p.main === "GK" ? ["K", "M", "F"] : ["T", "M", "F"];
  const extra = p.main === "GK" ? [["pen", "fre", "tec"].map(k => A[k])] : null;
  const col = g => `<div class="attrcol"><h4>${g === "K" ? "Kemampuan Jaga Gawang" : GROUPS[g]}</h4>${ATTRS.map((a, i) => [a, i]).filter(([a]) => a[2] === g).map(([a, i]) => {
    const v = Math.round(p.a[i]);
    const cls = hl.key?.has(i) ? "key" : hl.pref?.has(i) ? "pref" : focus.has(i) ? "focus" : "";
    const ch = changes[i];
    return `<div class="ar ${cls}"><span>${esc(a[1])}</span><b class="${attrClass(v)}">${v}${ch ? `<span class="chg ${ch > 0 ? "up" : "dn"}">${ch > 0 ? "▲" : "▼"}</span>` : ""}</b></div>`;
  }).join("")}${g === "F" && extra ? `<h4 style="margin-top:8px">Teknis</h4>${extra[0].map(i => { const v = Math.round(p.a[i]); return `<div class="ar"><span>${esc(ATTRS[i][1])}</span><b class="${attrClass(v)}">${v}</b></div>`; }).join("")}` : ""}</div>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:10px">${groups.map(col).join("")}</div>`;
}
export function posPitch(p, showLegend = true) {
  const dots = Object.entries(PITCH_XY).map(([k, [x, y]]) => {
    const f = p.positions[k] || 0;
    const [, , col] = famWord(f || 1);
    return `<div class="dot ${f >= 18 ? "on" : ""}" title="${k}" style="left:${x}%;top:${y}%;${f ? `background:${col}` : ""}"></div>`;
  }).join("");
  return `<div class="minipitch"><div class="box" style="top:0"></div><div class="box" style="bottom:0"></div>${dots}</div>${showLegend ? `<div class="legend" style="justify-content:center">${FAM_WORDS.map(([, w, c]) => `<span><i style="background:${c};width:8px;height:8px;border-radius:50%"></i>${w}</span>`).join("")}</div>` : ""}`;
}
const intlLine = (G, p) => {
  if (!p.isUser) return p.caps ? `${p.caps} penampilan` : "Belum Pernah Tampil";
  const caps = p.caps || 0, yc = Object.values(G.user.int.youth || {}).reduce((s, x) => s + x, 0);
  return caps ? `${caps} penampilan, ${p.intGoals || 0} gol` : yc ? `Belum pernah tampil senior · ${yc} laga usia muda` : "Belum Pernah Tampil";
};

function header(G, p) {
  const club = G.clubs[p.club];
  const age = ageOn(p.birth, G.date);
  const rep = club ? coachReport(G, p) : { ca: 0, pa: 0 };
  const v = marketValue(p, G.date, club?.league) * 1e6;
  const status = p.isUser ? squadStatus(G, p) : p.squad === "Y" ? "Pemain Akademi" : squadStatus(G, p);
  const natLabel = p.isUser && p.nat2 ? `${natTag(p.nat)} ${natTag(p.nat2)}` : natTag(p.nat);
  return `<div class="phead">
    <div class="top">${avatar(lookFor(p), club?.colors || ["#333", "#fff"], 84, age)}<div style="min-width:0;flex:1">
      <div class="nm">${esc(fullName(p))}${club ? `<span class="no">${shirtNumber(G, p)}</span>` : ""}</div>
      <div class="sub">${esc(POS_LABEL[p.main])}</div>
      <div class="sub" style="margin-top:2px">${natLabel} · ${age} tahun (${fmt(p.birth)})</div>
      <div class="row wrap" style="margin-top:6px;gap:4px">${p.injury ? `<span class="chip inj">✚ ${esc(p.injury.name)}</span>` : ""}${p.ban > 0 ? `<span class="chip ban">Skorsing ${p.ban}</span>` : ""}${p.away ? '<span class="chip nt">Timnas</span>' : ""}${p.isUser && G.user.loan ? '<span class="chip loan">Pinjaman</span>' : ""}</div>
    </div></div>
    <div class="kv">
      <div class="click" ${club ? `data-club="${club.id}"` : ""}><div class="k">Klub</div><div class="v"><span class="row" style="gap:6px">${club ? crest(club, 18) : ""}${esc(club?.name || "Tanpa klub")}</span></div><div class="k">${esc(club ? G.leagues[club.league]?.name || "" : "")}</div></div>
      <div><div class="k">Timnas ${p.isUser ? NATIONS[fed(G)].name : NATIONS[p.nat].name}</div><div class="v">${intlLine(G, p)}</div></div>
      <div><div class="k">Nilai pasar</div><div class="v">${moneyShort(v * 0.6)} – ${moneyShort(v * 1.5)}</div></div>
      <div><div class="k">Kontrak</div><div class="v">${p.contract?.youth ? "Kontrak akademi" : `${moneyShort(p.contract?.wage || 0)} p/mgg`}</div><div class="k">s.d. 30/6/${(p.contract?.end || 0) + 1}</div></div>
      <div><div class="k">Status</div><div class="v">${esc(status)}</div></div>
      <div><div class="k">Kemampuan · Potensi</div><div>${stars(rep.ca, "Kemampuan ")} ${stars(rep.pa, "Potensi ")}</div></div>
    </div></div>`;
}

// ---------- PEMAIN / RINGKASAN ----------
register("pemain", "ringkasan", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  const own = p.isUser;
  const roles = ROLES[p.main] || [];
  const roleName = prm.role || (own && G.user.training.role) || bestRole(p)?.name;
  const role = roles.find(r => r.name === roleName) || roles[0];
  const hl = attrHighlights(p, role);
  const st = own ? sumStats(G.user.cs.liga, G.user.cs.u19, G.user.cs.timnas) : p.st;
  const tr = own ? G.user.trainRatings || [] : [];
  const trAvg = tr.length ? tr.slice(-4).reduce((s, x) => s + x, 0) / Math.min(4, tr.length) : null;
  const form = p.form.slice(-5);
  const formAvg = form.length ? form.reduce((s, x) => s + x, 0) / form.length : null;
  const clubsN = own ? new Set([...(G.user.history || []).map(h => h.club), p.club]).size : 1;
  const totApps = own ? (G.user.history || []).reduce((s, h) => s + h.apps + h.sub + (h.u19?.apps || 0), 0) + st.apps + st.sub : st.apps + st.sub;
  const totGls = own ? (G.user.history || []).reduce((s, h) => s + h.gls + (h.u19?.gls || 0), 0) + st.gls : st.gls;
  const traits = own ? (G.user.styles || []).map(k => STYLES[k]?.label).filter(Boolean) : [];
  const yc = p.ycCount || 0;
  root.innerHTML = header(G, p) + `
  <div class="card"><div class="spread"><div><div class="lbl">Posisi</div><b>${esc(positionString(p))}</b></div><span class="muted" style="font-size:13px">${esc(POS_LABEL[p.main])}</span></div>
    <div style="margin:10px 0">${posPitch(p)}</div>
    <div class="lbl" style="margin-top:6px">Peran · Kemampuan</div>
    ${roles.map(r => `<button class="clubrow" data-role="${esc(r.name)}" aria-pressed="${r === role}"><span class="rad"></span>${stars(roleStars(p, r))}<span>${esc(r.name)}</span></button>`).join("")}
  </div>
  <div class="card">${attrGrid(p, hl)}<div class="legend" style="justify-content:center"><span><i style="background:var(--good)"></i>Kunci</span><span><i style="background:var(--blue)"></i>Lebih Disukai</span></div></div>
  <div class="card"><div class="ch">Info</div><div class="kv" style="margin:0">
    <div><div class="k">Tinggi / berat</div><div class="v">${p.height} cm / ${p.weight} kg</div></div>
    <div><div class="k">Reputasi</div><div class="v"><span style="color:${REP_COLOR[reputation(G, p)]}">●</span> ${reputation(G, p)}</div></div>
    <div><div class="k">Kepribadian</div><div class="v">${esc(personality(p))}</div></div>
    <div><div class="k">Sifat</div><div class="v" style="white-space:normal">${traits.length ? esc(traits.join(", ")) : "T/A"}</div></div>
    ${own ? `<div><div class="k">Bahasa</div><div class="v" style="white-space:normal">${esc((p.langs || []).join(", "))}</div></div><div><div class="k">Tempat lahir</div><div class="v">${esc(p.birthplace || "-")}</div></div>` : ""}
    ${footBlock(p)}
  </div>
  <div class="ch" style="font-size:14px;margin-top:12px">Larangan Bermain</div>
  <div class="spread" style="font-size:13.5px"><span>${esc(G.leagues[G.clubs[p.club]?.league]?.name || "Liga")}</span><span class="row">${yc % 5}/5 ${bars(yc % 5, 5, "y")}</span></div>
  ${p.ban > 0 ? `<div style="color:var(--bad);font-size:13.5px;margin-top:4px">Skorsing ${p.ban} laga</div>` : ""}</div>
  <div class="bcards">
    <div class="bcard"><div class="ch">Kebahagiaan</div><div style="font-size:24px">${moraleFace(p.morale ?? 65)}</div><div class="big">${moraleWord(p.morale ?? 65)}</div></div>
    <div class="bcard"><div class="ch">Kebugaran</div><div style="font-size:22px;color:${p.injury ? "var(--bad)" : "var(--good)"}">${p.injury ? "✚" : "♥"}</div><div class="big">${p.injury ? "Cedera" : fitnessWord(p.cond)}</div><div class="muted" style="font-size:12.5px">${p.injury ? `Kembali ${returnRange(p.injury.days)}` : `Ketajaman ${Math.round(p.sharp ?? 60)}%`}</div></div>
    <div class="bcard"><div class="ch">Performa</div>${formAvg != null ? pill(formAvg) : pill(null)}<div class="big" style="margin-top:6px">${formAvg == null ? "Belum ada data yang tersedia" : formAvg >= 7.3 ? "Sangat baik" : formAvg >= 6.9 ? "Baik" : formAvg >= 6.5 ? "Cukup" : "Buruk"}</div></div>
    <div class="bcard"><div class="ch">Latihan</div>${own ? `<div class="big">${esc(G.user.training.focus)}</div><div class="lbl" style="margin-top:4px">Nilai Latihan</div>${pill(trAvg)}` : `<div class="big">Tidak Tersedia</div>`}</div>
  </div>
  <div class="card" style="margin-top:10px"><div class="ch">Statistik Musim${own ? " (semua kompetisi)" : ""}</div>${st.apps + st.sub ? `<div class="grid3" style="text-align:center"><div><div class="lbl">Main</div><b class="disp" style="font-size:24px">${st.apps}${st.sub ? `<small style="font-size:14px">(${st.sub})</small>` : ""}</b></div><div><div class="lbl">${p.main === "GK" ? "Nirbobol" : "Gol"}</div><b class="disp" style="font-size:24px">${p.main === "GK" ? st.cs : st.gls}</b></div><div><div class="lbl">Rata2</div>${pill(avgR(st))}</div></div>` : '<div class="muted">Belum Ada Laga yang Dimainkan</div>'}</div>
  <div class="card"><div class="ch">Statistik Karier</div><div class="spread" style="font-size:13.5px"><span><span class="lbl">Klub</span> <b>${clubsN}</b></span><span><span class="lbl">Penampilan</span> <b>${totApps}</b></span><span><span class="lbl">Gol</span> <b>${totGls}</b></span></div>
    ${own ? (G.user.history || []).slice(-4).reverse().map(h => `<div class="spread" style="font-size:13.5px;padding:5px 0;border-top:1px solid var(--line)"><span>${h.season.slice(2)}</span><span class="row" style="gap:6px;flex:1;margin-left:10px">${crest(G.clubs[h.club], 16)}${esc(h.clubName)}</span><span class="num">${h.apps + h.sub}</span><span class="num" style="width:28px;text-align:right">${h.gls}</span></div>`).join("") : ""}</div>`;
  $$("[data-role]", root).forEach(b => (b.onclick = () => {
    if (own) { G.user.training.role = b.dataset.role; save(); }
    go("pemain", "ringkasan", { ...prm, role: b.dataset.role }, true);
  }));
});
function footBlock(p) {
  const wf = p.wf ?? 8;
  const left = p.foot === "Kiri" ? 20 : p.foot === "Dua kaki" ? Math.max(wf, 17) : wf;
  const right = p.foot === "Kanan" ? 20 : p.foot === "Dua kaki" ? 20 : wf;
  const blk = (lbl, v) => `<div><div class="k">${lbl}</div><div class="v">${footWord(v)}</div>${bars(footLevel(v), 6, v >= 15 ? "g" : "y")}</div>`;
  return blk("Kaki Kiri", left) + blk("Kaki Kanan", right);
}

// ---------- PEMAIN / PERFORMA ----------
register("pemain", "performa", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  const own = p.isUser;
  const row = (k, s) => `<tr><td>${k}</td><td class="n">${s.apps}${s.sub ? ` (${s.sub})` : ""}</td><td class="n">${s.min}</td><td class="n">${s.gls}</td><td class="n">${s.ast}</td><td class="n">${s.pom || 0}</td><td class="n">${s.yc}</td><td>${pill(avgR(s))}</td></tr>`;
  const cs = own ? G.user.cs : null;
  const league = G.leagues[G.clubs[p.club]?.league]?.name || "Liga";
  root.innerHTML = header(G, p) + `<div class="card"><div class="ch">Statistik Musim ${seasonLabel(G.season)}</div><div class="tscroll"><table class="tbl"><thead><tr><th>Kompetisi</th><th class="n">Main</th><th class="n">Menit</th><th class="n">Gol</th><th class="n">Ast</th><th class="n">PTP</th><th class="n">KK</th><th>Rata2</th></tr></thead><tbody>
    ${own ? `${row(esc(league), cs.liga)}${cs.u19.apps + cs.u19.sub ? row("Liga U-19", cs.u19) : ""}${cs.timnas.apps + cs.timnas.sub ? row("Timnas", cs.timnas) : ""}` : row(esc(league), p.st)}
  </tbody></table></div><div class="muted" style="font-size:12px;margin-top:6px">PTP = pemain terbaik pertandingan</div></div>
  ${own ? `<div class="card"><div class="ch">Laga Terakhir</div>${(G.user.matchLog || []).length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Tgl</th><th>Lawan</th><th class="c">K/T</th><th class="c">Skor</th><th class="n">Mnt</th><th class="n">G</th><th class="n">A</th><th>Rating</th></tr></thead><tbody>${G.user.matchLog.slice(0, 15).map(m => `<tr><td>${shortDay(m.date)}</td><td>${esc(m.opp)}<div class="muted" style="font-size:11.5px">${esc(m.comp)}</div></td><td class="c">${m.ha}</td><td class="c"><span class="tag" style="border-color:${m.score[0] > m.score[1] ? "var(--good)" : m.score[0] < m.score[1] ? "var(--bad)" : "#888"}">${m.score[0]}-${m.score[1]}</span></td><td class="n">${m.min}</td><td class="n">${m.gls || ""}</td><td class="n">${m.ast || ""}</td><td>${pill1(m.rating)}${m.pom ? " ★" : ""}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty">Belum ada laga.</div>'}</div>
  <div class="card"><div class="ch">Grafik Rating</div>${ratingChart(G.user.matchLog || [])}</div>` : ""}`;
});
function ratingChart(log) {
  const pts = log.slice(0, 20).reverse();
  if (pts.length < 2) return '<div class="muted">Butuh minimal dua laga.</div>';
  const W = 320, H = 120, x = i => 20 + i * ((W - 30) / (pts.length - 1)), y = r => H - 14 - ((r - 5) / 5) * (H - 24);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating ${pts.length} laga terakhir">${[6, 7, 8, 9].map(v => `<line x1="20" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="2" y="${y(v) + 4}" font-size="9" fill="#888">${v}</text>`).join("")}<polyline fill="none" stroke="#c5d84a" stroke-width="2" points="${pts.map((m, i) => `${x(i)},${y(m.rating)}`).join(" ")}"/>${pts.map((m, i) => `<circle cx="${x(i)}" cy="${y(m.rating)}" r="3" fill="${m.rating >= 7.5 ? "#8fd14f" : m.rating >= 6.5 ? "#d8c94a" : "#e08a4a"}"/>`).join("")}</svg>`;
}

// ---------- PEMAIN / KARIER ----------
register("pemain", "karier", (G, root, prm) => {
  const p = G.players[prm.pid] || userP(G);
  if (!p.isUser) { root.innerHTML = header(G, p) + `<div class="card"><div class="ch">Karier</div><table class="tbl"><tbody><tr><td>${seasonLabel(G.season)}</td><td>${esc(G.clubs[p.club]?.name || "")}</td><td class="n">${p.st.apps + p.st.sub}</td><td class="n">${p.st.gls}</td></tr></tbody></table><p class="muted" style="font-size:13px">Riwayat lengkap hanya dicatat untuk kariermu sendiri.</p></div>`; return; }
  const u = G.user, H = u.history;
  const sw = canSwitch(G);
  const caps = p.caps || 0;
  root.innerHTML = header(G, p) + `
  <div class="card"><div class="ch">Riwayat Musim</div>${H.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th>Musim</th><th>Klub</th><th class="n">Main</th><th class="n">Gol</th><th class="n">Ast</th><th>Rata2</th><th>Catatan</th></tr></thead><tbody>${H.map(h => `<tr><td>${h.season}</td><td><span class="row" style="gap:6px">${crest(G.clubs[h.club], 18)}${esc(h.clubName)}${h.loan ? " (P)" : ""}</span><div class="muted" style="font-size:11.5px">${esc(h.league)}${h.pos ? ` · ke-${h.pos}` : ""}</div></td><td class="n">${h.apps}${h.sub ? ` (${h.sub})` : ""}</td><td class="n">${h.gls}</td><td class="n">${h.ast}</td><td>${pill(h.rating)}</td><td style="font-size:12.5px;white-space:normal;min-width:140px">${[h.u19 ? `U-19: ${h.u19.apps} laga, ${h.u19.gls} gol` : "", h.intl ? `Timnas: ${h.intl.apps} laga, ${h.intl.gls} gol` : "", h.ballon ? `Bola Emas #${h.ballon}` : "", ...h.notes].filter(Boolean).map(esc).join(" · ")}</td></tr>`).join("")}</tbody></table></div>` : '<div class="muted">Musim pertama belum selesai.</div>'}</div>
  <div class="card"><div class="ch">Trofi</div>${u.trophies.map(t => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🏆 ${esc(t.name)} <span class="muted">· ${esc(t.club)}</span></span><span class="num muted">${esc(t.year)}</span></div>`).join("") || '<div class="muted">Belum ada trofi.</div>'}</div>
  <div class="card"><div class="ch">Penghargaan</div>${u.awards.map(t => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🎖 ${esc(t.name)}${t.detail ? ` <span class="muted">· ${esc(t.detail)}</span>` : ""}</span><span class="num muted">${esc(t.year)}</span></div>`).join("") || '<div class="muted">Belum ada penghargaan.</div>'}</div>
  <div class="card"><div class="ch">Timnas</div><div class="kv" style="margin:0">
    <div><div class="k">Federasi</div><div class="v">${flagEmoji(fed(G))} ${esc(NATIONS[fed(G)].name)}</div></div>
    <div><div class="k">Senior</div><div class="v">${caps} laga, ${p.intGoals || 0} gol</div></div>
    ${Object.entries(u.int.youth || {}).map(([k, v]) => `<div><div class="k">${esc(k)}</div><div class="v">${v} laga</div></div>`).join("")}
    ${u.debut ? `<div><div class="k">Debut senior</div><div class="v">${fmt(u.debut.date)} vs ${esc(NATIONS[u.debut.opp]?.name || "")}</div></div>` : ""}
  </div>${p.nat2 ? `<div class="muted" style="font-size:13px;margin-top:8px">Kewarganegaraan ganda: ${esc(NATIONS[p.nat].name)} & ${esc(NATIONS[p.nat2].name)}. ${sw.ok ? "Kamu masih bisa pindah federasi (sekali) bila dipanggil negara lain." : esc(sw.why)}</div>` : ""}</div>
  <div class="card"><div class="ch">Perpindahan</div>${(u.moves || []).map(m => `<div style="padding:5px 0;border-top:1px solid var(--line);font-size:14px">${fmt(m.date)} · ${esc(G.clubs[m.from]?.short || "")} → <b>${esc(G.clubs[m.to]?.name || "")}</b> <span class="muted">${m.type === "loan" ? "pinjaman" : m.fee ? "€" + fmtM(m.fee) : "gratis"}</span></div>`).join("") || '<div class="muted">Belum pernah pindah klub.</div>'}</div>
  <div class="card"><div class="ch">Riwayat Cedera</div>${(u.injuries || []).slice().reverse().slice(0, 10).map(i => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>${esc(i.name)}</span><span class="muted">${fmt(i.date)} · ${weeksLabel(i.days)}</span></div>`).join("") || '<div class="muted">Belum pernah cedera.</div>'}</div>`;
});

// ---------- LATIHAN / INDIVIDU ----------
register("latihan", "individu", (G, root, prm) => {
  const p = userP(G);
  const view = prm.v || "atribut";
  const rep = coachReport(G, p);
  const tr = G.user.trainRatings || [];
  const trAvg = tr.length ? tr.slice(-4).reduce((s, x) => s + x, 0) / Math.min(4, tr.length) : null;
  const roles = ROLES[p.main] || [];
  const role = roles.find(r => r.name === G.user.training.role) || bestRole(p);
  const hl = attrHighlights(p, role);
  const focus = new Set((FOCUS_ATTRS[G.user.training.focus] || []).map(k => A[k]));
  // last monthly report changes
  const lastRep = G.inbox.find(m => m.changes);
  const ch = {}; if (lastRep) for (const c of lastRep.changes) { const i = ATTRS.findIndex(a => a[1] === c.name); if (i >= 0) ch[i] = c.to - c.from; }
  const prog = G.inbox.filter(m => m.changes).slice(0, 6);
  root.innerHTML = `<div class="card"><div class="row">${avatar(lookFor(p), userClub(G).colors, 56, ageOn(p.birth, G.date))}<div style="flex:1;min-width:0"><b style="font-size:18px">${shirtNumber(G, p)}. ${esc(fullName(p))}</b><div class="muted" style="font-size:13.5px">Berusia ${ageOn(p.birth, G.date)} tahun · ${esc(POS_LABEL[p.main].toLowerCase())}</div></div></div>
    <div class="grid2" style="margin-top:10px;font-size:13.5px">
      <div><div class="lbl">Kemampuan Saat Ini</div>${stars(rep.ca)}</div><div><div class="lbl">Potensi</div>${stars(rep.pa)}</div>
      <div><div class="lbl">Beban Latihan</div><b>${{ Rendah: "Ringan", Normal: "Sedang", Tinggi: "Berat" }[G.user.training.intensity]}</b></div><div><div class="lbl">Nilai Latihan</div>${pill(trAvg)}</div>
    </div></div>
  <div class="card"><div style="display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:start"><div>${posPitch(p, false)}</div><div style="font-size:12.5px">${FAM_WORDS.map(([, w, c]) => `<div><span style="color:${c}">●</span> ${w}</div>`).join("")}</div></div>
    <label class="fld" style="margin-top:12px"><span class="lbl">Fokus Latihan Individu</span><select id="t-focus">${FOCUS_LIST.filter(f => p.main === "GK" || f !== "Kiper").map(f => `<option ${G.user.training.focus === f ? "selected" : ""}>${f}</option>`).join("")}</select></label>
    <label class="fld"><span class="lbl">Intensitas Latihan</span><select id="t-int">${[["Rendah", "Intensitas Rendah"], ["Normal", "Intensitas Normal"], ["Tinggi", "Intensitas Tinggi"]].map(([k, l]) => `<option value="${k}" ${G.user.training.intensity === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <label class="fld" style="margin:0"><span class="lbl">Peran yang Dilatih</span><select id="t-role">${roles.map(r => `<option ${r === role ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
    <p class="muted" style="font-size:12.5px;margin:8px 0 0">Intensitas tinggi mempercepat perkembangan, tapi menguras kondisi dan menaikkan risiko cedera.</p></div>
  <div class="card"><div class="seg" style="margin-bottom:10px"><button data-v="atribut" aria-pressed="${view === "atribut"}">Atribut</button><button data-v="laporan" aria-pressed="${view === "laporan"}">Laporan Pelatih</button></div>
    ${view === "atribut" ? `${attrGrid(p, hl, focus, ch)}<div class="legend" style="justify-content:center"><span><i style="background:var(--good)"></i>Kunci</span><span><i style="background:var(--blue)"></i>Lebih Disukai</span><span><i style="background:var(--amb)"></i>Fokus</span></div>` : `
      <p style="margin:0 0 10px">${esc(rep.text)}</p>
      <div class="ch" style="font-size:14px">Laporan Progres</div>${prog.length ? prog.map(m => `<div style="padding:6px 0;border-top:1px solid var(--line);font-size:13.5px"><div class="muted">${fmt(m.date)}</div>${m.changes.map(c => `<span class="tag" style="margin:3px 3px 0 0;border-color:${c.to > c.from ? "var(--good)" : "var(--bad)"};color:${c.to > c.from ? "var(--good)" : "var(--bad)"}">${esc(c.name)} ${c.from}→${c.to}</span>`).join("")}</div>`).join("") : '<div class="muted">Tidak ada data perkembangan yang tersedia.</div>'}
      <div class="ch" style="font-size:14px;margin-top:12px">Nilai Latihan Mingguan</div>${tr.length ? `<div class="row wrap">${tr.slice(-8).map(v => pill(v)).join("")}</div>` : '<div class="muted">Belum ada.</div>'}`}
  </div>`;
  $("#t-focus", root).onchange = e => { G.user.training.focus = e.target.value; save(); toast("Fokus latihan diubah."); render(); };
  $("#t-int", root).onchange = e => { G.user.training.intensity = e.target.value; save(); render(); };
  $("#t-role", root).onchange = e => { G.user.training.role = e.target.value; save(); render(); };
  $$("[data-v]", root).forEach(b => (b.onclick = () => go("latihan", "individu", { v: b.dataset.v }, true)));
});
register("latihan", "kalender", (G, root, prm) => S.screens["portal/kalender"](G, root, { ...prm, mode: "latihan" }));

// ---------- LATIHAN / PUSAT MEDIS ----------
register("latihan", "medis", (G, root) => {
  const club = userClub(G);
  const md = clubMatchDays(G, club.id);
  const ids = [...club.squad, ...club.youthSquad];
  const ps = ids.map(id => G.players[id]).filter(Boolean);
  const inj = ps.filter(p => p.injury).sort((a, b) => b.injury.days - a.injury.days);
  const target = p => { const back = G.date + p.injury.days; const f = [...md].filter(([d, x]) => d >= back && !x.res).sort((a, b) => a[0] - b[0])[0]; return f; };
  const risk = ps.filter(p => !p.injury && (p.cond < 75 || p.hid.inj >= 16));
  const recent = ps.filter(p => p.backOn && G.date - p.backOn <= 14);
  root.innerHTML = `<div class="card"><div class="ch">Cedera Saat Ini</div>${inj.length ? inj.map(p => {
    const f = target(p), sev = severity(p.injury.total || p.injury.days);
    return `<div class="li click" data-pid="${p.id}" style="align-items:flex-start;border-top:1px solid var(--line)">${avatar(lookFor(p), club.colors, 40, ageOn(p.birth, G.date))}<div class="grow"><div class="t">${esc(fullName(p))}${p.isUser ? ' <span class="chip me">Kamu</span>' : ""}</div><div class="s">${esc(p.squad === "Y" ? "Pemain Akademi" : squadStatus(G, p))}</div>
      <div style="font-size:13.5px;margin-top:4px">${esc(p.injury.name)} <span class="muted">· ${weeksLabel(p.injury.total || p.injury.days)}</span></div>
      <div class="row" style="gap:10px;margin-top:4px;font-size:12.5px"><span>${severityWord(p.injury.total || p.injury.days)} ${bars(sev, 4, "r")}</span><span class="muted">${(p.injury.total || 0) >= 21 ? "Spesialis" : "Fisioterapis"}</span></div>
      ${f ? `<div class="muted" style="font-size:12.5px;margin-top:2px">Target: ${esc(G.clubs[f[1].opp].short)} ${fmt(f[0])}</div>` : ""}</div><span class="tag" style="background:#7a1f2a;border-color:#7a1f2a;color:#fff">${returnRange(p.injury.days)}</span></div>`;
  }).join("") : '<div class="empty">Tidak ada pemain yang cedera.</div>'}</div>
  <div class="bcards">
    <div class="bcard"><div class="ch">Penilaian Risiko</div><div class="big">✚ ${risk.length} berisiko</div><div class="muted" style="font-size:12.5px">${risk.slice(0, 4).map(p => esc(shortName(p))).join(", ")}</div></div>
    <div class="bcard"><div class="ch">Baru Saja Kembali</div><div class="big">${recent.length} pemain</div><div class="muted" style="font-size:12.5px">${recent.slice(0, 3).map(p => esc(shortName(p))).join(", ") || "Tidak ada"}</div></div>
    <div class="bcard"><div class="ch">Ringkasan Musim</div><div class="big">${club.injCount || 0} cedera</div><div class="muted" style="font-size:12.5px">sejak awal musim</div></div>
    <div class="bcard"><div class="ch">Kamu</div><div class="big">${(G.user.injuries || []).length} cedera</div><div class="muted" style="font-size:12.5px">sepanjang karier</div></div>
  </div>`;
});
