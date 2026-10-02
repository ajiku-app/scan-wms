# ARSIP — jangan dijalankan

Folder ini dulunya `supabase/`. Isinya SQL versi awal aplikasi scan dan **sudah usang**:
skemanya tidak punya `production_date`, `gr_no`, tipe movement `ADJ`, `outbound_items`, kapasitas rak, hold;
fungsinya menimpa versi baru bila dijalankan, dan `02_security_functions.sql` membuat ulang `wms_receive`
(terima barang tanpa Packing List) yang sengaja sudah dihapus dari backend.

Backend yang benar ada di repo **WMS** (`backend/`, urutan eksekusi di `backend/README.md`).
`03_seed.sql` (SKU contoh `SRN-*`) dihapus karena formatnya tidak sama dengan master produk WMS.
`04_reports.sql` masih berguna sebagai kumpulan query laporan/rekonsiliasi (hanya SELECT).
