-- ============================================================
-- Invoice Approval System — Supabase Schema
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ============================================================
-- RULEBOOK TABLES
-- ============================================================

create table rulebook_versions (
  id            uuid primary key default gen_random_uuid(),
  version       integer not null,
  label         text not null,          -- free text e.g. "May 2025", "Q1 Revision"
  created_at    timestamptz default now(),
  created_by    text,
  notes         text,
  is_active     boolean default false,
  unique (label, version)
);

create table rulebook_rules (
  id              uuid primary key default gen_random_uuid(),
  version_id      uuid references rulebook_versions(id) on delete cascade,
  item_category   text not null,        -- e.g. "steel_rod"
  rule_key        text not null,        -- e.g. "approved_rate_per_mt"
  rule_value      text not null,        -- stored as text, parsed by engine
  unit            text,                 -- e.g. "INR/MT", "MT", "grade"
  description     text,
  created_at      timestamptz default now()
);

create index idx_rulebook_rules_version on rulebook_rules(version_id);
create index idx_rulebook_rules_category on rulebook_rules(item_category);

-- ============================================================
-- INVOICE TABLES
-- ============================================================

create table invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_number  text not null,
  vendor_name     text not null,
  vendor_email    text,
  invoice_date    date,
  po_reference    text,
  pdf_path        text not null,         -- Supabase storage path
  pdf_url         text,
  status          text not null default 'pending'
                  check (status in ('pending','processing','approved','rejected','flagged','extraction_failed')),
  uploaded_at     timestamptz default now(),
  reviewed_at     timestamptz,
  reviewed_by     text,
  reviewer_notes  text,
  rulebook_version_id uuid references rulebook_versions(id)
);

create index idx_invoices_status on invoices(status);
create index idx_invoices_uploaded_at on invoices(uploaded_at desc);

-- Line items extracted from invoice PDF
create table invoice_line_items (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid references invoices(id) on delete cascade,
  item_category   text,
  description     text,
  quantity        numeric,
  quantity_unit   text,
  unit_rate       numeric,
  rate_unit       text,
  total_value     numeric,
  dimensions      jsonb,               -- {length, width, thickness, etc.}
  quality_grade   text,
  sequence_number integer
);

create index idx_line_items_invoice on invoice_line_items(invoice_id);

-- Validation results per invoice
create table validation_results (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid references invoices(id) on delete cascade,
  check_name      text not null,       -- e.g. "arithmetic_check"
  check_label     text not null,       -- e.g. "Arithmetic Verification"
  passed          boolean not null,
  expected_value  text,
  actual_value    text,
  message         text,
  severity        text default 'error' check (severity in ('error','warning','info')),
  created_at      timestamptz default now()
);

create index idx_validation_invoice on validation_results(invoice_id);

-- Final recommendation per invoice
create table invoice_recommendations (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      uuid references invoices(id) on delete cascade unique,
  verdict         text not null check (verdict in ('approve','reject','needs_review')),
  confidence      text check (confidence in ('high','medium','low')),
  summary         text,
  total_checks    integer,
  passed_checks   integer,
  failed_checks   integer,
  created_at      timestamptz default now()
);

-- ============================================================
-- AUDIT TRAIL
-- ============================================================

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid references invoices(id) on delete set null,
  action      text not null,          -- e.g. "uploaded","extracted","validated","approved","rejected","rulebook_updated"
  actor       text,                   -- email or "system"
  details     jsonb,
  created_at  timestamptz default now()
);

create index idx_audit_invoice on audit_log(invoice_id);
create index idx_audit_created on audit_log(created_at desc);

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================

create table notification_log (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,         -- "invoice_flagged","rulebook_updated","daily_digest"
  recipients    text[],
  subject       text,
  status        text default 'sent' check (status in ('sent','failed')),
  reference_id  uuid,                  -- invoice_id or rulebook_version_id
  sent_at       timestamptz default now()
);

-- ============================================================
-- SETTINGS TABLE
-- ============================================================

create table app_settings (
  key     text primary key,
  value   text not null,
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values
  ('notification_recipients', '[]'),
  ('auto_notify_on_flag', 'true'),
  ('auto_notify_on_rulebook_update', 'true');

-- ============================================================
-- HELPER VIEWS
-- ============================================================

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
order by i.uploaded_at desc;
