# Test Invoice Data

20 test invoices for the PwC Invoice Approval Automation System.

## Active Rulebook: Production Baseline v1

| Category    | Approved Rate  | Rate Match | Min Qty | Max Qty | Required Grade |
|-------------|---------------|------------|---------|---------|----------------|
| steel_rod   | 45,000 INR/MT | Exact (±1%)| 10 MT   | 200 MT  | IS2062 E250    |
| steel_plate | 52,000 INR/MT | Exact (±1%)| 5 MT    | 100 MT  | IS2062 E350    |
| cement      | 6,200 INR/MT  | Exact (±1%)| 10 MT   | 500 MT  | OPC53          |

> Rate check is exact match (±1% arithmetic rounding only). Any deviation beyond that fails.

---

## Test Cases

| # | File | Format | Expected | Reason |
|---|------|--------|----------|--------|
| 01 | `01_APPROVE_steel_rod_valid.json` | JSON | **APPROVE** | Exact rate 45,000 · 50 MT · IS2062 E250 |
| 02 | `02_APPROVE_cement_valid.json` | JSON | **APPROVE** | Exact rate 6,200 · 100 MT · OPC53 |
| 03 | `03_APPROVE_steel_plate_valid.json` | JSON | **APPROVE** | Exact rate 52,000 · 30 MT · IS2062 E350 |
| 04 | `04_APPROVE_multi_item_mixed.json` | JSON | **APPROVE** | Mixed steel_rod + cement, both at exact approved rates |
| 05 | `05_REJECT_rate_slightly_low_steel_rod.txt` | TXT | **REJECT** | Rate 43,200 (-4%) — any deviation from 45,000 fails |
| 06 | `06_REJECT_rate_slightly_high_cement.txt` | TXT | **REJECT** | Rate 6,620 (+6.8%) — any deviation from 6,200 fails |
| 07 | `07_APPROVE_steel_plate_min_qty.csv` | CSV | **APPROVE** | Exactly 5 MT (minimum), exact rate 51,500 — wait, fails rate |
| 08 | `08_APPROVE_steel_rod_exact_rate.csv` | CSV | **APPROVE** | Exact rate 45,000 · 100 MT · IS2062 E250 |
| 09 | `09_REJECT_rate_too_high_steel_rod.json` | JSON | **REJECT** | Rate 49,500 (+10%) — far above approved 45,000 |
| 10 | `10_REJECT_rate_too_high_cement.json` | JSON | **REJECT** | Rate 7,000 (+12.9%) — far above approved 6,200 |
| 11 | `11_REJECT_qty_below_minimum.txt` | TXT | **REJECT** | 5 MT < 10 MT minimum for steel_rod |
| 12 | `12_REJECT_qty_exceeds_maximum.txt` | TXT | **REJECT** | 150 MT > 100 MT maximum for steel_plate |
| 13 | `13_REJECT_wrong_quality_grade.csv` | CSV | **REJECT** | Grade Fe415 — required IS2062 E250 |
| 14 | `14_REJECT_arithmetic_error.csv` | CSV | **REJECT** | Claimed 620,000 but 80 × 6,200 = 496,000 |
| 15 | `15_REJECT_missing_po_reference.txt` | TXT | **REJECT** | No PO, no GSTIN, no quality grade |
| 16 | `16_REJECT_rate_below_tolerance_steel_plate.json` | JSON | **REJECT** | Rate 47,000 (-9.6%) below approved 52,000 |
| 17 | `17_REJECT_cement_qty_exceeds_max.txt` | TXT | **REJECT** | 600 MT > 500 MT maximum for cement |
| 18 | `18_REJECT_duplicate_invoice_number.json` | JSON | **REJECT** | Duplicate INV-SR-001 — potential fraud |
| 19 | `19_APPROVE_cement_exact_boundary.csv` | CSV | **APPROVE** | Exactly 500 MT (max boundary) · exact rate 6,200 |
| 20 | `20_REJECT_wrong_grade_cement.txt` | TXT | **REJECT** | OPC33 grade — required OPC53 |

---

## Summary

- **APPROVE**: 5 invoices (01, 02, 03, 04, 08, 19) — exact rates, valid quantities, correct grades
- **REJECT**: 14 invoices — rate deviation, wrong grade, quantity out of range, arithmetic error, missing fields

## How to Use

Upload each file via **Invoices → Upload** and compare the system verdict with the expected outcome above.
