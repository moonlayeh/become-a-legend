// Plays several seasons automatically and prints a sanity report.
import { createWorld, table, userP } from "../www/js/world.js";
import { continueGame, playPending, rngOf } from "../www/js/sim.js";
import { resolveDecision, squadStatus } from "../www/js/career.js";
import { serialize, deserialize } from "../www/js/save.js";
import { fmt, ageOn } from "../www/js/calendar.js";
import { fullName } from "../www/js/player.js";

const opts = { fn: "Bima", ln: "Saputra", nat: process.argv[2] || "IDN", birthplace: process.argv[3] || "Makassar", age: 16, pos: process.argv[4] || "ST", foot: "Kanan", difficulty: "Normal", club: "acak", seed: +(process.argv[5] || 7) };
const seasons = +(process.argv[6] || 3);
let t0 = Date.now();
let G = createWorld(opts);
console.log("world built ms", Date.now() - t0, "players", Object.keys(G.players).length, "club", G.clubs[userP(G).club].name, "CA/PA", userP(G).ca, userP(G).pa);
t0 = Date.now();
const stops = {};
let matches = 0, viewed = 0;
const endYear = 2026 + seasons;
while (!G.user.retired && G.season < endYear) {
  const s = continueGame(G);
  stops[s] = (stops[s] || 0) + 1;
  if (s === "match") { const r = playPending(G, matches % 20 === 0); matches++; if (r.replay) viewed++; }
  if (s === "decision") {
    const m = G.inbox.find(x => x.kind === "decision" && !x.done);
    const pick = m.options.findIndex(o => /transfer|loan|signContract|freeAgent/.test(o.act));
    resolveDecision(G, m.id, pick >= 0 ? pick : 0, rngOf(G));
  }
}
console.log("sim ms", Date.now() - t0, "stops", stops, "userMatches", matches);
const u = userP(G);
console.log(fullName(u), "age", ageOn(u.birth, G.date), "CA", u.ca, "PA", u.pa, "club", G.clubs[u.club].name, "status", squadStatus(G), "caps", u.caps, G.user.int);
console.table(G.user.history.map(h => ({ s: h.season, club: h.clubName, apps: h.apps, sub: h.sub, g: h.gls, a: h.ast, r: h.rating, u19: h.u19 ? `${h.u19.apps}/${h.u19.gls}` : "", intl: h.intl ? `${h.intl.apps}/${h.intl.gls}` : "", ca: h.ca, notes: h.notes.join(",") })));
console.log("trophies", G.user.trophies, "awards", G.user.awards);
for (const L of Object.values(G.leagues)) {
  const last = L.history[L.history.length - 1];
  if (last) console.log(L.name, "champ", G.clubs[last.champion].name, "top", G.players[last.topScorer] ? fullName(G.players[last.topScorer]) : "-", last.topGoals);
}
const tb = table(G, G.clubs[u.club].league);
console.log("current table top5", tb.slice(0, 5).map(r => `${G.clubs[r.id].short} ${r.pts}`).join(" | "));
const s = serialize(G);
console.log("save size KB", (s.length / 1024).toFixed(0), "chars; roundtrip ok", deserialize(s).players[u.id].a.length === u.a.length);
console.log("inbox sample:", G.inbox.slice(0, 6).map(m => `[${fmt(m.date)}] ${m.title}`).join(" / "));
console.log("news:", G.news.slice(0, 5).map(n => n.text).join(" / "));
