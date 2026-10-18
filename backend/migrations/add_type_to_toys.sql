-- Remove the legacy type field from the toys table for existing installations.
-- Run this against an existing ToyDB database to drop the obsolete column.

ALTER TABLE toys
  DROP COLUMN type;
