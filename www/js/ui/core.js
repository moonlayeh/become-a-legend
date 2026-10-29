// Shared UI helpers and SVG components (crests, avatars, jerseys, badges).
import { NATIONS } from "../data.js";
import { hash } from "../meta.js";
import { RNG } from "../rng.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const money = v => `€${Math.round(v).toLocaleString("id-ID")}`;
export function moneyShort(v) { // v in euro
  if (v >= 1e9) return `€${(v / 1e9).toFixed(1).replace(".", ",")}M`;
  if (v >= 1e6) return `€${(v / 1e6).toFixed(v >= 1e7 ? 0 : 1).replace(".", ",")}Jt`;
  if (v >= 1e3) return `€${Math.round(v / 1e3)}Rb`;
  return `€${Math.round(v)}`;
}

// ---------- colour ----------
export function hexToHsl(hex) {
  if (!hex || !hex.startsWith("#")) return [0, 0, 50];
  let h = hex.slice(1); if (h.length === 3) h = h.split("").map(x => x + x).join("");
  const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let H = 0, S = 0;
  if (mx !== mn) {
    const d = mx - mn; S = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    H = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60;
  }
  return [Math.round(H), Math.round(S * 100), Math.round(l * 100)];
}
export const lum = hex => { const [, , l] = hexToHsl(hex); return l; };
// The club's "brand" colour: the more saturated of its two colours, unless both are neutral.
export function brand(colors) {
  const [a, b] = colors.map(hexToHsl);
  const pick = a[1] >= 25 && a[2] > 12 && a[2] < 85 ? a : b[1] >= 25 && b[2] > 12 && b[2] < 85 ? b : null;
  return pick || [262, 30, 40];
}
export function applyTheme(colors) {
  const [h, s] = brand(colors || ["#5b2b9b", "#ffffff"]);
  const r = document.documentElement.style;
  const sat = Math.min(85, Math.max(35, s));
  r.setProperty("--club", `hsl(${h} ${sat}% 44%)`);
  r.setProperty("--club-2", `hsl(${h} ${sat}% 30%)`);
  r.setProperty("--club-3", `hsl(${h} ${Math.min(60, sat)}% 13%)`);
  r.setProperty("--club-bg", `hsl(${h} ${Math.min(45, sat)}% 7%)`);
  r.setProperty("--club-hue", h);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", `hsl(${h} ${sat}% 44%)`);
}

// ---------- crest ----------
export function crest(club, size = 32) {
  if (!club) return "";
  const [c1, c2] = club.colors;
  const sh = hash(club.id) % 4;
  const txt = club.short.length > 3 ? club.short.slice(0, 3) : club.short;
  const fs = txt.length > 2 ? 11 : 13;
  const ink = lum(c1) > 62 ? (lum(c2) < 50 ? c2 : "#111") : (lum(c2) > 55 ? c2 : "#fff");
  const shapes = [
    `<path d="M16 1.5 29 5v10.5C29 24 23 29 16 31 9 29 3 24 3 15.5V5Z" fill="${c1}" stroke="${c2}" stroke-width="2"/>`,
    `<circle cx="16" cy="16" r="14" fill="${c1}" stroke="${c2}" stroke-width="2.5"/>`,
    `<path d="M5 3h22l-1.5 17C25 26 20 29.5 16 31c-4-1.5-9-5-9.5-11Z" fill="${c1}" stroke="${c2}" stroke-width="2"/><path d="M6 10h20" stroke="${c2}" stroke-width="2"/>`,
    `<rect x="3" y="3" width="26" height="26" rx="7" fill="${c1}" stroke="${c2}" stroke-width="2.5"/>`,
  ];
  return `<svg class="crest" width="${size}" height="${size}" viewBox="0 0 32 32" aria-label="${esc(club.name)}" role="img">${shapes[sh]}<text x="16" y="${sh === 2 ? 22 : 20}" text-anchor="middle" font-family="Saira XC, Arial Narrow, sans-serif" font-weight="800" font-size="${fs}" fill="${ink}">${esc(txt)}</text></svg>`;
}
export function teamBadge(t, size = 32) { // club or national team summary object
  if (t.club && !String(t.club).startsWith("NT-")) return crest(t.clubObj || { id: t.club, short: t.short || t.name.slice(0, 3), name: t.name, colors: t.colors }, size);
  return flagBadge(t.nat || String(t.club).slice(3), size);
}
export function flagBadge(nat, size = 28) {
  const n = NATIONS[nat];
  return `<span class="flagb" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.62)}px" title="${esc(n?.name || nat)}">${flagEmoji(nat)}</span>`;
}
const ISO = { IDN: "ID", ESP: "ES", FRA: "FR", GER: "DE", ITA: "IT", POR: "PT", NED: "NL", BEL: "BE", CRO: "HR", DEN: "DK", BRA: "BR", ARG: "AR", URU: "UY", COL: "CO", MAR: "MA", SEN: "SN", CIV: "CI", NGA: "NG", JPN: "JP", KOR: "KR", USA: "US", VIE: "VN", THA: "TH", MAS: "MY", SGP: "SG", PHI: "PH", KSA: "SA", IRN: "IR", AUS: "AU", QAT: "QA", IRQ: "IQ", UZB: "UZ", JOR: "JO", CHN: "CN", SUI: "CH", AUT: "AT", POL: "PL", NOR: "NO", SWE: "SE", SRB: "RS", TUR: "TR", UKR: "UA", CZE: "CZ", GRE: "GR", MEX: "MX", CAN: "CA", ECU: "EC", PAR: "PY", CHI: "CL", EGY: "EG", ALG: "DZ", TUN: "TN", CMR: "CM", GHA: "GH", MLI: "ML" };
export function flagEmoji(nat) {
  if (nat === "ENG") return "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (nat === "SCO") return "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  const iso = ISO[nat]; if (!iso) return "🏳";
  return String.fromCodePoint(...[...iso].map(c => 0x1f1e6 + c.charCodeAt(0) - 65));
}
export const natTag = nat => `<span class="nat">${flagEmoji(nat)} ${esc(nat)}</span>`;

