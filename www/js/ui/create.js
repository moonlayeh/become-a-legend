// Main menu, player creation wizard and the signing announcement.
import { $, $$, esc, crest, avatar, jersey, flagEmoji, SKINS, HAIR_COLORS, HAIR_STYLES, BEARDS, toast, applyTheme, lum } from "./core.js";
import { NATIONS, LEAGUES, CLUBS, POSITIONS, POS_LABEL } from "../data.js";
import { ATTRS, A } from "../attributes.js";
import { day, ymd, ageOn, fmt, BULAN_PANJANG } from "../calendar.js";
import { RNG } from "../rng.js";
import { STYLES, TRAITS, LANGS, buildUser, fifaU18Allowed, CITY, userP, userClub } from "../world.js";
import { newCareer } from "../sim.js";
import { saveGame, loadGame, deleteSave } from "../save.js";
import { personality, fullName } from "../player.js";
import { abilityWord, WORD_COLOR, PITCH_XY, clubReputation, REP_COLOR, facilities, clubCulture, predictedFinish, hash } from "../meta.js";
import { bestXI, formationPitch } from "./club.js";
import { shirtNumber } from "../sim.js";

const START = day(2026, 7, 1);
const iso = n => { const { y, m, d } = ymd(n); return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; };
const fromIso = s => { const [y, m, d] = s.split("-").map(Number); return day(y, m, d); };
const STEPS = ["Biografi", "Penampilan", "Posisi", "Gaya Bermain", "Kepribadian", "Klub", "Ringkasan"];
const USER_NATS = () => Object.entries(NATIONS).filter(([, n]) => !n.opp).sort((a, b) => a[1].name.localeCompare(b[1].name));
const ALL_LANGS = [...new Set([...Object.values(LANGS), "Arab", "Inggris", "Mandarin"])].sort();

let W = null, step = 0, onDone = null;

// ---------- main menu ----------
export async function mainMenu(done) {
  onDone = done;
  applyTheme(["#5b2b9b", "#ffffff"]);
  const g = await loadGame();
  const u = g && g.players[g.user.pid];
  $("#app").innerHTML = `<div class="menu">
    <div class="row" style="justify-content:space-between"><span class="muted" style="font-size:13px">v0.2 · offline</span></div>
    <div class="logo">Become a<br><span>Legend</span></div>
    <button class="mcard hero" id="new"><h2>Mulai Karier Baru</h2><p>Buat pemainmu sendiri dan tempa jalan dari akademi sampai pensiun.</p></button>
    <button class="mcard" id="load" ${g ? "" : "disabled"}><h2>Muat Karier</h2><p>${g ? `${esc(fullName(u))} · ${esc(g.clubs[u.club]?.name || "")} · ${fmt(g.date)}` : "Belum ada karier tersimpan di perangkat ini."}</p></button>
    ${g ? '<button class="btn danger sm" id="wipe" style="margin-top:6px">Hapus karier tersimpan</button>' : ""}
    <p class="muted" style="font-size:12.5px;margin-top:24px">Klub dan liga memakai nama asli; semua pemain, pelatih, dan staf adalah tokoh fiktif.</p></div>`;
  $("#new").onclick = () => { if (g && !confirm("Karier lama akan ditimpa setelah karier baru dibuat. Lanjutkan?")) return; startWizard(); };
  if (g) $("#load").onclick = () => done(g);
  $("#wipe")?.addEventListener("click", async () => { if (confirm("Hapus karier ini secara permanen?")) { await deleteSave(); mainMenu(done); } });
}

