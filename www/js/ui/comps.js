// Competition pages for cups, continental/youth competitions and the Nations League.
import { go } from "./shell.js";
import { $$, esc, crest, flagEmoji, compBadge, heading, shortDay } from "./core.js";
import { NATIONS } from "../data.js";
import { fmt } from "../calendar.js";
import { userP, standings } from "../world.js";
import { compLabel, groupTable, compDef } from "../comps.js";
import { nlTable, nlLabel } from "../intl.js";
import { shortClub, compStatus } from "./portal.js";

const team = (G, id, size = 18) => { const c = G.clubs[id]; return c ? `<span class="row click" style="gap:6px;min-width:0" data-club="${id}">${crest(c, size)}<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(shortClub(c))}</span></span>` : esc(id); };
const nat = n => `<span class="row" style="gap:6px">${flagEmoji(n)}<span>${esc(NATIONS[n]?.name || n)}</span></span>`;
const ZC = { zt: "var(--blue)", ze: "#c9a227", zc: "#2bb3c0", zr: "var(--bad)" };

function header(G, c) {
  const last = c.history[c.history.length - 1];
  const u = userP(G);
  const mineNext = c.fixtures.filter(f => !f.res && (f.h === u.club || f.a === u.club)).sort((a, b) => a.d - b.d)[0];
  return `<div class="phead" style="background:linear-gradient(180deg,${c.color}aa,rgba(0,0,0,0))"><div class="top">${compBadge(c, 64)}<div style="flex:1;min-width:0"><div class="nm">${esc(c.name)}</div><div class="sub">${c.nation ? `${flagEmoji(c.nation)} ${esc(NATIONS[c.nation].name)} · ` : c.conf ? `${esc(c.conf)} · ` : ""}${c.teams.length} tim${c.youth ? " · U-19" : ""}</div></div></div>
    <div class="kv"><div><div class="k">Juara Bertahan</div><div class="v">${last ? team(G, last.winner, 16) : "-"}</div></div><div><div class="k">Musim</div><div class="v">${esc(compLabel(c))}</div></div><div><div class="k">Tahap</div><div class="v">${esc(compStatus(G, c))}</div></div>${mineNext ? `<div><div class="k">Laga klubmu</div><div class="v">${fmt(mineNext.d)}</div></div>` : ""}</div></div>`;
}
function fxRow(G, f, u) {
  const me = f.h === u.club || f.a === u.club;
  const note = f.pens ? `adu penalti ${f.pens[0]}-${f.pens[1]}` : f.aet ? "perpanjangan waktu" : "";
  return `<div class="vs ${me ? "me" : ""}" style="${me ? "background:rgba(108,43,217,.25);border-radius:4px" : ""}"><span class="l click" data-club="${f.h}">${esc(shortClub(G.clubs[f.h]))}</span><span class="row" style="gap:4px">${crest(G.clubs[f.h], 18)}<span class="g">${f.res ? f.res[0] : ""}</span></span><span class="v">${f.res ? "-" : shortDay(f.d).split(" ").slice(-2).join(" ")}</span><span class="row" style="gap:4px"><span class="g">${f.res ? f.res[1] : ""}</span>${crest(G.clubs[f.a], 18)}</span><span class="r click" data-club="${f.a}">${esc(shortClub(G.clubs[f.a]))}</span></div>${note ? `<div class="muted" style="text-align:center;font-size:12px;margin-top:-4px">${note}</div>` : ""}`;
}
function tableHtml(G, rows, zone, u, isNat = false) {
  return `<table class="tbl"><thead><tr><th>Pos</th><th>Tim</th><th class="n">Main</th><th class="n">SG</th><th class="n">Pts</th></tr></thead><tbody>${rows.map((r, i) => {
    const id = isNat ? r.n : r.id;
    return `<tr class="${!isNat && id === u.club ? "me" : ""}"><td class="${zone(i)}">${i + 1}</td><td>${isNat ? nat(id) : team(G, id)}</td><td class="n">${r.p}</td><td class="n">${r.gf - r.ga}</td><td class="n"><b>${r.pts}</b></td></tr>`;
  }).join("")}</tbody></table>`;
}
const legend = items => `<div class="legend">${items.map(([cls, l]) => `<span><i style="background:${ZC[cls]}"></i>${esc(l)}</span>`).join("")}</div>`;
function tiesHtml(G, c, S, u) {
  return S.ties.map(t => {
    const fx = t.f.map(i => c.fixtures[i]);
    const me = t.a === u.club || t.b === u.club;
    const agg = t.agg ? `${t.agg[0]}-${t.agg[1]}` : "";
    const last = fx[fx.length - 1];
    const note = last.pens ? ` · pen. ${last.h === t.a ? last.pens[0] : last.pens[1]}-${last.h === t.a ? last.pens[1] : last.pens[0]}` : last.aet ? " · p.w." : "";
    return `<div class="tie ${me ? "me" : ""}"><div class="t ${t.w ? (t.w === t.a ? "w" : "l") : ""}">${team(G, t.a, 16)}<b>${S.legs === 2 && t.agg ? t.agg[0] : fx[0].res ? (fx[0].h === t.a ? fx[0].res[0] : fx[0].res[1]) : ""}</b></div><div class="t ${t.w ? (t.w === t.b ? "w" : "l") : ""}">${team(G, t.b, 16)}<b>${S.legs === 2 && t.agg ? t.agg[1] : fx[0].res ? (fx[0].h === t.b ? fx[0].res[0] : fx[0].res[1]) : ""}</b></div><small>${S.legs === 2 ? `${fx.map(f => f.res ? `${f.res[0]}-${f.res[1]}` : fmt(f.d)).join(" · ")}${agg ? ` (agr. ${agg})` : ""}` : fx[0].res ? fmt(fx[0].d) : fmt(fx[0].d)}${note}</small></div>`;
  }).join("");
}

