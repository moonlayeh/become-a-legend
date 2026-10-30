// Player profile (any player), Latihan (individual training, calendar, medical centre)
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, pill1, stars, avatar, lookFor, natTag, flagEmoji, heading, toast, moneyShort, attrClass, bars, shortDay, jersey, CURRENCIES } from "./core.js";
import { NATIONS, POS_LABEL } from "../data.js";
import { ATTRS, A, GROUPS } from "../attributes.js";
import { fmt, fmtDay, ymd, ageOn, seasonLabel, BULAN } from "../calendar.js";
import { userP, userClub, FOCUS_LIST, weeksLabel, banTotal } from "../world.js";
import { fullName, shortName, personality, marketValue } from "../player.js";
import { squadStatus, coachReport, fed, fmtM, trainingSessionsToday, doTraining, EFFORT, F } from "../career.js";
import { canSwitch } from "../intl.js";
import { shirtNumber, rngOf } from "../sim.js";
import { ROLES, roleStars, bestRole, attrHighlights, positionString, PITCH_XY, famWord, FAM_WORDS, reputation, REP_COLOR, footWord, footLevel, fitnessWord, moraleWord, moraleFace, severity, severityWord, returnRange, clubMatchDays, staffOf, SESS, SESS_COLOR, userMatchDays } from "../meta.js";
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

function actionRow(G, p) {
  if (G.user.retired) return "";
  const u = userP(G);
  if (p.isUser) return `<div class="row" style="gap:8px;padding:0 12px 12px"><button class="btn sm" data-act="coach" style="flex:1">💬 Pelatih</button><button class="btn sm" data-act="agent" style="flex:1">💼 Agen</button>${G.neg && ["open", "final"].includes(G.neg.status) ? '<button class="btn sm pri" data-go="pemain/negosiasi" style="flex:1">📝 Negosiasi</button>' : ""}</div>`;
  if (p.club === u.club) return `<div class="row" style="gap:8px;padding:0 12px 12px"><button class="btn sm" data-act="mate" data-mpid="${p.id}" style="flex:1">💬 Ajak bicara</button><button class="btn sm" data-go="pemain/bandingkan" data-p='{"pid":${p.id}}' style="flex:1">⇄ Bandingkan</button></div>`;
  return `<div class="row" style="gap:8px;padding:0 12px 12px"><button class="btn sm" data-go="pemain/bandingkan" data-p='{"pid":${p.id}}' style="flex:1">⇄ Bandingkan denganku</button></div>`;
}
export function header(G, p) {
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
      <div class="row wrap" style="margin-top:6px;gap:4px">${p.injury ? `<span class="chip inj">✚ ${esc(p.injury.name)}</span>` : ""}${banTotal(p) > 0 ? `<span class="chip ban">Skorsing ${banTotal(p)}</span>` : ""}${p.away ? '<span class="chip nt">Timnas</span>' : ""}${p.isUser && G.user.loan ? '<span class="chip loan">Pinjaman</span>' : ""}</div>
    </div></div>
    <div class="kv">
      <div class="click" ${club ? `data-club="${club.id}"` : ""}><div class="k">Klub</div><div class="v"><span class="row" style="gap:6px">${club ? crest(club, 18) : ""}${esc(club?.name || "Tanpa klub")}</span></div><div class="k">${esc(club ? G.leagues[club.league]?.name || "" : "")}</div></div>
      <div><div class="k">Timnas ${p.isUser ? NATIONS[fed(G)].name : NATIONS[p.nat].name}</div><div class="v">${intlLine(G, p)}</div></div>
      <div><div class="k">Nilai pasar</div><div class="v">${moneyShort(v * 0.6)} – ${moneyShort(v * 1.5)}</div></div>
      <div><div class="k">Kontrak</div><div class="v">${p.contract?.youth ? "Kontrak akademi" : `${moneyShort(p.contract?.wage || 0)} p/mgg`}</div><div class="k">s.d. 30/6/${(p.contract?.end || 0) + 1}</div></div>
      <div><div class="k">Status</div><div class="v">${esc(status)}</div></div>
      <div><div class="k">Kemampuan · Potensi</div><div>${stars(rep.ca, "Kemampuan ")} ${stars(rep.pa, "Potensi ")}</div></div>
    </div>${actionRow(G, p)}</div>`;
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
  const yc = p.ycs?.liga || 0;
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
  ${banTotal(p) > 0 ? `<div style="color:var(--bad);font-size:13.5px;margin-top:4px">Skorsing ${Object.entries(p.bans).filter(([, n]) => n > 0).map(([k, n]) => `${n} laga (${k === "liga" ? "liga" : esc(G.comps[k]?.short || G.comps[k]?.name || k)})`).join(", ")}</div>` : ""}</div>
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

export function ratingChart(log) {
  const pts = log.slice(0, 20).reverse();
  if (pts.length < 2) return '<div class="muted">Butuh minimal dua laga.</div>';
  const W = 320, H = 120, x = i => 20 + i * ((W - 30) / (pts.length - 1)), y = r => H - 14 - ((r - 5) / 5) * (H - 24);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Rating ${pts.length} laga terakhir">${[6, 7, 8, 9].map(v => `<line x1="20" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.08)"/><text x="2" y="${y(v) + 4}" font-size="9" fill="#888">${v}</text>`).join("")}<polyline fill="none" stroke="#c5d84a" stroke-width="2" points="${pts.map((m, i) => `${x(i)},${y(m.rating)}`).join(" ")}"/>${pts.map((m, i) => `<circle cx="${x(i)}" cy="${y(m.rating)}" r="3" fill="${m.rating >= 7.5 ? "#8fd14f" : m.rating >= 6.5 ? "#d8c94a" : "#e08a4a"}"/>`).join("")}</svg>`;
}

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

