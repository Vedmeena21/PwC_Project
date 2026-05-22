-- ============================================================
-- Seed: Initial active rulebook ("Production Baseline v1")
-- Idempotent — safe to re-run; will only insert if no rulebook
-- with this exact label+version already exists.
-- ============================================================

DO $$
DECLARE
  v_id uuid;
BEGIN
  -- Skip if a "Production Baseline" v1 already exists
  IF EXISTS (
    SELECT 1 FROM rulebook_versions
    WHERE label = 'Production Baseline' AND version = 1
  ) THEN
    RAISE NOTICE 'Production Baseline v1 already seeded — skipping.';
    RETURN;
  END IF;

  -- Deactivate any existing active rulebook so only the new one is active
  UPDATE rulebook_versions SET is_active = false WHERE is_active = true;

  -- Create the version
  INSERT INTO rulebook_versions (version, label, created_by, notes, is_active)
  VALUES (
    1,
    'Production Baseline',
    'system',
    'Initial rulebook seeded at deployment. Covers steel rods, steel plates, and cement with standard market rates.',
    true
  )
  RETURNING id INTO v_id;

  -- Insert the baseline rules
  INSERT INTO rulebook_rules (version_id, item_category, rule_key, rule_value, unit, description) VALUES
  -- Steel rod rules
  (v_id, 'steel_rod',   'approved_rate_per_mt',   '54500',  'INR/MT',  'Standard market rate for TMT steel rods'),
  (v_id, 'steel_rod',   'max_tolerance_pct',      '5',      '%',       'Maximum allowed deviation from approved rate'),
  (v_id, 'steel_rod',   'min_quantity',           '1',      'MT',      'Minimum order quantity'),
  (v_id, 'steel_rod',   'max_quantity',           '500',    'MT',      'Maximum order quantity per invoice'),
  (v_id, 'steel_rod',   'required_quality_grade', 'Fe-500', 'grade',   'Minimum acceptable grade'),

  -- Steel plate rules
  (v_id, 'steel_plate', 'approved_rate_per_mt',   '62000',  'INR/MT',  'Standard market rate for steel plates'),
  (v_id, 'steel_plate', 'max_tolerance_pct',      '5',      '%',       'Maximum allowed deviation from approved rate'),
  (v_id, 'steel_plate', 'min_quantity',           '0.5',    'MT',      'Minimum order quantity'),
  (v_id, 'steel_plate', 'max_quantity',           '300',    'MT',      'Maximum order quantity per invoice'),
  (v_id, 'steel_plate', 'required_quality_grade', 'IS-2062','grade',   'Acceptable IS standard'),

  -- Cement rules
  (v_id, 'cement',      'approved_rate_per_mt',   '8500',   'INR/MT',  'Standard market rate for cement (OPC 53)'),
  (v_id, 'cement',      'max_tolerance_pct',      '7',      '%',       'Maximum allowed deviation from approved rate'),
  (v_id, 'cement',      'min_quantity',           '1',      'MT',      'Minimum order quantity'),
  (v_id, 'cement',      'max_quantity',           '1000',   'MT',      'Maximum order quantity per invoice'),
  (v_id, 'cement',      'required_quality_grade', 'OPC-43', 'grade',   'Minimum cement grade');

  RAISE NOTICE 'Seeded Production Baseline v1 with 15 rules (id=%).', v_id;
END $$;

-- ============================================================
-- Seed: default app_settings rows so the Settings UI loads cleanly
-- ============================================================

INSERT INTO app_settings (key, value) VALUES
  ('notification_recipients',         '[]'),
  ('auto_notify_on_flag',             'true'),
  ('auto_notify_on_rulebook_update',  'true')
ON CONFLICT (key) DO NOTHING;
