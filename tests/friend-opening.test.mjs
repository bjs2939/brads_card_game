import assert from "node:assert/strict";
import test from "node:test";
import { battleForSeat, playFriendBattle, startFriendBattle } from "../multiplayer/friend-battle.mjs";
import { playFriendOpening } from "../multiplayer/friend-opening.mjs";

test("a full opening back rank keeps the turn open only for a legal stack or shield", () => {
  const card = (rank, suit = "hearts") => ({ type: "standard", suit, rank });
  const troop = card("6");
  const match = card("6", "spades");
  const ace = card("A");
  const queen = card("Q");
  const makeState = extra => ({ firstSeat: "host", hands: { host: [troop, extra], guest: [] },
    drawPile: [card("9")], fields: { host: [card("4"), card("5")], guest: [] } });
  for (const extra of [ace, card("2")]) {
    const next = playFriendOpening(makeState(extra), "host", "deploy", 0, 0);
    assert.equal(next.turn, 2);
    assert.deepEqual(next.hands.host, [extra]);
  }
  const held = playFriendOpening(makeState(match), "host", "deploy", 0, 0);
  assert.equal(held.turn, 1);
  const stacked = playFriendOpening(held, "host", "stack-hand", 0, 1, 5);
  assert.equal(stacked.turn, 2);
  assert.equal(stacked.stacks.host[0].lane, 5);
  const shieldAvailable = playFriendOpening(makeState(queen), "host", "deploy", 0, 0);
  assert.equal(shieldAvailable.turn, 1);
  assert.equal(playFriendOpening(shieldAvailable, "host", "shield", 0, 1, 5).turn, 2);

  const secondSeat = { ...makeState(ace), turn: 2, firstSeat: "guest" };
  assert.equal(playFriendOpening(secondSeat, "host", "deploy", 0, 0).turn, 3);
});


test("a shield-blocked attack ends the attacking seat's turn and identifies it to both players", () => {
  const troop = (rank, suit) => ({ type: "standard", rank, suit });
  const shield = { card: troop("J", "spades"), revealed: false };
  const opening = { firstSeat: "host", hands: { host: [], guest: [] }, drawPile: [troop("3", "hearts"), troop("5", "diamonds")],
    fields: { host: [troop("10", "clubs")], guest: [troop("6", "diamonds")] },
    shields: { guest: [[shield]] } };
  const battle = playFriendBattle(startFriendBattle(opening), "host", "promote", 3, 0);
  const resolved = playFriendBattle(battle, "host", "attack", 0, 3);
  assert.match(resolved.game.result, /blocked the attack/);
  assert.deepEqual(resolved.game.playerField[3].shields[0].card, shield.card);
  const host = battleForSeat(resolved, "host");
  const guest = battleForSeat(resolved, "guest");
  assert.equal(guest.turn, 4);
  assert.equal(host.active, false);
  assert.equal(guest.active, true);
  assert.deepEqual(host.completedAttack, { turn: 3, byYou: true });
  assert.deepEqual(guest.completedAttack, { turn: 3, byYou: false });
  assert.equal(playFriendBattle(resolved, "host", "attack", 0, 3), null);
  const promoted = playFriendBattle(resolved, "guest", "promote", 3, 0);
  assert.equal(battleForSeat(promoted, "guest").completedAttack, undefined);
});
