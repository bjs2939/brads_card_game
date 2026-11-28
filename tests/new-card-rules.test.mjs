import test from "node:test";
import assert from "node:assert/strict";
import { calculateAttack, deploy, dropFieldUnit, resolveAttack, scurryFromHand, useShieldAbility } from "../src/game_engine/battle.ts";

const card = (rank, suit = "diamonds") => ({ type: "standard", rank, suit });
const game = overrides => ({ player: [], computer: [], playerField: [], computerField: [],
  phase: "player", step: "move-out", turn: 3, selected: null, round: { id: "test", at: 1 },
  discardPile: [], ...overrides });

test("Diamonds gain one against Diamonds outside Tutorial 1", () => {
  const field = [deploy(card("5"))];
  assert.equal(calculateAttack(field, 0, card("6")).power, 6);
  assert.equal(calculateAttack(field, 0, card("6"), true).power, 5);
  assert.equal(calculateAttack(field, 0, card("6", "spades")).power, 5);
});

test("Rats scurry to an open front lane, except in Tutorial 1", () => {
  const rat = card("3", "clubs");
  const base = game({ player: [rat] });
  const moved = scurryFromHand(base, rat, 0);
  assert.equal(moved.playerField[0].card, rat);
  assert.equal(moved.player.length, 0);
  assert.equal(moved.movements.length, 1);
  assert.equal(scurryFromHand(game({ ...base, tutorialRules: true }), rat, 0).player.length, 1);
  assert.equal(scurryFromHand(game({ player: [card("2")] }), card("2"), 0).playerField.length, 0);
});

test("Only 2s and 3s move freely from front to back", () => {
  for (const rank of ["2", "3"]) {
    const base = game({ playerField: [deploy(card(rank))] });
    const moved = dropFieldUnit(base, 0, 3);
    assert.equal(moved.playerField[0], null);
    assert.equal(moved.playerField[3].card.rank, rank);
    assert.equal(moved.step, base.step);
    const tutorial = { ...base, tutorialRules: true };
    assert.equal(dropFieldUnit(tutorial, 0, 3), tutorial);
  }
  const strong = game({ playerField: [deploy(card("4"))] });
  assert.equal(dropFieldUnit(strong, 0, 3), strong);
});

test("EMP Jammer keeps 5s hidden from Jack Spy", () => {
  const jack = card("J", "clubs");
  const target = { ...deploy(card("5", "hearts")), revealed: false };
  const base = game({ player: [jack], computerField: [target] });
  assert.equal(useShieldAbility(base, jack).computerField[0].revealed, false);
  assert.equal(useShieldAbility({ ...base, tutorialRules: true }, jack).computerField[0].revealed, true);
});

test("Holy Knight Convert against a Joker triggers the explosion", () => {
  const knight = card("7", "hearts");
  const joker = { type: "joker", color: "black" };
  const battle = game({ playerField: [deploy(knight)], computerField: [deploy(joker)], step: "attack" });
  const resolved = resolveAttack(battle, "player", 0, 0, undefined, undefined, true);
  assert.equal(resolved.jokerExplosion?.attacker, knight);
  assert.equal(resolved.attackAnimation?.kind, "convert");
});