// ---------- wizard ----------
function startWizard() {
  W = { fn: "", ln: "", nick: "", birth: "2010-02-06", birthplace: "", nat: "IDN", nat2: "", langs: ["Indonesia"], look: { skin: 2, hair: 2, hc: 0, beard: 0 }, height: 176, pos: "ST", secondary: [], foot: "Kanan", wf: "Sedang", styles: [], traits: [], club: "acak", league: "IDN1", difficulty: "Normal", sub: 0 };
  step = 0; paint();
}
function ageNow() { return ageOn(fromIso(W.birth), START); }
function previewPlayer() {
  const c = W.club !== "acak" ? CLUBS.find(c => c.id === W.club) : null;
  const club = c ? { ...c, nation: LEAGUES.find(l => l.id === c.league).nation } : { id: "x", level: 130, youth: 14, league: "ESP1", nation: W.nat };
  const rng = new RNG(hash(JSON.stringify([W.pos, W.styles, W.traits, W.nat])));
  return buildUser(rng, { ...W, birth: fromIso(W.birth), secondary: W.secondary, fn: W.fn || "Nama", ln: W.ln || "Pemain" }, club, START, 1);
}
function previewPanel() {
  const p = previewPlayer();
  const groups = p.main === "GK" ? [["K", "Kiper"], ["M", "Mental"], ["F", "Fisik"]] : [["T", "Teknik"], ["M", "Mental"], ["F", "Fisik"]];
  const avg = g => { const v = ATTRS.map((a, i) => [a, i]).filter(([a]) => a[2] === g).map(([, i]) => p.a[i]); return v.reduce((s, x) => s + x, 0) / v.length; };
  // relative words: compare each group to the player's own mean so the panel shows the shape, not the level
  const mean = groups.reduce((s, [g]) => s + avg(g), 0) / groups.length;
  const top = ATTRS.map((a, i) => [a, p.a[i]]).filter(([a]) => (p.main === "GK" ? a[2] !== "T" : a[2] !== "K")).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const rel = v => abilityWord(11 + (v - mean) * 1.6);
  return `<div class="preview">${avatar(W.look, ["#3a3546", "#cfc7ff"], 72, ageNow())}<div style="min-width:0"><b>${esc((W.fn || "Nama") + " " + (W.ln || "Pemain"))}</b><div class="muted" style="font-size:13px">Usia ${ageNow()} tahun · ${esc(POS_LABEL[W.pos])}</div><div class="muted" style="font-size:13px">${esc(personality(p))}</div></div></div>
    <div class="wordlist" style="background:#222129;border-radius:8px;padding:6px 4px;margin-bottom:12px"><div style="color:#f1b43a;font-size:13px;padding:2px 8px 4px;font-weight:700">Profil Atribut</div>
      ${groups.map(([g, l]) => { const w = rel(avg(g)); return `<div class="wr"><span>${l}</span><span class="word" style="color:${WORD_COLOR[w]}">${w}</span></div>`; }).join("")}
      <div style="color:#f1b43a;font-size:13px;padding:8px 8px 4px;font-weight:700">Atribut Menonjol</div>${top.map(([a]) => `<div class="wr"><span>${esc(a[1])}</span></div>`).join("")}</div>`;
}
function paint() {
  const body = [stepBio, stepLook, stepPos, stepStyle, stepTraits, stepClub, stepSummary][step]();
  const counter = step === 3 ? `${W.styles.length}/3 pilihan` : step === 4 ? `${W.traits.length}/2 pilihan` : "";
  $("#app").innerHTML = `<div class="wiz"><div class="wh"><h1>Buat Pemain</h1><div class="crumbs">${STEPS.map((s, i) => `<span class="${i === step ? "on" : i < step ? "done" : ""}">${s}</span>${i < STEPS.length - 1 ? "<span>›</span>" : ""}`).join("")}</div></div>
    <div class="wb">${body}</div>
    <div class="wf"><button class="btn" id="wback">‹ Kembali</button><span class="cnt">${counter}</span><button class="btn pri" id="wnext">${step === STEPS.length - 1 ? "Mulai Karier ›" : "Berikutnya ›"}</button></div></div>`;
  window.scrollTo(0, 0);
  $("#wback").onclick = () => { if (step === 0) mainMenu(onDone); else { step--; paint(); } };
  $("#wnext").onclick = next;
  bind[step]?.();
}
function next() {
  if (step === 0) {
    W.fn = $("#fn").value.trim(); W.ln = $("#ln").value.trim();
    if (!W.fn || !W.ln) { toast("Isi nama depan dan nama belakang."); return; }
    const a = ageNow(); if (a < 15 || a > 18) { toast("Usia pada 1 Juli 2026 harus 15–18 tahun."); return; }
  }
  if (step === 5 && W.club !== "acak") {
    const c = CLUBS.find(c => c.id === W.club);
    if (c.id === "ath" && W.nat !== "ESP" && W.nat2 !== "ESP") { toast("Athletic Club hanya merekrut pemain Basque/Spanyol."); return; }
  }
  if (step === STEPS.length - 1) return finish();
  step++; paint();
}

