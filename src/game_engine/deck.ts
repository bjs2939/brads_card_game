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

function createFullDeck(): Card[] {
  return [...createStandardDeck(), { type: "joker", color: "red" }, { type: "joker", color: "black" }];
}

export const tutorialDeploymentRanks = ["4", "5", "6"] as const;

export function createTutorialDeck(): Card[] {
  const cards = createFullDeck();
  const opening: [Rank, Suit][] = [
    ["4", "hearts"], ["3", "clubs"],
    ["5", "spades"], ["4", "spades"],
    ["6", "hearts"], ["7", "spades"],
    ["J", "spades"], ["Q", "diamonds"],
    ["7", "clubs"], ["5", "diamonds"],
    ["6", "diamonds"], ["8", "hearts"],
  ];
  const planned = opening.map(([rank, suit]): Card => ({ type: "standard", rank, suit }));
  const remaining = cards.filter(card => !planned.some(placed =>
    card.type === "standard" && placed.type === "standard" && card.rank === placed.rank && card.suit === placed.suit
  ));
  return [...planned, ...remaining.map((_, index) => remaining[(index * 17) % remaining.length])];
}

export function dealSimpleGame(deck = shuffleDeck(createFullDeck())) {
  return {
    player: deck.slice(0, 10).filter((_, index) => index % 2 === 0),
    computer: deck.slice(0, 10).filter((_, index) => index % 2 === 1),
    drawPile: deck.slice(10),
  };
}
