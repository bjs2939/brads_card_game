import { battleForSeat, maskFriendField, openingField, playFriendBattle, startFriendBattle } from "./friend-battle.mjs";
import { deployFromHand, dropFieldUnit, unstackUnit, equipShield, openingPlaysExhausted, stackOnto, transferPlayerShield, undoPlayerMovement } from "../src/game_engine/battle.ts";
import { createFullDeck, dealSimpleGame, shuffleDeck } from "../src/game_engine/deck.ts";

export function dealFriendOpening(settings) {
  const { player, computer, drawPile } = dealSimpleGame(shuffleDeck(createFullDeck(settings.jokers)));
  const firstSeat = settings.firstTurn === "flip"
    ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? "host" : "guest")
    : settings.firstTurn;
  return { firstSeat, hands: { host: player, guest: computer }, drawPile };
}

const otherSeat = seat => seat === "host" ? "guest" : "host";

export function openingForSeat(opening, seat) {
  if ((opening.turn ?? 1) > 2) return { firstSeat: opening.firstSeat, revision: opening.revision ?? 0,
    ...battleForSeat(opening.battle ?? startFriendBattle(opening), seat) };
  return { firstSeat: opening.firstSeat, hand: opening.hands[seat],
    turn: opening.turn ?? 1, revision: opening.revision ?? 0,
    deployed: (opening.fields?.[seat] ?? []).filter(Boolean), opponentDeployed: (opening.fields?.[otherSeat(seat)] ?? []).filter(Boolean).length,
    undoCount: seat === ((opening.turn ?? 1) === 1 ? opening.firstSeat : otherSeat(opening.firstSeat)) ? opening.movements?.[seat]?.length ?? 0 : 0,
    shields: opening.shields?.[seat] ?? [],
    ownField: openingField(opening, seat), enemyField: maskFriendField(openingField(opening, otherSeat(seat))),
    opponentShieldCounts: (opening.shields?.[otherSeat(seat)] ?? []).map(layers => layers?.length ?? 0),
    opponentCardCount: opening.hands[seat === "host" ? "guest" : "host"].length,
    deckCount: opening.drawPile.length };
}

export function playFriendOpening(opening, seat, action, index, revision, target, shieldIndex) {
  const turn = opening.turn ?? 1;
  if (revision !== (opening.revision ?? 0)) return null;
  if (turn > 2) {
    const battle = playFriendBattle(opening.battle ?? startFriendBattle(opening), seat, action, index, target, shieldIndex);
    return battle ? { ...opening, battle, revision: revision + 1 } : null;
  }
  const active = turn === 1 ? opening.firstSeat : otherSeat(opening.firstSeat);
  if (seat !== active) return null;
  const fields = opening.fields ?? { host: [], guest: [] };
  const hand = opening.hands[seat];
  const next = { ...opening, fields, turn, revision: revision + 1 };
  if (action !== "end-turn") {
    const game = { phase: "player", step: "move-out", turn, player: hand,
      playerField: openingField(opening, seat), movements: opening.movements?.[seat] };
    const card = Number.isInteger(index) ? hand[index] : undefined;
    let updated = game;
    if (action === "undo") updated = undoPlayerMovement(game);
    if (action === "deploy" && card) updated = deployFromHand(game, card);
    if (action === "shield" && card && Number.isInteger(target)) updated = equipShield(game, card, target);
    if (action === "stack-hand" && card && Number.isInteger(target)) updated = stackOnto(game, { from: "hand", card }, target);
    if (action === "transfer" && Number.isInteger(index) && Number.isInteger(target) && index !== target &&
        Number.isInteger(shieldIndex)) {
      const source = game.playerField[index];
      const layer = source?.shields?.[shieldIndex];
      if (layer) updated = transferPlayerShield(game, { source: source.card, layer }, target);
    }
    if ((action === "drop-field" || action === "swap-field") && Number.isInteger(index) && Number.isInteger(target)) {
      updated = dropFieldUnit(game, index, target, action === "swap-field");
    }
    if (action === "unstack" && Number.isInteger(index)) updated = unstackUnit(game, index);
    if (updated === game) return null;
    const back = updated.playerField.slice(3, 6);
    next.fields = { ...fields, [seat]: back.map(unit => unit?.card ?? null) };
    next.hands = { ...opening.hands, [seat]: updated.player };
    next.shields = { ...opening.shields, [seat]: back.map(unit => unit?.shields ?? []) };
    next.stacks = { ...opening.stacks, [seat]: updated.playerField.slice(6) };
    next.movements = { ...opening.movements, [seat]: updated.movements };
    if (action === "transfer" || !openingPlaysExhausted(updated, false)) return next;
  }
  next.turn++;
  if (turn === 1 && opening.drawPile.length) {
    const opponent = otherSeat(seat);
    const [draw, ...remaining] = opening.drawPile;
    next.hands = { ...next.hands, [opponent]: [...next.hands[opponent], draw] };
    next.drawPile = remaining;
  }
  return next;
}