// --- step 1: biography
function stepBio() {
  const nats = USER_NATS();
  const cities = Object.keys(CITY[W.nat] || {}).map(c => c[0].toUpperCase() + c.slice(1));
  const a = ageNow();
  return `${previewPanel()}
  <h2>Saya ingin dikenal sebagai…</h2><p class="help">Nama ini dipakai sepanjang kariermu.</p>
  <label class="fld"><span>Nama depan</span><input id="fn" value="${esc(W.fn)}" maxlength="20" autocomplete="off"></label>
  <label class="fld"><span>Nama belakang</span><input id="ln" value="${esc(W.ln)}" maxlength="24" autocomplete="off"></label>
  <h2 style="margin-top:14px">Saya lahir pada…</h2><p class="help">Ini menentukan usiamu. Kamu bisa mulai di usia 15–17 (atau 18).</p>
  <label class="fld"><span>Tanggal lahir</span><input id="dob" type="date" value="${W.birth}" min="2007-07-02" max="2011-07-01"></label>
  <div class="muted" style="font-size:13.5px;margin:-6px 0 12px">Usia saat musim dimulai: <b style="color:#fff" id="agev">${a} tahun</b></div>
  <h2 style="margin-top:14px">Saya adalah…</h2>
  <label class="fld"><span>Tempat lahir</span><input id="bp" value="${esc(W.birthplace)}" list="cities" maxlength="30" placeholder="mis. Tulungagung"><datalist id="cities">${cities.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
  <label class="fld"><span>Kewarganegaraan</span><select id="nat">${nats.map(([k, n]) => `<option value="${k}" ${k === W.nat ? "selected" : ""}>${flagEmoji(k)} ${esc(n.name)}</option>`).join("")}</select></label>
  ${W.nat2 !== "" || W.showNat2 ? `<label class="fld"><span>Kewarganegaraan kedua</span><select id="nat2"><option value="">Tidak ada</option>${Object.entries(NATIONS).sort((a, b) => a[1].name.localeCompare(b[1].name)).filter(([k]) => k !== W.nat).map(([k, n]) => `<option value="${k}" ${k === W.nat2 ? "selected" : ""}>${flagEmoji(k)} ${esc(n.name)}</option>`).join("")}</select></label><p class="help" style="margin-top:-6px">Bisa membuka jalur timnas kedua (pindah federasi diatur aturan FIFA) dan memudahkan transfer ke negara itu sebelum usia 18.</p>` : `<button class="addrow" id="addnat"><b>+</b>Pilih kewarganegaraan kedua</button>`}
  <label class="fld"><span>Bahasa yang dikuasai</span><select id="lang0">${ALL_LANGS.map(l => `<option ${l === W.langs[0] ? "selected" : ""}>${l}</option>`).join("")}</select></label>
  ${W.langs.slice(1).map((l, i) => `<label class="fld"><span>Bahasa tambahan</span><select data-lang="${i + 1}"><option value="">(hapus)</option>${ALL_LANGS.map(x => `<option ${x === l ? "selected" : ""}>${x}</option>`).join("")}</select></label>`).join("")}
  ${W.langs.length < 3 ? '<button class="addrow" id="addlang"><b>+</b>Tambah bahasa</button>' : ""}`;
}
const bind = [];
bind[0] = () => {
  const keep = () => { W.fn = $("#fn").value.trim(); W.ln = $("#ln").value.trim(); W.birthplace = $("#bp").value.trim(); };
  $("#dob").onchange = e => { if (e.target.value) { W.birth = e.target.value; keep(); paint(); } };
  $("#bp").onchange = keep;
  $("#nat").onchange = e => { keep(); W.nat = e.target.value; W.langs[0] = LANGS[W.nat] || W.langs[0]; if (W.nat2 === W.nat) W.nat2 = ""; W.league = LEAGUES.find(l => l.nation === W.nat)?.id || W.league; paint(); };
  $("#nat2")?.addEventListener("change", e => { keep(); W.nat2 = e.target.value; W.showNat2 = true; paint(); });
  $("#addnat")?.addEventListener("click", () => { keep(); W.showNat2 = true; paint(); });
  $("#lang0").onchange = e => { W.langs[0] = e.target.value; };
  $$("[data-lang]").forEach(s => (s.onchange = e => { keep(); const i = +s.dataset.lang; if (!e.target.value) W.langs.splice(i, 1); else W.langs[i] = e.target.value; paint(); }));
  $("#addlang")?.addEventListener("click", () => { keep(); W.langs.push(ALL_LANGS.find(l => !W.langs.includes(l))); paint(); });
  ["#fn", "#ln"].forEach(s => ($(s).oninput = () => { W.fn = $("#fn").value; W.ln = $("#ln").value; }));
};

