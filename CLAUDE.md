# CLAUDE.md — Landis Assessments
> Internal MSP staff tool for running security and onboarding assessments.
> Build the full app sequentially. Complete each milestone fully before moving to the next.
> Ask no clarifying questions — use the decisions in this file.

---

## Project Identity

| Field | Value |
|---|---|
| App Name | Landis Assessments |
| Type | Internal staff-only web app |
| Users | 2–5 MSP staff members |
| Purpose | Run structured IT security & onboarding assessments for SMB clients, score results, track trends over time |
| Deployment | Docker-first; must run with `docker compose up` on any Linux host or Docker Desktop |
| GitHub | https://github.com/happytree92/LandisAssessments |
| Registry | ghcr.io/happytree92/landisassessments:latest |

---

## Tech Stack — Use Exactly This

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| ORM | Drizzle ORM |
| Database | SQLite via `better-sqlite3` |
| Auth | Custom: bcrypt + httpOnly JWT cookie (`jose`) |
| Charts | Recharts |
| PDF | @react-pdf/renderer |
| CSV | papaparse |
| ZIP | jszip |
| Container | Docker + docker compose |

**Do not substitute any of these choices.**

---

## Branding & Design

Match Landis IT (landisit.com) — trustworthy and efficient, not flashy.

```ts
// tailwind.config.ts
colors: {
  primary: { 50:"#f0f7ff", 100:"#dbeafe", 500:"#1e40af", 600:"#1e3a8a" },
  accent:  { 400:"#38bdf8", 500:"#0ea5e9", 600:"#0284c8" },
  neutral: { 50:"#f8fafc", 100:"#f1f5f9", 400:"#94a3b8", 700:"#334155", 800:"#1e293b", 900:"#0f172a" },
  success: "#10b981", warning: "#f59e0b", danger: "#ef4444",
}
fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] }
```

**UI conventions:**
- Top nav bar — logo left, nav links center/right; Admin link shown only for admin role
- Admin section uses sidebar layout within `/admin` only
- Cards: `shadow-sm rounded-lg border border-neutral-200`
- Primary buttons: `bg-primary-500 hover:bg-primary-600 text-white`
- Score badges: ≥75 = success, 50–74 = warning, <50 = danger
- Teal accent for trendline charts; generous white space
- Branding colors overridable via admin settings (stored in DB, applied as CSS custom properties)

---

## Database Schema (Drizzle + SQLite)

Full schema — build all tables in Milestone 1 so no migrations needed later.

```ts
users:            { id, username(unique), passwordHash, displayName, role("admin"|"staff"), isActive(default 1), createdAt }
customers:        { id, name, contactName, contactEmail, notes, createdAt, updatedAt }
templates:        { id, slug(unique), name, description, isActive, createdAt }
questions:        { id, templateId→templates, category, text, weight(1–10), yesScore, noScore, maybeScore, sortOrder, isActive, createdAt }
assessments:      { id, customerId→customers, conductedBy→users, templateId→templates, answers(JSON), overallScore, categoryScores(JSON), source("staff"|"customer_link"), completedAt, createdAt }
assessmentTokens: { id, token(unique,UUID), customerId→customers, templateId→templates, createdBy→users, expiresAt(unix), usedAt, submittedFromIp, isActive, createdAt }
settings:         { id, key(unique), value, updatedAt }
activityLogs:     { id, timestamp, level("info"|"warn"|"error"), category("auth"|"assessment"|"customer"|"user"|"token"|"system"|"access"), action, userId, username, ipAddress, resourceType, resourceId, metadata(JSON) }
```

**Seed on first run:** admin user (`admin`/`changeme123` bcrypt hashed), both templates, all questions below, default branding settings. Print console warning if default password unchanged.

---

## Auth

