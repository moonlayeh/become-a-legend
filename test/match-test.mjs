import { RNG } from "../www/js/rng.js";
import { genPlayer } from "../www/js/player.js";
import { FORMATIONS, simulateMatch } from "../www/js/match.js";
import { day } from "../www/js/calendar.js";

const rng = new RNG(42);
const today = day(2026, 8, 15);
let id = 1;
function team(level, name) {
  const form = "4-3-3";
  const xi = FORMATIONS[form].map(([pos]) => genPlayer(rng, { id: id++, nat: "ESP", pos, ca: Math.round(level + rng.normal(0, 6)), pa: 200, birth: day(1999, 3, 3), today }));
  const bench = ["GK","DC","DR","MC","MC","AMR","ST"].map(pos => genPlayer(rng, { id: id++, nat: "ESP", pos, ca: level - 10, pa: 200, birth: day(2000, 3, 3), today }));
  return { club: name, name, formation: form, xi, bench };
}
function run(la, lb, n) {
  const agg = { g: [0, 0], sh: [0, 0], sot: [0, 0], pas: [0, 0], pasc: [0, 0], cor: [0, 0], fou: [0, 0], yc: [0, 0], rc: [0, 0], xg: [0, 0], off: [0, 0], pos: [0, 0], w: 0, d: 0, l: 0, ratings: [] };
  for (let i = 0; i < n; i++) {
    const r = simulateMatch(rng, team(la, "H"), team(lb, "A"));
    for (const s of [0, 1]) for (const k of ["sh","sot","pas","pasc","cor","fou","yc","rc","xg","off","pos"]) agg[k][s] += r.teams[s][k];
    agg.g[0] += r.score[0]; agg.g[1] += r.score[1];
    if (r.score[0] > r.score[1]) agg.w++; else if (r.score[0] === r.score[1]) agg.d++; else agg.l++;
    for (const p of Object.values(r.players)) agg.ratings.push(p.rating);
  }
  const f = a => a.map(x => (x / n).toFixed(2)).join(" / ");
  console.log(`H${la} vs A${lb}: goals ${f(agg.g)} | W/D/L ${agg.w}/${agg.d}/${agg.l}`);
  console.log(`  shots ${f(agg.sh)} sot ${f(agg.sot)} xg ${f(agg.xg)} pass ${f(agg.pas)} cmp% ${(agg.pasc[0] / agg.pas[0] * 100).toFixed(0)}/${(agg.pasc[1] / agg.pas[1] * 100).toFixed(0)} pos ${f(agg.pos)}`);
  console.log(`  corners ${f(agg.cor)} fouls ${f(agg.fou)} yc ${f(agg.yc)} rc ${f(agg.rc)} off ${f(agg.off)} avgRating ${(agg.ratings.reduce((a, b) => a + b, 0) / agg.ratings.length).toFixed(2)}`);
}
const t0 = Date.now();
run(140, 140, 400);
run(155, 135, 300);
run(90, 90, 200);
console.log("ms per match", ((Date.now() - t0) / 900).toFixed(1));
// goal share by position
{
  const by = {}; let tot = 0;
  for (let i = 0; i < 300; i++) {
    const r = simulateMatch(rng, team(140, "H"), team(140, "A"));
    for (const l of Object.values(r.players)) { by[l.pos] = (by[l.pos] || 0) + l.gls; tot += l.gls; }
  }
  console.log("goal share", Object.entries(by).map(([k, v]) => `${k} ${(v / tot * 100).toFixed(0)}%`).join(" "), "ST goals/match", (by.ST / 600).toFixed(2));
}
