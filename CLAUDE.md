# Landis Assessments — Full Project Context

## What This App Is

**Landis Assessments** is an internal web application for Landis IT (an MSP) used by 2–5 staff members to conduct structured IT security and onboarding assessments for SMB clients. It is staff-only — customers only interact via optional shareable one-time links.

**Core use case:** A Landis technician opens the app, picks a customer, selects a template (Security or Onboarding), answers ~12–25 Yes/No/Maybe questions, and gets an auto-scored 0–100 report they can export to PDF.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui + Recharts |
| ORM | Drizzle ORM |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (jose) + httpOnly cookies + Argon2id + TOTP MFA + OIDC SSO |
| PDF | @react-pdf/renderer |
| Deployment | Docker + Docker Compose |
| Registry | ghcr.io/happytree92/landisassessments:latest |

---

## Repo & Deployment

- **GitHub:** https://github.com/happytree92/LandisAssessments.git
- **Deploy push:** `./push.sh "what you changed"` — commits, pushes; GitHub Actions builds Docker image
- **On server:** Pull new image and redeploy in Portainer
- **Default login:** admin / changeme123
- **SQLite location (server):** `/volume2/docker/landisapp/data/assessments.db`
- **Data volume** is never touched by Docker rebuilds
- **Middleware file** is named `proxy.ts` (not `middleware.ts`) — intentional quirk

### Environment Variables

```
JWT_SECRET=replace-this-32-chars-min
DATABASE_URL=./data/assessments.db
BASE_URL=https://assessments.example.com
```

---

## Database Schema (Drizzle + SQLite, 8 tables)

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| username | TEXT UNIQUE | login name |
| password_hash | TEXT | Argon2id (or bcrypt for legacy) |
| display_name | TEXT | shown in UI |
| role | TEXT | `"admin"` \| `"staff"` |
| is_active | INTEGER | 0=inactive, 1=active |
| email | TEXT | from OIDC |
| sso_provider | TEXT | `"oidc"` or null |
| external_id | TEXT | OIDC sub claim |
| mfa_secret | TEXT | base32 TOTP secret |
| mfa_enabled | INTEGER | 0=off, 1=on |
| mfa_enforced | INTEGER | admin-required MFA |
| password_changed_at | INTEGER | unix ts; used to invalidate sessions |
| created_at | INTEGER | unix ts |

### `customers`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| name | TEXT | company name |
| contact_name | TEXT | |
| contact_email | TEXT | |
| notes | TEXT | freeform |
| created_at | INTEGER | unix ts |
| updated_at | INTEGER | unix ts |

### `assessments`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| customer_id | INTEGER FK | → customers.id |
| conducted_by | INTEGER FK | → users.id (nullable) |
| template_id | TEXT | slug: `"security"` \| `"onboarding"` |
| answers | TEXT | JSON: `{ qId: { answer, notes? } }` |
| overall_score | INTEGER | 0–100 |
| category_scores | TEXT | JSON: `{ categoryName: score }` |
| source | TEXT | `"staff"` \| `"customer_link"` |
| completed_at | INTEGER | unix ts; null = draft |
| created_at | INTEGER | unix ts |

### `templates`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| slug | TEXT UNIQUE | `"security"`, `"onboarding"`, or custom |
| name | TEXT | display name |
| description | TEXT | |
| is_active | INTEGER | 0=draft, 1=active |
| deleted_at | INTEGER | soft delete ts |
| created_at | INTEGER | unix ts |

### `questions`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| template_id | INTEGER FK | → templates.id |
| category | TEXT | e.g. "Access Control", "Email Security" |
| text | TEXT | question text |
| weight | INTEGER | 1–10; higher = more score impact |
| yes_score | INTEGER | 0–100 |
| no_score | INTEGER | 0–100 |
| maybe_score | INTEGER | 0–100 |
| sort_order | INTEGER | |
| is_active | INTEGER | |
| created_at | INTEGER | unix ts |

### `settings`
Key/value store for org configuration.

