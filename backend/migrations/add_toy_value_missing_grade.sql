-- Run this once against the production toydb database in Hostinger phpMyAdmin.
-- If a column already exists, remove that individual ALTER statement before running.

ALTER TABLE toys ADD COLUMN `value` DECIMAL(10,2) NULL AFTER cost;
ALTER TABLE toys ADD COLUMN missing TEXT NULL AFTER accessories;
ALTER TABLE toys ADD COLUMN grade VARCHAR(20) NULL AFTER `condition`;