// --- step 2: appearance
function stepLook() {
  const sw = (key, arr, label) => `<div class="lbl" style="margin-bottom:6px">${label}</div><div class="swatches">${arr.map((c, i) => `<button class="swatch" style="background:${c}" data-k="${key}" data-v="${i}" aria-pressed="${W.look[key] === i}" aria-label="${label} ${i + 1}"></button>`).join("")}</div>`;
  const chips = (key, arr, label) => `<div class="lbl" style="margin-bottom:6px">${label}</div><div class="chipsel">${arr.map((c, i) => `<button data-k="${key}" data-v="${i}" aria-pressed="${W.look[key] === i}">${c}</button>`).join("")}</div>`;
  return `<div style="display:grid;place-items:center;background:#222129;border-radius:8px;padding:12px;margin-bottom:12px">${avatar(W.look, ["#c62828", "#ffffff"], 150, ageNow())}<b style="margin-top:6px">${esc(W.fn)} ${esc(W.ln)}</b></div>
  <h2>Penampilan</h2><p class="help">Avatar ini muncul di profil, susunan pemain, dan berita.</p>
  ${sw("skin", SKINS, "Warna kulit")}${chips("hair", HAIR_STYLES, "Gaya rambut")}${sw("hc", HAIR_COLORS, "Warna rambut")}${chips("beard", BEARDS, "Jenggot/kumis")}
  <label class="fld"><span>Tinggi badan: <b id="hv">${W.height} cm</b></span><input type="range" id="ht" min="160" max="200" value="${W.height}" style="min-height:auto;padding:0"></label>`;
}
bind[1] = () => {
  $$("[data-k]").forEach(b => (b.onclick = () => { W.look[b.dataset.k] = +b.dataset.v; paint(); }));
  $("#ht").oninput = e => { W.height = +e.target.value; $("#hv").textContent = W.height + " cm"; };
};

