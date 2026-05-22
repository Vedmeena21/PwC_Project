-- ── Test Rulebook Seed ────────────────────────────────────────────────────────
-- Run this in your Supabase SQL editor to create and activate a May 2025 rulebook.
-- These rules are calibrated to produce specific outcomes with the test invoices.
--
-- Expected results per invoice:
--   invoice1_should_approve.pdf     → APPROVE  (steel rod + plate, all checks pass)
--   invoice2_should_reject_rate.pdf → REJECT   (steel rod rate 51000 > approved 45000)
--   invoice3_should_reject_arith.pdf→ REJECT   (6200×100=620000 ≠ 750000 in invoice)
--   invoice4_should_reject_grade.doc→ REJECT   (Fe415 ≠ required IS2062 E250)
--   invoice5_should_approve.xlsx    → APPROVE  (cement, rate+grade+qty all valid)
--   invoice6_should_approve.json    → APPROVE  (steel plate, all checks pass)
--   invoice7_should_reject_qty.txt  → REJECT   (5 MT < min 10 MT for cement)
--   invoice8_mixed_items.csv        → APPROVE  (mixed items, all within rules)

-- Step 1: Create the rulebook version
INSERT INTO rulebook_versions (month_year, version_number, description, is_active)
VALUES ('2025-05', 1, 'May 2025 standard material rates — steel rods, steel plates, cement', false)
RETURNING id;

-- ⚠ Copy the returned UUID and replace <VERSION_ID> below before running Step 2.

-- Step 2: Insert rules (replace <VERSION_ID> with the UUID from Step 1)
INSERT INTO rulebook_rules (version_id, item_category, rule_key, rule_value, unit, description) VALUES

-- ── Steel Rod rules ────────────────────────────────────────────────────────────
('<VERSION_ID>', 'steel_rod', 'approved_rate_per_mt',   '45000',      'INR/MT', 'Approved purchase rate per MT for steel rods'),
('<VERSION_ID>', 'steel_rod', 'min_quantity',            '10',         'MT',     'Minimum order quantity for steel rods'),
('<VERSION_ID>', 'steel_rod', 'max_quantity',            '200',        'MT',     'Maximum order quantity per invoice'),
('<VERSION_ID>', 'steel_rod', 'required_quality_grade',  'IS2062 E250','',       'Accepted grade — IS2062 E250 only'),

-- ── Steel Plate rules ──────────────────────────────────────────────────────────
('<VERSION_ID>', 'steel_plate', 'approved_rate_per_mt',  '52000',      'INR/MT', 'Approved purchase rate per MT for steel plates'),
('<VERSION_ID>', 'steel_plate', 'min_quantity',           '5',          'MT',     'Minimum order quantity for steel plates'),
('<VERSION_ID>', 'steel_plate', 'max_quantity',           '100',        'MT',     'Maximum order quantity per invoice'),
('<VERSION_ID>', 'steel_plate', 'required_quality_grade', 'IS2062 E350','',       'Accepted grade — IS2062 E350 only'),

-- ── Cement rules ───────────────────────────────────────────────────────────────
('<VERSION_ID>', 'cement', 'approved_rate_per_mt',  '6200',   'INR/MT', 'Approved rate per MT for OPC 53 grade cement'),
('<VERSION_ID>', 'cement', 'min_quantity',           '10',     'MT',     'Minimum order — small orders not cost-effective'),
('<VERSION_ID>', 'cement', 'max_quantity',           '500',    'MT',     'Maximum per invoice'),
('<VERSION_ID>', 'cement', 'required_quality_grade', 'OPC53',  '',       'Only OPC 53 grade accepted; PPC requires separate approval');

-- Step 3: Activate this rulebook version
-- (Replace <VERSION_ID> again)
UPDATE rulebook_versions SET is_active = false WHERE is_active = true;
UPDATE rulebook_versions SET is_active = true  WHERE id = '<VERSION_ID>';
