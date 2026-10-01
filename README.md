# WMS Scan — Gudang FG (Capacitor: Android APK/AAB & iOS)

Aplikasi scan gudang berbasis Supabase, dibungkus **Capacitor** menjadi aplikasi native.

```
www/        Aplikasi web (HTML/JS/CSS) — sumber tunggal untuk Android & iOS
supabase/   Riwayat migrasi SQL (referensi)
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
