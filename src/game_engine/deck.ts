import type { Card, Rank, Suit } from "./types";

export type StandardCard = Extract<Card, { type: "standard" }>;

export const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function createStandardDeck(): StandardCard[] {
  return suits.flatMap(suit => ranks.map(rank => ({ type: "standard", suit, rank })));
}

export function shuffleDeck<T extends Card>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

export function dealSimpleGame() {
  const deck = shuffleDeck<Card>([
    ...createStandardDeck(),
    { type: "joker", color: "red" },
    { type: "joker", color: "black" },
  ]);

  return {
    player: deck.slice(0, 10).filter((_, index) => index % 2 === 0),
    computer: deck.slice(0, 10).filter((_, index) => index % 2 === 1),
    drawPile: deck.slice(10),
  };
}
