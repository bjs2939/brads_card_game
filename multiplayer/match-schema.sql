CREATE TABLE IF NOT EXISTS friend_matches (
  room_code TEXT PRIMARY KEY REFERENCES friend_rooms(code) ON DELETE CASCADE,
  opening TEXT NOT NULL
);
