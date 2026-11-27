// Card mode screens: the magazine home, the card deck (life cards, matches, decisions, monthly
// recaps), the match result card, the card album and the trophy room. Card art is drawn in SVG
// from the same cartoon faces used everywhere else.
import { register, go, save, S, render } from "./shell.js";
import { $, $$, esc, crest, avatar, lookFor, flagEmoji, toast, moneyShort, pill1 } from "./core.js";
import { NATIONS, POS_LABEL } from "../data.js";
import { ageOn, fmt, ymd, seasonLabel } from "../calendar.js";
import { userP, userClub } from "../world.js";
import { fullName, shortName } from "../player.js";
import { pendingTeams, playPending, rngOf } from "../sim.js";
import { squadStatus } from "../career.js";
import { acceptClubOffer } from "../contract.js";
import { MOMENT_LABEL } from "../match.js";
import { life, statsNow, STAT_META, nextCard, chooseLife, evById, EVENTS, clearCard, decisionCard, resolveDecisionCard } from "../cards.js";
import { startWatch } from "./match.js";

const BUL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const fmt1 = v => (Math.round(v * 10) / 10).toLocaleString("id-ID", { maximumFractionDigits: 1 });
const hashS = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };

// ---------- top status strip (like a phone game HUD) ----------
export function hud(G) {
  const u = userP(G), club = userClub(G), L = life(G), st = statsNow(G);
  const seg = v => `<span class="hseg">${Array.from({ length: 5 }, (_, i) => `<i class="${v >= (i + 1) * 20 - 10 ? "on" : ""}"></i>`).join("")}</span>`;
  const { y, m, d } = ymd(G.date);
  return `<div class="hud"><div class="hud1"><span class="hav">${avatar(lookFor(u), club.colors, 40, ageOn(u.birth, G.date))}</span><div style="flex:1;min-width:0"><b>${flagEmoji(u.nat)} ${esc(shortName(u))} · ${ageOn(u.birth, G.date)} tahun</b><div class="muted" style="font-size:12px">${esc(POS_LABEL[u.main])} · ${esc(club.short)}${u.squad === "Y" ? " U-19" : ""}</div></div><span class="hstar" title="Bintang untuk pilihan super">⭐ ${L.stars}</span></div>
    <div class="hud2">${STAT_META.map(([k, l, ic, col]) => `<div class="hst" style="--c:${col}" title="${l}"><span>${ic} <b>${Math.round(st[k])}</b></span>${seg(st[k])}</div>`).join("")}</div>
    <div class="hdate">📅 ${d} ${BUL[m - 1]} ${y}</div></div>`;
}