// ---------- RINGKASAN ----------
export function compRingkasan(G, root, p) {
  if (p.comp === "NL") return nlRingkasan(G, root);
  const c = G.comps[p.comp];
  if (!c) { root.innerHTML = '<div class="card">Kompetisi ini belum dimulai musim ini.</div>'; return; }
  const u = userP(G), def = compDef(c.id) || {};
  let body = "";
  const S0 = c.stages[0];
  const koNow = c.stages[c.cur]?.type === "ko" ? c.stages[c.cur] : null;
  if (koNow) body += `<div class="card">${heading(koNow.name, true)}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">${tiesHtml(G, c, koNow, u)}</div></div>`;
  if (S0?.type === "league") {
    S0.groups.forEach((teams, g) => {
      const rows = standings(G, teams, c.fixtures.filter(f => f.st === 0 && (S0.groups.length === 1 || f.g === g)));
      const two = S0.groups.length > 1;
      const zone = i => (two ? (i < 8 ? "zc" : "") : def.qualify === 16 ? (i < 16 ? "zt" : "") : i < 8 ? "zt" : i < 24 ? "ze" : "");
      body += `<div class="card">${heading(S0.names ? S0.names[g] : "Fase Liga", true)}${tableHtml(G, rows, zone, u)}${legend(two ? [["zc", "Babak 16 Besar"]] : def.qualify === 16 ? [["zt", "Babak 16 Besar"]] : [["zt", "Babak 16 Besar"], ["ze", "Play-off fase gugur"]])}</div>`;
    });
  } else if (S0?.type === "groups") {
    body += `<div class="card">${heading("Fase Grup", true)}${S0.groups.map((_, g) => `<div class="lbl" style="margin:${g ? 12 : 0}px 0 4px">Grup ${String.fromCharCode(65 + g)}</div>${tableHtml(G, groupTable(G, c, g), i => (i < (def.adv || 2) ? "zt" : ""), u)}`).join("")}</div>`;
  }
  if (c.kind === "cup" && !koNow && c.state === "done") body += `<div class="card">Kompetisi selesai. Juara: ${team(G, c.winner)}</div>`;
  const upcoming = c.fixtures.filter(f => !f.res).sort((a, b) => a.d - b.d).slice(0, 8);
  root.innerHTML = header(G, c) + (upcoming.length ? `<div class="fxs">${upcoming.map(f => `<div class="fx"><div class="h"><span>${shortDay(f.d)}</span><span>${esc(c.stages[f.st].name)}</span></div><div class="tm click" data-club="${f.h}">${crest(G.clubs[f.h], 16)}<span>${esc(shortClub(G.clubs[f.h]))}</span></div><div class="tm click" data-club="${f.a}">${crest(G.clubs[f.a], 16)}<span>${esc(shortClub(G.clubs[f.a]))}</span></div></div>`).join("")}</div>` : "") + body
    + `<div class="card">${heading(`Berita ${c.name}`, true)}${G.news.filter(n => n.comp === c.id).slice(0, 4).map(n => `<div class="spread" style="padding:6px 0;border-top:1px solid var(--line);font-size:14px"><span>${esc(n.title)}</span><span class="muted" style="font-size:12px;white-space:nowrap;margin-left:8px">${fmt(n.date)}</span></div>`).join("") || '<div class="empty">Belum ada berita.</div>'}</div>`;
}

