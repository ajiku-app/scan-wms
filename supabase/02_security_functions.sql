-- Supabase | 2/3: RLS + fungsi transaksi (semua penulisan lewat fungsi ini, bukan langsung ke tabel)

CREATE OR REPLACE FUNCTION public.wms_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
$$ SELECT role FROM profiles WHERE id = auth.uid() AND active $$;

-- ---------- RLS: klien hanya boleh MEMBACA sesuai role ----------
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE racks            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_docs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_lines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_docs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_picks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;

CREATE POLICY p_profiles ON profiles FOR SELECT TO authenticated USING (id = auth.uid() OR wms_role() IS NOT NULL);
CREATE POLICY p_products ON products FOR SELECT TO authenticated USING (wms_role() IS NOT NULL);
CREATE POLICY p_racks    ON racks    FOR SELECT TO authenticated USING (wms_role() IS NOT NULL);
CREATE POLICY p_stock    ON stock    FOR SELECT TO authenticated USING (wms_role() IS NOT NULL);
CREATE POLICY p_in_docs  ON inbound_docs  FOR SELECT TO authenticated USING (wms_role() IN ('inbound','admin','supervisor'));
CREATE POLICY p_in_lines ON inbound_lines FOR SELECT TO authenticated USING (wms_role() IN ('inbound','admin','supervisor'));
CREATE POLICY p_out_docs ON outbound_docs  FOR SELECT TO authenticated USING (wms_role() IN ('picker','admin','supervisor'));
CREATE POLICY p_out_pick ON outbound_picks FOR SELECT TO authenticated USING (wms_role() IN ('picker','admin','supervisor'));
CREATE POLICY p_moves    ON stock_movements FOR SELECT TO authenticated USING (wms_role() IN ('admin','supervisor'));

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM authenticated;

