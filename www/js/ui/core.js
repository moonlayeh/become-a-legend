// Shared UI helpers and SVG components (crests, avatars, jerseys, badges).
import { NATIONS } from "../data.js";
import { hash } from "../meta.js";
import { RNG } from "../rng.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
// money tokens from the engine (⟦w:euro⟧ weekly/whole amounts, ⟦m:millions⟧) become the chosen currency
export const moneyText = s => String(s ?? "").replace(/⟦w:(-?[\d.]+)⟧/g, (_, v) => money(+v)).replace(/⟦m:(-?[\d.]+)⟧/g, (_, v) => moneyM(+v));
export const esc = s => moneyText(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Game money is stored in euro. Display rates: Kurs Menteri Keuangan (KMK) per 30 Oktober 2026
// (USD Rp17.946,00; EUR Rp20.088,08; GBP Rp23.780,53).
export const CURRENCIES = { IDR: { sym: "Rp", rate: 20088.08, label: "Rupiah Indonesia" }, EUR: { sym: "€", rate: 1, label: "Euro" }, USD: { sym: "$", rate: 20088.08 / 17946, label: "Dolar AS" }, GBP: { sym: "£", rate: 20088.08 / 23780.53, label: "Pound Sterling" } };
let CUR = CURRENCIES.IDR;
export function setCurrency(code) { CUR = CURRENCIES[code] || CURRENCIES.IDR; }
const fmt1 = (x, d) => x.toFixed(d).replace(".", ",").replace(/,0$/, "");
export const money = v => `${CUR.sym}${Math.round(v * CUR.rate).toLocaleString("id-ID")}`;
export function moneyShort(v) { // v in euro
  const x = v * CUR.rate;
  if (x >= 1e12) return `${CUR.sym}${fmt1(x / 1e12, 1)}T`;
  if (x >= 1e9) return `${CUR.sym}${fmt1(x / 1e9, x >= 1e10 ? 0 : 1)}M`;
  if (x >= 1e6) return `${CUR.sym}${fmt1(x / 1e6, x >= 1e7 ? 0 : 1)}Jt`;
  if (x >= 1e3) return `${CUR.sym}${Math.round(x / 1e3)}Rb`;
  return `${CUR.sym}${Math.round(x)}`;
}
// amounts given in millions of euro (transfer fees)
export const moneyM = m => moneyShort(m * 1e6);

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
const ISO = new Proxy({}, { get: (_, k) => NATIONS[k]?.iso2 });
export function flagEmoji(nat) {
  if (nat === "ENG") return "🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
  if (nat === "SCO") return "🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";
  if (nat === "WAL") return "🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}";
  if (nat === "NIR") return "🇬🇧";
  const iso = ISO[nat]; if (!iso || iso.length !== 2) return "🏳";
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
export const BEARDS = ["Tidak ada", "Tipis", "Brewok", "Kambing", "Kumis"];
export const GLASSES = ["Tidak", "Kacamata"];
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
  const gl = r.chance(0.07) ? 1 : 0;
  return { skin, hair, hc, beard, gl };
}
// Cartoon portrait in a cel-shaded "Saturday-morning" style: thick black outlines, one hard shadow
// side, big expressive eyes and solid hair shapes. Everything is drawn from the look (skin, hair
// style and colour, beard, glasses), so every player keeps the same face across screens.
const shadeHex = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * (1 - k)))); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
const tintHex = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.round(v + (255 - v) * k); return `rgb(${f(n >> 16 & 255)},${f(n >> 8 & 255)},${f(n & 255)})`; };
export function avatar(look, shirt = ["#3a3f47", "#fff"], size = 64, age = 25) {
  const s = SKINS[look.skin] || SKINS[2], hc = HAIR_COLORS[look.hc] || HAIR_COLORS[0];
  const sh = shadeHex(s, 0.2), sh2 = shadeHex(s, 0.32), lip = shadeHex(s, 0.12), hl = tintHex(hc, 0.32);
  const K = "#111", O = `stroke="${K}" stroke-width="2" stroke-linejoin="round"`;
  const young = age < 18;
  const jaw = young ? "M31 34C30 20 38 12.5 50 12.5S70 20 69 34L68.4 44C67.6 52 63 58 57.5 61.5L53 64.2Q50 65.4 47 64.2L42.5 61.5C37 58 32.4 52 31.6 44Z"
    : "M31 34C30 20 38 12 50 12S70 20 69 34L68.2 44C67.2 51.5 63.4 57 58 60.8L53.4 64.4Q50 66 46.6 64.4L42 60.8C36.6 57 32.8 51.5 31.8 44Z";
  const hairs = [
    `<path d="M36 22Q43 17 50 17" stroke="${tintHex(s, 0.35)}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    `<path d="M31.4 33C31 19 39 12.4 50 12.4S69 19 68.6 33C66 27 60 23.6 50 23.6S34 27 31.4 33Z" fill="${hc}" ${O}/><path d="M38 17Q44 14.5 50 14.6" stroke="${hl}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M30.4 36C28 18 38 9 52 8.4 63.4 8 71 16 69.6 36 68.4 29 66.2 26 63 24.4 58 27 48 27.2 40.4 24.2 35.6 26.2 32.2 30 30.4 36Z" fill="${hc}" ${O}/><path d="M39.6 24.6C43.6 15.6 54 11.2 64.4 14.4 60.6 17.6 56.4 21.6 52 25.4Z" fill="${hc}" ${O}/><path d="M45 18.6Q52 13.6 60 14.4" stroke="${hl}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    `<path d="M30.4 36C28 18 38 10 51 10 63 10 71 17 69.6 36 68.4 28 66 24.8 62 23 54 24.2 44 22.2 38 18 35 23 32.2 28 30.4 36Z" fill="${hc}" ${O}/><path d="M38.4 18C40.4 14.6 42.6 12.8 45 12" stroke="${hl}" stroke-width="1.6" fill="none"/><path d="M52 14Q60 13.6 65 18.4" stroke="${hl}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    `<path d="M31 34C27 30 28 24 32 22 31 17 36 13 40 14 42 10 48 9 51 11 55 9 61 11 62 15 67 15 71 20 69 25 72 28 71 33 69 35 67 29 62 25 50 25 39 25 33 29 31 34Z" fill="${hc}" ${O}/><path d="M40 18q3-2 5 0M50 15q3-2 5 0M58 19q3-2 5 0" stroke="${hl}" stroke-width="1.4" fill="none"/>`,
    `<path d="M26 38C20 22 30 4 50 4S80 22 74 38C72 30 66 25 50 25S28 30 26 38Z" fill="${hc}" ${O}/><path d="M36 12q5-4 10-3M58 10q6 1 9 5" stroke="${hl}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    `<path d="M30 60C24 36 28 10 50 9S76 36 70 60C68.6 47 67.6 35 64 26.4 57 28.4 43 28.4 36 26.4 32.4 35 31.4 47 30 60Z" fill="${hc}" ${O}/><path d="M40 16Q50 11.6 60 15" stroke="${hl}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
    `<path d="M33 30C34 24 37 21 40 20M67 30C66 24 63 21 60 20" stroke="${hc}" stroke-width="3" opacity=".55" fill="none"/><path d="M45 29.6C44 18 46 8 50 4.6 54 8 56 18 55 29.6 53 27.2 47 27.2 45 29.6Z" fill="${hc}" ${O}/><path d="M49 9Q50.4 8 51.4 10" stroke="${hl}" stroke-width="1.4" fill="none"/>`,
  ];
  const beardCol = hc === HAIR_COLORS[5] ? hc : shadeHex(hc, 0.15);
  const jawBeard = "M32.6 45C33.6 52.4 38.6 58.6 44.6 62.8L47 64.8Q50 66.4 53 64.8L55.4 62.8C61.4 58.6 66.4 52.4 67.4 45 64.4 51.6 58.4 55.4 50 55.8 41.6 55.4 35.6 51.6 32.6 45Z";
  const stache = `<path d="M44 52.2Q47 50.4 50 51.4 53 50.4 56 52.2L55.6 53.6Q53 52.8 50 53.4 47 52.8 44.4 53.6Z" fill="${beardCol}" stroke="${K}" stroke-width=".8"/>`;
  const beards = young ? ["", "", "", "", ""] : [
    "",
    `<path d="${jawBeard}" fill="${beardCol}" opacity=".28"/><path d="M44 52.2Q50 50.6 56 52.2" stroke="${beardCol}" stroke-width="1.6" opacity=".45" fill="none"/>`,
    `<path d="${jawBeard}" fill="${beardCol}" ${O}/>${stache}`,
    `${stache}<path d="M46.2 57.4H53.8L52.8 64.6Q50 66.4 47.2 64.6Z" fill="${beardCol}" stroke="${K}" stroke-width="1.2" stroke-linejoin="round"/>`,
    stache,
  ];
  const eye = (cx, flip) => { const d = flip ? -1 : 1, r = young ? 2.9 : 2.6; return `<path d="M${cx - 6 * d} 41.4Q${cx - 1 * d} 36.4 ${cx + 5.6 * d} 40.2Q${cx + 0.4 * d} 45.6 ${cx - 6 * d} 41.4Z" fill="#fff" stroke="${K}" stroke-width="1"/><circle cx="${cx + 0.2 * d}" cy="40.8" r="${r}" fill="${K}"/><circle cx="${cx + 1.1 * d}" cy="39.7" r=".9" fill="#fff"/><path d="M${cx - 6.8 * d} 41.8Q${cx - 1 * d} 35.6 ${cx + 6.2 * d} 40" stroke="${K}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`; };
  const brow = (cx, flip) => { const d = flip ? -1 : 1; return `<path d="M${cx - 7 * d} 35.4L${cx + 4.6 * d} 32L${cx + 5.4 * d} 34.8L${cx - 6.4 * d} 37.8Z" fill="${shadeHex(hc === HAIR_COLORS[5] ? "#555555" : hc, 0.25)}" stroke="${K}" stroke-width=".9" stroke-linejoin="round"/>`; };
  const glasses = look.gl ? `<g fill="rgba(220,235,245,.16)" stroke="#d9dde0" stroke-width="1.7"><rect x="34.4" y="36" width="14.6" height="10" rx="3"/><rect x="51" y="36" width="14.6" height="10" rx="3"/></g><path d="M49 40Q50 39 51 40M34.4 39.4L31.2 38.4M65.6 39.4L68.8 38.4" stroke="#d9dde0" stroke-width="1.5" fill="none"/>` : "";
  return `<svg class="avatar" width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M10 101C12 84 26 76 41 73Q50 80 59 73C74 76 88 84 90 101Z" fill="${shirt[0]}" ${O}/>
    <path d="M10 101C12 84 26 76 41 73L44 76C33 79 22 86 18 101Z" fill="rgba(0,0,0,.18)"/>
    <path d="M41 55V73.6Q50 81 59 73.6V55Z" fill="${s}" ${O}/>
    <path d="M41 57H59V66.6Q50 71.4 41 63.4Z" fill="${sh2}"/>
    <path d="M40.4 73.4Q50 81.4 59.6 73.4" stroke="${shirt[1]}" stroke-width="3" fill="none"/>
    <path d="M32.4 37C27.4 35 26.4 43.4 29.2 47.4 30.4 49.2 32.2 49.2 33.2 48Z" fill="${s}" ${O}/><path d="M67.6 37C72.6 35 73.6 43.4 70.8 47.4 69.6 49.2 67.8 49.2 66.8 48Z" fill="${sh}" ${O}/>
    <path d="${jaw}" fill="${s}" ${O}/>
    <path d="M59.4 28C66.6 32.6 68.4 39.4 67.6 45.8 66.6 52.2 62.4 57.4 57 61L54.8 62.4C58.6 54 59.8 44 58.2 35.6Z" fill="${sh}"/>
    <path d="M35.6 49.4Q37.6 53 41.6 54.4" stroke="${sh2}" stroke-width="1.3" fill="none"/>
    ${look.hair ? `<path d="M33 31C38 27.8 62 27.8 67 31L67 33.2C60 30.4 40 30.4 33 33.2Z" fill="${sh}"/>` : ""}
    ${hairs[look.hair] ?? ""}
    ${brow(41.8, false)}${brow(58.2, true)}
    ${eye(41.8, false)}${eye(58.2, true)}
    <path d="M50.6 42L53.4 49.2L50.6 50Z" fill="${sh}"/>
    <path d="M50 41.4L47.8 49.4Q49 51 50.6 50.4M47.6 50.2Q46.6 50 46.4 49" stroke="${K}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M45.4 54.4Q50 55.8 55.6 53.6" stroke="${K}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M46.8 55.6Q50.2 58 54 55.2" stroke="${lip}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    ${beards[look.beard] || ""}
    ${glasses}
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
  const t = document.createElement("div"); t.className = "toast"; t.textContent = moneyText(msg); document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
export const shortDay = n => { const d = new Date(Date.UTC(2000, 0, 1) + n * 864e5); return `${d.getUTCDate()}/${d.getUTCMonth() + 1}/${String(d.getUTCFullYear()).slice(2)}`; };
