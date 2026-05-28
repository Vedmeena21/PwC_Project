# Invoice Approval Automation System — Mega Reference

> A single, self-contained document covering the entire project: architecture, every
> code file, the data model, the processing pipeline, design decisions, and a Q&A
> section. Paste this into any AI assistant to ask questions and learn the system.

---

## 1. What this system does

An internal **Invoice Approval Automation System** built for a PwC-style corporate
finance workflow. Users (accountants) upload vendor invoices (PDF/DOCX/XLSX/etc.).
The system:

1. **Stores** the file in Supabase Storage.
2. **Extracts** structured data (vendor, date, PO, line items) using a Groq LLM
   (Llama 3.3 70B).
3. **Validates** the extracted line items against an **active rulebook** (approved
   rates, quantity ranges, quality grades) plus an arithmetic check.
4. **Recommends** a verdict (approve / reject / needs_review) with a confidence level.
5. **Routes** to a human admin who makes the final approve/reject decision.
6. **Notifies** configured recipients by email when an invoice is flagged or the
   rulebook changes.

Everything is auditable — every pipeline stage writes to an `audit_log`.

### Roles
- **User** (accountant): uploads invoices, sees only their own uploads.
- **Admin** (manager): sees everything, approves/rejects invoices, manages users,
  edits the rulebook and settings. Separation of duties: the uploader and the
  approver are different people.

---

## 2. Tech stack

| Layer        | Technology                                                        |
|--------------|-------------------------------------------------------------------|
| Frontend     | React 18 + Vite, React Router v6, Tailwind CSS, Recharts, axios    |
| Backend      | FastAPI (Python), Pydantic, BackgroundTasks                        |
| Database     | Supabase (PostgreSQL). Backend uses the **service_role** key       |
| Auth         | JWT (HS256) via `python-jose`, passwords hashed with `bcrypt`      |
| File storage | Supabase Storage (bucket `invoices`), short-lived signed URLs      |
| LLM          | Groq API, model `llama-3.3-70b-versatile`                          |
| Email        | Resend                                                             |
| Hosting      | Backend on Render (free tier), frontend static build              |

### Brand palette (PwC)
- `#EB8C00` — primary orange
- `#D04A02` — dark orange (hover)
- `#2D2D2D` — charcoal (email headers, wordmark text)

---

## 3. Repository layout

```
PWC_Project/
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py                      # FastAPI app + router registration + CORS
│       ├── core/config.py               # Settings (env vars) + Supabase client
│       ├── models.py                    # All Pydantic models + enums
│       ├── auth/
│       │   ├── service.py               # bcrypt + JWT + user DB helpers
│       │   └── dependencies.py          # require_user / require_admin
│       ├── extraction/extractor.py      # File parsing + Groq extraction pipeline
│       ├── validation/engine.py         # 4 validation checks + verdict logic
│       ├── rulebook/service.py          # Rulebook CRUD + versioning + diff
│       ├── notifications/email.py       # 3 Resend email templates
│       └── api/routes/
│           ├── invoices.py              # Upload, list, detail, review, reprocess, delete
│           ├── auth.py                  # Signup, login, me, user management
│           ├── rulebook.py              # Versions, activate, diff
│           └── settings.py              # Recipients + notification toggles
├── frontend/
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx                      # Routes (flat + AuthLayout Outlet)
│       ├── context/AuthContext.jsx      # JWT + user, localStorage persistence
│       ├── services/api.js              # axios instance + all API wrappers
│       ├── hooks/useApi.js              # Data hooks + Manage badge hook
│       ├── lib/utils.js                 # cn(), formatters, verdict helpers
│       ├── components/
│       │   ├── layout/Sidebar.jsx       # Nav + Manage badge + profile chip
│       │   └── ui/ (StatusBadge, UploadZone, Toast, Skeleton, ...)
│       └── pages/
│           ├── Dashboard.jsx            # Stat cards, pie chart, how-it-works, recent
│           ├── Invoices.jsx             # Filterable/paginated list
│           ├── InvoiceDetail.jsx        # Detail + verdict banner + awaiting-review
│           ├── Manage.jsx               # Pending users + invoices awaiting review + all users
│           ├── Rulebook.jsx             # Version list + create + activate + diff
│           ├── Settings.jsx             # Recipients + toggles
│           └── Login.jsx                # Login + signup request
└── supabase/migrations/                 # 001–007 SQL migrations
```

