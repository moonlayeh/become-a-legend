// Card mode: the career told as a deck of quick cards (life, training, career, media) between real
// matches of the simulated world. Each card offers two choices that move five life stats:
// Bakat (ability, from the real attributes), Kesehatan, Mental (= morale), Sosial and Ketenaran,
// plus money. No energy and no waiting: one tap, one card.
import { RNG, clamp } from "./rng.js";
import { ymd, seasonOf, ageOn, fmt } from "./calendar.js";
import { userP, userClub, developPlayer, table, addMail } from "./world.js";
import { fullName } from "./player.js";
import { continueGame, playPending, rngOf, pendingTeams } from "./sim.js";
import { doTraining, playShare, squadStatus, resolveDecision } from "./career.js";
import { reputation } from "./meta.js";
import { interestedClubs } from "./contract.js";

export const STAT_META = [["bakat", "Bakat", "👟", "#9be15d"], ["health", "Kesehatan", "❤", "#62b6ff"], ["mental", "Mental", "🧠", "#ff6fae"], ["social", "Sosial", "👥", "#ffa23a"], ["fame", "Ketenaran", "⭐", "#b98cff"]];
const FAME_BASE = { Lokal: 8, Regional: 18, Nasional: 32, Kontinental: 52, "Seluruh Dunia": 72 };

export function life(G) {
  const u = G.user;
  if (!u.life) {
    const p = userP(G);
    u.life = { health: clamp(Math.round(88 - p.hid.inj * 1.6), 45, 90), social: 55, fame: FAME_BASE[reputation(G, p)] || 10, stars: 1, glory: 0, glorySeason: G.season, tierPaid: 0, cards: {}, recent: [], month: monthKey(G.date), snap: null, needLife: false, decisions: 0 };
    u.life.snap = statsNow(G);
  }
  return u.life;
}
const monthKey = d => { const { y, m } = ymd(d); return y * 12 + m - 1; };
const bakatOf = p => p.ca / 2;
export function statsNow(G) {
  const p = userP(G), L = G.user.life || {};
  return { bakat: bakatOf(p), health: L.health ?? 70, mental: p.morale ?? 65, social: L.social ?? 55, fame: L.fame ?? 10, money: G.user.money?.total || 0 };
}
// life stats feed back into the simulated world
export function syncLife(G) {
  const L = life(G), u = userP(G);
  if (u.hid.injBase == null) u.hid.injBase = u.hid.inj;
  u.hid.inj = clamp(Math.round(u.hid.injBase + (60 - L.health) / 7), 1, 20); // poor health, more injuries
  u.favour = clamp((L.social - 55) / 9, -4, 4); // coaches pick players the dressing room likes
}
export function weeklyLife(G) {
  const L = life(G), p = userP(G);
  L.health += (72 - L.health) * 0.12;
  L.social += (55 - L.social) * 0.05;
  const base = FAME_BASE[reputation(G, p)] || 10;
  L.fame += (base - L.fame) * 0.04;
  syncLife(G);
}

// apply stat changes; returns what really changed (for the result cards)
export function applyDeltas(G, rng, d = {}) {
  const L = life(G), u = userP(G), before = statsNow(G);
  if (d.b > 0) developPlayer(G, rng, u, d.b * 0.7, playShare(G), 1.25);
  else if (d.b < 0) G.user.trainBoost = (G.user.trainBoost || 0) + d.b * 0.03;
  if (d.h) L.health = clamp(L.health + d.h, 0, 100);
  if (d.m) u.morale = clamp((u.morale ?? 65) + d.m, 0, 100);
  if (d.s) L.social = clamp(L.social + d.s, 0, 100);
  if (d.f) L.fame = clamp(L.fame + d.f, 0, 100);
  if (d.$) { const m = G.user.money || (G.user.money = { total: 0, season: 0, bonus: 0 }); m.total = Math.max(0, m.total + d.$); }
  if (d.cr) G.user.coachRel = (G.user.coachRel || 0) + d.cr * 2;
  if (d.push) G.user.agentPush = true;
  if (d.nt) G.user.ntBuzz = (G.user.ntBuzz || 0) + d.nt;
  if (d.inj && !u.injury) { const days = d.inj; u.injury = { name: d.injName || "Cedera ringan", days, total: days, since: G.date }; G.user.injuries.push({ date: G.date, name: u.injury.name, days }); }
  if (d.adapt && G.user.adapt) G.user.adapt.since -= d.adapt;
  syncLife(G);
  const after = statsNow(G), out = {};
  for (const k of Object.keys(after)) { const v = after[k] - before[k]; if (Math.abs(v) >= (k === "money" ? 1 : 0.05)) out[k] = v; }
  return out;
}

