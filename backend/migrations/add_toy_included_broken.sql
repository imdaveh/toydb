ALTER TABLE toys ADD COLUMN IF NOT EXISTS included TEXT AFTER notes;
ALTER TABLE toys ADD COLUMN IF NOT EXISTS broken TEXT AFTER missing;

UPDATE toys
SET included = COALESCE(included, accessories)
WHERE included IS NULL AND accessories IS NOT NULL;

UPDATE toys
SET broken = COALESCE(broken, '')
WHERE broken IS NULL;

ALTER TABLE toys CHANGE COLUMN accessories included TEXT;
