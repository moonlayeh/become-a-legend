// Entry point: main menu → career shell.
import { S, go, render, onGo, save } from "./ui/shell.js";
import "./ui/portal.js";
import "./ui/player.js";
import "./ui/club.js";
import "./ui/match.js";
import { mainMenu } from "./ui/create.js";
import { retireUser } from "./sim.js";
import { toast } from "./ui/core.js";

S.onGo = onGo;
S.onAct = (act) => {
  if (act === "menu-utama") { save(); S.G = null; S.drawer = false; mainMenu(enter); }
  if (act === "retire") { S.drawer = false; retireUser(S.G); save(); go("portal", "pesan", { mail: S.G.inbox[0].id }); }
};
function enter(G) {
  S.G = G;
  S.drawer = false;
  go("portal", "ringkasan", {}, true);
}
window.addEventListener("DOMContentLoaded", () => mainMenu(enter));
window.addEventListener("error", e => { try { toast("Terjadi kesalahan: " + (e.message || "").slice(0, 80)); } catch {} });
