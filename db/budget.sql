-- finance_tracking — budgets + app settings
-- Per-category monthly limits, plus a simple key/value settings table for the
-- overall monthly budget. Idempotent.

BEGIN;

CREATE TABLE IF NOT EXISTS budget (
    id           SERIAL PRIMARY KEY,
    category_id  INTEGER NOT NULL REFERENCES category(id) ON DELETE CASCADE,
    month        DATE,                          -- NULL = default limit for every month
    limit_amount NUMERIC(14,2) NOT NULL CHECK (limit_amount >= 0),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, month)
);

CREATE TABLE IF NOT EXISTS app_setting (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Overall monthly budget default.
INSERT INTO app_setting (key, value) VALUES ('monthly_budget', '10000')
ON CONFLICT (key) DO NOTHING;

-- Seed default per-category limits (month = NULL => applies to all months).
INSERT INTO budget (category_id, month, limit_amount)
SELECT c.id, NULL, v.lim
FROM (VALUES
    ('Fuel', 2500), ('Dining & Takeout', 1200), ('Groceries', 2000),
    ('Wellness', 900), ('Transport', 1500)
) AS v(cat, lim)
JOIN category c ON c.name = v.cat
ON CONFLICT (category_id, month) DO NOTHING;

COMMIT;
