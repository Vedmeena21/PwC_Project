-- ============================================================
-- Stage 1 — Real per-user accounts + invoice ownership
-- ============================================================
-- Replaces the shared-password / admin-token model with proper
-- account-based auth. After this migration:
--   - Users sign up and wait for admin approval
--   - Each invoice is owned by the user who uploaded it
--   - Admin can see all invoices; users see only their own
-- ============================================================

-- Wipe existing invoice data (chosen at planning time — start fresh
-- with ownership tracking from day one rather than backfilling).
delete from notification_log;
delete from audit_log         where invoice_id is not null;
delete from invoice_recommendations;
delete from validation_results;
delete from invoice_line_items;
delete from invoices;

-- ============================================================
-- USERS
-- ============================================================
create table users (
  id              uuid primary key default gen_random_uuid(),
  email           text unique not null,
  password_hash   text not null,
  name            text,
  role            text not null default 'user'
                  check (role in ('user', 'admin')),
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  signup_note     text,  -- optional, shown to admin in the approval queue
  created_at      timestamptz default now(),
  approved_at     timestamptz,
  approved_by     uuid references users(id) on delete set null,

  -- 150-char limit enforced at the DB layer to match the frontend hint
  constraint signup_note_length
    check (signup_note is null or char_length(signup_note) <= 150)
);

create index idx_users_status on users(status);
create index idx_users_email  on users(email);

alter table users enable row level security;

-- ============================================================
-- Seed initial admin
-- ============================================================
-- email:    ved@example.com
-- password: ved123  (bcrypt rounds=12)
-- Change this password from the UI after first login.
insert into users (email, password_hash, name, role, status, approved_at)
values (
  'ved@example.com',
  '$2b$12$07GgPatkEtq741OXCdajiO7w0hcvNPayjel47SLTFjhZ.dMZ0ik.G',
  'Ved Meena',
  'admin',
  'approved',
  now()
);

-- ============================================================
-- INVOICE OWNERSHIP
-- ============================================================
-- nullable on purpose: legacy / system-created rows can have no owner,
-- and they remain visible only to admins via "Admin view".
alter table invoices add column uploaded_by uuid
  references users(id) on delete set null;

create index idx_invoices_uploaded_by on invoices(uploaded_by);

-- ============================================================
-- Recreate invoice_summary view to surface uploaded_by + uploader name
-- ============================================================
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
