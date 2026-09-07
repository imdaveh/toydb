-- Copy legacy toy text fields into the notes field before removing them.
-- This preserves the existing data in a readable format while keeping notes as the single long-form text field.

UPDATE toys
SET notes = CASE
  WHEN TRIM(COALESCE(notes, '')) = '' THEN TRIM(
    CONCAT_WS(
      '\n\n',
      CASE WHEN TRIM(COALESCE(included, '')) <> '' THEN CONCAT('Included: ', TRIM(included)) END,
      CASE WHEN TRIM(COALESCE(missing, '')) <> '' THEN CONCAT('Missing: ', TRIM(missing)) END,
      CASE WHEN TRIM(COALESCE(broken, '')) <> '' THEN CONCAT('Broken: ', TRIM(broken)) END
    )
  )
  ELSE TRIM(
    CONCAT(
      notes,
      '\n\n',
      CONCAT_WS(
        '\n\n',
        CASE WHEN TRIM(COALESCE(included, '')) <> '' THEN CONCAT('Included: ', TRIM(included)) END,
        CASE WHEN TRIM(COALESCE(missing, '')) <> '' THEN CONCAT('Missing: ', TRIM(missing)) END,
        CASE WHEN TRIM(COALESCE(broken, '')) <> '' THEN CONCAT('Broken: ', TRIM(broken)) END
      )
    )
  )
END
WHERE TRIM(COALESCE(included, '')) <> ''
   OR TRIM(COALESCE(missing, '')) <> ''
   OR TRIM(COALESCE(broken, '')) <> '';

-- Optional: after you confirm the data looks correct, drop the legacy columns.
-- ALTER TABLE toys DROP COLUMN included;
-- ALTER TABLE toys DROP COLUMN missing;
-- ALTER TABLE toys DROP COLUMN broken;
