/*
# Create catalog_products table

1. New Tables
- `catalog_products`: stores which Eveses rental offers are shown in the public GhostSMS catalog.
  - `id` (uuid, primary key)
  - `country_code` (text, not null) — ISO2 country code, e.g. "es"
  - `country_name` (text, not null) — human-readable country name
  - `duration_minutes` (integer, not null) — rental duration in minutes (4320=3d, 10080=7d, 20160=14d, 43200=30d)
  - `duration_label` (text, not null) — human-readable duration, e.g. "7 días"
  - `provider_price_cents` (integer, not null) — Eveses provider cost in USD cents at time of addition
  - `markup_percent` (integer, not null, default 100) — markup percentage applied to provider price
  - `custom_price_eur_cents` (integer, nullable) — if set, overrides the computed price
  - `created_at` (timestamptz, default now())
  - Unique constraint on (country_code, duration_minutes) so each country+duration combo appears at most once
2. Security
- Enable RLS on `catalog_products`.
- SELECT: public (anon + authenticated) — the public catalog needs to be readable by all visitors.
- INSERT/UPDATE/DELETE: authenticated only — only logged-in admin can manage the catalog.
*/

CREATE TABLE IF NOT EXISTS catalog_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  country_name text NOT NULL,
  duration_minutes integer NOT NULL,
  duration_label text NOT NULL,
  provider_price_cents integer NOT NULL,
  markup_percent integer NOT NULL DEFAULT 100,
  custom_price_eur_cents integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE (country_code, duration_minutes)
);

ALTER TABLE catalog_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_select_catalog_products" ON catalog_products;
CREATE POLICY "public_select_catalog_products"
ON catalog_products FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_insert_catalog_products" ON catalog_products;
CREATE POLICY "admin_insert_catalog_products"
ON catalog_products FOR INSERT
TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admin_update_catalog_products" ON catalog_products;
CREATE POLICY "admin_update_catalog_products"
ON catalog_products FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "admin_delete_catalog_products" ON catalog_products;
CREATE POLICY "admin_delete_catalog_products"
ON catalog_products FOR DELETE
TO authenticated USING (true);
