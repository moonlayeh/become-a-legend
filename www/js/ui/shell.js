// App shell: top bar, drawer, router, processing overlay.
import { $, $$, esc, crest, applyTheme, toast, avatar, lookFor, compBadge, setCurrency } from "./core.js";
import { fmt, ymd, HARI, BULAN } from "../calendar.js";
import { userP, userClub } from "../world.js";
import { continueGame } from "../sim.js";
import { saveGame } from "../save.js";
import { mailMeta, clubMatchDays, userMatchDays, sessionsFor, SESS, SESS_COLOR } from "../meta.js";
import { fullName } from "../player.js";
import { NATIONS } from "../data.js";
import { fed } from "../career.js";

export const S = { G: null, sec: "portal", tab: "ringkasan", p: {}, screens: {}, drawer: false };
const ICON = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
  go: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 6 6 6-6 6M13 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 5-7 7 7 7"/></svg>',
  portal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z"/></svg>',
  pemain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  skuad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3 4 5 2 9l3 2 1-1v10h12V10l1 1 3-2-2-4-4-2c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z"/></svg>',
  latihan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h3M18 12h3M6 8v8M18 8v8M9 10v4M15 10v4M9 12h6"/></svg>',
  klub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>',
  kompetisi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10v4a5 5 0 0 1-10 0zM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M12 13v4M8 21h8"/></svg>',
  timnas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  cari: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  staf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  pengaturan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>',
  karier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};
export { ICON };

export const SECTIONS = {
  portal: { label: "Portal", tabs: [["ringkasan", "Ringkasan"], ["pesan", "Pesan"], ["kalender", "Kalender"], ["berita", "Berita"], ["kompetisi", "Kompetisi"], ["kontak", "Kontak"]] },
  pemain: { label: "Pemain", tabs: [["ringkasan", "Ringkasan"], ["pribadi", "Pribadi"], ["kontrak", "Kontrak"], ["transfer", "Transfer"], ["pengembangan", "Pengembangan"], ["performa", "Performa"], ["karier", "Karier"], ["bandingkan", "Perbandingan"]] },
  skuad: { label: "Skuad", tabs: [["utama", "Tim Utama"], ["muda", "Akademi U-19"]] },
  latihan: { label: "Latihan", tabs: [["sesi", "Sesi Latihan"], ["individu", "Latihan Individu"], ["kalender", "Kalender Latihan"], ["medis", "Pusat Medis"]] },
  klub: { label: "Klub", tabs: [["ringkasan", "Ringkasan"], ["staf", "Staf"], ["sejarah", "Sejarah"]] },
  kompetisi: { label: "Kompetisi", tabs: [["ringkasan", "Ringkasan"], ["jadwal", "Jadwal"], ["statistik", "Statistik"], ["sejarah", "Sejarah"]], compTabs: [["ringkasan", "Ringkasan"], ["jadwal", "Jadwal"], ["tahap", "Tahap"], ["sejarah", "Sejarah"]] },
  laga: { label: "Laga", tabs: [] },
  pengaturan: { label: "Pengaturan", tabs: [["umum", "Umum"]] },
  timnas: { label: "Tim Nasional", tabs: [["ringkasan", "Ringkasan"], ["jadwal", "Jadwal"]] },
  cari: { label: "Rekrutmen", tabs: [["pemain", "Database Pemain"]] },
  staf: { label: "Staf", tabs: [["profil", "Profil"]] },
  pers: { label: "Konferensi Pers", tabs: [["konferensi", "Konferensi Pers"]] },
};
const DRAWER = [["portal", "Portal"], ["pemain", "Profil Saya"], ["skuad", "Skuad"], ["latihan", "Latihan"], ["klub", "Klub"], ["kompetisi", "Kompetisi"], ["timnas", "Tim Nasional"], ["cari", "Database Pemain"], ["pengaturan", "Pengaturan"]];
export const DEFAULT_SETTINGS = { trainStop: true, currency: "IDR", textScale: 1, speed: 25, autoEffort: "Normal", moments: "normal", momentTimer: 8 };
export function applySettings(G) {
  G.settings = { ...DEFAULT_SETTINGS, ...(G.settings || {}) };
  setCurrency(G.settings.currency);
  document.body.style.zoom = G.settings.textScale;
}

export const save = () => S.G && saveGame(S.G);
export function register(sec, tab, fn) { S.screens[sec + "/" + tab] = fn; }

