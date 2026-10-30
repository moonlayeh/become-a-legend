// Media interviews after notable matches: a small press conference where the player answers
// journalists' questions. Answers move his morale, his standing with the coach and with the media.
import { RNG, clamp } from "./rng.js";
import { NATIONS, NAMES } from "./data.js";
import { userP, userClub, addMail, addNews } from "./world.js";
import { fullName } from "./player.js";
import { squadStatus, fed } from "./career.js";
import { interestedClubs } from "./contract.js";

// fictional outlets: Indonesian media for clubs in Indonesia, generic names elsewhere
const OUTLETS_ID = ["Warta Bola", "Gol Harian", "Tribun Sepak", "Sorot Olahraga", "Kabar Lapangan", "Radio Stadion 98,1", "Bola Kini", "Arena Sport TV", "Liga Insider", "Media Gawang", "Sepak Pojok", "Jurnal Tendang"];
const OUTLETS_INT = ["Football Daily", "Matchday Press", "Pitchside Radio", "The Touchline", "Goal Line TV", "Sport Weekly", "Club Insider", "Final Whistle", "Terrace Talk", "Kickoff Magazine", "Stadium FM", "Back Post"];
export const MOODS = ["Kecewa", "Netral", "Positif", "Senang"];
export const MOOD_COLOR = { Kecewa: "#e5484d", Netral: "#9a9a9a", Positif: "#a6d84f", Senang: "#6fd36b" };

function journalists(G, rng, nat, n) {
  const pool = NAMES[NATIONS[nat]?.lang] || Object.values(NAMES)[0];
  const outs = rng.shuffle((nat === "IDN" ? OUTLETS_ID : OUTLETS_INT).slice());
  return Array.from({ length: n }, (_, i) => ({ name: `${rng.pick(pool.first)} ${rng.pick(pool.last)}`, outlet: outs[i % outs.length], mood: rng.pick([1, 2, 2, 3]) }));
}