// ---------- the deck ----------
// scene: background, who is in the picture, a prop
const W = G => Math.max(60, Math.round((userP(G).contract?.wage || 60)));
export const EVENTS = [
  // LATIHAN
  { id: "diet", cat: "LATIHAN", r: "BIASA", sc: ["canteen", "coach", "🥗"], t: "Diet klub", x: "Klub memberimu diet ketat: tanpa gula, tanpa pizza, jam malam pukul 10.",
    o: [["Curang sedikit", [{ t: "Pizza tengah malam memang nikmat, tapi tubuhmu terasa berat di latihan.", d: { h: -3, m: 3 } }]], ["Patuhi dietnya", [{ t: "Kamu terasa ringan di lapangan. Tapi bikin frustrasi!", d: { h: 4, m: -2, b: 1 } }]]] },
  { id: "pagi", cat: "LATIHAN", r: "BIASA", sc: ["training", "coach", "⏰"], t: "Sesi pagi tambahan", x: "Pelatih fisik membuka sesi ekstra jam enam pagi untuk siapa pun yang mau.",
    o: [["Tidur lebih lama", [{ t: "Kamu bangun segar, tapi pelatih mencatat siapa yang datang.", d: { h: 2, cr: -1 } }]], ["Ikut sesi pagi", [{ t: "Kakimu terbakar, tapi pelatih mengangguk puas.", d: { b: 2, h: -2, cr: 2 } }]]] },
  { id: "video", cat: "LATIHAN", r: "BIASA", sc: ["office", "coach", "📺"], t: "Analisis video", x: "Analis tim mengajakmu menonton ulang kesalahan-kesalahanmu di laga terakhir.",
    o: [["Lain kali saja", [{ t: "Kamu pulang lebih cepat. Kesalahan yang sama mungkin terulang.", d: { m: 1, cr: -1 } }]], ["Pelajari kesalahanku", [{ t: "Kamu melihat pola yang tak pernah kamu sadari.", d: { b: 1, m: 1, cr: 1 } }]]] },
  { id: "senior", cat: "LATIHAN", r: "PERUNGGU", sc: ["training", "mate", "⚽"], t: "Tips dari senior", x: "Kapten tim menawarkan diri mengajarimu tendangan bebas setelah latihan.",
    o: [["Pulang istirahat", [{ t: "Kapten mengangkat bahu dan berlatih sendirian.", d: { h: 1, s: -1 } }]], ["Belajar darinya", [{ t: "Satu jam penuh di depan tembok pagar. Kalian makin akrab.", d: { b: 1, s: 4 } }]]] },
  { id: "gym", cat: "LATIHAN", r: "BIASA", sc: ["gym", null, "🏋"], t: "Ruang gym", x: "Pelatih kebugaran bilang kamu perlu menambah kekuatan otot.",
    o: [["Fokus kelincahan", [{ t: "Latihan tangga dan cone. Langkahmu makin ringan.", d: { b: 1 } }]], ["Angkat beban berat", [{ p: 0.75, t: "Tubuhmu makin kokoh dalam duel.", d: { b: 2, h: 1 } }, { p: 0.25, t: "Punggungmu tertarik. Kamu harus istirahat beberapa hari.", d: { h: -6, inj: 5, injName: "Punggung tertarik" } }]]] },
  { id: "hujan", cat: "LATIHAN", r: "BIASA", sc: ["rain", "coach", "🌧"], t: "Latihan di bawah hujan", x: "Lapangan becek. Pelatih bilang boleh latihan di dalam ruangan.",
    o: [["Latihan di dalam", [{ t: "Latihan ringan di dalam. Badanmu tetap kering.", d: { h: 1 } }]], ["Tetap di luar", [{ p: 0.8, t: "Kamu terbiasa dengan lapangan berat. Pelatih terkesan.", d: { b: 1, h: -2, cr: 2 } }, { p: 0.2, t: "Kamu terpeleset dan pergelangan kakimu terkilir.", d: { h: -5, inj: 6, injName: "Pergelangan kaki terkilir" } }]]] },
  { id: "yoga", cat: "LATIHAN", r: "BIASA", sc: ["gym", "doctor", "🧘"], t: "Kelas yoga", x: "Fisioterapis menyarankan yoga untuk kelenturan dan pemulihan.",
    o: [["Tidak tertarik", [{ t: "Kamu memilih main gim di kamar.", d: { m: 1 } }]], ["Coba yoga", [{ t: "Ototmu lebih lentur, pikiranmu lebih tenang.", d: { h: 3, m: 2 } }]]] },
  { id: "flu", cat: "LATIHAN", r: "BIASA", sc: ["room", null, "🤒"], t: "Demam ringan", x: "Badanmu panas pagi ini. Latihan dimulai satu jam lagi.",
    o: [["Istirahat total", [{ t: "Sehari di kasur. Besok kamu kembali segar.", d: { h: 3, cr: -1 } }]], ["Paksakan latihan", [{ p: 0.6, t: "Kamu bertahan sampai sesi selesai. Pelatih menghargai semangatmu.", d: { h: -4, cr: 2 } }, { p: 0.4, t: "Demammu memburuk. Dokter memerintahkan istirahat.", d: { h: -8, inj: 5, injName: "Demam" } }]]] },
  { id: "pemandu", cat: "LATIHAN", r: "PERUNGGU", sc: ["rain", "scout", "📝"], t: "Pemandu bakat saat hujan", x: "Seorang pria mencatat di pinggir lapangan di tengah hujan deras. Rekan setimmu berbisik: dia pemandu bakat.",
    o: [["Main untuk tim", [{ t: "Kamu bermain sederhana dan membuat rekan setimmu bersinar.", d: { s: 3, cr: 1 } }]], ["Pamer skill", [{ p: 0.5, t: "Kamu melewati tiga orang. Si pria tersenyum dan menulis sesuatu.", d: { f: 4, s: -2, push: 1 } }, { p: 0.5, t: "Bola lepas dari kakimu. Rekan setim kesal.", d: { s: -3, m: -2 } }]]] },
  { id: "mentor", cat: "LATIHAN", r: "EMAS", sc: ["training", "veteran", "🤝"], t: "Mentor veteran", x: "Pemain senior paling dihormati di klub menawarkan diri menjadi mentormu.", cond: G => ageOn(userP(G).birth, G.date) <= 22,
    o: [["Aku bisa sendiri", [{ t: "Ia tersenyum tipis. \"Pintu selalu terbuka.\"", d: { m: 1 } }]], ["Jadikan mentor", [{ t: "Ia mengajarimu membaca permainan dan menjaga tubuh.", d: { b: 3, s: 4, m: 2 } }]]] },
  { id: "saingan", cat: "LATIHAN", r: "BIASA", sc: ["training", "mate", "🔥"], t: "Rekan satu posisi", x: "Rekan satu posisimu tampil gemilang di latihan pekan ini.",
    o: [["Bersaing sehat", [{ t: "Kalian saling mendorong. Latihan jadi lebih tajam.", d: { b: 1, s: 1 } }]], ["Minta jaminan ke pelatih", [{ t: "Pelatih tidak suka ditekan.", d: { cr: -3, m: 1 } }]]] },
  { id: "pantau", cat: "KARIER", r: "BIASA", sc: ["office", "coach", "📋"], t: "Pantau lawan demi tim", x: "Pelatih menawarkan tugas memantau calon lawan. Tugas ini memakan sebagian waktu latihanmu.",
    o: [["Terima tugas", [{ t: "Masukanmu membantu tim, tapi waktu mengasah teknikmu berkurang.", d: { cr: 3, s: 1, b: -1 } }]], ["Tetap latihan", [{ t: "Kamu fokus pada dirimu sendiri.", d: { b: 1 } }]]] },
  // PERTANDINGAN (suasana menjelang laga)
  { id: "provokasi", cat: "PERTANDINGAN", r: "PERUNGGU", sc: ["tunnel", "rival", "😤"], t: "Provokasi", x: "Di lorong, rivalmu berbisik: \"Malam ini aku bakal mempermalukanmu di depan keluargamu.\"",
    o: [["Abaikan", [{ t: "Kamu tetap tenang. Biar kaki yang bicara.", d: { m: 2 } }]], ["Balas omongannya", [{ t: "Kalian saling dorong sampai wasit melerai. Media menyorot kejadian itu.", d: { f: 2, m: 1, s: -1 } }]]] },
  { id: "freekick", cat: "PERTANDINGAN", r: "BIASA", sc: ["pitch", "mate", "⚽"], t: "Berbagi tendangan bebas", x: "Di laga uji coba internal, kamu menarik bola untuk tendangan bebas. Rekan setimmu minta kesempatan pertama kali.",
    o: [["Beri kesempatan", [{ t: "Dia tidak mencetak gol, tapi tidak akan lupa kebaikanmu.", d: { s: 4 } }]], ["Tendang sendiri", [{ p: 0.4, t: "Bola melengkung ke pojok atas. Indah!", d: { f: 2, m: 3 } }, { p: 0.6, t: "Bola melambung tinggi. Rekanmu menggeleng.", d: { s: -3, m: -1 } }]]] },
  { id: "lutut", cat: "PERTANDINGAN", r: "BIASA", sc: ["hospital", "doctor", "🩹"], t: "Sakit lutut", x: "Lututmu sakit menjelang laga besar. Dokter menyarankan istirahat.",
    o: [["Istirahat", [{ t: "Kamu menonton dari tribun. Lututmu berterima kasih.", d: { h: 5, m: -2, inj: 4, injName: "Istirahat lutut" } }]], ["Tetap main", [{ p: 0.65, t: "Lututmu bertahan. Kamu siap bertanding.", d: { m: 1, h: -2 } }, { p: 0.35, t: "Lututmu cedera saat pemanasan.", d: { h: -8, inj: 14, injName: "Cedera lutut" } }]]] },
  // KARIER
  { id: "sponsor", cat: "KARIER", r: "PERUNGGU", sc: ["office", "agent", "👟"], t: "Tawaran sponsor", x: "Merek sepatu lokal menawarkan kontrak promosi kecil.", cond: G => life(G).fame >= 20,
    o: [["Tolak, fokus main", [{ t: "Kamu tidak mau terganggu urusan iklan.", d: { m: 1 } }]], ["Terima", [{ t: "Wajahmu terpampang di poster toko olahraga.", d: G => ({ $: W(G) * 6, f: 3, m: -1 }) }]]] },
  { id: "agen", cat: "KARIER", r: "BIASA", sc: ["street", "agent", "📱"], t: "Telepon dari agen", x: "Agenmu ingin mulai menyebar namamu ke klub lain.", cond: G => !userP(G).contract?.youth,
    o: [["Belum perlu", [{ t: "Kamu ingin membuktikan diri di klub ini dulu.", d: { cr: 1 } }]], ["Silakan", [{ t: "Teleponnya mulai berdering. Klubmu mendengar kabar itu.", d: { push: 1, cr: -2, f: 1 } }]]] },
  { id: "amal", cat: "KARIER", r: "BIASA", sc: ["hospital", "kid", "🎁"], t: "Kunjungan amal", x: "Klub mengajak pemain menjenguk pasien anak di rumah sakit.",
    o: [["Ada urusan lain", [{ t: "Fotomu tidak ada di unggahan klub.", d: { f: -1 } }]], ["Ikut", [{ t: "Senyum mereka membuat harimu.", d: { f: 3, s: 2, m: 3 } }]]] },
  { id: "tv", cat: "KARIER", r: "BIASA", sc: ["press", "journalist", "🎙"], t: "Acara TV", x: "Kamu diundang ke acara bincang-bincang malam hari, dua hari sebelum laga.", cond: G => life(G).fame >= 18,
    o: [["Tolak", [{ t: "Kamu tidur lebih awal.", d: { h: 1 } }]], ["Datang", [{ t: "Penonton menyukai candaanmu. Tapi kamu pulang larut.", d: { f: 4, h: -2 } }]]] },
  { id: "gosip", cat: "KARIER", r: "PERUNGGU", sc: ["press", "journalist", "📰"], t: "Gosip transfer", x: "Media memberitakan klub besar mengincarmu. Wartawan menunggu komentarmu.", cond: G => interestedClubs(G).some(x => x.score >= 0.55),
    o: [["Tidak berkomentar", [{ t: "Kamu tersenyum dan berlalu.", d: { cr: 1 } }]], ["Beri kode tertarik", [{ t: "Beritanya meledak. Pelatihmu tidak senang.", d: { f: 3, cr: -3, push: 1 } }]]] },
  { id: "kapten", cat: "KARIER", r: "EMAS", sc: ["tunnel", "coach", "©"], t: "Ban kapten", x: "Pelatih U-19 ingin menjadikanmu kapten tim akademi.", cond: G => userP(G).squad === "Y" && ageOn(userP(G).birth, G.date) >= 17,
    o: [["Belum siap", [{ t: "Pelatih menghargai kejujuranmu.", d: { m: -1 } }]], ["Terima", [{ t: "Ban kapten melingkar di lenganmu.", d: { s: 4, f: 2, cr: 3 } }]]] },
  { id: "pelatih_tegur", cat: "KARIER", r: "BIASA", sc: ["office", "coach", "💢"], t: "Teguran pelatih", x: "Pelatih menilai sikapmu di latihan kurang serius.", cond: G => (G.user.coachRel || 0) < 0,
    o: [["Membela diri", [{ t: "Suasana makin tegang.", d: { cr: -3, m: 1 } }]], ["Minta maaf", [{ t: "Pelatih menepuk bahumu. \"Tunjukkan di lapangan.\"", d: { cr: 4, m: -1 } }]]] },
  { id: "timnas_scout", cat: "KARIER", r: "PERUNGGU", sc: ["pitch", "scout", "🏳"], t: "Pemantau timnas", x: "Staf pelatih timnas datang menonton latihan klubmu hari ini.", cond: G => ageOn(userP(G).birth, G.date) >= 16 && !userP(G).caps,
    o: [["Main biasa", [{ t: "Kamu bermain seperti biasa.", d: {} }]], ["Tampil habis-habisan", [{ p: 0.55, t: "Kamu jadi pemain paling menonjol di latihan.", d: { f: 3, nt: 1 } }, { p: 0.45, t: "Kamu kelelahan dan ototmu tegang.", d: { h: -4 } }]]] },
  // KEHIDUPAN PRIBADI
  { id: "dinding", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["room", "mate", "🖼"], t: "Dinding kamar", x: "Kamu sekamar di akademi. Teman sekamarmu ingin memenuhi dinding dengan foto-foto tim.", cond: G => userP(G).squad === "Y",
    o: [["Hias dindingnya", [{ t: "Kamar kalian jadi kamar paling ramai di asrama.", d: { s: 3, m: 1 } }]], ["Hadiahkan album", [{ t: "Dia terharu menerima album foto darimu.", d: G => ({ s: 2, m: 1, $: -Math.min(50, W(G)) }) }]]] },
  { id: "taman", cat: "KEHIDUPAN PRIBADI", r: "PERUNGGU", sc: ["park", "friend", "🌳"], t: "Bangku taman", x: "Kamu berpapasan dengan teman lama di taman. Dia mengajakmu jalan-jalan sebelum latihan.",
    o: [["Jalan-jalan", [{ t: "Kalian tertawa sepanjang sore. Kamu hampir telat latihan.", d: { m: 4, s: 2, cr: -1 } }]], ["Berangkat latihan", [{ t: "Dia mengerti. \"Lain kali, ya!\"", d: { b: 1, m: -1 } }]]] },
  { id: "ibu", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["home", "family", "📞"], t: "Telepon dari rumah", x: "Ibumu menelepon. Katanya keluarga rindu.",
    o: [["Telepon nanti", [{ t: "Kamu lupa menelepon balik.", d: { m: -2 } }]], ["Ngobrol lama", [{ t: "Suara ibumu membuatmu tenang.", d: { m: 4 } }]]] },
  { id: "libur", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["home", "family", "🏡"], t: "Libur dua hari", x: "Pelatih memberi libur dua hari.",
    o: [["Pulang kampung", [{ t: "Masakan rumah dan tidur nyenyak.", d: G => ({ m: 5, h: 2, $: -Math.min(150, W(G) * 0.5) }) }]], ["Latihan ringan di mes", [{ t: "Kamu menjaga ritme tubuhmu.", d: { b: 1, h: 1 } }]]] },
  { id: "medsos", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["room", null, "📱"], t: "Komentar pedas", x: "Seorang netizen menghina permainanmu di media sosial.",
    o: [["Balas komentarnya", [{ p: 0.5, t: "Balasanmu lucu dan viral. Orang memuji keberanianmu.", d: { f: 3, m: 1 } }, { p: 0.5, t: "Kamu jadi bahan olok-olok. Klub menegurmu.", d: { f: -2, m: -3, cr: -2 } }]], ["Matikan ponsel", [{ t: "Kamu tidur lebih tenang malam ini.", d: { m: 1, h: 1 } }]]] },
  { id: "pesta", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["party", "mate", "🎉"], t: "Undangan pesta", x: "Rekan setim mengajak pesta ulang tahun sampai larut malam.",
    o: [["Pulang lebih awal", [{ t: "Kamu pamit sebelum jam sepuluh.", d: { h: 1, s: -1 } }]], ["Ikut berpesta", [{ p: 0.7, t: "Malam yang seru. Kalian makin akrab.", d: { s: 5, h: -3 } }, { p: 0.3, t: "Foto pesta bocor ke media. Pelatih tidak senang.", d: { s: 3, f: -2, cr: -4, h: -3 } }]]] },
  { id: "mobil", cat: "KEHIDUPAN PRIBADI", r: "PERUNGGU", sc: ["street", "agent", "🏎"], t: "Mobil impian", x: "Dealer menawarkan mobil sport yang selalu kamu impikan.", cond: G => (G.user.money?.total || 0) > W(G) * 40,
    o: [["Tidak perlu", [{ t: "Kamu tetap naik mobil lama. Dompetmu tersenyum.", d: { m: -1 } }]], ["Beli", [{ t: "Kamu datang latihan dengan gaya. Semua kepala menoleh.", d: G => ({ $: -W(G) * 30, f: 2, m: 4, s: -1 }) }]]] },
  { id: "anak", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["park", "kid", "✍"], t: "Anak tetangga", x: "Seorang anak minta tanda tangan dan mengajakmu main bola di lapangan kampung.",
    o: [["Tanda tangan saja", [{ t: "Ia memeluk bukunya erat-erat.", d: { f: 1 } }]], ["Main bersama", [{ t: "Videonya beredar dan banyak yang tersentuh.", d: { f: 3, m: 3, h: -1 } }]]] },
  { id: "bahasa", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["office", "friend", "🗣"], t: "Kursus bahasa", x: "Klub menawarkan kursus bahasa lokal dua kali sepekan.", cond: G => !!G.user.adapt,
    o: [["Nanti saja", [{ t: "Kamu masih kesulitan memahami instruksi di latihan.", d: { s: -1 } }]], ["Ikut kursus", [{ t: "Kamu mulai bisa bercanda dengan rekan setim.", d: { s: 3, adapt: 40 } }]]] },
  { id: "investasi", cat: "KEHIDUPAN PRIBADI", r: "PERUNGGU", sc: ["cafe", "friend", "☕"], t: "Ajakan investasi", x: "Temanmu menawarkan investasi untuk membuka kafe.", cond: G => (G.user.money?.total || 0) > W(G) * 20,
    o: [["Tolak", [{ t: "Kamu memilih menabung.", d: {} }]], ["Investasi", [{ p: 0.5, t: "Kafenya laris! Kamu dapat bagi hasil.", d: G => ({ $: W(G) * 12, m: 2 }) }, { p: 0.5, t: "Kafenya tutup tiga bulan kemudian.", d: G => ({ $: -W(G) * 10, m: -3 }) }]]] },
  { id: "begadang", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["room", "mate", "🎮"], t: "Begadang main gim", x: "Turnamen gim online dengan teman-teman berlangsung sampai jam dua pagi.",
    o: [["Tidur", [{ t: "Kamu bangun segar.", d: { h: 2, s: -1 } }]], ["Satu ronde lagi", [{ t: "Kalian juara! Tapi matamu berat saat latihan.", d: { m: 3, s: 2, h: -3 } }]]] },
  { id: "fans", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["street", "fan", "📸"], t: "Fans di gerbang", x: "Sekelompok fans menunggumu di gerbang tempat latihan.", cond: G => life(G).fame >= 25,
    o: [["Langsung pulang", [{ t: "Beberapa fans kecewa.", d: { f: -2 } }]], ["Foto bersama", [{ t: "Kamu melayani semua permintaan foto.", d: { f: 3, s: 1 } }]]] },
  { id: "ujian", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["room", "family", "📚"], t: "Ujian sekolah", x: "Akademi juga mewajibkan sekolah. Pekan ini ada ujian.", cond: G => ageOn(userP(G).birth, G.date) <= 18,
    o: [["Belajar semalaman", [{ t: "Nilaimu bagus. Orang tuamu bangga.", d: { m: 2, h: -1 } }]], ["Fokus bola", [{ t: "Kamu lulus pas-pasan.", d: { b: 1, m: -2 } }]]] },
  { id: "kampung", cat: "KEHIDUPAN PRIBADI", r: "EMAS", sc: ["pitch", "kid", "🏟"], t: "Lapangan kampung halaman", x: "Lapangan tempatmu pertama kali bermain bola rusak berat.", cond: G => (G.user.money?.total || 0) > W(G) * 60,
    o: [["Tidak sekarang", [{ t: "Kamu berjanji membantu suatu hari nanti.", d: {} }]], ["Danai perbaikan", [{ t: "Namamu terpampang di gerbang lapangan baru.", d: G => ({ $: -W(G) * 25, f: 5, m: 5 }) }]]] },
  { id: "ultah", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["party", "family", "🎂"], t: "Ulang tahunmu", x: "Hari ini kamu berulang tahun.", cond: G => ymd(G.date).m === ymd(userP(G).birth).m,
    o: [["Makan malam keluarga", [{ t: "Malam yang hangat bersama keluarga.", d: { m: 4 } }]], ["Rayakan dengan tim", [{ t: "Kue dilempar ke wajahmu di ruang ganti.", d: G => ({ s: 4, m: 2, $: -Math.min(120, W(G) * 0.4) }) }]]] },
  { id: "sepatu", cat: "KEHIDUPAN PRIBADI", r: "BIASA", sc: ["room", null, "👟"], t: "Sepatu baru", x: "Sepatu barumu baru datang. Laga berikutnya tinggal beberapa hari.",
    o: [["Pakai yang lama", [{ t: "Sepatu lama, kaki tenang.", d: { m: 1 } }]], ["Langsung dipakai", [{ p: 0.6, t: "Nyaman sekali! Kamu merasa lebih cepat.", d: { m: 3 } }, { p: 0.4, t: "Kakimu lecet parah.", d: { h: -4 } }]]] },
];
const RARITY_W = { BIASA: 1, PERUNGGU: 0.55, EMAS: 0.2 };