// Navigation keeps the reader's place: toggles inside the same screen (replace=true) keep the
// scroll position, a new screen starts at the top, and "back" returns to where you were.
export function go(sec, tab, p = {}, replace = false) {
  tab = tab || SECTIONS[sec]?.tabs[0]?.[0] || "";
  const same = sec === S.sec && tab === S.tab;
  const keep = replace && same;
  try { const cur = history.state; if (cur && !replace) history.replaceState({ ...cur, y: window.scrollY }, ""); } catch {}
  S.sec = sec; S.tab = tab; S.p = p;
  const st = { sec: S.sec, tab: S.tab, p };
  try { replace ? history.replaceState(st, "") : history.pushState(st, ""); } catch {}
  if (keep) render();
  else { render({ fresh: true }); window.scrollTo(0, 0); }
}
window.addEventListener("popstate", e => {
  if (!S.G) return;
  if ($(".live") || $(".sheet") || $(".proc")) return; // overlays handle their own close
  const st = e.state; if (!st) return;
  S.sec = st.sec; S.tab = st.tab; S.p = st.p || {}; render({ fresh: true });
  const y = st.y || 0;
  requestAnimationFrame(() => window.scrollTo(0, y));
});

// remember horizontal scrollers (sub-tabs, chip rows, wide tables) across re-renders
function scrollers() { return $$(".subtabs,.hscroll,.tscroll,.wscroll"); }
function snapScroll(fresh) {
  const y = window.scrollY;
  const xs = scrollers().map(el => el.scrollLeft);
  return () => {
    const els = scrollers();
    if (els.length === xs.length) els.forEach((el, i) => { if (!fresh || el.classList.contains("subtabs")) el.scrollLeft = xs[i]; });
    if (!fresh) window.scrollTo(0, y);
  };
}

function nextMatchText(G) {
  const u = userP(G);
  const md = userMatchDays(G);
  let best = null;
  for (const [d, m] of md) if (d >= G.date && !m.res && (!best || d < best[0])) best = [d, m];
  if (G.camp) for (const mt of G.camp.matches) if (!mt.done && mt.d >= G.date && (!best || mt.d < best[0])) best = [mt.d, { opp: null, nt: mt.opp, ha: "" }];
  if (!best) return "Tidak ada pertandingan mendatang";
  const dd = best[0] - G.date;
  const nm = best[1].nt ? G.camp && `Timnas vs ${best[1].nt}` : `${G.clubs[best[1].opp].short} (${best[1].ha}) · ${best[1].comp}`;
  return `${nm} ${dd === 0 ? "hari ini" : `dalam ${dd} hari`}`;
}
export function goLabel(G) {
  if (G.user.retired) return "Pensiun";
  if (G.pending) return "Ke Laga";
  const dec = G.inbox.filter(m => m.kind === "decision" && !m.done).length;
  if (dec) return `Pesan <span class="badge" style="background:#fff;color:#7b2fd6">${dec}</span>`;
  if (G.trainingDue) return "Latihan";
  return "Lanjutkan";
}

