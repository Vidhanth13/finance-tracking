# finance_tracking

A personal monthly-spending tracker. Fully self-contained — its own database,
its own ingest, its own schedule. **No coupling** to any other project.

```
Discovery emails → [Python ingest] → Postgres → [Node API] → [React dashboard]
   (Gmail)          own cron           finance_    reads &      charts / tiles
                                       tracking     computes     (Tailwind)
```

## Stack (what · how · why)
- **Ingest — Python.** Reads Discovery Bank emails from Gmail (read-only), parses
  them, upserts transactions into Postgres. *Why Python:* the bank-email parser
  (`ingest/banking.py`) is a proven, fragile bit of text-parsing — vendored here
  as its own copy (not shared) rather than rewritten.
- **Database — PostgreSQL 18.** `finance_tracking`, owned by the `jarvis` role.
  Real `NUMERIC` money, `TIMESTAMPTZ`, `dedup_key UNIQUE` for idempotent ingest.
  *Why Postgres:* proper relational store the API and dashboard build on.
- **API — Node.js** *(to build).* Reads Postgres, computes the numbers, serves JSON.
- **Dashboard — React + Tailwind** *(to build).* A live web app (a running server
  at a URL), not a static file. Always shows current data.
- **Scheduler — its own cron.** Independent of every other project.

## Layout
```
db/       schema.sql · seed.sql · categorise.sql   (Postgres foundation)
ingest/   ingest.py · banking.py · gmail_client.py (standalone Gmail → Postgres)
api/      Node.js API            (to build)
web/      React + Tailwind app   (to build)
```

## Setup
```bash
cp .env.example .env      # then fill in FINANCE_PGPASSWORD
psql -f db/schema.sql -f db/seed.sql   # (once) create tables + seed rules
```
Secrets — `.env` and `ingest/token.json` — are git-ignored and never committed.

## Run
```bash
# ingest (Python) — incremental is what the cron runs; --backfill for catch-up
python ingest/ingest.py                 # reads ../.env automatically
python ingest/ingest.py --backfill --max 300

# API (Node, port 4000)
cd api && npm install && npm start      # loads ../.env via --env-file

# dashboard (React + Vite, port 5173 — proxies /api to :4000)
cd frontend && npm install && npm run dev
```