---

## 4. Data model (SQL)

Migration `001_initial_schema.sql` defines the core schema; later migrations refine it.

### Tables

- **`rulebook_versions`** — `id, version, label, created_at, created_by, notes, is_active`.
  `unique(label, version)`. Exactly one version has `is_active = true` at a time.
- **`rulebook_rules`** — `id, version_id (FK cascade), item_category, rule_key,
  rule_value (text), unit, description`. One rule = one
  `(item_category, rule_key)` pair, e.g. `("steel_rod", "approved_rate_per_mt") = "54500"`.
- **`invoices`** — `id, invoice_number, vendor_name, vendor_email, invoice_date,
  po_reference, pdf_path, pdf_url, status, uploaded_at, reviewed_at, reviewed_by,
  reviewer_notes, rulebook_version_id (FK), uploaded_by (FK users), original_filename`.
  `status check in ('pending','processing','approved','rejected','flagged','extraction_failed')`.
- **`invoice_line_items`** — extracted items: `quantity, quantity_unit, unit_rate,
  rate_unit, total_value, dimensions (jsonb), quality_grade, item_category, ...`.
- **`validation_results`** — per-check rows: `check_name, check_label, passed,
  expected_value, actual_value, message, severity ('error'|'warning'|'info')`.
- **`invoice_recommendations`** — one per invoice (`unique invoice_id`): `verdict,
  confidence, summary, total_checks, passed_checks, failed_checks`.
- **`audit_log`** — `invoice_id (FK set null), action, actor, details (jsonb), created_at`.
- **`notification_log`** — `type, recipients, subject, status, reference_id, sent_at`.
- **`app_settings`** — key/value: `notification_recipients` (JSON array string),
  `auto_notify_on_flag`, `auto_notify_on_rulebook_update`.
- **`users`** (migration 006) — `id, email, password_hash, name, role ('user'|'admin'),
  status ('pending'|'approved'|'rejected'), signup_note, created_at, approved_at,
  approved_by`. Deleting a user sets their invoices' `uploaded_by` to NULL
  (`ON DELETE SET NULL`) so history is preserved.

### View: `invoice_summary`
Joins `invoices` + `invoice_recommendations` + `rulebook_versions` so the list/detail
endpoints get recommendation fields (verdict, confidence, summary, checks counts) and
the rulebook label inline in a single query.

### Migrations
1. `001_initial_schema` — all core tables + `invoice_summary` view + seed settings.
2. `002_rename_month_year_to_label` — rulebook versions keyed by free-text `label`.
3. `003_fix_invoice_number_unique` — unique constraint on `(invoice_number, vendor_name)`.
4. `004_seed_initial_rulebook` — seeds a starting rulebook version + rules.
5. `005_enable_rls` — Row Level Security (backend bypasses via service_role key).
6. `006_users_and_ownership` — `users` table + `invoices.uploaded_by`.
7. `007_add_original_filename` — `invoices.original_filename` for display.

---

## 5. Backend code

### 5.1 `core/config.py`
Pydantic `Settings` loads from `.env`. Key vars: `supabase_url`,
`supabase_service_key`, `supabase_storage_bucket`, `groq_api_key`, `groq_model`,
`resend_api_key`, `resend_from_email/name`, `frontend_url`, `jwt_secret`,
`jwt_algorithm` (HS256), `jwt_expire_hours` (7 days), `admin_email`.
`get_settings()` and `get_supabase()` are `@lru_cache`d singletons. The Supabase
client uses the **service_role** key (bypasses RLS) — **backend only, never exposed
to the frontend**.

