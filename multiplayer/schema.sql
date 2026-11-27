CREATE TABLE IF NOT EXISTS friend_rooms (
  code TEXT PRIMARY KEY,
  host_token TEXT NOT NULL,
  host_name TEXT NOT NULL,
  guest_token TEXT,
  guest_name TEXT,
  first_turn TEXT NOT NULL,
  jokers INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS friend_rooms_expiration ON friend_rooms(expires_at);
