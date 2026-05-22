-- ── Ready-to-run rulebook seed — paste entire file into Supabase SQL Editor ──
-- No placeholders. Run as a single block.

DO $$
DECLARE
  vid UUID := 'ccd7dc86-913c-4bb9-bdbf-e0669434da33';
BEGIN

-- 1. Insert the rulebook version
INSERT INTO rulebook_versions (id, month_year, version_number, description, is_active, created_by)
VALUES (
  vid,
  '2025-05',
  1,
  'May 2025 standard rates — steel rods, steel plates, OPC cement',
  false,
  'System Seed'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Insert all 12 rules
INSERT INTO rulebook_rules (version_id, item_category, rule_key, rule_value, unit, description) VALUES
-- Steel Rod
(vid, 'steel_rod', 'approved_rate_per_mt',   '45000',       'INR/MT', 'Approved rate per MT for steel rods'),
(vid, 'steel_rod', 'min_quantity',            '10',          'MT',     'Minimum order quantity'),
(vid, 'steel_rod', 'max_quantity',            '200',         'MT',     'Maximum per invoice'),
(vid, 'steel_rod', 'required_quality_grade',  'IS2062 E250', '',       'Only IS2062 E250 grade accepted'),
-- Steel Plate
(vid, 'steel_plate', 'approved_rate_per_mt',  '52000',       'INR/MT', 'Approved rate per MT for steel plates'),
(vid, 'steel_plate', 'min_quantity',           '5',           'MT',     'Minimum order quantity'),
(vid, 'steel_plate', 'max_quantity',           '100',         'MT',     'Maximum per invoice'),
(vid, 'steel_plate', 'required_quality_grade', 'IS2062 E350', '',       'Only IS2062 E350 grade accepted'),
-- Cement
(vid, 'cement', 'approved_rate_per_mt',   '6200',  'INR/MT', 'Approved rate per MT for OPC 53 cement'),
(vid, 'cement', 'min_quantity',           '10',    'MT',     'Minimum order — below this is not cost-effective'),
(vid, 'cement', 'max_quantity',           '500',   'MT',     'Maximum per invoice'),
(vid, 'cement', 'required_quality_grade', 'OPC53', '',       'Only OPC 53 grade accepted');

-- 3. Deactivate any existing active version, then activate this one
UPDATE rulebook_versions SET is_active = false WHERE is_active = true;
UPDATE rulebook_versions SET is_active = true  WHERE id = vid;

RAISE NOTICE 'Rulebook seeded and activated: %', vid;
END $$;