export function drawLifeCard(G, rng) {
  const L = life(G);
  const pool = EVENTS.filter(e => (!e.cond || e.cond(G)) && !L.recent.includes(e.id));
  const e = rng.weighted(pool, x => RARITY_W[x.r] * (L.cards[x.id] ? 0.8 : 1.2));
  L.recent.push(e.id); if (L.recent.length > 10) L.recent.shift();
  return { type: "life", id: e.id };
}
const evById = id => EVENTS.find(e => e.id === id);
export { evById };
// option index 0 = left, 1 = right, "super" = the best outcome of the better option (costs one star)
export function chooseLife(G, rng, card, pick) {
  const e = evById(card.id), L = life(G);
  let opt, branch;
  const resolveD = br => (typeof br.d === "function" ? br.d(G) : br.d || {});
  const score = br => { const d = resolveD(br); return (d.b || 0) * 2 + (d.h || 0) + (d.m || 0) + (d.s || 0) + (d.f || 0) + (d.$ > 0 ? 2 : d.$ < 0 ? -1 : 0) + (d.inj ? -10 : 0) + (d.cr || 0); };
  if (pick === "super") {
    L.stars = Math.max(0, L.stars - 1);
    const all = e.o.flatMap((o, i) => o[1].map(b => [i, b]));
    [opt, branch] = all.sort((a, b) => score(b[1]) - score(a[1]))[0];
  } else {
    opt = pick;
    const brs = e.o[opt][1];
    branch = brs.length === 1 ? brs[0] : rng.weighted(brs, b => b.p);
  }
  const d = resolveD(branch);
  const delta = applyDeltas(G, rng, d);
  L.cards[e.id] = (L.cards[e.id] || 0) + 1;
  L.decisions++;
  return { type: "outcome", id: e.id, choice: e.o[opt][0], text: branch.t, delta, inj: d.inj ? (d.injName || "Cedera") : null, superUsed: pick === "super" };
}

