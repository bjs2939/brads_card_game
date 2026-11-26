import type { Card, Rank, Suit } from "./game_engine/types";

const faceRanks: Partial<Record<Rank, string>> = { A: "ace", J: "jack", Q: "queen", K: "king" };

const characters: Partial<Record<Rank, { sprite: string; className: string; size: number }>> = {
  "2": { sprite: "halfling-2", className: "card-ranger-overlay", size: 50 },
  "3": { sprite: "rat-3", className: "card-ranger-overlay", size: 60 },
  "4": { sprite: "knight-4", className: "card-knight-overlay", size: 45 },
  "5": { sprite: "engineer-5", className: "card-engineer-overlay", size: 45 },
  "6": { sprite: "ranger-6", className: "card-ranger-overlay", size: 50 },
  "7": { sprite: "holy-knight-7", className: "card-ranger-overlay", size: 50 },
  "8": { sprite: "unicorn-8", className: "card-ranger-overlay", size: 50 },
  "10": { sprite: "dragon-10", className: "", size: 32 },
};

const legendarySprites: Partial<Record<Suit, string>> = {
  hearts: "flame-swordsman-9-hearts",
  clubs: "spear-warrior-9-clubs",
  diamonds: "wizard-9-diamonds",
};

export default function CardFace({ card, faceDown = false }: { card?: Card; faceDown?: boolean }) {
  const label = card?.type === "joker"
    ? `${card.color} joker`
    : card && `${faceRanks[card.rank] ?? card.rank} of ${card.suit}`;

  const image = faceDown ? "card-back-blue" : label?.replace(/ /g, "-");
  const legendary = !faceDown && card?.type === "standard" && card.rank === "9";
  const dragon = !faceDown && card?.type === "standard" && card.rank === "10";
  const legendarySprite = legendary ? legendarySprites[card.suit] : undefined;
  const character = faceDown || !card ? undefined
    : card.type === "joker" ? { sprite: "joker-bomb", className: "card-ranger-overlay", size: 50 }
    : legendarySprite
      ? { sprite: legendarySprite, className: "card-ranger-overlay", size: 60 }
      : characters[card.rank];

  return (
    <div data-legendary-card={legendary || undefined} data-dragon-card={dragon || undefined} style={{ width: "100%", aspectRatio: "5 / 7", position: "relative" }}>
      {image ? (
        <img key={image} draggable={false}
          src={`${import.meta.env.BASE_URL}assets/cards/${image}.png`}
          alt={faceDown ? "Face-down card" : label}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            boxSizing: "border-box",
            border: "1px solid #667085",
            borderRadius: "0.5rem",
            background: "#fff",
          }}
        />
      ) : (
        <div style={{
          height: "100%",
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
          border: "1px dashed #999",
          borderRadius: "0.5rem",
        }}>
          Face down
        </div>
      )}
      {character && (
        <img
          className={`card-dragon-overlay ${character.className}`}
          src={`${import.meta.env.BASE_URL}assets/effects/${character.sprite}.gif`}
          alt=""
          draggable={false}
          width={character.size}
          height={character.size}
        />
      )}
    </div>
  );
}
