// Match engine. Simulates a match action-by-action from player attributes and records
// ball events that the 2D viewer replays. Team shapes are computed by shapePosition(),
// which the viewer shares, so dots on screen match the engine's geometry.
import { clamp } from "./rng.js";
import { A } from "./attributes.js";

export const FORMATIONS = {
  "4-3-3": [["GK",4,34],["DR",30,58],["DC",24,43],["DC",24,25],["DL",30,10],["DM",40,34],["MC",52,48],["MC",52,20],["AMR",74,60],["ST",84,34],["AML",74,8]],
  "4-2-3-1": [["GK",4,34],["DR",30,58],["DC",24,43],["DC",24,25],["DL",30,10],["DM",42,45],["DM",42,23],["AMR",70,59],["AMC",66,34],["AML",70,9],["ST",84,34]],
  "4-4-2": [["GK",4,34],["DR",30,58],["DC",24,43],["DC",24,25],["DL",30,10],["MR",58,58],["MC",50,42],["MC",50,26],["ML",58,10],["ST",80,42],["ST",80,26]],
  "3-5-2": [["GK",4,34],["DC",24,49],["DC",22,34],["DC",24,19],["WBR",50,62],["WBL",50,6],["DM",40,34],["MC",54,46],["MC",54,22],["ST",80,42],["ST",80,26]],
};

const L = 105, W = 68;
const DEF = new Set(["GK","DC","DR","DL","WBR","WBL"]);
const ATT = new Set(["ST","AMC","AMR","AML"]);

// Position of a formation slot in its team's frame (attacking toward x=105).
export function shapePosition(sx, sy, pos, inPoss, bx, by) {
  if (pos === "GK") return { x: 4 + clamp((bx - 35) * 0.13, 0, 13), y: 34 + (by - 34) * 0.12 };
  let x, y;
  if (inPoss) {
    x = 0.65 * sx + 0.45 * bx - 2; y = 34 + (sy - 34) * 1.05 + (by - 34) * 0.25;
    if (bx > 62 && sx >= 48 && sx < 82) x += (bx - 62) * 0.32; // midfielders and wide forwards arrive late in the box
    if (bx > 66 && sx >= 66 && sx < 82 && Math.abs(sy - 34) > 15) y = 34 + (y - 34) * 0.72; // wide forwards come inside
  }
  else { x = 0.52 * sx + 0.54 * bx - 10.5; y = 34 + (sy - 34) * 0.8 + (by - 34) * 0.4; }
  return { x: clamp(x, 3, 102), y: clamp(y, 2, 66) };
}

const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
function goalAngle(x, y) { // x,y in attacking frame
  const dx = L - x, dy = Math.abs(y - 34);
  let th = Math.atan2(7.32 * dx, dx * dx + dy * dy - 13.4);
  if (th < 0) th += Math.PI;
  return th;
}
export function xG(x, y) {
  const d = dist(x, y, L, 34);
  return 1 / (1 + Math.exp(1.45 + 0.11 * d - 1.4 * goalAngle(x, y)));
}

function makeSide(team, idx, homeAdv) {
  const form = FORMATIONS[team.formation] || FORMATIONS["4-3-3"];
  const on = team.xi.map((p, i) => ({
    p, pos: form[i][0], sx: form[i][1], sy: form[i][2], cond: p.cond ?? 100, on: true, side: idx,
    m: 0, inAt: 0, outAt: null, s: blankLine(),
  }));
  return {
    idx, club: team.club, name: team.name, formation: team.formation, on, bench: team.bench.map(p => ({ p, cond: p.cond ?? 100, side: idx, s: blankLine() })),
    used: [], subsLeft: 5, windows: 3, boost: homeAdv,
    t: { gls: 0, sh: 0, sot: 0, xg: 0, pas: 0, pasc: 0, pos: 0, cor: 0, fou: 0, yc: 0, rc: 0, off: 0, tck: 0 },
  };
}
const blankLine = () => ({ dg: 0, db: 0, gls: 0, ast: 0, sh: 0, sot: 0, pas: 0, pasc: 0, kp: 0, drb: 0, drbf: 0, tck: 0, int: 0, hdr: 0, clr: 0, sav: 0, fou: 0, yc: 0, rc: 0, err: 0, off: 0, conc: 0 });

// Runs a whole match. With opts.interactive the generator below pauses at the user's key moments.
export function simulateMatch(rng, home, away, opts = {}) {
  const g = matchGen(rng, home, away, { ...opts, interactive: false });
  let r = g.next();
  while (!r.done) r = g.next(null);
  return r.value;
}

export const MOMENT_LABEL = {
  shoot: ["Tembak", "⚽"], pass: ["Umpan pendek", "➜"], through: ["Umpan terobosan", "⚡"], cross: ["Umpan silang", "↗"],
  dribble: ["Giring bola", "💨"], long: ["Umpan panjang", "⤴"], clear: ["Buang bola", "⛔"],
  tackle: ["Tekel berdiri", "🦵"], slide: ["Tekel sliding", "🛷"], jockey: ["Jaga jarak", "🛡"],
};

