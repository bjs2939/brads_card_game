import type { Card, Rank, Suit } from "./game_engine/types";

export const suitSymbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

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

const suitSprites: Partial<Record<Rank, Partial<Record<Suit, string>>>> = {
  "8": { clubs: "unicorn-lancer-8-clubs", spades: "dark-rider-9-spades", diamonds: "pegasus-rider-8-diamonds" },
  "10": { hearts: "dragon-10-hearts", clubs: "dragon-10-clubs" },
  "9": {
    hearts: "flame-swordsman-9-hearts",
    clubs: "spear-warrior-9-clubs-steady",
    spades: "axe-warrior-9-spades",
    diamonds: "wizard-9-diamonds",
  },
};

function cardSprite(card?: Card, attachedShield = false, fourShieldBroken = false) {
  const suitSprite = card?.type === "standard" ? suitSprites[card.rank]?.[card.suit] : undefined;
  return !card ? undefined
    : card.type === "joker" ? { sprite: "joker-bomb", className: "card-ranger-overlay", size: 50 }
    : suitSprite
      ? { sprite: suitSprite, className: suitSprite === "unicorn-lancer-8-clubs" ? "card-unicorn-lancer-overlay"
          : suitSprite === "pegasus-rider-8-diamonds" ? "card-pegasus-rider-overlay"
          : suitSprite === "dragon-10-hearts" ? "card-heart-dragon-overlay" : "card-ranger-overlay", size: 60 }
      : !attachedShield && (card.rank === "J" || card.rank === "Q")
        ? { sprite: "shield-jq", className: "", size: 32 }
        : card.rank === "4" && fourShieldBroken
          ? { ...characters["4"]!, sprite: "knight-4-unshielded" }
          : characters[card.rank];
}

export function BattlePiece({ card, animation, className, spriteClassName }: {
  card: Card;
  animation?: string;
  className?: string;
  spriteClassName?: string;
}) {
  const sprite = cardSprite(card);
  const filename = animation ?? (sprite && `${sprite.sprite}.gif`);
  if (!filename) return <CardFace card={card} />;
  return (
    <div className={className}>
      <img className={`battle-piece ${spriteClassName ?? ""}`}
        src={`${import.meta.env.BASE_URL}assets/effects/${filename}`} alt="" draggable={false} />
      <span className="battle-piece-stamp" data-suit={card.type === "standard" ? card.suit : undefined}>
        {card.type === "standard" ? `${card.rank}${suitSymbols[card.suit]}` : "Joker"}
      </span>
    </div>
  );
}

export default function CardFace({ card, faceDown = false, attachedShield = false, fourShieldBroken = false }: { card?: Card; faceDown?: boolean; attachedShield?: boolean; fourShieldBroken?: boolean }) {
  const label = card?.type === "joker"
    ? `${card.color} joker`
    : card && `${faceRanks[card.rank] ?? card.rank} of ${card.suit}`;

  const image = faceDown ? "card-back-blue" : label?.replace(/ /g, "-");
  const legendary = !faceDown && card?.type === "standard" && card.rank === "9";
  const dragon = !faceDown && card?.type === "standard" && card.rank === "10";
  const character = faceDown ? undefined : cardSprite(card, attachedShield, fourShieldBroken);

  return (
    <div data-legendary-card={legendary || undefined} data-dragon-card={dragon || undefined} data-blue-rider={character?.sprite === "dark-rider-9-spades" || undefined} data-fiery-spartan={character?.sprite === "spear-warrior-9-clubs-steady" || undefined} style={{ width: "100%", aspectRatio: "5 / 7", position: "relative" }}>
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
