-- The unique constraint on (country_code, duration_minutes) prevents saving
-- two different offers for the same country+duration (e.g. Ukraine 7 days at
-- $3.38 AND $13.65). Replace it with a unique constraint on eveses_offer_id,
-- which uniquely identifies each offer (country + duration + price + renewable + voip).

ALTER TABLE catalog_products
  DROP CONSTRAINT IF EXISTS catalog_products_country_code_duration_minutes_key;

ALTER TABLE catalog_products
  ADD CONSTRAINT catalog_products_eveses_offer_id_key UNIQUE (eveses_offer_id);
