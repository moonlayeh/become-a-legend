// Card mode: tap through a season and a half choosing options, playing matches automatically.
import { newCareer, playPending, rngOf } from "../www/js/sim.js";
import { nextCard, chooseLife, clearCard, life, statsNow, resolveDecisionCard, decisionCard } from "../www/js/cards.js";
import { acceptClubOffer } from "../www/js/contract.js";
import { userP } from "../www/js/world.js";
import { answerPress } from "../www/js/press.js";
const G = newCareer({ fn: "Bima", ln: "Saputra", nat: "IDN", birthplace: "Makassar", age: 16, pos: "ST", foot: "Kanan", difficulty: "Normal", club: "acak", seed: 21 });
G.settings = { mode: "kartu", autoEffort: "Normal" };
const count = {}; let taps = 0; const t0 = Date.now();
const startDate = G.date;
while (G.date - startDate < 540 && taps < 4000) {
  const c = nextCard(G); taps++;
  count[c.type] = (count[c.type] || 0) + 1;
  if (c.type === "life") { const r = rngOf(G); G.card = chooseLife(G, r, c, taps % 7 === 0 && life(G).stars ? "super" : taps % 2); G.rs = r.s; continue; }
  if (c.type === "match") { playPending(G, false); clearCard(G); continue; }
  if (c.type === "decision") {
    const m = decisionCard(G, c);
    const i = m.options.findIndex(o => o.act === "openNeg");
    if (i >= 0) { resolveDecisionCard(G, c, i); const r = rngOf(G); acceptClubOffer(G, r); G.rs = r.s; }
    else { const j = m.options.findIndex(o => o.act === "openPress"); resolveDecisionCard(G, c, j >= 0 ? j : 0); while (G.press && !G.press.done) { const q = G.press.questions[G.press.idx]; answerPress(G, "pos", q.pos[0]); } }
    clearCard(G); continue;
  }
  if (c.type === "retired") break;
  clearCard(G);
}
const u = userP(G), L = life(G), s = statsNow(G);
console.log("taps", taps, "days", G.date - startDate, "ms", Date.now() - t0, "ms/tap", Math.round((Date.now() - t0) / taps));
console.log("cards", JSON.stringify(count));
console.log("stats", JSON.stringify(Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Math.round(v)]))), "stars", L.stars, "glory", L.glory, "collected", Object.keys(L.cards).length, "ca", u.ca, "club", G.clubs[u.club].name, u.squad, "apps", G.user.totals?.all?.apps);
