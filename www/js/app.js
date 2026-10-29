// Temporary interface. Screens are plain render functions so each one can be rebuilt
// from the reference screenshots without touching the game engine.
import { NATIONS, LEAGUES, POSITIONS, POS_LABEL, CLUBS } from "./data.js";
import { ATTRS, A, GROUPS, band } from "./attributes.js";
import { fullName, shortName, personality, marketValue } from "./player.js";
import { fmt, fmtDay, ageOn, seasonLabel, ymd } from "./calendar.js";
import { createWorld, userP, userClub, table, FOCUS_LIST, clubNatOK, fifaU18Allowed, weeksLabel } from "./world.js";
import { continueGame, playPending, pendingTeams, teamColors, rngOf, retireUser } from "./sim.js";
import { resolveDecision, squadStatus, coachReport, talk, TALKS, fmtM, posGroup } from "./career.js";
import { openViewer } from "./viewer.js";
import { saveGame, loadGame, deleteSave } from "./save.js";

let G = null;
let view = "inbox";
const ui = { mail: null, inboxTab: "pesan", clubTab: "utama", compLeague: null, compTab: "klasemen", round: null, careerTab: "ringkasan", post: null };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const app = () => $("#app");
const save = () => G && saveGame(G);
function toast(msg) { const t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
function loading(on, text = "Memproses...") {
  let el = $("#loading");
  if (on && !el) { el = document.createElement("div"); el.id = "loading"; el.className = "loading"; el.innerHTML = `<div><div class="ball"></div>${esc(text)}</div>`; document.body.appendChild(el); }
  if (!on && el) el.remove();
}
const crest = (club, size = 34) => `<span class="crest" style="width:${size}px;height:${size}px;background:${club.colors[0]};color:${club.colors[1]};border-color:${club.colors[1]}">${esc(club.short.slice(0, 4))}</span>`;
const nat = code => NATIONS[code]?.name || code;
const stars = v => { let s = ""; for (let i = 1; i <= 5; i++) s += v >= i ? "★" : v >= i - 0.5 ? "⯪" : `<span class="off">★</span>`; return `<span class="stars" aria-label="${v} bintang">${s}</span>`; };
const avgR = st => (st.rn ? (st.rsum / st.rn).toFixed(2) : "-");
const money = v => `€${Math.round(v).toLocaleString("id-ID")}`;

// ---------------- boot ----------------
async function boot() {
  const g = await loadGame();
  renderStart(!!g, g);
}
window.addEventListener("DOMContentLoaded", boot);

// ---------------- start ----------------
function renderStart(hasSave, g) {
  const userNats = Object.entries(NATIONS).filter(([, n]) => !n.opp).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const clubsByLeague = LEAGUES.map(L => `<optgroup label="${esc(L.name)}">${G0clubs(L.id)}</optgroup>`).join("");
  app().innerHTML = `
  <main style="padding-bottom:30px">
    <div class="brand"><h1>Become a <span>Legend</span></h1><p class="muted">Karier sepak bola offline, dari akademi sampai pensiun.</p></div>
    ${hasSave ? `<div class="card"><div class="spread"><div><div class="label">Karier tersimpan</div><b>${esc(fullName(g.players[g.user.pid]))}</b> <span class="muted">· ${esc(g.clubs[g.players[g.user.pid].club]?.name || "")} · ${fmt(g.date)}</span></div><button class="btn primary" id="load">Lanjutkan</button></div></div>` : ""}
    <form class="card" id="newform">
      <h2>Karier baru</h2>
      <div class="form">
        <label class="field"><span class="label">Nama depan</span><input id="f-fn" required maxlength="20" placeholder="mis. Bima"></label>
        <label class="field"><span class="label">Nama belakang</span><input id="f-ln" required maxlength="24" placeholder="mis. Saputra"></label>
        <label class="field"><span class="label">Kewarganegaraan</span><select id="f-nat">${userNats.map(([k, n]) => `<option value="${k}" ${k === "IDN" ? "selected" : ""}>${esc(n.name)}</option>`).join("")}</select></label>
        <label class="field"><span class="label">Tempat lahir</span><input id="f-birth" placeholder="mis. Makassar" maxlength="30"></label>
        <label class="field"><span class="label">Posisi utama</span><select id="f-pos">${POSITIONS.map(p => `<option value="${p}" ${p === "ST" ? "selected" : ""}>${p} · ${POS_LABEL[p]}</option>`).join("")}</select></label>
        <label class="field"><span class="label">Usia awal</span><select id="f-age"><option>15</option><option selected>16</option><option>17</option></select></label>
        <label class="field"><span class="label">Kaki dominan</span><select id="f-foot"><option>Kanan</option><option>Kiri</option><option>Dua kaki</option><option>Acak</option></select></label>
        <label class="field"><span class="label">Tinggi (cm, opsional)</span><input id="f-h" type="number" min="150" max="205" placeholder="acak"></label>
        <label class="field full"><span class="label">Akademi awal</span><select id="f-club"><option value="acak">Acak (berdasarkan tempat lahir)</option>${clubsByLeague}</select></label>
        <div class="field full"><span class="label">Kesulitan</span><div class="seg">
          <label><input type="radio" name="diff" value="Normal" checked> Normal</label>
          <label><input type="radio" name="diff" value="Keras"> Keras: potensi acak dan bisa rendah, cedera lebih sering</label>
        </div></div>
      </div>
      <p class="muted" id="fifa-note" style="font-size:14px"></p>
      <button class="btn primary go" style="width:100%;margin-top:6px">Mulai karier</button>
    </form>
  </main>`;
  $("#load")?.addEventListener("click", () => { G = g; view = "inbox"; renderMain(); });
  const check = () => {
    const c = $("#f-club").value, n = $("#f-nat").value, a = +$("#f-age").value;
    let note = "";
    if (c !== "acak") { const cn = LEAGUES.find(l => l.id === CLUBS_IDX[c].league).nation; const r = fifaU18Allowed(n, a, cn); if (!r.ok) note = r.note + " Kariermu akan dimulai di usia 18."; else if (r.note) note = r.note; if (c === "ath" && n !== "ESP") note = "Athletic Club hanya merekrut pemain Basque/Spanyol."; }
    else if (!LEAGUES.some(l => l.nation === n)) note = NATIONS[n].eu ? "Negaramu tidak punya liga di game ini; sebagai warga UE kamu bisa pindah ke akademi Eropa mulai usia 16." : "Negaramu tidak punya liga di game ini dan aturan FIFA melarang transfer internasional di bawah 18 tahun, jadi kariermu dimulai di usia 18.";
    $("#fifa-note").textContent = note;
  };
  ["f-club", "f-nat", "f-age"].forEach(id => $("#" + id).addEventListener("change", check));
  $("#newform").addEventListener("submit", e => {
    e.preventDefault();
    if ($("#f-club").value === "ath" && $("#f-nat").value !== "ESP") { toast("Athletic Club hanya untuk pemain Spanyol/Basque."); return; }
    if (hasSave && !confirm("Karier lama akan ditimpa. Lanjutkan?")) return;
    loading(true, "Membangun dunia sepak bola...");
    setTimeout(async () => {
      G = createWorld({
        fn: $("#f-fn").value.trim(), ln: $("#f-ln").value.trim(), nat: $("#f-nat").value, birthplace: $("#f-birth").value.trim(),
        pos: $("#f-pos").value, age: +$("#f-age").value, foot: $("#f-foot").value, height: $("#f-h").value || null,
        difficulty: document.querySelector('input[name="diff"]:checked').value, club: $("#f-club").value,
      });
      await saveGame(G);
      loading(false); view = "inbox"; ui.mail = G.inbox[0]?.id; renderMain();
    }, 30);
  });
}
const CLUBS_IDX = Object.fromEntries(CLUBS.map(c => [c.id, c]));
function G0clubs(lid) { return CLUBS.filter(c => c.league === lid).sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join(""); }

// ---------------- shell ----------------
const ICONS = {
  inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v12H15l-3 3-3-3H4z"/></svg>',
  profil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>',
  klub: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>',
  kompetisi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4h10v4a5 5 0 01-10 0zM5 5H3v2a3 3 0 003 3M19 5h2v2a3 3 0 01-3 3M12 13v4M8 21h8"/></svg>',
  karier: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
};
const NAV = [["inbox", "Kotak Masuk"], ["profil", "Profil"], ["klub", "Klub"], ["kompetisi", "Kompetisi"], ["karier", "Karier"]];

function renderMain() {
  const p = userP(G), club = userClub(G);
  const unread = G.inbox.some(m => !m.read);
  const blocking = G.inbox.find(m => m.kind === "decision" && !m.done);
  const goLabel = G.user.retired ? "Pensiun" : G.pending ? "Ke laga" : blocking ? "Putuskan" : "Lanjutkan";
  app().innerHTML = `
    <header class="top">
      ${crest(club)}
      <div class="who"><b>${esc(fullName(p))}</b><span>${fmtDay(G.date)} · ${esc(club.name)}${G.user.loan ? " (pinjaman)" : ""}</span></div>
      <button class="btn primary go" id="go" ${G.user.retired ? "disabled" : ""}>${goLabel}</button>
    </header>
    <main id="view"></main>
    <nav class="nav">${NAV.map(([k, l]) => `<button data-v="${k}" ${view === k ? 'aria-current="page"' : ""}>${ICONS[k]}${l}${k === "inbox" && unread ? '<span class="dot"></span>' : ""}</button>`).join("")}</nav>`;
  $("#go").addEventListener("click", onContinue);
  document.querySelectorAll(".nav button").forEach(b => b.addEventListener("click", () => { view = b.dataset.v; renderMain(); window.scrollTo(0, 0); }));
  const V = { inbox: viewInbox, profil: viewProfile, klub: viewClub, kompetisi: viewComp, karier: viewCareer, match: viewPrematch, post: viewPost };
  (V[view] || viewInbox)($("#view"));
}

function onContinue() {
  if (G.pending) { view = "match"; renderMain(); return; }
  const blocking = G.inbox.find(m => m.kind === "decision" && !m.done);
  if (blocking) { view = "inbox"; ui.mail = blocking.id; renderMain(); return; }
  loading(true, "Melanjutkan...");
  setTimeout(() => {
    const s = continueGame(G);
    save();
    loading(false);
    if (s === "match") view = "match";
    else if (s === "decision") { view = "inbox"; ui.mail = G.inbox.find(m => m.kind === "decision" && !m.done)?.id; }
    else if (s === "retired") view = "karier";
    else { view = "inbox"; ui.mail = G.inbox[0]?.id; ui.inboxTab = "pesan"; }
    renderMain();
  }, 20);
}

// ---------------- inbox ----------------
function viewInbox(root) {
  const tabs = `<div class="tabs" role="tablist"><button data-t="pesan" aria-selected="${ui.inboxTab === "pesan"}">Pesan</button><button data-t="kabar" aria-selected="${ui.inboxTab === "kabar"}">Kabar</button>${G.lastMatch ? `<button data-t="laga" aria-selected="false">Laga terakhir</button>` : ""}</div>`;
  if (ui.inboxTab === "kabar") {
    root.innerHTML = tabs + `<div class="card">${G.news.map(n => `<div class="mail"><div class="ic"></div><div><span class="d">${fmt(n.date)}</span><div>${esc(n.text)}</div></div></div>`).join("") || '<p class="muted">Belum ada kabar.</p>'}</div>`;
  } else {
    const m = G.inbox.find(x => x.id === ui.mail) || G.inbox[0];
    if (m) m.read = true;
    const list = `<div class="card" style="padding:0">${G.inbox.slice(0, 40).map(x => `<div class="mail ${x.kind} ${x.read ? "" : "unread"}" data-m="${x.id}" ${m && x.id === m.id ? 'style="background:var(--panel-2)"' : ""}><div class="ic"></div><div><b>${esc(x.title)}${x.kind === "decision" && !x.done ? ' <span class="chip gold">Perlu keputusan</span>' : ""}</b><span class="d">${fmt(x.date)}</span></div></div>`).join("")}</div>`;
    const detail = m ? `<div class="card"><div class="label">${fmtDay(m.date)}</div><h2 style="margin:4px 0 10px">${esc(m.title)}</h2><div class="body">${esc(m.body)}</div>
      ${m.changes ? `<div class="row" style="margin-top:10px">${m.changes.map(c => `<span class="chip ${c.to > c.from ? "good" : "bad"}">${esc(c.name)} ${c.from}→${c.to}</span>`).join("")}</div>` : ""}
      ${m.kind === "decision" ? (m.done ? `<div class="notice" style="margin-top:12px">${esc(m.options[m.choice]?.label)}: ${esc(m.result || "")}</div>` : m.options.map((o, i) => `<button class="opt" data-o="${i}"><b>${esc(o.label)}</b><span>${esc(o.detail || "")}</span></button>`).join("")) : ""}
    </div>` : '<div class="card muted">Kotak masuk kosong.</div>';
    root.innerHTML = tabs + `<div class="grid2">${detail}${list}</div>`;
    root.querySelectorAll("[data-m]").forEach(el => el.addEventListener("click", () => { ui.mail = +el.dataset.m; renderMain(); }));
    root.querySelectorAll("[data-o]").forEach(el => el.addEventListener("click", () => {
      const rng = rngOf(G);
      const msg = resolveDecision(G, m.id, +el.dataset.o, rng);
      G.rs = rng.s; save(); toast(msg || "Keputusan dicatat."); renderMain();
    }));
  }
  root.querySelectorAll("[data-t]").forEach(b => b.addEventListener("click", () => { if (b.dataset.t === "laga") { ui.post = G.lastMatch; view = "post"; } else ui.inboxTab = b.dataset.t; renderMain(); }));
}

// ---------------- profile ----------------
function attrBlock(p, groups) {
  return `<div class="attrs">${groups.map(g => `<div><h3 style="font-size:17px;color:var(--muted);margin-bottom:4px">${GROUPS[g]}</h3>${ATTRS.map((a, i) => [a, i]).filter(([a]) => a[2] === g).map(([a, i]) => { const v = Math.round(p.a[i]); return `<div class="attr"><span>${esc(a[1])}</span><span class="v b${band(v)}">${v}</span></div>`; }).join("")}</div>`).join("")}</div>`;
}
function positionsPitch(p) {
  const XY = { GK: [50, 94], DC: [50, 80], DR: [86, 78], DL: [14, 78], WBR: [88, 62], WBL: [12, 62], DM: [50, 66], MC: [50, 52], MR: [86, 48], ML: [14, 48], AMR: [84, 30], AML: [16, 30], AMC: [50, 34], ST: [50, 14] };
  return `<div class="pitchmini">${Object.entries(XY).map(([k, [x, y]]) => { const f = p.positions[k] || 0; if (!f) return ""; const col = f >= 18 ? "#5fcb8d" : f >= 13 ? "#b7e07a" : f >= 9 ? "#e7b648" : "#f0786c"; return `<i style="left:${x}%;top:${y}%;background:${col}" title="${k}">${k}</i>`; }).join("")}</div>`;
}
function playerSheet(p, own) {
  const age = ageOn(p.birth, G.date);
  const club = p.club ? G.clubs[p.club] : null;
  const groups = p.main === "GK" ? ["K", "M", "F"] : ["T", "M", "F"];
  const rep = club ? coachReport(G, p) : null;
  const form = p.form.slice(-5);
  return `
  <div class="card">
    <div class="hero">${club ? crest(club, 52) : ""}<div style="min-width:0"><div class="big">${esc(fullName(p))}</div>
      <div class="muted">${age} tahun · ${esc(nat(p.nat))} · ${esc(POS_LABEL[p.main])}${own ? ` · <b style="color:var(--ink)">${esc(squadStatus(G, p))}</b>` : ""}</div></div></div>
    <div class="row" style="margin-top:10px">${p.injury ? `<span class="chip bad">Cedera: ${esc(p.injury.name)} (${weeksLabel(p.injury.days)})</span>` : ""}${p.ban > 0 ? `<span class="chip bad">Skorsing ${p.ban} laga</span>` : ""}${p.away ? '<span class="chip gold">Tugas timnas</span>' : ""}${(G.user.flags || []).includes("EDITOR") && own ? '<span class="chip bad">[EDITOR]</span>' : ""}</div>
  </div>
  <div class="grid2">
    <div class="card"><h2>Atribut</h2>${attrBlock(p, groups)}</div>
    <div>
      <div class="card"><h2>Data</h2><dl class="facts">
        <dt>Klub</dt><dd>${esc(club?.name || "-")}${own && G.user.loan ? ` (pinjaman dari ${esc(G.clubs[G.user.loan.parent].short)})` : ""}</dd>
        <dt>Lahir</dt><dd>${fmt(p.birth)}${p.birthplace ? ", " + esc(p.birthplace) : ""}</dd>
        <dt>Tinggi / berat</dt><dd>${p.height} cm / ${p.weight} kg</dd>
        <dt>Kaki</dt><dd>${esc(p.foot)}</dd>
        <dt>Kepribadian</dt><dd>${esc(personality(p))}</dd>
        <dt>Nilai pasar</dt><dd>€${fmtM(marketValue(p, G.date, club?.league))}</dd>
        <dt>Kontrak</dt><dd>${p.contract ? (p.contract.youth ? "Kontrak akademi" : `${money(p.contract.wage)}/pekan`) + ` · s.d. ${seasonLabel(p.contract.end)}` : "-"}</dd>
        <dt>Kondisi</dt><dd>${Math.round(p.cond)}%${own ? ` · moral ${moraleLabel(p.morale)}` : ""}</dd>
        <dt>Performa</dt><dd>${form.length ? form.map(r => `<span class="chip ${r >= 7.2 ? "good" : r < 6.5 ? "bad" : ""}">${r.toFixed(1)}</span>`).join(" ") : "-"}</dd>
      </dl></div>
      ${rep ? `<div class="card"><h2>Laporan pelatih</h2><div class="spread"><span>Kemampuan</span>${stars(rep.ca)}</div><div class="spread"><span>Potensi</span>${stars(rep.pa)}</div><p class="muted" style="margin:8px 0 0">${esc(rep.text)}</p></div>` : ""}
      <div class="card"><h2>Posisi</h2><div class="row" style="align-items:flex-start">${positionsPitch(p)}<div class="muted" style="font-size:14px;max-width:180px">Hijau = alami, kuning = cukup, merah = canggung.</div></div></div>
    </div>
  </div>`;
}
const moraleLabel = m => (m >= 80 ? "sangat baik" : m >= 62 ? "baik" : m >= 45 ? "biasa" : m >= 30 ? "buruk" : "sangat buruk");

function viewProfile(root) {
  const p = userP(G);
  const cs = G.user.cs;
  const row = (k, s) => `<tr><td>${k}</td><td class="n">${s.apps}${s.sub ? ` (${s.sub})` : ""}</td><td class="n">${s.gls}</td><td class="n">${s.ast}</td><td class="n">${avgR(s)}</td><td class="n">${s.min}</td></tr>`;
  const talks = TALKS.filter(([k]) => (k === "promote" ? p.squad === "Y" : true));
  root.innerHTML = playerSheet(p, true) + `
  <div class="grid2">
    <div class="card"><h2>Musim ini</h2><div class="scroll"><table class="tbl"><thead><tr><th>Kompetisi</th><th class="n">Main</th><th class="n">Gol</th><th class="n">Ast</th><th class="n">Rating</th><th class="n">Menit</th></tr></thead><tbody>
      ${row(esc(G.leagues[userClub(G).league]?.name || "Liga"), cs.liga)}${cs.u19.apps + cs.u19.sub ? row("U-19", cs.u19) : ""}${cs.timnas.apps + cs.timnas.sub ? row("Timnas", cs.timnas) : ""}
    </tbody></table></div></div>
    <div class="card"><h2>Latihan</h2>
      <label class="field"><span class="label">Fokus latihan individu</span><select id="t-focus">${FOCUS_LIST.map(f => `<option ${G.user.training.focus === f ? "selected" : ""}>${f}</option>`).join("")}</select></label>
      <div class="field" style="margin-top:10px"><span class="label">Intensitas</span><div class="seg">${["Rendah", "Normal", "Tinggi"].map(x => `<label><input type="radio" name="int" value="${x}" ${G.user.training.intensity === x ? "checked" : ""}> ${x}</label>`).join("")}</div></div>
      <p class="muted" style="font-size:14px;margin:8px 0 0">Intensitas tinggi mempercepat perkembangan tapi menguras kondisi dan menaikkan risiko cedera.</p>
    </div>
  </div>
  <div class="card"><h2>Bicara dengan pelatih</h2><div class="row">${talks.map(([k, l]) => `<button class="btn small" data-talk="${k}">${l}</button>`).join("")}</div><p class="muted" id="talk-out" style="margin:10px 0 0"></p></div>`;
  $("#t-focus").addEventListener("change", e => { G.user.training.focus = e.target.value; save(); toast("Fokus latihan diubah."); });
  root.querySelectorAll('input[name="int"]').forEach(r => r.addEventListener("change", e => { G.user.training.intensity = e.target.value; save(); }));
  root.querySelectorAll("[data-talk]").forEach(b => b.addEventListener("click", () => {
    const rng = rngOf(G); const out = talk(G, b.dataset.talk, rng); G.rs = rng.s; save();
    $("#talk-out").textContent = out;
    if (G.inbox.some(m => m.kind === "decision" && !m.done)) toast("Ada tawaran baru di kotak masuk.");
  }));
}

// ---------------- club ----------------
function viewClub(root) {
  const club = userClub(G), p = userP(G);
  const L = G.leagues[club.league];
  const pos = table(G, club.league).findIndex(r => r.id === club.id) + 1;
  const ids = ui.clubTab === "utama" ? club.squad : club.youthSquad;
  const order = { GK: 0, DR: 1, DC: 2, DL: 3, WBR: 4, WBL: 5, DM: 6, MR: 7, MC: 8, ML: 9, AMR: 10, AMC: 11, AML: 12, ST: 13 };
  const players = ids.map(id => G.players[id]).filter(Boolean).sort((a, b) => order[a.main] - order[b.main] || b.ca - a.ca);
  root.innerHTML = `
  <div class="card"><div class="hero">${crest(club, 56)}<div><div class="big">${esc(club.name)}</div><div class="muted">${esc(L.name)} · peringkat ${pos} · formasi ${club.formation}</div></div></div></div>
  <div class="tabs"><button data-ct="utama" aria-selected="${ui.clubTab === "utama"}">Tim utama</button><button data-ct="muda" aria-selected="${ui.clubTab === "muda"}">Akademi U-19</button></div>
  <div class="card scroll" style="padding:6px"><table class="tbl"><thead><tr><th>Pos</th><th>Nama</th><th class="n">Usia</th><th>Negara</th><th class="n">Main</th><th class="n">Gol</th><th class="n">Rat</th><th class="n">Knd</th></tr></thead><tbody>
    ${players.map(q => `<tr class="click ${q.isUser ? "me" : ""}" data-p="${q.id}"><td>${q.main}</td><td>${esc(shortName(q))}${q.injury ? ' <span class="chip bad">C</span>' : ""}${q.ban > 0 ? ' <span class="chip bad">S</span>' : ""}</td><td class="n">${ageOn(q.birth, G.date)}</td><td>${esc(q.nat)}</td><td class="n">${q.st.apps + q.st.sub}</td><td class="n">${q.st.gls}</td><td class="n">${avgR(q.st)}</td><td class="n">${Math.round(q.cond)}%</td></tr>`).join("")}
  </tbody></table></div>`;
  root.querySelectorAll("[data-ct]").forEach(b => b.addEventListener("click", () => { ui.clubTab = b.dataset.ct; renderMain(); }));
  root.querySelectorAll("[data-p]").forEach(r => r.addEventListener("click", () => showPlayer(+r.dataset.p)));
}
function showPlayer(id) {
  const p = G.players[id]; if (!p) return;
  if (p.isUser) { view = "profil"; renderMain(); return; }
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;inset:0;z-index:40;background:var(--bg);overflow:auto;padding:calc(var(--top) + 10px) 12px 30px";
  el.innerHTML = `<div style="max-width:1100px;margin:0 auto"><button class="btn small" style="margin-bottom:10px">← Kembali</button>${playerSheet(p, false)}</div>`;
  el.querySelector("button").addEventListener("click", () => el.remove());
  document.body.appendChild(el);
}

// ---------------- competitions ----------------
function viewComp(root) {
  const club = userClub(G);
  const lid = ui.compLeague || club.league;
  const L = G.leagues[lid];
  const tb = table(G, lid);
  const tabs = `<div class="tabs">${Object.values(G.leagues).map(x => `<button data-l="${x.id}" aria-selected="${x.id === lid}">${esc(x.name)}</button>`).join("")}</div>
    <div class="tabs">${[["klasemen", "Klasemen"], ["jadwal", "Jadwal & hasil"], ["statistik", "Statistik"], ["sejarah", "Juara"]].map(([k, l]) => `<button data-c="${k}" aria-selected="${ui.compTab === k}">${l}</button>`).join("")}</div>`;
  let body = "";
  if (ui.compTab === "klasemen") {
    body = `<div class="card scroll" style="padding:6px"><table class="tbl"><thead><tr><th class="n">#</th><th>Klub</th><th class="n">M</th><th class="n">M</th><th class="n">S</th><th class="n">K</th><th class="n">SG</th><th class="n">Poin</th></tr></thead><tbody>
      ${tb.map((r, i) => `<tr class="${r.id === club.id ? "me" : ""} ${i < (L.id === "IDN1" ? 2 : 4) ? "zone-top" : i >= tb.length - L.relegate ? "zone-bot" : ""}"><td class="n">${i + 1}</td><td>${esc(G.clubs[r.id].name)}</td><td class="n">${r.p}</td><td class="n">${r.w}</td><td class="n">${r.d}</td><td class="n">${r.l}</td><td class="n">${r.gf - r.ga > 0 ? "+" : ""}${r.gf - r.ga}</td><td class="n"><b>${r.pts}</b></td></tr>`).join("")}
    </tbody></table><p class="muted" style="font-size:13px;margin:8px 6px">Degradasi belum disimulasikan di versi ini.</p></div>`;
  } else if (ui.compTab === "jadwal") {
    const maxR = Math.max(...L.fixtures.map(f => f.r));
    const nextR = (L.fixtures.find(f => !f.res) || { r: maxR }).r;
    const r = ui.round && ui.round <= maxR ? ui.round : nextR;
    const fx = L.fixtures.filter(f => f.r === r);
    const mine = L.fixtures.filter(f => f.h === club.id || f.a === club.id);
    body = `<div class="grid2"><div class="card"><div class="spread"><button class="btn small" data-r="${r - 1}" ${r <= 1 ? "disabled" : ""}>←</button><h2>Pekan ${r}</h2><button class="btn small" data-r="${r + 1}" ${r >= maxR ? "disabled" : ""}>→</button></div>
      <div class="muted" style="text-align:center;margin-bottom:6px">${fx[0] ? fmtDay(fx[0].d) : ""}</div>
      <table class="tbl"><tbody>${fx.map(f => `<tr class="${f.h === club.id || f.a === club.id ? "me" : ""}"><td style="text-align:right">${esc(G.clubs[f.h].name)}</td><td class="n" style="text-align:center;white-space:nowrap">${f.res ? `<b>${f.res[0]} - ${f.res[1]}</b>` : "vs"}</td><td>${esc(G.clubs[f.a].name)}</td></tr>`).join("")}</tbody></table></div>
      ${L.id === club.league ? `<div class="card"><h2>Jadwal ${esc(club.short)}</h2><table class="tbl"><tbody>${mine.map(f => { const home = f.h === club.id; const opp = G.clubs[home ? f.a : f.h]; let res = "", cls = ""; if (f.res) { const [a, b] = home ? f.res : [f.res[1], f.res[0]]; res = `${a}-${b}`; cls = a > b ? "good" : a < b ? "bad" : ""; } return `<tr><td class="muted">${fmt(f.d)}</td><td>${home ? "K" : "T"}</td><td>${esc(opp.name)}</td><td class="n">${res ? `<span class="chip ${cls}">${res}</span>` : ""}</td></tr>`; }).join("")}</tbody></table></div>` : ""}</div>`;
  } else if (ui.compTab === "statistik") {
    const players = L.teams.flatMap(id => G.clubs[id].squad.map(pid => G.players[pid])).filter(Boolean);
    const top = (k, n = 10) => players.filter(p => p.st[k] > 0).sort((a, b) => b.st[k] - a.st[k] || a.st.min - b.st.min).slice(0, n);
    const rated = players.filter(p => p.st.rn >= Math.max(3, Math.max(...L.fixtures.filter(f => f.res).map(f => f.r), 0) * 0.5)).sort((a, b) => b.st.rsum / b.st.rn - a.st.rsum / a.st.rn).slice(0, 10);
    const tbl = (title, list, val) => `<div class="card"><h2>${title}</h2><table class="tbl"><tbody>${list.map((p, i) => `<tr class="${p.isUser ? "me" : ""} click" data-p="${p.id}"><td class="n">${i + 1}</td><td>${esc(shortName(p))}<div class="muted" style="font-size:12.5px">${esc(G.clubs[p.club]?.short || "")}</div></td><td class="n"><b>${val(p)}</b></td></tr>`).join("") || '<tr><td class="muted">Belum ada data.</td></tr>'}</tbody></table></div>`;
    body = `<div class="grid2">${tbl("Top skor", top("gls"), p => p.st.gls)}${tbl("Assist", top("ast"), p => p.st.ast)}${tbl("Rating rata-rata", rated, p => (p.st.rsum / p.st.rn).toFixed(2))}${tbl("Pemain terbaik laga", top("pom"), p => p.st.pom)}</div>`;
  } else {
    body = `<div class="card"><table class="tbl"><thead><tr><th>Musim</th><th>Juara</th><th>Runner-up</th><th>Top skor</th></tr></thead><tbody>${L.history.slice().reverse().map(h => `<tr><td>${seasonLabel(h.season)}</td><td><b>${esc(G.clubs[h.champion]?.name || "-")}</b></td><td>${esc(G.clubs[h.runnerUp]?.name || "-")}</td><td>${h.topScorer && G.players[h.topScorer] ? esc(shortName(G.players[h.topScorer])) + ` (${h.topGoals})` : h.topGoals ? `${h.topGoals} gol` : "-"}</td></tr>`).join("") || '<tr><td class="muted" colspan="4">Belum ada musim yang selesai.</td></tr>'}</tbody></table></div>`;
  }
  root.innerHTML = tabs + body;
  root.querySelectorAll("[data-l]").forEach(b => b.addEventListener("click", () => { ui.compLeague = b.dataset.l; ui.round = null; renderMain(); }));
  root.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => { ui.compTab = b.dataset.c; renderMain(); }));
  root.querySelectorAll("[data-r]").forEach(b => b.addEventListener("click", () => { ui.round = +b.dataset.r; renderMain(); }));
  root.querySelectorAll("[data-p]").forEach(r => r.addEventListener("click", () => showPlayer(+r.dataset.p)));
}

