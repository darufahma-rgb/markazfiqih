-- Migrasi: izinkan user menghapus baris video_completions miliknya sendiri.
--
-- Dibutuhkan supaya centang "pertemuan selesai" di kelas playlist bisa
-- DILEPAS lagi (Revisi 1 Bulan — kelasmarkazfiqih.com: "Progress belajar
-- tidak berfungsi... sepertinya kalau mau work, harus ada opsi centang
-- masing-masing pertemuan").
--
-- Tabel `video_completions` (lihat 20260709_add_video_completions.sql)
-- sudah punya policy SELECT/INSERT/UPDATE untuk baris milik sendiri, tapi
-- TIDAK ADA policy DELETE — jadi unmarkVideoCompleted() di db.ts akan selalu
-- ditolak RLS (0 baris terhapus, tanpa error yang jelas) walau kode
-- aplikasinya sudah benar.
--
-- Jalankan manual di Supabase SQL Editor. File ini idempoten — aman
-- dijalankan berkali-kali.

ALTER TABLE video_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "video_completions: user hapus milik sendiri" ON video_completions;
CREATE POLICY "video_completions: user hapus milik sendiri"
  ON video_completions FOR DELETE
  USING (auth.uid()::text = user_id);
