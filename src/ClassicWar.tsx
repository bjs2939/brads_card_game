import { useState } from "react";
import CardFace from "./CardFace";
import { createStandardDeck, ranks, shuffleDeck, type StandardCard } from "./game_engine/deck";

type Match = {
  player: StandardCard[];
  computer: StandardCard[];
  revealed: [StandardCard, StandardCard] | null;
  result: string;
};

export function dealWar(): Match {
  const deck = shuffleDeck(createStandardDeck());
  return { player: deck.slice(0, 26), computer: deck.slice(26), revealed: null, result: "" };
}

export function flipWar(match: Match): Match {
  const { player, computer } = match;
  if (!player.length || !computer.length) return match;

  const pile: StandardCard[] = [];
  let revealIndex = 0;
  let wars = 0;
  while (true) {
    const revealed: [StandardCard, StandardCard] = [player[revealIndex], computer[revealIndex]];
    pile.push(...revealed);
    const difference = ranks.indexOf(revealed[0].rank) - ranks.indexOf(revealed[1].rank);
    let playerWins = difference > 0;
    if (difference === 0) {
      wars++;
      const cardsLeft = Math.min(player.length, computer.length) - revealIndex - 1;
      if (cardsLeft > 0) {
        const nextReveal = revealIndex + Math.min(4, cardsLeft);
        pile.push(...player.slice(revealIndex + 1, nextReveal), ...computer.slice(revealIndex + 1, nextReveal));
        revealIndex = nextReveal;
        continue;
      }
      if (player.length === computer.length) {
        return { player: [], computer: [], revealed, result: "Draw. Both players ran out of cards in a war." };
      }
      playerWins = player.length > computer.length;
    }

    const nextPlayer = player.slice(revealIndex + 1);
    const nextComputer = computer.slice(revealIndex + 1);
    (playerWins ? nextPlayer : nextComputer).push(...pile);
    const winner = playerWins ? "You win" : "Computer wins";
    const prize = wars ? "the war" : "the flip";
    const result = nextPlayer.length && nextComputer.length
      ? `${winner} ${prize} and take ${pile.length} cards.`
      : `${winner} the match!`;
    return { player: nextPlayer, computer: nextComputer, revealed, result };
  }
}

export default function ClassicWar({ onBack }: { onBack: () => void }) {
  const [match, setMatch] = useState(dealWar);

  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Classic War</h1>
      <p>Flip a card against the computer. Higher rank takes the pile, and aces are high.</p>
      <p>Ties trigger a war. Flip again after up to three face-down cards.</p>
      <div aria-live="polite">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 9rem))",
          justifyContent: "center",
          gap: "1rem",
        }}>
          <div>
            <p>You · {match.player.length} cards</p>
            <CardFace card={match.revealed?.[0]} />
          </div>
          <div>
            <p>Computer · {match.computer.length} cards</p>
            <CardFace card={match.revealed?.[1]} />
          </div>
        </div>
        <p style={{ minHeight: "1.25rem" }}>{match.result}</p>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.75rem" }}>
        <button disabled={!match.player.length || !match.computer.length} onClick={() => setMatch(flipWar)}>
          Flip Cards
        </button>
        <button onClick={() => setMatch(dealWar())}>New War Match</button>
        <button onClick={onBack}>Back to Home</button>
      </div>
    </main>
  );
}
