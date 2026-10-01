# Landis Assessments

An internal tool for Landis IT staff to run structured IT security and onboarding assessments for SMB clients, score results, and track trends over time.

**Users:** 2–5 MSP staff members
**Access:** Internal only — not exposed to clients

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Mac/Windows) or Docker + Docker Compose on Linux

---

## Quick Start

1. Clone the repo:
   ```bash
   git clone https://github.com/happytree92/LandisAssessments.git
   cd LandisAssessments
   ```

2. Copy the example env file and set your JWT secret:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and replace `JWT_SECRET` with a random string of at least 32 characters.

3. Start the app:
   ```bash
   docker compose up
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Default Login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `changeme123` |

**Change this password immediately after first login.** Currently passwords are updated directly in the SQLite database. A future release will add an admin UI.

---

## Adding Staff Users

Currently, staff accounts are added directly to the SQLite database. The database file lives at `./data/assessments.db` on the host machine.

To add a user:
1. Generate a bcrypt hash of their password (e.g., using `htpasswd` or a Node.js script)
2. Insert a row into the `users` table

A future release will add an in-app user management screen.

---

## Assessment Templates

### Security Assessment (~25 questions)
Covers the core IT security posture for an SMB client across:
- Access Control
- Email Security (SPF/DKIM/DMARC, M365 Defender)
- Backup & Recovery
- Endpoint Security (EDR, patching, encryption)
- Network Security (firewall, segmentation, VPN/Zero Trust)
- Incident Response
- Compliance & Governance

### New Customer Onboarding (~12 questions)
Verifies that all standard Landis IT onboarding steps have been completed:
- M365 Setup (tenant config, licensing, Conditional Access)
- Documentation (network inventory, password manager, PSA docs)
- Remote Support (RMM agent, ticketing process)
- Security Baseline (initial security assessment, EDR, backups)
- Business Continuity (leadership discussion)

---

## Git Setup (First Time)

### Prerequisites
- Git installed on your Mac
- GitHub CLI: `brew install gh` then `gh auth login`

### Steps

1. Initialize git in your project folder:
   ```
   git init
   git add .
   git commit -m "initial commit"
   ```

2. Connect to your existing GitHub repo:
   ```
   git remote add origin https://github.com/happytree92/LandisAssessments.git
   git branch -M main
   git push -u origin main
   ```

3. Make the push helper executable:
   ```
   chmod +x push.sh
   ```

4. ### Docker Buildx Setup (First Time Only)
   ```
   docker buildx create --name multibuilder --use
   docker buildx inspect --bootstrap
   ```
   This only needs to be run once per Mac. After that, `./push.sh` handles everything.

That's it. You're connected.

---

## Running Checks

Run these before pushing. CI runs the same two commands on every pull request, and the Docker image is only published when both pass.

    npm test            # unit tests (Vitest)
    npm run typecheck   # TypeScript, including generated route types

`vite` is pinned to `^7` in `package.json` on purpose. With vite 8, npm 10 crashes during install, so don't remove it or bump it to `^8` while CI and the Docker build use npm 10 (bundled with Node 20 and 22).

---

## Pushing Changes to GitHub

After making any changes, push them with one command:

    ./push.sh "what you changed"

Examples:

    ./push.sh "add customer notes field"
    ./push.sh "fix scoring bug on onboarding template"
    ./push.sh                          # uses auto timestamp if no message

---

## Deploying to Your Test Server

After pushing, on your Linux test server:

    git pull && docker compose up -d --build

That's it. Docker rebuilds the image and restarts the container with your latest code.
Your database (SQLite) is stored in the `./data/` volume and is NOT affected by rebuilds.

---

## Running on ARM (Orange Pi 5, Raspberry Pi)

Every merge to `main` publishes `ghcr.io/happytree92/landisassessments:latest` for both `linux/amd64` and `linux/arm64`, so the same tag works on the Synology and on 64-bit ARM boards. `docker pull` picks the right one automatically. The board needs a 64-bit OS: `uname -m` should print `aarch64`.

On the board, put this in a `docker-compose.yml` next to a `.env` that sets `JWT_SECRET` and `BASE_URL` (see Quick Start):

```yaml
services:
  app:
    image: ghcr.io/happytree92/landisassessments:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_URL=./data/assessments.db
      - BASE_URL=${BASE_URL}
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

Then run `docker compose pull && docker compose up -d`. If the pull says `unauthorized`, the package is private: run `docker login ghcr.io -u happytree92` with a GitHub token that has `read:packages`, or make the package public in its GitHub settings.

---

## Returning to This Project

### On your Mac (to make changes):
1. Open terminal, navigate to the project folder
2. Run: `git pull` ← get any changes from GitHub
3. Open Claude Code: `claude`
4. Make your changes, then: `./push.sh "what you changed"`

### On your test server (to get latest):
    git pull && docker compose up -d --build

### Useful commands:
    git log --oneline -10          # see last 10 commits
    git diff                       # see uncommitted changes
    git status                     # see what files have changed
    docker compose logs -f         # watch live app logs
    docker compose down            # stop the app
    docker compose up -d --build   # rebuild and start

---

## Connect to GitHub

    git remote add origin https://github.com/happytree92/LandisAssessments.git && git branch -M main && git push -u origin main
