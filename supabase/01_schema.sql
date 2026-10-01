-- Supabase (PostgreSQL) | 1/3: skema tabel WMS Gudang FG
BEGIN;

-- Supabase: pengguna dikelola Supabase Auth; profil menyimpan nama & role.
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT CHECK (role IN ('inbound','picker','admin','supervisor')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles(id, name) VALUES (new.id, split_part(new.email,'@',1)) ON CONFLICT DO NOTHING;
  RETURN new;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE products (
  sku          VARCHAR(30)  PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  pcs_per_ctn  INT          NOT NULL DEFAULT 1 CHECK (pcs_per_ctn > 0),
  active       BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE racks (
  code         VARCHAR(20) PRIMARY KEY,          -- contoh A-01-01
  zone         VARCHAR(10),
  description  TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE stock (
  id          BIGSERIAL PRIMARY KEY,
  sku         VARCHAR(30) NOT NULL REFERENCES products(sku),
  batch       VARCHAR(30) NOT NULL,
  expiry      DATE        NOT NULL,
  rack_code   VARCHAR(20) NOT NULL REFERENCES racks(code),
  qty         INT         NOT NULL CHECK (qty >= 0),   -- satuan ctn
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sku, batch, rack_code)
);
CREATE INDEX idx_stock_fefo ON stock(sku, expiry, batch) WHERE qty > 0;

CREATE TABLE inbound_docs (
  no            VARCHAR(30) PRIMARY KEY,          -- IN-20260928-001
  packing_list  VARCHAR(30),
  supplier      VARCHAR(100),
  doc_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  status        VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  completed_by  UUID REFERENCES profiles(id)
);

CREATE TABLE inbound_lines (
  id            BIGSERIAL PRIMARY KEY,
  doc_no        VARCHAR(30) NOT NULL REFERENCES inbound_docs(no) ON DELETE CASCADE,
  sku           VARCHAR(30) NOT NULL REFERENCES products(sku),
  batch         VARCHAR(30) NOT NULL,
  expiry        DATE        NOT NULL,
  qty_pl        INT         NOT NULL CHECK (qty_pl >= 0),
  qty_received  INT         NOT NULL DEFAULT 0 CHECK (qty_received >= 0),
  rack_code     VARCHAR(20) REFERENCES racks(code),
  pic           UUID REFERENCES profiles(id),
  UNIQUE (doc_no, sku, batch)
);
CREATE INDEX idx_inbound_lines_doc ON inbound_lines(doc_no);

CREATE TABLE outbound_docs (
  no                VARCHAR(30) PRIMARY KEY,      -- DO-20260928-001
  doc_date          DATE        NOT NULL DEFAULT CURRENT_DATE,
  customer_name     VARCHAR(150),
  customer_phone    VARCHAR(30),
  customer_address  TEXT,
  status            VARCHAR(10) NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  completed_by      UUID REFERENCES profiles(id)
);

CREATE TABLE outbound_picks (                      -- picking list (FEFO)
  id         BIGSERIAL PRIMARY KEY,
  doc_no     VARCHAR(30) NOT NULL REFERENCES outbound_docs(no) ON DELETE CASCADE,
  seq        INT         NOT NULL,
  sku        VARCHAR(30) NOT NULL REFERENCES products(sku),
  batch      VARCHAR(30) NOT NULL,
  expiry     DATE        NOT NULL,
  rack_code  VARCHAR(20) NOT NULL REFERENCES racks(code),
  qty        INT         NOT NULL CHECK (qty > 0),
  picked     INT         NOT NULL DEFAULT 0 CHECK (picked >= 0 AND picked <= qty),
  UNIQUE (doc_no, seq)
);
CREATE INDEX idx_picks_lookup ON outbound_picks(doc_no, sku, batch, rack_code);

CREATE TABLE stock_movements (                     -- buku besar / audit trail
  id               BIGSERIAL PRIMARY KEY,
  moved_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  type             VARCHAR(5)  NOT NULL CHECK (type IN ('GR','GI','MOVE')),
  doc_no           VARCHAR(30),
  sku              VARCHAR(30) NOT NULL REFERENCES products(sku),
  batch            VARCHAR(30) NOT NULL,
  expiry           DATE,
  from_rack        VARCHAR(20) REFERENCES racks(code),
  to_rack          VARCHAR(20) REFERENCES racks(code),
  qty              INT         NOT NULL CHECK (qty > 0),
  user_id          UUID        NOT NULL REFERENCES profiles(id),
  scanned_at       TIMESTAMPTZ,
  idempotency_key  VARCHAR(80) UNIQUE               -- cegah transaksi ganda saat kirim ulang
);
CREATE INDEX idx_mov_doc  ON stock_movements(doc_no);
CREATE INDEX idx_mov_user ON stock_movements(user_id, moved_at DESC);

COMMIT;