- `POST /api/auth/login` → validate, set httpOnly cookie `session` (signed JWT via `jose`)
- `POST /api/auth/logout` → clear cookie
- `GET /api/auth/me` → return current user
- JWT payload: `{ userId, username, displayName, role }`
- JWT secret: `JWT_SECRET` env var — throw on missing
- Cookie: `httpOnly:true, sameSite:"lax", secure: NODE_ENV==="production"`
- Deactivated users (`isActive=0`) cannot log in
- Admin-only routes `/admin/*`: return 403 if role !== "admin"

**Public routes allowlist** (comment in `middleware.ts` — all other routes protected):
```
/login
/assess/[token]
/assess/complete
/api/assess/[token]/submit
```

---

## Scoring Engine (`lib/scoring.ts`)

Reads questions from DB — not hardcoded.

```ts
export type Answer = "Yes" | "No" | "Maybe";
export interface Question { id:number; category:string; text:string; weight:number; yesScore:number; noScore:number; maybeScore:number; }
export interface AssessmentResult { questionId:number; answer:Answer; notes?:string; }

export function calculateScore(results: AssessmentResult[], questions: Question[]) {
  let totalWeighted=0, totalWeight=0;
  const categoryScores: Record<string,{score:number;max:number}> = {};
  results.forEach((r) => {
    const q = questions.find(q => q.id===r.questionId); if (!q) return;
    const score = {Yes:q.yesScore,No:q.noScore,Maybe:q.maybeScore}[r.answer] ?? 50;
    totalWeighted += q.weight*score; totalWeight += q.weight*100;
    if (!categoryScores[q.category]) categoryScores[q.category]={score:0,max:0};
    categoryScores[q.category].score += q.weight*score;
    categoryScores[q.category].max += q.weight*100;
  });
  const overall = totalWeight===0 ? 0 : Math.round((totalWeighted/totalWeight)*100);
  const categories = Object.fromEntries(Object.entries(categoryScores).map(([c,d])=>[c,Math.round((d.score/d.max)*100)]));
  return { overall, categories };
}
```

---

## Seed Question Data (`lib/questions.ts`)

Used only on first run. Scores: weight≥8 → `yes:100,no:0,maybe:30`; weight 5–7 → `yes:100,no:0,maybe:50`.

### Security Assessment

| Category | Question | Weight |
|---|---|---|
| Access Control | MFA on all admin accounts? | 10 |
| Access Control | MFA for all M365/cloud logins? | 10 |
| Access Control | Privileged accounts separate from daily-use? | 8 |
| Access Control | Formal offboarding process to revoke access? | 9 |
| Access Control | Password manager in use (no shared spreadsheets)? | 8 |
| Email Security | SPF configured on domain? | 7 |
| Email Security | DKIM configured and passing? | 7 |
| Email Security | DMARC with p=quarantine or higher? | 8 |
| Email Security | Anti-phishing/safe links in M365 Defender? | 8 |
| Email Security | Users trained on phishing? | 6 |
| Backup & Recovery | Critical systems backed up daily? | 10 |
| Backup & Recovery | Backups stored offsite or cloud? | 10 |
| Backup & Recovery | Restore test in last 6 months? | 9 |
| Backup & Recovery | M365 data backed up by third-party tool? | 9 |
| Endpoint Security | EDR deployed on all machines? | 9 |
| Endpoint Security | Application allowlisting in use (ThreatLocker)? | 8 |
| Endpoint Security | OS/software updates applied within 30 days? | 7 |
| Endpoint Security | BitLocker or equivalent on laptops? | 8 |
| Network Security | Firewall actively managed and reviewed? | 7 |
| Network Security | Network segmentation corporate vs guest Wi-Fi? | 6 |
| Network Security | Remote access via VPN or Zero Trust (not open RDP)? | 9 |
| Incident Response | Documented incident response plan? | 7 |
| Incident Response | Staff know who to call for breach/ransomware? | 8 |
| Incident Response | IR drill conducted in last year? | 5 |
| Compliance | Written acceptable use policy? | 5 |
| Compliance | Security awareness training at least annually? | 6 |

