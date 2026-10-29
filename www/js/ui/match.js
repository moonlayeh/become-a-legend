// Match day: lineup reveal, live 2D match, result screen
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, pill, pill1, avatar, lookFor, jersey, flagBadge, lum, toast } from "./core.js";
import { NATIONS } from "../data.js";
import { fmtDay, ageOn } from "../calendar.js";
import { userP } from "../world.js";
import { fullName } from "../player.js";
import { pendingTeams, teamColors, playPending, numOf } from "../sim.js";
import { PitchPlayer, kitPair } from "../viewer.js";
import { formationPitch } from "./club.js";

const vis = c => (lum(c) < 22 ? "#9aa3ad" : lum(c) > 92 ? "#d9dde3" : c);
const badge = (G, t, size) => (t.club && G.clubs[t.club] ? crest(G.clubs[t.club], size) : flagBadge(t.nat || String(t.club).replace("NT-", ""), size));

// ---------- PRA-LAGA ----------
register("laga", "pra", (G, root, p) => {
  if (!G.pending) { go("portal", "ringkasan", {}, true); return; }
  const { H, A } = pendingTeams(G);
  const pd = G.pending, u = userP(G);
  const mine = H.xi.some(q => q.id === u.id) || H.bench.some(q => q.id === u.id) ? 0 : 1;
  const side = p.side ?? mine;
  const T = side === 0 ? H : A;
  const col = teamColors(G, T);
  const role = pd.role === "XI" ? "Kamu masuk susunan pemain inti." : pd.role === "Cadangan" ? "Kamu memulai dari bangku cadangan." : "Kamu tidak masuk daftar pemain.";
  root.innerHTML = `
  <div class="mhead"><div class="cmp">${esc(pd.comp)}${pd.round ? ` · Pekan ${pd.round}` : ""}</div>
    <div class="score"><div class="tn" style="text-align:right">${esc(H.name)}</div>${badge(G, H, 40)}<div class="sc" style="font-size:24px">VS</div>${badge(G, A, 40)}<div class="tn" style="text-align:left">${esc(A.name)}</div></div>
    <div class="mmeta"><span>${fmtDay(G.date)}</span>${pd.kind !== "timnas" ? `<span>Kandang ${esc(H.name)}</span>` : ""}</div></div>
  <div class="card" style="border-left:3px solid var(--go-a)">${role}${u.cond < 85 ? ` Kondisimu ${Math.round(u.cond)}%.` : ""}</div>
  <div class="seg" style="margin-bottom:10px"><button data-side="0" aria-pressed="${side === 0}">${esc(H.name)}</button><button data-side="1" aria-pressed="${side === 1}">${esc(A.name)}</button></div>
  <div class="lineup"><div class="lh" style="background:${col[0]};color:${lum(col[0]) > 62 ? "#111" : "#fff"}">${esc(T.name)}</div>
    <div class="lpitch">${lineupPlates(G, T, col)}</div>
    <div class="subs"><h4>Cadangan</h4>${T.bench.map(q => `<div class="${q.isUser ? "me" : ""}"><b>${numOf(G, q.id, T)}</b><span>${esc(q.ln)}${q.isUser ? " (kamu)" : ""}</span><span class="muted" style="margin-left:auto">${q.main}</span></div>`).join("")}</div></div>
  <div style="display:flex;gap:8px;margin-top:12px"><button class="btn pri" id="watch" style="flex:1;min-height:48px;font-family:var(--display);font-size:20px">Mulai Laga</button><button class="btn" id="quick" style="flex:1;min-height:48px">Lewati ke hasil</button></div>`;
  $$("[data-side]", root).forEach(b => (b.onclick = () => go("laga", "pra", { side: +b.dataset.side }, true)));
  $("#watch", root).onclick = () => play(G, true);
  $("#quick", root).onclick = () => play(G, false);
});
function lineupPlates(G, T, col) {
  const FORM = { "4-3-3": [[4, 34], [30, 58], [24, 43], [24, 25], [30, 10], [40, 34], [52, 48], [52, 20], [74, 60], [84, 34], [74, 8]], "4-2-3-1": [[4, 34], [30, 58], [24, 43], [24, 25], [30, 10], [42, 45], [42, 23], [70, 59], [66, 34], [70, 9], [84, 34]], "4-4-2": [[4, 34], [30, 58], [24, 43], [24, 25], [30, 10], [58, 58], [50, 42], [50, 26], [58, 10], [80, 42], [80, 26]], "3-5-2": [[4, 34], [24, 49], [22, 34], [24, 19], [50, 62], [50, 6], [40, 34], [54, 46], [54, 22], [80, 42], [80, 26]] };
  const f = FORM[T.formation] || FORM["4-3-3"];
  const ink = lum(col[0]) > 62 ? "#111" : "#fff";
  return T.xi.map((q, i) => {
    const [sx, sy] = f[i] || [50, 34];
    const x = 10 + (sy / 68) * 80, y = 92 - (sx / 88) * 82;
    return `<div class="pl ${q.isUser ? "me" : ""}" style="left:${x}%;top:${y}%">${avatar(lookFor(q), col, 34, ageOn(q.birth, S.G.date))}<div class="plate"><span class="nn" style="background:${col[0]};color:${ink}">${numOf(G, q.id, T)}</span><span class="pn">${esc(q.ln)}</span></div></div>`;
  }).join("");
}
function play(G, watch) {
  const ld = document.createElement("div"); ld.className = "loading"; ld.innerHTML = '<div><div class="spin"></div>Pertandingan dimulai…</div>'; document.body.appendChild(ld);
  setTimeout(() => {
    const r = playPending(G, true);
    save(); ld.remove();
    if (watch && r.replay) live(G, r.replay, r.summary);
    else go("laga", "hasil", {}, true);
  }, 30);
}

