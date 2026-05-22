# Test Invoice Data

20 test invoices for the PwC Invoice Approval Automation System.

## Active Rulebook: May 2025 v1

| Category    | Approved Rate | Tolerance | Min Qty | Max Qty | Required Grade |
|-------------|--------------|-----------|---------|---------|----------------|
| steel_rod   | 45,000 INR/MT | ±5%      | 10 MT   | 200 MT  | IS2062 E250    |
| steel_plate | 52,000 INR/MT | ±5%      | 5 MT    | 100 MT  | IS2062 E350    |
| cement      | 6,200 INR/MT  | ±7%      | 10 MT   | 500 MT  | OPC53          |

---

## Test Cases

| # | File | Format | Expected | Reason |
|---|------|--------|----------|--------|
| 01 | `01_APPROVE_steel_rod_valid.json` | JSON | **APPROVE** | Exact rate 45,000, 50 MT, correct grade IS2062 E250 |
| 02 | `02_APPROVE_cement_valid.json` | JSON | **APPROVE** | Exact rate 6,200, 100 MT, correct grade OPC53 |
| 03 | `03_APPROVE_steel_plate_valid.json` | JSON | **APPROVE** | Rate 53,000 (+1.9%, within 5%), 30 MT, IS2062 E350 |
| 04 | `04_APPROVE_multi_item_mixed.json` | JSON | **APPROVE** | Mixed steel_rod + cement, both within rules |
| 05 | `05_APPROVE_steel_rod_lower_tolerance.txt` | TXT | **APPROVE** | Rate 43,200 (-4.0%, within 5% lower bound) |
| 06 | `06_APPROVE_cement_upper_tolerance.txt` | TXT | **APPROVE** | Rate 6,620 (+6.8%, within 7% upper bound) |
| 07 | `07_APPROVE_steel_plate_min_qty.csv` | CSV | **APPROVE** | Exactly 5 MT (minimum quantity), valid rate |
| 08 | `08_APPROVE_steel_rod_exact_rate.csv` | CSV | **APPROVE** | Exact rate, 100 MT, clean arithmetic |
| 09 | `09_REJECT_rate_too_high_steel_rod.json` | JSON | **REJECT** | Rate 49,500 (+10%, exceeds 5% tolerance) |
| 10 | `10_REJECT_rate_too_high_cement.json` | JSON | **REJECT** | Rate 7,000 (+12.9%, exceeds 7% tolerance) |
| 11 | `11_REJECT_qty_below_minimum.txt` | TXT | **REJECT** | 5 MT < 10 MT minimum for steel_rod |
| 12 | `12_REJECT_qty_exceeds_maximum.txt` | TXT | **REJECT** | 150 MT > 100 MT maximum for steel_plate |
| 13 | `13_REJECT_wrong_quality_grade.csv` | CSV | **REJECT** | Grade Fe415 < required IS2062 E250 |
| 14 | `14_REJECT_arithmetic_error.csv` | CSV | **REJECT** | Claimed 620,000 but 80 MT × 6,200 = 496,000 |
| 15 | `15_REJECT_missing_po_reference.txt` | TXT | **REJECT** | No PO reference, no GSTIN, no quality grade |
| 16 | `16_REJECT_rate_below_tolerance_steel_plate.json` | JSON | **REJECT** | Rate 47,000 (-9.6%, exceeds 5% lower bound) |
| 17 | `17_REJECT_cement_qty_exceeds_max.txt` | TXT | **REJECT** | 600 MT > 500 MT maximum for cement |
| 18 | `18_REJECT_duplicate_invoice_number.json` | JSON | **REJECT** | Duplicate invoice INV-SR-001 — potential fraud |
| 19 | `19_APPROVE_cement_exact_boundary.csv` | CSV | **APPROVE** | Exactly 500 MT (maximum), exact rate 6,200 |
| 20 | `20_REJECT_wrong_grade_cement.txt` | TXT | **REJECT** | OPC33 grade + rate 5,800 (-6.5%, near lower bound) |

---

## Summary

- **APPROVE**: 8 invoices (01–08, 19)
- **REJECT**: 12 invoices (09–18, 20)

## How to Use

Upload each file via the **Invoices → Upload** button and compare the system verdict with the expected outcome above.

> Note: File 18 (duplicate invoice number) tests duplicate detection — the AI may flag it rather than hard-reject depending on whether the original was already in the system.
