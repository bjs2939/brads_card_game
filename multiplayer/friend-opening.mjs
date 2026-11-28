import { battleForSeat, maskFriendField, openingField, playFriendBattle, startFriendBattle } from "./friend-battle.mjs";
import { equipShield, openingPlaysExhausted, stackOnto } from "../src/game_engine/battle.ts";
import { canDeploy, createFullDeck, dealSimpleGame, shuffleDeck } from "../src/game_engine/deck.ts";

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
    deployed: opening.fields?.[seat] ?? [], opponentDeployed: opening.fields?.[otherSeat(seat)]?.length ?? 0,
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
  if (action === "deploy") {
    const card = hand[index];
    if (!Number.isInteger(index) || !card || !canDeploy(card) || fields[seat].length >= 3) return null;
    next.fields = { ...fields, [seat]: [...fields[seat], card] };
    next.hands = { ...opening.hands, [seat]: hand.filter((_, position) => position !== index) };
  } else if (action === "shield" || action === "stack-hand") {
    if (!Number.isInteger(index) || !Number.isInteger(target)) return null;
    const playerField = openingField(opening, seat);
    const game = { phase: "player", step: "move-out", player: hand, playerField };
    if (!hand[index]) return null;
    const equipped = action === "shield" ? equipShield(game, hand[index], target)
      : stackOnto(game, { from: "hand", card: hand[index] }, target);
    if (equipped === game) return null;
    next.hands = { ...opening.hands, [seat]: equipped.player };
    next.shields = { ...opening.shields, [seat]: equipped.playerField.slice(3, 6).map(unit => unit?.shields ?? []) };
    next.stacks = { ...opening.stacks, [seat]: equipped.playerField.slice(6) };
  } else if (action !== "end-turn") return null;
  if (action !== "end-turn" && !openingPlaysExhausted({
    phase: "player", turn, step: "move-out", playerField: openingField(next, seat), player: next.hands[seat],
  }, false)) return next;
  next.turn++;
  if (turn === 1 && opening.drawPile.length) {
    const opponent = otherSeat(seat);
    const [draw, ...remaining] = opening.drawPile;
    next.hands = { ...next.hands, [opponent]: [...next.hands[opponent], draw] };
    next.drawPile = remaining;
  }
  return next;
}