export function render(opt = {}) {
  const G = S.G; if (!G) return;
  applySettings(G);
  const restore = snapScroll(!!opt.fresh);
  const u = userP(G), club = userClub(G);
  applyTheme(club.colors);
  const sec = SECTIONS[S.sec] || SECTIONS.portal;
  const { y, m, d, wd } = ymd(G.date);
  let secLabel = sec.label;
  if (S.sec === "pemain") secLabel = S.p.pid && S.p.pid !== u.id ? shortN(G.players[S.p.pid]) : "Profil Saya";
  if (S.sec === "klub") secLabel = (G.clubs[S.p.club] || club).short;
  if (S.sec === "timnas") secLabel = NATIONS[S.p.nat || fed(G)]?.name || "Timnas";
  if (S.sec === "kompetisi") secLabel = S.p.comp ? (S.p.comp === "NL" ? "UNL" : G.comps[S.p.comp]?.short || "Kompetisi") : G.leagues[S.p.league || club.league]?.short || "Kompetisi";
  const tabs = S.sec === "kompetisi" && S.p.comp ? sec.compTabs : sec.tabs;
  // notification counts: unread mail, open decisions, unseen news about you
  const unread = G.inbox.filter(m => !m.read).length;
  const news = G.news.filter(n => n.id > (G.newsSeen || 0) && n.scope === "me").length;
  const B = n => (n ? `<span class="badge">${n > 99 ? "99+" : n}</span>` : "");
  const tabBadge = k => (S.sec === "portal" ? (k === "pesan" ? B(unread) : k === "berita" ? B(news) : "") : "");
  const navBadge = k => (k === "portal" ? B(unread + news) : "");
  const app = $("#app");
  app.innerHTML = `
  <header class="topbar">
    <div class="tb1">
      <button class="ibtn" id="menu" aria-label="Menu${unread ? `, ${unread} pesan belum dibaca` : ""}">${ICON.menu}${unread + news ? `<span class="dot">${unread + news > 9 ? "9+" : unread + news}</span>` : ""}</button>
      ${crest(club, 32)}
      <div class="datebox"><div class="d"><b>${HARI[wd].slice(0, 3).toUpperCase()} ${d}/${m}/${y}</b><span>${esc(nextMatchText(G))}</span></div></div>
      <button class="gobtn" id="go" ${G.user.retired ? "disabled" : ""}>${goLabel(G)} ${ICON.go}</button>
    </div>
    ${tabs.length ? `<div class="tb2"><div class="sec">${esc(secLabel)}</div><div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${S.tab === k}">${l}${tabBadge(k)}</button>`).join("")}</div></div>` : ""}
  </header>
  <main class="page" id="page"></main>
  <div class="scrim" id="scrim" ${S.drawer ? "" : "hidden"}></div>
  <aside class="drawer ${S.drawer ? "open" : ""}" id="drawer" aria-label="Menu utama">
    <div class="dh">${avatar(lookFor(u), club.colors, 48, 18)}<div><b>${esc(fullName(u))}</b><span>${esc(club.name)}</span></div></div>
    <nav>${DRAWER.map(([k, l]) => `<button data-nav="${k}" ${S.sec === k ? 'aria-current="page"' : ""}>${ICON[k]}${l}${navBadge(k)}</button>`).join("")}</nav>
    <div class="dfoot"><button class="btn sm" data-act="menu-utama">Menu utama</button>${!G.user.retired ? '<button class="btn sm" data-act="retire">Pensiun…</button>' : ""}</div>
  </aside>`;
  const page = $("#page");
  const fn = S.screens[S.sec + "/" + S.tab] || S.screens["portal/ringkasan"];
  try { fn(G, page, S.p); } catch (e) { console.error(e); page.innerHTML = `<div class="card">Terjadi kesalahan saat menampilkan layar ini.<pre style="white-space:pre-wrap;font-size:12px">${esc(e.stack || e)}</pre></div>`; }
  $("#menu").onclick = () => { S.drawer = true; $("#drawer").classList.add("open"); $("#scrim").hidden = false; };
  $("#scrim").onclick = closeDrawer;
  $("#go").onclick = onGo;
  $$(".subtabs [data-tab]").forEach(b => (b.onclick = () => go(S.sec, b.dataset.tab, S.p)));
  $$("#drawer [data-nav]").forEach(b => (b.onclick = () => { S.drawer = false; go(b.dataset.nav, null, {}); }));
  restore();
  // keep the selected sub-tab in view
  const on = $('.subtabs [aria-selected="true"]');
  if (on && opt.fresh) { const bar = on.parentElement; if (on.offsetLeft < bar.scrollLeft || on.offsetLeft + on.offsetWidth > bar.scrollLeft + bar.clientWidth) bar.scrollLeft = on.offsetLeft - 16; }
}
function closeDrawer() { S.drawer = false; $("#drawer")?.classList.remove("open"); const s = $("#scrim"); if (s) s.hidden = true; }
const shortN = p => (p ? `${p.fn[0]}. ${p.ln}` : "Pemain");

// global click delegation for links inside pages
document.addEventListener("click", e => {
  if (!S.G) return;
  const t = e.target.closest("[data-pid],[data-club],[data-league],[data-go],[data-act]");
  if (!t || t.closest(".drawer nav") || t.closest(".wiz") || t.closest(".menu")) return;
  if (t.dataset.act) { S.onAct?.(t.dataset.act, t); return; }
  if (t.dataset.pid) { const id = +t.dataset.pid; if (S.G.players[id]) go("pemain", "ringkasan", { pid: id }); }
  else if (t.dataset.club) { if (S.G.clubs[t.dataset.club]) go("klub", "ringkasan", { club: t.dataset.club }); }
  else if (t.dataset.league) go("kompetisi", t.dataset.ltab || "ringkasan", { league: t.dataset.league });
  else if (t.dataset.go) { const [s, tab] = t.dataset.go.split("/"); go(s, tab, JSON.parse(t.dataset.p || "{}")); }
});

// ---------- continue / processing ----------
export function onGo() {
  const G = S.G;
  if (G.pending) { go("laga", "pra"); return; }
  if (G.trainingDue) { go("latihan", "sesi"); return; }
  const dec = G.inbox.find(m => m.kind === "decision" && !m.done);
  if (dec) { go("portal", "pesan", { mail: dec.id }); return; }
  processing();
}
let procTimer = null;
function processing() {
  const G = S.G;
  const el = document.createElement("div");
  el.className = "proc";
  el.innerHTML = `<div class="box" role="dialog" aria-label="Memproses"><div class="ph"><span>Memproses</span><button class="ibtn" id="pstop" aria-label="Berhenti">✕</button></div><div id="pbody"></div></div>`;
  document.body.appendChild(el);
  const btn = $("#go"); if (btn) { btn.disabled = true; btn.innerHTML = 'Memproses <span class="spin"></span>'; }
  let stopReq = false;
  $("#pstop", el).onclick = () => { stopReq = true; };
  const startMail = G.mailId || 0;
  const step = () => {
    const r = continueGame(G, 1);
    paintProc(G, el, startMail);
    if (r !== "day" || stopReq) {
      clearTimeout(procTimer);
      save();
      setTimeout(() => {
        el.remove();
        if (r === "match") go("laga", "pra");
        else if (r === "training") go("latihan", "sesi");
        else if (r === "decision") go("portal", "pesan", { mail: G.inbox.find(m => m.kind === "decision" && !m.done)?.id });
        else if (r === "mail") go("portal", "pesan", { mail: G.inbox[0]?.id });
        else if (r === "retired") go("pemain", "karier", {});
        else render();
      }, r === "day" ? 0 : 450);
      return;
    }
    procTimer = setTimeout(step, 140);
  };
  paintProc(G, el, startMail);
  procTimer = setTimeout(step, 160);
}
function paintProc(G, el, startMail) {
  const { d, m, wd } = ymd(G.date);
  const u = userP(G);
  const md = userMatchDays(G);
  let next = null; for (const [dd, x] of md) if (dd >= G.date && !x.res && (!next || dd < next[0])) next = [dd, x];
  const mails = G.inbox.slice(0, 5);
  const news = G.news[0];
  // two-week strip
  const start = G.date - ((wd + 6) % 7);
  let cal = "";
  for (let i = 0; i < 14; i++) {
    const n = start + i, s = sessionsFor(G, u.club, n, md);
    const dd = ymd(n);
    cal += `<div style="background:${n === G.date ? "linear-gradient(120deg,var(--go-a),var(--go-b))" : "rgba(255,255,255,.04)"};border-radius:3px;padding:3px;min-height:44px;font-size:11px"><b>${dd.d}</b><div class="icons3" style="margin-top:3px">${s.match ? `<span style="font-size:10px;background:#6e1f3c;padding:0 3px;border-radius:2px">${esc(G.clubs[s.match.opp].short)}</span>` : s.off ? "" : s.s.map(k => `<i style="background:${SESS_COLOR[SESS[k][1]]};width:9px;height:9px"></i>`).join("")}</div></div>`;
  }
  el.querySelector("#pbody").innerHTML = `
    <div class="dc"><div class="dd">${HARI[wd].slice(0, 3).toUpperCase()} ${d} ${BULAN[m - 1].toUpperCase()}</div>
      ${next ? `<div style="margin-top:6px;font-weight:700">Laga berikutnya</div><div style="font-size:14px">${esc(next[1].compName)} · ${esc(G.clubs[next[1].opp].name)} (${next[1].ha === "K" ? "Kandang" : "Tandang"}) · ${next[0] - G.date === 0 ? "hari ini" : `dalam ${next[0] - G.date} hari`}</div>` : '<div style="margin-top:6px">Tidak ada laga terjadwal</div>'}
      <span class="spin" style="position:absolute;right:12px;top:12px"></span></div>
    <div style="padding:10px 12px 4px" class="ch">Pesan Masuk</div>
    ${mails.map(x => { const mm = mailMeta(G, x); return `<div class="msg ${x.id > startMail ? "unread" : "read"}"><div class="from"><span>${esc(mm.from)}</span><span>${fmt(x.date)}</span></div><div class="ti">${esc(x.title)}</div></div>`; }).join("")}
    ${news ? `<div style="padding:10px 12px"><div class="ch" style="font-size:14px">Berita</div><b>${esc(news.title)}</b><div class="muted" style="font-size:13px">${fmt(news.date)}</div></div>` : ""}
    <div style="padding:0 12px 12px"><div class="ch" style="font-size:14px">Kalender</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cal}</div></div>`;
}
export { closeDrawer };