// --- step 3: position
function stepPos() {
  return `<h2>Posisi bermain</h2><p class="help">Ketuk sekali untuk posisi utama, ketuk lagi posisi lain untuk menambah posisi kedua (maks. 2).</p>
  <div class="seg" style="margin-bottom:10px"><button data-mode="main" aria-pressed="${!W.secMode}">Posisi utama</button><button data-mode="sec" aria-pressed="${!!W.secMode}">Posisi kedua</button></div>
  <div class="pospick">${Object.entries(PITCH_XY).map(([k, [x, y]]) => `<button data-pos="${k}" class="${W.pos === k ? "main" : W.secondary.includes(k) ? "sec" : ""}" style="left:${x}%;top:${y}%">${k}</button>`).join("")}</div>
  <div class="muted" style="text-align:center;margin-bottom:12px"><b style="color:#fff">${esc(POS_LABEL[W.pos])}</b>${W.secondary.length ? ` · juga ${W.secondary.map(s => POS_LABEL[s]).join(", ")}` : ""}</div>
  <label class="fld"><span>Kaki dominan</span><select id="foot">${["Kanan", "Kiri", "Dua kaki"].map(f => `<option ${W.foot === f ? "selected" : ""}>${f}</option>`).join("")}</select></label>
  ${W.foot !== "Dua kaki" ? `<label class="fld"><span>Kekuatan kaki lemah</span><select id="wf">${["Lemah", "Sedang", "Kuat"].map(f => `<option ${W.wf === f ? "selected" : ""}>${f}</option>`).join("")}</select></label>` : ""}`;
}
bind[2] = () => {
  $$("[data-mode]").forEach(b => (b.onclick = () => { W.secMode = b.dataset.mode === "sec"; paint(); }));
  $$("[data-pos]").forEach(b => (b.onclick = () => {
    const k = b.dataset.pos;
    if (!W.secMode) { W.pos = k; W.secondary = W.secondary.filter(s => s !== k); if (W.styles.some(s => !!STYLES[s].gk !== (k === "GK") && s !== "athlete")) W.styles = []; }
    else if (k !== W.pos) { if (W.secondary.includes(k)) W.secondary = W.secondary.filter(s => s !== k); else if (W.secondary.length < 2) W.secondary.push(k); else toast("Maksimal dua posisi kedua."); }
    paint();
  }));
  $("#foot").onchange = e => { W.foot = e.target.value; paint(); };
  $("#wf")?.addEventListener("change", e => { W.wf = e.target.value; });
};

// --- step 4: playing style
function stepStyle() {
  const gk = W.pos === "GK";
  const list = Object.entries(STYLES).filter(([k, s]) => (gk ? s.gk || k === "athlete" : !s.gk));
  return `${previewPanel()}<h2>Bagaimana kamu menggambarkan <em>Gaya Bermain</em>-mu?</h2><p class="help">Pilih hingga tiga gaya. Sedikit pilihan berarti fokus yang lebih tajam; banyak pilihan berarti pemain yang lebih serba bisa. Kemampuan totalmu tidak berubah, hanya bentuknya.</p>
  ${list.map(([k, s]) => `<button class="pick" data-st="${k}" aria-pressed="${W.styles.includes(k)}" ${!W.styles.includes(k) && W.styles.length >= 3 ? "disabled" : ""}><span class="bx"></span><span><b>${esc(s.label)}</b><span>${esc(s.desc)}</span></span></button>`).join("")}`;
}
bind[3] = () => $$("[data-st]").forEach(b => (b.onclick = () => { const k = b.dataset.st; W.styles = W.styles.includes(k) ? W.styles.filter(x => x !== k) : [...W.styles, k].slice(0, 3); paint(); }));

// --- step 5: personality
function stepTraits() {
  return `${previewPanel()}<h2>Bagaimana kamu menggambarkan <em>Kepribadian</em>-mu?</h2><p class="help">Sifat ini memengaruhi cara kamu berlatih, menghadapi tekanan, dan berhubungan dengan klub. Pilih hingga dua.</p>
  ${Object.entries(TRAITS).map(([k, t]) => `<button class="pick" data-tr="${k}" aria-pressed="${W.traits.includes(k)}" ${!W.traits.includes(k) && W.traits.length >= 2 ? "disabled" : ""}><span class="bx"></span><span><b>${esc(t.label)}</b><span>${esc(t.desc)}</span></span></button>`).join("")}`;
}
bind[4] = () => $$("[data-tr]").forEach(b => (b.onclick = () => { const k = b.dataset.tr; W.traits = W.traits.includes(k) ? W.traits.filter(x => x !== k) : [...W.traits, k].slice(0, 2); paint(); }));

