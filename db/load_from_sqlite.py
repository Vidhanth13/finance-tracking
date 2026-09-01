"""Load parsed transactions from the Gmail-brief SQLite DB into finance_tracking.

One-shot bridge for the existing backlog. Dedup-safe: re-running only inserts
new transactions (ON CONFLICT (dedup_key) DO NOTHING). Categorisation is a
separate step (db/categorise.sql) so it can be re-applied when rules change.

Usage:
    python db/load_from_sqlite.py
"""
from __future__ import annotations

import os
import sqlite3

import psycopg2
import psycopg2.extras

SQLITE_DB = os.environ.get(
    "GMAILBRIEF_DB", r"C:\Users\sbhee\gmail-brief\brief.db"
)
# Connection params as kwargs so the password (which contains spaces) needs no
# DSN quoting. Override any field via env, e.g. FINANCE_PGPASSWORD.
PG_CONN = dict(
    host=os.environ.get("FINANCE_PGHOST", "localhost"),
    port=os.environ.get("FINANCE_PGPORT", "5432"),
    dbname=os.environ.get("FINANCE_PGDATABASE", "finance_tracking"),
    user=os.environ.get("FINANCE_PGUSER", "jarvis"),
    password=os.environ.get("FINANCE_PGPASSWORD"),   # set via env / project .env
)

# gmail-brief txn column  ->  finance_tracking txn column
#   message_id -> external_ref ; category(TEXT) is ignored (we recategorise).
SELECT_SQL = """
    SELECT message_id, source, txn_type, status, direction, amount, currency,
           merchant_raw, merchant, account_ref, occurred_at, created_at, dedup_key
    FROM txn
"""

INSERT_SQL = """
    INSERT INTO txn (external_ref, source, txn_type, status, direction, amount,
                     currency, merchant_raw, merchant, account_ref, occurred_at,
                     created_at, dedup_key)
    VALUES (%(external_ref)s, %(source)s, %(txn_type)s, %(status)s, %(direction)s,
            %(amount)s, %(currency)s, %(merchant_raw)s, %(merchant)s,
            %(account_ref)s, %(occurred_at)s,
            COALESCE(%(created_at)s, now()), %(dedup_key)s)
    ON CONFLICT (dedup_key) DO NOTHING
"""


def norm_direction(d: str) -> str:
    # Postgres CHECK only allows debit|credit; a declined card is still a debit.
    return "credit" if (d or "").lower().startswith("credit") else "debit"


def norm_status(txn_type: str, status: str) -> tuple[str, str]:
    # SQLite encodes declines as txn_type='card_declined'. Normalise:
    #   -> txn_type card_payment, status declined.
    if (txn_type or "") == "card_declined":
        return "card_payment", "declined"
    return txn_type, (status or "posted")


def main() -> None:
    src = sqlite3.connect(SQLITE_DB)
    src.row_factory = sqlite3.Row
    rows = src.execute(SELECT_SQL).fetchall()
    src.close()
    print(f"read {len(rows)} rows from {SQLITE_DB}")

    pg = psycopg2.connect(**PG_CONN)
    inserted = 0
    with pg, pg.cursor() as cur:
        for r in rows:
            txn_type, status = norm_status(r["txn_type"], r["status"])
            params = {
                "external_ref": r["message_id"],
                "source": r["source"],
                "txn_type": txn_type,
                "status": status,
                "direction": norm_direction(r["direction"]),
                "amount": r["amount"],
                "currency": r["currency"] or "ZAR",
                "merchant_raw": r["merchant_raw"],
                "merchant": r["merchant"],
                "account_ref": r["account_ref"],
                "occurred_at": r["occurred_at"],
                "created_at": r["created_at"],
                "dedup_key": r["dedup_key"],
            }
            cur.execute(INSERT_SQL, params)
            inserted += cur.rowcount
    pg.close()
    print(f"inserted {inserted} new transactions (duplicates skipped)")


if __name__ == "__main__":
    main()