// Generator form of the engine. It yields a "moment" whenever the user's player faces a key decision
// (on the ball in a dangerous area, or the last defender facing a dribbler); the value sent back with
// next(choice) is the option key the user picked (null = let the engine decide).
export function* matchGen(rng, home, away, opts = {}) {
  const rec = !!opts.record;
  const interactive = !!opts.interactive && opts.userId != null;
  const decisions = [];
  let lastAtk = 0, lastDef = 0, nAtk = 0, nDef = 0, qBoost = 0, slideFoul = false;
  // how often moments come up: [seconds between attacking moments, max attacking, seconds between defending, max defending]
  const [GAP_A, MAX_A, GAP_D, MAX_D] = { sering: [110, 14, 170, 7], normal: [190, 10, 260, 5], jarang: [360, 6, 480, 3] }[opts.momentRate || "normal"] || [190, 10, 260, 5];
  const S = [makeSide(home, 0, 1.035), makeSide(away, 1, 1)];
  const frames = opts.sink?.frames || [], events = opts.sink?.events || [], shots = opts.sink?.shots || []; // a live screen can watch these grow
  let half = 1, t = 0, clock = 0; // t: seconds in half, clock: absolute seconds for replay
  let poss = 0, carrier = null, bx = 52.5, by = 34; // ball in absolute coordinates
  let restart = { type: "kick", team: rng.chance(0.5) ? 0 : 1 };
  let firstKick = restart.team;
  let lastPass = null, through = false, halfLen = 0;
  const ar = side => (side === 0) === (half === 1); // attacks right?
  const toF = (side, x, y) => (ar(side) ? { x, y } : { x: L - x, y: W - y });
  const fromF = toF; // symmetric transform
  const minute = () => Math.min(half === 1 ? 45 : 90, Math.floor(t / 60) + (half === 1 ? 0 : 45)) + (t >= 2700 ? Math.floor((t - 2700) / 60) / 100 : 0);
  const minLabel = () => { const base = half === 1 ? 45 : 90; const m = Math.floor(t / 60) + (half === 1 ? 0 : 45) + 1; return t >= 2700 ? `${base}+${Math.floor((t - 2700) / 60) + 1}` : String(m); };

  // effective attribute with fatigue, home boost, morale
  const E = (pl, k) => {
    const v = pl.p.a[A[k]];
    const fat = ["acc","pac","sta","agi","str","jum","bal"].includes(k) ? 0.82 + 0.18 * pl.cond / 100 : 0.93 + 0.07 * pl.cond / 100;
    const mor = 0.97 + 0.06 * ((pl.p.morale ?? 65) / 100);
    return v * fat * mor * S[pl.side].boost;
  };
  const sk = (pl, ks) => { let s = 0, w = 0; for (const [k, x] of ks) { s += E(pl, k) * x; w += x; } return s / w / 20; };

  function positions(side, inPoss) {
    const F = toF(side, bx, by);
    return S[side].on.filter(o => o.on).map(o => {
      const q = shapePosition(o.sx, o.sy, o.pos, inPoss, F.x, F.y);
      return { o, x: q.x, y: q.y };
    });
  }
  function rec_(kind, extra) {
    if (!rec) return;
    frames.push({ t: clock, x: +bx.toFixed(1), y: +by.toFixed(1), s: poss, c: carrier ? carrier.p.id : null, k: kind, h: half, ...extra });
  }
  function ev(type, side, pl, more = {}) {
    events.push({ type, side, min: minLabel(), m: Math.floor(minute()), t: clock, pid: pl ? pl.p.id : null, ...more });
  }
  function tick(sec) {
    t += sec; clock += sec;
    S[poss].t.pos += sec;
    const drain = sec / 60;
    for (const sd of S) for (const o of sd.on) if (o.on) {
      o.m += drain;
      o.cond = Math.max(15, o.cond - drain * 0.11 * (1.45 - E(o, "sta") / 20 * 0.9) * (0.8 + o.p.a[A.wor] / 50));
    }
  }
  function giveTo(side, pl, x, y) { poss = side; carrier = pl; bx = x; by = y; lastPass = null; through = false; }
  function nearest(list, x, y) { let b = null, bd = 1e9; for (const q of list) { const d = dist(q.x, q.y, x, y); if (d < bd) { bd = d; b = q; } } return [b, bd]; }

  // Loose ball at absolute (x,y): nearest players contest
  function contest(x, y, aerial = false) {
    const cands = [];
    for (const side of [0, 1]) {
      const P = positions(side, side === poss).map(q => ({ ...q, ...fromF(side, q.x, q.y) }));
      const [q, d] = nearest(P, x, y);
      if (q) cands.push({ side, q, d });
    }
    const score = c => (aerial ? sk(c.q.o, [["jum",3],["hea",2],["str",2],["bra",1]]) : sk(c.q.o, [["ant",2],["acc",2],["bra",1],["str",1]])) / (0.6 + c.d / 10);
    const [a, b] = cands;
    const pa = score(a) / (score(a) + score(b));
    const w = rng.next() < pa ? a : b, l = w === a ? b : a;
    if (aerial) w.q.o.s.hdr++;
    giveTo(w.side, w.q.o, x, y);
    return w;
  }

  function foul(defSide, fouler, victimSide, x, y) {
    S[defSide].t.fou++; fouler.s.fou++;
    const harsh = (fouler.p.a[A.agg] - fouler.p.a[A.tck] * 0.5 + 6) / 40;
    let card = null;
    if (rng.chance(clamp(0.1 + harsh * 0.18 + (slideFoul ? 0.22 : 0), 0.04, 0.6) * (fouler.s.yc ? (slideFoul ? 0.6 : 0.2) : 1))) card = "Y";
    if (rng.chance(0.0015 + harsh * 0.003)) card = "R";
    if (card === "Y" && fouler.s.yc) card = "R2";
    if (card) {
      if (card === "Y") { fouler.s.yc++; S[defSide].t.yc++; ev("yc", defSide, fouler); }
      else { if (card === "R2") { fouler.s.yc++; S[defSide].t.yc++; } fouler.s.rc++; S[defSide].t.rc++; ev("rc", defSide, fouler); sendOff(fouler); }
    }
    const F = toF(victimSide, x, y);
    const inBox = F.x > 88.5 && Math.abs(F.y - 34) < 20.16;
    restart = inBox ? { type: "pen", team: victimSide } : { type: "fk", team: victimSide, x, y };
    tick(20 + rng.int(0, 20));
  }
  function sendOff(o) { o.on = false; o.outAt = clock; }

  function injuryCheck(o, factor) {
    const pr = 0.00055 * factor * (0.6 + o.p.hid.inj / 20) * (1.4 - o.cond / 100);
    if (rng.chance(pr)) { o.injured = true; ev("inj", o.side, o); return true; }
    return false;
  }

  function pickPlayer(side, pred, weight) {
    const L_ = S[side].on.filter(o => o.on && pred(o));
    if (!L_.length) return S[side].on.find(o => o.on);
    return rng.weighted(L_, weight);
  }
  const gk = side => S[side].on.find(o => o.on && o.pos === "GK") || S[side].on.find(o => o.on);

  function shoot(type, xgBonus = 1) {
    const T = S[poss], O = S[1 - poss];
    const F = toF(poss, bx, by);
    const d = dist(F.x, F.y, L, 34);
    let base = type === "pen" ? 0.76 : xG(F.x, F.y) * xgBonus;
    if (type === "hdr") base *= 0.62;
    if (type === "fk") base = clamp(0.065 * (1 - (d - 18) / 25), 0.015, 0.09);
    const sh = carrier;
    const q = type === "hdr" ? sk(sh, [["hea",3],["jum",1],["str",1],["cmp",1]])
      : type === "fk" ? sk(sh, [["fre",4],["tec",1],["cmp",1]])
      : type === "pen" ? sk(sh, [["pen",4],["cmp",2]])
      : d > 22 ? sk(sh, [["lon",3],["tec",1],["cmp",1]])
      : sk(sh, [["fin",3],["cmp",1.4],["tec",1]]);
    const g = gk(1 - poss);
    const gq = sk(g, type === "pen" ? [["ref",2],["ovo",1],["agi",1]] : through ? [["ovo",3],["ref",2],["rus",1]] : [["ref",3],["han",1],["pos",1.2],["agi",1],["aer",type === "hdr" ? 1.5 : 0.3]]);
    let pGoal = base * (0.36 + (q + qBoost) * 0.8) * (1.32 - gq * 0.66);
    pGoal = clamp(pGoal, 0.003, type === "pen" ? 0.92 : 0.8);
    T.t.sh++; sh.s.sh++; T.t.xg += base * 0.8;
    const SR = { t: clock, side: poss, xg: +(base * 0.8).toFixed(3), pid: sh.p.id, kind: type, x: +F.x.toFixed(1), y: +F.y.toFixed(1), r: "off" }; shots.push(SR);
    if (lastPass && lastPass.o !== sh && lastPass.side === poss) lastPass.o.s.kp++;
    // blocked?
    if (type === "open" && d > 10 && rng.chance(0.24)) {
      const blk = pickPlayer(1 - poss, o => DEF.has(o.pos) || o.pos === "DM", o => sk(o, [["pos",2],["bra",2],["ant",1]]));
      SR.r = "blk"; rec_("shot", { r: "blk" }); tick(3);
      if (rng.chance(0.45)) { S[poss].t.cor++; restart = { type: "corner", team: poss }; }
      else { const c = fromF(poss, F.x - rng.float(6, 18), F.y + rng.float(-10, 10)); contest(c.x, c.y); }
      return;
    }
    const pOn = clamp(Math.max(0.2 + q * 0.24 + base * 0.6, pGoal + 0.05), 0.15, 0.95);
    const scorerSide = poss;
    if (rng.chance(pOn)) {
      T.t.sot++; sh.s.sot++;
      if (rng.chance(pGoal / pOn)) {
        T.t.gls++; sh.s.gls++;
        const ast = lastPass && lastPass.side === poss && lastPass.o !== sh && type !== "pen" && type !== "fk" ? lastPass.o : null;
        if (ast) ast.s.ast++;
        for (const o of O.on) if (o.on) o.s.conc++;
        // error blame occasionally
        ev("goal", scorerSide, sh, { ast: ast ? ast.p.id : null, kind: type });
        const gpos = fromF(poss, L, 34 + rng.float(-3, 3));
        SR.r = "goal"; bx = gpos.x; by = gpos.y; rec_("goal", { r: "goal" });
        tick(45 + rng.int(0, 25));
        restart = { type: "kick", team: 1 - scorerSide };
        return;
      }
      g.s.sav++;
      const gp = fromF(poss, L - 1, by);
      SR.r = "save"; rec_("shot", { r: "save" }); tick(3);
      if (rng.chance(0.3)) { T.t.cor++; restart = { type: "corner", team: poss }; return; }
      if (rng.chance(0.14) && type !== "fk") { // rebound
        const c = fromF(poss, 96 + rng.float(-3, 2), 34 + rng.float(-8, 8));
        const w = contest(c.x, c.y);
        if (w.side === scorerSide && rng.chance(0.55)) { lastPass = null; shoot("open", 1.15); }
        return;
      }
      const gpos = fromF(1 - poss, 6, 34);
      giveTo(1 - poss, g, gpos.x, gpos.y); tick(6);
      return;
    }
    rec_("shot", { r: "off" }); tick(4);
    restart = { type: "gk", team: 1 - poss };
  }

  function passTo(target, kind) {
    const T = S[poss];
    const from = carrier;
    T.t.pas++; from.s.pas++;
    const tx = target.x, ty = target.y; // team frame
    const F = toF(poss, bx, by);
    const d = dist(F.x, F.y, tx, ty);
    const prog = tx - F.x;
    const opp = positions(1 - poss, false).map(q => ({ ...q, x: L - q.x, y: W - q.y }));
    const [nearRecv, rd] = nearest(opp, tx, ty);
    const [nearMe, md] = nearest(opp, F.x, F.y);
    const passQ = sk(from, [["pas",4],["tec",1.5],["vis",kind === "through" ? 2 : 0.8],["dec",1.2],["cmp",md < 3 ? 1 : 0.3]]);
    let p = 0.96 - d * 0.0055 - Math.max(0, prog) * 0.0028 - (kind === "long" ? 0.12 : 0) - (kind === "through" ? 0.16 : 0)
      - Math.max(0, 4 - rd) * 0.035 - Math.max(0, 2.5 - md) * 0.04 + (passQ - 0.5) * 0.32;
    if (nearRecv) p -= sk(nearRecv.o, [["ant",2],["pos",1.5],["mar",1]]) * 0.08 * (rd < 5 ? 1 : 0.3);
    p = clamp(p + qBoost, 0.2, 0.985);
    const travel = Math.max(1, d / (kind === "long" ? 22 : 15));
    if (rng.chance(p)) {
      // offside on through balls
      if (kind === "through" && rng.chance(clamp(0.2 - target.o.p.a[A.otb] * 0.008, 0.03, 0.2))) {
        target.o.s.off++; T.t.off++;
        const a = fromF(poss, tx, ty); bx = a.x; by = a.y; carrier = null; rec_("pass", { r: "off" }); tick(travel + 15);
        restart = { type: "fk", team: 1 - poss, x: bx, y: by }; return;
      }
      T.t.pasc++; from.s.pasc++;
      lastPass = { o: from, side: poss };
      const a = fromF(poss, tx, ty);
      carrier = null; bx = a.x; by = a.y; rec_(kind === "long" ? "long" : "pass"); tick(travel);
      carrier = target.o; through = kind === "through";
      rec_("recv"); tick(rng.float(1.4, 3.2));
      // first touch under pressure
      if (rd < 2 && !rng.chance(0.82 + sk(carrier, [["fir",2],["tec",1],["cmp",1]]) * 0.16)) {
        carrier.s.drbf++;
        const w = nearRecv.o; w.s.tck++; S[1 - poss].t.tck++;
        giveTo(1 - poss, w, bx, by); rec_("tackle");
      }
      return;
    }
    // failed pass
    const lost = rng.chance(0.25) && kind !== "through";
    if (lost) { // out of play
      const a = fromF(poss, tx + rng.float(-3, 3), ty < 34 ? 0.5 : 67.5);
      bx = clamp(a.x, 1, 104); by = a.y; carrier = null; rec_("pass", { r: "out" }); tick(travel + 10);
      restart = { type: "throw", team: 1 - poss, x: bx, y: by }; return;
    }
    const it = nearRecv ? nearRecv.o : nearMe.o;
    it.s.int++;
    const k = rng.float(0.55, 0.95);
    const a = fromF(poss, F.x + (tx - F.x) * k, F.y + (ty - F.y) * k);
    carrier = null; bx = a.x; by = a.y; rec_("pass", { r: "int" }); tick(travel * k);
    giveTo(1 - poss, it, a.x, a.y); rec_("recv");
    if (F.x < 30 && rng.chance(0.08)) from.s.err++;
  }

  // what the carrier sees: pressure, distances and the engine's own option weights
  function situation() {
    const T = S[poss], O = S[1 - poss];
    const F = toF(poss, bx, by);
    const mine = positions(poss, true);
    const opp = positions(1 - poss, false).map(q => ({ ...q, x: L - q.x, y: W - q.y }));
    const [presser, pd0] = nearest(opp, F.x, F.y);
    const closing = 2 + sk(presser.o, [["wor",1],["acc",1],["ant",1]]) * 4;
    const pd = Math.max(0.6, pd0 - closing);
    const c = carrier;
    const isGK = c.pos === "GK";
    const dG = dist(F.x, F.y, L, 34);
    const opts = [];
    const xg = xG(F.x, F.y);
    if (!isGK && dG < 32 && F.x > 70) {
      let des = xg * 2.0 + (through ? 0.35 : 0) + (dG < 30 && dG > 17 ? 0.06 + c.p.a[A.lon] / 80 : 0) + c.p.a[A.fla] / 200;
      if (DEF.has(c.pos)) des *= 0.4;
      if (pd < 1.5) des *= 0.7;
      opts.push(["shoot", clamp(des, 0, 2.5)]);
    }
    if (!isGK && F.x > 70 && Math.abs(F.y - 34) > 17) opts.push(["cross", 0.25 + c.p.a[A.cro] / 40]);
    if (!isGK) {
      const space = pd > 5;
      let dd = (c.p.a[A.dri] + c.p.a[A.fla]) / 40 * (space ? 0.9 : 0.45) * (ATT.has(c.pos) || /M[RL]|WB/.test(c.pos) ? 1.2 : 0.55);
      if (F.x > 88 && Math.abs(F.y - 34) < 18) dd *= 0.6;
      opts.push(["dribble", dd]);
    }
    if (F.x < 40 && (pd < 2.5 || isGK)) opts.push(["long", isGK ? 0.5 + c.p.a[A.kic] / 60 : 0.18]);
    if (!isGK && F.x < 22 && pd < 1.5 && DEF.has(c.pos)) opts.push(["clear", 0.6]);
    opts.push(["pass", isGK ? 1.1 : 1.6]);
    return { T, O, F, mine, opp, presser, pd0, pd, c, isGK, dG, xg, opts };
  }
  function passTargets(sit, long) {
    const { F, mine, opp, c } = sit;
    const cands = mine.filter(q => q.o !== c && (q.o.pos !== "GK" || F.x < 30));
    return cands.map(q => {
      const d = dist(F.x, F.y, q.x, q.y);
      const prog = q.x - F.x;
      const [, rd] = nearest(opp, q.x, q.y);
      let s = clamp((rd - 0.5) / 7, 0.05, 1) * Math.exp(prog * (long ? 0.06 : 0.032));
      s *= long ? (d > 25 ? 1 : 0.1) : Math.exp(-Math.max(0, d - 12) / 14) * (d < 4 ? 0.2 : 1);
      if (F.x > 66 && ATT.has(q.o.pos)) s *= q.o.pos === "ST" ? 0.95 : 1.4;
      return { q, s, rd, prog };
    });
  }

  function act(sit = situation(), forced = null, defCh = null, duelBy = null) {
    const { T, O, F, presser, pd, c, isGK, opts } = sit;
    if (!forced && !defCh && !isGK && pd < 2.2 && rng.chance(0.006 + presser.o.p.a[A.agg] / 1400 + (20 - presser.o.p.a[A.tck]) / 2800)) {
      rec_("foul"); foul(1 - poss, presser.o, poss, bx, by); return;
    }
    let choice = forced || (defCh ? (defCh === "jockey" ? "pass" : "dribble") : rng.weighted(opts, o => o[1])[0]);
    let wantThrough = false;
    if (choice === "through") { choice = "pass"; wantThrough = true; }

    if (choice === "shoot") { shoot("open", through ? 1.45 : 1); through = false; return; }
    through = false;

    if (choice === "clear") {
      c.s.clr++;
      const a = fromF(poss, F.x + rng.float(30, 50), clamp(F.y + rng.float(-20, 20), 4, 64));
      carrier = null; bx = a.x; by = a.y; rec_("long", { r: "clr" }); tick(3);
      if (rng.chance(0.15)) { restart = { type: "throw", team: 1 - poss, x: bx, y: by < 34 ? 0.5 : 67.5 }; return; }
      contest(bx, by, true); return;
    }

    if (choice === "cross") {
      const qx = sk(c, [["cro",4],["tec",1],["vis",0.5]]);
      T.t.pas++; c.s.pas++;
      const tgtF = { x: rng.float(92, 100), y: 34 + rng.float(-7, 7) };
      const a = fromF(poss, tgtF.x, tgtF.y);
      carrier = null; bx = a.x; by = a.y; rec_("cross"); tick(2);
      if (!rng.chance(0.22 + (qx + qBoost) * 0.42)) { // poor cross
        if (rng.chance(0.35)) { T.t.cor++; restart = { type: "corner", team: poss }; return; }
        const g = gk(1 - poss);
        if (rng.chance(0.4)) { giveTo(1 - poss, g, a.x, a.y); rec_("recv"); return; }
        contest(a.x, a.y, true); return;
      }
      T.t.pasc++; c.s.pasc++;
      lastPass = { o: c, side: poss };
      return aerialAttack();
    }

    if (choice === "dribble") {
      const step = rng.float(5, 11);
      const dir = Math.abs(F.y - 34) > 12 && F.x > 65 ? Math.sign(34 - F.y) * 3 : rng.float(-3, 3);
      const nF = { x: clamp(F.x + step, 2, 103), y: clamp(F.y + dir, 2, 66) };
      if (pd < 3.5 || duelBy) {
        const d = duelBy || presser.o;
        const att = sk(c, [["dri",3],["agi",1.5],["acc",1],["bal",1],["fla",0.7],["tec",1]]);
        const def = sk(d, [["tck",3],["pos",1.2],["ant",1],["str",1],["acc",0.8]]);
        const pw = clamp(0.5 + (att - def) * 1.3 + qBoost - (defCh === "slide" ? 0.17 : defCh === "tackle" ? 0.03 : 0), 0.12, 0.88);
        if (rng.chance(pw)) {
          c.s.drb++;
          const a = fromF(poss, nF.x, nF.y); bx = a.x; by = a.y; rec_("drib"); tick(3);
          return;
        }
        c.s.drbf++;
        if (rng.chance((defCh === "slide" ? 0.34 : 0.2) + d.p.a[A.agg] / 100)) { slideFoul = defCh === "slide"; rec_("foul"); foul(1 - poss, d, poss, bx, by); slideFoul = false; return; }
        d.s.tck++; O.t.tck++;
        injuryCheck(c, 1.2);
        giveTo(1 - poss, d, bx, by); rec_("tackle"); tick(2);
        return;
      }
      const a = fromF(poss, nF.x, nF.y); bx = a.x; by = a.y; rec_("drib"); tick(step / 6);
      return;
    }

    // passes
    const long = choice === "long";
    const scored = passTargets(sit, long);
    let pick = rng.weighted(scored, z => (forced ? z.s ** 3 : z.s * z.s));
    if (wantThrough) {
      const ahead = scored.filter(z => z.prog > 5 && z.q.o.pos !== "GK").sort((a, b) => (ATT.has(b.q.o.pos) ? 1.5 : 1) * b.s - (ATT.has(a.q.o.pos) ? 1.5 : 1) * a.s);
      if (ahead.length) pick = ahead[0];
    }
    if (!pick) { tick(2); return; }
    let kind = long ? "long" : "short";
    const tgt = { ...pick.q };
    if (wantThrough && pick.prog > 5) { kind = "through"; tgt.x = clamp(tgt.x + rng.float(5, 10), 0, 101); }
    else if (!long && forced !== "pass" && ATT.has(tgt.o.pos) && pick.prog > 8 && F.x > 45 && rng.chance(0.18 + c.p.a[A.vis] / 80)) {
      kind = "through"; tgt.x = clamp(tgt.x + rng.float(5, 10), 0, 101);
    }
    if (long) {
      const fromC = carrier;
      T.t.pas++; fromC.s.pas++;
      const a = fromF(poss, tgt.x, tgt.y);
      carrier = null; bx = a.x; by = a.y; rec_("long"); tick(3);
      const w = contest(bx, by, true);
      if (w.side === poss) { T.t.pasc++; fromC.s.pasc++; lastPass = { o: fromC, side: poss }; }
      return;
    }
    passTo(tgt, kind);
  }

  function aerialAttack() {
    const T = S[poss];
    const att = pickPlayer(poss, o => !["GK"].includes(o.pos), o => (o.pos === "ST" ? 2.4 : ATT.has(o.pos) ? 1.6 : o.pos === "DC" ? 0.9 : 0.7) * (o.p.a[A.hea] + o.p.a[A.jum]));
    const dfd = pickPlayer(1 - poss, o => DEF.has(o.pos) && o.pos !== "GK", o => o.p.a[A.hea] + o.p.a[A.jum]);
    const g = gk(1 - poss);
    if (rng.chance(0.1 + sk(g, [["cmd",2],["aer",2],["rus",1]]) * 0.15)) { giveTo(1 - poss, g, bx, by); rec_("recv", { r: "claim" }); tick(4); return; }
    const pa = sk(att, [["hea",2],["jum",2],["str",1],["bra",1],["otb",1]]);
    const pd_ = sk(dfd, [["hea",2],["jum",2],["str",1],["mar",1],["pos",1]]);
    if (rng.chance(clamp(0.42 + (pa - pd_) * 1.2, 0.15, 0.7))) {
      att.s.hdr++; carrier = att; rec_("recv");
      if (rng.chance(0.75)) { shoot("hdr"); return; }
      return;
    }
    dfd.s.hdr++; dfd.s.clr++;
    const F = toF(poss, bx, by);
    const a = fromF(poss, F.x - rng.float(15, 35), clamp(F.y + rng.float(-20, 20), 3, 65));
    carrier = null; bx = a.x; by = a.y; rec_("long", { r: "clr" }); tick(3);
    if (rng.chance(0.25)) { T.t.cor++; restart = { type: "corner", team: poss }; return; }
    contest(bx, by, true);
  }

  function doRestart() {
    const r = restart; restart = null;
    poss = r.team; lastPass = null; through = false;
    if (r.type === "kick") {
      bx = 52.5; by = 34;
      carrier = pickPlayer(poss, o => o.pos === "ST" || o.pos === "AMC" || o.pos === "MC", () => 1);
      rec_("kick"); tick(2);
      return;
    }
    if (r.type === "gk") {
      const g = gk(poss); const a = fromF(poss, 6, 34); giveTo(poss, g, a.x, a.y); rec_("gk"); tick(15 + rng.int(0, 15));
      return;
    }
    if (r.type === "throw") {
      bx = clamp(r.x, 2, 103); by = r.y;
      carrier = pickPlayer(poss, o => /DR|DL|WB|MR|ML/.test(o.pos), () => 1);
      rec_("throw"); tick(8 + rng.int(0, 10));
      return;
    }
    if (r.type === "corner") {
      const side = rng.chance(0.5) ? 0.5 : 67.5;
      const a = fromF(poss, 104.5, side); bx = a.x; by = a.y;
      carrier = pickPlayer(poss, o => o.pos !== "GK", o => o.p.a[A.cor] ** 2);
      rec_("corner"); tick(20 + rng.int(0, 15));
      const q = sk(carrier, [["cor",4],["tec",1]]);
      const T = S[poss];
      T.t.pas++; carrier.s.pas++;
      const tgt = fromF(poss, rng.float(94, 100), 34 + rng.float(-8, 8));
      bx = tgt.x; by = tgt.y; const taker = carrier; carrier = null; rec_("cross"); tick(2);
      if (rng.chance(0.38 + q * 0.35)) { T.t.pasc++; taker.s.pasc++; lastPass = { o: taker, side: poss }; aerialAttack(); }
      else contest(bx, by, true);
      return;
    }
    if (r.type === "fk") {
      bx = r.x; by = r.y;
      const F = toF(poss, bx, by);
      const dG = dist(F.x, F.y, L, 34);
      if (dG < 30 && F.x > 75 && Math.abs(F.y - 34) < 18) {
        carrier = pickPlayer(poss, o => o.pos !== "GK", o => o.p.a[A.fre] ** 3);
        rec_("fk"); tick(30);
        if (rng.chance(0.55)) { shoot("fk"); return; }
        const tgt = fromF(poss, rng.float(92, 99), 34 + rng.float(-8, 8)); bx = tgt.x; by = tgt.y;
        const taker = carrier; carrier = null; rec_("cross"); tick(2);
        lastPass = { o: taker, side: poss }; aerialAttack(); return;
      }
      carrier = pickPlayer(poss, o => o.pos !== "GK", o => { const q = shapePosition(o.sx, o.sy, o.pos, true, F.x, F.y); return 1 / (1 + dist(F.x, F.y, q.x, q.y)); });
      rec_("fk"); tick(4);
      return;
    }
    if (r.type === "pen") {
      const a = fromF(poss, 94, 34); bx = a.x; by = a.y;
      carrier = pickPlayer(poss, o => o.pos !== "GK", o => (o.p.a[A.pen] + o.p.a[A.cmp]) ** 3);
      ev("pen", poss, carrier); rec_("pen"); tick(40);
      const before = S[poss].t.gls;
      shoot("pen");
      if (S[poss].t.gls === before) ev("penmiss", poss, null);
      return;
    }
  }

  function subs() {
    const m = Math.floor(clock / 60);
    for (const sd of S) {
      // forced: injured
      for (const o of sd.on) if (o.on && o.injured && !o.outAt) {
        if (sd.subsLeft > 0) makeSub(sd, o, true); else { o.on = false; o.outAt = clock; }
      }
      if (sd.subsLeft <= 0 || sd.windows <= 0) continue;
      const mm = half === 2 ? Math.floor(t / 60) + 45 : 0;
      if (mm < 58) continue;
      const planned = mm >= 58 && mm < 68 ? 0.06 : mm < 80 ? 0.05 : 0.03;
      if (!rng.chance(planned)) continue;
      const tired = sd.on.filter(o => o.on && o.pos !== "GK" && o.inAt === 0).sort((a, b) => a.cond - b.cond);
      const n = Math.min(sd.subsLeft, rng.int(1, 3));
      let made = 0;
      for (const o of tired) { if (made >= n) break; if (o.cond < 82 || rng.chance(0.25)) { if (makeSub(sd, o, false)) made++; } }
      if (made) sd.windows--;
    }
  }
  function makeSub(sd, o, forced) {
    if (!sd.bench.length) return false;
    const pick = sd.bench.slice().sort((a, b) => benchFit(b, o.pos) - benchFit(a, o.pos))[0];
    sd.bench.splice(sd.bench.indexOf(pick), 1);
    o.on = false; o.outAt = clock;
    const n = { p: pick.p, pos: o.pos, sx: o.sx, sy: o.sy, cond: pick.cond, on: true, side: sd.idx, m: 0, inAt: clock, outAt: null, s: pick.s };
    sd.on.push(n); sd.subsLeft--;
    if (carrier === o) carrier = n;
    ev("sub", sd.idx, n, { off: o.p.id, forced });
    return true;
  }
  const benchFit = (b, pos) => (b.p.positions[pos] || 2) * 3 + b.p.ca / 10;

  // ===== user key moments =====
  const userOn = () => { for (const sd of S) for (const o of sd.on) if (o.on && o.p.id === opts.userId) return o; return null; };
  const chanceWord = p => (p < 0.04 ? "sangat kecil" : p < 0.1 ? "kecil" : p < 0.2 ? "sedang" : p < 0.35 ? "besar" : "sangat besar");
  function attackMoment() {
    const sit = situation();
    const { F, c, pd, dG, xg, opts: ai, isGK } = sit;
    if (isGK) return null;
    const key = F.x > 62 || (F.x > 38 && pd < 2.6) || (F.x > 50 && clock - lastAtk > GAP_A * 2.5);
    if (!key || clock - lastAtk < GAP_A || nAtk >= MAX_A) return null;
    const w = Object.fromEntries(ai);
    const scored = passTargets(sit, false).sort((a, b) => b.s - a.s);
    const ahead = scored.filter(z => z.prog > 5 && z.q.o.pos !== "GK").sort((a, b) => (ATT.has(b.q.o.pos) ? 1.5 : 1) * b.s - (ATT.has(a.q.o.pos) ? 1.5 : 1) * a.s);
    const g = gk(1 - poss);
    const q = dG > 22 ? sk(c, [["lon",3],["tec",1],["cmp",1]]) : sk(c, [["fin",3],["cmp",1.4],["tec",1]]);
    const gq = sk(g, [["ref",3],["han",1],["pos",1.2],["agi",1]]);
    const pShot = clamp(xg * (through ? 1.45 : 1) * (0.36 + q * 0.8) * (1.32 - gq * 0.66) * (pd < 1.5 ? 0.75 : 1), 0.003, 0.8);
    const o = [];
    if (F.x > 55) o.push({ k: "shoot", hint: `Jarak ${Math.round(dG)} m · peluang gol ${chanceWord(pShot)} (±${Math.max(1, Math.round(pShot * 100))}%)`, w: w.shoot || 0 });
    if (scored[0]) o.push({ k: "pass", hint: `Rekan paling bebas: {n}`, pid: scored[0].q.o.p.id, w: w.pass * 0.75 });
    if (ahead[0] && F.x > 35) o.push({ k: "through", hint: `Bola ke ruang di depan {n}`, pid: ahead[0].q.o.p.id, w: w.pass * (0.25 + c.p.a[A.vis] / 60) * (ahead[0].s > 0.25 ? 1.2 : 0.6) });
    if (F.x > 65 && Math.abs(F.y - 34) > 14) o.push({ k: "cross", hint: `${S[poss].on.filter(x => x.on && ATT.has(x.pos)).length} rekan menunggu di kotak`, w: w.cross || 0.3 });
    o.push({ k: "dribble", hint: pd < 2 ? `Dijaga ketat, lawan ${Math.max(1, Math.round(sit.pd0))} m` : pd < 4 ? `Lawan mendekat (${Math.round(sit.pd0)} m)` : "Ruang terbuka di depan", w: w.dribble || 0 });
    if (F.x < 52) o.push({ k: "long", hint: "Bola jauh ke lini depan", w: w.long || 0.12 });
    if (F.x < 25 && DEF.has(c.pos)) o.push({ k: "clear", hint: "Amankan bola dari area berbahaya", w: w.clear || 0.2 });
    const best = o.slice().sort((a, b) => b.w - a.w)[0];
    return { sit, m: { kind: "atk", t: clock, min: minLabel(), side: poss, pid: c.p.id, x: F.x, dG: Math.round(dG), pressure: pd, zone: F.x > 88 ? "kotak penalti" : F.x > 70 ? "sepertiga akhir" : F.x > 45 ? "lini tengah" : "area sendiri", options: o.map(({ w: _w, ...r }) => r), ai: best.k, weights: Object.fromEntries(o.map(x => [x.k, x.w])) } };
  }
  function defendMoment(me) {
    if (carrier.pos === "GK" || me.pos === "GK" || clock - lastDef < GAP_D || nDef >= MAX_D) return null;
    const sit = situation();
    if (sit.presser.o !== me || sit.pd0 > 7 || sit.F.x < 45) return null;
    const att = sk(carrier, [["dri",3],["agi",1.5],["acc",1],["bal",1],["fla",0.7],["tec",1]]);
    const def = sk(me, [["tck",3],["pos",1.2],["ant",1],["str",1],["acc",0.8]]);
    const pw = clamp(0.5 + (att - def) * 1.3, 0.12, 0.88); // attacker's chance to beat a standing tackle
    const danger = sit.F.x > 80;
    const o = [
      { k: "tackle", hint: `Peluang merebut bola ${chanceWord(1 - pw)}`, w: 1 - pw },
      { k: "slide", hint: me.s.yc ? "Berisiko: kamu sudah kena kartu kuning" : sit.F.x > 87 ? "Berisiko penalti!" : "Lebih mungkin merebut bola, rawan pelanggaran", w: (1 - pw + 0.17) * (me.s.yc ? 0.3 : sit.F.x > 87 ? 0.4 : 0.72) },
      { k: "jockey", hint: danger ? "Tutup ruang, paksa lawan mengoper" : "Tunda serangan sambil menunggu bantuan", w: pw > 0.55 ? 0.8 : 0.45 },
    ];
    const best = o.slice().sort((a, b) => b.w - a.w)[0];
    return { sit, m: { kind: "def", t: clock, min: minLabel(), side: 1 - poss, pid: me.p.id, vs: carrier.p.id, x: 105 - sit.F.x, zone: sit.F.x > 88 ? "kotak penalti sendiri" : sit.F.x > 70 ? "sepertiga akhir sendiri" : "lini tengah", options: o.map(({ w: _w, ...r }) => r), ai: best.k, weights: Object.fromEntries(o.map(x => [x.k, x.w])) } };
  }
  function judge(m, ch) {
    const ws = Object.values(m.weights), mx = Math.max(...ws), w = m.weights[ch] ?? 0;
    return w >= mx * 0.6 ? 1 : w < mx * 0.22 ? -1 : 0;
  }

  // ===== main loop =====
  for (half = 1; half <= 2; half++) {
    t = 0;
    halfLen = 2700 + (half === 1 ? rng.int(60, 200) : rng.int(150, 360));
    restart = { type: "kick", team: half === 1 ? firstKick : 1 - firstKick };
    if (rec) frames.push({ t: clock, x: 52.5, y: 34, s: restart.team, c: null, k: "half", h: half });
    let guard = 0, mo = null, uo = null;
    while (t < halfLen && guard++ < 6000) {
      if (restart) doRestart();
      else if (!carrier || !carrier.on) { const a = contest(bx, by); }
      else if (interactive && carrier.p.id === opts.userId && (mo = attackMoment())) {
        const ch = (yield mo.m) || mo.m.ai, v = judge(mo.m, ch), me = carrier;
        lastAtk = clock; nAtk++;
        decisions.push({ kind: "atk", min: mo.m.min, t: mo.m.t, choice: ch, verdict: v });
        if (v > 0) me.s.dg++; else if (v < 0) me.s.db++;
        qBoost = v > 0 ? 0.06 : v < 0 ? -0.04 : 0;
        act(mo.sit, ch);
        qBoost = 0;
      } else if (interactive && carrier.side !== (uo = userOn())?.side && uo && (mo = defendMoment(uo))) {
        const ch = (yield mo.m) || mo.m.ai, v = judge(mo.m, ch);
        lastDef = clock; nDef++;
        decisions.push({ kind: "def", min: mo.m.min, t: mo.m.t, choice: ch, verdict: v });
        if (v > 0) uo.s.dg++; else if (v < 0) uo.s.db++;
        qBoost = ch === "jockey" ? -0.06 : 0;
        act(mo.sit, null, ch, ch === "jockey" ? null : uo);
        qBoost = 0;
      }
      else act();
      if (carrier && carrier.on) {
        // injury chance per action for carrier
        if (injuryCheck(carrier, 0.35)) { tick(60); restart = { type: "fk", team: poss, x: bx, y: by }; }
      }
      subs();
      // keep 2 men down etc: if a side has < 7 players: abandon not modelled
    }
    if (rec) frames.push({ t: clock, x: bx, y: by, s: poss, c: null, k: "end", h: half });
    clock += 1;
  }

  // ===== ratings =====
  const res = { score: [S[0].t.gls, S[1].t.gls], teams: S.map(s => ({ ...s.t, pos: 0 })), players: {}, events, frames, shots, lineups: null, decisions };
  const posTot = S[0].t.pos + S[1].t.pos;
  res.teams[0].pos = Math.round(S[0].t.pos / posTot * 100); res.teams[1].pos = 100 - res.teams[0].pos;
  for (const sd of S) {
    const won = res.score[sd.idx] > res.score[1 - sd.idx], lost = res.score[sd.idx] < res.score[1 - sd.idx];
    for (const o of sd.on) {
      const s = o.s, mins = Math.round(o.m);
      let r = 6.3 + s.dg * 0.03 - s.db * 0.06 + s.gls * 0.95 + s.ast * 0.6 + s.kp * 0.14 + s.sot * 0.08 - (s.sh - s.sot) * 0.03
        + s.pasc * 0.005 - (s.pas - s.pasc) * 0.035 + s.drb * 0.06 - s.drbf * 0.04 + s.tck * 0.08 + s.int * 0.07 + s.hdr * 0.03 + s.clr * 0.03
        - s.fou * 0.05 - s.yc * 0.2 - s.rc * 1.5 - s.err * 0.5 - s.off * 0.04;
      if (o.pos === "GK") r += s.sav * 0.22 - s.conc * 0.32;
      else if (DEF.has(o.pos)) r -= s.conc * 0.14;
      else if (o.pos === "DM") r -= s.conc * 0.06;
      if (s.conc === 0 && mins >= 60 && (DEF.has(o.pos) || o.pos === "DM")) r += 0.35;
      r += won ? 0.2 : lost ? -0.2 : 0;
      if (mins < 25) r = 6.5 + (r - 6.5) * (mins / 25);
      r = clamp(Math.round(r * 10) / 10, 3.5, 10);
      res.players[o.p.id] = { side: sd.idx, pos: o.pos, min: clamp(mins, 1, 90), start: o.inAt === 0, rating: r, cond: Math.round(o.cond), injured: !!o.injured, ...s };
    }
  }
  // Player of the match
  let best = null; for (const [id, l] of Object.entries(res.players)) if (!best || l.rating > res.players[best].rating) best = id;
  res.pom = best ? +best : null;
  if (rec) res.lineups = S.map(sd => ({ club: sd.club, formation: sd.formation, start: sd.on.filter(o => o.inAt === 0).map(o => ({ id: o.p.id, pos: o.pos, sx: o.sx, sy: o.sy })) }));
  return res;
}
