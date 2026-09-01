-- finance_tracking — seed categories + merchant rules
-- Idempotent: safe to re-run. Rules are grounded in real Discovery Bank
-- transactions parsed by the Gmail brief (Aug 2026 sample).

BEGIN;

-- ── Categories ──────────────────────────────────────────────────────────────
INSERT INTO category (name, kind, color) VALUES
    ('Groceries',        'expense',  '#4f9d69'),
    ('Fuel',             'expense',  '#e07a5f'),
    ('Transport',        'expense',  '#3d84c6'),  -- Uber/Bolt rides
    ('Dining & Takeout', 'expense',  '#f2a541'),
    ('Health & Pharmacy','expense',  '#e56b9f'),
    ('Entertainment',    'expense',  '#9b5de5'),
    ('Shopping',         'expense',  '#00b4d8'),
    ('Subscriptions',    'expense',  '#8338ec'),
    ('Wellness',         'expense',  '#2a9d8f'),
    ('Vending',          'expense',  '#adb5bd'),
    ('Transfers',        'transfer', '#6c757d'),
    ('Income',           'income',   '#38b000'),
    ('Uncategorised',    'expense',  '#ced4da')
ON CONFLICT (name) DO NOTHING;

-- ── Merchant rules ─────────────────────────────────────────────────────────
-- pattern is matched with ILIKE against the transaction merchant text.
INSERT INTO merchant_rule (pattern, category_id, priority)
SELECT v.pattern, c.id, v.priority
FROM (VALUES
    -- Groceries
    ('%woolworths%',   'Groceries',        200),
    ('%pnp%',          'Groceries',        200),  -- Pick n Pay Express
    ('%pick n pay%',   'Groceries',        200),
    ('%flm%',          'Groceries',        190),  -- Food Lover's Market
    ('%checkers%',     'Groceries',        200),
    ('%shoprite%',     'Groceries',        200),
    ('%spar%',         'Groceries',        200),
    -- Fuel
    ('%bp %',          'Fuel',             200),
    ('%engen%',        'Fuel',             200),
    ('%shell%',        'Fuel',             200),
    ('%sasol%',        'Fuel',             200),
    ('%total%',        'Fuel',             190),
    -- Transport (rides) — keep above Dining so Uber Eats still wins for food
    ('%uber eats%',    'Dining & Takeout', 210),
    ('%uber%',         'Transport',        200),
    ('%bolt%',         'Transport',        200),
    -- Dining & Takeout
    ('%kfc%',          'Dining & Takeout', 200),
    ('%mochachos%',    'Dining & Takeout', 200),
    ('%coffee%',       'Dining & Takeout', 190),
    ('%donu%',         'Dining & Takeout', 190),  -- Drizzling Donuts
    ('%main event%',   'Entertainment',    200),
    ('%nandos%',       'Dining & Takeout', 200),
    ('%mcdonald%',     'Dining & Takeout', 200),
    -- Health & Pharmacy
    ('%clicks%',       'Health & Pharmacy',200),
    ('%dis-chem%',     'Health & Pharmacy',200),
    ('%dischem%',      'Health & Pharmacy',200),
    -- Entertainment
    ('%comic warehouse%','Entertainment',  200),
    -- Wellness
    ('%cannafrica%',   'Wellness',         200),
    -- Vending
    ('%vending%',      'Vending',          180),
    -- Transfers
    ('transfer to %',  'Transfers',        200)
) AS v(pattern, cat_name, priority)
JOIN category c ON c.name = v.cat_name
ON CONFLICT (pattern) DO NOTHING;

COMMIT;
