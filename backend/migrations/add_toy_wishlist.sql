-- Adds a flag that separates wishlist entries from the user's collection.
ALTER TABLE toys ADD COLUMN IF NOT EXISTS is_wishlist BOOLEAN NOT NULL DEFAULT FALSE AFTER user_id;