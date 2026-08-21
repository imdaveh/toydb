-- Run this once against the production toydb database in Hostinger phpMyAdmin.
-- Adds a global tag system and removes the old condition/grade columns.

CREATE TABLE IF NOT EXISTS tags (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS toy_tags (
  toy_id INT UNSIGNED NOT NULL,
  tag_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (toy_id, tag_id),
  FOREIGN KEY (toy_id) REFERENCES toys(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE toys DROP COLUMN `condition`;
ALTER TABLE toys DROP COLUMN grade;
