ALTER TABLE toys
  ADD COLUMN theme VARCHAR(255) NULL AFTER sub_series;

-- Optional: if you want to backfill theme from an existing series value temporarily,
-- you can uncomment this and adjust as needed before using the field:
-- UPDATE toys SET theme = series WHERE theme IS NULL AND series IS NOT NULL;