// --- step 6: club
function clubNote(c) {
  if (!c) return "";
  const cn = LEAGUES.find(l => l.id === c.league).nation;
  const nat = W.nat2 === cn ? W.nat2 : W.nat;
  if (c.id === "ath" && nat !== "ESP") return "Athletic Club hanya merekrut pemain Basque/Spanyol.";
  const r = fifaU18Allowed(nat, ageNow(), cn);
  return !r.ok ? `${r.note} Jika tetap dipilih, kariermu dimulai di usia 18.` : r.note || "";
}
function stepClub() {
  const clubs = CLUBS.filter(c => c.league === W.league).sort((a, b) => a.name.localeCompare(b.name));
  const sel = W.club !== "acak" ? CLUBS.find(c => c.id === W.club) : null;
  const cn = sel && LEAGUES.find(l => l.id === sel.league).nation;
  const lvlWord = c => (c.youth >= 18 ? "Akademi elite" : c.youth >= 15 ? "Akademi sangat baik" : c.youth >= 12 ? "Akademi baik" : c.youth >= 9 ? "Akademi cukup" : "Akademi dasar");
  const prof = sel ? `<div class="card" style="background:linear-gradient(180deg,${sel.colors[0]}55,#18171c 60%)"><div class="row">${crest(sel, 48)}<div><b style="font-size:19px">${esc(sel.name)}</b><div class="muted" style="font-size:13px">${flagEmoji(cn)} ${esc(NATIONS[cn].name)} · ${esc(LEAGUES.find(l => l.id === sel.league).name)}</div></div></div>
    <div class="grid2" style="margin-top:10px;font-size:13.5px"><div><div class="lbl">Reputasi</div><span style="color:${REP_COLOR[clubReputation({ ...sel, nation: cn })]}">●</span> ${clubReputation({ ...sel, nation: cn })}</div><div><div class="lbl">Fasilitas pemain muda</div>${facilities(sel)[1][1]}</div></div>
    <div class="lbl" style="margin-top:10px">Kostum</div><div class="kits">${[["Kandang", sel.colors], ["Tandang", [sel.colors[1], sel.colors[0]]], ["Ketiga", ["#1d1f26", sel.colors[0]]]].map(([l, c]) => `<div>${jersey(c, "", 48)}${l}</div>`).join("")}</div>
    <div class="lbl" style="margin-top:10px">Budaya</div>${clubCulture({ ...sel, formation: "—", nation: cn }).filter(t => !/formasi/.test(t)).map(t => `<div style="font-size:13.5px">🔥 ${esc(t)}</div>`).join("") || '<div class="muted" style="font-size:13.5px">-</div>'}
    ${clubNote(sel) ? `<div style="margin-top:10px;font-size:13.5px;color:#f1b43a">${esc(clubNote(sel))}</div>` : ""}</div>` : `<div class="card" style="background:#222129">Klub akan dipilih otomatis berdasarkan tempat lahir dan kewarganegaraanmu.</div>`;
  return `<h2>Pilih akademi</h2><p class="help">Klub tempat kariermu dimulai. Aturan FIFA untuk pemain di bawah 18 tahun berlaku.</p>
  <button class="clubrow" data-club="acak" aria-pressed="${W.club === "acak"}"><span class="rad"></span><b>Acak (berdasarkan tempat lahir)</b></button>
  <div class="hscroll" style="margin:10px 0">${LEAGUES.map(L => `<button class="btn sm ${W.league === L.id ? "sel" : ""}" data-lg="${L.id}">${esc(L.name)}</button>`).join("")}</div>
  ${prof}
  <div style="border-bottom:1px solid var(--line)">${clubs.map(c => `<button class="clubrow" data-club="${c.id}" aria-pressed="${W.club === c.id}"><span class="rad"></span>${crest(c, 22)}<span style="flex:1">${esc(c.name)}</span><span class="muted" style="font-size:12.5px">${lvlWord(c)}</span></button>`).join("")}</div>`;
}
bind[5] = () => {
  $$("[data-lg]").forEach(b => (b.onclick = () => { W.league = b.dataset.lg; paint(); }));
  $$("[data-club]").forEach(b => (b.onclick = () => { W.club = b.dataset.club; paint(); }));
};