// ---------- card art ----------
const NPC = {
  coach: { age: 52, shirt: ["#1d2433", "#e6e6e6"], beard: 4, hair: 3, hc: 4 }, veteran: { age: 34, beard: 2, hair: 1, hc: 0 }, mate: { age: 20 }, rival: { age: 24, shirt: ["#b71c1c", "#fff"] },
  doctor: { age: 45, shirt: ["#f2f5f7", "#7fb6d6"], gl: 1, hair: 3, hc: 4 }, agent: { age: 40, shirt: ["#222", "#c9a227"], gl: 1, hair: 3 }, scout: { age: 48, shirt: ["#3b3b3b", "#999"], gl: 1, beard: 1 },
  journalist: { age: 33, shirt: ["#2f5d8a", "#fff"] }, family: { age: 47, shirt: ["#8a5a3b", "#f3d3b5"], hair: 3, beard: 4 }, kid: { age: 9, shirt: ["#ffb300", "#fff"] }, fan: { age: 26 }, friend: { age: 21, shirt: ["#5c6bc0", "#fff"], hair: 6 },
};
function npcLook(kind, seed, nat = "IDN") {
  const base = lookFor({ id: hashS(kind + seed) % 99991, nat });
  const n = NPC[kind] || {};
  return { look: { ...base, ...(n.beard != null ? { beard: n.beard } : {}), ...(n.hair != null ? { hair: n.hair } : {}), ...(n.hc != null ? { hc: n.hc } : {}), gl: n.gl || 0 }, age: n.age || 25, shirt: n.shirt };
}
const BG = {
  stadium: `<defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#091637"/><stop offset="1" stop-color="#23408f"/></linearGradient></defs><rect width="300" height="220" fill="url(#g1)"/>${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 37) % 300}" cy="${20 + ((i * 53) % 70)}" r="${1 + (i % 3)}" fill="#fff" opacity="${0.25 + (i % 4) * 0.12}"/>`).join("")}<path d="M0 120 Q150 85 300 120 V160 H0Z" fill="#162a5c"/><path d="M0 150 Q150 125 300 150 V220 H0Z" fill="#2e7d32"/><path d="M0 170 H300 M0 195 H300" stroke="#43a047" stroke-width="10" opacity=".5"/><polygon points="40,0 70,0 150,140 120,140" fill="#fff" opacity=".06"/><polygon points="230,0 260,0 180,140 150,140" fill="#fff" opacity=".06"/>`,
  pitch: `<defs><linearGradient id="g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5aa9e6"/><stop offset="1" stop-color="#bde3ff"/></linearGradient></defs><rect width="300" height="220" fill="url(#g2)"/><rect y="70" width="300" height="40" fill="#455a7a"/>${Array.from({ length: 30 }, (_, i) => `<circle cx="${5 + i * 10}" cy="${80 + (i % 3) * 9}" r="3.5" fill="${["#e53935", "#fdd835", "#fff", "#1e88e5"][i % 4]}" opacity=".7"/>`).join("")}<rect y="108" width="300" height="112" fill="#3c9a3f"/>${[0, 1, 2, 3, 4].map(i => `<rect x="${i * 60}" y="108" width="30" height="112" fill="#46a84a"/>`).join("")}<path d="M110 112 V96 H190 V112" stroke="#fff" stroke-width="3" fill="none"/>`,
  training: `<rect width="300" height="220" fill="#8fd0ff"/><circle cx="250" cy="40" r="20" fill="#ffe082"/><rect y="105" width="300" height="115" fill="#4caf50"/><path d="M0 105 H300" stroke="#e0e0e0" stroke-width="4"/>${[30, 80, 130, 230, 270].map(x => `<polygon points="${x},150 ${x + 8},168 ${x - 8},168" fill="#ff7043"/>`).join("")}<path d="M0 95 H300" stroke="#9e9e9e" stroke-width="2" stroke-dasharray="4 6"/>`,
  rain: `<rect width="300" height="220" fill="#6b7a8f"/><rect y="110" width="300" height="110" fill="#3d6b3f"/>${Array.from({ length: 60 }, (_, i) => `<line x1="${(i * 23) % 300}" y1="${(i * 41) % 200}" x2="${(i * 23) % 300 - 6}" y2="${(i * 41) % 200 + 16}" stroke="#d6e4f0" stroke-width="1.4" opacity=".55"/>`).join("")}`,
  tunnel: `<rect width="300" height="220" fill="#15151c"/><polygon points="120,60 180,60 300,220 0,220" fill="#25252f"/><rect x="125" y="62" width="50" height="60" fill="#fff3c4" opacity=".9"/><path d="M0 0 L120 60 M300 0 L180 60" stroke="#333" stroke-width="3"/>${[0, 1, 2, 3].map(i => `<rect x="${20 + i * 70}" y="10" width="40" height="5" fill="#fff" opacity=".3"/>`).join("")}`,
  canteen: `<rect width="300" height="220" fill="#f3e7d3"/><rect x="190" y="25" width="90" height="60" fill="#bfe3ff" stroke="#b08d57" stroke-width="5"/><rect y="150" width="300" height="70" fill="#c8a27a"/><ellipse cx="70" cy="165" rx="60" ry="10" fill="#fff"/>`,
  office: `<rect width="300" height="220" fill="#d7c2a1"/><rect x="170" y="20" width="110" height="80" fill="#1e3557"/>${Array.from({ length: 12 }, (_, i) => `<rect x="${178 + (i % 6) * 17}" y="${50 + Math.floor(i / 6) * 22}" width="10" height="${20 + (i % 3) * 8}" fill="#ffd54f" opacity=".5"/>`).join("")}<rect y="160" width="300" height="60" fill="#7b5235"/>`,
  gym: `<rect width="300" height="220" fill="#9aa5b1"/><rect y="170" width="300" height="50" fill="#37474f"/>${[40, 110, 250].map(x => `<rect x="${x}" y="60" width="8" height="110" fill="#455a64"/><rect x="${x - 20}" y="80" width="48" height="6" fill="#263238"/><circle cx="${x - 22}" cy="83" r="12" fill="#212121"/><circle cx="${x + 30}" cy="83" r="12" fill="#212121"/>`).join("")}`,
  room: `<rect width="300" height="220" fill="#3e5c8a"/><rect x="200" y="25" width="70" height="60" fill="#0d1b2a" stroke="#c9b28b" stroke-width="5"/><circle cx="245" cy="45" r="8" fill="#fff9c4"/>${[20, 70, 120].map((x, i) => `<rect x="${x}" y="${30 + i * 4}" width="38" height="48" fill="#fff" stroke="#222" stroke-width="2" transform="rotate(${i * 4 - 4} ${x + 19} 54)"/><rect x="${x + 4}" y="${34 + i * 4}" width="30" height="30" fill="${["#43a047", "#e53935", "#1e88e5"][i]}" transform="rotate(${i * 4 - 4} ${x + 19} 54)"/>`).join("")}<rect y="165" width="300" height="55" fill="#6d4c41"/><rect x="0" y="145" width="140" height="35" rx="6" fill="#eceff1"/>`,
  park: `<defs><linearGradient id="g3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb26b"/><stop offset="1" stop-color="#ffe5b4"/></linearGradient></defs><rect width="300" height="220" fill="url(#g3)"/><circle cx="60" cy="60" r="26" fill="#fff3c4"/>${[20, 90, 250, 290].map((x, i) => `<rect x="${x - 4}" y="${90 - i * 5}" width="8" height="70" fill="#6d4c41"/><circle cx="${x}" cy="${80 - i * 5}" r="${26 + i * 3}" fill="${i % 2 ? "#689f38" : "#7cb342"}"/>`).join("")}<rect y="160" width="300" height="60" fill="#8bc34a"/><rect x="190" y="150" width="90" height="10" fill="#8d6e63"/>`,
  home: `<rect width="300" height="220" fill="#f7d9a8"/><rect x="20" y="30" width="60" height="45" fill="#fff" stroke="#8d6e63" stroke-width="4"/><rect y="170" width="300" height="50" fill="#a1887f"/><rect x="170" y="130" width="120" height="45" rx="10" fill="#c0504d"/><rect x="250" y="40" width="6" height="90" fill="#5d4037"/><polygon points="236,40 270,40 262,20 244,20" fill="#ffecb3"/>`,
  hospital: `<rect width="300" height="220" fill="#e3f2f1"/><rect x="220" y="20" width="50" height="50" rx="8" fill="#fff"/><path d="M245 30 V60 M230 45 H260" stroke="#e53935" stroke-width="9"/><rect y="170" width="300" height="50" fill="#b2dfdb"/><rect x="10" y="140" width="130" height="30" rx="6" fill="#fff"/>`,
  press: `<rect width="300" height="220" fill="#14213d"/>${Array.from({ length: 24 }, (_, i) => `<rect x="${10 + (i % 8) * 36}" y="${15 + Math.floor(i / 8) * 34}" width="26" height="22" rx="3" fill="${i % 3 ? "#e63946" : "#457b9d"}" opacity=".5"/>`).join("")}<rect y="170" width="300" height="50" fill="#0b132b"/>${[60, 110, 190, 240].map(x => `<rect x="${x}" y="140" width="5" height="40" fill="#222"/><rect x="${x - 6}" y="128" width="17" height="16" rx="5" fill="#333"/>`).join("")}`,
  street: `<rect width="300" height="220" fill="#1a1f3b"/>${[0, 50, 95, 160, 215, 260].map((x, i) => `<rect x="${x}" y="${40 + (i % 3) * 20}" width="${40 + (i % 2) * 10}" height="140" fill="#262d52"/>${Array.from({ length: 6 }, (_, j) => `<rect x="${x + 6 + (j % 2) * 18}" y="${55 + (i % 3) * 20 + Math.floor(j / 2) * 25}" width="10" height="12" fill="#ffd54f" opacity="${0.3 + (j % 3) * 0.2}"/>`).join("")}`).join("")}<rect y="180" width="300" height="40" fill="#333"/><path d="M0 200 H300" stroke="#ffeb3b" stroke-width="3" stroke-dasharray="18 14"/>`,
  party: `<rect width="300" height="220" fill="#2a1145"/><path d="M0 30 Q75 60 150 30 T300 30" stroke="#ffd54f" stroke-width="2" fill="none"/>${Array.from({ length: 12 }, (_, i) => `<circle cx="${12 + i * 25}" cy="${33 + Math.sin(i) * 12}" r="4" fill="${["#ff4081", "#ffd54f", "#69f0ae", "#40c4ff"][i % 4]}"/>`).join("")}${[40, 260].map((x, i) => `<ellipse cx="${x}" cy="90" rx="16" ry="20" fill="${i ? "#ff4081" : "#40c4ff"}"/><path d="M${x} 110 V160" stroke="#fff" stroke-width="1"/>`).join("")}<rect y="175" width="300" height="45" fill="#3b1a5e"/>`,
  cafe: `<rect width="300" height="220" fill="#7b4f35"/><rect y="150" width="300" height="70" fill="#4e342e"/><rect x="20" y="40" width="80" height="60" fill="#ffe0b2" opacity=".85"/><rect x="200" y="110" width="90" height="40" fill="#a1887f"/>`,
};
export function sceneSvg(G, sc, seed, opts = {}) {
  const [bg, npc, prop] = sc;
  const u = userP(G), club = userClub(G);
  const place = (html, x, y, w) => html.replace('<svg class="avatar"', `<svg x="${x}" y="${y}"`).replace(/width="\d+" height="\d+"/, `width="${w}" height="${w}"`);
  let people = "";
  if (npc) { const n = npcLook(npc, seed, club.nation); people += place(avatar(n.look, n.shirt || (npc === "mate" || npc === "fan" ? club.colors : ["#455a64", "#fff"]), 100, n.age), npc === "kid" ? 26 : 8, npc === "kid" ? 92 : 58, npc === "kid" ? 120 : 160); }
  if (!opts.noUser) people += place(avatar(lookFor(u), club.colors, 100, ageOn(u.birth, G.date)), npc ? 130 : 60, 40, 180);
  const propSvg = prop ? `<circle cx="${npc ? 150 : 245}" cy="${npc ? 180 : 60}" r="28" fill="rgba(0,0,0,.35)"/><text x="${npc ? 150 : 245}" y="${npc ? 192 : 72}" font-size="34" text-anchor="middle">${prop}</text>` : "";
  return `<svg viewBox="0 0 300 220" class="gart" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${BG[bg] || BG.stadium}${people}${propSvg}</svg>`;
}
const RCOL = { BIASA: "#cfd8e6", PERUNGGU: "#ef8a3c", EMAS: "#ffcc33" };
// optional painted illustration: www/img/cards/<id>.png (or .jpg/.webp) replaces the drawn scene when present
export const cardArt = (G, sc, id) => `<div class="gpic">${sceneSvg(G, sc, id)}<img src="img/cards/${id}.png" alt="" class="gphoto" onerror="const n={png:'jpg',jpg:'webp'}[this.src.split('.').pop()];if(n)this.src=this.src.replace(/\\.\\w+$/,'.'+n);else this.remove()"></div>`;
export function gcard({ cat, r = "BIASA", art, title, text, extra = "" }) {
  return `<div class="gcard r-${r}" style="--rc:${RCOL[r] || RCOL.BIASA}"><div class="gtop"><span class="gcat">${esc(cat)}</span><span class="grar">${r === "BIASA" ? "" : "★ "}${esc(r)}</span></div><div class="gimg">${art}</div><div class="gbody"><div class="gtitle">${esc(title)}</div><div class="gtext">${esc(text)}</div>${extra}</div></div>`;
}
const DELTA_ORDER = [["bakat", "👟", "Bakat"], ["health", "❤", "Kesehatan"], ["mental", "🧠", "Mental"], ["social", "👥", "Sosial"], ["fame", "⭐", "Ketenaran"], ["money", "💵", "Uang"]];
export function deltaRow(G, delta, full = false) {
  const st = statsNow(G);
  const items = DELTA_ORDER.filter(([k]) => full || delta[k]);
  if (!items.length) return '<div class="muted" style="text-align:center;font-size:13px">Tidak ada perubahan.</div>';
  return `<div class="drow">${items.map(([k, ic, l]) => { const v = delta[k] || 0; const txt = k === "money" ? (v ? `${v > 0 ? "+" : "−"}${moneyShort(Math.abs(v))}` : "=") : v ? `${v > 0 ? "+" : "−"}${fmt1(Math.abs(v))}` : "="; return `<div class="dcell"><span class="di">${ic}</span><b>${k === "money" ? moneyShort(st.money) : Math.round(st[k])}</b><span class="${v > 0 ? "up" : v < 0 ? "dn" : ""}">${txt}</span><small>${l}</small></div>`; }).join("")}</div>`;
}

// swipe a card left/right to choose (Reigns-style); buttons do the same
export function attachSwipe(cardEl, labels, onPick) {
  if (!cardEl) return;
  let x0 = null, dx = 0, id = null;
  const hint = cardEl.querySelector(".ghint");
  const set = () => { cardEl.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`; if (hint) { hint.textContent = dx < -30 ? `◀ ${labels[0]}` : dx > 30 ? `${labels[1]} ▶` : ""; hint.className = `ghint ${dx < -30 ? "l" : dx > 30 ? "r" : ""}`; } };
  cardEl.addEventListener("pointerdown", e => { x0 = e.clientX; dx = 0; id = e.pointerId; cardEl.setPointerCapture?.(id); cardEl.style.transition = "none"; });
  cardEl.addEventListener("pointermove", e => { if (x0 == null) return; dx = e.clientX - x0; set(); });
  const end = () => {
    if (x0 == null) return; x0 = null; cardEl.style.transition = "transform .25s";
    if (Math.abs(dx) > 90) { const pick = dx < 0 ? 0 : 1; cardEl.style.transform = `translateX(${dx < 0 ? -600 : 600}px) rotate(${dx < 0 ? -30 : 30}deg)`; setTimeout(() => onPick(pick), 200); }
    else { dx = 0; set(); }
  };
  cardEl.addEventListener("pointerup", end); cardEl.addEventListener("pointercancel", end);
}

