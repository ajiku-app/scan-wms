# WMS Scan — Gudang FG (Capacitor: Android APK/AAB & iOS)

Aplikasi scan gudang berbasis Supabase, dibungkus **Capacitor** menjadi aplikasi native.

```
www/        Aplikasi web (HTML/JS/CSS) — sumber tunggal untuk Android & iOS
docs/query-laporan.sql   Query laporan (hanya SELECT). SQL backend resmi HANYA di repo WMS (backend/)
assets/     Ikon & splash sumber (dibuat otomatis jadi semua ukuran Android/iOS)
scripts/    Patch otomatis (izin kamera, versi, signing)
.github/    Workflow build Android (APK+AAB) & iOS
docs/       README lama (versi PWA)
```

App ID: `app.ajiku.scanwms` (ubah di `capacitor.config.json` **sebelum** rilis pertama ke Play Store — tidak bisa diganti setelahnya).

## 1) Kirim ke GitHub
```bash
cd scan-wms
bash push.sh        # push ke https://github.com/ajiku-app/scan-wms.git
```
Perlu login GitHub (SSH / `gh auth login` / Personal Access Token).

## 2) Build Android otomatis (GitHub Actions)
Setiap push ke `main` menjalankan **Actions → Build Android**:
- **Debug APK** selalu dibuat → bisa langsung diinstal di HP untuk tes (`WMS-FG-debug.apk`).
- **Release APK + AAB bertanda tangan** dibuat jika secrets keystore diisi (untuk Play Store).

Buat keystore (sekali saja, **simpan file & password dengan aman — hilang = tidak bisa update app di Play Store**):
```bash
keytool -genkeypair -v -keystore release.keystore -alias wmsfg -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore > keystore.base64     # macOS: base64 -i release.keystore | tr -d '\n' > keystore.base64
```
Isi di GitHub → Settings → Secrets and variables → Actions:
`ANDROID_KEYSTORE_BASE64` (isi keystore.base64), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (wmsfg), `ANDROID_KEY_PASSWORD`.

Hasil: tab Actions → run terbaru → **Artifacts → android-build**. Beri tag `v1.0.0` untuk melampirkannya ke GitHub Release.
Upload file `.aab` ke Google Play Console.

## 3) Build lokal (opsional)
Butuh Node 22+, JDK 21, Android Studio.
```bash
npm install
npm run setup:android     # sekali: buat folder android/ + izin + ikon
npm run android           # sync + buka Android Studio → Run / Build > Generate Signed Bundle
```
iOS (hanya di Mac dengan Xcode): `npm run setup:ios` lalu `npm run ios`.

## iPhone tanpa Apple Developer (versi web / PWA, gratis)
Workflow `Deploy web` menyajikan folder `www/` lewat GitHub Pages (HTTPS). Sekali saja: GitHub → Settings → Pages → *Build and deployment* → Source: **GitHub Actions**.
Lalu buka `https://ajiku-app.github.io/scan-wms/` di **Safari** iPhone → tombol Bagikan → **Tambah ke Layar Utama**. (GitHub Pages butuh repo publik pada paket gratis.)

## iOS
Workflow `Build iOS` hanya memastikan project **berhasil dikompilasi** (tanpa signing). IPA untuk iPhone/TestFlight/App Store
wajib **Apple Developer Program** (US$99/tahun) dan signing — paling mudah lewat Xcode di Mac: *Product → Archive → Distribute*.