// ---------- JADWAL ----------
export function compJadwal(G, root, p) {
  if (p.comp === "NL") return nlJadwal(G, root, p);
  const c = G.comps[p.comp];
  if (!c) { root.innerHTML = '<div class="card">Belum ada jadwal.</div>'; return; }
  const u = userP(G);
  // pages: each matchday of a league/group stage, then each knockout round
  const pages = [];
  c.stages.forEach((S, st) => {
    if (S.type === "ko") pages.push({ label: S.name, f: f => f.st === st });
    else { const mds = [...new Set(c.fixtures.filter(f => f.st === st).map(f => f.md))].sort((a, b) => a - b); for (const md of mds) pages.push({ label: `${S.type === "groups" ? "Grup" : "Fase Liga"} · Laga ${md}`, f: f => f.st === st && f.md === md }); }
  });
  const firstOpen = pages.findIndex(pg => c.fixtures.some(f => pg.f(f) && !f.res));
  const i = p.pg != null && pages[p.pg] ? p.pg : firstOpen >= 0 ? firstOpen : pages.length - 1;
  const fx = c.fixtures.filter(pages[i].f).sort((a, b) => a.d - b.d || (b.h === u.club || b.a === u.club) - (a.h === u.club || a.a === u.club));
  root.innerHTML = header(G, c) + `<div class="card"><div class="spread" style="margin-bottom:6px"><button class="btn sm" data-pg="${i - 1}" ${i <= 0 ? "disabled" : ""}>←</button><b class="disp" style="font-size:18px;text-align:center">${esc(pages[i].label)}</b><button class="btn sm" data-pg="${i + 1}" ${i >= pages.length - 1 ? "disabled" : ""}>→</button></div>
    <div class="muted" style="text-align:center;font-size:13px;margin-bottom:6px">${fx[0] ? fmt(fx[0].d) : ""}${fx.length && fx[fx.length - 1].d !== fx[0].d ? ` – ${fmt(fx[fx.length - 1].d)}` : ""}</div>
    ${fx.map(f => fxRow(G, f, u)).join("")}</div>`;
  $$("[data-pg]", root).forEach(b => (b.onclick = () => go("kompetisi", "jadwal", { ...p, pg: +b.dataset.pg }, true)));
}