// ---------- MAGAZINE HOME ----------
function headline(G) {
  const u = userP(G), cs = G.user.cs || {}, gls = Object.values(cs).reduce((s, x) => s + (x.gls || 0), 0);
  const st = u.squad === "Y" ? "Bintang muda akademi" : squadStatus(G);
  return { big: gls ? `${gls} GOL` : `${(G.user.totals?.all?.apps || 0)} LAGA`, sub: st };
}
register("main", "beranda", (G, root) => {
  const u = userP(G), club = userClub(G), L = life(G), h = headline(G);
  const tier = L.glory % 30, card = G.card;
  const tiles = [["Karier", "pemain/karier", "📈"], ["Kehidupan Pribadi", "main/hidup", "🏠"], ["Reputasi", "pemain/pribadi", "⭐"], ["Trofi", "main/trofi", "🏆"], ["Koleksi", "main/koleksi", "🃏"], ["Menu Lengkap", "portal/ringkasan", "☰"]];
  root.innerHTML = hud(G) + `
    <div class="mag" style="--c1:${club.colors[0]}"><div class="magt">LEGEND<span>MAG</span></div><div class="magno">No. ${ageOn(u.birth, G.date)}</div>
      <div class="magav">${avatar(lookFor(u), club.colors, 240, ageOn(u.birth, G.date))}</div>
      <div class="magtx"><div class="mag1">${esc(shortName(u).toUpperCase())}, ${ageOn(u.birth, G.date)} TAHUN</div><div class="mag2">${esc(h.big)}</div><div class="mag3">${esc(h.sub)}</div></div></div>
    <div class="card glory click" data-go="main/hidup"><div class="spread"><b>🛣 Jalan Kejayaan ${seasonLabel(G.season)}</b><span class="muted">${L.glory} poin</span></div><div class="gbar"><i style="width:${tier / 30 * 100}%"></i></div><div class="muted" style="font-size:12px">${30 - tier} poin lagi untuk ⭐ berikutnya · menang, gol, assist, dan momen tepat memberi poin</div></div>
    <button class="btn pri playbig" data-go="main/kartu">▶ ${card ? (card.type === "match" ? "Main pertandingan" : "Lanjutkan kartu") : "Main"}</button>
    <div class="tiles">${tiles.map(([l, g, ic]) => `<button class="tile" data-go="${g}"><span>${ic}</span>${l}</button>`).join("")}</div>
    <p class="muted" style="font-size:12px;text-align:center;margin:10px 0 20px">Tanpa energi dan tanpa iklan: tiap ketukan memajukan karier ke kartu berikutnya.</p>`;
});

