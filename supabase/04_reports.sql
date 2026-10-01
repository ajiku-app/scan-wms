-- Query laporan (opsional, jalankan sesuai kebutuhan di SQL Editor)

-- 2) Stok per SKU + total
SELECT s.sku, p.name, SUM(s.qty) AS total_ctn, SUM(s.qty*p.pcs_per_ctn) AS total_pcs
FROM stock s JOIN products p ON p.sku = s.sku WHERE s.qty > 0 GROUP BY s.sku, p.name ORDER BY s.sku;

-- 3) Stok hampir kedaluwarsa (<= 90 hari)
SELECT sku, batch, rack_code, qty, expiry, (expiry - CURRENT_DATE) AS sisa_hari
FROM stock WHERE qty > 0 AND expiry <= CURRENT_DATE + 90 ORDER BY expiry;

-- 4) Barang masih di GR-STAGING (belum ditempatkan)
SELECT sku, batch, expiry, qty FROM stock WHERE rack_code = 'GR-STAGING' AND qty > 0;

-- 5) Progres dokumen inbound / outbound
SELECT d.no, d.packing_list, SUM(l.qty_pl) AS pl, SUM(l.qty_received) AS diterima
FROM inbound_docs d JOIN inbound_lines l ON l.doc_no = d.no GROUP BY d.no, d.packing_list;
SELECT d.no, d.customer_name, SUM(k.qty) AS target, SUM(k.picked) AS terambil
FROM outbound_docs d JOIN outbound_picks k ON k.doc_no = d.no GROUP BY d.no, d.customer_name;

-- 6) Riwayat transaksi per operator
SELECT m.moved_at, m.type, m.doc_no, m.sku, m.batch, m.from_rack, m.to_rack, m.qty, u.name AS operator
FROM stock_movements m JOIN profiles u ON u.id = m.user_id
WHERE m.moved_at >= CURRENT_DATE ORDER BY m.moved_at DESC;

-- 7) Rekonsiliasi: stok tabel `stock` vs hasil hitung dari buku besar (harus kosong kalau sinkron)
WITH led AS (
  SELECT sku, batch, rack, SUM(q) AS qty FROM (
    SELECT sku, batch, to_rack   AS rack,  qty AS q FROM stock_movements WHERE to_rack   IS NOT NULL
    UNION ALL
    SELECT sku, batch, from_rack AS rack, -qty AS q FROM stock_movements WHERE from_rack IS NOT NULL
  ) x GROUP BY sku, batch, rack)
SELECT COALESCE(s.sku,l.sku) sku, COALESCE(s.batch,l.batch) batch, COALESCE(s.rack_code,l.rack) rack,
       COALESCE(s.qty,0) AS stok_tabel, COALESCE(l.qty,0) AS stok_ledger
FROM stock s FULL JOIN led l ON l.sku=s.sku AND l.batch=s.batch AND l.rack=s.rack_code
WHERE COALESCE(s.qty,0) <> COALESCE(l.qty,0);