// ---------- SESI LATIHAN (daily session) ----------
register("latihan", "sesi", (G, root, prm) => {
  const u = userP(G), club = userClub(G);
  const list = trainingSessionsToday(G);
  const coach = staffOf(G, club.id).find(s => s.role === (u.squad === "Y" ? "Pelatih U-19" : "Manajer"))?.name || "Pelatih";
  const last = G.user.lastTraining;
  const due = G.trainingDue && list && G.user.trainDone !== G.date;
  const sessCard = sessions => sessions.map(x => `<div class="spread" style="padding:7px 0;border-top:1px solid var(--line)"><span class="row" style="gap:8px"><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${SESS_COLOR[x.cat]}"></i>${esc(x.name)}</span>${x.rating != null ? pill(x.rating) : '<span class="muted">Istirahat</span>'}</div>`).join("");
  if (due) {
    const eff = prm.eff || G.user.lastEffort || "Normal";
    root.innerHTML = `<div class="card" style="border-left:3px solid var(--go-a)"><div class="ch">Sesi Latihan · ${esc(fmtDay(G.date))}</div>
      <div class="muted" style="font-size:13.5px">${esc(club.name)}${u.squad === "Y" ? " U-19" : ""} · dipimpin ${esc(coach)}</div>
      ${list.map(k => `<div class="spread" style="padding:7px 0;border-top:1px solid var(--line);margin-top:6px"><span class="row" style="gap:8px"><i style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${SESS_COLOR[SESS[k][1]]}"></i>${esc(SESS[k][0])}</span></div>`).join("")}
      <div class="muted" style="font-size:13px;margin-top:8px">Kondisi sekarang ${Math.round(u.cond)}% · Ketajaman ${Math.round(u.sharp ?? 60)}%</div></div>
    <div class="card"><div class="ch">Seberapa keras kamu berlatih hari ini?</div>
      ${Object.entries(EFFORT).map(([k, e]) => `<button class="pick" data-eff="${k}" aria-pressed="${eff === k}"><span class="bx"></span><span><b>${esc(e.label)}</b><span>${esc(e.desc)}</span></span></button>`).join("")}
      <label class="row" style="gap:8px;margin:10px 0 2px;font-size:14px"><input type="checkbox" id="extra" ${prm.extra ? "checked" : ""} style="width:20px;height:20px"> Tambah latihan individu setelah sesi (lebih lelah, perkembangan sedikit lebih cepat)</label>
      <button class="btn pri" id="dotrain" style="width:100%;min-height:48px;margin-top:10px;font-family:var(--display);font-size:20px">Mulai Latihan</button>
      <div class="row" style="gap:8px;margin-top:8px"><button class="btn sm" id="autoweek" style="flex:1">Otomatis sampai laga berikutnya</button></div>
      <p class="muted" style="font-size:12.5px;margin-top:8px">Berhenti di setiap sesi latihan bisa dimatikan di Pengaturan.</p></div>`;
    $$("[data-eff]", root).forEach(b => (b.onclick = () => go("latihan", "sesi", { ...prm, eff: b.dataset.eff, extra: $("#extra", root).checked }, true)));
    $("#dotrain", root).onclick = () => {
      const rng = rngOf(G); G.user.lastEffort = eff;
      doTraining(G, rng, eff, $("#extra", root).checked); G.rs = rng.s; save();
      go("latihan", "sesi", { done: 1 }, true);
    };
    $("#autoweek", root).onclick = () => {
      const md = [...userMatchDays(G)].filter(([d, m]) => d >= G.date && !m.res).sort((a, b) => a[0] - b[0])[0];
      G.user.autoTrainUntil = md ? md[0] : G.date + 7; G.user.autoEffort = eff;
      const rng = rngOf(G); doTraining(G, rng, eff, false, true); G.rs = rng.s; save();
      toast("Latihan berjalan otomatis sampai laga berikutnya."); go("portal", "ringkasan", {}, true); S.onGo?.();
    };
    return;
  }
  if (!last) { root.innerHTML = `<div class="card">Belum ada sesi latihan. Sesi berikutnya muncul saat kamu menekan Lanjutkan di hari latihan.</div>`; return; }
  root.innerHTML = `<div class="card"><div class="ch">Hasil Latihan · ${esc(fmtDay(last.date))}</div>
      <div class="spread" style="margin:4px 0 8px"><span class="muted">Usaha: <b style="color:#fff">${esc(last.effort)}</b>${last.extra ? " + latihan individu" : ""}${last.auto ? " (otomatis)" : ""}</span><span>Rata-rata ${pill(last.avg)}</span></div>
      ${sessCard(last.sessions)}
      <div class="muted" style="font-size:13.5px;margin-top:8px">Kondisi ${last.condBefore}% → ${last.condAfter}%${last.injury ? ` · <b style="color:var(--bad)">${esc(last.injury.name)} (${last.injury.days} hari)</b>` : ""}</div></div>
    <div class="card"><div class="ch">Kata Pelatih</div><div style="font-size:15px">"${esc(last.coach)}"</div></div>
    <div class="card"><div class="ch">Peringkat Latihan Hari Ini</div><div class="muted" style="font-size:13px;margin-bottom:6px">Kamu peringkat ${last.rank} dari ${last.board.length}</div>
      ${last.board.map((x, i) => `<div class="spread ${x.me ? "me" : ""}" style="padding:5px 4px;border-top:1px solid var(--line);font-size:14px;${x.me ? "background:rgba(255,213,74,.12)" : ""}"><span>${i + 1}. ${esc(x.name)}${x.me ? " (kamu)" : ""}</span>${pill(x.rating)}</div>`).join("")}</div>
    ${G.pending || G.trainingDue ? "" : `<button class="btn pri" id="contd" style="width:100%;min-height:48px;font-family:var(--display);font-size:20px">Lanjutkan Hari</button>`}`;
  $("#contd", root)?.addEventListener("click", () => { go("portal", "ringkasan", {}, true); S.onGo?.(); });
});

// ---------- PENGATURAN ----------
register("pengaturan", "umum", (G, root) => {
  const st = G.settings;
  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${key}" data-v="${v}" aria-pressed="${String(st[key]) === String(v)}">${l}</button>`).join("")}</div>`;
  root.innerHTML = `<div class="card"><div class="ch">Wilayah</div>
      <div class="lbl" style="margin-bottom:6px">Bahasa</div><div style="margin-bottom:12px">Bahasa Indonesia</div>
      <div class="lbl" style="margin-bottom:6px">Mata uang</div>${seg("currency", Object.entries(CURRENCIES).map(([k, c]) => [k, `${c.sym} ${k}`]))}
      <p class="muted" style="font-size:12.5px;margin-top:6px">Konversi memakai Kurs Menteri Keuangan per 30 Oktober 2026 (EUR Rp20.088,08; USD Rp17.946,00; GBP Rp23.780,53), dibuat tetap agar angka di gim tidak berubah-ubah.</p></div>
    <div class="card"><div class="ch">Permainan</div>
      <div class="lbl" style="margin-bottom:6px">Berhenti di setiap sesi latihan</div>${seg("trainStop", [[true, "Ya"], [false, "Tidak, otomatis"]])}
      <div class="lbl" style="margin:12px 0 6px">Usaha saat latihan otomatis</div>${seg("autoEffort", Object.keys(EFFORT).map(k => [k, k]))}
      <div class="lbl" style="margin:12px 0 6px">Kecepatan awal laga 2D</div>${seg("speed", [[10, "×10"], [25, "×25"], [60, "×60"]])}</div>
    <div class="card"><div class="ch">Tampilan</div>
      <div class="lbl" style="margin-bottom:6px">Skala teks</div>${seg("textScale", [[0.9, "Kecil"], [1, "Normal"], [1.1, "Besar"], [1.2, "Lebih Besar"]])}</div>
    <div class="card"><div class="ch">Penyimpanan</div><p class="muted" style="font-size:13.5px">Karier tersimpan otomatis setiap kali proses berhenti (laga, pesan, latihan).</p><button class="btn" id="savenow">Simpan sekarang</button></div>`;
  $$("[data-set]", root).forEach(b => (b.onclick = () => {
    const k = b.dataset.set; let v = b.dataset.v;
    if (v === "true" || v === "false") v = v === "true"; else if (!isNaN(+v)) v = +v;
    st[k] = v; if (k === "autoEffort") G.user.autoEffort = v;
    save(); render();
  }));
  $("#savenow", root).onclick = () => { save(); toast("Karier disimpan."); };
});
