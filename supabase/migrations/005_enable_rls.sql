-- ============================================================
-- Enable Row-Level Security on all public tables
-- ============================================================
-- The backend connects with the service_role key, which bypasses RLS
-- automatically. Enabling RLS with no policies means the anon/public role
-- cannot read or write any row — direct Supabase REST/Realtime access via
-- the anon key is blocked, but all backend operations continue to work.
--
-- If you ever expose the anon key client-side (e.g. for client-side reads),
-- add explicit policies below per table.
-- ============================================================

alter table rulebook_versions      enable row level security;
alter table rulebook_rules         enable row level security;
alter table invoices               enable row level security;
alter table invoice_line_items     enable row level security;
alter table validation_results     enable row level security;
alter table invoice_recommendations enable row level security;
alter table audit_log              enable row level security;
alter table notification_log       enable row level security;
alter table app_settings           enable row level security;

-- Views inherit RLS from their underlying tables, so invoice_summary
-- is automatically protected once the tables above are locked down.
