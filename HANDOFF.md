# Serah terima proyek: Become a Legend

Catatan untuk developer atau agen AI (misalnya Antigravity) yang melanjutkan proyek ini.

## Ringkasan
Gim karier sepak bola offline untuk Android (pemain, bukan manajer), gaya Football Manager + mode kartu.
Semua kode adalah JavaScript murni (ES module, tanpa framework, tanpa bundler) di `www/`, dibungkus
Capacitor 8 menjadi APK. Tidak ada server; save di IndexedDB (gzip).

## Menjalankan
- Uji di browser: `cd www && python3 -m http.server 8765`, buka http://localhost:8765 (ukuran layar ponsel, ±400 px).
- Uji logika: `node test/season-test.mjs` (satu musim penuh), `node test/match-test.mjs` (kalibrasi mesin laga),
  `node test/moment-test.mjs` (momen kunci), `node test/card-test.mjs` (mode kartu).
- APK: setiap push ke `main` menjalankan GitHub Actions (`.github/workflows`) yang membuat rilis `build-N`
  berisi APK debug. Unduh dari tab Releases.

## Peta kode (`www/js`)
| Berkas | Isi |
|---|---|
| `world.js` | dunia: klub, pemain, jadwal, klasemen, perkembangan pemain, skorsing |
| `sim.js` | jam gim (`continueGame`, `processDay`), laga pengguna (`playPending`, `startLiveMatch`/`stepLive`/`endLiveMatch`), musim baru |
| `match.js` | mesin laga berbasis aksi (generator `matchGen`, momen kunci interaktif, instruksi tim `mentality`) |
| `cards.js` | mode kartu: 5 statistik hidup, 39 kartu kehidupan (`EVENTS`), `nextCard`, rekap bulanan, Jalan Kejayaan |
| `career.js`, `contract.js`, `press.js` | karier pengguna, kontrak/negosiasi/agen, konferensi pers |
| `comps.js`, `compdata.js`, `intl.js`, `clubs.js`, `nations.js` | kompetisi, timnas, data 2026/27 |
| `viewer.js` | pemutar laga 2D (canvas) |
| `ui/shell.js` | navigasi, top bar, navigasi bawah mode kartu, `SECTIONS` |
| `ui/kartu.js` | layar mode kartu: beranda majalah, kartu, hasil laga, koleksi, trofi, gambar kartu SVG |
| `ui/match.js` | layar laga (persiapan, live, hasil) |
| `ui/core.js` | util UI, avatar kartun SVG, format uang |
| lainnya di `ui/` | menu FM: profil pemain, klub, kompetisi, portal, pembuatan karier |

Layar didaftarkan dengan `register(section, tab, (G, root, params) => ...)` dan dibuka dengan `go(section, tab, params)`.
State seluruh gim ada di satu objek `G` (disimpan dengan `save()`).

## Ide paling berdampak untuk visual
1. **Ilustrasi kartu**: taruh gambar `www/img/cards/<id>.webp` (rasio 300:220). Kalau ada, gambar itu otomatis
   menggantikan gambar SVG bawaan. Id kartu ada di `EVENTS` di `cards.js`.
2. Animasi transisi kartu, efek partikel/kilau untuk kartu Emas, suara.
3. Ilustrasi untuk momen kunci laga (`momentCardHtml` di `ui/kartu.js`) dan beranda (`main/beranda`).

## Aturan yang sebaiknya dijaga
- Offline penuh, tanpa energi dan tanpa iklan.
- Bahasa Indonesia untuk semua teks.
- Jangan pakai nama, logo, atau aset gim lain (misalnya "The GOAT").
- Jalankan keempat uji di atas sebelum push ke `main`.