// ---------- after a match: life stats, glory points, stars ----------
export function afterMatchLife(G, rng, summary, res, extra = {}) {
  const L = life(G), me = summary.user;
  if (!me) return null;
  const side = me.side, gf = res.score[side], ga = res.score[1 - side];
  const won = gf > ga, lost = gf < ga;
  const dec = (res.decisions || []);
  const good = dec.filter(x => x.verdict > 0).length;
  const d = { m: (won ? 2 : lost ? -2 : 0) + (me.rating >= 7.5 ? 2 : me.rating < 6.2 ? -2 : 0), f: (me.gls || 0) * 1.5 + (res.pom === userP(G).id ? 2 : 0) + (me.rating >= 8 ? 1 : 0) + (extra.big ? 1 : 0), h: me.min >= 60 ? -1.5 : 0, s: won ? 0.5 : 0 };
  const before = statsNow(G);
  const u = userP(G);
  u.morale = clamp((u.morale ?? 65) + d.m, 0, 100);
  L.fame = clamp(L.fame + d.f, 0, 100); L.health = clamp(L.health + d.h, 0, 100); L.social = clamp(L.social + d.s, 0, 100);
  syncLife(G);
  const after = statsNow(G), delta = {};
  for (const k of Object.keys(after)) { const v = after[k] - before[k]; if (Math.abs(v) >= 0.05 && k !== "money" && k !== "bakat") delta[k] = v; }
  // Jalan Kejayaan: season glory points, a star every 30
  if (L.glorySeason !== G.season) { L.glorySeason = G.season; L.glory = 0; L.tierPaid = 0; }
  const pts = (won ? 3 : lost ? 0 : 1) + (me.gls || 0) * 2 + (me.ast || 0) + good + (res.pom === u.id ? 3 : 0);
  L.glory += pts;
  let stars = 0;
  while (Math.floor(L.glory / 30) > L.tierPaid) { L.tierPaid++; L.stars++; stars++; }
  L.stars += good >= 2 ? 1 : 0; stars += good >= 2 ? 1 : 0;
  L.needLife = true;
  L.lastMatch = { date: G.date, score: [gf, ga], won, lost, rating: me.rating, gls: me.gls || 0, ast: me.ast || 0, min: me.min, good, moments: dec.length, delta, pts, stars, pom: res.pom === u.id };
  return L.lastMatch;
}