### New Customer Onboarding

| Category | Question | Weight |
|---|---|---|
| M365 Setup | M365 tenant configured by Landis IT? | 8 |
| M365 Setup | All users assigned correct M365 plan? | 7 |
| M365 Setup | Conditional Access configured in Entra ID? | 9 |
| Documentation | Full network and user inventory documented? | 8 |
| Documentation | Credentials stored in Landis IT password manager? | 9 |
| Documentation | Environment documented in PSA/documentation system? | 7 |
| Remote Support | RMM agent installed on all endpoints? | 9 |
| Remote Support | Customer aware of ticketing process and SLAs? | 7 |
| Security Baseline | Initial security assessment completed? | 10 |
| Security Baseline | EDR deployed on all devices during onboarding? | 9 |
| Security Baseline | Cloud backups configured and tested? | 9 |
| Business Continuity | Business continuity discussion with leadership? | 7 |

---

## File & Folder Structure

```
/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                         # → /dashboard
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── customers/
│   │   ├── page.tsx
│   │   ├── new/page.tsx
│   │   └── [id]/ (page.tsx, edit/page.tsx)
│   ├── assessments/
│   │   ├── new/page.tsx
│   │   └── [id]/ (page.tsx results, conduct/page.tsx stepper)
│   ├── assess/
│   │   ├── [token]/page.tsx             # PUBLIC — customer self-assessment
│   │   └── complete/page.tsx            # PUBLIC — thank-you
│   └── admin/
│       ├── layout.tsx                   # Sidebar layout
│       ├── page.tsx                     # Dashboard + log summary
│       ├── users/page.tsx
│       ├── questions/page.tsx
│       ├── branding/page.tsx
│       ├── export/page.tsx
│       └── logs/page.tsx
├── components/
│   ├── nav/TopNav.tsx
│   ├── admin/AdminSidebar.tsx
│   ├── assessments/ (AssessmentStepper, ScoreCard, CategoryBreakdown, Trendline)
│   ├── customers/ (CustomerCard, CustomerForm)
│   └── pdf/AssessmentReport.tsx
├── lib/
│   ├── db/ (schema.ts, index.ts, seed.ts)
│   ├── scoring.ts
│   ├── questions.ts                     # Seed data only
│   ├── auth.ts
│   └── logger.ts
├── middleware.ts
├── public/sample-questions.csv
├── Dockerfile
├── docker-compose.yml
├── push.sh
├── .env.example
├── .gitignore
└── README.md
```

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Authenticate, set cookie |
| POST | `/api/auth/logout` | Staff | Clear cookie |
| GET | `/api/auth/me` | Staff | Current user |
| GET/POST | `/api/customers` | Staff | List / create |
| GET/PATCH/DELETE | `/api/customers/[id]` | Staff | Get / update / delete |
| GET/POST | `/api/assessments` | Staff | Get / save |
| GET | `/api/assessments/[id]/pdf` | Staff | Download PDF |
| POST | `/api/assessment-tokens` | Staff | Generate customer token |
| GET | `/api/assess/[token]` | **PUBLIC** | Validate token, return questions |
| POST | `/api/assess/[token]/submit` | **PUBLIC** | Submit self-assessment |
| GET/POST | `/api/admin/users` | Admin | List / create users |
| PATCH | `/api/admin/users/[id]` | Admin | Update user |
| GET/POST | `/api/admin/questions` | Admin | List / import CSV |
| GET | `/api/admin/logs` | Admin | Query logs (paginated) |
| GET | `/api/admin/export` | Admin | Bulk ZIP PDF export |
| GET/POST | `/api/admin/settings` | Admin | Branding settings |

---

## Build Order

### Milestone 1 — Scaffold & Docker

