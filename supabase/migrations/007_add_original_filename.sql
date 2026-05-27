-- Add original filename column so the UI can show the document name
-- without relying on the extracted invoice_number (which can be UNKNOWN).
alter table invoices
  add column if not exists original_filename text;

-- Recreate invoice_summary to include original_filename
drop view if exists invoice_summary;

create view invoice_summary as
select
  i.id,
  i.invoice_number,
  i.vendor_name,
  i.invoice_date,
  i.po_reference,
  i.status,
  i.uploaded_at,
  i.reviewed_at,
  i.reviewed_by,
  i.uploaded_by,
  i.original_filename,
  u.name  as uploaded_by_name,
  u.email as uploaded_by_email,
  r.verdict,
  r.confidence,
  r.summary,
  r.total_checks,
  r.passed_checks,
  r.failed_checks,
  rv.label as rulebook_label
from invoices i
left join invoice_recommendations r on r.invoice_id = i.id
left join rulebook_versions rv on rv.id = i.rulebook_version_id
left join users u on u.id = i.uploaded_by
order by i.uploaded_at desc;
