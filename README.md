# Become a Legend (offline)

Game karier pemain sepak bola offline untuk Android. Semuanya dijalankan mesin aturan di dalam HP, tanpa internet dan tanpa AI:

- **Dunia**: 25 liga di 19 negara dengan komposisi klub 2026/27 (liga kalender: 2026), termasuk divisi 2 Inggris, Spanyol, Italia, Jerman, Prancis, dan Indonesia dengan promosi/degradasi. Semua pemain, staf, dan nama dibuat acak (fiktif).
- **Kompetisi**: 19 piala domestik; Liga Champions, Liga Europa, Liga Konferensi (fase liga 36 tim, peserta resmi 2026/27); AFC Champions League Elite/Two; Libertadores; CAF Champions League; UEFA Youth League dan Libertadores Sub-20 untuk pemain akademi; UEFA Nations League A/B; Piala AFF 2026 dengan grup resmi.
- **Pemain**: atribut 1–20 (Teknik, Mental, Fisik, Kiper), kemampuan dan potensi tersembunyi (CA/PA 1–200), kepribadian, posisi, kondisi, moral, dan cedera.
- **Perkembangan**: dipengaruhi usia, potensi, profesionalisme, menit bermain, kualitas akademi, fokus dan intensitas latihan. Atribut fisik menurun setelah sekitar usia 29.
- **Laga 2D**: setiap aksi (umpan, dribel, tekel, umpan silang, tembakan) dihitung dari atribut, lalu diputar di papan 2D. Ada mode sorotan dan kecepatan ×10, ×25, dan ×60. Saat menonton, laga berhenti di momen kunci (bola di kakimu di area berbahaya, atau duel satu lawan satu saat bertahan) dan kamu memilih tembak, umpan pendek, umpan terobosan, umpan silang, giring bola, tekel berdiri, tekel sliding, atau jaga jarak. Pilihan dinilai (tepat/netral/berisiko), memengaruhi peluang berhasil, jalannya laga, dan rating. Frekuensi dan batas waktu memilih bisa diatur.
- **Karier**: akademi U-19, promosi ke tim utama, kontrak, tawaran transfer, peminjaman, dan bicara dengan pelatih. Ada juga timnas U-17, U-19, U-21, dan senior (kualifikasi, Piala AFF/Asia/Eropa/Dunia), penghargaan musiman, Bola Emas, dan Hall of Fame.
- **Aturan nyata**: larangan FIFA untuk transfer internasional di bawah 18 tahun (dengan pengecualian UE/EEE usia 16–17), jendela transfer, akumulasi kartu dan skorsing, serta kebijakan pemain Basque di Athletic Club.
- **Menu bergaya FM**: Pribadi, Kontrak, Transfer, Pengembangan (efektivitas taktik), Performa (statistik, kondisi, jam terbang, rating laga, laporan pelatih), Karier (ringkasan dan linimasa), Perbandingan (radar, atribut, statistik, posisi, laporan), negosiasi kontrak, konferensi pers setelah laga penting (jawaban positif/netral/negatif memengaruhi suasana hati, hubungan dengan pelatih, dan citra di media), statistik karier keseluruhan, Kontak, profil staf, Database Pemain, dan halaman Tim Nasional.
- **Wajah kartun**: potret 2D bergaya kartun cel-shading (garis tebal, bayangan tegas), dengan pilihan kulit, rambut, jenggot/kumis, dan kacamata.
- **Mode Normal dan Keras**.

Penyederhanaan: beberapa tanggal kompetisi bersifat perkiraan; liga tanpa divisi bawah yang disimulasikan tidak punya degradasi.

## Membuat APK

Setiap kali kode di-push ke branch `main`, GitHub Actions membangun APK otomatis:

1. Buka tab **Actions** di repo dan tunggu workflow **Build APK** selesai (sekitar 5–8 menit).
2. Buka tab **Releases**, lalu unduh `become-a-legend-<nomor>.apk` dari HP.
3. Pasang APK-nya. Android akan meminta izin "Instal aplikasi tidak dikenal" untuk browser atau pengelola file; izinkan sekali saja.

Save tersimpan di HP (IndexedDB) dan tidak hilang saat APK diperbarui, asalkan aplikasinya tidak di-uninstall.

## Menjalankan di komputer

```
cd www && python3 -m http.server 8000
```
Lalu buka http://localhost:8000.

## Struktur

- `www/js/data.js`: kumpulan nama; `nations.js`: semua negara dan bahasa; `regions.js`: provinsi dan kabupaten/kota Indonesia
- `www/js/clubs.js`: liga, klub 2026/27, klub luar untuk kompetisi antarklub; `compdata.js`: definisi piala dan kompetisi antarklub
- `www/js/comps.js`: mesin kompetisi (fase liga, grup, gugur, play-off liga, promosi/degradasi)
- `www/js/attributes.js`, `player.js`: atribut, CA, pembuatan pemain
- `www/js/match.js`: mesin laga; `viewer.js`: papan 2D
- `www/js/world.js`, `sim.js`: dunia, jadwal, kalender, perkembangan
- `www/js/career.js`, `intl.js`: karier, kontrak, transfer, timnas, penghargaan
- `www/js/meta.js`: data turunan untuk tampilan (peran, reputasi, jadwal latihan, staf, kategori pesan)
- `www/js/ui/`: tampilan bergaya FM untuk HP tegak: `shell.js` (bilah atas, menu, Memproses), `portal.js`, `player.js` (profil, latihan, medis), `club.js` (skuad, klub, liga), `comps.js` (piala, antarklub, Nations League, bagan), `match.js` (persiapan, laga 2D dengan momen kunci, hasil), `create.js` (menu utama, pembuatan pemain), `people.js` (Pribadi, Kontrak, negosiasi, obrolan), `extra.js` (Kontak, staf, Database Pemain, timnas, Transfer, Pengembangan, Performa, Perbandingan)
- `test/`: uji kalibrasi laga, momen kunci (`moment-test.mjs`), dan simulasi beberapa musim

## Sumber data

- Wilayah Indonesia: [idn-area-data](https://www.npmjs.com/package/idn-area-data) v4.0.1 (berbasis Kepmendagri), lisensi [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/).
- Nama negara: [i18n-iso-countries](https://www.npmjs.com/package/i18n-iso-countries) (lokal Indonesia).
- Komposisi liga dan peserta kompetisi: artikel musim 2026–27/2026 di Wikipedia, situs resmi UEFA, CAF, liga, dan media olahraga (lihat riwayat commit).
