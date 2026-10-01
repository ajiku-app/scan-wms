# Catatan implementasi lintas-platform

- Kamera: BarcodeDetector native (Chrome/Android) + ZXing via CDN sebagai cadangan (Safari/iOS/Firefox).
  ZXing perlu koneksi internet saat PERTAMA kali membuka aplikasi (untuk dimuat dan disimpan cache oleh
  service worker); setelah itu jalan offline juga.
- iOS: tag apple-mobile-web-app-*, apple-touch-icon (180px), dan banner "Tambah ke Layar Utama" (manual,
  karena iOS tidak punya prompt instal otomatis seperti Android).
- Android/desktop Chrome: banner + tombol "Pasang" otomatis lewat event beforeinstallprompt.
- Vibrasi (getar saat scan) tidak didukung Safari/iOS — aplikasi tetap jalan, hanya tanpa getar (sudah
  dibungkus try/catch, tidak error).
- Wake Lock (layar tidak mati) didukung sebagian di Safari 16.4+; di versi lebih lama akan diam-diam
  tidak aktif, tidak mengganggu.
- Koneksi ke WMS disegarkan otomatis (sync + kirim ulang antrian) setiap aplikasi dibuka kembali dari
  latar belakang, berpindah tab, atau saat sinyal kembali online — berlaku sama di Android maupun iOS.