// ---------- monthly recap ----------
function recap(G, mk) {
  const L = life(G), y = Math.floor(mk / 12), m = (mk % 12) + 1;
  const games = (G.user.matchLog || []).filter(x => { const t = ymd(x.date); return t.y === y && t.m === m; });
  const w = games.filter(g => g.score[0] > g.score[1]).length, dr = games.filter(g => g.score[0] === g.score[1]).length, l = games.length - w - dr;
  const now = statsNow(G), snap = L.snap || now;
  const delta = {}; for (const k of Object.keys(now)) { const v = now[k] - snap[k]; if (Math.abs(v) >= 0.5) delta[k] = v; }
  const club = userClub(G), lid = club.league;
  let pos = null, of = null;
  try { const T = table(G, lid, club.zone ?? null); pos = T.findIndex(r => r.id === club.id) + 1; of = T.length; } catch {}
  L.snap = now;
  return { type: "recap", y, m, games: games.map(g => ({ opp: g.opp, score: g.score, rating: g.rating, gls: g.gls, comp: g.comp })), w, d: dr, l, gls: games.reduce((s, g) => s + (g.gls || 0), 0), avg: games.length ? games.reduce((s, g) => s + g.rating, 0) / games.length : null, pos: pos || null, of, league: G.leagues[lid]?.name, delta };
}