// ---------- LIVE ----------
function live(G, R, Sm) {
  const kits = kitPair(R.colors);
  const el = document.createElement("div");
  el.className = "live";
  el.innerHTML = `
    <div class="livebar"><button class="ibtn" id="lp" aria-label="Jeda">❚❚</button><div class="clock" id="lc">0'</div>
      <div class="livescore"><span>${esc(R.short[0])}</span><span class="k" style="background:${kits[0][0]}"></span><span class="s" id="ls">0 - 0</span><span class="k" style="background:${kits[1][0]}"></span><span>${esc(R.short[1])}</span></div></div>
    <div class="livepitch"><canvas></canvas></div>
    <div class="liveticker" id="lt" aria-live="polite">Sepak mula!</div>
    <div class="livetabs" role="tablist">${[["ev", "Peristiwa"], ["st", "Statistik"], ["fm", "Formasi"], ["mo", "Momentum"]].map(([k, l], i) => `<button data-lt="${k}" aria-selected="${i === 0}">${l}</button>`).join("")}</div>
    <div class="livepanel" id="lpanel"></div>
    <div class="livectl"><button class="btn sm" data-a="hl" aria-pressed="true">Sorotan</button><button class="btn sm" data-s="10">×10</button><button class="btn sm" data-s="25" aria-pressed="true">×25</button><button class="btn sm" data-s="60">×60</button><button class="btn sm pri" data-a="end" style="margin-left:auto">Ke akhir</button></div>`;
  document.body.appendChild(el);
  history.pushState({ live: true }, "");
  let tab = "ev", lastPaint = 0;
  const lines = {}; for (const l of R.lines) lines[l.id] = l;
  const pp = new PitchPlayer(el.querySelector("canvas"), R, {
    onEvent: (e, P) => {
      const tn = R.names[e.side];
      const msg = e.type === "goal" ? `<b>GOL!</b> ${esc(e.name)} (${esc(tn)})${e.ast ? ` · assist ${esc(e.ast)}` : ""}` : e.type === "yc" ? `🟨 ${esc(e.name)} (${esc(tn)})` : e.type === "rc" ? `🟥 <b>Kartu merah</b> ${esc(e.name)}` : e.type === "sub" ? `🔁 ${esc(e.name)} masuk, ${esc(e.off)} keluar` : e.type === "inj" ? `✚ ${esc(e.name)} cedera` : e.type === "pen" ? `<b>Penalti</b> untuk ${esc(tn)}!` : e.type === "penmiss" ? "Penalti gagal!" : "";
      if (msg) $("#lt", el).innerHTML = msg;
      $("#ls", el).textContent = `${P.score[0]} - ${P.score[1]}`;
    },
    onFrame: (f, P) => {
      const nm = f.c && R.info[f.c] ? R.info[f.c].name : "";
      const t = f.k === "shot" ? (f.r === "save" ? `${nm} menembak, ditepis kiper.` : f.r === "blk" ? `Tembakan ${nm} diblok.` : `${nm} menembak, melebar.`) : f.k === "corner" ? `Sepak pojok untuk ${R.names[f.s]}.` : f.k === "half" && f.h === 2 ? "Babak kedua dimulai." : f.k === "end" && f.h === 1 ? "Turun minum." : "";
      if (t) $("#lt", el).textContent = t;
    },
    onTick: P => {
      $("#lc", el).textContent = P.clockLabel();
      const now = performance.now(); if (now - lastPaint < 400) return; lastPaint = now;
      paintPanel(G, R, Sm, P, tab, $("#lpanel", el), lines);
    },
    onEnd: () => { $("#lt", el).innerHTML = "<b>Peluit panjang.</b>"; const b = el.querySelector('[data-a="end"]'); b.textContent = "Lihat hasil"; $("#ls", el).textContent = `${Sm.score[0]} - ${Sm.score[1]}`; paintPanel(G, R, Sm, pp, tab, $("#lpanel", el), lines); },
  });
  const close = () => { pp.destroy(); el.remove(); window.removeEventListener("popstate", onPop); go("laga", "hasil", {}, true); };
  const onPop = () => { if (pp.done) close(); else { pp.finish(); history.pushState({ live: true }, ""); } };
  window.addEventListener("popstate", onPop);
  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "lp") { pp.paused = !pp.paused; b.textContent = pp.paused ? "▶" : "❚❚"; }
    if (b.dataset.s) { pp.speed = +b.dataset.s; pp.hl = false; $$("[data-s]", el).forEach(x => x.setAttribute("aria-pressed", x === b)); el.querySelector('[data-a="hl"]').setAttribute("aria-pressed", "false"); }
    if (b.dataset.a === "hl") { pp.hl = !pp.hl; b.setAttribute("aria-pressed", pp.hl); }
    if (b.dataset.a === "end") { if (pp.done) { history.back(); } else pp.finish(); }
    if (b.dataset.lt) { tab = b.dataset.lt; $$("[data-lt]", el).forEach(x => x.setAttribute("aria-selected", x === b)); paintPanel(G, R, Sm, pp, tab, $("#lpanel", el), lines); }
  });
  paintPanel(G, R, Sm, pp, tab, $("#lpanel", el), lines);
}
function liveRating(l, t, endT, evs) {
  if (!l) return null;
  const f = Math.min(1, t / endT);
  const g = evs.filter(e => e.type === "goal" && e.t <= t && e.pid === l.id).length, a = evs.filter(e => e.type === "goal" && e.t <= t && e.astId === l.id).length;
  const gAll = l.gls * 0.95 + l.ast * 0.6;
  return Math.max(4, Math.min(10, 6.6 + (l.rating - 6.6 - gAll) * f + g * 0.95 + a * 0.6));
}
function paintPanel(G, R, Sm, P, tab, box, lines) {
  const t = P.t, done = P.done;
  const evs = R.events.filter(e => e.t <= t);
  if (tab === "ev") {
    box.innerHTML = evs.filter(e => ["goal", "yc", "rc", "sub", "inj"].includes(e.type)).reverse().map(e => evRow(e)).join("") || '<div class="empty">Belum ada peristiwa.</div>';
  } else if (tab === "st") {
    box.innerHTML = statBars(liveStats(R, t, done ? Sm.teams : null), R.colors);
  } else if (tab === "fm") {
    box.innerHTML = [0, 1].map(side => `<div class="ch" style="font-size:14px">${esc(R.names[side])}</div>${formationPitch(G, R.lineups[side].start.map(s => ({ ...s, pid: null, rating: done ? lines[s.id]?.rating : liveRating(lines[s.id], t, P.endT, R.events), me: R.info[s.id]?.user })), R.colors[side], { showPos: false })}`).join('<div style="height:10px"></div>');
  } else {
    box.innerHTML = momentumChart(Sm.momentum, R.colors, Sm.shots, P.minute(t)) + xgChart(Sm.shots, R.colors, P.minute(t));
  }
}
function liveStats(R, t, final) {
  if (final) return final;
  const s = [0, 1].map(() => ({ sh: 0, sot: 0, xg: 0, cor: 0, fou: 0, yc: 0, pos: 0 }));
  for (const sh of R.shots) if (sh.t <= t) { const x = s[sh.side]; x.sh++; x.xg += sh.xg; if (sh.r === "goal" || sh.r === "save") x.sot++; }
  let p0 = 0, p1 = 0; const F = R.frames;
  for (let i = 0; i < F.length - 1 && F[i].t <= t; i++) { const dt = Math.min(F[i + 1].t, t) - F[i].t; if (dt > 0 && dt < 120) (F[i].s === 0 ? (p0 += dt) : (p1 += dt)); if (F[i].k === "corner") s[F[i].s].cor++; if (F[i].k === "foul") s[1 - F[i].s].fou++; }
  for (const e of R.events) if (e.t <= t && e.type === "yc") s[e.side].yc++;
  const tot = p0 + p1 || 1; s[0].pos = Math.round(p0 / tot * 100); s[1].pos = 100 - s[0].pos;
  return s;
}
const evIcon = e => (e.type === "goal" ? "⚽" : e.type === "yc" ? "🟨" : e.type === "rc" ? "🟥" : e.type === "sub" ? "🔁" : "✚");
function evRow(e) {
  const txt = e.type === "goal" ? `<b>${esc(e.name)}</b>${e.ast ? `<div class="muted" style="font-size:12px">${esc(e.ast)}</div>` : ""}` : e.type === "sub" ? `${esc(e.name)}<div class="muted" style="font-size:12px">↘ ${esc(e.off)}</div>` : esc(e.name);
  return `<div class="evrow"><div class="l">${e.side === 0 ? `${txt} ${evIcon(e)}` : ""}</div><div class="m">${e.min}'</div><div>${e.side === 1 ? `${evIcon(e)} ${txt}` : ""}</div></div>`;
}
export function statBars(T, colors) {
  const k = kitPair(colors);
  const row = (lbl, a, b, f = x => x) => { const s = a + b || 1; return `<div class="sbar"><div class="t">${lbl}</div><div class="r"><span>${f(a)}</span><div class="b l"><i style="width:${(a / s) * 100}%"></i></div><div class="b r"><i style="width:${(b / s) * 100}%"></i></div><span>${f(b)}</span></div></div>`; };
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return `<div style="--hc:${vis(k[0][0])};--ac:${vis(k[1][0])}">${row("Penguasaan", T[0].pos, T[1].pos, x => x + "%")}${row("Tembakan", T[0].sh, T[1].sh)}${row("Tembakan Tepat Sasaran", T[0].sot ?? 0, T[1].sot ?? 0)}${row("xG", T[0].xg || 0, T[1].xg || 0, x => x.toFixed(2).replace(".", ","))}${T[0].pas ? row("Operan Berhasil", pct(T[0].pasc, T[0].pas), pct(T[1].pasc, T[1].pas), x => x + "%") : ""}${row("Sepak Pojok", T[0].cor ?? 0, T[1].cor ?? 0)}${T[0].tck != null ? row("Tekel", T[0].tck, T[1].tck) : ""}${row("Pelanggaran", T[0].fou ?? 0, T[1].fou ?? 0)}${row("Kartu Kuning", T[0].yc ?? 0, T[1].yc ?? 0)}${T[0].off != null ? row("Offside", T[0].off, T[1].off) : ""}</div>`;
}
export function momentumChart(mom, colors, shots, upto = 99) {
  const k = kitPair(colors), W = 320, H = 130, mid = H / 2 - 6, n = mom.length, bw = (W - 20) / n;
  const minToX = m => 10 + (m <= 45 ? (m / 45) * (W - 20) / 2 : (W - 20) / 2 + ((Math.min(m, 90) - 45) / 45) * (W - 20) / 2);
  let bars = "";
  mom.forEach((v, i) => {
    const m0 = (i < n / 2 ? i * 45 / (n / 2) : 45 + (i - n / 2) * 45 / (n / 2));
    if (m0 > upto) return;
    const h = Math.abs(v) * (mid - 8);
    bars += `<rect x="${10 + i * bw + 1}" y="${v >= 0 ? mid - h : mid}" width="${bw - 2}" height="${Math.max(1, h)}" fill="${vis(v >= 0 ? k[0][0] : k[1][0])}" opacity=".9"/>`;
  });
  const goals = shots.filter(s => s.r === "goal" && s.min <= upto).map(s => `<text x="${minToX(s.min)}" y="${s.side === 0 ? 12 : H - 20}" font-size="11" text-anchor="middle">⚽</text>`).join("");
  return `<div class="ch" style="font-size:14px">Momentum Pertandingan</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Momentum pertandingan"><rect x="10" y="4" width="${W - 20}" height="${H - 22}" fill="rgba(255,255,255,.04)" rx="3"/><line x1="10" x2="${W - 10}" y1="${mid}" y2="${mid}" stroke="rgba(255,255,255,.4)"/><line x1="${W / 2}" x2="${W / 2}" y1="4" y2="${H - 18}" stroke="rgba(255,255,255,.25)"/>${bars}${goals}<text x="${W / 4}" y="${H - 4}" font-size="10" fill="#aaa" text-anchor="middle">Babak 1</text><text x="${(3 * W) / 4}" y="${H - 4}" font-size="10" fill="#aaa" text-anchor="middle">Babak 2</text></svg>`;
}
export function xgChart(shots, colors, upto = 99) {
  const k = kitPair(colors), W = 320, H = 150;
  const tot = [0, 0]; const pts = [[[0, 0]], [[0, 0]]];
  for (const s of shots.slice().sort((a, b) => a.min - b.min)) { if (s.min > upto) break; pts[s.side].push([s.min, tot[s.side]]); tot[s.side] += s.xg; pts[s.side].push([s.min, tot[s.side]]); }
  const end = Math.min(upto, 95); pts[0].push([end, tot[0]]); pts[1].push([end, tot[1]]);
  const mx = Math.max(1, tot[0], tot[1]) * 1.1;
  const x = m => 24 + (m / 95) * (W - 32), y = v => H - 18 - (v / mx) * (H - 28);
  const line = (arr, c) => `<polyline fill="none" stroke="${c}" stroke-width="2" points="${arr.map(([m, v]) => `${x(m)},${y(v)}`).join(" ")}"/>`;
  const goals = shots.filter(s => s.r === "goal" && s.min <= upto).map(s => { let before = 0; for (const q of shots) if (q.side === s.side && q.min < s.min) before += q.xg; return `<text x="${x(s.min)}" y="${y(before + s.xg) - 4}" font-size="11" text-anchor="middle">⚽</text>`; }).join("");
  return `<div class="ch" style="font-size:14px;margin-top:12px">Cerita Grafik xG</div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Akumulasi xG"><line x1="24" y1="6" x2="24" y2="${H - 18}" stroke="#bbb"/><line x1="24" y1="${H - 18}" x2="${W - 8}" y2="${H - 18}" stroke="#bbb"/><line x1="${x(45)}" y1="6" x2="${x(45)}" y2="${H - 18}" stroke="rgba(255,255,255,.2)"/>${line(pts[0], vis(k[0][0]))}${line(pts[1], vis(k[1][0]))}${goals}<text x="2" y="${y(mx / 1.1) + 4}" font-size="9" fill="#aaa">${(mx / 1.1).toFixed(1)}</text></svg><div class="muted" style="text-align:center;font-size:13px">xG total: ${tot[0].toFixed(2).replace(".", ",")} – ${tot[1].toFixed(2).replace(".", ",")}</div>`;
}

