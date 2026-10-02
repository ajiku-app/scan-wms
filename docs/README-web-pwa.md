# WMS Scan — Gudang FG (Supabase)

```
frontend/   PWA bergaya aplikasi mobile iOS/Android (index.html, style.css, app.js, config.js, manifest.json, sw.js)
supabase-arsip/   ARSIP SQL lama — jangan dijalankan; backend resmi ada di repo WMS (backend/)
```

Login pakai akun WMS utama (Supabase Auth + tabel `profiles`), bukan tabel users terpisah.
`config.js` sudah diisi URL + anon key project Supabase Anda — tidak perlu diubah untuk localhost.

## Jalankan di localhost

Tidak bisa dibuka langsung lewat `file://` (browser memblokir modul/service worker dari file lokal).
Perlu server statis sederhana, pilih salah satu:

**Python** (biasanya sudah terpasang):
```
cd frontend
python3 -m http.server 8080
```

**Node.js** (tanpa install global):
```
cd frontend
npx serve -l 8080
```

**VS Code**: klik kanan `frontend/index.html` → "Open with Live Server" (perlu ekstensi Live Server).

Lalu buka **http://localhost:8080** di Chrome.

### Batasan di localhost
- **Kamera scan jalan di `localhost`** (pengecualian khusus browser untuk HTTPS), jadi tombol 📷 tetap bisa dites di komputer via webcam.
- **Tidak bisa dites di HP** dengan `localhost` — HP tidak bisa mengakses `localhost` komputer Anda. Untuk tes di HP: pakai IP komputer di jaringan wifi yang sama (`http://192.168.x.x:8080`, kamera HP tidak akan jalan karena bukan HTTPS) atau hosting sungguhan (Netlify/Vercel/Cloudflare Pages) untuk HTTPS penuh + kamera + install ke layar utama.
- Login (`wms_login` via Supabase Auth) tetap ke internet seperti biasa — server lokal hanya menyajikan file HTML/JS/CSS-nya, bukan datanya.

## Akun
Login memakai **email lengkap** (mis. `joko@wmsfg.com`) dan kata sandi dari Supabase Dashboard > Authentication > Users.
Akun hanya bisa masuk jika baris `profiles`-nya punya `role` dan `active = true`.

## Deploy sungguhan (HTTPS, untuk HP)
Hosting isi folder `frontend/` ke Netlify / Vercel / Cloudflare Pages / Nginx — cukup file statis, tidak perlu build step.

## Tampilan aplikasi mobile
UI mengikuti mockup Beranda (kanvas 390×844): tema hijau terang, font Plus Jakarta Sans (disimpan lokal, jalan offline),
bottom nav Beranda · Scan · Stok dengan tombol Scan di tengah, menu 2×2 (Inbound, Outbound, Putaway, Stok),
daftar "Dokumen yang berjalan", dan menu akun. Layar Inbound/Outbound/Putaway memakai app bar dengan tombol kembali
(tombol Back Android juga kembali ke Beranda). Menu yang tampil mengikuti role akun. Pasang ke layar utama agar
berjalan layar penuh tanpa bilah browser. Ikon aplikasi memakai logo kubus dari mockup.
