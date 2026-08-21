-- Run this manually in phpMyAdmin against your existing ToyDB database.
-- This converts the old accessories field to included and adds the broken field.
-- Safe for existing databases that may already have the new columns.

ALTER TABLE toys
  ADD COLUMN IF NOT EXISTS included TEXT AFTER notes;

ALTER TABLE toys
  ADD COLUMN IF NOT EXISTS broken TEXT AFTER missing;

UPDATE toys
SET included = COALESCE(included, accessories)
WHERE included IS NULL AND accessories IS NOT NULL;

UPDATE toys
SET broken = COALESCE(broken, '')
WHERE broken IS NULL;

-- If the old accessories column still exists, rename it once.
-- This will fail if the column has already been renamed or removed.
ALTER TABLE toys
  CHANGE COLUMN accessories included TEXT;
