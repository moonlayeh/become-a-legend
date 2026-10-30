// Interactive key moments: how often they come up per position, and whether choices change outcomes.
import { RNG } from "../www/js/rng.js";
import { genPlayer } from "../www/js/player.js";
import { FORMATIONS, matchGen } from "../www/js/match.js";
import { day } from "../www/js/calendar.js";
const rng = new RNG(7);
const today = day(2026, 8, 15);
let id = 1;
function team(level, name) {
  const xi = FORMATIONS["4-3-3"].map(([pos]) => genPlayer(rng, { id: id++, nat: "ESP", pos, ca: Math.round(level + rng.normal(0, 6)), pa: 200, birth: day(1999, 3, 3), today }));
  const bench = ["GK","DC","DR","MC","MC","AMR","ST"].map(pos => genPlayer(rng, { id: id++, nat: "ESP", pos, ca: level - 10, pa: 200, birth: day(2000, 3, 3), today }));
  return { club: name, name, formation: "4-3-3", xi, bench };
}
function play(slot, policy, n) {
  const agg = { atk: 0, def: 0, gls: 0, rating: 0, scored: 0, conc: 0, good: 0, bad: 0 };
  for (let i = 0; i < n; i++) {
    const H = team(140, "H"), A = team(140, "A");
    const u = H.xi[slot];
    const g = matchGen(rng, H, A, { record: true, interactive: true, userId: u.id });
    let r = g.next();
    while (!r.done) {
      const m = r.value; agg[m.kind]++;
      const ch = policy === "ai" ? null : policy === "worst" ? Object.entries(m.weights).sort((a, b) => a[1] - b[1])[0][0] : policy === "shoot" && m.options.some(o => o.k === "shoot") ? "shoot" : policy === "slide" && m.kind === "def" ? "slide" : null;
      r = g.next(ch);
    }
    const res = r.value, l = res.players[u.id];
    agg.gls += l.gls; agg.rating += l.rating; agg.scored += res.score[0]; agg.conc += res.score[1]; agg.good += l.dg; agg.bad += l.db;
  }
  const f = k => (agg[k] / n).toFixed(2);
  console.log(`${FORMATIONS["4-3-3"][slot][0].padEnd(3)} ${policy.padEnd(6)} atk ${f("atk")} def ${f("def")} | goals ${f("gls")} rating ${f("rating")} team ${f("scored")}-${f("conc")} good ${f("good")} bad ${f("bad")}`);
}
for (const slot of [9, 8, 6, 2, 1]) { play(slot, "ai", 120); play(slot, "worst", 120); }
play(9, "shoot", 120); play(2, "slide", 120);