1. Init Next.js 15 + TypeScript + Tailwind + App Router
2. Install all deps: `drizzle-orm better-sqlite3 jose bcryptjs recharts @react-pdf/renderer papaparse jszip` + `shadcn/ui`
3. Configure `tailwind.config.ts` with theme above
4. Create `Dockerfile`, `docker-compose.yml`, `.env.example`, `.gitignore`, `push.sh`, `README.md`
5. Init git, initial commit, connect to GitHub repo
6. Verify: `docker compose up` → localhost:3000

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

**docker-compose.yml:**
```yaml
version: "3.9"
services:
  app:
    image: ghcr.io/happytree92/landisassessments:latest
    ports: ["3000:3000"]
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=/app/data/assessments.db
    volumes:
      - /volume2/docker/landisapp/data:/app/data
    restart: unless-stopped
```

**push.sh:**
```bash
#!/bin/bash
MESSAGE=${1:-"update $(date '+%Y-%m-%d %H:%M')"}
git add . && git commit -m "$MESSAGE" && git push
docker buildx build --platform linux/amd64,linux/arm64 \
  -t ghcr.io/happytree92/landisassessments:latest --push .
echo "✅ Pushed: $MESSAGE | Pull and redeploy in Portainer"
```

**.gitignore:** `.env`, `data/`, `*.db`, `*.db-shm`, `*.db-wal`, `.next/`, `out/`, `node_modules/`, `.DS_Store`, `Thumbs.db`, `.vscode/`, `.idea/`

---

### Milestone 2 — Database & Auth

1. Full Drizzle schema (`lib/db/schema.ts`) — all tables above
2. DB singleton (`lib/db/index.ts`) — auto-create `data/` dir if missing
3. Seed script (`lib/db/seed.ts`) — runs on first startup if DB empty
4. `lib/auth.ts` — JWT sign/verify with `jose`
5. `middleware.ts` — protect all routes, explicit allowlist comment
6. `/api/auth/*` routes
7. `/login` page — centered card, wordmark, username/password, error on failure
8. Verify: `admin/changeme123` works, protected routes redirect

---

### Milestone 3 — Customers

1. All `/api/customers` routes (list, create, get, update, delete)
2. `/customers` list, `/customers/new`, `/customers/[id]`, `/customers/[id]/edit`
3. Verify: full CRUD end-to-end

---

### Milestone 4 — Scoring Engine

1. `lib/scoring.ts` — exact implementation above
2. Confirm seed populated templates + questions
3. Temp `/api/debug/score-test` to verify math → remove after
4. Verify: correct 0–100 values

---

### Milestone 5 — Assessment Flow

1. `/assessments/new` — select customer, then template (shown as cards)
2. `/assessments/[id]/conduct` — questions by category, Yes/No/Maybe radios, optional notes, progress bar, Save & Complete disabled until all answered
3. `POST /api/assessments` — fetch questions from DB, calculate score server-side, persist, redirect
4. `/assessments/[id]` results: large score w/ color + label, consultative summary (top failed high-weight items), full question list by category
5. Assessment history on `/customers/[id]`
6. Verify: full flow, score saved, visible in history

---

### Milestone 6 — Charts & Polish

1. `Trendline.tsx` (Recharts line) — on customer detail, only if ≥2 assessments
2. `CategoryBreakdown.tsx` (Recharts horizontal bar) — on results page
3. `TopNav.tsx` — logo left, nav links, user name + logout, Admin link for admins
4. Dashboard summary stats — total customers, assessments this month, avg score
5. Full branding pass — colors, spacing, score badges, typography
6. Verify: polished end-to-end

---

### Milestone 7 — Question Engine (Admin UI + CSV Import)

Questions are already seeded. This adds admin tools to manage them.

1. `/admin/questions`: table grouped by template+category, columns: category/text/weight/scores/active toggle, CSV drag-and-drop upload, import summary, download current CSV button
2. `POST /api/admin/questions/import`:
   - Parse with papaparse; columns: `template,category,question,weight,yes_score,no_score,maybe_score`
   - Validate: all columns, weight 1–10, scores 0–100
   - Upsert on template slug + question text; do NOT delete existing
   - Return `{ imported, updated, errors }`
