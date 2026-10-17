-- Add release/faction/manufacturer_id fields to the toys table for existing installations.
-- Run this against your ToyDB database to add the new columns.

ALTER TABLE toys
  ADD COLUMN `release_wave` VARCHAR(255) NULL AFTER `type`,
  ADD COLUMN `faction` VARCHAR(255) NULL AFTER `release_wave`,
  ADD COLUMN `manufacturer_id` VARCHAR(255) NULL AFTER `faction`;
