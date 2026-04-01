
//types.ts
//C:\Users\bjs29\OneDrive\Desktop\Programs\brads_card_game\src\game_engine\types.ts



// types.ts
// src/game_engine/types.ts

// card definitions

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export type JokerColor = "red" | "black";

export type Card =
  | {
      type: "standard";
      suit: Suit;
      rank: Rank;
    }
  | {
      type: "joker";
      color: JokerColor;
    };

// player definitions

export type PlayerType = "human" | "computer";

export type Player = {
  id: string;
  name: string;
  type: PlayerType;
  hand: Card[];
};

// game state

export type GamePhase =
  | "setup"
  | "playerTurn"
  | "computerTurn"
  | "gameOver";

export type GameState = {
  phase: GamePhase;
  players: Player[];
  drawPile: Card[];
  discardPile: Card[];
  turnPlayerId: string;
  winnerId: string | null;
};