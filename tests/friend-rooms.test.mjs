import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

test("local matchmaking restores the last accepted move and both seats after restart", t => {
  const directory = mkdtempSync(join(tmpdir(), "brads-friend-room-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const savePath = join(directory, "rooms.json");
  const before = friendRooms({ savePath });
  const host = before("", "POST", { firstTurn: "host", jokers: 0, name: "Host" }).data;
  const path = "/" + host.code;
  const guest = before(path + "/join", "POST", { name: "Guest" }).data;
  const started = before(path + "/start", "POST", {}, host.token).data.opening;
  const index = started.hand.findIndex(card => Number(card.rank) >= 2 && Number(card.rank) <= 10);
  const move = before(path + "/move", "POST", { action: "deploy", index, revision: started.revision }, host.token);
  assert.equal(move.status, 200);
  const after = friendRooms({ savePath });
  assert.equal(after(path, "GET").status, 403);
  assert.deepEqual(JSON.parse(JSON.stringify(after(path, "GET", {}, host.token).data)), JSON.parse(JSON.stringify(move.data)));
  const guestView = after(path, "GET", {}, guest.token).data;
  assert.deepEqual(JSON.parse(JSON.stringify(guestView)), JSON.parse(JSON.stringify(before(path, "GET", {}, guest.token).data)));
  assert.equal(guestView.opening.enemyField[3].card, undefined);
  assert.equal(after(path + "/move", "POST", { action: "deploy", index, revision: started.revision }, host.token).status, 409);
});
