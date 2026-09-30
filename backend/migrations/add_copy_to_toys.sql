-- Add the copy field to the toys table so duplicate copies of the same toy can be tracked separately.
-- Run this manually against your ToyDB database before using copy-aware CSV import/export workflows.

ALTER TABLE toys
  ADD COLUMN copy INT UNSIGNED NOT NULL DEFAULT 1 AFTER user_id;

-- MySQL InnoDB limits composite indexes when several utf8mb4 VARCHAR columns are included.
-- Keep the indexes smaller and use prefixes where needed so the migration succeeds reliably.
CREATE INDEX idx_toys_user_copy
  ON toys (user_id, copy);

CREATE INDEX idx_toys_user_name_year_copy
  ON toys (user_id, name(120), manufacturer(120), toyline(120), `year`, copy);

-- Existing rows will all default to copy = 1.
-- New duplicate copies should use values 1, 2, 3, etc. for the same natural toy identity.