// --- step 7: summary
function stepSummary() {
  const sel = W.club !== "acak" ? CLUBS.find(c => c.id === W.club) : null;
  return `${previewPanel()}<h2>Ringkasan</h2>
  <div class="card" style="background:#222129"><div class="kv" style="margin:0">
    <div><div class="k">Nama</div><div class="v">${esc(W.fn)} ${esc(W.ln)}</div></div><div><div class="k">Lahir</div><div class="v">${fmt(fromIso(W.birth))}${W.birthplace ? ", " + esc(W.birthplace) : ""}</div></div>
    <div><div class="k">Kewarganegaraan</div><div class="v">${flagEmoji(W.nat)} ${esc(NATIONS[W.nat].name)}${W.nat2 ? ` / ${flagEmoji(W.nat2)} ${esc(NATIONS[W.nat2].name)}` : ""}</div></div><div><div class="k">Bahasa</div><div class="v" style="white-space:normal">${esc(W.langs.join(", "))}</div></div>
    <div><div class="k">Posisi</div><div class="v">${esc(POS_LABEL[W.pos])}</div></div><div><div class="k">Kaki</div><div class="v">${esc(W.foot)}${W.foot !== "Dua kaki" ? ` · kaki lemah ${W.wf.toLowerCase()}` : ""}</div></div>
    <div><div class="k">Gaya</div><div class="v" style="white-space:normal">${W.styles.map(s => STYLES[s].label).join(", ") || "Seimbang"}</div></div><div><div class="k">Kepribadian</div><div class="v" style="white-space:normal">${W.traits.map(s => TRAITS[s].label).join(", ") || "Bebas"}</div></div>
    <div><div class="k">Akademi</div><div class="v">${sel ? esc(sel.name) : "Acak"}</div></div><div><div class="k">Tinggi</div><div class="v">${W.height} cm</div></div>
  </div></div>
  <h2>Kesulitan</h2>
  <button class="pick" data-df="Normal" aria-pressed="${W.difficulty === "Normal"}"><span class="bx"></span><span><b>Normal</b><span>Potensi tinggi, dunia realistis tapi ramah.</span></span></button>
  <button class="pick" data-df="Keras" aria-pressed="${W.difficulty === "Keras"}"><span class="bx"></span><span><b>Keras</b><span>Potensi diacak dan bisa rendah, cedera lebih sering, klub lebih kejam.</span></span></button>`;
}
bind[6] = () => $$("[data-df]").forEach(b => (b.onclick = () => { W.difficulty = b.dataset.df; paint(); }));

function finish() {
  const ld = document.createElement("div"); ld.className = "loading"; ld.innerHTML = '<div><div class="spin"></div>Membangun dunia sepak bola…</div>'; document.body.appendChild(ld);
  setTimeout(async () => {
    const G = newCareer({ ...W, birth: fromIso(W.birth), nat2: W.nat2 || null, club: W.club, look: { ...W.look } });
    await saveGame(G);
    ld.remove();
    pressRoom(G);
  }, 40);
}