// question bank: each has three answer tones with their effects
// e: { mor: morale, coach: relation with the manager, media: standing with the press, fans, push: agent push for a move }
function questionBank(G, ctx) {
  const u = userP(G), club = userClub(G), Q = [];
  const opp = ctx.opp, res = ctx.won ? "kemenangan" : ctx.lost ? "kekalahan" : "hasil imbang";
  if (ctx.gls >= 2) Q.push({ q: `${ctx.gls} gol hari ini. Apakah ini penampilan terbaikmu sejauh ini?`, pos: ["Gol-gol ini untuk rekan setim dan suporter. Tanpa mereka aku bukan apa-apa.", "Aku senang, tapi aku tahu masih bisa lebih baik lagi."], neu: ["Yang penting tim mendapat hasil. Gol itu bonus."], neg: ["Aku memang pantas dapat menit lebih banyak. Ini buktinya.", "Kalian baru sadar sekarang? Aku sudah bilang dari dulu."], e: { pos: { media: 2, fans: 2, mor: 2 }, neu: { media: 1 }, neg: { coach: -3, media: -1, mor: 1 } } });
  else if (ctx.gls === 1) Q.push({ q: `Golmu ke gawang ${opp} menentukan hasil laga. Bagaimana rasanya?`, pos: ["Rasanya luar biasa. Aku sudah lama menunggu momen ini.", "Aku senang bisa membantu tim lewat gol itu."], neu: ["Itu bagian dari pekerjaanku. Besok kita latihan lagi."], neg: ["Aku tidak terlalu peduli siapa yang mencetak gol."], e: { pos: { media: 2, mor: 2, fans: 1 }, neu: { media: 1 }, neg: { media: -2 } } });
  if (ctx.pom) Q.push({ q: "Kamu terpilih sebagai pemain terbaik pertandingan. Apa kuncinya?", pos: ["Persiapan di latihan sepanjang pekan. Pelatih memberi instruksi yang jelas.", "Kepercayaan dari pelatih dan rekan setim."], neu: ["Hari ini semuanya berjalan lancar saja."], neg: ["Aku cuma melakukan apa yang orang lain tidak bisa."], e: { pos: { coach: 3, media: 2 }, neu: { media: 1 }, neg: { coach: -2, media: -2, mor: 1 } } });
  if (ctx.rc) Q.push({ q: "Kartu merahmu membuat tim kesulitan. Apa yang terjadi?", pos: ["Aku minta maaf kepada rekan setim dan suporter. Aku akan belajar dari ini."], neu: ["Aku perlu melihat tayangan ulangnya dulu sebelum berkomentar."], neg: ["Keputusan wasit itu konyol. Itu bahkan bukan pelanggaran.", "Kalian lihat sendiri, lawan sengaja memprovokasi."], e: { pos: { coach: 3, media: 2, mor: -1 }, neu: {}, neg: { coach: -2, media: -2, ban: 1 } } });
  if (ctx.debut) Q.push({ q: `Ini debutmu untuk ${club.name}. Apa yang kamu rasakan?`, pos: ["Mimpi yang jadi nyata. Terima kasih kepada pelatih atas kepercayaannya.", "Aku bangga. Ini baru awal."], neu: ["Agak gugup di awal, tapi aku menikmatinya."], neg: ["Seharusnya ini terjadi lebih cepat."], e: { pos: { coach: 3, media: 2, mor: 3 }, neu: { mor: 1 }, neg: { coach: -3, media: -1 } } });
  Q.push({ q: `Bagaimana penilaianmu tentang ${res} melawan ${opp}?`, pos: ctx.won ? ["Tim bermain sangat disiplin. Semua orang pantas mendapat pujian."] : ["Kami kecewa, tapi kami tahu apa yang harus diperbaiki."], neu: ["Kami akan menganalisisnya bersama staf pelatih."], neg: ctx.won ? ["Kami menang meski main jelek. Tidak banyak yang bisa dibanggakan."] : ["Ada beberapa pemain yang tidak menjalankan tugasnya hari ini."], e: { pos: { coach: 2, media: 1 }, neu: {}, neg: { coach: -2, mates: -3, media: 1 } } });
  if (ctx.sub || squadStatus(G) === "Pemain Cadangan") Q.push({ q: "Kamu lebih sering memulai dari bangku cadangan. Apakah kamu kecewa?", pos: ["Aku menghormati keputusan pelatih. Tugasku membuktikan diri di latihan."], neu: ["Semua pemain ingin bermain. Aku akan terus bekerja."], neg: ["Jujur saja, aku merasa pantas jadi starter.", "Aku tidak mengerti keputusan pelatih."], e: { pos: { coach: 4, media: 1 }, neu: { coach: 1 }, neg: { coach: -5, media: 1, push: 1 } } });
  const ints = interestedClubs(G).filter(x => x.score >= 0.55);
  if (ints.length && !u.contract?.youth) { const c = G.clubs[ints[0].id]; Q.push({ q: `Ada kabar ${c.name} memantaumu. Apakah kamu tertarik pindah?`, pos: [`Aku fokus sepenuhnya pada ${club.name}. Aku bahagia di sini.`], neu: ["Itu urusan agenku. Aku hanya memikirkan laga berikutnya."], neg: [`${c.name} klub besar. Siapa yang tidak tertarik?`, "Kita lihat saja nanti. Di sepak bola semuanya mungkin."], e: { pos: { coach: 3, fans: 2 }, neu: {}, neg: { coach: -4, fans: -3, push: 1 } } }); }
  if (u.caps || ctx.ntPossible) Q.push({ q: `Apakah kamu berharap dipanggil timnas ${NATIONS[fed(G)].name}?`, pos: ["Membela negara adalah impian. Aku akan terus bekerja keras agar pantas."], neu: ["Itu keputusan pelatih timnas. Aku fokus pada klub."], neg: ["Kalau melihat performaku, aku seharusnya sudah dipanggil."], e: { pos: { media: 2, nt: 1 }, neu: {}, neg: { media: -1, nt: -1 } } });
  Q.push({ q: "Apa target pribadimu musim ini?", pos: ["Membantu tim sebanyak mungkin dan terus berkembang.", "Menang bersama tim. Target pribadi datang belakangan."], neu: ["Bermain sebanyak mungkin dan tetap bebas cedera."], neg: [`Aku ingin jadi pemain terbaik di ${G.leagues[club.league]?.name || "liga ini"}, tidak kurang.`], e: { pos: { coach: 1, media: 1 }, neu: {}, neg: { media: 2, mates: -2, mor: 1 } } });
  return Q;
}