3. `/public/sample-questions.csv` using all seed questions
4. Verify: upload modified CSV → change appears in next assessment

**CSV format:**
```
template,category,question,weight,yes_score,no_score,maybe_score
security,Access Control,Is MFA enabled on all admin accounts?,10,100,0,30
onboarding,M365 Setup,Has the M365 tenant been configured by Landis IT?,8,100,0,50
```

---

### Milestone 8 — User Management & Admin Settings

1. `/admin/users`: table (name, username, role badge, created, active), Add User modal, edit name/role, reset password, deactivate (cannot deactivate own account)
2. `/admin/branding`: color pickers for primary/accent/success/warning/danger, save to `settings`, apply as CSS custom properties, live preview, reset to defaults
3. Change Password for all users — accessible from user dropdown in TopNav, requires current password
4. `/admin` dashboard — total/active users, last login per user
5. Verify: staff gets 403 on /admin; deactivated user cannot log in

---

### Milestone 9 — PDF Export

1. `components/pdf/AssessmentReport.tsx` (`@react-pdf/renderer`):
   - Header: wordmark, date, customer name, conducted by
   - Overall score — large, color coded
   - Category breakdown — score bar per category
   - Consultative summary (same logic as results page)
   - Full question list by category — question, answer, notes
   - Footer: "Prepared by Landis IT" + page numbers
2. `GET /api/assessments/[id]/pdf` — render server-side, return `application/pdf`, filename: `assessment-[customerName]-[YYYY-MM-DD].pdf`
3. "Export PDF" button on results page — spinner, auto-download
4. `/admin/export` bulk export — select customer + date range → ZIP of PDFs via `jszip`
5. Verify: exported PDF has all sections, filename correct

---

### Milestone 10 — Customer Self-Assessment URLs

**Security constraints — non-negotiable:**
- Only the three public routes in the allowlist are excluded from auth
- Public POST is write-only — never returns existing assessment data or customer records
- Public GET returns only: customer first name, template name, question list
- Tokens are single-use — mark `usedAt` on submission, reject resubmission
- Tokens expire — reject if `expiresAt` < now
- Rate limit public endpoints — max 10 req/IP/hour → 429
- Log every token access attempt with IP — never log the raw token value

1. `POST /api/assessment-tokens` (staff): body `{ customerId, templateId, expiresInDays (7/14/30/60, default 30) }` → generate UUID, return shareable URL
2. `GET /assess/[token]` — public page: validate token; if invalid show "This link is invalid or has expired. Contact your IT provider." and nothing else; if valid show first name + template name + stepper
3. `POST /api/assess/[token]/submit` — public: re-validate token, validate all answered, calculate score server-side, save with `source="customer_link"`, mark `usedAt`+IP, return `{success:true}`, redirect to `/assess/complete`
4. `/assess/complete` — static thank-you, no nav, no links, no app chrome
5. Token management on `/customers/[id]`: "Share Assessment" button → modal (select template + expiry), copy URL, token list (template/created/expiry/status), revoke pending tokens
6. On startup: expire tokens where `expiresAt` < now
7. Verify: incognito — only first name + template visible; submit → appears in staff history; resubmit → rejected; `/dashboard` incognito → redirects to login; `/api/customers` incognito → 401

---

### Milestone 11 — Backend Logging & Admin Log Viewer

1. `lib/logger.ts`:
```ts
import { db } from "./db";
import { activityLogs } from "./db/schema";

type LogLevel = "info"|"warn"|"error";
type LogCategory = "auth"|"assessment"|"customer"|"user"|"token"|"system"|"access";

export async function log(entry: {
  level:LogLevel; category:LogCategory; action:string;
  userId?:number; username?:string; ipAddress?:string;
  resourceType?:string; resourceId?:number; metadata?:Record<string,unknown>;
}) {
  try {
    await db.insert(activityLogs).values({
      timestamp: Math.floor(Date.now()/1000),
      ...entry,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    });
  } catch { /* never propagate */ }
}
```

