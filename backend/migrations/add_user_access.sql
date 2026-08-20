USE toydb;

-- Existing users retain access, but no one is granted administrator access automatically.
ALTER TABLE users ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE users SET enabled = TRUE;
UPDATE users SET is_admin = FALSE;