// called after a club match the user played in
export function maybePress(G, rng, ctx) {
  if (G.press && !G.press.done) { if (G.date - G.press.date < 3) return; G.press.done = true; }
  const notable = ctx.pom || ctx.gls >= 1 || ctx.rc || ctx.debut || ctx.final;
  if (!notable && !(ctx.start && rng.chance(0.1))) return;
  if (!notable && G.user.lastPress && G.date - G.user.lastPress < 21) return;
  const club = userClub(G);
  const r = new RNG(rng.int(1, 2 ** 30));
  const n = club.level >= 140 ? 12 : club.level >= 110 ? 9 : 6;
  const js = journalists(G, r, club.nation, n);
  const bank = questionBank(G, ctx);
  const keep = [];
  for (const q of bank) if (keep.length < 4 && (keep.length < 2 || r.chance(0.7))) keep.push(q);
  G.user.lastPress = G.date;
  G.press = {
    id: (G.pressId = (G.pressId || 0) + 1), date: G.date, title: ctx.pom ? "Pemain terbaik pertandingan" : ctx.gls ? "Pencetak gol" : ctx.debut ? "Debut" : ctx.rc ? "Kartu merah" : "Wawancara",
    opp: ctx.opp, journalists: js, questions: keep.map((q, i) => ({ ...q, j: r.int(0, js.length - 1) })), idx: 0, log: [], done: false, officer: (() => { const pool = NAMES[NATIONS[club.nation]?.lang] || Object.values(NAMES)[0]; return `${r.pick(pool.first)} ${r.pick(pool.last)}`; })(),
  };
  addMail(G, "Permintaan wawancara media", `Petugas pers klub meminta kamu hadir di ruang konferensi pers setelah laga melawan ${ctx.opp}. Ada ${n} wartawan yang menunggu dengan ${keep.length} pertanyaan.`, "decision", {
    options: [{ label: "Hadiri konferensi pers", detail: "Jawab pertanyaan wartawan.", act: "openPress", data: { press: G.press.id } }, { label: "Tolak wawancara", detail: "Media sedikit kecewa.", act: "skipPress", data: { press: G.press.id } }],
    tag: "media", done: false, cat: "Pribadi", from: G.press.officer,
  });
}

const mediaWord = v => (v >= 30 ? "Sangat disukai media" : v >= 10 ? "Disukai media" : v <= -25 ? "Dimusuhi media" : v <= -8 ? "Kurang disukai media" : "Biasa saja");
export { mediaWord };

export function answerPress(G, tone, text) {
  const P = G.press; if (!P || P.done) return null;
  const q = P.questions[P.idx], u = userP(G), e = q.e[tone] || {};
  const j = P.journalists[q.j];
  P.log.push({ q: q.q, j: q.j, tone, text });
  G.user.media = clamp((G.user.media || 0) + (e.media || 0) * 3, -100, 100);
  G.user.fans = clamp((G.user.fans || 0) + (e.fans || 0) * 3, -100, 100);
  G.user.coachRel = (G.user.coachRel || 0) + (e.coach || 0) * 2;
  u.morale = clamp((u.morale ?? 65) + (e.mor || 0) * 2, 0, 100);
  if (e.mates) for (const id of Object.keys(G.user.rel || {})) G.user.rel[id] = clamp(G.user.rel[id] + e.mates, -50, 50);
  if (e.push) G.user.agentPush = true;
  if (e.nt) G.user.ntBuzz = (G.user.ntBuzz || 0) + e.nt;
  const d = tone === "pos" ? 1 : tone === "neg" ? (e.media > 0 ? 1 : -1) : 0;
  j.mood = clamp(j.mood + d, 0, 3);
  for (const o of P.journalists) if (o !== j && d) o.mood = clamp(o.mood + (Math.random() < 0.25 ? d : 0), 0, 3);
  P.idx++;
  if (P.idx >= P.questions.length) finishPress(G, false);
  return e;
}
export function finishPress(G, early) {
  const P = G.press; if (!P || P.done) return;
  P.done = true;
  if (early) { G.user.media = clamp((G.user.media || 0) - 4, -100, 100); for (const j of P.journalists) j.mood = clamp(j.mood - 1, 0, 3); }
  const u = userP(G);
  // the headline picks the boldest answer
  const pick = P.log.find(l => l.tone === "neg") || P.log.find(l => l.tone === "pos") || P.log[0];
  if (pick) addNews(G, { title: `${fullName(u)}: "${pick.text.replace(/\.$/, "")}"`, body: `Usai laga melawan ${P.opp}, ${fullName(u)} berbicara kepada ${P.journalists[pick.j].outlet}. "${pick.text}"${early ? " Ia kemudian meninggalkan ruang konferensi pers lebih awal." : ""}`, tag: "Media", scope: "me", club: u.club });
  const m = G.inbox.find(x => x.options?.some(o => o.data?.press === P.id));
  if (m) { m.done = true; m.read = true; m.result = early ? "Kamu meninggalkan konferensi pers lebih awal." : "Konferensi pers selesai."; }
}
export const pressMood = P => { const a = P.journalists.reduce((s, j) => s + j.mood, 0) / P.journalists.length; return MOODS[Math.round(a)]; };
