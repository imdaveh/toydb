-- Run this manually in phpMyAdmin against your existing ToyDB database.
-- Renames the old price column to cost and keeps the current data intact.

ALTER TABLE toys
  ADD COLUMN IF NOT EXISTS cost DECIMAL(10,2) NULL AFTER year;

UPDATE toys
SET cost = COALESCE(cost, price)
WHERE cost IS NULL AND price IS NOT NULL;

ALTER TABLE toys
  DROP COLUMN IF EXISTS price;