## Perubahan dari versi web
- Service worker & banner "Pasang ke layar utama" dimatikan di aplikasi native.
- Tombol Back Android: kembali ke Beranda / tutup sheet, keluar app dari Beranda.
- ZXing (scanner iOS/WebView) dimuat lokal (`www/vendor/zxing.min.js`, dibuat `npm run vendor`) → scan jalan offline.
- Layar terkunci penuh seperti app native: header, kartu menu, dan bottom-nav diam; layar tidak bisa digeser/ditarik/di-zoom. Hanya kotak daftar (dokumen, stok/riwayat, panel Scan) yang scroll di dalam kotaknya sendiri bila isinya panjang.
- Dioptimalkan untuk iPhone 15 Pro & Samsung 6,7": area aman (notch/Dynamic Island/gesture bar) lewat variabel Capacitor SystemBars, ukuran kamera/kartu menyesuaikan tinggi layar, orientasi dikunci portrait.
- Izin kamera & getar ditambahkan otomatis ke AndroidManifest / Info.plist.

> `www/config.js` berisi Supabase **anon key** (publik by design; data dijaga RLS). Jangan pernah memasukkan service_role key.

## Perubahan v1.0.2 (sinkronisasi dengan WMS v2.0.13)
- Terima barang tidak bisa melebihi Jumlah PL (tidak ada lagi tombol "Lanjut?" yang ditolak server).
- Setelah server menolak transaksi, tampilan lokal otomatis disinkronkan ulang (rollback) dan alasan penolakan tetap ditampilkan.
- Stok yang di-hold ditampilkan dan tidak bisa dipindah/putaway; sinkron memuat `stock_holds`.
- Kode rak: zona 1–3 huruf, serta `GR-STAGING` dan `NON-RACK` dikenali saat scan.
- Label batch dari tampilan WMS (`PREFIX.YYYYMMDD.NNN`) diterima di input manual.
- Tanggal/sisa hari memakai WIB (sama dengan server). Stok & rak dibaca per halaman (tidak terpotong 1000 baris).
- Penyegaran otomatis tiap 90 detik di Beranda (saat online dan antrian kosong).
- DO yang pesanannya belum terpenuhi penuh tidak otomatis selesai; ditolak server, admin/supervisor menyelesaikan sebagian dari WMS.

> **Wajib:** jalankan `migrate_v2_0_13_sinkron.sql` (repo WMS, folder `backend/`) di Supabase sebelum memakai versi ini.

## Kirim ke GitHub & rilis otomatis

```bash
bash rilis.sh "pesan commit"          # commit + push ke main -> web (Vercel) ter-update otomatis
bash rilis.sh 1.0.2 "pesan commit"    # + tag v1.0.2 -> APK/AAB dilampirkan ke GitHub Release
```
`ci.yml` memeriksa sintaks JS dan kecocokan tag dengan `package.json`.
Catatan: versi web/PWA ter-update otomatis; aplikasi Android (APK) membawa isi `www/` di dalamnya,
jadi HP perlu memasang APK baru dari Releases untuk mendapat perubahan.

## Perubahan v1.0.4 (sinkronisasi dengan WMS v2.0.17)
- Inbound selalu masuk **GR-STAGING** (input rak di Terima barang dihapus); penempatan ke rak lewat Pindah/Putaway.
- Pindah/putaway **per pallet utuh**; pallet yang di-hold tidak bisa dipindah. Pemilih rak memakai **kapasitas pallet per bin** (Penuh = jumlah pallet mencapai kapasitas).
- **FREEZE opname**: spanduk di Beranda, tombol terima/ambil/pindah ditolak; transaksi yang sudah antri **ditahan** (tidak dibuang) dan terkirim otomatis setelah Unfreeze.
- Antrian kirim dicoba ulang tiap 30 detik saat online.

> **Wajib:** jalankan `migrate_v2_0_17_pallet_freeze_staging.sql` (repo WMS) sebelum memakai versi ini; pasang APK baru di semua HP.

## Realtime (v1.0.3)
Perubahan dari WMS (dokumen, stok, rak, hold) masuk ke Scan tanpa menekan Sync. Prasyarat: jalankan
`backend/migrate_v2_0_14_realtime_scan.sql` (repo WMS) di Supabase SQL Editor. Chip status menampilkan
"Online · live" saat tersambung. Bila WebSocket putus, aplikasi menyambung ulang otomatis dan polling 90 detik tetap berjalan.