2. Add `log()` calls — never log passwords or raw token values:
   - **Auth:** login success (info), login fail w/ attempted username (warn), logout (info), password changed (info)
   - **Customers:** created/updated (info), deleted (warn)
   - **Assessments:** started w/ templateId+customerId (info), completed w/ score (info), PDF exported (info)
   - **Users:** created (info), deactivated (warn), role changed (warn)
   - **Tokens:** generated (info), used w/ IP (info), expired in cleanup (info), revoked (warn), invalid access w/ IP (warn), expired access w/ IP (warn)
   - **System:** startup (info), DB seeded (info), unhandled error w/ route+message (error)

3. `GET /api/admin/logs` (admin): query params `category`, `level`, `userId`, `from`, `to`, `page`(default 1), `limit`(default 50, max 200) → paginated, newest first

4. `/admin/logs`: filter bar (category, level, date range, username, clear), table (timestamp, level badge, category badge, action, user, IP), click row → metadata as formatted JSON, pagination, auto-refresh toggle (30s poll)
   - Level badges: info=neutral grey, warn=warning yellow, error=danger red
   - Category badges: auth=primary blue, access=accent teal, token=purple, assessment=success green, customer=blue, user=orange, system=grey

5. Log summary widget on `/admin`: failed logins last 24h (red if >3), assessments this week, invalid token attempts last 7 days, last startup time, "View all logs" link

6. Log retention on startup: delete logs older than 90 days, log the cleanup

7. Verify: login/out → auth entries; create customer → entry appears; token in incognito → token+access entries with IP; fail login 3x → warn entries + summary widget; /admin/logs returns 403 for staff

---

## Error Handling & Code Quality

- All API routes: try/catch → `{ error: string }` with correct HTTP status
- DB operations: handle SQLite errors gracefully
- Loading states on all async UI — spinner on submit, button disabled
- No `any` TypeScript — define proper interfaces
- Comment non-obvious logic (scoring, JWT, token validation)
- No `console.log` in production — use logger or `NODE_ENV==="development"` guard
- Logger failures must never propagate — always fire-and-forget in try/catch

---

## Git & GitHub Workflow

**Repo:** `https://github.com/happytree92/LandisAssessments.git` | **Branch:** `main`

### First-Time Setup
```bash
docker buildx create --name multibuilder --use && docker buildx inspect --bootstrap
git remote add origin https://github.com/happytree92/LandisAssessments.git
git branch -M main && git push -u origin main
chmod +x push.sh
```

### Every Day
```bash
./push.sh "what you changed"   # then Pull & redeploy in Portainer
```

### Returning to Project
```bash
git pull
claude --dangerously-skip-permissions
# make changes
./push.sh "what you changed"
```

### Useful Commands
```bash
git log --oneline -10 | git status | git diff
docker compose logs -f | docker compose down | docker compose up -d --build
```

---

## README Requirements

1. What the app is and who it's for
2. Prerequisites: Docker Desktop, Git, GHCR access
3. First-time setup: clone → `.env.example` → set `JWT_SECRET` → Portainer deploy
4. Default credentials (`admin`/`changeme123`) — change immediately
5. How to add staff users via `/admin/users`
6. Description of each assessment template
7. Git workflow using `push.sh`
8. Docker buildx one-time setup
9. Returning to project reference card

---

## Out of Scope — Do Not Build

- Email delivery of reports or links (copy-paste URL for now)
- SSO or OAuth
- External database (Postgres, MySQL)
- Mobile app
- Multi-tenant / multi-company support

Do not build these. Do not make architectural decisions that would prevent adding them later.
