// 2D pitch player: replays engine frames on a canvas. The UI around it is built by the match screen.
import { shapePosition } from "./match.js";

const L = 105, W = 68;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = k => 1 - (1 - k) * (1 - k);
const easeIO = k => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
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
    this.frames = R.frames;
    // a live match keeps growing while the user answers key moments; a replay is complete from the start
    this.live = !!R.live; this.complete = !this.live; this.waiting = false;
    this.kits = kitPair(R.colors);
    this.keyT = []; this.near = t => this.keyT.some(k => t >= k - 20 && t <= k + 5);
    this.slots = R.lineups.map(l => l.start.map(s => ({ ...s, x: 52.5, y: 34, vx: 0, vy: 0, fx: 0, fy: -1, ph: Math.random() * 6 })));
    this.spNow = 25; this.trail = [];
    this.evs = []; this.evSeen = 0; this.keySeen = 0;
    this.sync();
    this.t = 0; this.speed = 25; this.hl = true; this.paused = false; this.done = false;
    this.fi = 0; this.evi = 0; this.lastSaid = -1; this.score = [0, 0];
    this.last = performance.now();
    this.resize = this.resize.bind(this); window.addEventListener("resize", this.resize); this.resize();
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }
  // pick up frames and events the engine has added since the last call
  sync() {
    const F = this.frames;
    this.endT = F.length ? F[F.length - 1].t : 0;
    const h2 = F.find(f => f.k === "half" && f.h === 2); this.h2 = h2 ? h2.t : Infinity;
    for (; this.keySeen < F.length; this.keySeen++) { const f = F[this.keySeen]; if (f.k === "shot" || f.k === "goal" || f.k === "pen" || f.k === "corner") this.keyT.push(f.t); }
    const src = this.R.events;
    if (src.length > this.evSeen) {
      const add = src.slice(this.evSeen).map(e => this.hooks.mapEvent ? this.hooks.mapEvent(e) : e);
      this.evSeen = src.length;
      this.evs.push(...add); this.evs.sort((a, b) => a.t - b.t);
    }
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
    const carried = a.c && b.c === a.c; // dribble: the carrier runs with the ball the whole time
    const travel = carried ? gap : clamp(d / (["long", "cross"].includes(b.k) ? 22 : 15) + 0.2, 0.25, gap);
    const k = clamp((tt - a.t) / travel, 0, 1);
    const e = carried ? k : easeIO(k);
    let x = a.x + (b.x - a.x) * e, y = a.y + (b.y - a.y) * e, z = 0;
    if (a.k === "shot" || a.k === "pen") {
      const gx = this.ar(a.s, a.h) ? L + 0.5 : -0.5, ts = 0.6;
      if (tt - a.t < ts) { const q = (tt - a.t) / ts; x = a.x + (gx - a.x) * q; y = a.y + (34 + (a.r === "off" ? 6 : 1) - a.y) * q; }
    }
    if (["long", "cross"].includes(b.k) || ["long", "cross"].includes(a.k)) z = Math.sin(Math.PI * k) * Math.min(6, d / 6);
    return { x, y, z, i, a, b, held: !!a.c && !carried && k >= 1 };
  }
  fire(e) {
    if (e.type === "goal") this.score[e.side]++;
    if (e.type === "rc") { const s = this.slots[e.side].find(x => x.id === e.pid); if (s) s.gone = true; }
    if (e.type === "sub") { const s = this.slots[e.side].find(x => x.id === e.offId); if (s) { this.slots[e.side].push({ id: e.pid, pos: s.pos, sx: s.sx, sy: s.sy, x: s.x, y: s.y, no: e.no }); s.gone = true; } }
    this.hooks.onEvent?.(e, this);
  }
  update(tt, ball, dt) {
    const a = ball.a, b = ball.b, F = this.frames;
    const c2 = F[ball.i + 2];
    while (this.evi < this.evs.length && this.evs[this.evi].t <= tt) this.fire(this.evs[this.evi++]);
    // who is about to receive the ball: run to meet it
    const receiver = !b.c && c2 && c2.c ? c2.c : b.c && b.c !== a.c ? b.c : null;
    for (let side = 0; side < 2; side++) {
      const atk = this.ar(side, a.h);
      const Fx = atk ? ball.x : L - ball.x, Fy = atk ? ball.y : W - ball.y;
      for (const s of this.slots[side]) {
        if (s.gone) continue;
        const q = shapePosition(s.sx, s.sy, s.pos, a.s === side, Fx, Fy);
        let tx = atk ? q.x : L - q.x, ty = atk ? q.y : W - q.y;
        // smooth personal drift so the shape breathes instead of sliding as a block
        tx += Math.sin(tt / 7 + s.id) * 1.6 + Math.sin(tt / 3.1 + s.id * 2.3) * 0.5;
        ty += Math.cos(tt / 9 + s.id * 1.7) * 1.8 + Math.cos(tt / 2.7 + s.id) * 0.5;
        // attacking runs: forwards push beyond the ball when their team has it
        if (a.s === side && /ST|AM/.test(s.pos)) { const dir = atk ? 1 : -1; tx += dir * (2.5 + 2 * Math.sin(tt / 5 + s.id)); }
        s.chase = false;
        if (a.c === s.id || (b.c === s.id && a.c === s.id)) { tx = ball.x; ty = ball.y; s.chase = true; }
        else if (receiver === s.id) { const tgt = !b.c ? b : b; tx = tgt.x; ty = tgt.y; s.chase = true; }
        s.tx = clamp(tx, -1, L + 1); s.ty = clamp(ty, -1, W + 1);
      }
    }
    // nearest defender closes the ball down
    const def = 1 - a.s; let best = null, bd = 1e9;
    for (const s of this.slots[def]) { if (s.gone || s.pos === "GK") continue; const d = Math.hypot(s.x - ball.x, s.y - ball.y); if (d < bd) { bd = d; best = s; } }
    if (best && bd < 16) { const dir = this.ar(def, a.h) ? -1 : 1; best.tx = ball.x - dir * 1.8; best.ty = ball.y + 0.6; best.chase = true; }
    // steering: accelerate towards the target, ease into position (sub-steps keep fast playback stable)
    let rem = Math.min(dt, 4);
    while (rem > 1e-4) {
      const h = Math.min(0.12, rem); rem -= h;
      for (const side of this.slots) for (const s of side) {
        if (s.gone) continue;
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        if (d > 32) { s.x = s.tx; s.y = s.ty; s.vx = s.vy = 0; continue; }
        const vmax = s.chase ? 7.6 : s.pos === "GK" ? 4 : 5.2;
        const want = Math.min(vmax, d * 1.6);
        const wx = d > 0.01 ? dx / d * want : 0, wy = d > 0.01 ? dy / d * want : 0;
        const acc = s.chase ? 9 : 5.5, kk = Math.min(1, acc * h / Math.max(0.5, Math.hypot(wx - s.vx, wy - s.vy)));
        s.vx += (wx - s.vx) * kk; s.vy += (wy - s.vy) * kk;
        s.x += s.vx * h; s.y += s.vy * h;
        const sp = Math.hypot(s.vx, s.vy);
        if (sp > 0.4) { s.fx += (s.vx / sp - s.fx) * Math.min(1, h * 6); s.fy += (s.vy / sp - s.fy) * Math.min(1, h * 6); }
        s.ph += sp * h * 1.9;
      }
    }
    // a held ball sits at the carrier's feet
    if (ball.held) {
      const s = this.slots.flat().find(q => q.id === a.c && !q.gone);
      if (s) { const n = Math.hypot(s.fx, s.fy) || 1; ball.x = s.x + s.fx / n * 0.8; ball.y = s.y + s.fy / n * 0.8; }
    }
  }
  narrate(i) {
    if (i <= this.lastSaid) { this.lastSaid = i; return; }
    for (let j = this.lastSaid + 1; j <= i; j++) { const f = this.frames[j]; if (f) this.hooks.onFrame?.(f, this, j); }
    this.lastSaid = i;
  }
  drawPlayers({ P, k }, ball) {
    const c = this.ctx, R = this.R;
    const rad = Math.max(7, k * 1.35);
    c.textAlign = "center"; c.textBaseline = "middle";
    for (let side = 0; side < 2; side++) for (const s of this.slots[side]) {
      if (s.gone) continue;
      const [x0, y0] = P(s.x, s.y); const info = R.info[s.id] || {};
      const spd = Math.hypot(s.vx, s.vy), bob = Math.min(1, spd / 6) * Math.sin(s.ph) * rad * 0.08;
      const x = x0, y = y0 + bob;
      const gk = s.pos === "GK"; const fill = gk ? (side ? "#3fc1d6" : "#d8c43c") : this.kits[side][0];
      c.beginPath(); c.arc(x0, y0 + 1.5, rad, 0, Math.PI * 2); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
      // facing notch
      const [fxp, fyp] = P(s.x + s.fx, s.y + s.fy); const ang = Math.atan2(fyp - y0, fxp - x0);
      c.beginPath(); c.moveTo(x + Math.cos(ang) * (rad + 4), y + Math.sin(ang) * (rad + 4)); c.lineTo(x + Math.cos(ang + 0.5) * rad, y + Math.sin(ang + 0.5) * rad); c.lineTo(x + Math.cos(ang - 0.5) * rad, y + Math.sin(ang - 0.5) * rad); c.closePath(); c.fillStyle = this.kits[side][1]; c.fill();
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
    this.trail.push([bx, by - ball.z * 1.5]); if (this.trail.length > 7) this.trail.shift();
    for (let i = 0; i < this.trail.length - 1; i++) { const [tx, ty] = this.trail[i]; c.beginPath(); c.arc(tx, ty, br * (0.3 + i / 14), 0, Math.PI * 2); c.fillStyle = `rgba(255,255,255,${0.05 + i * 0.03})`; c.fill(); }
    c.beginPath(); c.arc(bx + ball.z * 1.2, by + 2 + ball.z * 1.5, Math.max(3, k * 0.5), 0, Math.PI * 2); c.fillStyle = "rgba(0,0,0,.35)"; c.fill();
    c.beginPath(); c.arc(bx, by - ball.z * 1.5, br, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.lineWidth = 1; c.strokeStyle = "#111"; c.stroke();
  }
  loop(now) {
    if (this.dead) return;
    const realDt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const approaching = !this.complete && this.endT - this.t < 14; // slow down into the user's key moment
    const target = this.hl ? (this.near(this.t) || approaching ? 2.5 : 45) : approaching ? Math.min(this.speed, 4) : this.speed;
    // ease between playback speeds so highlights don't jerk
    this.spNow += (target - this.spNow) * Math.min(1, realDt * (target < this.spNow ? 6 : 2));
    const sp = this.spNow;
    if (!this.paused && !this.done && !this.waiting) {
      this.t += realDt * sp;
      if (this.t >= this.endT) {
        this.t = this.endT;
        if (this.complete) this.finish(); else { this.waiting = true; this.hooks.onWait?.(this); }
      }
    }
    const g = this.geom(), ball = this.ballAt(this.t);
    this.update(this.t, ball, this.paused ? 0 : this.waiting ? realDt * 1.5 : realDt * sp);
    this.narrate(ball.i);
    this.drawPitch(g); this.drawPlayers(g, ball);
    this.hooks.onTick?.(this);
    this.raf = requestAnimationFrame(this.loop);
  }
}
