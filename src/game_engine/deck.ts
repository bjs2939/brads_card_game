import type { Card, Rank, Suit } from "./types";

export type StandardCard = Extract<Card, { type: "standard" }>;

export const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
export function canDeploy(card: Card): boolean {
  return card.type === "joker" || ranks.indexOf(card.rank) <= ranks.indexOf("10");
}

export function openingBackRankComplete(backRankFull: boolean, hand: Card[]): boolean {
  return backRankFull && hand.every(canDeploy);
}

const suits: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function createStandardDeck(): StandardCard[] {
  return suits.flatMap(suit => ranks.map(rank => ({ type: "standard", suit, rank })));
}

export function shuffleDeck<T>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

function extraJokers(): Card[] {
  return [{ type: "joker", color: "red", copy: 2 }, { type: "joker", color: "black", copy: 2 }];
}

export function createFullDeck(jokerCount = 4): Card[] {
  const jokers: Card[] = [{ type: "joker", color: "red" }, { type: "joker", color: "black" }, ...extraJokers()];
  return [...createStandardDeck(), ...jokers.slice(0, jokerCount)];
}

export const tutorialDeploymentRanks = ["4", "5", "6"] as const;

export function createTutorialDeck(): Card[] {
  // Keep the original scripted draw order and add the bonus Jokers after the lesson draws.
  const cards = createFullDeck(2);
  const opening: [Rank, Suit][] = [
    ["4", "hearts"], ["3", "clubs"],
    ["5", "spades"], ["4", "spades"],
    ["6", "hearts"], ["7", "spades"],
    ["J", "spades"], ["Q", "diamonds"],
    ["7", "clubs"], ["5", "diamonds"],
    ["8", "clubs"], ["8", "hearts"],
  ];
  const planned = opening.map(([rank, suit]): Card => ({ type: "standard", rank, suit }));
  const remaining = cards.filter(card => !planned.some(placed =>
    card.type === "standard" && placed.type === "standard" && card.rank === placed.rank && card.suit === placed.suit
  ));
  const deck = [...planned, ...remaining.map((_, index) => remaining[(index * 17) % remaining.length])];
  // Draw the enemy's 7 of Hearts on its third turn so it can deploy before the shield lesson.
  const seven = deck.findIndex(card => card.type === "standard" && card.suit === "hearts" && card.rank === "7");
  [deck[15], deck[seven]] = [deck[seven], deck[15]];
  // Turn 18's enemy draw and turn 19's player draw.
  const ranger = deck.findIndex(card => card.type === "standard" && card.rank === "6" && card.suit === "clubs");
  [deck[45], deck[ranger]] = [deck[ranger], deck[45]];
  const joker = deck.findIndex(card => card.type === "joker" && card.color === "black");
  [deck[46], deck[joker]] = [deck[joker], deck[46]];
  return [...deck, ...extraJokers()];
}

export function dealSimpleGame(deck = shuffleDeck(createFullDeck())) {
  return {
    player: deck.slice(0, 10).filter((_, index) => index % 2 === 0),
    computer: deck.slice(0, 10).filter((_, index) => index % 2 === 1),
    drawPile: deck.slice(10),
  };
}