-- ---------- GR: terima barang ----------
CREATE OR REPLACE FUNCTION public.wms_receive(p_doc text, p_sku text, p_batch text, p_expiry date, p_qty int,
  p_rack text DEFAULT NULL, p_scanned_at timestamptz DEFAULT NULL, p_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_rack text := nullif(upper(trim(coalesce(p_rack,''))),''); v_loc text;
BEGIN
  IF coalesce(wms_role(),'') NOT IN ('inbound','admin','supervisor') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Jumlah harus lebih dari 0'; END IF;
  IF p_expiry IS NULL THEN RAISE EXCEPTION 'ED wajib diisi'; END IF;
  p_sku := upper(trim(p_sku)); p_batch := upper(trim(p_batch)); v_loc := coalesce(v_rack,'GR-STAGING');
  SELECT status INTO v_status FROM inbound_docs WHERE no = p_doc FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Dokumen inbound tidak ditemukan'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Dokumen sudah selesai'; END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = p_sku AND active) THEN RAISE EXCEPTION 'SKU % belum terdaftar di master produk', p_sku; END IF;
  IF NOT EXISTS (SELECT 1 FROM racks WHERE code = v_loc AND active) THEN RAISE EXCEPTION 'Rak % tidak terdaftar', v_loc; END IF;
  INSERT INTO stock_movements(type,doc_no,sku,batch,expiry,to_rack,qty,user_id,scanned_at,idempotency_key)
    VALUES ('GR',p_doc,p_sku,p_batch,p_expiry,v_loc,p_qty,auth.uid(),p_scanned_at,p_key) ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('duplicate', true); END IF;
  INSERT INTO inbound_lines(doc_no,sku,batch,expiry,qty_pl,qty_received,rack_code,pic)
    VALUES (p_doc,p_sku,p_batch,p_expiry,p_qty,p_qty,v_rack,auth.uid())
    ON CONFLICT (doc_no,sku,batch) DO UPDATE SET qty_received = inbound_lines.qty_received + EXCLUDED.qty_received,
      expiry = EXCLUDED.expiry, rack_code = coalesce(EXCLUDED.rack_code, inbound_lines.rack_code), pic = EXCLUDED.pic;
  INSERT INTO stock(sku,batch,expiry,rack_code,qty) VALUES (p_sku,p_batch,p_expiry,v_loc,p_qty)
    ON CONFLICT (sku,batch,rack_code) DO UPDATE SET qty = stock.qty + EXCLUDED.qty, expiry = EXCLUDED.expiry, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.wms_inbound_complete(p_doc text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(wms_role(),'') NOT IN ('inbound','admin','supervisor') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  UPDATE inbound_docs SET status='done', completed_at=now(), completed_by=auth.uid() WHERE no = p_doc AND status = 'open';
  RETURN jsonb_build_object('ok', true, 'updated', FOUND);
END $$;

-- ---------- GI: ambil barang sesuai picking list ----------
CREATE OR REPLACE FUNCTION public.wms_pick(p_doc text, p_sku text, p_batch text, p_rack text, p_qty int,
  p_scanned_at timestamptz DEFAULT NULL, p_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; k record;
BEGIN
  IF coalesce(wms_role(),'') NOT IN ('picker','admin','supervisor') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Jumlah harus lebih dari 0'; END IF;
  p_sku := upper(trim(p_sku)); p_batch := upper(trim(p_batch)); p_rack := upper(trim(p_rack));
  SELECT status INTO v_status FROM outbound_docs WHERE no = p_doc FOR UPDATE;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Dokumen outbound tidak ditemukan'; END IF;
  IF v_status <> 'open' THEN RAISE EXCEPTION 'Dokumen sudah selesai'; END IF;
  SELECT id, qty, picked INTO k FROM outbound_picks
   WHERE doc_no = p_doc AND sku = p_sku AND batch = p_batch AND rack_code = p_rack AND picked < qty
   ORDER BY seq LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item tidak ada di picking list (SKU/batch/rak tidak sesuai)'; END IF;
  IF p_qty > k.qty - k.picked THEN RAISE EXCEPTION 'Melebihi sisa pick (% ctn)', k.qty - k.picked; END IF;
  INSERT INTO stock_movements(type,doc_no,sku,batch,from_rack,qty,user_id,scanned_at,idempotency_key)
    VALUES ('GI',p_doc,p_sku,p_batch,p_rack,p_qty,auth.uid(),p_scanned_at,p_key) ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('duplicate', true); END IF;
  UPDATE stock SET qty = qty - p_qty, updated_at = now() WHERE sku = p_sku AND batch = p_batch AND rack_code = p_rack AND qty >= p_qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok % | % di rak % tidak cukup', p_sku, p_batch, p_rack; END IF;
  UPDATE outbound_picks SET picked = picked + p_qty WHERE id = k.id;
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public.wms_outbound_complete(p_doc text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF coalesce(wms_role(),'') NOT IN ('picker','admin','supervisor') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  IF EXISTS (SELECT 1 FROM outbound_picks WHERE doc_no = p_doc AND picked < qty) THEN RAISE EXCEPTION 'Picking belum lengkap'; END IF;
  UPDATE outbound_docs SET status='done', completed_at=now(), completed_by=auth.uid() WHERE no = p_doc AND status = 'open';
  RETURN jsonb_build_object('ok', true, 'updated', FOUND);
END $$;

-- ---------- Pindah rak ----------
CREATE OR REPLACE FUNCTION public.wms_move(p_sku text, p_batch text, p_from text, p_to text, p_qty int,
  p_scanned_at timestamptz DEFAULT NULL, p_key text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_exp date;
BEGIN
  IF coalesce(wms_role(),'') NOT IN ('inbound','admin','supervisor') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Jumlah harus lebih dari 0'; END IF;
  p_sku := upper(trim(p_sku)); p_batch := upper(trim(p_batch)); p_from := upper(trim(p_from)); p_to := upper(trim(p_to));
  IF p_from = p_to THEN RAISE EXCEPTION 'Rak asal dan tujuan sama'; END IF;
  IF NOT EXISTS (SELECT 1 FROM racks WHERE code = p_to AND active) THEN RAISE EXCEPTION 'Rak % tidak terdaftar', p_to; END IF;
  INSERT INTO stock_movements(type,sku,batch,from_rack,to_rack,qty,user_id,scanned_at,idempotency_key)
    VALUES ('MOVE',p_sku,p_batch,p_from,p_to,p_qty,auth.uid(),p_scanned_at,p_key) ON CONFLICT (idempotency_key) DO NOTHING;
  IF NOT FOUND THEN RETURN jsonb_build_object('duplicate', true); END IF;
  UPDATE stock SET qty = qty - p_qty, updated_at = now() WHERE sku = p_sku AND batch = p_batch AND rack_code = p_from AND qty >= p_qty
    RETURNING expiry INTO v_exp;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok % | % di rak % tidak cukup', p_sku, p_batch, p_from; END IF;
  INSERT INTO stock(sku,batch,expiry,rack_code,qty) VALUES (p_sku,p_batch,v_exp,p_to,p_qty)
    ON CONFLICT (sku,batch,rack_code) DO UPDATE SET qty = stock.qty + EXCLUDED.qty, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $$;

-- ---------- FEFO: buat picking list untuk satu baris pesanan DO (admin/supervisor atau SQL Editor) ----------
-- Hasil = sisa qty yang tidak terpenuhi (0 = penuh). Contoh: SELECT fefo_allocate('DO-20260928-001','SRN-BSK-001',150);
CREATE OR REPLACE FUNCTION public.fefo_allocate(p_doc text, p_sku text, p_qty int) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE need int := p_qty; r record; take int; n int;
BEGIN
  IF auth.uid() IS NOT NULL AND coalesce(wms_role(),'') NOT IN ('admin','supervisor') THEN RAISE EXCEPTION 'Tidak berwenang'; END IF;
  SELECT COALESCE(MAX(seq),0) INTO n FROM outbound_picks WHERE doc_no = p_doc;
  FOR r IN
    SELECT s.batch, s.expiry, s.rack_code,
           s.qty - COALESCE((SELECT SUM(k.qty - k.picked) FROM outbound_picks k JOIN outbound_docs d ON d.no = k.doc_no
                             WHERE d.status = 'open' AND k.sku = s.sku AND k.batch = s.batch AND k.rack_code = s.rack_code),0) AS avail
    FROM stock s WHERE s.sku = p_sku AND s.rack_code <> 'GR-STAGING' AND s.qty > 0
    ORDER BY s.expiry, s.batch, s.rack_code FOR UPDATE OF s
  LOOP
    EXIT WHEN need <= 0;
    CONTINUE WHEN r.avail <= 0;
    take := LEAST(need, r.avail); n := n + 1;
    INSERT INTO outbound_picks(doc_no,seq,sku,batch,expiry,rack_code,qty) VALUES (p_doc,n,p_sku,r.batch,r.expiry,r.rack_code,take);
    need := need - take;
  END LOOP;
  RETURN need;
END $$;

-- ---------- Hak eksekusi fungsi: hanya user login (bukan anon) ----------
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure AS sig FROM pg_proc
           WHERE pronamespace = 'public'::regnamespace AND (proname LIKE 'wms\_%' OR proname = 'fefo_allocate')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