export function compBadge(L, size = 30) {
  const c = L?.color || "#5b2b9b";
  return `<svg width="${size}" height="${size}" viewBox="0 0 32 32" class="crest" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="${c}"/><circle cx="16" cy="16" r="11" fill="none" stroke="#fff" stroke-opacity=".5"/><path d="M11 9h10v4a5 5 0 0 1-10 0zM16 18v4M12.5 23.5h7" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>`;
}

// ---------- jersey ----------
export function jersey(colors, num, size = 34, gk = false) {
  const [c1, c2] = gk ? ["#1f2a24", "#9be15d"] : colors;
  const ink = lum(c1) > 62 ? "#111" : "#fff";
  return `<svg class="jersey" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true">
    <path d="M13 4 7 7 2 14l5 4 3-3v21h20V15l3 3 5-4-5-7-6-3c-1 3-3.5 4.5-7 4.5S14 7 13 4Z" fill="${c1}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>
    <path d="M13 4c1 3 3.5 4.5 7 4.5S26 7 27 4" fill="none" stroke="${c2}" stroke-width="2"/>
    <path d="M2 14l5 4M38 14l-5 4" stroke="${c2}" stroke-width="2"/>
    ${num !== "" && num != null ? `<text x="20" y="27" text-anchor="middle" font-family="Saira XC, Arial Narrow, sans-serif" font-weight="800" font-size="${String(num).length > 1 ? 14 : 16}" fill="${ink}" stroke="${c2}" stroke-width=".6" paint-order="stroke">${num}</text>` : ""}
  </svg>`;
}