// ---------- KEHIDUPAN PRIBADI (stat explanations) ----------
const STAT_HELP = {
  bakat: "Kemampuan olahraga dan potensimu. Makin sering main dan berlatih, makin tinggi. Naik sampai usia sekitar 23 dan turun setelah 30.",
  health: "Kebugaran dan daya tahan tubuh. Kesehatan rendah membuatmu lebih mudah cedera.",
  mental: "Suasana hati dan kepercayaan diri. Memengaruhi performa di laga dan keputusanmu.",
  social: "Hubunganmu dengan rekan setim dan pelatih. Sosial tinggi membuat pelatih lebih sering memilihmu.",
  fame: "Seberapa dikenal kamu. Ketenaran menarik minat klub besar, sponsor, dan pelatih timnas.",
};
register("main", "hidup", (G, root) => {
  const st = statsNow(G), L = life(G);
  root.innerHTML = hud(G) + STAT_META.map(([k, l, ic, col]) => `<div class="card"><div class="spread"><b>${ic} ${l}</b><b style="color:${col}">${Math.round(st[k])}</b></div><div class="gbar" style="--c:${col}"><i style="width:${Math.min(100, st[k])}%;background:${col}"></i></div><p class="muted" style="font-size:13px;margin:6px 0 0">${STAT_HELP[k]}</p></div>`).join("") +
    `<div class="card"><div class="spread"><b>💵 Kekayaan</b><b>${moneyShort(st.money)}</b></div></div>
     <div class="card"><div class="spread"><b>🃏 Keputusan</b><b>${L.decisions}</b></div><div class="spread" style="margin-top:6px"><b>🛣 Jalan Kejayaan</b><b>${L.glory} poin</b></div><div class="spread" style="margin-top:6px"><b>⭐ Bintang</b><b>${L.stars}</b></div><p class="muted" style="font-size:12.5px;margin:6px 0 0">Bintang dipakai untuk pilihan super di kartu (hasil terbaik dijamin). Kamu mendapatkannya dari Jalan Kejayaan dan dari memenangi minimal dua momen kunci dalam satu laga.</p></div>`;
});

