import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { onRequest } from "../functions/api/friend-rooms/[[path]].js";

test("production room handler shares settings while protecting both seats", async () => {
  const db = new DatabaseSync(":memory:");
  try {
    const env = { FRIEND_ROOMS: { prepare(sql) {
      const statement = db.prepare(sql);
      const prepared = args => ({
        first: async () => statement.get(...args),
        run: async () => statement.run(...args),
        bind: (...params) => prepared(params),
      });
      return prepared([]);
    } } };
    const origin = "https://bradscardgame.com";
    const send = (method, path = [], body, token, requestOrigin = origin) => onRequest({
      env, params: { path }, request: new Request(origin + "/api/friend-rooms", {
        method, headers: { Origin: requestOrigin, ...(body && { "Content-Type": "application/json" }),
          ...(token && { Authorization: "Bearer " + token }) },
        body: body && JSON.stringify(body),
      }),
    });
    assert.equal((await send("GET")).status, 503);
    db.exec(readFileSync(new URL("../multiplayer/schema.sql", import.meta.url), "utf8"));
    db.exec(readFileSync(new URL("../multiplayer/match-schema.sql", import.meta.url), "utf8"));
    assert.equal((await send("GET")).status, 200);
    const setup = { name: "Host", firstTurn: "flip", jokers: 4 };
    assert.equal((await send("POST", [], setup, "", "https://other.example")).status, 403);
    const host = await (await send("POST", [], setup)).json();
    assert.equal((await send("GET", [host.code])).status, 404);
    const join = [host.code, "join"];
    const responses = await Promise.all([send("POST", join, { name: "Guest" }), send("POST", join, { name: "Extra" })]);
    assert.deepEqual(responses.map(response => response.status), [200, 409]);
    const guest = await responses[0].json();
    assert.notEqual(host.token, guest.token);
    const change = { firstTurn: "guest", jokers: 1 };
    assert.equal((await send("PATCH", [host.code], change, guest.token)).status, 403);
    assert.equal((await send("PATCH", [host.code], change, host.token)).status, 200);
    const restored = await (await send("GET", [host.code], undefined, guest.token)).json();
    assert.deepEqual(restored.settings, { ...change, timer: false });
    assert.equal(restored.token, undefined);
    const start = [host.code, "start"];
    assert.equal((await send("POST", start, {}, guest.token)).status, 403);
    const started = await (await send("POST", start, {}, host.token)).json();
    assert.equal(started.opening.firstSeat, "guest");
    assert.equal(started.opening.hand.length, 5);
    assert.equal(started.opening.deckCount, 43);
    assert.equal(started.opening.drawPile, undefined);
    assert.equal(started.opening.hands, undefined);
    const guestOpening = (await (await send("GET", [host.code], undefined, guest.token)).json()).opening;
    assert.equal(guestOpening.hand.length, 5);
    assert.ok(guestOpening.hand.every(card => !started.opening.hand.some(other => JSON.stringify(card) === JSON.stringify(other))));
    assert.deepEqual((await (await send("POST", start, {}, host.token)).json()).opening, started.opening);
    assert.equal((await send("PATCH", [host.code], setup, host.token)).status, 403);
    const move = [host.code, "move"];
    assert.equal((await send("POST", move, { action: "end-turn", revision: 0 }, host.token)).status, 409);
    const stored = JSON.parse(db.prepare("SELECT opening FROM friend_matches").get().opening);
    stored.hands.guest[0] = { type: "standard", rank: "6", suit: "hearts" };
    db.prepare("UPDATE friend_matches SET opening = ?").run(JSON.stringify(stored));
    const deployed = await send("POST", move, { action: "deploy", index: 0, revision: 0 }, guest.token);
    assert.equal(deployed.status, 200);
    assert.deepEqual((await deployed.json()).opening.deployed, [stored.hands.guest[0]]);
    const opponent = (await (await send("GET", [host.code], undefined, host.token)).json()).opening;
    assert.equal(opponent.opponentDeployed, 1);
    assert.deepEqual(opponent.deployed, []);
    assert.equal((await send("POST", move, { action: "end-turn", revision: 0 }, guest.token)).status, 409);
    const ended = await send("POST", move, { action: "end-turn", revision: 1 }, guest.token);
    assert.equal(ended.status, 200);
    const nextTurn = (await (await send("GET", [host.code], undefined, host.token)).json()).opening;
    assert.equal(nextTurn.turn, 2);
    assert.equal(nextTurn.hand.length, 6);
    assert.equal(nextTurn.deckCount, 42);
    assert.equal((await send("POST", move, { action: "end-turn", revision: 2 }, host.token)).status, 200);
    assert.equal((await send("POST", move, { action: "end-turn", revision: 3 }, guest.token)).status, 409);
    db.exec("UPDATE friend_rooms SET expires_at = 0");
    assert.equal((await send("GET", [host.code], undefined, guest.token)).status, 404);
  } finally {
    db.close();
  }
});
