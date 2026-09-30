ALTER TABLE toy_photos ADD COLUMN sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER original_name;
UPDATE toy_photos SET sort_order = id WHERE sort_order = 0;