// ---------- KOLEKSI ----------
register("main", "koleksi", (G, root) => {
  const L = life(G), have = EVENTS.filter(e => L.cards[e.id]).length;
  root.innerHTML = hud(G) + `<div class="card"><div class="spread"><b>🃏 Koleksiku</b><span class="muted">${have}/${EVENTS.length} kartu</span></div><div class="gbar"><i style="width:${have / EVENTS.length * 100}%"></i></div></div>
    <div class="album">${EVENTS.map(e => L.cards[e.id] ? `<div class="acard r-${e.r}" style="--rc:${RCOL[e.r]}"><div class="aimg">${cardArt(G, e.sc, e.id)}</div><b>${esc(e.t)}</b><small>${e.cat} · ${L.cards[e.id]}×</small></div>` : `<div class="acard lock"><div class="aimg lockimg">?</div><b>???</b><small>${e.cat}</small></div>`).join("")}</div>`;
});

// ---------- TROFI ----------
const CAB = [["Gelar liga", t => !t.comp && !/Piala|Cup|Copa|Coppa|Pokal|Coupe|Super/i.test(t.name) && !NATIONS_NAMES.has(t.club)], ["Piala nasional", t => /Piala|Cup|Copa|Coppa|Pokal|Coupe|Taça|Beker/i.test(t.name) && !/Champions|Europa|Conference|Libertadores|AFC|CAF|Asia|Dunia|World|AFF|Euro|Nations/i.test(t.name)], ["Piala kontinental", t => /Champions|Europa|Conference|Libertadores|AFC Champions|CAF|Sudamericana|ACL/i.test(t.name) && !NATIONS_NAMES.has(t.club)], ["Bersama timnas", t => NATIONS_NAMES.has(t.club)]];
let NATIONS_NAMES = new Set();
register("main", "trofi", (G, root) => {
  NATIONS_NAMES = new Set(Object.values(NATIONS).map(n => n.name));
  const T = G.user.trophies || [], A = G.user.awards || [];
  const awardCats = [["Bola Emas", "💍"], ["Trofi Pemain Muda Terbaik Dunia", "🌟"], ["Sepatu Emas", "👟"]];
  root.innerHTML = hud(G) + `<div class="card"><div class="ch">Prestasi</div><div class="cab">${CAB.map(([l, f]) => { const got = T.filter(f); return `<div class="cabi ${got.length ? "on" : ""}"><span>🏆</span><b>${l}</b><small>${got.length ? `${got.length}× · ${esc(got.slice(-1)[0].year)}` : "Belum dimenangkan"}</small></div>`; }).join("")}${awardCats.map(([l, ic]) => { const got = A.filter(a => a.name === l); return `<div class="cabi ${got.length ? "on" : ""}"><span>${ic}</span><b>${l}</b><small>${got.length ? `${got.length}× · ${esc(got.slice(-1)[0].year)}` : "Belum dimenangkan"}</small></div>`; }).join("")}</div></div>` +
    `<div class="card"><div class="ch">Daftar trofi</div>${T.map(t => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🏆 ${esc(t.name)} <span class="muted">· ${esc(t.club)}</span></span><span class="muted">${esc(t.year)}</span></div>`).join("") || '<div class="muted">Belum ada trofi. Ayo menang!</div>'}${A.map(a => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:14px"><span>🎖 ${esc(a.name)}</span><span class="muted">${esc(a.year)}</span></div>`).join("")}</div>`;
});