| Key | Purpose |
|-----|---------|
| `org_name` | Organization display name |
| `org_logo` | Base64 data URI of logo |
| `color_primary`, `color_accent`, `color_success`, `color_warning`, `color_danger` | Theme colors |
| `admin_ip_allowlist` | Comma-separated IPs (empty = allow all) |
| `log_retention_days` | 30 \| 90 \| 365 |
| `sso_provider` | `"oidc"` or null |
| `sso_client_id`, `sso_client_secret`, `sso_tenant`, `sso_discovery_url` | OIDC config |

### `assessment_tokens`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| token | TEXT UNIQUE | `crypto.randomUUID()` |
| customer_id | INTEGER FK | → customers.id |
| template_id | TEXT | slug |
| created_by | INTEGER FK | → users.id (nullable) |
| expires_at | INTEGER | unix ts |
| used_at | INTEGER | unix ts; null until submitted |
| submitted_from_ip | TEXT | |
| is_active | INTEGER | 0=revoked |
| created_at | INTEGER | unix ts |

### `activity_logs`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | |
| timestamp | INTEGER | unix ts |
| level | TEXT | `"info"` \| `"warn"` \| `"error"` |
| category | TEXT | `"auth"` \| `"assessment"` \| `"customer"` \| `"user"` \| `"token"` \| `"system"` \| `"access"` |
| action | TEXT | e.g. `"login.success"`, `"assessment.started"` |
| user_id | INTEGER | nullable |
| username | TEXT | nullable |
| ip_address | TEXT | |
| resource_type | TEXT | `"customer"` \| `"assessment"` \| `"user"` |
| resource_id | INTEGER | |
| metadata | TEXT | JSON |

---

## API Routes (30 total)

### Auth (`/api/auth/`)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/auth/login` | POST | No | Username/password → sets JWT cookie; starts MFA pre-auth if needed |
| `/api/auth/logout` | POST | Yes | Clear session cookie |
| `/api/auth/me` | GET | Yes | Current user details |
| `/api/auth/change-password` | POST | Yes | Change password + invalidate all sessions |
| `/api/auth/mfa/setup` | POST | Yes | Initiate TOTP setup (returns QR secret) |
| `/api/auth/mfa/setup/secret` | POST | Yes | Generate new TOTP secret |
| `/api/auth/mfa/enable` | POST | Yes | Confirm + enable TOTP |
| `/api/auth/mfa/disable` | POST | Yes | Disable TOTP |
| `/api/auth/mfa/challenge` | POST | No | Verify TOTP code (pre-auth → full session) |
| `/api/auth/sso/start` | POST | No | Initiate OIDC flow |
| `/api/auth/sso/callback` | POST | No | Handle OIDC callback |

### Customers (`/api/customers/`)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/customers` | GET | Yes | List all customers |
| `/api/customers` | POST | Yes | Create customer |
| `/api/customers/[id]` | GET | Yes | Customer detail + assessment history |
| `/api/customers/[id]` | PATCH | Yes | Update customer |
| `/api/customers/[id]` | DELETE | Yes | Delete customer |

### Assessments (`/api/assessments/`)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/assessments` | POST | Yes | Create draft assessment |
| `/api/assessments/[id]` | GET | Yes | Get completed assessment + answers + scores |
| `/api/assessments/[id]` | PATCH | Yes | Update/complete assessment (calculates scores) |
| `/api/assessments/[id]/pdf` | GET | Yes | Download PDF report |

### Public Assessment Tokens (`/api/assessment-tokens/`)
| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/assessment-tokens` | POST | Yes | Create shareable one-time link |
| `/api/assessment-tokens/[id]` | GET | Yes | Token details + expiry |
| `/api/assessment-tokens/[id]` | PATCH | Admin | Refresh/extend token expiry |

### Public Submit (`/api/assess/`) — No auth
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/assess/[token]` | GET | Fetch questions via one-time token |
| `/api/assess/[token]/submit` | POST | Submit assessment (marks token used, logs IP) |