// ---------- moving time forward to the next card ----------
// Returns the card to show; the world advances day by day with automatic training.
export function nextCard(G) {
  const L = life(G);
  if (G.card) return G.card;
  if (G.user.retired) return (G.card = { type: "retired" });
  const rng = rngOf(G);
  const done = c => { G.rs = rng.s; G.card = c; return c; };
  const dec = G.inbox.find(m => m.kind === "decision" && !m.done);
  if (dec) return done({ type: "decision", mail: dec.id });
  if (G.pending) {
    if (["XI", "Cadangan"].includes(G.pending.role) || G.pending.kind === "timnas") return done({ type: "match" });
    G.rs = rng.s; playPending(G, false); return nextCard(G);
  }
  const mk = monthKey(G.date);
  if (mk !== L.month) { const c = recap(G, L.month); L.month = mk; if (c.games.length || Object.keys(c.delta).length) return done(c); }
  if (L.needLife) { L.needLife = false; if (rng.chance(0.8)) return done(drawLifeCard(G, rng)); }
  G.rs = rng.s;
  // advance up to a week (two in the off-season) until something needs the player
  const start = G.date, span = G.pending ? 0 : 7;
  for (let guard = 0; guard < 120; guard++) {
    const s = continueGame(G, Math.max(1, start + span - G.date));
    if (s === "training") { const r2 = rngOf(G); doTraining(G, r2, G.settings?.autoEffort || "Normal", false, true); G.rs = r2.s; continue; }
    if (s === "retired") return (G.card = { type: "retired" });
    if (s === "match" || s === "decision") return nextCard(G);
    if (monthKey(G.date) !== L.month) return nextCard(G);
    if (G.date - start >= span) break;
  }
  const r3 = rngOf(G); const c = drawLifeCard(G, r3); G.rs = r3.s;
  return (G.card = c);
}
export function clearCard(G) { G.card = null; }
export function decisionCard(G, card) { return G.inbox.find(m => m.id === card.mail); }
export function resolveDecisionCard(G, card, idx) {
  const rng = rngOf(G);
  const msg = resolveDecision(G, card.mail, idx, rng);
  G.rs = rng.s;
  return msg;
}
