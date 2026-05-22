-- Drop unique constraint on invoice_number — same invoice can be re-uploaded if processing failed.
-- Uniqueness is now only enforced per (invoice_number, vendor_name) to prevent true duplicates
-- while allowing retry of extraction_failed invoices.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_number_key;
ALTER TABLE invoices ADD CONSTRAINT invoices_number_vendor_unique UNIQUE (invoice_number, vendor_name);

-- Also recreate invoice_summary view with updated column name (label instead of month_year)
DROP VIEW IF EXISTS invoice_summary;
CREATE VIEW invoice_summary AS
SELECT
  i.id,
  i.invoice_number,
  i.vendor_name,
  i.invoice_date,
  i.po_reference,
  i.status,
  i.uploaded_at,
  i.reviewed_at,
  i.reviewed_by,
  r.verdict,
  r.confidence,
  r.summary,
  r.total_checks,
  r.passed_checks,
  r.failed_checks,
  rv.label AS rulebook_label
FROM invoices i
LEFT JOIN invoice_recommendations r ON r.invoice_id = i.id
LEFT JOIN rulebook_versions rv ON rv.id = i.rulebook_version_id
ORDER BY i.uploaded_at DESC;

-- Further relaxed: drop the (invoice_number, vendor_name) unique constraint too.
-- The invoice UUID is the only unique identifier. Same invoice can be re-uploaded
-- (corrected version, retry after failure, etc.) without hitting a constraint error.
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_number_vendor_unique;