// ---------- TAHAP (bracket) ----------
export function compTahap(G, root, p) {
  if (p.comp === "NL") return nlTahap(G, root);
  const c = G.comps[p.comp];
  if (!c) { root.innerHTML = '<div class="card">Belum ada bagan.</div>'; return; }
  const u = userP(G), def = compDef(c.id);
  const ko = c.stages.filter(S => S.type === "ko");
  const cols = ko.map(S => `<div class="col"><h5>${esc(S.name)}</h5>${tiesHtml(G, c, S, u)}</div>`);
  // rounds that are still to be drawn
  let n = ko.length ? ko[ko.length - 1].ties.length : 0;
  const names = c.kind === "cup" ? null : (def?.ko || []).map(k => k[0]);
  let k = c.ki ?? 0;
  while (n > 1 && c.state !== "done") {
    n = Math.ceil(n / 2);
    const name = names ? names[k++] || "" : ({ 1: "Final", 2: "Semifinal", 4: "Perempat Final", 8: "Babak 16 Besar" }[n] || `Babak ${n * 2} Besar`);
    cols.push(`<div class="col"><h5>${esc(name)}</h5>${Array.from({ length: n }, () => '<div class="tie"><div class="t l"><span>Belum diundi</span></div><div class="t l"><span>&nbsp;</span></div></div>').join("")}</div>`);
  }
  if (!ko.length) cols.push(`<div class="muted" style="padding:8px">Fase gugur dimulai setelah ${esc(c.stages[0]?.name.toLowerCase() || "fase awal")} selesai.</div>`);
  root.innerHTML = header(G, c) + `<div class="card">${heading("Bagan Fase Gugur", true)}<div class="bracket wscroll">${cols.join("")}</div></div>`;
}

// ---------- SEJARAH ----------
export function compSejarah(G, root, p) {
  if (p.comp === "NL") { root.innerHTML = `<div class="card">${heading("Pemenang Sebelumnya", true)}${G.nl.winner ? `<table class="tbl"><tbody><tr><td>${esc(G.nl.season)}</td><td>${nat(G.nl.winner)}</td></tr></tbody></table>` : '<div class="muted">Juara pertama di gim ini akan tercatat pada Juni 2027.</div>'}</div>`; return; }
  const c = G.comps[p.comp];
  if (!c) { root.innerHTML = ""; return; }
  root.innerHTML = header(G, c) + `<div class="card">${heading("Pemenang Sebelumnya", true)}${c.history.length ? `<table class="tbl"><thead><tr><th>Musim</th><th>Juara</th><th>Runner-up</th></tr></thead><tbody>${c.history.slice().reverse().map(h => `<tr><td>${esc(h.season)}</td><td>${team(G, h.winner)}</td><td>${team(G, h.runnerUp)}</td></tr>`).join("")}</tbody></table>` : '<div class="muted">Juara pertama akan tercatat di akhir kompetisi ini.</div>'}</div>
    <div class="card">${heading("Peserta Musim Ini", true)}<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px 10px">${c.teams.slice().sort((a, b) => (G.clubs[a]?.name || a).localeCompare(G.clubs[b]?.name || b)).map(id => `<div style="font-size:13.5px">${team(G, id, 16)}</div>`).join("")}</div></div>`;
}