### 5.2 `models.py`
- Enums: `InvoiceStatus`, `Verdict (approve|reject|needs_review)`,
  `Confidence (high|medium|low)`.
- `ExtractedInvoiceData` + `LineItemExtracted` — extraction output shape.
- `ValidationCheck` — one check result (`severity` "error" blocks approval, "warning"
  does not).
- `InvoiceRecommendation` — aggregated verdict.
- `InvoiceSummary` — list/detail row shape.
- `ReviewAction` — `{ action, reviewer_name (Optional, unused), notes (Optional) }`.
  **`reviewer_name` is intentionally optional** — reviewer identity comes from the JWT.
  (This was a bug once: it used to be required, causing silent 422s on approve.)
- Rulebook models: `RuleEntry`, `RulebookVersion`, `RulebookCreateRequest`,
  `RuleDiff`, `RulebookDiffResult`.

### 5.3 `auth/service.py`
- `hash_password` / `verify_password` — bcrypt (rounds=12).
- `create_access_token(user_id, role)` / `decode_access_token` — HS256 JWT carrying
  `sub` (user id), `role`, `exp`.
- `get_user_by_email` / `get_user_by_id` — DB lookups.
- `public_user` — strips `password_hash` before returning a user over the API.

> Security note: even though the JWT carries the role, the backend **re-fetches the
> user from the DB on every request** so a deleted/banned user can't keep using a
> still-valid token.

### 5.4 `auth/dependencies.py`
- `require_user` — decodes the bearer token, re-fetches the user, ensures
  `status == 'approved'`.
- `require_admin` — `require_user` + `role == 'admin'`.

### 5.5 `extraction/extractor.py`
- Routes by file extension to the correct parser (PDF, DOCX, XLSX, CSV, JSON, TXT).
- Builds a structured prompt and calls Groq (`llama-3.3-70b-versatile`) to return
  JSON matching `ExtractedInvoiceData`.
- Returns placeholders (`UNKNOWN` / `Unknown Vendor`) when extraction can't find a
  field — these are later used to skip duplicate detection.
- `SUPPORTED_EXTENSIONS` gate is enforced at upload.

