# Become a Legend (offline)

Game karier pemain sepak bola offline untuk Android. Semuanya dijalankan mesin aturan di dalam HP, tanpa internet dan tanpa AI:

- **Dunia**: 6 liga dengan klub asli (Premier League, LaLiga, Serie A, Bundesliga, Ligue 1, Super League Indonesia). Semua pemain, staf, dan nama dibuat acak (fiktif).
- **Pemain**: atribut 1–20 (Teknik, Mental, Fisik, Kiper), kemampuan dan potensi tersembunyi (CA/PA 1–200), kepribadian, posisi, kondisi, moral, dan cedera.
- **Perkembangan**: dipengaruhi usia, potensi, profesionalisme, menit bermain, kualitas akademi, fokus dan intensitas latihan. Atribut fisik menurun setelah sekitar usia 29.
- **Laga 2D**: setiap aksi (umpan, dribel, tekel, umpan silang, tembakan) dihitung dari atribut, lalu diputar di papan 2D. Ada mode sorotan dan kecepatan ×10, ×25, dan ×60.
- **Karier**: akademi U-19, promosi ke tim utama, kontrak, tawaran transfer, peminjaman, dan bicara dengan pelatih. Ada juga timnas U-17, U-19, U-21, dan senior (kualifikasi, Piala AFF/Asia/Eropa/Dunia), penghargaan musiman, Bola Emas, dan Hall of Fame.
- **Aturan nyata**: larangan FIFA untuk transfer internasional di bawah 18 tahun (dengan pengecualian UE/EEE usia 16–17), jendela transfer, akumulasi kartu dan skorsing, serta kebijakan pemain Basque di Athletic Club.
- **Mode Normal dan Keras**.

Belum ada: degradasi/promosi, piala domestik, kompetisi antarklub Eropa/Asia, dan pindah federasi timnas.

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

- `www/js/data.js`: negara, liga, klub, kumpulan nama
- `www/js/attributes.js`, `player.js`: atribut, CA, pembuatan pemain
- `www/js/match.js`: mesin laga; `viewer.js`: papan 2D
- `www/js/world.js`, `sim.js`: dunia, jadwal, kalender, perkembangan
- `www/js/career.js`, `intl.js`: karier, kontrak, transfer, timnas, penghargaan
- `www/js/meta.js`: data turunan untuk tampilan (peran, reputasi, jadwal latihan, staf, kategori pesan)
- `www/js/ui/`: tampilan bergaya FM untuk HP tegak: `shell.js` (bilah atas, menu, Memproses), `portal.js`, `player.js` (profil, latihan, medis), `club.js` (skuad, klub, kompetisi), `match.js` (persiapan, laga 2D, hasil), `create.js` (menu utama, pembuatan pemain)
- `test/`: uji kalibrasi laga dan simulasi beberapa musim