// ---------- Nations League ----------
function nlHeader(G) {
  const N = G.nl;
  return `<div class="phead" style="background:linear-gradient(180deg,#0e1e5baa,rgba(0,0,0,0))"><div class="top">${compBadge({ color: "#0e1e5b" }, 64)}<div style="flex:1"><div class="nm">UEFA Nations League</div><div class="sub">Liga A & B · 32 tim nasional</div></div></div>
    <div class="kv"><div><div class="k">Musim</div><div class="v">${esc(N.season)}</div></div><div><div class="k">Tahap</div><div class="v">${N.winner ? `Juara: ${esc(NATIONS[N.winner].name)}` : N.ko.length ? "Fase gugur" : "Fase grup"}</div></div></div></div>`;
}
function nlRingkasan(G, root) {
  const N = G.nl;
  const grp = lg => N.groups[lg].map((_, g) => `<div class="lbl" style="margin:${g ? 12 : 0}px 0 4px">Grup ${lg}${g + 1}</div>${tableHtml(G, nlTable(G, lg, g), i => (lg === "A" ? (i < 2 ? "zt" : i === 3 ? "zr" : "") : i === 0 ? "zt" : ""), userP(G), true)}`).join("");
  root.innerHTML = nlHeader(G) + `<div class="card">${heading("Liga A", true)}${grp("A")}${legend([["zt", "Perempat final"], ["zr", "Turun ke Liga B"]])}</div><div class="card">${heading("Liga B", true)}${grp("B")}${legend([["zt", "Promosi ke Liga A"]])}</div>`;
}
function nlJadwal(G, root, p) {
  const N = G.nl;
  const stages = [...new Set(N.fx.map(f => (f.stage === "G" ? `Laga ${f.md}` : f.stage)))];
  const i = p.pg != null && stages[p.pg] ? p.pg : Math.max(0, stages.findIndex(s => N.fx.some(f => (f.stage === "G" ? `Laga ${f.md}` : f.stage) === s && !f.res)));
  const fx = N.fx.filter(f => (f.stage === "G" ? `Laga ${f.md}` : f.stage) === stages[i]);
  const label = { QF: "Perempat Final", SF: "Semifinal", F: "Final" }[stages[i]] || stages[i];
  root.innerHTML = nlHeader(G) + `<div class="card"><div class="spread" style="margin-bottom:6px"><button class="btn sm" data-pg="${i - 1}" ${i <= 0 ? "disabled" : ""}>←</button><b class="disp" style="font-size:18px">${esc(label)}</b><button class="btn sm" data-pg="${i + 1}" ${i >= stages.length - 1 ? "disabled" : ""}>→</button></div>
    ${fx.map(f => `<div class="vs"><span class="l">${esc(NATIONS[f.h].name)}</span><span class="row" style="gap:4px">${flagEmoji(f.h)}<span class="g">${f.res ? f.res[0] : ""}</span></span><span class="v">${f.res ? "-" : fmt(f.d).split(" ").slice(0, 2).join(" ")}</span><span class="row" style="gap:4px"><span class="g">${f.res ? f.res[1] : ""}</span>${flagEmoji(f.a)}</span><span class="r">${esc(NATIONS[f.a].name)}</span></div>${f.stage === "G" ? `<div class="muted" style="text-align:center;font-size:11.5px;margin-top:-4px">Grup ${f.lg}${f.g + 1}</div>` : f.pens ? `<div class="muted" style="text-align:center;font-size:12px;margin-top:-4px">adu penalti ${f.pens[0]}-${f.pens[1]}</div>` : ""}`).join("")}</div>`;
  $$("[data-pg]", root).forEach(b => (b.onclick = () => go("kompetisi", "jadwal", { comp: "NL", pg: +b.dataset.pg }, true)));
}
function nlTahap(G, root) {
  const N = G.nl;
  const col = (name, list) => `<div class="col"><h5>${name}</h5>${list}</div>`;
  const qf = [0, 1, 2, 3].map(t => { const l = N.fx.filter(f => f.stage === "QF" && f.tie === t); if (!l.length) return '<div class="tie"><div class="t l"><span>Belum ditentukan</span></div></div>'; return `<div class="tie"><div class="t">${nat(l[1].h)}</div><div class="t">${nat(l[1].a)}</div><small>${l.map(f => (f.res ? `${f.res[0]}-${f.res[1]}` : fmt(f.d))).join(" · ")}</small></div>`; }).join("");
  const one = st => { const l = N.fx.filter(f => f.stage === st); return l.length ? l.map(f => `<div class="tie"><div class="t">${nat(f.h)}<b>${f.res ? f.res[0] : ""}</b></div><div class="t">${nat(f.a)}<b>${f.res ? f.res[1] : ""}</b></div><small>${fmt(f.d)}${f.pens ? ` · pen. ${f.pens[0]}-${f.pens[1]}` : ""}</small></div>`).join("") : '<div class="tie"><div class="t l"><span>Belum ditentukan</span></div></div>'; };
  root.innerHTML = nlHeader(G) + `<div class="card">${heading("Fase Gugur Liga A", true)}<div class="bracket wscroll">${col("Perempat Final", qf)}${col("Semifinal", one("SF"))}${col("Final", one("F"))}</div></div>`;
}
