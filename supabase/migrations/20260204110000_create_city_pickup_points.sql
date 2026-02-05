-- ============================================================================
-- Create city_pickup_points table (admin-owned meeting points per city)
-- ============================================================================
-- Phase 1: Cities remain in code; this table stores pickup points per city.
-- Admin has full CRUD; drivers select from these when creating rides.
-- ============================================================================

CREATE TABLE public.city_pickup_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(city, name)
);

CREATE INDEX idx_city_pickup_points_city ON public.city_pickup_points(city);

COMMENT ON TABLE public.city_pickup_points IS 'Admin-defined pickup/meeting points per city. Drivers select from these when creating rides.';
COMMENT ON COLUMN public.city_pickup_points.city IS 'City name (matches rides.from_city, e.g. from allCameroonCities)';
COMMENT ON COLUMN public.city_pickup_points.display_order IS 'Order for display in admin and driver dropdowns';

ALTER TABLE public.city_pickup_points ENABLE ROW LEVEL SECURITY;

-- SELECT: allow authenticated users (drivers need to read for ride creation)
CREATE POLICY "city_pickup_points_select_authenticated"
  ON public.city_pickup_points FOR SELECT
  TO authenticated
  USING (true);

-- SELECT: allow anon for public ride listing / driver app before login (optional)
CREATE POLICY "city_pickup_points_select_anon"
  ON public.city_pickup_points FOR SELECT
  TO anon
  USING (true);

-- INSERT/UPDATE/DELETE: admin only (via profiles.role)
CREATE POLICY "city_pickup_points_insert_admin"
  ON public.city_pickup_points FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "city_pickup_points_update_admin"
  ON public.city_pickup_points FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "city_pickup_points_delete_admin"
  ON public.city_pickup_points FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Service role for server-side API (admin routes may use service role)
GRANT ALL ON public.city_pickup_points TO service_role;
