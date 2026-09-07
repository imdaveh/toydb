-- Safe cleanup for legacy toy text fields.
-- Run this only after you have confirmed the accessory system is the active model
-- and you no longer need the old included/missing/broken columns.
--
-- MySQL DDL is not transactional, so this script creates a backup table first.

-- 1) Backup the current table before removing fields.
CREATE TABLE IF NOT EXISTS toys_legacy_backup AS
SELECT *
FROM toys;

-- 2) Validate that the legacy columns still exist and are what you expect.
SELECT 'Legacy columns before drop' AS check_name,
       COUNT(*) AS matching_columns
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'toys'
  AND COLUMN_NAME IN ('included', 'missing', 'broken');

SELECT COUNT(*) AS legacy_rows_with_data
FROM toys
WHERE included IS NOT NULL
   OR missing IS NOT NULL
   OR broken IS NOT NULL;

-- 3) Drop the unused legacy fields.
ALTER TABLE toys
  DROP COLUMN included,
  DROP COLUMN missing,
  DROP COLUMN broken;

-- 4) Optional verification after the drop.
SELECT 'Columns remaining after drop' AS check_name,
       COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'toys'
  AND COLUMN_NAME IN ('included', 'missing', 'broken');

-- If you ever need to restore the old data:
-- DROP TABLE IF EXISTS toys;
-- RENAME TABLE toys_legacy_backup TO toys;
