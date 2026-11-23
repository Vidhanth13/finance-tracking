-- finance_tracking — core schema
-- PostgreSQL 18. Owner role: finance_app.
--
-- Design notes:
--   * `txn` is the transaction spine, ported from the Gmail-brief SQLite `txn`
--     table and upgraded to real Postgres types (NUMERIC money, TIMESTAMPTZ,
--     BIGSERIAL). `dedup_key` stays UNIQUE so re-ingesting the same email is a
--     harmless no-op (INSERT ... ON CONFLICT DO NOTHING).
--   * Categories are normalised into their own table (FK category_id) instead
--     of the loose TEXT field the SQLite version carried — cleaner for the app.
--   * `merchant_rule` drives auto-categorisation: an ILIKE pattern matched
--     against a transaction's merchant text resolves to a category, highest
--     priority wins.

BEGIN;

CREATE TABLE IF NOT EXISTS category (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    kind        TEXT NOT NULL DEFAULT 'expense'
                    CHECK (kind IN ('expense', 'income', 'transfer')),
    color       TEXT,                              -- hex, for the React UI
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS merchant_rule (
    id          SERIAL PRIMARY KEY,
    pattern     TEXT NOT NULL UNIQUE,              -- ILIKE pattern vs merchant text
    category_id INTEGER NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    priority    INTEGER NOT NULL DEFAULT 100,      -- higher wins on conflict
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS txn (
    id            BIGSERIAL PRIMARY KEY,
    source        TEXT NOT NULL,                   -- discovery_bank | manual | ...
    external_ref  TEXT,                            -- gmail message id, etc.
    txn_type      TEXT NOT NULL,                   -- card_payment | transfer | ...
    status        TEXT NOT NULL DEFAULT 'posted',  -- posted | declined
    direction     TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
    amount        NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
    currency      TEXT NOT NULL DEFAULT 'ZAR',
    merchant_raw  TEXT,                            -- as printed by the bank
    merchant      TEXT,                            -- cleaned / title-cased
    category_id   INTEGER REFERENCES category(id) ON DELETE SET NULL,
    account_ref   TEXT,                            -- masked last 4
    occurred_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    dedup_key     TEXT UNIQUE                      -- idempotent ingest key
);

CREATE INDEX IF NOT EXISTS idx_txn_occurred ON txn (occurred_at);
CREATE INDEX IF NOT EXISTS idx_txn_merchant ON txn (merchant);
CREATE INDEX IF NOT EXISTS idx_txn_category ON txn (category_id);

COMMIT;
