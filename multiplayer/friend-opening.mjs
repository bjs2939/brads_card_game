import { createFullDeck, dealSimpleGame, shuffleDeck } from "../src/game_engine/deck.ts";

export function dealFriendOpening(settings) {
  const { player, computer, drawPile } = dealSimpleGame(shuffleDeck(createFullDeck(settings.jokers)));
  const firstSeat = settings.firstTurn === "flip"
    ? (crypto.getRandomValues(new Uint8Array(1))[0] % 2 === 0 ? "host" : "guest")
    : settings.firstTurn;
  return { firstSeat, hands: { host: player, guest: computer }, drawPile };
}

export function openingForSeat(opening, seat) {
  return { firstSeat: opening.firstSeat, hand: opening.hands[seat],
    opponentCardCount: opening.hands[seat === "host" ? "guest" : "host"].length,
    deckCount: opening.drawPile.length };
}
