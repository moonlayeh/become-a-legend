// 2D match viewer: replays engine frames on a canvas pitch.
import { shapePosition } from "./match.js";

const L = 105, W = 68;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = k => 1 - (1 - k) * (1 - k);
function hexToRgb(c) {
  if (c.startsWith("hsl")) return [120, 120, 120];
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lum = c => { const [r, g, b] = hexToRgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const cdist = (a, b) => { const x = hexToRgb(a), y = hexToRgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };

export function openViewer(R, onDone) {
  const frames = R.frames;
  const endT = frames[frames.length - 1].t;
  const h2 = (frames.find(f => f.k === "half" && f.h === 2) || { t: 2800 }).t;
  const kits = [R.colors[0].slice(), R.colors[1].slice()];
  if (cdist(kits[0][0], kits[1][0]) < 90) kits[1] = [kits[1][1], kits[1][0]];
  if (cdist(kits[0][0], kits[1][0]) < 90) kits[1] = ["#202a35", "#ffffff"];

  // keyframes for highlight mode
  const keyT = frames.filter(f => f.k === "shot" || f.k === "goal" || f.k === "pen").map(f => f.t);
  const near = t => keyT.some(k => t >= k - 22 && t <= k + 5);

  // on-pitch slots per side
  const slots = R.lineups.map(l => l.start.map(s => ({ ...s, x: 52.5, y: 34 })));
  const evs = R.events.slice().sort((a, b) => a.t - b.t);

  const el = document.createElement("div");
  el.className = "viewer";
  el.innerHTML = `
    <div class="vbar">
      <button class="btn small" data-a="close" aria-label="Tutup">✕</button>
      <div class="vscore"><span class="kit" style="background:${kits[0][0]}"></span><span class="hn"></span><span class="sc num">0 - 0</span><span class="an"></span><span class="kit" style="background:${kits[1][0]}"></span></div>
      <div class="clock">0'</div>
    </div>
    <canvas></canvas>
    <div class="feed" aria-live="polite"></div>
    <div class="ctrl">
      <button class="btn small" data-a="pause">Jeda</button>
      <button class="btn small" data-a="mode" aria-pressed="true">Sorotan</button>
      <button class="btn small" data-s="10">×10</button>
      <button class="btn small" data-s="25" aria-pressed="true">×25</button>
      <button class="btn small" data-s="60">×60</button>
      <button class="btn small primary" data-a="end">Ke akhir</button>
    </div>`;
  document.body.appendChild(el);
  const cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
  const $sc = el.querySelector(".sc"), $clock = el.querySelector(".clock"), $feed = el.querySelector(".feed");
  el.querySelector(".hn").textContent = R.short?.[0] || shortTeam(R.names[0]);
  el.querySelector(".an").textContent = R.short?.[1] || shortTeam(R.names[1]);

  let t = 0, speed = 25, hl = true, paused = false, done = false, fi = 0, evi = 0, last = performance.now(), raf = 0;
  const lines = [];
  const say = s => { lines.unshift(s); lines.length = Math.min(lines.length, 3); $feed.innerHTML = lines.map(x => `<p>${x}</p>`).join(""); };
  say("Sepak mula!");
  const score = [0, 0];
  const nameOf = id => (R.info[id] ? R.info[id].name : "");
  const teamName = s => R.names[s];

  el.addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.s) { speed = +b.dataset.s; el.querySelectorAll("[data-s]").forEach(x => x.setAttribute("aria-pressed", x === b)); }
    const a = b.dataset.a;
    if (a === "pause") { paused = !paused; b.textContent = paused ? "Lanjut" : "Jeda"; }
    if (a === "mode") { hl = !hl; b.setAttribute("aria-pressed", hl); }
    if (a === "end") { finish(); }
    if (a === "close") { if (!done) finish(); close(); }
  });

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = cv.getBoundingClientRect();
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  function geom() {
    const r = cv.getBoundingClientRect();
    const portrait = r.height > r.width * 1.05;
    const pad = 14;
    const aw = r.width - pad * 2, ah = r.height - pad * 2;
    let sw, sh;
    if (portrait) { const k = Math.min(aw / W, ah / L); sw = W * k; sh = L * k; }
    else { const k = Math.min(aw / L, ah / W); sw = L * k; sh = W * k; }
    const ox = (r.width - sw) / 2, oy = (r.height - sh) / 2;
    const P = portrait ? (x, y) => [ox + (y / W) * sw, oy + (1 - x / L) * sh] : (x, y) => [ox + (x / L) * sw, oy + (y / W) * sh];
    return { P, portrait, sw, sh, ox, oy, k: portrait ? sw / W : sw / L, r };
  }

  function drawPitch(g) {
    const { P, k, r } = g;
    ctx.fillStyle = "#0a1016"; ctx.fillRect(0, 0, r.width, r.height);
    // stripes
    for (let i = 0; i < 12; i++) {
      const x0 = (L / 12) * i, x1 = (L / 12) * (i + 1);
      const [ax, ay] = P(x0, 0), [bx, by] = P(x1, W);
      ctx.fillStyle = i % 2 ? "#2a6b3d" : "#2f7544";
      ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }
    ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = Math.max(1, k * 0.18);
    const rect = (x0, y0, x1, y1) => { const [a, b] = P(x0, y0), [c, d] = P(x1, y1); ctx.strokeRect(Math.min(a, c), Math.min(b, d), Math.abs(c - a), Math.abs(d - b)); };
    rect(0, 0, L, W);
    const [m1x, m1y] = P(L / 2, 0), [m2x, m2y] = P(L / 2, W);
    ctx.beginPath(); ctx.moveTo(m1x, m1y); ctx.lineTo(m2x, m2y); ctx.stroke();
    const [cx, cy] = P(L / 2, W / 2);
    ctx.beginPath(); ctx.arc(cx, cy, 9.15 * k, 0, Math.PI * 2); ctx.stroke();
    rect(0, W / 2 - 20.16, 16.5, W / 2 + 20.16); rect(L - 16.5, W / 2 - 20.16, L, W / 2 + 20.16);
    rect(0, W / 2 - 9.16, 5.5, W / 2 + 9.16); rect(L - 5.5, W / 2 - 9.16, L, W / 2 + 9.16);
    ctx.lineWidth = Math.max(2, k * 0.5); ctx.strokeStyle = "#fff";
    rect(-1.2, W / 2 - 3.66, 0, W / 2 + 3.66); rect(L, W / 2 - 3.66, L + 1.2, W / 2 + 3.66);
  }

  function frameAt(tt) {
    while (fi < frames.length - 2 && frames[fi + 1].t <= tt) fi++;
    while (fi > 0 && frames[fi].t > tt) fi--;
    return fi;
  }
  const ar = (side, h) => (side === 0) === (h === 1);

  function ballAt(tt) {
    const i = frameAt(tt), a = frames[i], b = frames[i + 1] || a;
    const gap = Math.max(0.01, b.t - a.t);
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    let travel = clamp(d / 17 + 0.25, 0.3, gap);
    let k = clamp((tt - a.t) / travel, 0, 1);
    let x = a.x + (b.x - a.x) * ease(k), y = a.y + (b.y - a.y) * ease(k);
    let z = 0;
    if (a.k === "shot" || a.k === "pen") {
      // shot flies at goal first
      const gx = ar(a.s, a.h) ? L + 0.5 : -0.5;
      const tShot = 0.6;
      if (tt - a.t < tShot) { const q = (tt - a.t) / tShot; x = a.x + (gx - a.x) * q; y = a.y + (34 + (a.r === "off" ? 6 : 1) - a.y) * q; }
    }
    if (b.k === "long" || b.k === "cross" || (a.k === "long" || a.k === "cross")) z = Math.sin(Math.PI * k) * Math.min(6, d / 6);
    return { x, y, z, i, a, b };
  }

  function updateSlots(tt, ball, dt) {
    const a = ball.a, b = ball.b;
    // subs & red cards
    while (evi < evs.length && evs[evi].t <= tt) { handleEvent(evs[evi]); evi++; }
    for (let side = 0; side < 2; side++) {
      const atk = ar(side, a.h);
      const Fx = atk ? ball.x : L - ball.x, Fy = atk ? ball.y : W - ball.y;
      for (const s of slots[side]) {
        if (s.gone) continue;
        const q = shapePosition(s.sx, s.sy, s.pos, a.s === side, Fx, Fy);
        let tx = atk ? q.x : L - q.x, ty = atk ? q.y : W - q.y;
        tx += Math.sin(tt / 9 + s.id) * 1.4; ty += Math.cos(tt / 11 + s.id * 1.7) * 1.4;
        if (a.c === s.id) { tx = ball.x; ty = ball.y; }
        else if (!a.c && b.c === s.id) { tx = b.x; ty = b.y; }
        s.tx = tx; s.ty = ty;
      }
    }
    // the nearest defender closes down the ball
    const def = 1 - a.s;
    let best = null, bd = 1e9;
    for (const s of slots[def]) { if (s.gone || s.pos === "GK") continue; const d = Math.hypot(s.x - ball.x, s.y - ball.y); if (d < bd) { bd = d; best = s; } }
    if (best && bd < 14) { const dir = ar(def, a.h) ? -1 : 1; best.tx = ball.x - dir * 1.6; best.ty = ball.y + 0.8; }
    const maxStep = 8.8 * dt;
    for (const side of slots) for (const s of side) {
      if (s.gone) continue;
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
      if (d <= maxStep || d > 40) { s.x = s.tx; s.y = s.ty; } else { s.x += dx / d * maxStep; s.y += dy / d * maxStep; }
    }
  }

  function handleEvent(e) {
    const side = e.side;
    if (e.type === "goal") { score[side]++; $sc.textContent = `${score[0]} - ${score[1]}`; say(`<b>GOL!</b> ${e.name} (${teamName(side)})${e.ast ? ` · assist ${e.ast}` : ""}${e.kind === "pen" ? " · penalti" : e.kind === "fk" ? " · tendangan bebas" : e.kind === "hdr" ? " · sundulan" : ""}`); }
    if (e.type === "yc") say(`Kartu kuning: ${e.name} (${teamName(side)})`);
    if (e.type === "rc") { say(`<b>Kartu merah!</b> ${e.name} (${teamName(side)})`); const s = slots[side].find(x => x.id === e.pid); if (s) s.gone = true; }
    if (e.type === "inj") say(`${e.name} cedera dan butuh perawatan.`);
    if (e.type === "pen") say(`<b>Penalti</b> untuk ${teamName(side)}!`);
    if (e.type === "penmiss") say(`Penalti gagal!`);
    if (e.type === "sub") {
      const s = slots[side].find(x => x.id === e.offId);
      if (s) { slots[side].push({ id: e.pid, pos: s.pos, sx: s.sx, sy: s.sy, x: s.x, y: s.y }); s.gone = true; }
      say(`Pergantian ${teamName(side)}: ${e.name} masuk, ${e.off} keluar.`);
    }
  }

  let lastFrameSaid = -1;
  function narrate(i) {
    if (i === lastFrameSaid) return;
    for (let j = lastFrameSaid + 1; j <= i; j++) {
      const f = frames[j]; if (!f) continue;
      const nm = f.c ? nameOf(f.c) : "";
      if (f.k === "shot") say(f.r === "save" ? `${nm} menembak, ditepis kiper.` : f.r === "blk" ? `Tembakan ${nm} diblok.` : `${nm} menembak, melebar.`);
      if (f.k === "corner") say(`Sepak pojok untuk ${teamName(f.s)}.`);
      if (f.k === "fk" && f.c) say(`Tendangan bebas untuk ${teamName(f.s)}.`);
      if (f.k === "half" && f.h === 2) say("Babak kedua dimulai.");
      if (f.k === "end" && f.h === 1) say("Turun minum.");
    }
    lastFrameSaid = i;
  }

  function drawPlayers(g, ball) {
    const { P, k } = g;
    const rad = Math.max(7, k * 1.35);
    ctx.font = `700 ${Math.round(rad * 1.05)}px "Source Sans 3", sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (let side = 0; side < 2; side++) for (const s of slots[side]) {
      if (s.gone) continue;
      const [x, y] = P(s.x, s.y);
      const info = R.info[s.id] || {};
      const gk = s.pos === "GK";
      const fill = gk ? (side ? "#3fc1d6" : "#d8c43c") : kits[side][0];
      ctx.beginPath(); ctx.arc(x, y + 1.5, rad, 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = gk ? "#111" : kits[side][1]; ctx.stroke();
      if (info.user) { ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.strokeStyle = "#ffd54a"; ctx.stroke(); }
      ctx.fillStyle = lum(fill) > 0.6 ? "#111" : "#fff";
      ctx.fillText(info.num ?? "", x, y + 0.5);
      if (info.user || ball.a.c === s.id) {
        ctx.font = `600 12px "Source Sans 3", sans-serif`;
        const label = info.name || "";
        const w = ctx.measureText(label).width + 8;
        ctx.fillStyle = info.user ? "#ffd54a" : "rgba(10,16,22,.8)";
        ctx.fillRect(x - w / 2, y - rad - 18, w, 15);
        ctx.fillStyle = info.user ? "#111" : "#fff";
        ctx.fillText(label, x, y - rad - 10.5);
        ctx.font = `700 ${Math.round(rad * 1.05)}px "Source Sans 3", sans-serif`;
      }
    }
    // ball
    const [bx, by] = P(ball.x, ball.y);
    const br = Math.max(3.5, k * 0.55) * (1 + ball.z / 10);
    ctx.beginPath(); ctx.arc(bx + ball.z * 1.2, by + 2 + ball.z * 1.5, Math.max(3, k * 0.5), 0, Math.PI * 2); ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fill();
    ctx.beginPath(); ctx.arc(bx, by - ball.z * 1.5, br, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#111"; ctx.stroke();
  }

  function clockLabel(tt, h) {
    if (h === 1) { const m = Math.floor(tt / 60); return m >= 45 ? `45+${m - 44}'` : `${m + 1}'`; }
    const m = 45 + Math.floor((tt - h2) / 60);
    return m >= 90 ? `90+${m - 89}'` : `${m + 1}'`;
  }

  function loop(now) {
    const realDt = Math.min(0.1, (now - last) / 1000); last = now;
    if (!paused && !done) {
      const sp = hl ? (near(t) ? 3 : 70) : speed;
      t += realDt * sp;
      if (t >= endT) { t = endT; finish(true); }
    }
    const g = geom();
    const ball = ballAt(t);
    updateSlots(t, ball, paused ? 0 : realDt * (hl ? (near(t) ? 3 : 70) : speed));
    narrate(ball.i);
    drawPitch(g);
    drawPlayers(g, ball);
    $clock.textContent = clockLabel(t, ball.a.h);
    if (!closed) raf = requestAnimationFrame(loop);
  }
  let closed = false;
  function finish(natural) {
    if (done) { close(); return; }
    done = true;
    // apply remaining events so the score is right
    while (evi < evs.length) { handleEvent(evs[evi]); evi++; }
    t = endT;
    say("<b>Peluit panjang.</b>");
    const btn = el.querySelector('[data-a="end"]');
    btn.textContent = "Lihat hasil";
  }
  function close() {
    closed = true; cancelAnimationFrame(raf); window.removeEventListener("resize", resize); el.remove(); onDone && onDone();
  }
  raf = requestAnimationFrame(loop);
}
const shortTeam = n => (n.length > 14 ? n.split(" ").filter(w => w.length > 2).slice(-1)[0] || n.slice(0, 12) : n);