// ---------- THE DECK ----------
function busy(msg = "Waktu berjalan…") { const ld = document.createElement("div"); ld.className = "loading"; ld.innerHTML = `<div><div class="spin"></div>${esc(msg)}</div>`; document.body.appendChild(ld); return () => ld.remove(); }
register("main", "kartu", (G, root, prm) => {
  if (!G.card) {
    root.innerHTML = hud(G) + '<div class="card" style="text-align:center;padding:40px 10px"><div class="spin"></div><div class="muted" style="margin-top:8px">Waktu berjalan…</div></div>';
    setTimeout(() => { try { nextCard(G); } catch (e) { console.error(e); G.card = null; } save(); render(); }, 30);
    return;
  }
  const c = G.card;
  if (c.type === "life") return lifeCard(G, root, c);
  if (c.type === "outcome") return outcomeCard(G, root, c);
  if (c.type === "match") return matchCard(G, root, c, prm);
  if (c.type === "decision") return decisionCardView(G, root, c);
  if (c.type === "recap") return recapCard(G, root, c);
  if (c.type === "note") return noteCard(G, root, c);
  if (c.type === "retired") { root.innerHTML = hud(G) + gcard({ cat: "KARIER", r: "EMAS", art: sceneSvg(G, ["stadium", null, "🏁"], "ret"), title: "Karier berakhir", text: "Terima kasih atas perjalanan luar biasamu." }) + `<button class="btn pri playbig" data-go="pemain/karier">Lihat kariermu</button>`; return; }
  G.card = null; render();
});
const nextBtn = (label = "Lanjut") => `<button class="btn pri playbig" id="gnext">${label}</button>`;
const goNext = G => { clearCard(G); save(); go("main", "kartu", {}, true); };

