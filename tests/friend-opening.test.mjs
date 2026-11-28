import assert from "node:assert/strict";
import test from "node:test";
import { playFriendOpening } from "../multiplayer/friend-opening.mjs";

test("opening deployment ends turn only when the back rank is full and no face card remains", () => {
  const troop = { type: "standard", suit: "hearts", rank: "6" };
  const ace = { ...troop, rank: "A" };
  const state = { firstSeat: "host", hands: { host: [troop, troop], guest: [] },
    drawPile: [troop], fields: { host: [troop, troop], guest: [] } };
  const next = playFriendOpening(state, "host", "deploy", 0, 0);
  assert.equal(next.turn, 2);
  assert.equal(next.fields.host.length, 3);
  assert.deepEqual(next.hands.host, [troop]);
  assert.deepEqual(next.hands.guest, [troop]);
  const held = playFriendOpening({ ...state, hands: { ...state.hands, host: [troop, ace] } }, "host", "deploy", 0, 0);
  assert.equal(held.turn, 1);
  assert.deepEqual(held.hands.host, [ace]);
});