// ---------- signing announcement ----------
function pressRoom(G, tab = "berita") {
  const u = userP(G), c = userClub(G);
  applyTheme(c.colors);
  const L = G.leagues[c.league];
  const xi = bestXI(G, c.id);
  const body = tab === "berita" ? `<div class="story"><div class="sh"><div><h3>${esc(c.short)} rekrut talenta muda ${esc(u.fn)} ${esc(u.ln)}</h3><div class="muted" style="font-size:13px;margin-top:4px">${esc(L.name)} | Baru Saja</div></div><div class="row">${avatar(u.look, c.colors, 56, ageOn(u.birth, G.date))}${crest(c, 50)}</div></div>
      <p>${esc(c.name)} resmi merekrut ${esc(fullName(u))}, ${POS_LABEL[u.main].toLowerCase()} berusia ${ageOn(u.birth, G.date)} tahun asal ${esc(u.birthplace || NATIONS[u.nat].name)}, untuk bergabung dengan ${u.squad === "Y" ? "tim U-19" : "skuad senior"} mereka.</p>
      <p>Staf akademi menyebut ${esc(u.fn)} sebagai pemain ${G.user.styles.length ? `dengan gaya ${G.user.styles.map(s => STYLES[s].label.toLowerCase()).join(", ")}` : "yang serba bisa"}, dan berharap ia bisa menembus tim utama dalam beberapa musim ke depan.</p>
      <p>${esc(c.short)} diprediksi finis di posisi ke-${predictedFinish(G, c)} ${esc(L.name)} musim ini.</p></div>`
    : tab === "profil" ? `<div style="padding:12px"><div class="kv" style="margin:0"><div><div class="k">Negara</div><div class="v">${flagEmoji(c.nation)} ${esc(NATIONS[c.nation].name)}</div></div><div><div class="k">Reputasi</div><div class="v">${clubReputation(c)}</div></div><div><div class="k">Formasi</div><div class="v">${c.formation}</div></div><div><div class="k">Prediksi</div><div class="v">ke-${predictedFinish(G, c)}</div></div></div>
      <div class="ch" style="margin-top:12px;font-size:14px">Fasilitas</div>${facilities(c).map(([k, v]) => `<div class="spread" style="padding:4px 0;font-size:14px"><span>${k}</span><span class="tag" style="border-color:var(--good);color:var(--good)">${v}</span></div>`).join("")}
      <div class="ch" style="margin-top:12px;font-size:14px">Budaya</div>${clubCulture(c).map(t => `<div style="font-size:14px">🔥 ${esc(t)}</div>`).join("")}</div>`
    : `<div style="padding:12px">${formationPitch(G, xi.map(s => ({ ...s, name: s.p.ln, no: shirtNumber(G, s.p) })), c.colors)}</div>`;
  $("#app").innerHTML = `<div class="press"><div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="gobtn" id="startc">Mulai Karier <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="m6 6 6 6-6 6M13 6l6 6-6 6"/></svg></button></div>
    <div class="pc"><div class="ph">${crest(c, 40)}<div><b>${esc(c.name)}</b><div class="muted" style="font-size:13px">Diprediksi finis di posisi ke-${predictedFinish(G, c)}</div></div><div style="margin-left:auto;text-align:right;font-size:12.5px"><div class="muted">Negara</div>${flagEmoji(c.nation)} ${esc(NATIONS[c.nation].name)}</div></div>
      <div class="hscroll" style="padding:10px 12px 0;gap:16px">${[["berita", "Berita Terkini"], ["profil", "Profil Klub"], ["xi", "XI Terbaik"]].map(([k, l]) => `<button data-pt="${k}" style="background:none;border:0;padding:6px 0;font-size:16px;font-weight:700;color:${tab === k ? "#fff" : "var(--muted)"};border-bottom:2px solid ${tab === k ? "#fff" : "transparent"}">${l}</button>`).join("")}</div>
      ${body}</div></div>`;
  $$("[data-pt]").forEach(b => (b.onclick = () => pressRoom(G, b.dataset.pt)));
  $("#startc").onclick = () => onDone(G);
}