### 5.6 `validation/engine.py`
Four checks per line item:
1. **Arithmetic** — `unit_rate × quantity ≈ total_value` within 1% tolerance.
   Missing operands → `warning` (doesn't auto-reject).
2. **Rate** — invoiced `unit_rate` vs rulebook `approved_rate_per_mt`/`approved_rate`
   within tolerance. Skipped if no rule.
3. **Quantity** — within `[min_quantity, max_quantity]`. Skipped if no bounds.
4. **Quality grade** — invoiced grade ∈ comma-separated `required_quality_grade`.

Verdict logic (`validate_invoice`):
- No checks ran at all → `needs_review` / low confidence.
- No **error-severity** failures → `approve`; high confidence if ≥3 checks ran, else medium.
- Exactly one error failure → `reject` / high.
- Multiple error failures → `reject` / high (summary lists all).

Rules are indexed `{category: {rule_key: value, rule_key_unit: unit}}` for O(1)
lookup; a line item with no category-specific rules falls back to the `other` category.

### 5.7 `rulebook/service.py`
- `get_active_rulebook`, `get_rulebook_by_id`, `list_rulebook_versions` (2-query
  assembly, no N+1).
- `create_rulebook_version` — auto-increments `version` per label; inactive until
  activated.
- `activate_rulebook` — deactivates **all** versions, then activates the chosen one
  (guarantees exactly one active).
- `diff_rulebook_versions` — indexes both versions by `(category, key)` and produces
  added / modified / removed `RuleDiff`s plus totals + activation metadata.

### 5.8 `notifications/email.py`
Three Resend templates sharing a PwC-branded shell (charcoal header with `Pw` white +
`C` orange wordmark, 4px orange bottom border, footer "PricewaterhouseCoopers ·
Invoice Approval System · Internal use only"). Email send failures are swallowed so
they never crash the pipeline.
1. **Invoice flagged** — per-check breakdown + "Review Invoice" link. Sent to
   configured recipients when AI verdict ≠ approve and `auto_notify_on_flag` is on.
2. **Rulebook updated** — colour-coded diff table (NEW/CHANGED/REMOVED) + activation
   metadata. Sent on activation when there was a prior active version and
   `auto_notify_on_rulebook_update` is on.
3. **Signup request** — sent to `admin_email`; shows applicant name/email, status
   pill, and a single "Note from applicant" block (no duplicate label).

### 5.9 `api/routes/invoices.py`
- `POST /invoices/upload` — validates extension + size (≤10 MB), uploads to storage,
  caches a 7-day signed URL, creates the invoice row with placeholders + `uploaded_by`
  + `original_filename`, then kicks off `_process_invoice` as a **BackgroundTask** and
  returns immediately (status `processing`).
- `_process_invoice` pipeline stages:
  1. mark `processing`,
  2. extract,
  3. **duplicate detection** — same `(invoice_number, vendor_name)` already on file →
     reject immediately (prevents double-payment),
  4. backfill header fields,
  5. replace line items,
  6. load active rulebook + link version,
  7. validate,
  8. persist checks + recommendation,
  9. final status: `flagged` if verdict ≠ approve, else `pending` (awaiting human),
  10. send flagged email if enabled.
  Any exception → status `extraction_failed`.
- `GET /invoices/` — uses `invoice_summary`, supports status/search/limit/offset.
  **Ownership scoping**: non-admins always see only their own; admins see all but can
  pass `view=mine`.
- `GET /invoices/stats/summary` — per-status counts grouped in Python (the Supabase
  client's `head=True` count is unreliable).
- `GET /invoices/activity/recent` — recent audit-log feed joined with invoice info.
- `GET /invoices/{id}` — full detail (metadata + line items + checks + audit trail);
  `_assert_can_access` blocks cross-user access (404, not 403, to avoid leaking ids).
- `POST /invoices/{id}/reprocess` — re-runs the pipeline; if a recommendation already
  exists (status update had failed), just corrects the status.
- `POST /invoices/{id}/review` — **admin only**; sets status to approved/rejected,
  `reviewed_by = admin name/email` (from JWT), `reviewer_notes`.
- `GET /invoices/{id}/file-url` — fresh 1-hour signed URL.
- `DELETE /invoices/{id}` — owner/admin; removes storage object + row (cascade handles
  children).

### 5.10 `api/routes/auth.py`
- `POST /signup` — creates `status=pending` user + emails admin. **If a previously
  rejected account exists for the email, it's reset to pending** (re-application
  allowed) instead of returning 409.
- `POST /login` — returns JWT; pending/rejected accounts get a clear 403.
- `GET /me` — current user (frontend restores session on boot).
- `GET /users/pending`, `GET /users` — admin queues/lists.
- `POST /users` — admin direct-create (auto-approved).
- `POST /users/{id}/approve|reject`, `DELETE /users/{id}` — admin actions
  (can't delete self).

### 5.11 `api/routes/rulebook.py` & `settings.py`
- Rulebook: list, active, get, create (admin), activate (admin, sends diff email),
  diff. Activation captures the previous active version **before** switching for the diff.
- Settings: `GET /` (all), `GET/PUT /recipients` (full-list replacement, JSON array),
  `PUT /{key}` (only `auto_notify_on_flag` / `auto_notify_on_rulebook_update` are
  editable — allowlist guards against arbitrary writes).

---

## 6. Frontend code

### 6.1 `App.jsx`
Flat routes inside `BrowserRouter > AuthProvider > ToastProvider`. `/login` is public.
All others render through `AuthLayout` = `ProtectedRoute > Layout > Outlet`. `/manage`
is additionally wrapped in `ProtectedRoute adminOnly`.

### 6.2 `context/AuthContext.jsx`
Holds `token` + `user`, persisted to `localStorage` (`ias_token`, `ias_user`). Syncs
the axios `Authorization` header whenever the token changes. Exposes `login`, `logout`,
`isAdmin`, `isLoggedIn`.

### 6.3 `services/api.js`
axios instance (60s timeout). Request interceptor injects the bearer token (falling
back to localStorage for the first request on load). Response interceptor unwraps
`.data`, normalises errors to friendly messages (cold-start/network/timeout/413/404),
and on **401 clears storage and redirects to /login**. Exports `invoiceApi`,
`rulebookApi`, `settingsApi`, `authApi`, and a `wakeBackend()` health ping (Render free
tier sleeps after 15 min).

### 6.4 `hooks/useApi.js`
- `useInvoices(filters)` — list + total + refetch; `limit: 0` short-circuits to empty
  (used by hover popovers when closed).
- `useInvoice(id)` — detail; **auto-polls every 3s while status is `processing`**
  (capped at 60 attempts ≈ 3 min). Note: `pending` is NOT polled — a pending invoice
  with a verdict is awaiting human review, not still processing.
- `useStats(view)` — dashboard counts.
- `useManageBadge(isAdmin)` — total actionable count (pending users + flagged +
  pending invoices). Polls every 30s and instant-refreshes on a `manage:action`
  window event. **Always called** (skips fetch inside if not admin) to respect the
  Rules of Hooks.
- `notifyManageAction()` — dispatches `manage:action` so the sidebar badge updates the
  moment an action completes.
- `useRulebookVersions`, `useActiveRulebook`.

### 6.5 Pages
- **Dashboard** — 5 stat cards (Total, Approved, Rejected, Flagged, Pending Review)
  with hover popovers (desktop) / tap drawers (mobile); a status pie chart keyed by
  **name** (so colours stay stable when a slice is filtered out); a 2×2 "How It Works"
  grid; a recent-invoices table. Admin view toggle All/Mine.
- **Invoices** — search (debounced 300ms), status filter tabs (extraction_failed
  hidden), pagination (10/page), admin All/Mine toggle, inline upload.
- **InvoiceDetail** — verdict/processing/failed banner, metadata, source-file signed
  link, extracted line items, validation checks. When status is `flagged` or `pending`
  it shows an **amber "Awaiting Human Review" banner** that links admins to Manage —
  the actual approve/reject happens on the Manage page, not here. Delete is admin-only
  with an inline two-step confirm.
- **Manage** (admin) — three sections: **Pending Approval** (user signup cards),
  **Invoices Awaiting Review** (flagged + pending invoices, with AI verdict + summary),
  and **All Users** + add-user form. Uses **optimistic UI** everywhere (see §7).
- **Rulebook** — active banner, version list (whole row clickable to expand rules),
  create form (admin), activate, "Diff vs Active".
- **Settings** — notification recipients (add/remove modal) + two notification toggles.
  Read-only for non-admins.
- **Login** — login + signup-request forms. Signup sends `note` (matches backend
  `SignupBody.note`).

### 6.6 `components/layout/Sidebar.jsx`
Desktop sidebar + mobile top/bottom bars. Manage nav item shows a red badge with the
`useManageBadge` count. Profile chip with sign-out.

### 6.7 `lib/utils.js`
`cn` (clsx + tailwind-merge), `formatCurrency` (en-IN / INR), `formatDate`,
`formatDateTime`, and verdict colour/label helpers.

---

## 7. Key design decisions & "why"

- **Optimistic UI in Manage.** Render's free tier is slow, so every action (approve
  user, reject user, delete user, approve/reject invoice) updates local state
  **immediately** and calls the API in the background. On error it re-fetches to
  restore. Components that unmount on success (rows) set a `done`/`loading` flag and
  never call `setLoading(false)` on success (the component is gone) — this fixed an
  infinite-spinner bug. Re-fetches are delayed ~1.5s so the server has time to commit
  before the list reloads (avoids the row "toggling back").
- **`reviewer_name` is optional.** The reviewer is taken from the JWT. It was once
  required and the frontend didn't send it → silent 422 → invoice stayed pending. Now
  optional and unused.
- **Poll only on `processing`.** A `pending` invoice already has an AI verdict and is
  waiting on a human, so polling it forever was wrong. Fixed to poll `processing` only.
- **Status flow:** `pending → processing → flagged | pending → approved | rejected`,
  plus `extraction_failed`. "flagged" = AI recommends reject/review; the second
  "pending" = AI approved but a human must still sign off.
- **Pie colours keyed by name, not position.** Filtering out zero-value slices used to
  shift positional colours; keying by status name keeps them stable.
- **Re-signup after rejection.** Signup updates a rejected record back to pending
  instead of erroring — users can re-apply without admin intervention.
- **Ownership returns 404, not 403** for other users' invoices — doesn't leak which
  ids exist.
- **service_role key backend-only.** RLS is enabled but the backend bypasses it; the
  frontend never sees the key.

---

## 8. Environment variables

Backend `.env` (and Render env):
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...            # backend only — never in frontend
SUPABASE_STORAGE_BUCKET=invoices
GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile
RESEND_API_KEY=...
RESEND_FROM_EMAIL=invoices@yourdomain.com
RESEND_FROM_NAME=Invoice Approval System
FRONTEND_URL=https://<your-frontend>
JWT_SECRET=<strong-random-secret>   # must be set in Render
JWT_ALGORITHM=HS256
ADMIN_EMAIL=<admin email>           # signup notifications go here
```

Frontend build env:
```
VITE_API_URL=https://<backend>/api  # dev uses the Vite proxy /api → :8000
```

---

## 9. Local development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev            # http://localhost:5173, proxies /api → :8000
npm run build          # production build into dist/
```

---

## 10. Q&A (common questions about this project)

**Q: What does "Human Review" actually check?**
A: Nothing new is computed at review time. The AI already ran extraction + the four
rulebook validation checks and produced a verdict. "Human Review" is the admin
confirming or overriding that AI verdict — the final approve/reject decision, logged
to the audit trail.

**Q: Why are there two "pending-ish" states?**
A: `flagged` = the AI found problems and recommends reject/review. `pending` (after
processing) = the AI recommends approve but a human still has to sign off. Both appear
in Manage's "Invoices Awaiting Review" queue.

**Q: Where does approve/reject happen — the detail page or Manage?**
A: Manage. InvoiceDetail only shows an "Awaiting Human Review" banner linking admins to
Manage. The detail page is read-only for the decision.

**Q: How is a duplicate invoice detected?**
A: During processing, if another invoice already exists with the same
`(invoice_number, vendor_name)`, the new one is rejected immediately with a
`duplicate_check` failure. Placeholder extraction values are skipped so failed
extractions aren't treated as duplicates.

**Q: Why does the first request after idle feel slow?**
A: Render's free tier sleeps after ~15 min. `wakeBackend()` pings `/health` on app
load; the axios layer also shows a friendly "server is waking up" message on a network
error/timeout.

**Q: How are users authenticated and authorised?**
A: JWT (HS256) carrying user id + role, 7-day expiry. The backend re-fetches the user
on every request (so deleted/banned users are locked out even with a valid token) and
requires `status == 'approved'`. Admin-only endpoints additionally check the role.

**Q: How do rulebook versions work?**
A: Each `(label, version)` is unique; `version` auto-increments per label. New versions
are inactive until explicitly activated. Activation deactivates all others (exactly one
active), links new invoices to that version, and emails a diff. Old invoices keep the
version they were validated against.

**Q: What blocks an approval — warnings or errors?**
A: Only `error`-severity check failures. `warning` (e.g. missing operands for the
arithmetic check) does not auto-reject.

**Q: Why is `reviewer_name` in `ReviewAction` if it's unused?**
A: Historical. Reviewer identity now comes from the JWT. It's kept optional for
backward compatibility; making it required once caused silent 422 errors on approve.
