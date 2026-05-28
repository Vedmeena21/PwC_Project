# PwC Invoice Approval System

An end-to-end automated invoice processing platform built for PricewaterhouseCoopers. Invoices are uploaded, parsed by AI, validated against a versioned rulebook, and routed to human reviewers — with a full audit trail at every step.

**Live demo:** [pwc-ved-project.vercel.app](https://pwc-ved-project.vercel.app)

---

## Overview

| | |
|---|---|
| **Frontend** | React + Vite + Tailwind CSS → Vercel |
| **Backend** | FastAPI → Render |
| **Database** | Supabase (PostgreSQL + Storage) |
| **AI Extraction** | Groq — Llama 3.3 70B |
| **Email** | Resend |
| **Auth** | JWT (HS256) + Google OAuth |

---

## How It Works

```
Upload PDF
    │
    ▼
pdfplumber / docx / xlsx parser
    │
    ▼
Groq Llama 3.3 70B  ──►  Structured JSON (vendor, date, line items, PO)
    │
    ▼
Validation Engine
    ├── Arithmetic check   (rate × qty = total)
    ├── Rate check         (vs. active rulebook)
    ├── Quantity check     (min / max bounds)
    └── Quality grade check
    │
    ▼
Verdict  ──►  flagged (issues found) | pending (AI approved)
    │
    ▼
Admin reviews in Manage page  ──►  approved | rejected
    │
    ▼
Audit trail + email notification
```

---

## Features

- **AI extraction** — Groq LLM extracts vendor, invoice number, date, PO reference, and all line items from PDF, DOCX, XLSX, and plain text files
- **Versioned rulebook** — admins create and activate approval criteria per item category; diff view shows exactly what changed between versions
- **Admin approval flow** — users sign up and wait for admin approval before accessing the system; Google OAuth supported
- **Duplicate detection** — invoices with the same number + vendor are auto-rejected before validation runs
- **Optimistic UI** — all admin actions (approve, reject, delete) update the interface instantly without waiting for the API
- **Real-time badge** — Manage sidebar shows a live count of pending actions, polling every 30 seconds
- **Email notifications** — PwC-branded emails sent on invoice flagging, rulebook activation, and new user signup
- **Full audit trail** — every pipeline event is logged with actor and timestamp

---

## Project Structure

```
PWC_Project/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, router registration, CORS
│   │   ├── models.py               # All Pydantic models
│   │   ├── core/
│   │   │   └── config.py           # Settings (env vars), Supabase client
│   │   ├── auth/
│   │   │   ├── service.py          # bcrypt, JWT issue/verify, DB helpers
│   │   │   └── dependencies.py     # require_user, require_admin FastAPI deps
│   │   ├── extraction/
│   │   │   └── extractor.py        # File parsing + Groq LLM extraction
│   │   ├── validation/
│   │   │   └── engine.py           # Arithmetic, rate, quantity, quality checks
│   │   ├── rulebook/
│   │   │   └── service.py          # Version CRUD, activate, diff
│   │   ├── notifications/
│   │   │   └── email.py            # Resend HTML email templates
│   │   └── api/routes/
│   │       ├── invoices.py         # Upload, list, review, delete endpoints
│   │       ├── auth.py             # Login, signup, Google OAuth, user mgmt
│   │       ├── rulebook.py         # Rulebook version endpoints
│   │       └── settings.py         # App settings + notification recipients
│   ├── requirements.txt
│   └── render.yaml
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Routes (React Router v6)
│   │   ├── context/AuthContext.jsx # JWT storage, login/logout
│   │   ├── services/api.js         # Axios instance, all API calls
│   │   ├── hooks/useApi.js         # Data fetching hooks, badge polling
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx       # Stats, upload, pie chart, activity feed
│   │   │   ├── Invoices.jsx        # Paginated list with search + filters
│   │   │   ├── InvoiceDetail.jsx   # Full detail, checks, audit trail
│   │   │   ├── Manage.jsx          # Pending users + invoices awaiting review
│   │   │   ├── Rulebook.jsx        # Version list, create, activate, diff
│   │   │   ├── Settings.jsx        # Notification toggles + recipients
│   │   │   └── Login.jsx           # Email/password + Google OAuth
│   │   ├── components/
│   │   │   ├── layout/             # Sidebar (with badge), Layout
│   │   │   └── ui/                 # StatusBadge, UploadZone, Toast, Skeleton
│   │   └── lib/utils.js            # cn(), formatDate, formatCurrency
│   └── package.json
└── supabase/
    └── migrations/                 # 007 SQL migrations (schema + RLS)
```

---

## Invoice Status Flow

```
pending  ──►  processing  ──►  flagged   ──►  rejected
                          │                     ▲
                          └──►  pending   ──►  approved
                                (AI ok)
```

- `pending` — just uploaded, waiting for background task
- `processing` — pipeline running (extraction + validation)
- `flagged` — AI found issues; human must decide
- `pending` (post-AI) — AI recommends approval; human must confirm
- `approved` / `rejected` — final human decision
- `extraction_failed` — pipeline error; can be reprocessed

---

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 18+
- Supabase, Groq, and Resend accounts (all free)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

Create `backend/.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
GROQ_API_KEY=gsk_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=invoices@yourdomain.com
JWT_SECRET=change-me-in-production
ADMIN_EMAIL=you@example.com
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=                          # optional — leave empty to disable Google login
```

```bash
uvicorn app.main:app --reload
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_URL=                              # leave empty in dev (Vite proxy handles it)
VITE_GOOGLE_CLIENT_ID=                     # optional
```

```bash
npm run dev
# App: http://localhost:5173
```

### Database

1. Create a project at [supabase.com](https://supabase.com)
2. SQL Editor → run each file in `supabase/migrations/` in order (001 → 007)
3. Storage → create a bucket named `invoices`
4. Copy Project URL and service role key into `backend/.env`

---

## Deployment

### Backend → Render

1. New Web Service → connect GitHub repo → Root Directory: `backend/`
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Add all env vars from the list above in the Render dashboard

### Frontend → Vercel

1. Import project from GitHub → Root Directory: `frontend/`
2. Add environment variables:
   - `VITE_API_URL` = `https://your-backend.onrender.com/api`
   - `VITE_GOOGLE_CLIENT_ID` = your Google OAuth client ID (optional)
3. Deploy

### Google OAuth (optional)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID → Web application
3. Authorized JavaScript origins: `https://your-frontend.vercel.app` and `http://localhost:5173`
4. Set `GOOGLE_CLIENT_ID` on Render and `VITE_GOOGLE_CLIENT_ID` on Vercel

---

## API Reference

Full interactive docs at `/docs` (Swagger UI).

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/login` | Email + password login | Public |
| `POST` | `/auth/signup` | Request access | Public |
| `POST` | `/auth/google` | Google OAuth login | Public |
| `GET` | `/auth/me` | Current user | User |
| `GET` | `/auth/users/pending` | Pending approval queue | Admin |
| `POST` | `/auth/users/{id}/approve` | Approve a user | Admin |
| `POST` | `/auth/users/{id}/reject` | Reject a user | Admin |
| `POST` | `/invoices/upload` | Upload invoice file | User |
| `GET` | `/invoices/` | List invoices (paginated) | User |
| `GET` | `/invoices/{id}` | Invoice detail + checks | User |
| `POST` | `/invoices/{id}/review` | Approve or reject invoice | Admin |
| `POST` | `/invoices/{id}/reprocess` | Retry failed extraction | User |
| `DELETE` | `/invoices/{id}` | Delete invoice | Admin |
| `GET` | `/invoices/stats/summary` | Per-status counts | User |
| `GET` | `/invoices/activity/recent` | Recent audit log | User |
| `GET` | `/rulebook/` | All rulebook versions | User |
| `GET` | `/rulebook/active` | Currently active version | User |
| `POST` | `/rulebook/` | Create new version | Admin |
| `POST` | `/rulebook/{id}/activate` | Activate version | Admin |
| `GET` | `/rulebook/{a}/diff/{b}` | Diff two versions | Admin |
| `GET` | `/settings/` | All app settings | Public |
| `PUT` | `/settings/recipients` | Update email recipients | Admin |

---

## Rulebook Schema

Rules are keyed by `item_category` (e.g. `steel_rod`, `cement`) and `rule_key`:

| Rule Key | Description | Example |
|----------|-------------|---------|
| `approved_rate_per_mt` | Approved unit rate | `54500` |
| `approved_rate_per_mt_unit` | Unit label | `INR/MT` |
| `min_quantity` | Minimum quantity | `5` |
| `max_quantity` | Maximum quantity | `500` |
| `required_quality_grade` | Accepted grades (comma-separated) | `IS2062 E250, IS2062 E350` |

---

## Security Notes

- `SUPABASE_SERVICE_KEY` is backend-only — never exposed to the frontend
- `JWT_SECRET` must be set to a strong random string in production
- All Supabase tables have RLS enabled; the backend uses the service role key to bypass RLS intentionally
- Regular users can only see their own invoices; ownership is enforced at the query level, not just RLS
- Google OAuth users go through the same admin-approval gate as email/password signups
