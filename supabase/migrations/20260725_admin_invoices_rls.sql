-- ═══════════════════════════════════════════════════════════════════════════
-- RLS Policy: Admin boleh membaca semua invoices & invoice_items
-- ═══════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "invoices_admin_select_all" ON invoices;
CREATE POLICY "invoices_admin_select_all" ON invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id::text = auth.uid()::text
        AND user_profiles.is_admin = true
    )
  );

DROP POLICY IF EXISTS "invoice_items_admin_select_all" ON invoice_items;
CREATE POLICY "invoice_items_admin_select_all" ON invoice_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.user_id::text = auth.uid()::text
        AND user_profiles.is_admin = true
    )
  );
