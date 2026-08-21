-- Run this once against the production toydb database in Hostinger phpMyAdmin.
-- Re-adds a Condition field to toys (values managed in the app: Excellent, Good, Fair, Poor, Broken).

ALTER TABLE toys ADD COLUMN `condition` VARCHAR(20) NULL AFTER missing;