function lifeCard(G, root, c) {
  const e = evById(c.id); if (!e) { goNext(G); return; }
  const L = life(G);
  root.innerHTML = hud(G) + `<div class="gwrap"><div class="ghint"></div>${gcard({ cat: e.cat, r: e.r, art: cardArt(G, e.sc, e.id), title: e.t, text: e.x })}</div>
    <div class="gbtns"><button class="gb l" data-pick="0"><span>✖</span>${esc(e.o[0][0])}</button>${L.stars > 0 ? `<button class="gb s" data-pick="super"><span>⭐</span>Pilihan super</button>` : ""}<button class="gb r" data-pick="1"><span>♥</span>${esc(e.o[1][0])}</button></div>
    <p class="muted" style="text-align:center;font-size:12px">Geser kartu ke kiri atau kanan untuk memilih</p>`;
  const pick = p => { const rng = rngOf(G); G.card = chooseLife(G, rng, c, p); G.rs = rng.s; save(); render(); };
  attachSwipe($(".gwrap", root), [e.o[0][0], e.o[1][0]], pick);
  $$("[data-pick]", root).forEach(b => (b.onclick = () => pick(b.dataset.pick === "super" ? "super" : +b.dataset.pick)));
}
function outcomeCard(G, root, c) {
  const e = evById(c.id);
  root.innerHTML = hud(G) + gcard({ cat: e?.cat || "HASIL", r: e?.r, art: e ? cardArt(G, e.sc, e.id) : sceneSvg(G, ["stadium", null, "✨"], "o"), title: c.choice, text: c.text, extra: `${c.superUsed ? '<div class="gsuper">⭐ Pilihan super dipakai</div>' : ""}${c.inj ? `<div class="ginj">✚ ${esc(c.inj)}</div>` : ""}${deltaRow(G, c.delta)}` }) + nextBtn();
  $("#gnext", root).onclick = () => goNext(G);
}
function noteCard(G, root, c) {
  root.innerHTML = hud(G) + gcard({ cat: c.cat || "PESAN", r: c.r || "BIASA", art: sceneSvg(G, c.sc || ["office", "agent", "📨"], c.title), title: c.title, text: c.text }) + nextBtn();
  $("#gnext", root).onclick = () => goNext(G);
}
function recapCard(G, root, c) {
  const res = g => (g.score[0] > g.score[1] ? "M" : g.score[0] < g.score[1] ? "K" : "S");
  root.innerHTML = hud(G) + `<div class="gcard r-BIASA" style="--rc:#7fa7ff"><div class="gtop"><span class="gcat">REKAP BULAN</span><span class="grar">${String(c.m).padStart(2, "0")}/${c.y}</span></div><div class="gbody">
    <div class="gtitle">${BUL[c.m - 1]} ${c.y}</div>
    <div class="rk"><span class="m">${c.w}M</span><span class="s">${c.d}S</span><span class="k">${c.l}K</span>${c.pos ? `<span class="p">Peringkat ${c.pos} dari ${c.of}</span>` : ""}</div>
    ${c.games.map(g => `<div class="spread" style="padding:5px 0;border-top:1px solid var(--line);font-size:13.5px"><span>${esc(g.opp)} <span class="muted" style="font-size:11.5px">${esc(g.comp)}</span></span><span>${g.score[0]}-${g.score[1]} <span class="tag ${res(g)}">${res(g)}</span> ${pill1(g.rating)}</span></div>`).join("") || '<div class="muted">Tidak ada laga bulan ini.</div>'}
    <div class="spread" style="margin:8px 0;font-size:13.5px"><span>⚽ ${c.gls} gol</span>${c.avg ? `<span>★ rata-rata ${fmt1(c.avg)}</span>` : ""}</div>
    ${deltaRow(G, c.delta)}</div></div>` + nextBtn();
  $("#gnext", root).onclick = () => goNext(G);
}
function decisionCardView(G, root, c) {
  const m = decisionCard(G, c);
  if (!m || m.done) { goNext(G); return; }
  const neg = m.options.some(o => o.act === "openNeg"), press = m.options.some(o => o.act === "openPress");
  const sc = neg ? ["office", "agent", "✍"] : press ? ["press", "journalist", "🎙"] : /timnas|Timnas|panggil/i.test(m.title) ? ["stadium", "coach", "🏳"] : /transfer|pinjam/i.test(m.tag || m.title) ? ["office", "agent", "💼"] : ["office", "coach", "📨"];
  const cat = neg ? "KONTRAK" : press ? "MEDIA" : /transfer|pinjam/i.test(m.tag || "") ? "TRANSFER" : "KEPUTUSAN";
  const body = String(m.body || "").replace(/<[^>]+>/g, "").replace(/⟦[^⟧]*⟧/g, s => s);
  root.innerHTML = hud(G) + gcard({ cat, r: neg || /transfer/i.test(m.tag || "") ? "PERUNGGU" : "BIASA", art: sceneSvg(G, sc, m.id), title: m.title, text: body.length > 260 ? body.slice(0, 257) + "…" : body }) +
    `<div class="gopts">${neg ? `<button class="opt" id="qacc"><b>✔ Terima tawaran klub</b><span>Langsung tanda tangan dengan syarat yang ditawarkan.</span></button>` : ""}${m.options.map((o, i) => `<button class="opt" data-o="${i}"><b>${esc(o.label)}</b>${o.detail ? `<span>${esc(o.detail)}</span>` : ""}</button>`).join("")}</div>
    <button class="btn sm" data-go="portal/pesan" data-p='{"mail":${m.id}}' style="width:100%;margin:6px 0 16px">Baca pesan lengkap</button>`;
  $$("[data-o]", root).forEach(b => (b.onclick = () => {
    const o = m.options[+b.dataset.o];
    const msg = resolveDecisionCard(G, c, +b.dataset.o);
    if (o.act === "openNeg") { G.card = null; save(); go("pemain", "negosiasi"); return; }
    if (o.act === "openPress") { G.card = null; save(); go("pers", "konferensi"); return; }
    G.card = { type: "note", cat, title: o.label, text: msg || "Keputusan dicatat.", sc };
    save(); render();
  }));
  $("#qacc", root)?.addEventListener("click", () => {
    const i = m.options.findIndex(o => o.act === "openNeg");
    resolveDecisionCard(G, c, i);
    const rng = rngOf(G); acceptClubOffer(G, rng); G.rs = rng.s;
    G.card = { type: "note", cat: "KONTRAK", r: "PERUNGGU", title: "Kontrak ditandatangani", text: "Kamu menerima tawaran klub. Detailnya ada di tab Kontrak.", sc: ["office", "agent", "✍"] };
    save(); render();
  });
}
function matchCard(G, root, c, prm) {
  const pd = G.pending; if (!pd) { goNext(G); return; }
  const { H, A } = pendingTeams(G);
  const crestOf = t => (G.clubs[t.club] ? crest(G.clubs[t.club], 56) : `<span style="font-size:48px">${flagEmoji(t.nat)}</span>`);
  const role = { XI: "Kamu jadi starter", Cadangan: "Kamu mulai dari bangku cadangan" }[pd.role] || "Kamu masuk skuad";
  const big = /Final|Semifinal/.test(pd.comp || "") || pd.kind === "timnas";
  if (prm.step === "instruksi") {
    const coach = pd.kind === "timnas" ? "Pelatih timnas" : "Pelatih";
    const oppT = H.club === userP(G).club || H.nat === G.camp?.nat ? A : H;
    root.innerHTML = hud(G) + `<div class="gwrap"><div class="ghint"></div>${gcard({ cat: "PERTANDINGAN", r: big ? "EMAS" : "BIASA", art: sceneSvg(G, ["training", "coach", "📋"], "instr" + pd.d), title: "Instruksi pelatih", text: `${coach}: "${oppT.name} lawan yang ${(oppT.xi?.length ? "tidak boleh diremehkan" : "kuat")}. Bagaimana kamu mau bermain?"` })}</div>
      <div class="gbtns"><button class="gb l" data-pick="0"><span>🛡</span>Main aman<small>Risiko lebih kecil</small></button><button class="gb r" data-pick="1"><span>🔥</span>Serang habis-habisan<small>Peluang lebih banyak, risiko lebih besar</small></button></div>`;
    const pick = p => { pd.mind = p ? "Termotivasi" : "Fokus"; pd.mentality = p ? 1 : -1; G.card = null; save(); startWatch(G); };
    attachSwipe($(".gwrap", root), ["Main aman", "Serang habis-habisan"], pick);
    $$("[data-pick]", root).forEach(b => (b.onclick = () => pick(+b.dataset.pick)));
    return;
  }
  root.innerHTML = hud(G) + `<div class="gcard r-${big ? "EMAS" : "BIASA"}" style="--rc:${big ? RCOL.EMAS : RCOL.BIASA}"><div class="gtop"><span class="gcat">LAGA HARI INI</span><span class="grar">${esc(pd.comp || "")}</span></div>
      <div class="gimg">${sceneSvg(G, ["stadium", null, null], "m" + pd.d)}</div>
      <div class="gbody" style="text-align:center"><div class="vs"><div>${crestOf(H)}<b>${esc(H.name)}</b></div><span>VS</span><div>${crestOf(A)}<b>${esc(A.name)}</b></div></div>
      <div class="gtext">${esc(role)}${pd.neutral ? " · tempat netral" : ""}</div></div></div>
    <button class="btn pri playbig" id="gplay">⚽ Main pertandingan</button>
    <button class="btn sm" id="gsim" style="width:100%;margin:6px 0 16px">Simulasikan cepat (tanpa momen kunci)</button>`;
  $("#gplay", root).onclick = () => go("main", "kartu", { step: "instruksi" }, true);
  $("#gsim", root).onclick = () => { const done = busy("Mensimulasikan laga…"); setTimeout(() => { playPending(G, true); G.card = null; save(); done(); go("main", "hasil", {}, true); }, 30); };
}

