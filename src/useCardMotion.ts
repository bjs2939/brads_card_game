import { useLayoutEffect, useRef } from "react";
import type { Card } from "./game_engine/types";

type View = {
  player: Card[];
  computer: Card[];
  playerField: ({ card: Card; revealed: boolean; shields?: { card: Card; revealed: boolean }[] } | null)[];
  computerField: ({ card: Card; revealed: boolean; shields?: { card: Card; revealed: boolean }[] } | null)[];
  discardPile: Card[];
  drawPile: Card[];
  round: object;
  turn: number;
  drewCard: boolean;
  drawnCard?: Card;
  recoveredDiscard?: { card: Card };
};

export function useCardMotion(game: View, animateCards = true) {
  const board = useRef<HTMLElement>(null);
  const previous = useRef<{
    cards: Map<Card, { rect: DOMRect; faceDown: boolean }>;
    deck?: DOMRect;
    round: object;
  }>(null);

  useLayoutEffect(() => {
    const root = board.current;
    if (!root) return;

    const deck = root.querySelector("[data-draw-origin]")?.getBoundingClientRect();
    const old = previous.current?.round === game.round ? previous.current : null;
    const cards = new Map<Card, { rect: DOMRect; faceDown: boolean }>();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const drawn = game.turn === 1 && game.drewCard && !old ? game.player[game.player.length - 1] : undefined;
    const groups = {
      player: game.player.map(card => ({ card, revealed: true })),
      computer: game.computer.map(card => ({ card, revealed: false })),
      playerField: game.playerField,
      computerField: game.computerField,
      discard: game.discardPile.slice(-1).map(card => ({ card, revealed: true })),
    };

    const positions = Object.entries(groups).flatMap(([group, units]) =>
      units.flatMap((unit, index) => unit ? [{ unit, position: `${group}-${index}` }] : []),
    );
    for (const group of ["playerField", "computerField"] as const) {
      game[group].forEach((unit, index) => unit?.shields?.forEach((layer, layerIndex) => {
        positions.push({ unit: layer, position: `${group}-shield-${index}-${layerIndex}` });
      }));
    }

    positions.forEach(({ unit, position }) => {
        const element = root.querySelector<HTMLElement>(`[data-card-position="${position}"]`);
        if (!element) return;

        const rect = element.getBoundingClientRect();
        cards.set(unit.card, { rect, faceDown: !unit.revealed });
        if (!animateCards || reduced || !element.animate || !rect.width) return;

        const from = old?.cards.get(unit.card);
        const drawing = !from && (Boolean(old) || unit.card === drawn);
        if (unit.card === game.recoveredDiscard?.card || (drawing && unit.card === game.drawnCard)) return;
        const origin = from?.rect ?? (drawing ? old?.deck ?? deck : undefined);
        const flipping = from?.faceDown && unit.revealed;
        if (!origin) return;
        const x = origin.left - rect.left;
        const y = origin.top - rect.top;
        if (!flipping && Math.abs(x) < 1 && Math.abs(y) < 1) return;

        const zIndex = element.classList.contains("simple-game-shield-card") ? 3 : 2;
        element.animate([
          {
            transform: `translate(${x}px, ${y}px) scale(${origin.width / rect.width}, ${origin.height / rect.height})`,
            zIndex,
          },
          { transform: "none", zIndex },
        ], {
          duration: drawing ? 460 : 340,
          delay: drawing ? 380 : 0,
          easing: "cubic-bezier(.2,.75,.25,1)",
          fill: "backwards",
        });

        if (flipping) {
          element.querySelector("img")?.animate(
            [{ transform: "scaleX(0.08)" }, { transform: "scaleX(1)" }],
            { duration: 260, easing: "ease-out" },
          );
        }
    });

    previous.current = { cards, deck, round: game.round };
  }, [game, animateCards]);

  return board;
}
