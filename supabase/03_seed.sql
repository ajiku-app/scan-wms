-- Data master awal (bukan transaksi). Sesuaikan dengan master WMS Anda.
INSERT INTO racks(code, zone, description) VALUES
 ('GR-STAGING','GR','Area sementara barang masuk'),
 ('A-01-01','A',NULL),('A-01-02','A',NULL),('A-02-01','A',NULL),
 ('B-01-01','B',NULL),('B-01-02','B',NULL)
ON CONFLICT DO NOTHING;

-- pcs_per_ctn selain BSK-001 diisi 1 sementara: mohon koreksi.
INSERT INTO products(sku, name, pcs_per_ctn) VALUES
 ('SRN-BSK-001','Biskuit Krim Cokelat 120g',48),
 ('SRN-BSK-002','Biskuit Kelapa 200g',1),
 ('SRN-MIE-010','Mi Instan Goreng 85g',1),
 ('SRN-SNK-020','Keripik Singkong Balado 60g',1),
 ('SRN-MNM-030','Sirup Markisa 460ml',1),
 ('SRN-SBK-040','Saus Sambal 335ml',1)
ON CONFLICT DO NOTHING;

-- ===== Beri role ke operator =====
-- 1) Supabase Dashboard > Authentication > Users > Add user > "Create new user"
--    Email: budi@wms.example.com (username "budi"), isi password, centang "Auto Confirm User".
-- 2) Atur nama & role (inbound | picker | admin | supervisor):
-- UPDATE profiles SET name='Budi Santoso', role='inbound'
--  WHERE id=(SELECT id FROM auth.users WHERE email='budi@wms.example.com');
-- UPDATE profiles SET name='Sari Dewi', role='picker'
--  WHERE id=(SELECT id FROM auth.users WHERE email='sari@wms.example.com');