### Admin (`/api/admin/`) — Admin role required
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/settings` | GET/PATCH | Org settings |
| `/api/admin/users` | GET/POST | List/create staff users |
| `/api/admin/users/[id]` | PATCH/DELETE | Edit/delete user |
| `/api/admin/templates` | GET/POST | List/create templates |
| `/api/admin/templates/[id]` | PATCH/DELETE | Edit/delete template |
| `/api/admin/questions` | GET/POST | List/create questions |
| `/api/admin/questions/[id]` | PATCH/DELETE | Edit/delete question |
| `/api/admin/questions/import` | POST | Bulk import questions (CSV) |
| `/api/admin/questions/export` | GET | Export questions (CSV) |
| `/api/admin/export` | POST | Bulk export assessments/customers (CSV or JSON) |
| `/api/admin/logo` | POST | Upload org logo (stored as base64) |
| `/api/admin/logs` | GET | Paginated, filterable activity logs |

---

## Frontend Pages

### Public
- `/login` — Username/password + MFA challenge

### Staff (authenticated)
- `/` → redirect to `/dashboard`
- `/dashboard` — Stats (customer count, assessments this month), 6-month trend chart, recent assessments
- `/customers` — Customer list with quick actions
- `/customers/new` — Create customer form
- `/customers/[id]` — Customer detail: history table, trendline (if ≥2 assessments)
- `/customers/[id]/edit` — Edit customer
- `/assessments/new` — Select customer + template → creates draft → redirect to conduct
- `/assessments/[id]/conduct` — Stepper form: questions grouped by category, Yes/No/Maybe radios, optional notes, progress bar, Save & Complete
- `/assessments/[id]` — Results: score display, category breakdown bar chart, consultative summary, all Q&A

### Public Assessment (no login)
- `/assess/[token]` — Customer self-assessment via one-time link
- `/assess/complete` — Thank-you page after submission

### Admin (admin role only)
- `/admin` — Dashboard: failed logins (24h), assessments this week, invalid tokens (7d), user count, default password warning
- `/admin/users` — Manage staff users (create, edit role, disable, reset password, delete)
- `/admin/questions` — Manage questions (create, edit, delete, bulk import/export CSV)
- `/admin/templates` — Manage assessment templates
- `/admin/branding` — Org name, logo upload, color theme
- `/admin/sso` — OIDC config (provider URL, client ID/secret, tenant)
- `/admin/ip-allowlist` — Restrict logins to specific IPs
- `/admin/logs` — Filterable activity log viewer with retention settings
- `/admin/export` — Bulk export assessments/customers (CSV, JSON)

### Account
- `/account/security` — Change password, MFA setup/disable

---

## Auth Architecture

**Session flow:**
1. POST `/api/auth/login` → validates creds → if MFA enabled, issues 5-min pre-auth JWT → client posts TOTP code to `/api/auth/mfa/challenge` → issues full 8-hour session JWT
2. JWT stored in httpOnly, sameSite=lax, secure cookie named `session`
3. `requireSession(req)` helper validates cookie + checks `password_changed_at` against DB (invalidates old sessions on password change)
4. `requireAdmin(req)` additionally checks `role === "admin"`

**Rate limiting:** 5 failed attempts per IP → 15-min lockout (in-memory)

**Password hashing:** Argon2id primary; bcrypt legacy with transparent upgrade on next login

**SSO:** OIDC flow (start → provider → callback → create/link user)

---

## Scoring Engine (`/lib/scoring.ts`)

- Each question has a `weight` (1–10) and per-answer scores (`yes_score`, `no_score`, `maybe_score`, all 0–100)
- `N/A` answers are excluded from scoring entirely
- Score per category = weighted average of answered questions in that category
- Overall score = weighted average across all answered questions
- **Color thresholds:** ≥75 green, 50–74 amber, <50 red

---

## Assessment Templates (built-in)

### Security Assessment (~25 questions, 7 categories)
- Access Control (MFA, privileged accounts, offboarding, password managers) — weight 8–10
- Email Security (SPF, DKIM, DMARC, anti-phishing, training) — weight 6–9
- Backup & Recovery (daily backups, offsite, restore tests, M365 backup) — weight 8–10
- Endpoint Security (EDR, disk encryption, patching, app whitelisting) — weight 6–9
- Network Security (firewall, segmentation, VPN/Zero Trust) — weight 5–8
- Incident Response (IR plan, staff awareness, tabletop drills) — weight 5–8
- Compliance & Governance (AUP, annual training) — weight 4–7

### New Customer Onboarding (~12 questions, 5 categories)
- M365 Setup (tenant, user plans, Conditional Access) — weight 7–9
- Documentation (network inventory, credentials, PSA docs) — weight 6–9
- Remote Support (RMM agent, ticketing process) — weight 7–9
- Security Baseline (initial assessment, EDR, cloud backup) — weight 7–10
- Business Continuity (BC discussion) — weight 6–8

---

## Key Components

### Assessment Flow
- `AssessmentConductForm` — Stepper with progress bar, category grouping, Yes/No/Maybe radios, notes textarea
- `ScoreCard` — Circular 0–100 score display, color-coded
- `CategoryBreakdown` — Horizontal bar chart (Recharts) per-category scores
- `Trendline` — Line chart (Recharts) score history over time
- `ExportPDFButton` — Triggers PDF generation + download
- `PublicAssessmentForm` — Token-based public submit (same UI as staff conduct)

### Customer Management
- `CustomerForm` — Create/edit customer
- `ShareAssessmentModal` — Generate one-time assessment link (creates token)
- `DeleteCustomerButton` — Confirmation modal + delete

### Admin
- `UsersManager` — Full user CRUD with role/status management
- `QuestionsTable` — Questions list with edit/delete
- `CSVImport` — Bulk question import
- `BrandingForm` — Org name, logo, colors
- `SsoSettings` — OIDC provider configuration
- `LogsViewer` — Filterable activity log viewer with pagination
- `BulkExportForm` — Export assessments/customers
- `AdminSidebar` — Admin section nav

### Layout/Nav
- `TopNav` — Header with logo, nav links, user menu
- `UserMenu` — Dropdown: change password, MFA, logout

### Reports
- `AssessmentReport` — `@react-pdf/renderer` PDF template

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| Password hashing | Argon2id (`@node-rs/argon2`), bcrypt legacy upgrade |
| Session tokens | 8-hour JWT (jose), httpOnly cookie |
| MFA | TOTP (otplib), optional per-user, enforceable by admin |
| SSO | OIDC/OAuth2 (configurable) |
| Rate limiting | 5 attempts/15-min lockout, in-memory per IP |
| Session invalidation | Password change updates `password_changed_at`, old tokens rejected |
| IP allowlist | Optional login restriction (settings table) |
| CSP headers | `Content-Security-Policy` on all routes |
| Security headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` |
| SQL injection | Drizzle ORM parameterized queries |
| Timing-safe login | Always hashes password (no early exit on user-not-found) |
| Activity logging | All significant actions logged with level/category/action/IP/metadata |

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/db/schema.ts` | Drizzle table definitions |
| `lib/auth.ts` | JWT sign/verify helpers |
| `lib/api-auth.ts` | `requireSession()`, `requireAdmin()` helpers |
| `lib/scoring.ts` | Score calculation engine |
| `lib/questions.ts` | Built-in question definitions |
| `lib/password.ts` | Argon2id/bcrypt hash+verify |
| `lib/login-rate-limit.ts` | In-memory rate limiter |
| `proxy.ts` | Next.js middleware (route protection, IP allowlist) |
| `next.config.ts` | `output: "standalone"`, security headers, external packages |
| `Dockerfile` | Multi-stage build (deps → builder → runner) |
| `docker-compose.yml` | Port 3000, data volume, env vars |
| `push.sh` | Git add/commit/push shortcut |

---

## Sprints Completed

| Sprint | Feature |
|--------|---------|
| 1 | Project setup, auth, basic customers |
| 2 | Assessment conduction + scoring |
| 3 | Templates + questions management |
| 4 | PDF export |
| 5 | Public shareable assessment links |
| 6 | Admin panel: users, settings |
| 7 | MFA (TOTP) |
| 8 | SSO / OIDC |
| 9 | Branding + org settings |
| 10 | Bulk export (CSV/JSON) |
| 11 | Activity logging + admin log viewer (in progress) |

---

## Constraints & Design Decisions

- **SQLite only** — zero external dependencies, data persists via Docker volume
- **Internal tool** — no customer-facing accounts; public assessment via one-time tokens only
- **2–5 users** — no need for advanced multi-tenancy or team features
- **Self-hosted Docker** — runs on a Synology NAS via Portainer
- **No email server** — no password reset email; admin resets passwords manually
- **No real-time** — no WebSockets; all polling/navigation based
- **Standalone Next.js output** — bundles server for Docker (no need for separate Node.js install)
