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
    db.exec("UPDATE friend_rooms SET expires_at = 0");
    assert.equal((await send("GET", [host.code], undefined, guest.token)).status, 404);
  } finally {
    db.close();
  }
});
