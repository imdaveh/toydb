-- Add a type field to the toys table for existing installations.
-- Run this against an existing ToyDB database to add the new column.

ALTER TABLE toys
  ADD COLUMN type VARCHAR(255) NULL AFTER theme;
