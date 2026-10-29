// 2D pitch player: replays engine frames on a canvas. The UI around it is built by the match screen.
import { shapePosition } from "./match.js";

const L = 105, W = 68;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = k => 1 - (1 - k) * (1 - k);
function rgb(c) {
  if (!c || !c.startsWith("#")) return [120, 120, 120];
  const h = c.slice(1); const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const lum = c => { const [r, g, b] = rgb(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
const cdist = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
export function kitPair(colors) {
  const k = [colors[0].slice(), colors[1].slice()];
  if (cdist(k[0][0], k[1][0]) < 90) k[1] = [k[1][1], k[1][0]];
  if (cdist(k[0][0], k[1][0]) < 90) k[1] = ["#202a35", "#ffffff"];
  return k;
}

export class PitchPlayer {
  constructor(canvas, R, hooks = {}) {
    this.cv = canvas; this.ctx = canvas.getContext("2d"); this.R = R; this.hooks = hooks;
    this.frames = R.frames; this.endT = this.frames[this.frames.length - 1].t;
    this.h2 = (this.frames.find(f => f.k === "half" && f.h === 2) || { t: 2800 }).t;
    this.kits = kitPair(R.colors);
    const keyT = this.frames.filter(f => f.k === "shot" || f.k === "goal" || f.k === "pen" || f.k === "corner").map(f => f.t);
    this.near = t => keyT.some(k => t >= k - 20 && t <= k + 5);
    this.slots = R.lineups.map(l => l.start.map(s => ({ ...s, x: 52.5, y: 34 })));
    this.evs = R.events.slice().sort((a, b) => a.t - b.t);
    this.t = 0; this.speed = 25; this.hl = true; this.paused = false; this.done = false;
    this.fi = 0; this.evi = 0; this.lastSaid = -1; this.score = [0, 0];
    this.last = performance.now();
    this.resize = this.resize.bind(this); window.addEventListener("resize", this.resize); this.resize();
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  destroy() { cancelAnimationFrame(this.raf); window.removeEventListener("resize", this.resize); this.dead = true; }
  resize() {
    const dpr = window.devicePixelRatio || 1, r = this.cv.getBoundingClientRect();
    this.cv.width = Math.round(r.width * dpr); this.cv.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  minute(t = this.t) { return t < this.h2 ? t / 60 : 45 + (t - this.h2) / 60; }
  clockLabel(t = this.t) {
    if (t < this.h2) { const m = Math.floor(t / 60); return m >= 45 ? `45+${m - 44}'` : `${m + 1}'`; }
    const m = 45 + Math.floor((t - this.h2) / 60);
    return m >= 90 ? `90+${m - 89}'` : `${m + 1}'`;
  }
  finish() {
    if (this.done) return;
    this.done = true;
    while (this.evi < this.evs.length) this.fire(this.evs[this.evi++]);
    this.t = this.endT;
    this.hooks.onEnd?.();
  }
  geom() {
    const r = this.cv.getBoundingClientRect();
    const portrait = r.height > r.width * 1.05;
    const pad = 10, aw = r.width - pad * 2, ah = r.height - pad * 2;
    let sw, sh;
    if (portrait) { const k = Math.min(aw / W, ah / L); sw = W * k; sh = L * k; }
    else { const k = Math.min(aw / L, ah / W); sw = L * k; sh = W * k; }
    const ox = (r.width - sw) / 2, oy = (r.height - sh) / 2;
    const P = portrait ? (x, y) => [ox + (y / W) * sw, oy + (1 - x / L) * sh] : (x, y) => [ox + (x / L) * sw, oy + (y / W) * sh];
    return { P, k: portrait ? sw / W : sw / L, r };
  }
  drawPitch({ P, k, r }) {
    const c = this.ctx;
    c.fillStyle = "#0d1a12"; c.fillRect(0, 0, r.width, r.height);
    for (let i = 0; i < 12; i++) {
      const [ax, ay] = P((L / 12) * i, 0), [bx, by] = P((L / 12) * (i + 1), W);
      c.fillStyle = i % 2 ? "#2a6b3d" : "#2f7544";
      c.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    }
    c.strokeStyle = "rgba(255,255,255,.7)"; c.lineWidth = Math.max(1, k * 0.18);
    const rect = (x0, y0, x1, y1) => { const [a, b] = P(x0, y0), [d, e] = P(x1, y1); c.strokeRect(Math.min(a, d), Math.min(b, e), Math.abs(d - a), Math.abs(e - b)); };
    rect(0, 0, L, W);
    const [m1x, m1y] = P(L / 2, 0), [m2x, m2y] = P(L / 2, W); c.beginPath(); c.moveTo(m1x, m1y); c.lineTo(m2x, m2y); c.stroke();
    const [cx, cy] = P(L / 2, W / 2); c.beginPath(); c.arc(cx, cy, 9.15 * k, 0, Math.PI * 2); c.stroke();
    rect(0, W / 2 - 20.16, 16.5, W / 2 + 20.16); rect(L - 16.5, W / 2 - 20.16, L, W / 2 + 20.16);
    rect(0, W / 2 - 9.16, 5.5, W / 2 + 9.16); rect(L - 5.5, W / 2 - 9.16, L, W / 2 + 9.16);
    c.lineWidth = Math.max(2, k * 0.5); c.strokeStyle = "#fff";
    rect(-1.2, W / 2 - 3.66, 0, W / 2 + 3.66); rect(L, W / 2 - 3.66, L + 1.2, W / 2 + 3.66);
  }
  frameAt(tt) {
    const F = this.frames;
    while (this.fi < F.length - 2 && F[this.fi + 1].t <= tt) this.fi++;
    while (this.fi > 0 && F[this.fi].t > tt) this.fi--;
    return this.fi;
  }
  ar(side, h) { return (side === 0) === (h === 1); }
  ballAt(tt) {
    const i = this.frameAt(tt), a = this.frames[i], b = this.frames[i + 1] || a;
    const gap = Math.max(0.01, b.t - a.t), d = Math.hypot(b.x - a.x, b.y - a.y);
    const travel = clamp(d / 17 + 0.25, 0.3, gap);
    const k = clamp((tt - a.t) / travel, 0, 1);
    let x = a.x + (b.x - a.x) * ease(k), y = a.y + (b.y - a.y) * ease(k), z = 0;
    if (a.k === "shot" || a.k === "pen") {
      const gx = this.ar(a.s, a.h) ? L + 0.5 : -0.5, ts = 0.6;
      if (tt - a.t < ts) { const q = (tt - a.t) / ts; x = a.x + (gx - a.x) * q; y = a.y + (34 + (a.r === "off" ? 6 : 1) - a.y) * q; }
    }
    if (["long", "cross"].includes(b.k) || ["long", "cross"].includes(a.k)) z = Math.sin(Math.PI * k) * Math.min(6, d / 6);
    return { x, y, z, i, a, b };
  }
  fire(e) {
    if (e.type === "goal") this.score[e.side]++;
    if (e.type === "rc") { const s = this.slots[e.side].find(x => x.id === e.pid); if (s) s.gone = true; }
    if (e.type === "sub") { const s = this.slots[e.side].find(x => x.id === e.offId); if (s) { this.slots[e.side].push({ id: e.pid, pos: s.pos, sx: s.sx, sy: s.sy, x: s.x, y: s.y, no: e.no }); s.gone = true; } }
    this.hooks.onEvent?.(e, this);
  }
  update(tt, ball, dt) {
    const a = ball.a, b = ball.b;
    while (this.evi < this.evs.length && this.evs[this.evi].t <= tt) this.fire(this.evs[this.evi++]);
    for (let side = 0; side < 2; side++) {
      const atk = this.ar(side, a.h);
      const Fx = atk ? ball.x : L - ball.x, Fy = atk ? ball.y : W - ball.y;
      for (const s of this.slots[side]) {
        if (s.gone) continue;
        const q = shapePosition(s.sx, s.sy, s.pos, a.s === side, Fx, Fy);
        let tx = atk ? q.x : L - q.x, ty = atk ? q.y : W - q.y;
        tx += Math.sin(tt / 9 + s.id) * 1.4; ty += Math.cos(tt / 11 + s.id * 1.7) * 1.4;
        if (a.c === s.id) { tx = ball.x; ty = ball.y; } else if (!a.c && b.c === s.id) { tx = b.x; ty = b.y; }
        s.tx = tx; s.ty = ty;
      }
    }
    const def = 1 - a.s; let best = null, bd = 1e9;
    for (const s of this.slots[def]) { if (s.gone || s.pos === "GK") continue; const d = Math.hypot(s.x - ball.x, s.y - ball.y); if (d < bd) { bd = d; best = s; } }
    if (best && bd < 14) { const dir = this.ar(def, a.h) ? -1 : 1; best.tx = ball.x - dir * 1.6; best.ty = ball.y + 0.8; }
    const step = 8.8 * dt;
    for (const side of this.slots) for (const s of side) {
      if (s.gone) continue;
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
      if (d <= step || d > 40) { s.x = s.tx; s.y = s.ty; } else { s.x += dx / d * step; s.y += dy / d * step; }
    }
  }
  narrate(i) {
    if (i <= this.lastSaid) { this.lastSaid = i; return; }
    for (let j = this.lastSaid + 1; j <= i; j++) { const f = this.frames[j]; if (f) this.hooks.onFrame?.(f, this); }
    this.lastSaid = i;
  }
  drawPlayers({ P, k }, ball) {
    const c = this.ctx, R = this.R;
    const rad = Math.max(7, k * 1.35);
    c.textAlign = "center"; c.textBaseline = "middle";
    for (let side = 0; side < 2; side++) for (const s of this.slots[side]) {
      if (s.gone) continue;
      const [x, y] = P(s.x, s.y); const info = R.info[s.id] || {};
      const gk = s.pos === "GK"; const fill = gk ? (side ? "#3fc1d6" : "#d8c43c") : this.kits[side][0];
      c.beginPath(); c.arc(x, y + 1.5, rad, 0, Math.PI * 2); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
      c.beginPath(); c.arc(x, y, rad, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
      c.lineWidth = 2; c.strokeStyle = gk ? "#111" : this.kits[side][1]; c.stroke();
      if (info.user) { c.beginPath(); c.arc(x, y, rad + 4, 0, Math.PI * 2); c.lineWidth = 3; c.strokeStyle = "#ffd54a"; c.stroke(); }
      c.font = `700 ${Math.round(rad * 1.0)}px "Source Sans 3", sans-serif`;
      c.fillStyle = lum(fill) > 0.6 ? "#111" : "#fff"; c.fillText(info.num ?? "", x, y + 0.5);
      if (info.user || ball.a.c === s.id) {
        c.font = `600 12px "Source Sans 3", sans-serif`;
        const label = info.name || "", w = c.measureText(label).width + 8;
        c.fillStyle = info.user ? "#ffd54a" : "rgba(10,16,22,.85)"; c.fillRect(x - w / 2, y - rad - 18, w, 15);
        c.fillStyle = info.user ? "#111" : "#fff"; c.fillText(label, x, y - rad - 10.5);
      }
    }
    const [bx, by] = P(ball.x, ball.y), br = Math.max(3.5, k * 0.55) * (1 + ball.z / 10);
    c.beginPath(); c.arc(bx + ball.z * 1.2, by + 2 + ball.z * 1.5, Math.max(3, k * 0.5), 0, Math.PI * 2); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
    c.beginPath(); c.arc(bx, by - ball.z * 1.5, br, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 1; c.strokeStyle = "#111"; c.stroke();
  }
  loop(now) {
    if (this.dead) return;
    const realDt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const sp = this.hl ? (this.near(this.t) ? 3 : 70) : this.speed;
    if (!this.paused && !this.done) { this.t += realDt * sp; if (this.t >= this.endT) { this.t = this.endT; this.finish(); } }
    const g = this.geom(), ball = this.ballAt(this.t);
    this.update(this.t, ball, this.paused ? 0 : realDt * sp);
    this.narrate(ball.i);
    this.drawPitch(g); this.drawPlayers(g, ball);
    this.hooks.onTick?.(this);
    this.raf = requestAnimationFrame(this.loop);
  }
}
