-- finance_tracking — (re)categorise transactions. Idempotent + reusable.
-- Order of authority:
--   1. Learned merchant→category memory (your manual corrections)  ← wins
--   2. Merchant pattern rules (seeded)                              ← fallback
--   3. Uncategorised                                                ← leftover
-- Locked rows (a manual edit on that exact transaction) are never touched.

-- 1) Learned exact-merchant memory.
UPDATE txn t
SET category_id = mc.category_id
FROM merchant_category mc
WHERE t.merchant = mc.merchant
  AND t.category_locked = false
  AND t.category_id IS DISTINCT FROM mc.category_id;

-- 2) Pattern rules — only for merchants without a learned mapping.
UPDATE txn t
SET category_id = best.category_id
FROM (
    SELECT ranked.txn_id, ranked.category_id
    FROM (
        SELECT t2.id AS txn_id, mr.category_id,
               row_number() OVER (
                   PARTITION BY t2.id
                   ORDER BY mr.priority DESC, length(mr.pattern) DESC
               ) AS rn
        FROM txn t2
        JOIN merchant_rule mr
          ON coalesce(t2.merchant, '')     ILIKE mr.pattern
          OR coalesce(t2.merchant_raw, '') ILIKE mr.pattern
    ) ranked
    WHERE ranked.rn = 1
) best
WHERE best.txn_id = t.id
  AND t.category_locked = false
  AND NOT EXISTS (SELECT 1 FROM merchant_category mc WHERE mc.merchant = t.merchant)
  AND t.category_id IS DISTINCT FROM best.category_id;

-- 3) Anything still unmatched → Uncategorised.
UPDATE txn
SET category_id = (SELECT id FROM category WHERE name = 'Uncategorised')
WHERE category_id IS NULL
  AND category_locked = false;