// ---------------- career / hall of fame ----------------
function viewCareer(root) {
  const p = userP(G), u = G.user;
  const H = u.history;
  const tot = H.reduce((s, h) => ({ apps: s.apps + h.apps + h.sub, gls: s.gls + h.gls, ast: s.ast + h.ast }), { apps: 0, gls: 0, ast: 0 });
  const cs = u.cs.liga; tot.apps += cs.apps + cs.sub; tot.gls += cs.gls; tot.ast += cs.ast;
  const age = ageOn(p.birth, G.date);
  root.innerHTML = `
  <div class="card"><div class="label">${u.retired ? "Karier selesai" : "Karier berjalan"} · ${esc(u.difficulty)}${(u.flags || []).includes("EDITOR") ? " · [EDITOR]" : ""}</div>
    <div class="big" style="font-family:var(--display);font-size:clamp(34px,8vw,64px);text-transform:uppercase;line-height:.95;margin:6px 0">${esc(fullName(p))}</div>
    <div class="row">
      <span class="chip">${tot.apps} laga klub</span><span class="chip">${tot.gls} gol</span><span class="chip">${tot.ast} assist</span>
      <span class="chip gold">${u.trophies.length} trofi</span><span class="chip">${p.caps || 0} caps senior (${p.intGoals || 0} gol)</span>
    </div>
  </div>
  <div class="card scroll"><h2>Riwayat musim</h2><table class="tbl"><thead><tr><th>Musim</th><th>Klub</th><th class="n">Main</th><th class="n">Gol</th><th class="n">Ast</th><th class="n">Rat</th><th>Catatan</th></tr></thead><tbody>
    ${H.map(h => `<tr><td>${h.season}</td><td>${esc(h.clubName)}${h.loan ? " (P)" : ""}<div class="muted" style="font-size:12.5px">${esc(h.league)}${h.pos ? ` · peringkat ${h.pos}` : ""}</div></td><td class="n">${h.apps}${h.sub ? ` (${h.sub})` : ""}</td><td class="n">${h.gls}</td><td class="n">${h.ast}</td><td class="n">${h.rating ? h.rating.toFixed(2) : "-"}</td><td style="font-size:13.5px">${[h.u19 ? `U-19: ${h.u19.apps} laga, ${h.u19.gls} gol` : "", h.intl ? `Timnas: ${h.intl.apps} laga, ${h.intl.gls} gol` : "", h.ballon ? `Bola Emas #${h.ballon}` : "", ...h.notes].filter(Boolean).map(esc).join(" · ")}</td></tr>`).join("") || '<tr><td colspan="7" class="muted">Musim pertama belum selesai.</td></tr>'}
  </tbody></table></div>
  <div class="grid2">
    <div class="card"><h2>Trofi</h2>${u.trophies.map(t => `<div class="spread" style="padding:4px 0;border-bottom:1px dashed var(--line)"><span>${esc(t.name)} <span class="muted">· ${esc(t.club)}</span></span><span class="num muted">${esc(t.year)}</span></div>`).join("") || '<p class="muted">Belum ada trofi.</p>'}</div>
    <div class="card"><h2>Penghargaan</h2>${u.awards.map(t => `<div class="spread" style="padding:4px 0;border-bottom:1px dashed var(--line)"><span>${esc(t.name)}${t.detail ? ` <span class="muted">· ${esc(t.detail)}</span>` : ""}</span><span class="num muted">${esc(t.year)}</span></div>`).join("") || '<p class="muted">Belum ada penghargaan.</p>'}</div>
  </div>
  <div class="grid2">
    <div class="card"><h2>Timnas</h2><dl class="facts"><dt>Negara</dt><dd>${esc(nat(p.nat))}</dd><dt>Senior</dt><dd>${p.caps || 0} laga, ${p.intGoals || 0} gol${u.debut ? ` · debut ${fmt(u.debut.date)} vs ${esc(nat(u.debut.opp))}` : ""}</dd>${Object.entries(u.int.youth || {}).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v} laga</dd>`).join("")}</dl></div>
    <div class="card"><h2>Perpindahan</h2>${(u.moves || []).map(m => `<div style="padding:4px 0;border-bottom:1px dashed var(--line)">${fmt(m.date)} · ${esc(G.clubs[m.from]?.short || "")} → <b>${esc(G.clubs[m.to]?.name || "")}</b> <span class="muted">${m.type === "loan" ? "pinjaman" : m.fee ? "€" + fmtM(m.fee) : "gratis"}</span></div>`).join("") || '<p class="muted">Belum pernah pindah klub.</p>'}</div>
  </div>
  <div class="card"><h2>Pengaturan</h2><div class="row">
    ${!u.retired && age >= 30 ? '<button class="btn" id="retire">Umumkan pensiun</button>' : ""}
    <button class="btn" id="home">Ke layar awal</button>
    <button class="btn" id="wipe" style="border-color:var(--bad);color:var(--bad)">Hapus karier</button>
  </div><p class="muted" style="font-size:13.5px;margin:8px 0 0">Game tersimpan otomatis di perangkat setiap kali kamu menekan Lanjutkan atau mengambil keputusan.</p></div>`;
  $("#retire")?.addEventListener("click", () => { retireUser(G); save(); view = "inbox"; ui.mail = G.inbox[0].id; renderMain(); });
  $("#home").addEventListener("click", async () => { await save(); renderStart(true, G); });
  $("#wipe").addEventListener("click", async () => { if (!confirm("Hapus karier ini secara permanen?")) return; await deleteSave(); G = null; renderStart(false); });
}

// ---------------- match day ----------------
function viewPrematch(root) {
  if (!G.pending) { view = "inbox"; return viewInbox(root); }
  const { H, A } = pendingTeams(G);
  const pd = G.pending, u = userP(G);
  const cH = teamColors(G, H), cA = teamColors(G, A);
  const list = t => [...t.xi.map(p => [p, true]), ...t.bench.map(p => [p, false])].map(([p, s], i) => `<tr class="${p.isUser ? "me" : ""}" ${i === t.xi.length ? 'style="border-top:2px solid var(--line)"' : ""}><td class="muted">${s ? "" : "C"}</td><td>${esc(shortName(p))}</td><td class="muted">${p.main}</td></tr>`).join("");
  const roleText = pd.role === "XI" ? "Kamu masuk starting XI." : pd.role === "Cadangan" ? "Kamu di bangku cadangan." : "Kamu tidak masuk daftar pemain.";
  root.innerHTML = `
  <div class="card"><div class="label">${esc(pd.comp)}${pd.round ? ` · pekan ${pd.round}` : ""} · ${fmtDay(G.date)}</div>
    <div class="scoreboard" style="margin:12px 0"><div><span class="crest" style="margin:0 auto 6px;background:${cH[0]};border-color:${cH[1]};color:${cH[1]}"></span><div class="tm">${esc(H.name)}</div></div><div class="sc" style="font-size:28px">VS</div><div><span class="crest" style="margin:0 auto 6px;background:${cA[0]};border-color:${cA[1]};color:${cA[1]}"></span><div class="tm">${esc(A.name)}</div></div></div>
    <div class="notice">${roleText}${u.cond < 80 ? ` Kondisimu ${Math.round(u.cond)}%.` : ""}</div>
    <div class="row"><button class="btn primary go" id="watch" style="flex:1">Tonton 2D</button><button class="btn go" id="quick" style="flex:1">Hasil langsung</button></div>
  </div>
  <div class="grid2"><div class="card scroll" style="padding:6px"><h3 style="padding:6px">${esc(H.name)} · ${H.formation}</h3><table class="tbl"><tbody>${list(H)}</tbody></table></div><div class="card scroll" style="padding:6px"><h3 style="padding:6px">${esc(A.name)} · ${A.formation}</h3><table class="tbl"><tbody>${list(A)}</tbody></table></div></div>`;
  $("#watch").addEventListener("click", () => play(true));
  $("#quick").addEventListener("click", () => play(false));
}
function play(watch) {
  loading(true, "Pertandingan dimulai...");
  setTimeout(() => {
    const r = playPending(G, watch);
    save();
    loading(false);
    ui.post = r.summary;
    view = "post";
    if (watch && r.replay) openViewer(r.replay, () => renderMain());
    else renderMain();
  }, 20);
}
function viewPost(root) {
  const S = ui.post || G.lastMatch;
  if (!S) { view = "inbox"; return viewInbox(root); }
  const goals = side => S.events.filter(e => e.type === "goal" && e.side === side).map(e => `${esc(e.name)} ${e.min}'${e.kind === "pen" ? " (p)" : ""}`).join("<br>");
  const stat = (t, a, b, f = x => x) => { const s = a + b || 1; return `<div class="stat"><div class="t">${t}</div><span class="num">${f(a)}</span><div class="bar"><i style="width:${(a / s) * 100}%;background:${S.home.colors[0]}"></i><i style="width:${(b / s) * 100}%;background:${S.away.colors[0] === S.home.colors[0] ? S.away.colors[1] : S.away.colors[0]}"></i></div><span class="num" style="text-align:right">${f(b)}</span></div>`; };
  const T = S.teams;
  const lines = side => S.lines.filter(l => l.side === side).sort((a, b) => b.start - a.start);
  const ratingRows = side => lines(side).map(l => `<tr class="${l.id === userP(G).id ? "me" : ""}"><td>${esc(l.name)}${l.start ? "" : ' <span class="muted">(C)</span>'}</td><td class="muted">${l.pos}</td><td class="n">${l.min}'</td><td class="n">${l.gls || ""}</td><td class="n">${l.ast || ""}</td><td class="n"><b style="color:${l.rating >= 7.5 ? "var(--good)" : l.rating < 6.3 ? "var(--bad)" : "inherit"}">${l.rating.toFixed(1)}</b>${+l.id === S.pom ? " ★" : ""}</td></tr>`).join("");
  const me = S.user;
  root.innerHTML = `
  <div class="card"><div class="label">${esc(S.comp)} · ${fmt(S.date)}</div>
    <div class="scoreboard" style="margin:12px 0"><div class="tm">${esc(S.home.name)}</div><div class="sc">${S.score[0]} - ${S.score[1]}</div><div class="tm">${esc(S.away.name)}</div></div>
    ${S.pens ? `<p class="muted" style="text-align:center;margin:0 0 8px">${esc(S.pens)}</p>` : ""}
    <div class="scoreboard" style="font-size:14px;align-items:start"><div class="muted">${goals(0)}</div><div></div><div class="muted">${goals(1)}</div></div>
    ${me ? `<div class="notice" style="margin-top:12px"><b>Kamu:</b> ${me.min} menit · rating ${me.rating.toFixed(1)}${me.gls ? ` · ${me.gls} gol` : ""}${me.ast ? ` · ${me.ast} assist` : ""}${me.sh ? ` · ${me.sh} tembakan` : ""}${me.pas ? ` · umpan ${me.pasc}/${me.pas}` : ""}${me.drb ? ` · ${me.drb} dribel sukses` : ""}${me.tck ? ` · ${me.tck} tekel` : ""}${me.injured ? " · <b>cedera</b>" : ""}</div>` : `<div class="notice" style="margin-top:12px">Kamu tidak dimainkan.</div>`}
    <p class="muted" style="margin:8px 0 0">Pemain terbaik: <b style="color:var(--ink)">${esc(S.pomName)}</b></p>
    <button class="btn primary go" id="cont" style="width:100%;margin-top:10px">Lanjutkan</button>
  </div>
  ${T ? `<div class="card"><h2>Statistik</h2>${stat("Penguasaan bola", T[0].pos, T[1].pos, x => x + "%")}${stat("Tembakan", T[0].sh, T[1].sh)}${stat("Tepat sasaran", T[0].sot ?? 0, T[1].sot ?? 0)}${T[0].xg != null ? stat("xG", T[0].xg, T[1].xg, x => x.toFixed(2)) : ""}${T[0].pas != null ? stat("Umpan sukses", T[0].pasc, T[1].pasc) : ""}${stat("Sepak pojok", T[0].cor ?? 0, T[1].cor ?? 0)}${stat("Pelanggaran", T[0].fou ?? 0, T[1].fou ?? 0)}${stat("Kartu kuning", T[0].yc ?? 0, T[1].yc ?? 0)}</div>` : ""}
  <div class="grid2"><div class="card scroll" style="padding:6px"><h3 style="padding:6px">${esc(S.home.name)}</h3><table class="tbl"><tbody>${ratingRows(0)}</tbody></table></div><div class="card scroll" style="padding:6px"><h3 style="padding:6px">${esc(S.away.name)}</h3><table class="tbl"><tbody>${ratingRows(1)}</tbody></table></div></div>`;
  $("#cont").addEventListener("click", () => { view = "inbox"; onContinue(); });
}
