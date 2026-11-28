import assert from "node:assert/strict";
import test from "node:test";
import { battleForSeat, playFriendBattle, startFriendBattle } from "../multiplayer/friend-battle.mjs";
import { openingForSeat, playFriendOpening } from "../multiplayer/friend-opening.mjs";

test("only the first seat auto-ends on a full back rank with shield or stack plays available", () => {
  const card = (rank, suit = "hearts") => ({ type: "standard", suit, rank });
  const troop = card("6");
  const match = card("6", "spades");
  const makeState = (extra, turn) => ({ firstSeat: turn === 1 ? "host" : "guest", turn,
    hands: { host: [troop, extra], guest: [] }, drawPile: [card("9")],
    fields: { host: [card("4"), card("5")], guest: [] } });
  for (const extra of [card("A"), card("2"), match, card("J"), card("Q")]) {
    const next = playFriendOpening(makeState(extra, 1), "host", "deploy", 0, 0);
    assert.equal(next.turn, 2);
    assert.deepEqual(next.hands.host, [extra]);
  }
  for (const [extra, action] of [[match, "stack-hand"], [card("J"), "shield"], [card("Q"), "shield"]]) {
    const held = playFriendOpening(makeState(extra, 2), "host", "deploy", 0, 0);
    assert.equal(held.turn, 2);
    const played = playFriendOpening(held, "host", action, 0, 1, 5);
    assert.equal(played.turn, 3);
    assert.deepEqual(played.hands.host, []);
  }
  assert.equal(playFriendOpening(makeState(card("A"), 2), "host", "deploy", 0, 0).turn, 3);
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

test("multiplayer can undo recorded deployments and promotions after saving the match", () => {
  const troop = { type: "standard", rank: "5", suit: "spades" };
  const reserve = { ...troop, rank: "8" };
  const opening = { firstSeat: "host", hands: { host: [troop, reserve], guest: [] }, drawPile: [reserve] };
  const reload = game => JSON.parse(JSON.stringify(game));
  const deployed = playFriendOpening(opening, "host", "deploy", 0, 0);
  assert.equal(openingForSeat(deployed, "host").undoCount, 1);
  assert.equal(openingForSeat(deployed, "guest").undoCount, 0);
  const undone = playFriendOpening(reload(deployed), "host", "undo", undefined, 1);
  assert.deepEqual(undone.hands.host, [troop, reserve]);
  assert.equal(openingForSeat(undone, "host").ownField[3], null);
  assert.equal(openingForSeat(undone, "host").undoCount, 0);

  const queen = { ...troop, rank: "Q" };
  const battle = startFriendBattle({ ...opening, drawPile: [{ ...reserve, suit: "hearts" }, { ...reserve, suit: "clubs" }],
    hands: { host: [reserve], guest: [] }, fields: { host: [troop] },
    shields: { host: [[{ card: queen, revealed: false }]] } });
  const promoted = playFriendBattle(battle, "host", "promote", 3, 0);
  assert.equal(playFriendBattle(promoted, "host", "rearrange", 0, 4), null);
  const deployedAgain = playFriendBattle(promoted, "host", "deploy", 0);
  assert.equal(battleForSeat(deployedAgain, "host").undoCount, 2);
  const transferred = playFriendBattle(reload(deployedAgain), "host", "transfer", 0, 3, 0);
  assert.equal(transferred.game.turn, deployedAgain.game.turn);
  assert.equal(transferred.game.step, deployedAgain.game.step);
  assert.equal(battleForSeat(transferred, "host").undoCount, 2);
  assert.deepEqual(transferred.game.playerField[3].shields[0].card, queen);
  assert.equal(transferred.game.playerField[0].shields.length, 0);
  const undoneDeploy = playFriendBattle(reload(transferred), "host", "undo");
  assert.ok(undoneDeploy.game.player.some(card => card.rank === "Q"));
  const undonePromotion = playFriendBattle(reload(undoneDeploy), "host", "undo");
  assert.deepEqual(battleForSeat(undonePromotion, "host").ownField[3].card, troop);
  assert.equal(battleForSeat(undonePromotion, "host").undoCount, 0);
});

test("battlefield drops stack matching 6s, swap unlike ranks, and unstack into the same rank", () => {
  const card = (rank, suit) => ({ type: "standard", rank, suit });
  const six = card("6", "hearts");
  const otherSix = card("6", "spades");
  const five = card("5", "clubs");
  const shield = { card: card("J", "hearts"), revealed: false };
  const battle = startFriendBattle({ firstSeat: "host", hands: { host: [], guest: [] },
    fields: { host: [six, five, otherSix] }, shields: { host: [[], [], [shield]] },
    drawPile: [card("3", "hearts"), card("7", "hearts")] });
  const swapped = playFriendBattle(battle, "host", "drop-field", 4, 3);
  assert.deepEqual(swapped.game.playerField[3].card, five);
  assert.deepEqual(swapped.game.playerField[4].card, six);
  const stacked = playFriendBattle(swapped, "host", "drop-field", 5, 4);
  assert.deepEqual(stacked.game.playerField[6].card, otherSix);
  assert.equal(stacked.game.playerField[6].lane, 4);
  assert.equal(stacked.game.playerField[5], null);
  const full = playFriendBattle(stacked, "host", "deploy", 0);
  assert.equal(playFriendBattle(full, "host", "unstack", 4), null);
  const split = playFriendBattle(stacked, "host", "unstack", 4);
  assert.deepEqual(split.game.playerField[5].card, otherSix);
  assert.deepEqual(split.game.playerField[5].shields, [shield]);
  assert.equal(split.game.turn, battle.game.turn);
  assert.equal(battleForSeat(split, "host").undoCount, 0);
});

test("a Joker blast survives multiplayer turn handoff for both seats", () => {
  const joker = { type: "joker", color: "black" };
  for (const rank of ["5", "7", "10"]) {
    const attacker = { type: "standard", rank, suit: "spades" };
    const battle = startFriendBattle({ firstSeat: "host", hands: { host: [], guest: [] },
      fields: { host: [attacker], guest: [joker] },
      drawPile: [{ type: "standard", rank: "3", suit: "hearts" }, { type: "standard", rank: "9", suit: "hearts" }] });
    const promoted = playFriendBattle(battle, "host", "promote", 3, 0);
    const resolved = JSON.parse(JSON.stringify(playFriendBattle(promoted, "host", "attack", 0, 3)));
    assert.equal(battleForSeat(resolved, "guest").active, true);
    const blast = battleForSeat(resolved, "guest").jokerExplosion;
    assert.deepEqual(battleForSeat(resolved, "host").jokerExplosion, blast);
    assert.deepEqual(blast.attacker, attacker);
    assert.equal(blast.survived, rank === "5");
    assert.equal(blast.turn, 3);
  }
});

test("attached Queens grant two attacks and attached Jacks spy then pass the turn", () => {
  const card = (rank, suit) => ({ type: "standard", rank, suit });
  const jack = card("J", "diamonds");
  const queen = card("Q", "hearts");
  const attacker = card("9", "diamonds");
  const fieldCard = card("5", "hearts");
  const opening = { firstSeat: "host", hands: { host: [], guest: [] },
    fields: { host: [attacker], guest: [fieldCard, card("3", "clubs")] },
    drawPile: [card("10", "spades"), card("8", "hearts")] };
  const withShield = support => startFriendBattle({ ...opening,
    shields: { host: [[{ card: support, revealed: false }]] } });

  const spied = playFriendBattle(withShield(jack), "host", "shield-ability", 3, undefined, 0);
  assert.equal(spied.seat, "guest");
  assert.equal(spied.game.playerField[3].revealed, true);
  assert.equal(spied.game.computerField[3].shields.length, 0);
  assert.deepEqual(spied.game.discardPile, [jack]);

  const promoted = playFriendBattle(withShield(queen), "host", "promote", 3, 0);
  const armed = playFriendBattle(promoted, "host", "shield-ability", 0, undefined, 0);
  assert.deepEqual(armed.game.discardPile, [queen]);
  assert.equal(armed.game.playerField[0].shields.length, 0);
  assert.equal(battleForSeat(armed, "host").doubleAttack, 2);
  const first = playFriendBattle(armed, "host", "attack", 0, 3);
  assert.equal(first.game.turn, armed.game.turn);
  assert.equal(battleForSeat(first, "host").doubleAttack, 1);
  assert.equal(first.completedAttack, undefined);
  const last = playFriendBattle(first, "host", "attack", 0, 4);
  assert.equal(last.seat, "guest");
  assert.equal(last.game.turn, armed.game.turn + 1);
});
