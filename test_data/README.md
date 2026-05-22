# Test Data

Eight sample invoices covering every supported file format and every validation outcome.

## Rulebook Setup (do this first)

1. Open Supabase → SQL Editor → paste `seed_rulebook.sql`
2. Run Step 1 — copy the returned UUID
3. Replace all `<VERSION_ID>` with that UUID
4. Run Step 2 (rules) and Step 3 (activate)

Or do it through the UI: go to `/rulebook` → create a May 2025 version with these rules:

| Category    | Rule                   | Value        | Unit   |
|-------------|------------------------|--------------|--------|
| steel_rod   | approved_rate_per_mt   | 45000        | INR/MT |
| steel_rod   | min_quantity           | 10           | MT     |
| steel_rod   | max_quantity           | 200          | MT     |
| steel_rod   | required_quality_grade | IS2062 E250  |        |
| steel_plate | approved_rate_per_mt   | 52000        | INR/MT |
| steel_plate | min_quantity           | 5            | MT     |
| steel_plate | max_quantity           | 100          | MT     |
| steel_plate | required_quality_grade | IS2062 E350  |        |
| cement      | approved_rate_per_mt   | 6200         | INR/MT |
| cement      | min_quantity           | 10           | MT     |
| cement      | max_quantity           | 500          | MT     |
| cement      | required_quality_grade | OPC53        |        |

Then click **Activate**.

---

## Test Files

| File | Format | Expected Verdict | Why |
|------|--------|-----------------|-----|
| `invoice1_should_approve.pdf` | PDF | **APPROVE** | Tata Steel — rod + plate, rate/grade/qty all valid |
| `invoice2_should_reject_rate.pdf` | PDF | **REJECT** | Jindal Steel — rod rate 51,000 vs approved 45,000 |
| `invoice3_should_reject_arithmetic.pdf` | PDF | **REJECT** | Ambuja — 6200×100=620,000 but invoice claims 750,000 |
| `invoice4_should_reject_grade.docx` | Word | **REJECT** | Rashmi Metaliks — grade Fe415 ≠ required IS2062 E250 |
| `invoice5_should_approve.xlsx` | Excel | **APPROVE** | UltraTech Cement — rate+grade+qty all pass |
| `invoice6_should_approve.json` | JSON | **APPROVE** | SAIL Steel — two plate line items, all checks pass |
| `invoice7_should_reject_qty.txt` | Text | **REJECT** | Prism Cement — 5 MT ordered, minimum is 10 MT |
| `invoice8_mixed_items.csv` | CSV | **APPROVE** | National Steel — rod + plate + cement, all valid |

---

## How to test

1. Start backend: `cd backend && uvicorn app.main:app --reload`
2. Start frontend: `cd frontend && npm run dev`
3. Open `http://localhost:5173`
4. Go to `/rulebook` — confirm the May 2025 rulebook is active
5. Upload each file via Dashboard or `/invoices`
6. Check the verdict on the invoice detail page matches the table above
