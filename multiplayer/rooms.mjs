import { dealFriendOpening, openingForSeat, playFriendOpening } from "./friend-opening.mjs";
import { randomBytes } from "node:crypto";

const lifetime = 4 * 60 * 60 * 1000;

export function friendRooms({ now = Date.now } = {}) {
  const rooms = new Map();

  return function handle(path, method, body = {}, token = "") {
    const reply = (status, data) => ({ status, data });
    const error = (status, message) => reply(status, { error: message });
    const time = now();
    for (const [code, room] of rooms) {
      if (room.expiresAt <= time) rooms.delete(code);
    }
    const view = (room, seat) => ({
      code: room.code,
      seat,
      ready: Boolean(room.guest),
      settings: room.settings,
      ...(room.opening && { opening: openingForSeat(room.opening, seat) }),
      hostName: room.hostName, guestName: room.guestName,
    });

    const { firstTurn, jokers } = body;
    const settingsValid = ["flip", "host", "guest"].includes(firstTurn) && Number.isInteger(jokers) && jokers >= 0 && jokers <= 4;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const nameValid = name.length > 0 && name.length <= 24;
    const settingsError = "Choose who goes first and a Joker count from 0 to 4.";
    const nameError = "Enter a player name of 1 to 24 characters.";

    if (path === "" && method === "POST") {
      if (!settingsValid) return error(400, settingsError);
      if (!nameValid) return error(400, nameError);
      if (rooms.size >= 200) return error(503, "Room capacity reached. Please try later.");
      let code;
      do { code = randomBytes(8).toString("hex").toUpperCase(); } while (rooms.has(code));
      const room = {
        code, host: randomBytes(24).toString("hex"), hostName: name, expiresAt: time + lifetime,
        settings: { firstTurn, jokers, timer: false },
      };
      rooms.set(code, room);
      return reply(201, { ...view(room, "host"), token: room.host });
    }

    const route = /^\/([A-Fa-f0-9]{16})(\/join|\/start|\/move)?$/.exec(path);
    if (!route) return error(404, "Room not found.");
    const room = rooms.get(route[1].toUpperCase());
    if (!room) return error(404, "This room has expired or does not exist.");

    if (route[2] === "/start" && method === "POST") {
      if (token !== room.host) return error(403, "Only the host can start the match.");
      if (!room.guest) return error(409, "Wait for a friend to join.");
      room.opening ??= dealFriendOpening(room.settings);
      return reply(200, view(room, "host"));
    }
    if (route[2] === "/move" && method === "POST") {
      const seat = token === room.host ? "host" : room.guest && token === room.guest ? "guest" : null;
      if (!seat || !room.opening) return error(403, "Join the match before making a move.");
      const next = playFriendOpening(room.opening, seat, body.action, body.index, body.revision, body.target, body.shieldIndex);
      if (!next) return error(409, "That move is unavailable. Check the current turn and try again.");
      room.opening = next;
      return reply(200, view(room, seat));
    }
    if (route[2] === "/join" && method === "POST") {
      if (room.guest) return error(409, "This room already has two players.");
      if (!nameValid) return error(400, nameError);
      room.guestName = name;
      room.guest = randomBytes(24).toString("hex");
      return reply(200, { ...view(room, "guest"), token: room.guest });
    }
    if (!route[2] && method === "PATCH") {
      if (token !== room.host) return error(403, "Only the host can edit settings.");
      if (room.opening) return error(409, "The match has already started.");
      if (!settingsValid) return error(400, settingsError);
      room.settings = { ...room.settings, firstTurn, jokers };
      return reply(200, view(room, "host"));
    }
    if (!route[2] && method === "GET") {
      const seat = token === room.host ? "host" : room.guest && token === room.guest ? "guest" : null;
      return seat ? reply(200, view(room, seat)) : error(403, "Reopen the invite link to join this room.");
    }
    return error(405, "Unsupported room action.");
  };
}

export function friendRoomMiddleware() {
  const handle = friendRooms();
  return async (request, response, next) => {
    const path = request.url.split("?")[0];
    const prefix = "/api/friend-rooms";
    if (path !== prefix && !path.startsWith(prefix + "/")) { next(); return; }

    const send = (status, data) => {
      response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify(data));
    };

    let body = {};
    if (request.method === "POST" || request.method === "PATCH") {
      if (request.headers["content-type"] !== "application/json") {
        send(415, { error: "Expected a JSON request." });
        return;
      }
      let raw = "";
      for await (const chunk of request) {
        raw += chunk;
        if (raw.length > 1024) {
          send(413, { error: "Room request is too large." });
          return;
        }
      }
      try {
        body = JSON.parse(raw);
        if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
      } catch {
        send(400, { error: "Invalid room request." });
        return;
      }
    }
    const result = handle(path.slice(prefix.length), request.method, body, request.headers.authorization?.replace(/^Bearer /, ""));
    send(result.status, result.data);
  };
}
