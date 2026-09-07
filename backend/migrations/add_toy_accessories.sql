-- Add toy accessory tracking for accessory ownership.
-- Run this manually against your existing ToyDB database.

CREATE TABLE IF NOT EXISTS toy_accessories (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  toy_id INT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  has_accessory BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_toy_accessory_name (toy_id, name),
  FOREIGN KEY (toy_id) REFERENCES toys(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
