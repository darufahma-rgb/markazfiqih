-- Jalankan manual di Supabase SQL Editor (aman dijalankan ulang).
-- Revisi Batch 2 — kelasmarkazfiqih.com
--
-- Kode frontend sudah dibuat toleran: kalau SQL ini BELUM dijalankan, situs
-- tetap jalan seperti sebelumnya, hanya fitur-fitur baru di bawah yang belum
-- aktif. Setelah SQL ini dijalankan, semua fitur baru langsung aktif.

-- ── 1. Status penjualan kelas ────────────────────────────────────────────────
-- 'open'      → dijual normal
-- 'paused'    → tetap tampil di katalog, tapi tombol beli dimatikan
--               ("Tidak dijual sementara")
-- 'withdrawn' → disembunyikan dari katalog & tidak bisa dibeli, TAPI pelajar
--               yang sudah membeli tetap memilikinya di "Kelas Saya".
-- Berbeda dengan status 'draft' yang menyembunyikan kelas dari semua orang,
-- termasuk yang sudah membeli.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS sales_status TEXT NOT NULL DEFAULT 'open';
ALTER TABLE classes DROP CONSTRAINT IF EXISTS classes_sales_status_check;
ALTER TABLE classes ADD CONSTRAINT classes_sales_status_check
  CHECK (sales_status IN ('open', 'paused', 'withdrawn'));

-- ── 2. Box "Tentang Kelas" (detail kelas di katalog, menggantikan Kurikulum) ─
ALTER TABLE classes ADD COLUMN IF NOT EXISTS about_text TEXT;

-- ── 3. Box "Catatan" (halaman belajar / Kelas Saya) ─────────────────────────
ALTER TABLE classes ADD COLUMN IF NOT EXISTS notes_text TEXT;

-- ── 4. "Dimiliki X Pelajar" diisi manual oleh admin ─────────────────────────
-- NULL → baris "Dimiliki ..." tidak ditampilkan.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS owned_count_display INTEGER;

-- ── 5. Server juga menolak kelas yang sedang tidak dijual ───────────────────
-- Mencegah kelas 'paused'/'withdrawn' masuk keranjang lewat jalur apa pun
-- (bukan hanya tombol yang disembunyikan di tampilan).
CREATE OR REPLACE FUNCTION prevent_cart_unsold_class()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.class_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM classes c
    WHERE c.id = NEW.class_id AND c.sales_status <> 'open'
  ) THEN
    RAISE EXCEPTION 'Kelas ini sedang tidak dijual.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cart_unsold_class ON cart_items;
CREATE TRIGGER trg_prevent_cart_unsold_class
  BEFORE INSERT ON cart_items
  FOR EACH ROW EXECUTE FUNCTION prevent_cart_unsold_class();

-- ── 6. Profil pengguna: foto profil sendiri ─────────────────────────────────
-- Kolom avatar_url ditimpa otomatis dengan foto Google setiap login, jadi foto
-- yang diunggah pengguna disimpan di kolom terpisah.
-- Nama tampilan memakai kolom nickname yang sudah ada.
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT;

-- Bucket penyimpanan foto profil (publik untuk dibaca).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Pengguna hanya boleh menulis ke folder miliknya sendiri: avatars/<user_id>/...
DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
