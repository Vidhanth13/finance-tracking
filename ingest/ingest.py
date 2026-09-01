"""finance_tracking — standalone transaction ingest.

Fully self-contained: reads Discovery Bank emails straight from Gmail, parses
them with the vendored parser, and upserts into Postgres. No dependency on the
gmail-brief email service (its parser was copied here, not imported).

Pipeline:  Gmail (Discovery mail)  ->  banking.parse  ->  Postgres txn  ->  categorise

Usage:
    python ingest/ingest.py              # incremental: recent Discovery mail
    python ingest/ingest.py --backfill   # all Discovery mail (first load / catch-up)
    python ingest/ingest.py --query 'from:discovery.bank newer_than:7d'
"""
from __future__ import annotations

import argparse
import os
import sys

import psycopg2

# Make the vendored modules importable regardless of cwd.
_HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _HERE)


def _load_env() -> None:
    """Load KEY=VALUE lines from the project-root .env (git-ignored). No deps."""
    envp = os.path.join(_HERE, "..", ".env")
    if not os.path.exists(envp):
        return
    with open(envp, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


_load_env()

import banking                                    # noqa: E402  (vendored parser)
from gmail_client import GmailClient, header      # noqa: E402  (vendored client)

# ── Config ───────────────────────────────────────────────────────────────────
TOKEN_FILE = os.environ.get("FINANCE_GMAIL_TOKEN", os.path.join(_HERE, "token.json"))
CLIENT_SECRET_FILE = os.environ.get(
    "FINANCE_GMAIL_CLIENT_SECRET", os.path.join(_HERE, "credentials.json")
)
CATEGORISE_SQL = os.path.join(_HERE, "..", "db", "categorise.sql")

DEFAULT_QUERY = "from:discovery.bank newer_than:3d"   # incremental window
BACKFILL_QUERY = "from:discovery.bank"                # everything (bounded by --max)

PG_CONN = dict(
    host=os.environ.get("FINANCE_PGHOST", "localhost"),
    port=os.environ.get("FINANCE_PGPORT", "5432"),
    dbname=os.environ.get("FINANCE_PGDATABASE", "finance_tracking"),
    user=os.environ.get("FINANCE_PGUSER", "jarvis"),
    password=os.environ.get("FINANCE_PGPASSWORD"),   # from .env (git-ignored)
)

INSERT_SQL = """
    INSERT INTO txn (external_ref, source, txn_type, status, direction, amount,
                     currency, merchant_raw, merchant, account_ref, occurred_at,
                     created_at, dedup_key)
    VALUES (%(external_ref)s, %(source)s, %(txn_type)s, %(status)s, %(direction)s,
            %(amount)s, %(currency)s, %(merchant_raw)s, %(merchant)s,
            %(account_ref)s, %(occurred_at)s, now(), %(dedup_key)s)
    ON CONFLICT (dedup_key) DO NOTHING
"""


def dedup_key(t: "banking.Transaction") -> str:
    # Same composition as the gmail-brief store, so a transaction seen by either
    # system resolves to the same key (idempotent across the one-shot bootstrap).
    return "|".join([
        t.source, f"{t.amount:.2f}", t.occurred_at or "",
        t.merchant_raw or t.merchant or "", t.account_ref or "",
    ])


def norm(t: "banking.Transaction") -> tuple[str, str]:
    # Postgres CHECK: txn_type card_declined -> card_payment + status 'declined'.
    if t.txn_type == "card_declined":
        return "card_payment", "declined"
    return t.txn_type, t.status


def main() -> int:
    ap = argparse.ArgumentParser(description="Ingest Discovery transactions into Postgres.")
    ap.add_argument("--backfill", action="store_true",
                    help="Fetch all Discovery mail, not just the recent window.")
    ap.add_argument("--query", help="Override the Gmail search query.")
    ap.add_argument("--max", type=int, default=200, help="Max messages to scan.")
    args = ap.parse_args()

    query = args.query or (BACKFILL_QUERY if args.backfill else DEFAULT_QUERY)
    client = GmailClient(client_secret_file=CLIENT_SECRET_FILE, token_file=TOKEN_FILE)

    ids = client.search(query, max_results=args.max)
    print(f"query: {query!r}  ->  {len(ids)} message(s)")

    parsed: list[tuple["banking.Transaction", str]] = []
    for mid in ids:
        msg = client.get(mid)
        sender = header(msg, "From", "?")
        for t in banking.parse(sender, msg.get("snippet", ""), msg.get("internalDate")):
            parsed.append((t, mid))
    print(f"parsed {len(parsed)} transaction(s)")

    pg = psycopg2.connect(**PG_CONN)
    inserted = 0
    with pg, pg.cursor() as cur:
        for t, mid in parsed:
            txn_type, status = norm(t)
            cur.execute(INSERT_SQL, {
                "external_ref": mid, "source": t.source, "txn_type": txn_type,
                "status": status, "direction": t.direction, "amount": t.amount,
                "currency": t.currency, "merchant_raw": t.merchant_raw,
                "merchant": t.merchant, "account_ref": t.account_ref,
                "occurred_at": t.occurred_at, "dedup_key": dedup_key(t),
            })
            inserted += cur.rowcount
    print(f"inserted {inserted} new transaction(s) (duplicates skipped)")

    # Categorise (apply merchant rules). Reusable, idempotent.
    with open(CATEGORISE_SQL, "r", encoding="utf-8") as f:
        cat_sql = f.read()
    with pg, pg.cursor() as cur:
        cur.execute(cat_sql)
    pg.close()
    print("categorised.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
