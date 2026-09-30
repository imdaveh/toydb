ALTER TABLE users
  ADD COLUMN username VARCHAR(80) NULL AFTER email,
  ADD UNIQUE KEY uq_users_username (username);

CREATE TABLE IF NOT EXISTS collection_shares (
  owner_user_id INT UNSIGNED NOT NULL,
  viewer_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_user_id, viewer_user_id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Backfill usernames for existing users only when they are missing.
-- You can optionally update these values to match your desired display names.
-- UPDATE users SET username = email WHERE username IS NULL;
