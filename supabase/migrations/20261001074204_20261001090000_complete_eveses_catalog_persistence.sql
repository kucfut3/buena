/*
# Complete Eveses catalog offer persistence

1. Purpose
- Store the concrete Eveses offer data selected from the Catalog Explorer.
- Keep the public catalog backed by the same persistent rows after reloads and new sessions.

2. Modified table: `catalog_products`
- Add `eveses_offer_id`: deterministic identifier for the selected Eveses offer.
- Add `renewable`: renewable capability returned by Eveses when the offer was saved.
- Add `stock`: stock returned by Eveses when the offer was saved.
- Add `available`: whether the saved offer had stock when it was saved.
- Add `updated_at`: timestamp for the latest catalog update.
- Preserve the existing unique country + duration rule so repeated adds do not create duplicates.

3. Security
- Keep public SELECT access so the public catalog can be read by visitors.
- Restrict INSERT, UPDATE, and DELETE to authenticated administrators through `is_admin()`.
- Keep four separate CRUD policies and do not expose catalog management to anonymous clients.

4. Important notes
- Existing rows are preserved and receive safe defaults for the new fields.
- No existing columns or data are removed.
*/

ALTER TABLE catalog_products
  ADD COLUMN IF NOT EXISTS eveses_offer_id text,
  ADD COLUMN IF NOT EXISTS renewable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stock integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE catalog_products
SET updated_at = COALESCE(created_at, now())
WHERE updated_at IS NULL;

DROP POLICY IF EXISTS "admin_insert_catalog_products" ON catalog_products;
CREATE POLICY "admin_insert_catalog_products"
ON catalog_products FOR INSERT
TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_catalog_products" ON catalog_products;
CREATE POLICY "admin_update_catalog_products"
ON catalog_products FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_catalog_products" ON catalog_products;
CREATE POLICY "admin_delete_catalog_products"
ON catalog_products FOR DELETE
TO authenticated
USING (is_admin());