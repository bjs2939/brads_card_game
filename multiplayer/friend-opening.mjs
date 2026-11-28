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
  return { firstSeat: opening.firstSeat, hand: opening.hands[seat],
    turn: opening.turn ?? 1, revision: opening.revision ?? 0,
    deployed: opening.fields?.[seat] ?? [], opponentDeployed: opening.fields?.[otherSeat(seat)]?.length ?? 0,
    opponentCardCount: opening.hands[seat === "host" ? "guest" : "host"].length,
    deckCount: opening.drawPile.length };
}

export function playFriendOpening(opening, seat, action, index, revision) {
  const turn = opening.turn ?? 1;
  if (turn > 2 || revision !== (opening.revision ?? 0)) return null;
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
    return next;
  }
  if (action !== "end-turn") return null;
  next.turn++;
  if (turn === 1 && opening.drawPile.length) {
    const opponent = otherSeat(seat);
    const [draw, ...remaining] = opening.drawPile;
    next.hands = { ...opening.hands, [opponent]: [...opening.hands[opponent], draw] };
    next.drawPile = remaining;
  }
  return next;
}