// ---------- HASIL ----------
register("laga", "hasil", (G, root) => {
  const Sm = G.lastMatch;
  if (!Sm) { go("portal", "ringkasan", {}, true); return; }
  const u = userP(G);
  const H = { club: Sm.home.club, name: Sm.home.name, nat: String(Sm.home.club).startsWith("NT-") ? Sm.home.club.slice(3) : null };
  const A = { club: Sm.away.club, name: Sm.away.name, nat: String(Sm.away.club).startsWith("NT-") ? Sm.away.club.slice(3) : null };
  const pomLine = Sm.lines.find(l => l.id === Sm.pom);
  const me = Sm.user;
  const lines = {}; for (const l of Sm.lines) lines[l.id] = l;
  const T = Sm.teams;
  const shotBox = side => { const sh = Sm.shots.filter(s => s.side === side); const c = r => sh.filter(s => s.r === r).length; return `<div class="shotgrid"><div><b>${c("goal") + c("save")}</b>Tepat Sasaran</div><div><b>${c("save")}</b>Diselamatkan</div><div><b>${c("off")}</b>Melenceng</div><div><b>${c("blk")}</b>Diblok</div></div>`; };
  const fm = side => formationPitch(G, (Sm.lineups?.[side]?.start || []).map(s => ({ ...s, pid: G.players[s.id] ? s.id : null, rating: lines[s.id]?.rating, me: s.id === u.id })), [Sm.home.colors, Sm.away.colors][side], { showPos: true });
  const rt = side => Sm.lines.filter(l => l.side === side).sort((a, b) => b.start - a.start).map(l => `<tr class="${l.id === u.id ? "me" : ""} ${G.players[l.id] ? "click" : ""}" ${G.players[l.id] ? `data-pid="${l.id}"` : ""}><td>${esc(l.name)}${l.start ? "" : ' <span class="muted">(C)</span>'}</td><td class="muted">${l.pos}</td><td class="n">${l.min}'</td><td class="n">${l.gls || ""}</td><td class="n">${l.ast || ""}</td><td>${pill1(l.rating)}${l.id === Sm.pom ? " ★" : ""}</td></tr>`).join("");
  root.innerHTML = `
  <div class="mhead"><div class="cmp">${esc(Sm.comp)}</div>
    <div class="score"><div class="tn" style="text-align:right">${esc(Sm.home.name)}<small>${esc(Sm.managers?.[0] || "")}</small></div>${badge(G, H, 42)}<div class="sc">${Sm.score[0]} - ${Sm.score[1]}</div>${badge(G, A, 42)}<div class="tn" style="text-align:left">${esc(Sm.away.name)}<small>${esc(Sm.managers?.[1] || "")}</small></div></div>
    ${Sm.pens ? `<div class="muted" style="margin-top:4px">${esc(Sm.pens)}</div>` : ""}
    <div class="mmeta"><span>${fmtDay(Sm.date)}</span>${Sm.venue ? `<span>◈ ${esc(Sm.venue)}</span>` : ""}<span>★ ${esc(Sm.pomName)} ${pomLine ? pill(pomLine.rating) : ""}</span></div></div>
  ${me ? `<div class="card" style="border-left:3px solid #ffd54a"><b>Kamu</b>: ${me.min} menit · rating ${pill1(me.rating)}${me.gls ? ` · ${me.gls} gol` : ""}${me.ast ? ` · ${me.ast} assist` : ""}${me.sh ? ` · ${me.sh} tembakan` : ""}${me.pas ? ` · umpan ${me.pasc}/${me.pas}` : ""}${me.drb ? ` · ${me.drb} dribel` : ""}${me.tck ? ` · ${me.tck} tekel` : ""}${me.injured ? ' · <b style="color:var(--bad)">cedera</b>' : ""}</div>` : '<div class="card">Kamu tidak dimainkan di laga ini.</div>'}
  <button class="btn pri" id="cont" style="width:100%;min-height:48px;margin-bottom:10px;font-family:var(--display);font-size:20px">Lanjutkan</button>
  <div class="card"><div class="spread" style="margin-bottom:6px"><b class="disp" style="font-size:17px">${esc(Sm.homeShort || Sm.home.name)}</b><b class="disp" style="font-size:17px">${esc(Sm.awayShort || Sm.away.name)}</b></div>${statBars(T, [Sm.home.colors, Sm.away.colors])}</div>
  <div class="card"><div class="ch">Peristiwa Pertandingan</div><div class="spread" style="margin-bottom:6px"><b>${esc(Sm.homeShort)}</b><b class="disp" style="font-size:20px">${Sm.score[0]} - ${Sm.score[1]}</b><b>${esc(Sm.awayShort)}</b></div>${Sm.events.filter(e => ["goal", "rc", "sub", "inj", "yc"].includes(e.type)).map(evRow).join("") || '<div class="muted">Tidak ada.</div>'}</div>
  <div class="card">${momentumChart(Sm.momentum || [], [Sm.home.colors, Sm.away.colors], Sm.shots || [])}${xgChart(Sm.shots || [], [Sm.home.colors, Sm.away.colors])}</div>
  <div class="card"><div class="ch">${esc(Sm.homeShort)} Formasi</div>${fm(0)}<div class="ch" style="margin-top:12px">${esc(Sm.awayShort)} Formasi</div>${fm(1)}</div>
  <div class="card"><div class="ch">${esc(Sm.home.name)} · Peta Tembakan</div>${shotBox(0)}<div class="ch" style="margin-top:12px">${esc(Sm.away.name)} · Peta Tembakan</div>${shotBox(1)}</div>
  <div class="card"><div class="ch">Rating Pemain</div><div class="tscroll"><table class="tbl"><thead><tr><th>${esc(Sm.home.name)}</th><th></th><th class="n">Mnt</th><th class="n">G</th><th class="n">A</th><th>Rating</th></tr></thead><tbody>${rt(0)}</tbody></table><table class="tbl" style="margin-top:10px"><thead><tr><th>${esc(Sm.away.name)}</th><th></th><th class="n">Mnt</th><th class="n">G</th><th class="n">A</th><th>Rating</th></tr></thead><tbody>${rt(1)}</tbody></table></div></div>`;
  $("#cont", root).onclick = () => { go("portal", "ringkasan", {}, true); S.onGo?.(); };
});