// ---------- MATCH RESULT ----------
register("main", "hasil", (G, root) => {
  const L = life(G), lm = L.lastMatch, ml = (G.user.matchLog || [])[0];
  if (!lm) { go("main", "kartu", {}, true); return; }
  const title = lm.won ? "MENANG!" : lm.lost ? "KALAH" : "SERI";
  root.innerHTML = hud(G) + `<div class="gcard r-${lm.won ? "EMAS" : "BIASA"}" style="--rc:${lm.won ? RCOL.EMAS : lm.lost ? "#e5484d" : RCOL.BIASA}"><div class="gtop"><span class="gcat">PELUIT AKHIR</span><span class="grar">${esc(ml?.comp || "")}</span></div><div class="gbody" style="text-align:center">
    <div class="rtitle ${lm.won ? "w" : lm.lost ? "l" : ""}">${title}</div>
    <div class="rscore">${lm.score[0]} - ${lm.score[1]}</div><div class="muted">vs ${esc(ml?.opp || "")}</div>
    <div class="rrating">${fmt1(lm.rating)}</div><div class="muted" style="margin-top:-4px">NILAIMU${lm.pom ? " · ★ Pemain terbaik" : ""}</div>
    <div class="rstats"><div><b>${lm.gls}</b><small>Gol</small></div><div><b>${lm.ast}</b><small>Assist</small></div><div><b>${lm.good}/${lm.moments || 0}</b><small>Momen tepat</small></div><div><b>${lm.min}'</b><small>Menit</small></div></div>
    ${deltaRow(G, lm.delta)}
    <div class="glory2">🛣 Jalan Kejayaan +${lm.pts}${lm.stars ? ` · ⭐ +${lm.stars}` : ""}</div></div></div>
    ${nextBtn()}<button class="btn sm" data-go="laga/hasil" style="width:100%;margin:6px 0 16px">Laporan lengkap laga</button>`;
  $("#gnext", root).onclick = () => goNext(G);
});

// ---------- the key-moment card shown inside the live match ----------
const atkTitle = m => {
  const has = k => m.options.some(o => o.k === k);
  if (has("shoot") && m.dG < 17) return ["Peluang emas di kotak penalti", "EMAS"];
  if (has("shoot") && m.dG < 30) return ["Ruang tembak dari luar kotak", "PERUNGGU"];
  if (has("cross")) return ["Bola di sisi sayap", "BIASA"];
  if (m.pressure < 2) return ["Dikepung lawan", "BIASA"];
  return ["Membangun serangan", "BIASA"];
};
export function momentCardHtml(G, R, m) {
  const sorted = m.options.slice().sort((a, b) => (m.weights[b.k] || 0) - (m.weights[a.k] || 0));
  let two = [sorted[0]];
  const shoot = m.options.find(o => o.k === "shoot");
  two.push(shoot && sorted[0].k !== "shoot" && m.dG < 30 ? shoot : sorted[1] || sorted[0]);
  if (hashS(m.t) % 2) two.reverse();
  const [title, r] = m.kind === "atk" ? atkTitle(m) : m.zone.includes("kotak") ? ["Ancaman di kotak penalti", "EMAS"] : ["Duel satu lawan satu", "PERUNGGU"];
  const vs = m.vs ? R.info[m.vs]?.name || "Lawan" : "";
  const text = m.kind === "atk" ? `Bola di kakimu di ${m.zone}${m.dG ? `, ${m.dG} m dari gawang` : ""}${m.pressure < 2 ? ". Lawan menempel ketat" : ""}.` : `${vs} menggiring bola ke arahmu di ${m.zone}.`;
  const prop = m.kind === "def" ? "🛡" : two.some(o => o.k === "shoot") ? "⚽" : "🎯";
  const html = `<div class="gwrap"><div class="ghint"></div>${gcard({ cat: "AKSI", r, art: sceneSvg(G, ["pitch", m.kind === "def" ? "rival" : null, prop], "mm" + m.t), title, text, extra: `<div class="gmini">${two.map(o => `<div><b>${MOMENT_LABEL[o.k][1]} ${esc(MOMENT_LABEL[o.k][0])}</b><small>${esc(o.hint.replace("{n}", R.info[o.pid]?.name || "rekan"))}</small></div>`).join("")}</div>` })}</div>
    <div class="gbtns"><button class="gb l" data-mk="${two[0].k}"><span>◀</span>${esc(MOMENT_LABEL[two[0].k][0])}</button><button class="gb r" data-mk="${two[1].k}"><span>▶</span>${esc(MOMENT_LABEL[two[1].k][0])}</button></div>`;
  return { html, keys: two.map(o => o.k), labels: two.map(o => MOMENT_LABEL[o.k][0]) };
}