// ---------- avatar ----------
export const SKINS = ["#f5d0b5", "#e8b48f", "#d29a6c", "#b47a4f", "#8d5a37", "#5e3b24"];
export const HAIR_COLORS = ["#16110d", "#3b2417", "#6b4428", "#b58a4c", "#8f3b1d", "#9a9a9a"];
export const HAIR_STYLES = ["Botak", "Cepak", "Pendek", "Belah Samping", "Keriting", "Afro", "Gondrong", "Mohawk"];
export const BEARDS = ["Tidak ada", "Tipis", "Brewok", "Kambing"];
const REGION_SKIN = { af: [3, 5], ng: [4, 5], ma: [2, 4], br: [0, 4], la: [0, 3], id: [1, 3], my: [1, 3], th: [1, 3], vn: [0, 2], jp: [0, 1], kr: [0, 1], cn: [0, 1], ar: [1, 3], fa: [1, 2] };
export function lookFor(p) {
  if (p.look) return p.look;
  const r = new RNG(hash("look" + p.id));
  const lang = NATIONS[p.nat]?.lang;
  const [a, b] = REGION_SKIN[lang] || (r.chance(0.18) ? [3, 5] : [0, 2]);
  const skin = r.int(a, b);
  const dark = skin >= 3 || ["id", "jp", "kr", "cn", "vn", "th", "my", "ar", "fa", "ma", "la", "br"].includes(lang);
  const hc = dark ? r.pick([0, 0, 0, 1]) : r.pick([0, 1, 2, 2, 3, 4]);
  const hair = skin >= 4 ? r.pick([0, 1, 1, 4, 5]) : r.pick([1, 1, 2, 2, 3, 3, 4, 6, 7]);
  const beard = r.chance(0.55) ? 0 : r.int(1, 3);
  return { skin, hair, hc, beard };
}
export function avatar(look, shirt = ["#3a3f47", "#fff"], size = 64, age = 25) {
  const s = SKINS[look.skin] || SKINS[2], hc = HAIR_COLORS[look.hc] || HAIR_COLORS[0];
  const shade = "rgba(0,0,0,.18)";
  const hairs = [
    "",
    `<path d="M33 27c0-11 8-17 17-17s17 6 17 17c-2-4-6-7-17-7s-15 3-17 7Z" fill="${hc}"/>`,
    `<path d="M32 30c-1-13 7-21 18-21s19 8 18 21c-2-6-4-9-7-10-5 2-14 2-22 0-3 1-5 4-7 10Z" fill="${hc}"/>`,
    `<path d="M32 31c-2-14 7-22 18-22 12 0 19 8 18 20-3-7-8-10-14-10-6 0-12-1-15-4-2 3-5 9-7 16Z" fill="${hc}"/>`,
    `<g fill="${hc}"><circle cx="38" cy="18" r="6"/><circle cx="46" cy="13" r="6"/><circle cx="55" cy="13" r="6"/><circle cx="62" cy="18" r="6"/><circle cx="35" cy="25" r="5"/><circle cx="65" cy="25" r="5"/></g>`,
    `<path d="M26 34c-6-20 7-31 24-31s30 11 24 31c-2-9-6-14-24-14S28 25 26 34Z" fill="${hc}"/>`,
    `<path d="M30 52c-6-26 4-43 20-43s26 17 20 43c-1-14-3-24-6-28-5 3-23 3-28 0-3 4-5 14-6 28Z" fill="${hc}"/>`,
    `<path d="M45 30c0-14 2-21 5-22 3 1 5 8 5 22-2-2-3-3-5-3s-3 1-5 3Z" fill="${hc}"/><path d="M33 30c0-8 3-12 5-13M67 30c0-8-3-12-5-13" stroke="${hc}" stroke-width="2" opacity=".5"/>`,
  ];
  const beards = [
    "",
    `<path d="M36 47c3 9 8 13 14 13s11-4 14-13c-2 4-7 7-14 7s-12-3-14-7Z" fill="${hc}" opacity=".45"/>`,
    `<path d="M34 42c1 13 8 20 16 20s15-7 16-20c-2 5-4 7-6 7-3-2-6-3-10-3s-7 1-10 3c-2 0-4-2-6-7Z" fill="${hc}"/>`,
    `<path d="M44 53c1 6 3 9 6 9s5-3 6-9c-2 1-4 2-6 2s-4-1-6-2ZM43 49c2-2 5-2 7-1 2-1 5-1 7 1" fill="${hc}" stroke="${hc}" stroke-width="1.5"/>`,
  ];
  const young = age < 18 ? 1.5 : 0;
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M14 100c2-16 14-25 36-25s34 9 36 25Z" fill="${shirt[0]}"/>
    <path d="M40 76c2 6 6 9 10 9s8-3 10-9" fill="none" stroke="${shirt[1]}" stroke-width="3"/>
    <rect x="43" y="58" width="14" height="18" rx="5" fill="${s}"/>
    <rect x="43" y="64" width="14" height="6" fill="${shade}"/>
    <ellipse cx="32" cy="40" rx="4" ry="6" fill="${s}"/><ellipse cx="68" cy="40" rx="4" ry="6" fill="${s}"/>
    <ellipse cx="50" cy="${38 + young}" rx="18" ry="${23 - young}" fill="${s}"/>
    ${hairs[look.hair] || ""}
    <path d="M41 36q3-2 6 0M53 36q3-2 6 0" stroke="${hc}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <circle cx="44" cy="40.5" r="1.8" fill="#1a1a1a"/><circle cx="56" cy="40.5" r="1.8" fill="#1a1a1a"/>
    <path d="M50 42v6.5l-2 .8" stroke="${shade}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <path d="M45 53q5 3 10 0" stroke="#7a3b32" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${beards[look.beard] || ""}
  </svg>`;
}
export const silhouette = (size = 40) => `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true"><path d="M14 100c2-16 14-25 36-25s34 9 36 25Z" fill="#2b2f36"/><ellipse cx="50" cy="40" rx="18" ry="23" fill="#2b2f36"/></svg>`;

// ---------- small pieces ----------
export const pill = (r, cls = "") => (r == null || r === "-" ? `<span class="rpill none ${cls}">-</span>` : `<span class="rpill ${r >= 7.5 ? "hi" : r >= 7 ? "good" : r >= 6.5 ? "mid" : "lo"} ${cls}">${(+r).toFixed(r >= 10 ? 1 : 2).replace(".", ",")}</span>`);
export const pill1 = r => (r == null ? `<span class="rpill none">-</span>` : `<span class="rpill ${r >= 7.5 ? "hi" : r >= 7 ? "good" : r >= 6.5 ? "mid" : "lo"}">${(+r).toFixed(1).replace(".", ",")}</span>`);
export function stars(v, label = "") {
  let s = "";
  for (let i = 1; i <= 5; i++) s += v >= i ? '<i class="s full">★</i>' : v >= i - 0.5 ? '<i class="s half">★</i>' : '<i class="s">★</i>';
  return `<span class="stars" aria-label="${label}${v} dari 5 bintang">${s}</span>`;
}
export const attrClass = v => (v >= 15 ? "v-hi" : v >= 10 ? "v-mid" : "v-lo");
export const heading = (t, link = false) => `<h3 class="ch${link ? " link" : ""}">${esc(t)}</h3>`;
export function bars(n, of, cls = "") { let s = ""; for (let i = 1; i <= of; i++) s += `<i class="${i <= n ? "on" : ""}"></i>`; return `<span class="segbar ${cls}">${s}</span>`; }
export function toast(msg) {
  const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
export const shortDay = n => { const d = new Date(Date.UTC(2000, 0, 1) + n * 864e5); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`; };
