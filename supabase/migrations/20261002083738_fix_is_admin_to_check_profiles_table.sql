-- The is_admin() function previously checked JWT app_metadata for the admin flag.
-- But the application sets is_admin as a column on the profiles table, not in
-- JWT app_metadata. This mismatch caused every INSERT/UPDATE/DELETE on
-- catalog_products (and other admin-gated tables) to be rejected by RLS,
-- producing "No se pudo guardar la oferta" in the UI.
--
-- Fix: make is_admin() check the profiles table instead of JWT app_metadata.

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;
