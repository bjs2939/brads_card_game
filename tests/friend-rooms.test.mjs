import assert from "node:assert/strict";
import test from "node:test";
import { friendRooms } from "../multiplayer/rooms.mjs";

test("private room settings persist for each seat and credentials are never shared", () => {
  const handle = friendRooms();
  assert.equal(handle("", "POST", { firstTurn: "guest", jokers: 5 }).status, 400);
  const host = handle("", "POST", { firstTurn: "guest", jokers: 2, name: "Host Player" }).data;
  const path = "/" + host.code;
  assert.equal(host.ready, false);
  assert.equal(handle(path, "GET").status, 403);
  assert.equal(handle(path + "/join", "POST").status, 400);
  const guest = handle(path + "/join", "POST", { name: "Guest Player" }).data;
  assert.equal(guest.ready, true);
  assert.notEqual(guest.token, host.token);
  assert.equal(handle(path + "/join", "POST").status, 409);
  assert.equal(handle(path, "PATCH", { firstTurn: "host", jokers: 0 }, guest.token).status, 403);
  assert.equal(handle(path, "PATCH", { firstTurn: "host", jokers: 0 }, host.token).status, 200);
  for (const { seat, token } of [host, guest]) {
    assert.deepEqual(handle(path, "GET", {}, token).data, {
      code: host.code, seat, ready: true, hostName: "Host Player", guestName: "Guest Player", settings: { firstTurn: "host", jokers: 0, timer: false },
    });
  }
});

test("expired rooms cannot be rejoined", () => {
  let now = 0;
  const handle = friendRooms({ now: () => now });
  const room = handle("", "POST", { firstTurn: "flip", jokers: 4, name: "Host" }).data;
  now = 4 * 60 * 60 * 1000;
  assert.equal(handle("/" + room.code, "GET", {}, room.token).status, 404);
});
