import { dealFriendOpening, openingForSeat } from "../../../multiplayer/friend-opening.mjs";

const headers = { "Cache-Control": "no-store" };
const reply = (status, data) => Response.json(data, { status, headers });
const error = (status, message) => reply(status, { error: message });
const randomHex = size => Array.from(crypto.getRandomValues(new Uint8Array(size)),
  byte => byte.toString(16).padStart(2, "0")).join("");

function view(room, seat) {
  return {
    code: room.code,
    seat,
    ready: Boolean(room.guest_token),
    opening: room.opening ? openingForSeat(JSON.parse(room.opening), seat) : undefined,
    hostName: room.host_name,
    guestName: room.guest_name ?? undefined,
    settings: { firstTurn: room.first_turn, jokers: room.jokers, timer: false },
  };
}

export async function onRequest({ request, env, params }) {
  const db = env.FRIEND_ROOMS;
  if (!db) return error(503, "Online rooms are being set up.");
  const now = Date.now();
  const path = (params.path ?? []).join("/");
  const method = request.method;

  const token = /^Bearer ([a-f0-9]{48})$/.exec(request.headers.get("Authorization") ?? "")?.[1] ?? "";
  let body = {};
  if (method === "POST" || method === "PATCH") {
    if (request.headers.get("Origin") !== new URL(request.url).origin) return error(403, "Open the game site to use rooms.");
    if (request.headers.get("Content-Type") !== "application/json") return error(415, "Expected a JSON request.");
    try {
      const reader = request.body.getReader();
      let length = 0;
      let text = "";
      const decoder = new TextDecoder();
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        length += part.value.byteLength;
        if (length > 1024) { await reader.cancel(); return error(413, "Room request is too large."); }
        text += decoder.decode(part.value, { stream: true });
      }
      body = JSON.parse(text + decoder.decode());
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
    } catch {
      return error(400, "Invalid room request.");
    }
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const { firstTurn, jokers } = body;
  const nameValid = name.length >= 1 && name.length <= 24;
  const settingsValid = ["flip", "host", "guest"].includes(firstTurn) &&
    Number.isInteger(jokers) && jokers >= 0 && jokers <= 4;

  try {
    if (path === "" && method === "GET") {
      await db.prepare("SELECT room_code FROM friend_matches LIMIT 1").first();
      return reply(200, { available: true });
    }
    if (path === "" && method === "POST") {
      if (!nameValid) return error(400, "Enter a player name of 1 to 24 characters.");
      if (!settingsValid) return error(400, "Choose who goes first and a Joker count from 0 to 4.");
      await db.prepare("DELETE FROM friend_rooms WHERE expires_at <= ?").bind(now).run();
      const code = randomHex(8).toUpperCase();
      const host = randomHex(24);
      const room = await db.prepare(
        "INSERT INTO friend_rooms (code, host_token, host_name, first_turn, jokers, expires_at) SELECT ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM friend_rooms) < 200 RETURNING *",
      ).bind(code, host, name, firstTurn, jokers, now + 4 * 60 * 60 * 1000).first();
      return room ? reply(201, { ...view(room, "host"), token: host }) : error(503, "Room capacity reached.");
    }

    const route = /^([A-Fa-f0-9]{16})(\/join|\/start)?$/.exec(path);
    if (!route) return error(404, "Room not found.");
    const code = route[1].toUpperCase();
    if (route[2] === "/start" && method === "POST") {
      const room = await db.prepare("SELECT * FROM friend_rooms WHERE code = ? AND host_token = ? AND expires_at > ?")
        .bind(code, token, now).first();
      if (!room) return error(403, "Only the host can start the match.");
      if (!room.guest_token) return error(409, "Wait for a friend to join.");
      const opening = JSON.stringify(dealFriendOpening({ firstTurn: room.first_turn, jokers: room.jokers }));
      await db.prepare(
        "INSERT OR IGNORE INTO friend_matches (room_code, opening) SELECT code, ? FROM friend_rooms WHERE code = ? AND expires_at > ? AND first_turn = ? AND jokers = ?",
      ).bind(opening, code, now, room.first_turn, room.jokers).run();
      const started = await db.prepare("SELECT opening FROM friend_matches WHERE room_code = ?").bind(code).first();
      return started ? reply(200, view({ ...room, ...started }, "host")) : error(409, "Room settings changed. Try again.");
    }
    if (route[2] === "/join" && method === "POST") {
      if (!nameValid) return error(400, "Enter a player name of 1 to 24 characters.");
      const guest = randomHex(24);
      const joined = await db.prepare(
        "UPDATE friend_rooms SET guest_token = ?, guest_name = ? WHERE code = ? AND expires_at > ? AND guest_token IS NULL RETURNING *",
      ).bind(guest, name, code, now).first();
      if (joined) return reply(200, { ...view(joined, "guest"), token: guest });
      const exists = await db.prepare("SELECT code FROM friend_rooms WHERE code = ? AND expires_at > ?").bind(code, now).first();
      return exists ? error(409, "This room already has two players.") : error(404, "This room has expired or does not exist.");
    }
    if (!route[2] && method === "PATCH") {
      if (!settingsValid) return error(400, "Choose who goes first and a Joker count from 0 to 4.");
      const room = await db.prepare(
        "UPDATE friend_rooms SET first_turn = ?, jokers = ? WHERE code = ? AND host_token = ? AND expires_at > ? AND NOT EXISTS (SELECT 1 FROM friend_matches WHERE room_code = friend_rooms.code) RETURNING *",
      ).bind(firstTurn, jokers, code, token, now).first();
      return room ? reply(200, view(room, "host")) : error(403, "Only the host of an active room can edit settings.");
    }
    if (!route[2] && method === "GET") {
      const room = await db.prepare(
        "SELECT friend_rooms.*, friend_matches.opening FROM friend_rooms LEFT JOIN friend_matches ON room_code = code WHERE code = ? AND expires_at > ? AND (host_token = ? OR guest_token = ?)",
      ).bind(code, now, token, token).first();
      return room ? reply(200, view(room, token === room.host_token ? "host" : "guest"))
        : error(404, "This room has expired or your seat could not be restored.");
    }
    return error(405, "Unsupported room action.");
  } catch {
    return error(503, "The room service is temporarily unavailable.");
  }
}
