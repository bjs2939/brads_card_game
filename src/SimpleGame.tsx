import { TutorialBattleDialogue, tutorialLessons } from "./TutorialIntro";
import { useCallback, useEffect, useRef, useState } from "react";
import CardFace from "./CardFace";
import { Feedback, gameVersion } from "./PlaytestPanels";
import { sandboxRetreatPlan, saveMatch } from "./playtest";
import { useCardMotion } from "./useCardMotion";
import { useAudioForeground, useGameSound, type GameSound } from "./useGameSound";
import "./SimpleGame.css";
import { createStandardDeck, createTutorialDeck, dealSimpleGame, ranks, tutorialDeploymentRanks } from "./game_engine/deck";
import type { Card, Suit } from "./game_engine/types";

export const simpleVersionTitle = "Brad's Card Game";

const labCards: Card[] = [...createStandardDeck(), { type: "joker", color: "red" }, { type: "joker", color: "black" }];
const labZones = {
  player: "Your hand", computer: "Opponent hand", playerField: "Your battlefield", computerField: "Opponent battlefield",
} as const;
type LabZone = keyof typeof labZones;

function labCardName(card: Card) {
  return card.type === "joker" ? `${card.color} Joker` : `${card.rank} of ${card.suit}`;
}

const slotsPerRank = 3;
const battlefieldSlots = slotsPerRank * 2;
const rankLanes = { front: [0, 1, 2], back: [3, 4, 5] };
const turnSteps = { draw: "Draw", "move-up": "Move Up", "move-out": "Move Out", attack: "Attack" };
const suitAdvantage: Partial<Record<Suit, Suit>> = {
  hearts: "spades",
  spades: "clubs",
  clubs: "hearts",
};
const opponentTips = [
  "Move your back-rank cards forward first. Playing a card from your hand skips the rest of Move Up.",
  "Hearts beat spades, spades beat clubs, and clubs beat hearts. Diamonds are neutral.",
  "Cards 2 through 7 can stack with cards of the same number. 8s, 9s, and 10s already have high power on their own and cannot stack.",
  "A 6 can attack from the back rank and can reach past the enemy front rank.",
  "A 5 survives a Joker explosion. A 2 defeats a 10 and is immune to its attacks.",
  "Spend a Jack to spy on vulnerable enemy cards. Using Spy ends your turn.",
  "Sacrifice a Queen from your hand to unlock Double Attack and attack twice in one turn.",
  "If every attack would leave you worse off, press End Turn and wait for a better opening.",
  "Save a threatened card with Retreat on the right. It returns to your hand and ends your turn.",
  "A King can defeat several cards in one stack. Cards immune to its suit survive.",
  "When the enemy battlefield is empty, a front-rank attacker can strike the castle.",
];

const suitSymbols = { hearts: "♥", diamonds: "♦", clubs: "♣", spades: "♠" };

const handLayout = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 3.1rem), var(--hand-card-width)))",
  justifyContent: "center",
  gap: "0.5rem",
};

const compactBoardQuery = "(max-width: 720px)";

const battlefieldLayout = {
  ...handLayout,
  gridTemplateColumns: `repeat(${slotsPerRank}, minmax(0, var(--field-card-width)))`,
};

type Side = "player" | "computer";
type FieldRank = keyof typeof rankLanes;
type TurnStep = keyof typeof turnSteps;
type DraggedCard = { from: "hand"; card: Card } | { from: "field"; index: number };
type ShieldLayer = { card: Card; revealed: boolean };
type Unit = { card: Card; revealed: boolean; shields?: ShieldLayer[]; fourShieldBroken?: boolean; lane?: number };
type Field = (Unit | null)[];
type Game = ReturnType<typeof dealSimpleGame> & {
  playerField: (Unit | null)[];
  backRankAtTurnStart: Card[];
  computerField: (Unit | null)[];
  computerStacked?: boolean;
  lastComputerRetreat?: Card;
  nextSandboxRetreat?: number;
  discardPile: Card[];
  phase: Side | "computer-move-out" | "computer-attack";
  step: TurnStep;
  round: { id: string; at: number };
  turn: number;
  drewCard: boolean;
  drawnCard?: Card;
  deckWarning?: 0 | 1 | 2 | 3 | 4 | 5 | 10;
  spyFlash?: Card;
  attackAnimation?: { attacker: Card; target: Card; side: Side; kind: "ranger" | "dragon" | "card" };
  jokerExplosion?: { turn: number; survived: boolean; attacker: Card };
  selected: number | null;
  selectedShield: Card | null;
  queenAttackTurn?: number;
  extraAttack?: boolean;
  movingShield?: { source: Card; layer: ShieldLayer };
  selectedStack: Card | null;
  movingStack: boolean;
  immunityWarningTarget?: number;
  pendingAttack?: { attacker: number; target: number; isStack: boolean; choices?: number[][]; victims?: number[] };
  selectedSpecial: Card | null;
  sound?: { cue: GameSound; lightning?: boolean };
  specialStrike?: { card: Card; target: Card; attachments: Card[]; kind: "ace" | "king"; blocked: boolean; turn: number };
  advantage?: boolean;
  advantageBonus?: number;
  immunity?: { from: Suit; to: Suit | "joker"; label: string };
  result: string;
};

function isNumber(card: Card) {
  return card.type === "standard" && ranks.indexOf(card.rank) <= ranks.indexOf("10");
}

function canDeploy(card: Card) {
  return card.type === "joker" || isNumber(card);
}

function isJack(card: Card): card is Extract<Card, { type: "standard" }> {
  return card.type === "standard" && card.rank === "J";
}

function isQueen(card: Card) {
  return card.type === "standard" && card.rank === "Q";
}

function isShield(card: Card) {
  return card.type === "standard" && (card.rank === "J" || card.rank === "Q");
}

function hasFourShield(unit: Unit) {
  return unit.card.type === "standard" && unit.card.rank === "4" && !unit.fourShieldBroken;
}

function canShield(unit: Unit | null | undefined) {
  return !!unit && canDeploy(unit.card);
}

function deploy(card: Card): Unit {
  return { card, revealed: false };
}

function strength(card: Card) {
  return card.type === "standard" ? ranks.indexOf(card.rank) + 2 : 0;
}

function canStack(card: Card) {
  return isNumber(card) && strength(card) <= 7;
}

function matchesStack(card: Card, fieldCard: Card) {
  return card.type === "standard" && fieldCard.type === "standard" &&
    canStack(card) && card.rank === fieldCard.rank;
}

function isSpecial(card: Card) {
  return card.type === "standard" && (card.rank === "A" || card.rank === "K");
}

function laneOf(unit: Unit, index: number) {
  return unit.lane ?? index;
}

function laneCards(field: Field, lane: number) {
  return field.flatMap((unit, index) => unit && laneOf(unit, index) === lane ? [{ unit, index }] : []);
}

function canMoveIntoStack(game: Game, from: number, to: number) {
  const field = game.playerField;
  const source = field[from];
  const target = field[to];
  if (!source || !target || laneOf(source, from) === laneOf(target, to) ||
      !matchesStack(source.card, target.card)) return false;

  const sourceRank = fieldRank(source, from);
  const targetRank = fieldRank(target, to);
  return (sourceRank === targetRank && (game.step === "move-out" || game.step === "attack")) ||
    (sourceRank === "back" && targetRank === "front" && game.backRankAtTurnStart?.includes(source.card) === true);
}

function addToStack(field: Field, unit: Unit, lane: number, sourceIndex?: number): Field {
  const next = [...field];
  while (next.length < battlefieldSlots) next.push(null);
  if (sourceIndex !== undefined) next[sourceIndex] = null;
  const spare = next.findIndex((entry, index) => index >= battlefieldSlots && !entry);
  next[spare === -1 ? next.length : spare] = { ...unit, lane };
  return next;
}

function fieldRank(unit: Unit, index: number): FieldRank {
  return laneOf(unit, index) < slotsPerRank ? "front" : "back";
}

function hasBackRankCards(field: Field) {
  return field.some((unit, index) => unit && fieldRank(unit, index) === "back");
}

function canAttackTarget(attacker: Unit, from: number, field: Field, target: number) {
  const defender = field[target];
  if (!defender || !isNumber(attacker.card)) return false;
  const ranged = attacker.card.type === "standard" && attacker.card.rank === "6";
  const targetRank = fieldRank(defender, target);
  if (fieldRank(attacker, from) === "back") return ranged && targetRank === "front";
  const frontLane = laneOf(defender, target) - slotsPerRank;
  return targetRank === "front" || ranged || laneCards(field, frontLane).length === 0;
}

function canAttackFrom(attacker: Unit, from: number, field: Field, castleCards: number) {
  return field.some((_, index) => canAttackTarget(attacker, from, field, index)) ||
    (castleCards > 0 && !field.some(Boolean) && isNumber(attacker.card) && fieldRank(attacker, from) === "front");
}

function openLanes(field: Field, rank: FieldRank) {
  return rankLanes[rank].filter(lane => laneCards(field, lane).length === 0);
}

function canMoveUp(field: Field) {
  return hasBackRankCards(field) && openLanes(field, "front").length > 0;
}

function canDeployThisPhase(game: Game) {
  return game.phase === "player" && game.step !== "draw" &&
    !game.pendingAttack && !game.specialStrike && !game.jokerExplosion &&
    !game.attackAnimation && game.immunityWarningTarget === undefined;
}

function hasMoveOutAction(game: Game) {
  return openLanes(game.playerField, "back").length > 0 && game.player.some(canDeploy);
}

function moveOutOrAttack(game: Game): TurnStep {
  return hasMoveOutAction(game) ? "move-out" : "attack";
}

function nextPlayerStep(game: Game): TurnStep | null {
  if (game.turn <= 2) return null;
  if (game.step === "move-up") return moveOutOrAttack(game);
  if (game.step === "move-out") return "attack";
  return null;
}

function advancePlayerStep(game: Game): Game {
  const step = game.phase === "player" && nextPlayerStep(game);
  return step ? {
    ...game, step, selected: null, selectedShield: null, selectedStack: null,
    selectedSpecial: null, movingStack: false, movingShield: undefined,
  } : game;
}

function hasHandStack(field: Field, card: Card) {
  return field.some((unit, index) =>
    unit && fieldRank(unit, index) === "back" && matchesStack(card, unit.card),
  );
}

function moveUp(field: Field, from: number, to: number): Field {
  if (!rankLanes.back.includes(from) || !openLanes(field, "front").includes(to)) return field;
  const moving = laneCards(field, from);
  if (!moving.length) return field;
  const next = [...field];
  for (const { index } of moving) next[index] = null;
  const [lead, ...rest] = moving;
  next[to] = { ...lead.unit, lane: to };
  return rest.reduce((result, { unit }) => addToStack(result, unit, to), next);
}

function rearrangeRank(game: Game, index: number, targetLane: number): Game {
  const field = game.playerField;
  const unit = field[index];
  if (!unit || game.phase !== "player" || game.pendingAttack || game.specialStrike || game.jokerExplosion) return game;

  const sourceLane = laneOf(unit, index);
  if (sourceLane === targetLane || !rankLanes[fieldRank(unit, index)].includes(targetLane)) return game;

  const source = laneCards(field, sourceLane);
  const target = laneCards(field, targetLane);
  let next = [...field];
  while (next.length < battlefieldSlots) next.push(null);
  for (const entry of [...source, ...target]) next[entry.index] = null;

  for (const [lane, entries] of [[targetLane, source], [sourceLane, target]] as const) {
    const [lead, ...rest] = entries;
    if (!lead) continue;
    next[lane] = { ...lead.unit, lane };
    for (const entry of rest) next = addToStack(next, entry.unit, lane);
  }

  return { ...game, playerField: next, selected: null, movingStack: false, result: "Rearranged your rank." };
}

function promoteUnit(game: Game, index: number, lane: number): Game {
  const unit = game.playerField[index];
  if (!unit || game.phase !== "player" || game.step !== "move-up") return game;
  const field = moveUp(game.playerField, laneOf(unit, index), lane);
  if (field === game.playerField) return game;
  return {
    ...game, playerField: field, selected: null,
    step: canMoveUp(field) ? game.step : moveOutOrAttack({ ...game, playerField: field }),
    sound: { cue: "play" },
  };
}

function equipShield(game: Game, card: Card, target: number): Game {
  const unit = game.playerField[target];
  if (game.phase !== "player" || game.step === "draw" || game.pendingAttack || game.specialStrike ||
      game.jokerExplosion || !unit || !canShield(unit) || !isShield(card) || !game.player.includes(card)) return game;
  return {
    ...game,
    player: game.player.filter(entry => entry !== card),
    playerField: game.playerField.map((entry, index) => index === target
      ? { ...unit, shields: [...(unit.shields ?? []), { card, revealed: false }] } : entry),
    selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null,
    movingStack: false, movingShield: undefined,
    result: "Shield equipped.",
    sound: { cue: "shield" },
  };
}

function stackOnto(game: Game, source: DraggedCard, target: number): Game {
  const unit = game.playerField[target];
  if (game.phase !== "player" || game.pendingAttack || !unit ||
      game.specialStrike || game.jokerExplosion) return game;
  const lane = laneOf(unit, target);
  let playerField: Field;
  let player = game.player;
  if (source.from === "hand") {
    if (fieldRank(unit, target) !== "back" ||
        !matchesStack(source.card, unit.card) || !player.includes(source.card)) return game;
    playerField = addToStack(game.playerField, deploy(source.card), lane);
    player = player.filter(card => card !== source.card);
  } else {
    const moving = game.playerField[source.index];
    if (!moving || !canMoveIntoStack(game, source.index, target)) return game;
    playerField = addToStack(game.playerField, moving, lane, source.index);
  }
  return {
    ...game, player, playerField, selected: null, selectedStack: null, selectedShield: null,
    movingStack: false, result: "Stack combined its attack power.", sound: { cue: "stack" },
  };
}

function offense(field: Field, index: number) {
  const unit = field[index];
  if (!unit) return 0;
  return laneCards(field, laneOf(unit, index))
    .reduce((total, entry) => total + strength(entry.unit.card), 0);
}

const suitNames: Record<Suit, string> = {
  hearts: "Hearts", clubs: "Clovers", spades: "Spades", diamonds: "Diamonds",
};

function blockedAttack(from: Suit, to: Suit) {
  return { from, to, label: `${suitNames[to]} block ${suitNames[from]}` };
}

function isSpecialImmune(suit: Suit, target: Card) {
  return target.type === "joker" || suitAdvantage[target.suit] === suit;
}

function chooseComputerSpecial(game: Game, hasRegularAttack: boolean) {
  const canDevelopField = game.computerField.some(Boolean) || game.computer.some(canDeploy);
  const mayBlindPlay = !hasRegularAttack && !canDevelopField;
  const options: { card: Card; index: number; score: number }[] = [];
  for (const special of game.computer) {
    if (special.type !== "standard" || !isSpecial(special)) continue;
    game.playerField.forEach((unit, index) => {
      if (!unit) return;
      if (!unit.revealed) {
        if (mayBlindPlay) options.push({ card: special, index, score: 1 });
      } else {
        const lane = laneCards(game.playerField, laneOf(unit, index)).map(entry => entry.unit);
        const affected = lane.filter(entry => entry.revealed && !isSpecialImmune(special.suit, entry.card));
        const shieldValue = special.rank === "A"
          ? lane.flatMap(entry => entry.shields ?? [])
              .filter(layer => layer.revealed && !isSpecialImmune(special.suit, layer.card)).length * 2
          : affected.reduce((total, entry) => total + (entry.shields?.length ?? 0) * 2, 0);
        if (!affected.length && (lane.length === 1 || !shieldValue)) return;
        const value = affected.reduce((total, entry) =>
          total + strength(entry.card) + (hasFourShield(entry) ? 2 : 0), shieldValue);
        if (!hasRegularAttack || value >= 8) {
          options.push({ card: special, index, score: value + (special.rank === "A" ? 1 : 0) });
        }
      }
    });
  }
  return options.sort((a, b) => b.score - a.score)[0];
}

function resolveSpecial(game: Game, targetIndex: number, side: Side = "player", special = game.selectedSpecial): Game {
  const targetField = side === "player" ? "computerField" : "playerField";
  const target = game[targetField][targetIndex];
  if (game.phase !== side || special?.type !== "standard" || !isSpecial(special) || !target ||
      !game[side].includes(special)) return game;

  const lane = laneCards(game[targetField], laneOf(target, targetIndex));
  const isKing = special.rank === "K";
  const vulnerable = lane.filter(({ unit }) => !isSpecialImmune(special.suit, unit.card));
  const removed = new Set(vulnerable.map(({ index }) => index));
  const field = [...game[targetField]];
  const defendingSide = side === "player" ? "computer" : "player";
  const discarded: Card[] = [special];
  const stolen: Card[] = [];
  const orphanedShields: ShieldLayer[] = [];

  if (isKing) {
    for (const { unit, index } of vulnerable) {
      field[index] = null;
      discarded.push(...(unit.shields ?? []).map(layer => layer.card), unit.card);
    }
  } else if (lane.length > 1 || vulnerable.length) {
    for (const { unit, index } of lane) {
      const immuneShields: ShieldLayer[] = [];
      for (const layer of unit.shields ?? []) {
        if (isSpecialImmune(special.suit, layer.card)) immuneShields.push(layer);
      }
      if (removed.has(index)) {
        stolen.push(unit.card);
        orphanedShields.push(...immuneShields);
        field[index] = null;
      } else {
        field[index] = { ...unit, shields: immuneShields };
      }
      for (const layer of unit.shields ?? []) {
        if (!immuneShields.includes(layer)) stolen.push(layer.card);
      }
    }
  }

  const survivor = lane.find(({ index }) => field[index] !== null);
  if (survivor && orphanedShields.length) {
    const unit = field[survivor.index]!;
    field[survivor.index] = { ...unit, shields: [...(unit.shields ?? []), ...orphanedShields] };
  }
  const returned = survivor ? [] : orphanedShields.map(layer => layer.card);
  const immune = isKing ? vulnerable.length === 0 : stolen.length === 0;
  const steal = !isKing && !immune;
  const strikeTarget = vulnerable.find(({ index }) => index === targetIndex)?.unit.card
    ?? vulnerable[0]?.unit.card ?? stolen[0] ?? target.card;
  if (immune) field[targetIndex] = { ...target, revealed: true };

  return {
    ...game,
    [side]: [...game[side].filter(card => card !== special), ...stolen],
    [defendingSide]: [...game[defendingSide], ...returned],
    [targetField]: field,
    discardPile: [...game.discardPile, ...discarded],
    selectedSpecial: null,
    phase: side === "player" ? "computer" : "player",
    advantage: false,
    immunity: immune
      ? target.card.type === "joker"
        ? { from: special.suit, to: "joker", label: "Joker blocks the special attack" }
        : blockedAttack(special.suit, target.card.suit)
      : undefined,
    specialStrike: {
      card: special, target: strikeTarget, kind: isKing ? "king" : "ace",
      attachments: [...stolen, ...discarded.slice(1)].filter(card => card !== strikeTarget),
      blocked: immune, turn: game.turn,
    },
    sound: { cue: immune ? "immunity" : steal ? "steal" : "king", lightning: true },
    result: immune ? isKing ? "Every target was immune. The King was discarded."
        : "The Ace could not steal any cards. It was discarded."
      : steal ? `Instant Steal! ${side === "player" ? "You took" : "The computer took"} ${stolen.length} ${stolen.length === 1 ? "card" : "cards"} into hand.${
        returned.length ? " Immune shields returned to their owner’s hand."
          : lane.some(({ index }) => field[index] !== null) ? " Immune cards stayed on the field." : ""
      }`
      : lane.length === 1 ? "Instant Kill! The King defeated the target."
      : vulnerable.length === lane.length ? "Instant Kill! The King defeated the entire stack."
      : "Instant Kill! The King defeated the vulnerable cards. Immune cards survived.",
  };
}

function attackDefense(field: Field, target: number, defender: Unit) {
  const lane = laneOf(defender, target);
  const entries = laneCards(field, lane);
  const shieldOwner = entries.find(({ index, unit }) => index === target && unit.shields?.length) ??
    entries.find(({ unit }) => unit.shields?.length);
  const layers = shieldOwner?.unit.shields ?? [];
  const outer = layers[layers.length - 1];
  const protectedCard = shieldOwner?.unit.card ?? defender.card;
  const shielded = defender.card.type !== "joker" && protectedCard.type === "standard" && outer?.card.type === "standard";
  const card: Card = shielded ? { ...protectedCard, suit: outer.card.suit } : defender.card;
  const visibleCard: Card = shielded && !outer.revealed ? { ...protectedCard, suit: "diamonds" } : card;
  return { lane, entries, shieldOwner, layers, outer, card, visibleCard };
}

function calculateAttack(field: Field, attackerIndex: number, defender: Card) {
  const attacker = field[attackerIndex];
  const entries = attacker ? laneCards(field, laneOf(attacker, attackerIndex)) : [];
  const parts = entries.map(({ unit: { card } }) => {
    const suitBlocked = card.type === "standard" && defender.type === "standard" &&
      suitAdvantage[defender.suit] === card.suit;
    const rankBlocked = card.type === "standard" && defender.type === "standard" &&
      card.rank === "10" && defender.rank === "2";
    const blocked = suitBlocked || rankBlocked;
    const bonus = !blocked && card.type === "standard" && defender.type === "standard" &&
      suitAdvantage[card.suit] === defender.suit ? 1 : 0;
    return { card, suitBlocked, rankBlocked, blocked, bonus, power: blocked ? 0 : strength(card) + bonus };
  });

  return {
    parts,
    power: parts.reduce((total, part) => total + part.power, 0),
    bonus: parts.reduce((total, part) => total + part.bonus, 0),
    immune: parts.length > 0 && parts.every(part => part.blocked),
    beatsTen: defender.type === "standard" && defender.rank === "10" &&
      parts.some(part => !part.blocked && part.card.type === "standard" && part.card.rank === "2"),
  };
}

function manageHardShields(game: Game, field: Field, used: Set<Card>) {
  const visibleOpponents = game.playerField.map(unit => unit?.revealed ? unit : null);
  const occupiedLanes = (units: Field) => new Set(units.flatMap((unit, index) =>
    unit ? [laneOf(unit, index)] : []
  )).size;
  const duel = occupiedLanes(field) === 1 && occupiedLanes(game.playerField) <= 1;
  const next = [...field];

  const priorities = field.map((unit, target) => {
    if (!unit || !isNumber(unit.card)) return 0;
    const front = fieldRank(unit, target) === "front";
    let threat = 0;
    game.playerField.forEach((attacker, index) => {
      if (!attacker) return;
      if (!attacker.revealed) {
        if (fieldRank(attacker, index) === "front" &&
            (front || laneCards(field, laneOf(unit, target) - slotsPerRank).length === 0)) {
          threat = Math.max(threat, 3);
        }
        return;
      }
      if (!canAttackTarget(attacker, index, field, target)) return;
      const attack = calculateAttack(visibleOpponents, index, unit.card);
      if (!attack.immune && (attack.beatsTen || attack.power >= strength(unit.card))) threat = 6;
    });
    return Math.max(0, threat + (front ? 2 : 0) + (strength(unit.card) >= 7 ? 1 : 0)
      - (hasFourShield(unit) ? 2 : 0));
  });

  const shieldCount = (slot: number) => laneCards(next, laneOf(next[slot]!, slot))
    .reduce((count, { unit }) => count + (unit.shields?.length ?? 0), 0);
  const priority = (slot: number, layers: number) => layers === 0 ? priorities[slot]
    : !duel && layers === 1 ? Math.max(0, priorities[slot] - 6) : 0;
  const bestDestination = (excludeLane?: number) => priorities.reduce((best, _, slot) => {
    const unit = next[slot];
    if (!unit || laneOf(unit, slot) === excludeLane) return best;
    const score = priority(slot, shieldCount(slot));
    return score > best.score ? { slot, score } : best;
  }, { slot: -1, score: 0 });

  // Move an existing outer shield only when the receiving lane needs it more.
  let transfer: { from: number; to: number; gain: number } | undefined;
  for (const [from, unit] of next.entries()) {
    if (!unit?.shields?.length) continue;
    const lane = laneOf(unit, from);
    const layers = shieldCount(from);
    const lanePriority = laneCards(next, lane).reduce((best, { index }) =>
      Math.max(best, priority(index, layers - 1)), 0);
    const destination = bestDestination(lane);
    const gain = destination.score - lanePriority;
    if (gain > (transfer?.gain ?? 0)) transfer = { from, to: destination.slot, gain };
  }
  if (transfer) {
    const { from, to } = transfer;
    const source = next[from]!;
    const destination = next[to]!;
    const layers = source.shields!;
    next[from] = { ...source, shields: layers.slice(0, -1) };
    next[to] = { ...destination, shields: [...(destination.shields ?? []), layers[layers.length - 1]] };
  }

  for (const card of game.computer.filter(isShield)) {
    const { slot } = bestDestination();
    if (slot === -1) break;
    const unit = next[slot]!;
    next[slot] = { ...unit, shields: [...(unit.shields ?? []), { card, revealed: false }] };
    used.add(card);
  }
  return { field: next, moved: !!transfer };
}

function chooseComputerAttack(game: Game, difficulty: Difficulty, roll: number) {
  const options = game.computerField.flatMap((unit, attacker) => {
    if (!unit || !canAttackFrom(unit, attacker, game.playerField, game.player.length)) return [];
    const power = offense(game.computerField, attacker);
    if (!game.playerField.some(Boolean)) return [{ attacker, target: -1, power, tacticalScore: 4 }];

    return game.playerField.flatMap((defender, target) => {
      if (!defender || !canAttackTarget(unit, attacker, game.playerField, target)) return [];
      // Score face-down targets using only the computer's own attack power.
      let score = 2 + Math.min(power, 20) / 20;
      if (defender.revealed) {
        const defense = attackDefense(game.playerField, target, defender);
        const attack = calculateAttack(game.computerField, attacker, defense.visibleCard);
        const shielded = defense.outer || defense.entries.some(({ unit }) => unit.revealed && hasFourShield(unit));
        if (defender.card.type === "joker") {
          score = unit.card.type === "standard" && unit.card.rank === "5" ? 8 : -2;
        } else if (defense.outer && !defense.outer.revealed) {
          score = attack.power >= strength(defense.visibleCard) ? 3 : 0;
        } else if (attack.immune) {
          score = -3;
        } else if (attack.beatsTen || attack.power >= strength(defense.card)) {
          score = shielded ? 4 : 6 + strength(defender.card) / 2;
        } else {
          score = 0;
        }
      }
      return [{ attacker, target, power, tacticalScore: score }];
    });
  });

  const score = (option: typeof options[number]) => difficulty === "Hard" ? option.tacticalScore : option.power;
  const attack = (difficulty === "Easy" || difficulty === "Sandbox") ? options[Math.floor(roll * options.length)]
    : options.reduce<typeof options[number] | undefined>(
        (best, option) => !best || score(option) > score(best) ? option : best, undefined
      );
  return { attack, hasProductiveAttack: options.some(option => option.tacticalScore >= 4) };
}

function chooseComputerRetreat(game: Game) {
  const field = game.computerField;
  const visibleEnemies = game.playerField.map(unit => unit?.revealed ? unit : null);
  const occupied = field.filter(Boolean).length;
  if (occupied < 2) return -1;

  let choice = -1;
  let bestScore = 0;
  field.forEach((unit, index) => {
    if (!unit || !isNumber(unit.card) || unit.card === game.lastComputerRetreat) return;
    const lane = laneOf(unit, index);
    const allies = laneCards(field, lane);
    if (allies.some(({ unit: ally }) => ally.shields?.length || hasFourShield(ally))) return;
    if (lane < slotsPerRank && allies.length === 1 && laneCards(field, lane + slotsPerRank).length) return;

    const threatened = visibleEnemies.some((enemy, attacker) => {
      if (!enemy || !canAttackTarget(enemy, attacker, field, index)) return false;
      const attack = calculateAttack(visibleEnemies, attacker, unit.card);
      return !attack.immune && (attack.beatsTen || attack.power >= strength(unit.card));
    });
    if (!threatened) return;

    const score = strength(unit.card) + (fieldRank(unit, index) === "front" ? 2 : 0);
    if (score > bestScore) {
      bestScore = score;
      choice = index;
    }
  });
  return choice;
}

function findComputerStack(game: Game, field: Field) {
  const getScore = (computerField: Field) =>
    chooseComputerAttack({ ...game, computerField }, "Hard", 0).attack?.tacticalScore ?? 0;
  let bestScore = getScore(field);
  let bestField = field;

  field.forEach((source, from) => {
    if (!source) return;
    field.forEach((target, to) => {
      if (!target || laneOf(source, from) === laneOf(target, to) || !matchesStack(source.card, target.card)) return;
      const sourceRank = fieldRank(source, from);
      const targetRank = fieldRank(target, to);
      const eligible = sourceRank === targetRank ||
        (sourceRank === "back" && targetRank === "front" && game.computerField.includes(source));
      if (!eligible) return;
      const combined = addToStack(field, source, laneOf(target, to), from);
      const score = getScore(combined);
      if (score >= 4 && score > bestScore) {
        bestScore = score;
        bestField = combined;
      }
    });
  });

  return bestField;
}

function makeAttackAnimation(attacker: Unit, target: Card, side: Side, jokerBlast = false): Game["attackAnimation"] {
  const card = attacker.card;
  const kind = card.type === "standard" && card.rank === "6" ? "ranger"
    : card.type === "standard" && card.rank === "10" ? "dragon" : "card";
  if (kind === "card" && jokerBlast) return;
  return { attacker: card, target, side, kind };
}

function stackVictimChoices(attackers: Field, attacker: number, defenders: Field, target: number) {
  const defender = defenders[target];
  if (!defender) return [];
  const defense = attackDefense(defenders, target, defender);
  if (defense.entries.length < 2 || defense.outer || defense.entries.some(({ unit }) => hasFourShield(unit))) return [];

  const entries = [...defense.entries].sort((a, b) => Number(b.index === target) - Number(a.index === target));
  let plans = [{ victims: [] as number[], cost: 0, power: Infinity }];
  for (const { unit, index } of entries) {
    const attack = calculateAttack(attackers, attacker, unit.card);
    if (attack.immune) continue;
    plans = [...plans, ...plans.flatMap(plan => {
      const cost = plan.cost + strength(unit.card);
      const power = Math.min(plan.power, attack.power);
      return cost <= power ? [{ victims: [...plan.victims, index], cost, power }] : [];
    })];
  }
  const most = Math.max(...plans.map(plan => plan.victims.length));
  return most ? plans.filter(plan => plan.victims.length === most).map(plan => plan.victims) : [];
}

function resolveAttack(game: Game, side: Side, attackerIndex: number, targetIndex: number, chosenVictims?: number[]): Game {
  const attackerField = side === "player" ? "playerField" : "computerField";
  const defenderField = side === "player" ? "computerField" : "playerField";
  const attacker = game[attackerField][attackerIndex];
  if (game.phase !== side || !attacker || !canAttackTarget(attacker, attackerIndex, game[defenderField], targetIndex)) {
    return game;
  }

  const victims = chosenVictims ?? stackVictimChoices(game[attackerField], attackerIndex, game[defenderField], targetIndex)[0];
  targetIndex = victims?.[0] ?? targetIndex;
  const defender = game[defenderField][targetIndex]!;
  const blast = defender.card.type === "joker";
  const survivesBlast = blast && attacker.card.type === "standard" && attacker.card.rank === "5";
  const { lane: defenderLane, entries: defendedLane, shieldOwner, layers, outer, card: defendedCard } =
    attackDefense(game[defenderField], targetIndex, defender);
  const attack = calculateAttack(game[attackerField], attackerIndex, defendedCard);
  const immune = attack.immune;
  const suitImmune = immune && attack.parts.some(part => part.suitBlocked);
  const rankImmune = immune && attack.parts.some(part => part.rankBlocked);
  const attackerWins = !immune && (attack.beatsTen || attack.power >= strength(defendedCard));
  const shieldHit = !blast && attackerWins && outer;
  const survivingShields = shieldHit
    ? layers.slice(0, -1)
    : defendedLane.length > 1 ? layers
    : layers.map((layer, index) => index === layers.length - 1 ? { ...layer, revealed: true } : layer);
  const builtInOwner = !outer && !blast && !immune
    ? defendedLane.find(({ index, unit }) => index === targetIndex && hasFourShield(unit)) ??
      defendedLane.find(({ unit }) => hasFourShield(unit))
    : undefined;
  const fourShieldHit = !!builtInOwner;
  const defeated = blast || (attackerWins && !outer && !fourShieldHit);
  const discarded: Card[] = [];
  if (blast && !survivesBlast) {
    for (const { unit } of laneCards(game[attackerField], laneOf(attacker, attackerIndex))) {
      discarded.push(...(unit.shields ?? []).map(layer => layer.card), unit.card);
    }
  }
  if (shieldHit) discarded.push(shieldHit.card);
  if (blast) discarded.push(...(defender.shields ?? []).map(layer => layer.card));
  const defeatedSlots = new Set(defeated ? victims ?? [targetIndex] : []);
  for (const index of defeatedSlots) discarded.push(game[defenderField][index]!.card);

  const attacking = game[attackerField].map((unit, index) =>
    unit && laneOf(unit, index) === laneOf(attacker, attackerIndex)
      ? (blast && !survivesBlast ? null : { ...unit, revealed: true })
      : unit,
  );
  const defending = game[defenderField].map((unit, index) => {
    if (!unit || defeatedSlots.has(index)) return null;
    if (index === shieldOwner?.index) {
      return { ...unit, shields: survivingShields, revealed: true };
    }
    if (index === builtInOwner?.index) return { ...unit, fourShieldBroken: true, revealed: true };
    return laneOf(unit, index) === defenderLane ? { ...unit, revealed: true } : unit;
  });
  const nextSide = side === "player" ? "computer" : "player";
  const whoAttacked = side === "player" ? "You attacked" : "The computer attacked";
  return {
    ...game,
    [attackerField]: attacking,
    [defenderField]: defending,
    discardPile: discarded.length ? [...game.discardPile, ...discarded] : game.discardPile,
    selected: null,
    pendingAttack: undefined,
    attackAnimation: makeAttackAnimation(attacker, defender.card, side, blast),
    jokerExplosion: blast ? { turn: game.turn, survived: survivesBlast, attacker: attacker.card } : undefined,
    phase: nextSide,
    advantage: attack.bonus > 0,
    advantageBonus: attack.bonus,
    immunity: attacker.card.type === "standard" && defendedCard.type === "standard" && immune &&
      (!outer || outer.revealed || defendedLane.length === 1)
      ? suitImmune ? blockedAttack(attacker.card.suit, defendedCard.suit)
        : { from: attacker.card.suit, to: defendedCard.suit, label: "A 2 blocks a 10" }
      : undefined,
    sound: { cue: blast ? "blast" : immune ? "immunity" : (shieldHit || fourShieldHit) ? "shield-break" : defeated ? "hit" : "block" },
    result: survivesBlast ? "Joker trap! The 5 survived. The Joker and any decoy shields went to the discard pile."
      : blast ? "Joker trap! The attacking lane, Joker, and their attached shields went to the discard pile."
      : fourShieldHit ? "The built-in shield broke. The 4 stayed in play."
      : shieldHit ? `The shield broke at power ${strength(defendedCard)}. The protected cards stayed in play.`
      : suitImmune ? outer ? "The shield’s suit blocked the attack. The shield held."
        : "Weapon Triangle immunity. Both cards stay in play."
      : rankImmune ? "A 2 is immune to a 10. Both cards stay in play."
      : outer ? `The power-${strength(defendedCard)} shield held.`
      : defeatedSlots.size > 1 ? `${whoAttacked}. ${defeatedSlots.size} cards in the defending stack went to the discard pile.`
      : defeated ? `${whoAttacked}. The defending card went to the discard pile.`
      : `${whoAttacked}. The defender was stronger. Both cards stay in play.`,
  };
}

function health(hand: Card[], field: Field) {
  return hand.length + field.reduce((total, unit) => total + (unit ? 1 + (unit.shields?.length ?? 0) : 0), 0);
}

function matchOutcome(game: Game) {
  if (game.drawPile.length) return null;
  const playerOut = !game.player.length && !game.playerField.some(Boolean);
  const computerOut = !game.computer.length && !game.computerField.some(Boolean);
  if (playerOut && computerOut) return "draw";
  if (playerOut) return "defeat";
  if (computerOut) return "victory";
  return null;
}

function playerStepAfterDraw(game: Game): TurnStep {
  if (game.turn <= 2) return "move-out";
  return canMoveUp(game.playerField) ? "move-up" : moveOutOrAttack(game);
}

function drawForTurn(game: Game, side: "player" | "computer"): Game {
  if (matchOutcome(game)) return game;
  const [card, ...drawPile] = game.drawPile;
  const backRankAtTurnStart = side === "player"
    ? game.playerField.flatMap((unit, index) => unit && fieldRank(unit, index) === "back" ? [unit.card] : [])
    : [];
  const turn = { ...game, turn: game.turn + 1, step: "draw" as const, backRankAtTurnStart };
  if (!card) {
    const step = side === "player" ? playerStepAfterDraw(turn) : "move-up";
    return { ...turn, step, drewCard: false, drawnCard: undefined };
  }

  const remaining = drawPile.length;
  return {
    ...turn, [side]: [...game[side], card], drawPile, drewCard: true,
    drawnCard: side === "player" ? card : undefined,
    deckWarning: remaining === 10 || remaining === 5 || remaining === 4 || remaining === 3 ||
      remaining === 2 || remaining === 1 || remaining === 0 ? remaining : game.deckWarning,
  };
}

function hasNoAttackOptions(game: Game) {
  if (game.step === "attack") {
    return !game.playerField.some((unit, index) => unit?.card.type === "standard" &&
      (unit.card.rank === "6" || (isNumber(unit.card) && fieldRank(unit, index) === "front"))
    );
  }

  return game.player.length === 0 && !canMoveUp(game.playerField) &&
    !game.playerField.some((unit, index) => unit && (
      fieldRank(unit, index) === "front" ||
      canAttackFrom(unit, index, game.computerField, game.computer.length)
    ));
}

function hasOnlyJoker(game: Game) {
  const remaining = [...game.player, ...game.playerField.flatMap(unit =>
    unit ? [unit.card, ...(unit.shields ?? []).map(layer => layer.card)] : []
  )];
  return remaining.length === 1 && remaining[0].type === "joker";
}

function finishPlayerTurn(game: Game): Game {
  if (game.phase !== "player" || game.pendingAttack || game.specialStrike) return game;
  return drawForTurn({
    ...game, phase: "computer", extraAttack: false, selected: null, selectedShield: null, selectedStack: null,
    selectedSpecial: null, movingStack: false, movingShield: undefined, result: "", advantage: false, immunity: undefined,
  }, "computer");
}

function finishPlayerAttack(game: Game): Game {
  if (game.extraAttack && !matchOutcome(game)) {
    return {
      ...game, phase: "player", step: "attack", extraAttack: false, selected: null, selectedSpecial: null,
      result: `${game.result} Double Attack: one attack left.`,
    };
  }
  return drawForTurn({ ...game, extraAttack: false }, "computer");
}

function startGame(tutorial = false): Game {
  return drawForTurn({
    ...dealSimpleGame(tutorial ? createTutorialDeck() : undefined),
    playerField: [],
    backRankAtTurnStart: [],
    computerField: [],
    discardPile: [],
    phase: "player",
    step: "draw",
    round: { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, at: Date.now() },
    turn: 0,
    drewCard: false,
    selected: null,
    result: "",
    selectedShield: null,
    selectedStack: null,
    selectedSpecial: null,
    movingStack: false,
  }, "player");
}

function CardDetails({ card, layers }: { card: Card | null | undefined; layers: number }) {
  if (card === undefined) return (
    <div className="card-details">
      <h3>Card Details</h3>
      <p>Select a card.</p>
    </div>
  );
  if (card === null) return (
    <div className="card-details">
      <h3>Face-down card</h3>
      <p>Rank and abilities reveal when the card flips.</p>
    </div>
  );

  const abilities: string[] = [];
  if (card.type === "joker") {
    abilities.push("Trap: when attacked, both cards go to the discard pile. A 5 survives.");
    abilities.push("Decoy: attach Jacks or Queens to disguise the trap. The blast destroys those shields.");
  } else {
    switch (card.rank) {
      case "A": abilities.push("Instant Steal: take vulnerable cards and shields. Immune cards stay in play, and shields with no carrier return to their owner's hand."); break;
      case "K": abilities.push("Instant Kill: defeat every vulnerable card in the target stack. Suit-immune cards survive."); break;
      case "J": abilities.push("Shield: uses its own suit and the protected card’s strength.");
        abilities.push("Spy: reveal enemy cards and shields that are not immune to this Jack’s suit. Using Spy discards the Jack and ends your turn.");
      case "Q": abilities.push("Shield: uses its own suit and the protected card’s strength. Can disguise a Joker.");
        abilities.push("Double Attack: discard this Queen from your hand to attack twice this turn.");
        break;
      case "2": abilities.push("Defeats 10s and is immune to their attacks."); break;
      case "4": abilities.push("Built-in shield: absorbs the first non-immune regular hit."); break;
      case "5": abilities.push("Joker immunity: survives a Joker trap without losing its shields."); break;
      case "6": abilities.push("Range: 2. Attack the enemy front rank from your back rank, or reach the enemy back rank from your front rank past occupied slots."); break;
      case "10": abilities.push("A 2 is immune to this card and can defeat it."); break;
    }
    const favored = suitAdvantage[card.suit];
    const immune = (Object.keys(suitAdvantage) as Suit[]).find(suit => suitAdvantage[suit] === card.suit);
    if (isNumber(card) && favored && immune) abilities.push(`+1 against ${suitNames[favored]}. Blocked by ${suitNames[immune]}.`);
    else if (isSpecial(card) && immune) abilities.push(`Blocked by ${suitNames[immune]}.`);
    else if (card.suit === "diamonds") abilities.push("Neutral suit.");
  }

  return (
    <div className="card-details">
      <h3>Card Details</h3>
      <strong data-suit={card.type === "standard" ? card.suit : undefined}>
        {card.type === "joker" ? `${card.color === "red" ? "Red" : "Black"} Joker`
          : `${card.rank}${suitSymbols[card.suit]} · ${suitNames[card.suit]}`}
      </strong>
      {isNumber(card) && (
        <>
          <p>Base power: {strength(card)}</p>
          <p className="card-stackable">
            Stackable:{" "}
            <span className={canStack(card) ? "stackable-yes" : "stackable-no"}
              role="img" aria-label={canStack(card) ? "Yes" : "No"}>
              {canStack(card) ? "✓" : "✕"}
            </span>
          </p>
        </>
      )}
      {layers > 0 && <p>Attached shields: {layers}</p>}
      <ul>{abilities.map(ability => <li key={ability}>{ability}</li>)}</ul>
    </div>
  );
}

function BattlefieldRow({ units, label, rank, opponent = false, selected, onPick, canPick, onPickEmpty, canDrag, onDrag, onDragEnd, onDrop, onDropEmpty, onInspect, inspected, onDoublePick, highlighted = false, highlightRanged = false }: {
  onInspect?: (card: Card | null) => void;
  inspected?: Card | null;
  units: Field;
  label: string;
  rank: FieldRank;
  onPickEmpty?: (lane: number) => void;
  canDrag?: (index: number) => boolean;
  onDrag?: (index: number) => void;
  onDragEnd?: () => void;
  onDrop?: (index: number, rearrange: boolean) => void;
  onDropEmpty?: (lane: number) => void;
  opponent?: boolean;
  selected?: number | null;
  onPick?: (index: number) => void;
  onDoublePick?: (index: number) => void;
  highlighted?: boolean;
  highlightRanged?: boolean;
  canPick?: (unit: Unit, index: number) => boolean;
}) {
  return (
    <div role="group" aria-label={label} className={`battlefield-rank ${opponent ? "enemy-rank" : "player-rank"}${highlighted ? " rank-highlighted" : ""}`}>
      <p>{label}</p>
      <div style={battlefieldLayout}>
        {rankLanes[rank].map(lane => {
          const entries = laneCards(units, lane);
          if (!entries.length) {
            const dropProps = onDropEmpty ? {
              onDragOver: (event: React.DragEvent) => event.preventDefault(),
              onDrop: (event: React.DragEvent) => { event.preventDefault(); onDropEmpty(lane); },
            } : {};
            return (
              onPickEmpty ? (
                <button key={lane} className="field-slot field-slot-open" {...dropProps} onClick={() => onPickEmpty(lane)}>
                  Move Here
                </button>
              ) : <div key={lane} className="field-slot" {...dropProps} aria-label="Empty slot" />
            );
          }

          return (
            <div key={lane} className="simple-game-stack">
              <div className="simple-game-stack-cards">
                {entries.map(({ unit, index }) => {
                  const faceDown = !unit.revealed;
                  const visible = opponent && faceDown ? null : unit.card;
                  const pickable = !!onPick && (!canPick || canPick(unit, index));
                  const horizontalFour = !faceDown && hasFourShield(unit);
                  const shieldLayers = unit.shields ?? [];
                  const separateShields = horizontalFour && shieldLayers.length > 0;
                  const privateCard = !opponent && faceDown ? unit.card : null;
                  const face = (
                    <>
                      {horizontalFour ? (
                        <span className="four-shield-card">
                          <span className="four-shield-art"><CardFace card={unit.card} /></span>
                          <span className="four-shield-label">Shield</span>
                        </span>
                      ) : <CardFace card={faceDown ? undefined : unit.card} faceDown={faceDown} />}
                      {privateCard && (
                        <span
                          className="simple-game-private-card"
                            data-suit={privateCard.type === "standard" ? privateCard.suit : undefined}
                          aria-label={privateCard.type === "joker" ? `${privateCard.color} Joker, visible only to you` : `${privateCard.rank} of ${privateCard.suit}, visible only to you`}

                        >
                          {privateCard.type === "joker" ? "Joker" : `${privateCard.rank}${suitSymbols[privateCard.suit]}`}
                        </span>
                      )}
                      {shieldLayers.length > 0 && (
                        <span
                          className={separateShields ? "attached-shields attached-shields-separate" : "attached-shields"}
                          style={separateShields ? { paddingTop: `${(shieldLayers.length - 1) * 0.38}rem` } : undefined}
                        >
                          {shieldLayers.map((layer, layerIndex, layers) => (
                            <span
                              key={layer.card.type === "standard" ? `${layer.card.rank}-${layer.card.suit}` : layerIndex}
                              className="simple-game-shield-card"
                              style={{ bottom: `${(layers.length - layerIndex - 1) * 0.38}rem` }}
                              data-card-position={`${opponent ? "computerField" : "playerField"}-shield-${index}-${layerIndex}`}
                            >
                              <span className="simple-game-shield-art">
                                <CardFace card={layer.revealed ? layer.card : undefined} faceDown={!layer.revealed} />
                              </span>
                              <img className="attached-shield-sprite"
                                src={`${import.meta.env.BASE_URL}assets/effects/shield-jq.gif`}
                                width={32} height={32} alt="" draggable={false} />
                              {((unit.revealed && isNumber(unit.card)) || layer.revealed) && (
                                <span className="attached-shield-strength"
                                  data-suit={layer.revealed && layer.card.type === "standard" ? layer.card.suit : undefined}>
                                  {unit.revealed && isNumber(unit.card) ? strength(unit.card) : ""}
                                  {layer.revealed && layer.card.type === "standard" ? suitSymbols[layer.card.suit] : ""}
                                </span>
                              )}
                              {!opponent && layerIndex === layers.length - 1 && layers.some(shield => !shield.revealed) && (
                                <span className="private-shield-labels">
                                  {[...layers].reverse().map(({ card, revealed }) =>
                                    !revealed && card.type === "standard" ? (
                                      <span key={`${card.rank}-${card.suit}`} data-suit={card.suit}
                                        aria-label={`${card.rank} of ${card.suit}, visible only to you`}>
                                        {card.rank}{suitSymbols[card.suit]}
                                      </span>
                                    ) : null
                                  )}
                                </span>
                              )}
                              {layerIndex === layers.length - 1 && <span className="simple-game-shield">
                                {layers.length === 1 ? "Shield" : `${layers.length} Shields`}
                              </span>}
                            </span>
                          ))}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <div
                      key={unit.card.type === "joker" ? unit.card.color : `${unit.card.rank}-${unit.card.suit}`}
                      className={`simple-game-stack-card${horizontalFour ? " is-horizontal" : ""}${separateShields ? " has-separate-shields" : ""}`}
                      data-card-position={`${opponent ? "computerField" : "playerField"}-${index}`}
                      onDragOver={onDrop ? event => event.preventDefault() : undefined}
                      onDrop={onDrop ? event => { event.preventDefault(); onDrop(index, event.shiftKey); } : undefined}
                    >
                      {pickable || onInspect ? (
                        <button
                          draggable={canDrag?.(index) ?? false}
                          onDragStart={onDrag ? event => {
                            event.dataTransfer.setData("text/plain", "Battlefield card");
                            event.dataTransfer.effectAllowed = "move";
                            onDrag(index);
                          } : undefined}
                          onDragEnd={onDragEnd}
                          className={[
                            visible && visible === inspected ? "card-inspected" : "",
                            highlightRanged && unit.card.type === "standard" && unit.card.rank === "6" ? "ranged-attacker" : "",
                          ].filter(Boolean).join(" ")}
                          onFocus={() => onInspect?.(visible)}
                          onClick={() => {
                            onInspect?.(visible);
                            if (pickable) onPick?.(index);
                          }}
                          onDoubleClick={pickable && onDoublePick ? () => onDoublePick(index) : undefined}
                          aria-pressed={opponent ? undefined : selected === index}
                          style={{
                            width: "100%", padding: 0, cursor: "pointer", background: "#fff", position: "relative",
                            border: 0, borderRadius: "0.5rem",
                            outline: selected === index ? "3px solid #1769d4" : undefined,
                          }}
                        >
                          {face}
                        </button>
                      ) : face}
                    </div>
                  );
                })}
              </div>
              {entries.length > 1 && (
                <strong className="simple-game-stack-power">
                  {opponent && entries.some(({ unit }) => !unit.revealed)
                    ? "Power hidden"
                    : `Power: ${offense(units, entries[0].index)}!`}
                </strong>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const difficulties = ["Sandbox", "Easy", "Normal", "Hard"] as const;
export type Difficulty = typeof difficulties[number];

function describeMatchActions(previous: Game, current: Game): string[] {
  const lines: string[] = [];
  const player = previous.phase === "player";
  const actor = player ? "You" : "Computer";
  const oldField = player ? previous.playerField : previous.computerField;
  const field = player ? current.playerField : current.computerField;
  const oldPositions = new Map(oldField.flatMap((unit, index) =>
    unit ? [[unit.card, laneOf(unit, index)] as const] : []
  ));
  const deployed = field.filter(unit => unit && !oldPositions.has(unit.card)).length;
  const movedUp = field.some((unit, index) => unit && laneOf(unit, index) < slotsPerRank &&
    (oldPositions.get(unit.card) ?? -1) >= slotsPerRank);
  const cue = current.sound !== previous.sound ? current.sound?.cue : undefined;
  if (movedUp) lines.push(`${actor} moved up.`);
  if (deployed) lines.push(`${actor} deployed ${deployed} ${deployed === 1 ? "card" : "cards"}.`);
  if (current.phase === "computer-attack" || (previous.phase === "computer-move-out" && current.phase === "player")) {
    const countShields = (units: Field) => units.reduce((count, unit) => count + (unit?.shields?.length ?? 0), 0);
    const shields = countShields(field) - countShields(oldField);
    if (shields > 0) lines.push(`Computer attached ${shields} ${shields === 1 ? "shield" : "shields"}.`);
    const oldOwners = new Map(oldField.flatMap(unit =>
      unit ? (unit.shields ?? []).map(layer => [layer.card, unit.card] as const) : []
    ));
    if (field.some(unit => unit?.shields?.some(layer =>
      oldOwners.has(layer.card) && oldOwners.get(layer.card) !== unit.card
    ))) lines.push("Computer moved a shield.");
  }
  if (cue === "stack" && !player) lines.push("Computer stacked matching cards.");
  const repeatedAction = cue && !deployed && !movedUp && (player || previous.phase === "computer-attack");
  const rearranged = player && !movedUp && current.result === "Rearranged your rank." &&
    field.some((unit, index) => unit && oldPositions.has(unit.card) && oldPositions.get(unit.card) !== laneOf(unit, index));
  if (current.result && (current.result !== previous.result || repeatedAction || rearranged)) {
    lines.push(`${actor} · ${current.result}`);
  } else if (player && current.phase !== "player" && !lines.length) {
    lines.push("You ended your turn.");
  } else if (previous.phase === "computer-attack" && current.phase === "player" && !lines.length) {
    lines.push("Computer ended its turn.");
  }
  if (current.turn !== previous.turn && current.drewCard) {
    const card = current.drawnCard;
    lines.push(card ? `You drew ${card.type === "joker" ? "a Joker" : `${card.rank}${suitSymbols[card.suit]}`}.`
      : "Computer drew a card.");
  }
  return lines;
}

export default function SimpleGame({ difficulty, trainingGrounds = false, tutorial = false, tutorialAudio = null, onBack, music, onResultChange }: {
  difficulty: Difficulty;
  trainingGrounds?: boolean;
  tutorial?: boolean;
  tutorialAudio?: AudioContext | null;
  onBack: () => void;
  music: { enabled: boolean; toggle: () => void; setDucked: (ducked: boolean) => void };
  onResultChange: (visible: boolean) => void;
}) {
  const [game, setGame] = useState(() => startGame(tutorial));
  const [compactBoard, setCompactBoard] = useState(() => window.matchMedia(compactBoardQuery).matches);
  const [showMatchInfo, setShowMatchInfo] = useState(!compactBoard);
  const [showCardInfo, setShowCardInfo] = useState(!compactBoard);
  const [stackFromHand, setStackFromHand] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(compactBoardQuery);
    const onLayoutChange = (event: MediaQueryListEvent) => {
      setCompactBoard(event.matches);
      setShowMatchInfo(!event.matches);
      setShowCardInfo(!event.matches);
      setStackFromHand(false);
    };
    media.addEventListener("change", onLayoutChange);
    return () => media.removeEventListener("change", onLayoutChange);
  }, []);
  useEffect(() => setStackFromHand(false), [game.turn]);
  const [pauseRequested, setPaused] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [seenLessons, setSeenLessons] = useState<ReadonlySet<keyof typeof tutorialLessons>>(() => new Set());
  const tutorialOpening = tutorial && game.turn === 1 && game.phase === "player";
  const tutorialRank = tutorialOpening ? tutorialDeploymentRanks[game.playerField.filter(Boolean).length] : undefined;
  const availableLesson = tutorial && game.phase === "player"
    ? game.step === "move-out" ? tutorialRank
      : game.turn > 2 && (game.step === "move-up" || game.step === "attack") ? game.step : undefined
    : undefined;
  const activeLesson = availableLesson && !seenLessons.has(availableLesson) ? availableLesson : undefined;
  const paused = pauseRequested || utilityOpen || !!activeLesson;
  const labDialog = useRef<HTMLDialogElement>(null);
  const [labZone, setLabZone] = useState<LabZone>("player");
  const [labCard, setLabCard] = useState(0);
  const [labRank, setLabRank] = useState<FieldRank>("back");
  const pauseDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = pauseDialog.current;
    if (pauseRequested && dialog && !dialog.open) dialog.showModal();
    if (!pauseRequested && dialog?.open) dialog.close();
  }, [pauseRequested]);
  const [matchLog, setMatchLog] = useState<string[]>(["Match started."]);
  const [matchNote, setMatchNote] = useState("");
  const previousGame = useRef(game);
  const logView = useRef<HTMLDivElement>(null);
  const followLog = useRef(true);

  useEffect(() => {
    const previous = previousGame.current;
    previousGame.current = game;
    if (game.round !== previous.round) {
      followLog.current = true;
      setMatchLog(["New deal."]);
      setMatchNote("");
      return;
    }
    const lines = describeMatchActions(previous, game);
    if (lines.length) setMatchLog(entries => [...entries, ...lines.map(line => `Turn ${Math.ceil(previous.turn / 2)} · ${line}`)]);
  }, [game]);

  useEffect(() => {
    const log = logView.current;
    if (log && followLog.current) log.scrollTop = log.scrollHeight;
  }, [matchLog, showMatchInfo]);
  const [inspection, setInspection] = useState<{ card: Card | null; round: object }>();
  const inspected = inspection?.round === game.round ? inspection.card : undefined;
  const inspectedOwnUnit = game.playerField.find(unit => unit && unit.card === inspected);
  const inspectedUnit = inspectedOwnUnit ?? game.computerField.find(unit => unit && unit.card === inspected);

  function inspect(card: Card | null) {
    setInspection({ card, round: game.round });
  }
  const latestDiscard = game.discardPile[game.discardPile.length - 1];
  const board = useCardMotion(game);
  const outcome = matchOutcome(game);
  const modeLabel = tutorial ? "Tutorial · Easy" : trainingGrounds ? "Training Grounds" : `VS Computer · ${difficulty}`;
  useEffect(() => {
    if (game.turn <= 1 && !outcome) return;
    saveMatch({
      ...game.round,
      difficulty: tutorial ? "Tutorial · Easy" : trainingGrounds ? "Training Grounds" : difficulty,
      result: outcome || "In progress / left match",
      lines: matchLog,
    });
  }, [difficulty, trainingGrounds, tutorial, game.round, game.turn, matchLog, outcome]);
  const resultHeading = useRef<HTMLHeadingElement>(null);
  const immunityDialog = useRef<HTMLDialogElement>(null);
  const stackTargetDialog = useRef<HTMLDialogElement>(null);
  const choosingStackTargets = !!game.pendingAttack?.choices;
  useEffect(() => {
    const dialog = stackTargetDialog.current;
    if (choosingStackTargets && dialog && !dialog.open) dialog.showModal();
    if (!choosingStackTargets && dialog?.open) dialog.close();
  }, [choosingStackTargets]);
  const immunityWarningOpen = game.immunityWarningTarget !== undefined;
  useEffect(() => {
    const dialog = immunityDialog.current;
    if (immunityWarningOpen && dialog && !dialog.open) dialog.showModal();
    if (!immunityWarningOpen && dialog?.open) dialog.close();
  }, [immunityWarningOpen]);
  useEffect(() => {
    onResultChange(Boolean(outcome));
    if (outcome) resultHeading.current?.focus();
  }, [outcome, onResultChange]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const showingCombatEffect = Boolean(game.specialStrike || game.jokerExplosion || game.attackAnimation);
  const { setDucked } = music;
  useEffect(() => {
    if (!showingCombatEffect || !soundEnabled) return;
    setDucked(true);
    return () => setDucked(false);
  }, [showingCombatEffect, soundEnabled, setDucked]);
  useEffect(() => {
    const strike = game.specialStrike;
    if (!strike || paused) return;

    const timer = window.setTimeout(() => {
      setGame(current => current.specialStrike === strike ? { ...current, specialStrike: undefined } : current);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [game.specialStrike, paused]);

  useEffect(() => {
    const flash = game.spyFlash;
    if (!flash || paused) return;

    const timer = window.setTimeout(() => {
      setGame(current => current.spyFlash === flash ? { ...current, spyFlash: undefined } : current);
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [game.spyFlash, paused]);

  useEffect(() => {
    const strike = game.attackAnimation;
    if (!strike || paused) return;
    const timer = window.setTimeout(() => {
      setGame(current => current.attackAnimation === strike ? { ...current, attackAnimation: undefined } : current);
    }, strike.kind === "card" ? 1150 : 1900);
    return () => window.clearTimeout(timer);
  }, [game.attackAnimation, paused]);

  const deckWarning = showingCombatEffect ? undefined : game.deckWarning;
  const warningActive = deckWarning !== undefined;
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(false);
  const [phaseSeconds, setPhaseSeconds] = useState(30);
  const phaseClock = useRef({ round: game.round, turn: game.turn, step: game.step, remaining: 30_000 });
  const tutorialDeployment = tutorialRank && game.player.find(card => card.type === "standard" && card.rank === tutorialRank);
  const timedPhase = !tutorialOpening && turnTimerEnabled && game.phase === "player" && game.step !== "draw" && !outcome &&
    !showingCombatEffect && !warningActive;

  useEffect(() => {
    if (!timedPhase || paused) return;

    const clock = phaseClock.current;
    const samePhase = clock.round === game.round && clock.turn === game.turn && clock.step === game.step;
    const duration = samePhase ? clock.remaining : 30_000;
    const deadline = Date.now() + duration;
    setPhaseSeconds(Math.ceil(duration / 1000));
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setPhaseSeconds(remaining);
      if (remaining > 0) return;

      setGame(current => {
        if (current.turn !== game.turn || current.step !== game.step || current.phase !== "player" ||
            current.specialStrike || current.jokerExplosion) return current;
        if (current.pendingAttack) {
          const victims = current.pendingAttack.choices?.[0];
          return victims ? {
            ...current, pendingAttack: { ...current.pendingAttack, target: victims[0], choices: undefined, victims },
          } : current;
        }

        const ready = { ...current, immunityWarningTarget: undefined };
        const next = nextPlayerStep(ready);
        return next
          ? { ...advancePlayerStep(ready), result: `${turnSteps[current.step]} timed out. Advanced to ${turnSteps[next]}.` }
          : { ...finishPlayerTurn(ready), result: `${turnSteps[current.step]} timed out. Turn ended.` };
      });
    }, 250);
    return () => {
      window.clearInterval(timer);
      phaseClock.current = { round: game.round, turn: game.turn, step: game.step, remaining: Math.max(0, deadline - Date.now()) };
    };
  }, [game.round, game.turn, game.step, timedPhase, paused]);
  useEffect(() => {
    const explosion = game.jokerExplosion;
    if (!explosion || game.attackAnimation || paused) return;
    const timer = window.setTimeout(() => {
      setGame(current => current.jokerExplosion === explosion ? { ...current, jokerExplosion: undefined } : current);
    }, 2250);
    return () => window.clearTimeout(timer);
  }, [game.jokerExplosion, game.attackAnimation, paused]);

  useEffect(() => {
    if (deckWarning === undefined || paused) return;
    const timer = window.setTimeout(() => {
      setGame(current => current.deckWarning === deckWarning ? { ...current, deckWarning: undefined } : current);
    }, 5450);
    return () => window.clearTimeout(timer);
  }, [deckWarning, paused]);

  const warningSpeechTimer = useRef<number>();
  const stopSpeech = useCallback(() => {
    window.clearTimeout(warningSpeechTimer.current);
    window.speechSynthesis?.cancel();
  }, []);
  const { canPlayAudio: canSpeak } = useAudioForeground(stopSpeech);
  useEffect(() => stopSpeech, [stopSpeech]);

  useEffect(() => {
    if (deckWarning === undefined || paused || !soundEnabled || !window.speechSynthesis ||
        typeof SpeechSynthesisUtterance === "undefined" || !canSpeak()) return;
    const timer = window.setTimeout(() => {
      if (!canSpeak()) return;
      const message = deckWarning === 0 ? "Sudden Death! The draw deck is empty."
        : deckWarning === 1 ? "Warning! Only one card remains!" : `Warning! Only ${deckWarning} cards remain!`;
      const warning = new SpeechSynthesisUtterance(message);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(warning);
    }, 3530);
    warningSpeechTimer.current = timer;
    return () => window.clearTimeout(timer);
  }, [deckWarning, soundEnabled, paused, canSpeak]);

  const isComputer = game.phase !== "player";
  const isMovingUp = !isComputer && game.step === "move-up";
  const isMovingOut = !isComputer && game.step === "move-out";
  const isAttacking = !isComputer && game.turn > 2 && game.step === "attack";
  const opponentHasCards = game.computerField.some(Boolean);
  const castleOpen = !isComputer && !opponentHasCards;
  const selectedUnit = game.selected === null ? null : game.playerField[game.selected];
  const selectedFrontAttacker = !!selectedUnit && game.selected !== null &&
    fieldRank(selectedUnit, game.selected) === "front" && isNumber(selectedUnit.card);
  const canAttackNow = !warningActive && game.turn > 2 && (opponentHasCards || game.computer.length > 0);
  const selectedAttacker = selectedUnit && game.selected !== null && canAttackNow &&
    canAttackFrom(selectedUnit, game.selected, game.computerField, game.computer.length);
  const aimingAttack = selectedAttacker && !game.movingStack;
  const selectedBack = !!selectedUnit && game.selected !== null && fieldRank(selectedUnit, game.selected) === "back";
  const castleTargeting = canAttackNow && castleOpen && selectedFrontAttacker && !game.pendingAttack && !game.movingStack;
  const choosingHandCard = game.selectedShield || game.selectedStack || game.selectedSpecial;
  const canReallocateShields = !tutorialOpening && !isComputer && !showingCombatEffect && !game.pendingAttack && !warningActive;
  const canUseSupport = !tutorialOpening && !isComputer && game.step !== "draw" && !game.pendingAttack && !showingCombatEffect;
  const canChooseShield = canUseSupport && game.playerField.some(canShield);
  const canSpy = canUseSupport && opponentHasCards;
  const spySelected = canSpy && !!game.selectedShield && isJack(game.selectedShield);
  const canDoubleAttack = canUseSupport && !warningActive && game.turn > 2 && game.queenAttackTurn !== game.turn;
  const doubleAttackSelected = canDoubleAttack && !!game.selectedShield && isQueen(game.selectedShield);
  const queenCue = !isComputer && game.queenAttackTurn === game.turn
    ? game.extraAttack ? "Double Attack!" : "2nd Attack!"
    : undefined;
  const spokenQueenCue = useRef<{ round: object; turn: number; cue: string }>();
  const hasOpenLane = openLanes(game.playerField, "back").length > 0;
  const hasStackTarget = (card: Card) => hasHandStack(game.playerField, card);
  const canStackFromHand = !tutorialOpening && !isComputer && !showingCombatEffect && !game.pendingAttack;
  const unlockSound = useGameSound(game, soundEnabled && !paused, showingCombatEffect ? null : outcome);
  const draggedCard = useRef<DraggedCard | null>(null);
  const canDeployFromHand = canDeployThisPhase(game) && hasOpenLane;
  const canToggleHandStack = compactBoard && canDeployFromHand && canStackFromHand &&
    game.player.some(card => hasHandStack(game.playerField, card));
  const choosingHandStack = canToggleHandStack && stackFromHand;
  const canEndTurn = !tutorialRank && !isComputer && game.step !== "draw" && !game.pendingAttack && !warningActive && !showingCombatEffect;
  const pendingTarget = game.pendingAttack && game.computerField[game.pendingAttack.target];
  const pendingPower = pendingTarget && game.pendingAttack?.isStack
    ? calculateAttack(game.playerField, game.pendingAttack.attacker,
        attackDefense(game.computerField, game.pendingAttack.target, pendingTarget).visibleCard)
    : null;
  const selected = game.selected;
  const canStackSelected = canStackFromHand && selected !== null &&
    game.playerField.some((_, index) => canMoveIntoStack(game, selected, index));

  const nextStep = tutorialOpening ? undefined : nextPlayerStep(game);
  const moveOutExhausted = !canStackSelected && game.turn > 2 && isMovingOut && !aimingAttack && !game.selectedStack && !game.selectedSpecial && !hasMoveOutAction(game);
  const moveUpBlocked = !canStackSelected && isMovingUp && !aimingAttack && !game.selectedStack && !game.selectedSpecial && !canMoveUp(game.playerField);
  const openingBackFilled = game.turn === 1 && isMovingOut && !hasOpenLane;
  const jokerOnlyTurn = canEndTurn && !showingCombatEffect && hasOnlyJoker(game);
  const skipAttack = canEndTurn && !showingCombatEffect && hasNoAttackOptions(game);

  function canPickOwnUnit(unit: Unit, index: number) {
    if (game.selectedShield || game.movingShield) return canShield(unit);
    if (game.selectedStack) return fieldRank(unit, index) === "back" && matchesStack(game.selectedStack, unit.card);
    if (game.movingStack && selected !== null) return index === selected || canMoveIntoStack(game, selected, index);
    if (canAttackNow && canAttackFrom(unit, index, game.computerField, game.computer.length)) return true;
    if (isMovingUp && fieldRank(unit, index) === "back" && openLanes(game.playerField, "front").length > 0) return true;

    return index === selected || game.playerField.some((_, target) => canMoveIntoStack(game, index, target));
  }

  useEffect(() => {
    if ((!moveOutExhausted && !moveUpBlocked && !openingBackFilled && !jokerOnlyTurn && !skipAttack) || outcome || immunityWarningOpen || paused || showingCombatEffect) return;
    const timer = window.setTimeout(() => {
      setGame(current => {
        if (current.phase !== "player") return current;
        if (current.step !== "draw" && ((jokerOnlyTurn && hasOnlyJoker(current)) ||
            (skipAttack && hasNoAttackOptions(current)))) {
          return finishPlayerTurn(current);
        }
        if (current.turn === 1 && current.step === "move-out" && !openLanes(current.playerField, "back").length) {
          return finishPlayerTurn(current);
        }
        if (current.step === "move-up" && !canMoveUp(current.playerField)) {
          return { ...current, step: moveOutOrAttack(current), selected: null };
        }
        return current.step === "move-out" && !hasMoveOutAction(current) ? advancePlayerStep(current) : current;
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [moveOutExhausted, moveUpBlocked, openingBackFilled, jokerOnlyTurn, skipAttack, game.turn, outcome, immunityWarningOpen, paused, showingCombatEffect]);

  const finishDraw = useCallback((turn: number) => {
    setGame(current => current.phase === "player" && current.step === "draw" && current.turn === turn
      ? { ...current, step: playerStepAfterDraw(current), drawnCard: undefined }
      : current);
  }, []);

  useEffect(() => {
    if (isComputer || game.step !== "draw" || outcome || showingCombatEffect || paused) return;
    const timer = window.setTimeout(() => finishDraw(game.turn), 3270);
    return () => window.clearTimeout(timer);
  }, [finishDraw, game.step, game.turn, isComputer, outcome, showingCombatEffect, paused]);

  useEffect(() => {
    const voice = window.speechSynthesis;
    if (!voice || typeof SpeechSynthesisUtterance === "undefined") return;
    if (!soundEnabled || outcome || paused) {
      voice.cancel();
      return;
    }
    if (!canSpeak() ||
        warningActive || showingCombatEffect || skipAttack || (game.step !== "attack" && (isComputer || game.step === "draw"))) return;
    const spoken = spokenQueenCue.current;
    const newQueenCue = queenCue && (spoken?.round !== game.round || spoken.turn !== game.turn || spoken.cue !== queenCue);
    if (queenCue === "2nd Attack!" && !newQueenCue) return;
    if (newQueenCue) spokenQueenCue.current = { round: game.round, turn: game.turn, cue: queenCue };
    const label = newQueenCue ? (queenCue === "2nd Attack!" ? "Second attack!" : queenCue)
      : game.step === "attack" ? "Attack!" : turnSteps[game.step];
    const announcement = new SpeechSynthesisUtterance(label);
    announcement.rate = 1.02;
    voice.cancel();
    voice.speak(announcement);
  }, [game.round, game.step, game.turn, isComputer, soundEnabled, outcome, showingCombatEffect, warningActive, skipAttack, paused, queenCue, canSpeak]);

  useEffect(() => {
    if (!isComputer || outcome || showingCombatEffect || warningActive || paused) return;

    const timer = window.setTimeout(() => {
      const castleRoll = Math.random();
      const attackRoll = Math.random();
      setGame(current => {
        if (current.phase === "computer") {
          if (current.turn <= 2) return { ...current, phase: "computer-move-out", step: "move-out" };
          let field = current.computerField;
          const sources = rankLanes.back
            .filter(lane => laneCards(field, lane).some(({ unit }) => canDeploy(unit.card)))
            .sort((a, b) => laneCards(field, b).reduce((sum, { unit }) => sum + strength(unit.card), 0) -
              laneCards(field, a).reduce((sum, { unit }) => sum + strength(unit.card), 0));
          for (const lane of openLanes(field, "front")) {
            const source = sources.shift();
            if (source === undefined) break;
            field = moveUp(field, source, lane);
          }
          return { ...current, computerField: field, phase: "computer-move-out", step: "move-out" };
        }

        if (current.phase === "computer-move-out") {
          let field = [...current.computerField];
          const empty = openLanes(field, "back");
          const tutorialEnemyOpening = tutorial && current.turn === 2;
          const available = tutorialEnemyOpening
            ? current.computer.filter(card => card.type === "standard" && card.rank === "7" && card.suit === "spades")
            : current.computer.filter(canDeploy).sort((a, b) => strength(b) - strength(a));
          for (const lane of empty) {
            const card = available.shift();
            if (!card) break;
            field[lane] = deploy(card);
          }
          const combined = current.turn > 2 ? findComputerStack(current, field) : field;
          const stackedForAttack = combined !== field;
          field = combined;

          const used = new Set<Card>(field.flatMap(unit => unit ? [unit.card] : []));
          const stackCard = available.find(card => !used.has(card) && hasHandStack(field, card));
          if (stackCard) {
            const target = field.findIndex((unit, index) =>
              unit && fieldRank(unit, index) === "back" && matchesStack(stackCard, unit.card)
            );
            const unit = field[target];
            if (unit) {
              field = addToStack(field, deploy(stackCard), laneOf(unit, target));
              used.add(stackCard);
            }
          }
          let movedShield = false;
          if (difficulty === "Hard") {
            const managed = manageHardShields(current, field, used);
            field = managed.field;
            movedShield = managed.moved;
          } else if (!tutorialEnemyOpening) {
            const shieldTargets = field.flatMap((unit, index) => unit && canShield(unit) ? [index] : []);
            shieldTargets.sort((a, b) => laneOf(field[a]!, a) - laneOf(field[b]!, b));
            const shields = current.computer.filter(isShield);
            if (shieldTargets.length) {
              shields.forEach((card, index) => {
                const slot = shieldTargets[index % shieldTargets.length];
                const unit = field[slot];
                if (!unit) return;
                used.add(card);
                field[slot] = { ...unit, shields: [...(unit.shields ?? []), { card, revealed: false }] };
              });
            }
          }
          const computerField = field;
          const placed: Game = {
            ...current,
            computer: current.computer.filter(card => !used.has(card)),
            computerField,
            computerStacked: stackedForAttack,
            phase: "computer-attack",
            step: "attack",
            sound: stackedForAttack || stackCard ? { cue: "stack" }
              : movedShield ? { cue: "shield" }
              : used.size > current.computerField.filter(Boolean).length ? { cue: "deploy" } : current.sound,
          };
          return current.turn <= 2 ? drawForTurn({ ...placed, phase: "player" }, "player") : placed;
        }

        if (current.phase !== "computer-attack") return current;
        if (difficulty === "Sandbox") {
          const candidate = current.computerField.find(Boolean);
          const plan = sandboxRetreatPlan(current.turn, current.nextSandboxRetreat, Boolean(candidate), attackRoll);
          const unit = plan.retreat ? candidate : null;
          return drawForTurn({
            ...current,
            phase: "player",
            nextSandboxRetreat: plan.nextRetreat,
            computer: unit ? [...current.computer, unit.card, ...(unit.shields ?? []).map(layer => layer.card)] : current.computer,
            computerField: unit ? current.computerField.map(entry => entry === unit ? null : entry) : current.computerField,
            result: unit ? "Sandbox opponent retreated a card and ended its turn." : "Sandbox opponent ended its turn.",
            sound: unit ? { cue: "play" } : current.sound,
          }, "player");
        }
        const attackDifficulty = current.computerStacked ? "Hard" : difficulty;
        const { attack, hasProductiveAttack } = chooseComputerAttack(current, attackDifficulty, attackRoll);
        const { attacker, target } = attack ?? { attacker: -1, target: -1 };
        const attackingUnit = current.computerField[attacker];
        if (target === -1 && attackingUnit && current.player.length) {
          const handIndex = Math.floor(castleRoll * current.player.length);
          return drawForTurn({
            ...current,
            phase: "player",
            player: current.player.filter((_, index) => index !== handIndex),
            computerField: current.computerField.map((unit, index) =>
              index === attacker ? { ...attackingUnit, revealed: true } : unit,
            ),
            discardPile: [...current.discardPile, current.player[handIndex]],
            advantage: false, immunity: undefined,
            result: "The computer hit your castle and discarded one of your hand cards.",
            attackAnimation: makeAttackAnimation(attackingUnit, current.player[handIndex], "computer"),
            sound: { cue: "castle" },
          }, "player");
        }
        const turn: Game = { ...current, phase: "computer", result: "", advantage: false, immunity: undefined };
        const special = !hasProductiveAttack && (!attack || difficulty !== "Easy")
          ? chooseComputerSpecial(turn, Boolean(attack))
          : undefined;
        if (difficulty === "Hard" && !hasProductiveAttack && !special && (attack?.tacticalScore ?? 0) <= 0) {
          const slot = chooseComputerRetreat(turn);
          const unit = turn.computerField[slot];
          if (unit) {
            return drawForTurn({
              ...turn, phase: "player", lastComputerRetreat: unit.card,
              computer: [...turn.computer, unit.card, ...(unit.shields ?? []).map(layer => layer.card)],
              computerField: turn.computerField.map((entry, index) => index === slot ? null : entry),
              result: "The computer retreated a threatened card to its hand and ended its turn.",
              sound: { cue: "play" },
            }, "player");
          }
        }
        const resolved = special
          ? resolveSpecial(turn, special.index, "computer", special.card)
          : resolveAttack(turn, "computer", attacker, target);
        return drawForTurn({ ...resolved, phase: "player" }, "player");
      });
    }, game.turn <= 2 ? 2500 : game.phase === "computer-attack" ? 1800 : 1600);

    return () => window.clearTimeout(timer);
  }, [game.phase, game.turn, isComputer, outcome, showingCombatEffect, warningActive, difficulty, paused, tutorial]);

  function playCard(card: Card) {
    setGame(current => {
      if (tutorial && current.turn === 1 && current.phase === "player") {
        const requiredRank = tutorialDeploymentRanks[current.playerField.filter(Boolean).length];
        if (card.type !== "standard" || card.rank !== requiredRank) return current;
      }
      const field = [...current.playerField];
      const open = openLanes(field, "back");
      const slot = open.find(lane => laneCards(field, lane - slotsPerRank).length > 0) ?? open[0];
      if (!canDeployThisPhase(current) || slot === undefined ||
          !canDeploy(card) || !current.player.includes(card)) {
        return current;
      }
      field[slot] = deploy(card);
      return {
        ...current,
        step: current.step === "move-up" ? "move-out" : current.step,
        player: current.player.filter(heldCard => heldCard !== card),
        playerField: field,
        selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null, movingStack: false, movingShield: undefined,
        result: current.step === "move-up" ? "Card deployed. Skipped to Move Out." : current.result,
        sound: { cue: "play" },
      };
    });
  }

  function endTurn() {
    if (!canEndTurn) return;
    setGame(finishPlayerTurn);
  }

  function spy() {
    setGame(current => {
      const jack = current.selectedShield;
      if (!jack || !isJack(jack) || current.phase !== "player" || current.step === "draw" ||
          current.pendingAttack || current.specialStrike || current.jokerExplosion ||
          !current.player.includes(jack) || !current.computerField.some(Boolean)) return current;

      let revealed = 0;
      const reveal = <T extends { card: Card; revealed: boolean }>(entry: T): T => {
        if (entry.revealed || isSpecialImmune(jack.suit, entry.card)) return entry;
        revealed++;
        return { ...entry, revealed: true };
      };
      const computerField = current.computerField.map(unit => unit && ({
        ...reveal(unit),
        shields: unit.shields?.map(reveal),
      }));
      const next = finishPlayerTurn({
        ...current, computerField,
        player: current.player.filter(card => card !== jack),
        discardPile: [...current.discardPile, jack],
      });
      return {
        ...next,
        result: revealed ? `Spy revealed ${revealed} ${revealed === 1 ? "card" : "cards"}. Turn ended.`
          : "Spy found no cards it could reveal. Turn ended.",
        spyFlash: jack,
        sound: { cue: "spy" },
      };
    });
  }

  function activateDoubleAttack() {
    setGame(current => {
      const queen = current.selectedShield;
      if (!queen || !isQueen(queen) || current.phase !== "player" || current.step === "draw" || current.turn <= 2 ||
          current.queenAttackTurn === current.turn || current.pendingAttack || current.specialStrike ||
          current.jokerExplosion || current.attackAnimation || current.deckWarning !== undefined ||
          !current.player.includes(queen)) return current;
      return {
        ...current, extraAttack: true, queenAttackTurn: current.turn, selectedShield: null,
        player: current.player.filter(card => card !== queen),
        discardPile: [...current.discardPile, queen],
        result: "Double Attack activated. You can attack twice this turn.",
        sound: { cue: "play" },
      };
    });
  }

  function selectShield(card: Card) {
    setGame(current => {
      if (current.phase !== "player" || current.step === "draw" || current.pendingAttack ||
          !isShield(card) || !current.player.includes(card)) return current;
      return {
        ...current, selected: null, movingStack: false, movingShield: undefined,
        selectedShield: current.selectedShield === card ? null : card, selectedStack: null, selectedSpecial: null,
      };
    });
  }

  function selectFromHand(card: Card, kind: "selectedStack" | "selectedSpecial") {
    setGame(current => {
      const canChoose = current.phase === "player" && !current.pendingAttack && !current.specialStrike &&
        (kind === "selectedStack" || (current.turn > 2 && current.computerField.some(Boolean)));
      if (!canChoose || !current.player.includes(card) ||
          (kind === "selectedStack" && !hasHandStack(current.playerField, card))) return current;
      return {
        ...current,
        selectedShield: null,
        selectedStack: null,
        selectedSpecial: null,
        selected: null,
        movingStack: false,
        movingShield: undefined,
        [kind]: current[kind] === card ? null : card,
      };
    });
  }

  function retreat(card: Card) {
    setGame(current => {
      if (current.phase !== "player" || current.pendingAttack || current.specialStrike) return current;
      const index = current.playerField.findIndex(unit => unit?.card === card);
      const unit = current.playerField[index];
      if (!unit) return current;

      const next = finishPlayerTurn({
        ...current,
        player: [...current.player, unit.card, ...(unit.shields ?? []).map(shield => shield.card)],
        playerField: current.playerField.map((entry, slot) => slot === index ? null : entry),
      });
      return { ...next, result: "Card retreated to your hand. Turn ended.", sound: { cue: "play" } };
    });
  }

  function startShieldMove(source: Card, layer: ShieldLayer) {
    setGame(current => {
      const unit = current.playerField.find(entry => entry && entry.card === source);
      if (current.phase !== "player" || current.pendingAttack || current.specialStrike || !unit?.shields?.includes(layer)) return current;
      const same = current.movingShield?.source === source && current.movingShield.layer === layer;
      return {
        ...current, movingShield: same ? undefined : { source, layer },
        selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null, movingStack: false,
      };
    });
  }

  function pickUnit(index: number) {
    setGame(current => {
      const unit = current.playerField[index];
      if (!unit || current.phase !== "player" || current.pendingAttack || current.specialStrike) return current;

      if (current.movingShield) {
        const { source, layer } = current.movingShield;
        if (!canShield(unit)) return current;
        if (unit.card === source) return { ...current, movingShield: undefined };
        const sourceIndex = current.playerField.findIndex(entry => entry?.card === source && entry.shields?.includes(layer));
        if (sourceIndex === -1) return { ...current, movingShield: undefined };
        const playerField = current.playerField.map((entry, slot) => {
          if (!entry) return entry;
          if (slot === sourceIndex) return { ...entry, shields: entry.shields?.filter(shield => shield !== layer) };
          if (slot === index) return { ...entry, shields: [...(entry.shields ?? []), layer] };
          return entry;
        });
        return { ...current, playerField, movingShield: undefined, result: "Shield moved.", sound: { cue: "shield" } };
      }

      if (current.selectedStack) return stackOnto(current, { from: "hand", card: current.selectedStack }, index);

      const shield = current.selectedShield;
      if (shield) return equipShield(current, shield, index);
      if (current.step === "move-up" && !shield && !current.movingStack && !current.selectedSpecial &&
          fieldRank(unit, index) === "back") {
        const directlyAhead = laneOf(unit, index) - slotsPerRank;
        if (openLanes(current.playerField, "front").includes(directlyAhead)) {
          return promoteUnit(current, index, directlyAhead);
        }
      }

      const canAttack = canAttackFrom(unit, index, current.computerField, current.computer.length);
      if (current.turn > 2 && canAttack && current.step !== "attack" &&
          !shield && !current.selectedStack && !current.selectedSpecial && !current.movingStack) {
        return { ...current, selected: current.selected === index ? null : index };
      }
      const sourceIndex = current.selected;
      if (current.movingStack && sourceIndex !== null) {
        if (sourceIndex === index) return { ...current, selected: null, movingStack: false };
        return stackOnto(current, { from: "field", index: sourceIndex }, index);
      }
      const canStackOnField = current.playerField.some((_, target) => canMoveIntoStack(current, index, target));
      if (current.step === "move-up" && fieldRank(unit, index) === "back") {
        const frontSlots = openLanes(current.playerField, "front");
        if (frontSlots.length === 1 && !canStackOnField) return promoteUnit(current, index, frontSlots[0]);
        const previous = current.selected === null ? null : current.playerField[current.selected];
        const sameLane = previous && current.selected !== null &&
          laneOf(previous, current.selected) === laneOf(unit, index);
        return { ...current, selected: sameLane ? null : index };
      }

      const readyToAttack = current.turn > 2 && current.step === "attack" && canAttack;
      if (shield || current.selectedSpecial || (!readyToAttack && !canStackOnField)) return current;
      return { ...current, selected: current.selected === index ? null : index };
    });
  }

  function promoteToOpenSlot(index: number) {
    setGame(current => {
      if (current.step !== "move-up" || current.movingStack || current.selectedStack ||
          current.selectedShield || current.movingShield || current.selectedSpecial ||
          current.pendingAttack || current.specialStrike || current.jokerExplosion) return current;
      const unit = current.playerField[index];
      if (!unit || fieldRank(unit, index) !== "back") return current;
      const open = openLanes(current.playerField, "front");
      const directlyAhead = laneOf(unit, index) - slotsPerRank;
      const lane = open.includes(directlyAhead) ? directlyAhead : open[0];
      return lane === undefined ? current : promoteUnit(current, index, lane);
    });
  }

  function moveSelectedUp(lane: number) {
    setGame(current => current.selected === null ? current : promoteUnit(current, current.selected, lane));
  }
  function dropOnCard(target: number, rearrange: boolean) {
    const source = draggedCard.current;
    draggedCard.current = null;
    if (!source) return;
    setGame(current => {
      if (source.from === "hand") return isShield(source.card)
        ? equipShield(current, source.card, target)
        : stackOnto(current, source, target);
      if (!rearrange && canMoveIntoStack(current, source.index, target)) return stackOnto(current, source, target);
      const unit = current.playerField[target];
      return unit ? rearrangeRank(current, source.index, laneOf(unit, target)) : current;
    });
  }

  function dropOnEmptyLane(lane: number) {
    const source = draggedCard.current;
    draggedCard.current = null;
    if (source?.from === "field") setGame(current => rearrangeRank(current, source.index, lane));
  }

  function advanceStep() {
    setGame(advancePlayerStep);
  }

  function attackCastle(index: number) {
    setGame(current => {
      const attacker = current.selected === null ? null : current.playerField[current.selected];
      const target = current.computer[index];
      if (current.phase !== "player" || current.turn <= 2 || current.pendingAttack || current.movingStack || current.computerField.some(Boolean) ||
          !attacker || current.selected === null || fieldRank(attacker, current.selected) !== "front" || !isNumber(attacker.card) || !target) return current;
      return finishPlayerAttack({
        ...current,
        computer: current.computer.filter((_, slot) => slot !== index),
        playerField: current.playerField.map((unit, slot) =>
          slot === current.selected ? { ...attacker, revealed: true } : unit,
        ),
        discardPile: [...current.discardPile, target],
        phase: "computer",
        selected: null,
        attackAnimation: makeAttackAnimation(attacker, target, "player"),
        result: "Castle hit! The chosen hand card went to the discard pile.",
        sound: { cue: "castle" },
        advantage: false,
      });
    });
  }

  function cancelImmunityWarning() {
    setGame(current => ({ ...current, immunityWarningTarget: undefined }));
  }

  function attack(index: number, confirmed = false) {
    setGame(state => {
      if (confirmed ? state.immunityWarningTarget !== index : state.immunityWarningTarget !== undefined) return state;
      const current = confirmed ? { ...state, immunityWarningTarget: undefined } : state;
      if (current.phase !== "player" || current.turn <= 2 || current.pendingAttack) return current;
      const defender = current.computerField[index];
      if (!defender) return current;

      const shouldWarn = difficulty === "Easy" && !confirmed && defender.revealed && defender.card.type === "standard";
      if (current.selectedSpecial) {
        const specialCard = current.selectedSpecial;
        if (shouldWarn && specialCard.type === "standard") {
          const knownImmune = specialCard.rank === "K"
            ? laneCards(current.computerField, laneOf(defender, index)).every(({ unit }) =>
                unit.revealed && isSpecialImmune(specialCard.suit, unit.card)
              )
            : (() => {
                const lane = laneCards(current.computerField, laneOf(defender, index));
                if (lane.length === 1) return isSpecialImmune(specialCard.suit, defender.card);
                return lane.every(({ unit }) => unit.revealed && isSpecialImmune(specialCard.suit, unit.card) &&
                  (unit.shields ?? []).every(layer => layer.revealed && isSpecialImmune(specialCard.suit, layer.card)));
              })();
          if (knownImmune) return { ...current, immunityWarningTarget: index };
        }
        const special = resolveSpecial(current, index);
        return special === current ? current : finishPlayerAttack(special);
      }
      const attackerIndex = current.selected;
      if (attackerIndex === null || current.movingStack) return current;
      const attacker = current.playerField[attackerIndex];
      if (!attacker || !canAttackTarget(attacker, attackerIndex, current.computerField, index)) return current;
      const earlyAttack = current.step !== "attack";

      const choices = stackVictimChoices(current.playerField, attackerIndex, current.computerField, index);
      const defense = attackDefense(current.computerField, index, defender);
      const power = calculateAttack(current.playerField, attackerIndex, defense.visibleCard);
      if (shouldWarn && !choices.length && (!defense.outer || defense.outer.revealed) && power.immune && power.parts.some(part => part.suitBlocked)) {
        return { ...current, immunityWarningTarget: index };
      }
      const isStack = power.parts.length > 1;
      if (isStack || earlyAttack || choices.length > 1) {
        return {
          ...current,
          step: "attack",
          pendingAttack: {
            attacker: attackerIndex, target: choices[0]?.[0] ?? index, isStack,
            choices: choices.length > 1 ? choices : undefined,
            victims: choices.length === 1 ? choices[0] : undefined,
          },
          computerField: current.computerField.map((unit, slot) =>
            unit && laneOf(unit, slot) === laneOf(defender, index) ? { ...unit, revealed: true } : unit,
          ),
          advantage: false,
          immunity: undefined,
          result: "",
        };
      }
      const attacked = resolveAttack(current, "player", attackerIndex, index);
      return attacked.phase === "computer" ? finishPlayerAttack(attacked) : attacked;
    });
  }

  useEffect(() => {
    const pending = game.pendingAttack;
    if (!pending || pending.choices || paused) return;

    const timer = window.setTimeout(() => {
      setGame(current => {
        if (current.pendingAttack !== pending || current.phase !== "player") return current;
        const attacked = resolveAttack(current, "player", pending.attacker, pending.target, pending.victims);
        return attacked === current ? current : finishPlayerAttack(attacked);
      });
    }, pending.isStack ? 1000 : 260);

    return () => window.clearTimeout(timer);
  }, [game.pendingAttack, paused]);

  function editLab(removeIndex?: number) {
    setGame(current => {
      if (!trainingGrounds || current.phase !== "player" || current.step === "draw" ||
          current.pendingAttack || current.attackAnimation || current.specialStrike || current.jokerExplosion) return current;
      const isHand = labZone === "player" || labZone === "computer";
      if (removeIndex !== undefined) {
        if (!current[labZone][removeIndex]) return current;
        const result = "Lab removed a card.";
        return isHand
          ? { ...current, [labZone]: current[labZone].filter((_, i) => i !== removeIndex), result }
          : { ...current, [labZone]: current[labZone].map((unit, i) => i === removeIndex ? null : unit), result };
      }
      const card = labCards[labCard];
      const matches = (other: Card) => labCardName(card) === labCardName(other);
      const onBoard = [...current.playerField, ...current.computerField].some(unit =>
        unit && (matches(unit.card) || unit.shields?.some(layer => matches(layer.card))));
      if (onBoard || [...current.player, ...current.computer].some(matches)) {
        return { ...current, result: "That card is already in play. Remove it first or choose another card." };
      }
      const next = { ...current, drawPile: current.drawPile.filter(card => !matches(card)),
        discardPile: current.discardPile.filter(card => !matches(card)), result: "Lab added a card." };
      if (isHand) return { ...next, [labZone]: [...current[labZone], card] };
      if (!canDeploy(card)) return { ...current, result: "Add specialty cards to a hand." };
      const slot = openLanes(current[labZone], labRank)[0];
      if (slot === undefined) return { ...current, result: "That rank is full." };
      const field = [...current[labZone]];
      field[slot] = { ...deploy(card), revealed: true };
      return { ...next, [labZone]: field };
    });
  }

  function getTurnMessage() {
    if (skipAttack) return "No attack available. Ending turn.";
    if (jokerOnlyTurn) return "Only a Joker left. Ending turn...";
    if (choosingStackTargets) return "Choose which cards in the stack to defeat.";
    if (game.pendingAttack) return game.pendingAttack.isStack ? "Stack attack incoming." : "Attacking…";
    if (isComputer) return `Enemy phase · ${turnSteps[game.step]}`;
    if (aimingAttack) return castleTargeting
      ? "Castle exposed. Choose one of the computer’s face-down hand cards."
      : game.extraAttack ? "Choose an opposing card for the first of two attacks."
        : "Choose an opposing card to attack and end your turn.";
    if (game.selectedSpecial) return "Choose an enemy card for the special attack.";
    if (game.step === "draw") return game.drewCard ? "Drawing a card…" : "The draw deck is empty.";
    if (game.selectedStack) return "Choose a matching back-rank card to stack onto.";
    if (game.movingShield) return "Choose another number card to receive the shield.";
    if (game.selectedShield) return spySelected
      ? canChooseShield ? "Choose a card to shield, or press Spy to reveal cards and end your turn." : "Press Spy to reveal eligible enemy cards and end your turn."
      : doubleAttackSelected
        ? canChooseShield ? "Choose a card to shield, or activate Double Attack." : "Activate Double Attack to sacrifice the Queen."
        : "Choose a number card or Joker to shield.";
    if (game.movingStack) return "Choose a matching card in another slot.";
    if (canStackSelected && isMovingUp) return canMoveUp(game.playerField)
      ? "Choose an empty front-rank slot to move up, or press Stack."
      : "Press Stack to combine this card with a matching front-rank card.";
    if (canStackSelected && isMovingOut) return "Press Stack to combine this card with a matching card.";
    if (isMovingUp) {
      if (!hasBackRankCards(game.playerField)) {
        return `Back rank empty. Advancing to ${turnSteps[moveOutOrAttack(game)]}…`;
      }
      if (!openLanes(game.playerField, "front").length) return `Front rank full. Advancing to ${turnSteps[moveOutOrAttack(game)]}…`;
      if (tutorial && game.turn === 3 && selected === null && game.playerField.some((unit, index) =>
        unit?.card.type === "standard" && unit.card.rank === "6" && fieldRank(unit, index) === "back"
      )) {
        const forward = game.playerField.filter((unit, index) =>
          unit?.card.type === "standard" && (unit.card.rank === "4" || unit.card.rank === "5") && fieldRank(unit, index) === "front"
        ).length;
        return forward === 2 && nextStep
          ? `Locke: The 4 and 5 are up front. Leave the 6 here and press Next: ${turnSteps[nextStep]}.`
          : "Locke: Move the 5 and 4 up. Keep the 6 of Hearts in the back rank.";
      }
      return selected === null
        ? canDeployFromHand && game.player.some(canDeploy)
          ? "Select a back-rank card to move up, or play from your hand to skip to Move Out."
          : "Select a back-rank card or stack to move up."
        : "Choose a highlighted slot in your front rank.";
    }
    if (moveOutExhausted) return hasOpenLane ? "No more cards can be placed. Advancing…" : "Back rank full. Advancing…";
    if (openingBackFilled) return "Back rank full. Ending turn…";
    if (isMovingOut && tutorialRank) return tutorialRank === "5"
      ? "Locke: One down. Deploy the highlighted 5 before the Commander starts counting."
      : `Commander Garrison: Deploy the highlighted ${tutorialRank} to your back rank.`;
    if (isMovingOut && game.turn <= 2) return "Play cards into the back rank, then press END TURN.";
    if (isMovingOut) return "Play cards from your hand into the back rank.";
    if (castleTargeting) return "Castle exposed. Choose one of the computer’s face-down hand cards.";
    if (selected !== null) return selectedAttacker
      ? "Choose an opponent’s card to attack."
      : "Press Stack to move this card onto a matching card.";
    return "Select a front-rank number card or an Ace or King from your hand.";
  }

  const turnMessage = getTurnMessage();
  const lightningBolt = (
    <img
      className="special-strike-bolt"
      src={`${import.meta.env.BASE_URL}assets/effects/lightning-strike.png`}
      alt=""
      draggable={false}
    />
  );
  const ownRows = (["front", "back"] as const).map(rank => (
    <BattlefieldRow
      key={rank}
      units={game.playerField}
      highlighted={rank === "back" ? isMovingUp : isAttacking && !skipAttack}
      highlightRanged={rank === "back" && isAttacking && !skipAttack}
      rank={rank}
      label={rank === "front" ? "Your front rank" : "Your back rank"}
      selected={selected}
      onPick={!isComputer && !showingCombatEffect && !game.pendingAttack && !game.selectedSpecial ? pickUnit : undefined}
      canPick={canPickOwnUnit}
      onDoublePick={rank === "back" && isMovingUp ? promoteToOpenSlot : undefined}
      onInspect={inspect}
      inspected={inspected}
      onPickEmpty={rank === "front" && isMovingUp && selectedBack ? moveSelectedUp : undefined}
      canDrag={() => canStackFromHand}
      onDrag={index => { draggedCard.current = { from: "field", index }; }}
      onDragEnd={() => { draggedCard.current = null; }}
      onDrop={canStackFromHand ? dropOnCard : undefined}
      onDropEmpty={canStackFromHand ? dropOnEmptyLane : undefined}
    />
  ));

  function canDragHandCard(card: Card) {
    return isShield(card) ? canChooseShield : canStackFromHand && hasStackTarget(card);
  }

  function canUseHandCard(card: Card) {
    if (tutorialOpening) return canDeployFromHand && card === tutorialDeployment;
    if (isShield(card)) return canChooseShield || (isJack(card) && canSpy) || (isQueen(card) && canDoubleAttack);
    if (isSpecial(card)) return !isComputer && !warningActive && game.turn > 2 && opponentHasCards && !game.pendingAttack && !showingCombatEffect;
    return (canDeployFromHand && canDeploy(card)) || (canStackFromHand && hasStackTarget(card));
  }

  return (
    <main ref={board} className="simple-game-table" data-paused={paused} onClickCapture={unlockSound}>
      {activeLesson && (
        <TutorialBattleDialogue key={activeLesson} lesson={activeLesson} audio={soundEnabled ? tutorialAudio : null}
          onDone={() => setSeenLessons(current => new Set([...current, activeLesson]))} />
      )}
      <Feedback floating onOpenChange={setUtilityOpen}
        context={`Version ${gameVersion} · ${modeLabel} · Turn ${Math.ceil(game.turn / 2)} · Deck ${game.drawPile.length} · Player health ${health(game.player, game.playerField)} · Opponent health ${health(game.computer, game.computerField)}`} />
      {trainingGrounds && (
        <dialog ref={labDialog} className="game-mode-picker playtest-dialog" aria-labelledby="lab-title"
          onClose={() => setUtilityOpen(false)}>
          <h2 id="lab-title">Training Grounds Lab</h2>
          <label>Location<select value={labZone} onChange={event => setLabZone(event.currentTarget.value as LabZone)}>
            {Object.entries(labZones).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          {(labZone === "playerField" || labZone === "computerField") && (
            <label>Rank<select value={labRank} onChange={event => setLabRank(event.currentTarget.value as FieldRank)}>
              <option value="front">Front</option><option value="back">Back</option>
            </select></label>
          )}
          <label>Card<select value={labCard} onChange={event => setLabCard(Number(event.currentTarget.value))}>
            {labCards.map((card, index) => <option key={index} value={index}>{labCardName(card)}</option>)}
          </select></label>
          <button type="button" onClick={() => editLab()}>Add card</button>
          <details><summary>Remove a card from this location</summary>
            {game[labZone].map((entry, index) => entry && (
              <button key={index} type="button" onClick={() => editLab(index)}>Remove {labCardName("card" in entry ? entry.card : entry)}</button>
            ))}
          </details>
          <p role="status">{game.result}</p>
          <button type="button" onClick={() => labDialog.current?.close()}>Close Lab</button>
        </dialog>
      )}
      <dialog ref={pauseDialog} className="game-mode-picker" aria-labelledby="pause-title"
        onCancel={event => { event.preventDefault(); setPaused(false); }}>
        <h2 id="pause-title">Game paused</h2>
        <button autoFocus onClick={() => setPaused(false)}>Resume</button>
      </dialog>
      <dialog ref={stackTargetDialog} className="game-mode-picker stack-target-picker"
        aria-labelledby="stack-target-title" onCancel={event => event.preventDefault()}>
        <h2 id="stack-target-title">Choose which cards to defeat</h2>
        {timedPhase && (
          <p className="phase-timer" role="timer" aria-label="Time left to choose" data-low={phaseSeconds <= 5}>
            0:{String(phaseSeconds).padStart(2, "0")}
          </p>
        )}
        <div className="game-mode-options">
          {game.pendingAttack?.choices?.map(victims => (
            <button key={victims.join("-")} type="button" className="stack-target-option" onClick={() => {
              setGame(current => current.pendingAttack?.choices?.includes(victims) ? {
                ...current, pendingAttack: { ...current.pendingAttack, target: victims[0], choices: undefined, victims },
              } : current);
            }}>
              {victims.map(index => <CardFace key={index} card={game.computerField[index]?.card} />)}
            </button>
          ))}
        </div>
      </dialog>
      <dialog ref={immunityDialog} className="game-mode-picker" aria-labelledby="immunity-warning-title"
        aria-describedby="immunity-warning-description" onCancel={event => {
          event.preventDefault();
          cancelImmunityWarning();
        }}>
        <h2 id="immunity-warning-title">Suit immunity</h2>
        <p id="immunity-warning-description">This attack will be blocked. Continuing will end your turn.</p>
        <div className="game-mode-options">
          <button autoFocus onClick={cancelImmunityWarning}>Go Back</button>
          <button onClick={() => {
            if (game.immunityWarningTarget !== undefined) attack(game.immunityWarningTarget, true);
          }}>Yes, Continue</button>
        </div>
      </dialog>
      {warningActive && (
        <div className="deck-warning-overlay" key={deckWarning} role="alert">
          <span>{deckWarning === 0 ? "Draw deck empty" : "Warning"}</span>
          <strong>{deckWarning === 0 ? "Sudden Death" : deckWarning === 1 ? "1 Card Remains" : `${deckWarning} Cards Remain`}</strong>
        </div>
      )}
      {game.attackAnimation && !paused && (
        <aside className={`attack-cutaway attack-cutaway--${game.attackAnimation.kind}`} role="status">
          <strong>{game.attackAnimation.side === "computer" ? "Enemy " : ""}
            {game.attackAnimation.kind === "dragon" ? "Dragon Fire"
              : game.attackAnimation.kind === "ranger" ? "Ranger Attack" : "Attack"}</strong>
          <div className="attack-cutaway-scene">
            {game.attackAnimation.kind === "card" ? (
              <>
                <div className="attack-cutaway-attacker"><CardFace card={game.attackAnimation.attacker} /></div>
                <span className="attack-card-contact" aria-hidden="true" />
              </>
            ) : (
              <>
                <img className="attack-cutaway-sprite" src={`${import.meta.env.BASE_URL}assets/effects/${
                  game.attackAnimation.kind === "dragon" ? "dragon-attack.gif" : "ranger-attack.gif?v=2"
                }`} alt="" />
                <span className={game.attackAnimation.kind === "dragon" ? "dragon-fire" : "ranger-arrow"} aria-hidden="true" />
              </>
            )}
            <div className="attack-cutaway-target"><CardFace card={game.attackAnimation.target} /></div>
          </div>
        </aside>
      )}
      {game.jokerExplosion && !game.attackAnimation && (
        <div className="joker-blast-overlay" key={game.jokerExplosion.turn} aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}assets/effects/joker-explosion.png`} alt="" draggable={false} />
          <strong>Joker Explosion!</strong>
          <div className="joker-blast-outcome">
            <div className="joker-blast-card">
              {game.jokerExplosion.survived ? <CardFace card={game.jokerExplosion.attacker} /> : (
                <>
                  <div className="joker-card-half joker-card-left"><CardFace card={game.jokerExplosion.attacker} /></div>
                  <div className="joker-card-half joker-card-right"><CardFace card={game.jokerExplosion.attacker} /></div>
                </>
              )}
            </div>
            <strong>{game.jokerExplosion.survived ? "SAFE!" : "Defeated"}</strong>
          </div>
        </div>
      )}
      {game.spyFlash && !game.specialStrike && (
        <div className="special-strike-overlay" aria-hidden="true">{lightningBolt}</div>
      )}
      {game.specialStrike && (
        <div key={game.specialStrike.turn} className={`special-strike-overlay special-strike--${game.specialStrike.kind}`} aria-hidden="true">
          <div className="special-strike-frame">
            <div className="special-strike-card"><CardFace card={game.specialStrike.card} /></div>
            <strong className="special-strike-title">
              {game.specialStrike.kind === "ace"
                ? (game.specialStrike.blocked ? "Ace Played" : "Instant Steal")
                : (game.specialStrike.blocked ? "King Played" : "Instant Kill")}
            </strong>
          </div>
          {lightningBolt}
          <div className={`special-strike-frame special-strike-target${game.specialStrike.attachments.length ? " has-attachments" : ""}`}>
            <div className="special-strike-card"><CardFace card={game.specialStrike.target} /></div>
            {game.specialStrike.attachments.length > 0 && (
              <div className="special-strike-attachments">
                {game.specialStrike.attachments.map((card, index) => (
                  <div key={index}><CardFace card={card} /></div>
                ))}
              </div>
            )}
            <strong className="special-strike-title">
              {game.specialStrike.blocked ? "Immune" : game.specialStrike.kind === "ace" ? "Stolen" : "Defeated"}
            </strong>
          </div>
        </div>
      )}
      {outcome ? (
        <section className={`match-result match-result--${outcome}`} aria-labelledby="match-title">
          <div className="match-result-suits" aria-hidden="true">♠ ♥ ♦ ♣</div>
          <h1 id="match-title" tabIndex={-1} ref={resultHeading}>
            {outcome === "victory" ? "Victory!" : outcome === "defeat" ? "Defeat" : "Draw"}
          </h1>
          <p>{outcome === "victory" ? "The computer ran out of cards. You’re the last player standing."
            : outcome === "defeat" ? "You ran out of cards. The computer is the last player standing."
            : "Both sides ran out of cards."}</p>
          {game.result && <p>{game.result}</p>}
          <div className="match-result-actions">
            <button onClick={() => { setSeenLessons(new Set()); setGame(startGame(tutorial)); }}>Play Again</button>
            <button onClick={onBack}>Back to Home</button>
          </div>
        </section>
      ) : (
        <>
      {isComputer && (
        <aside className="opponent-turn-tip" aria-labelledby="opponent-turn-heading">
          <h3 id="opponent-turn-heading">Opponent’s Turn</h3>
          <p><strong>Tip</strong> {opponentTips[(Math.ceil(game.turn / 2) - 1) % opponentTips.length]}</p>
        </aside>
      )}
      <h1>{simpleVersionTitle}</h1>
      <div>{modeLabel}</div>
      <div className="turn-steps" aria-label="Turn phases">
        {(game.turn <= 2 ? (["draw", "move-out"] as const)
          : (["draw", "move-up", "move-out", "attack"] as const))
          .filter(step => step !== "draw" || game.drawPile.length > 0 || game.step === "draw")
          .filter(step => step !== "attack" || !skipAttack)
          .map(step => (
          <span key={step} aria-current={game.step === step ? "step" : undefined}>{turnSteps[step]}</span>
        ))}
      </div>
      {!isComputer && game.step !== "draw" && !skipAttack && queenCue !== "2nd Attack!" && (
        <div key={`${game.turn}-${game.step}`} className="player-step-cue" aria-hidden="true">
          {turnSteps[game.step]}!
        </div>
      )}
      {queenCue && !showingCombatEffect && !skipAttack && (
        <div key={`queen-${game.turn}-${queenCue}`} className="player-step-cue queen-attack-cue" aria-hidden="true">
          {queenCue}
        </div>
      )}
      {!isComputer && game.step === "draw" && game.drawnCard && !showingCombatEffect && (
        <div key={`draw-preview-${game.turn}`} className="player-draw-preview" aria-hidden="true"
          onAnimationEnd={event => {
            if (event.target === event.currentTarget && (event.animationName === "draw-card-flight" || event.animationName === "draw-card-still")) finishDraw(game.turn);
          }}>
          <CardFace card={game.drawnCard} />
        </div>
      )}
      <div key={game.turn} className="simple-game-cues" hidden={showingCombatEffect} aria-hidden="true">
        {game.drewCard && (
          <>
            <div className={isComputer ? "simple-game-banner enemy" : "simple-game-banner"}>
              {isComputer ? "Enemy Phase · Draw" : "Player Phase · Draw"}
            </div>
            <div className="simple-game-drawing">Drawing Card</div>
          </>
        )}

        {game.advantage && !game.immunity && <div className="weapon-advantage-cue">+{game.advantageBonus ?? 1}</div>}
        {game.immunity && (
          <div className="immunity-cue">
            <strong>Immune!</strong>
            <div className="immunity-clash">
              <span className="immunity-attacker" data-suit={game.immunity.from}>
                {suitSymbols[game.immunity.from]}
              </span>
              <span className="immunity-impact">✦</span>
              <span className="immunity-defender" data-suit={game.immunity.to}>
                {game.immunity.to === "joker" ? "★" : suitSymbols[game.immunity.to]}
              </span>
            </div>
            <span>{game.immunity.label}</span>
          </div>
        )}
      </div>
      <h2 className="opponent-hand-heading">Computer’s hand</h2>
      <div className="hand-row opponent-hand-row" data-castle-targeting={castleTargeting} style={compactBoard ? undefined : handLayout}>
        {Array.from({ length: game.computer.length }, (_, index) => (
          <div key={index} data-card-position={`computer-${index}`}>
            {castleTargeting ? (
              <button className="simple-game-castle-target" aria-label={`Attack castle, hidden card ${index + 1}`} onClick={() => attackCastle(index)}>
                <CardFace faceDown />
              </button>
            ) : (
              <button className="inspect-card-button" onFocus={() => inspect(null)} onClick={() => inspect(null)}>
                <CardFace faceDown />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="compact-scoreboard" aria-label="Match overview">
        <span className="compact-scoreboard-enemy">Opponent <strong>{health(game.computer, game.computerField)}</strong></span>
        <span className="compact-scoreboard-player">You <strong>{health(game.player, game.playerField)}</strong></span>
        <span>Deck <strong>{game.drawPile.length}</strong></span>
      </div>
      <div className="simple-game-board">
        <section className="match-info-panel" aria-label="Health, draw deck, and match log">
          <button type="button" className="side-panel-toggle" aria-expanded={showMatchInfo}
            aria-controls="match-info-content" onClick={() => setShowMatchInfo(open => !open)}>Match details</button>
          <div id="match-info-content" className="side-panel-content" hidden={!showMatchInfo}>
          <h3>Draw deck</h3>
          <div data-draw-origin>{game.drawPile.length > 0 && <CardFace faceDown />}</div>
          <p>{game.drawPile.length} cards</p>
          {game.drawPile.length === 0 && <strong className="sudden-death-deck">Sudden Death</strong>}
          <figure className="weapon-triangle" aria-label="Weapon Triangle. Hearts beat spades, spades beat clubs, and clubs beat hearts. Diamonds are neutral.">
            <figcaption>Weapon Triangle</figcaption>
            <div className="weapon-triangle-diagram" aria-hidden="true">
              <span className="triangle-heart">♥</span>
              <span className="triangle-to-heart">↗</span>
              <span className="triangle-to-spade">↘</span>
              <span className="triangle-club">♣</span>
              <span className="triangle-to-club">←</span>
              <span className="triangle-spade">♠</span>
            </div>
            <div className="triangle-diamond" aria-hidden="true">♦ Neutral</div>
          </figure>
          <div className="match-log-panel">
            <h3 id="match-log-heading">Match Log</h3>
            <div ref={logView} role="log" tabIndex={0} aria-labelledby="match-log-heading" className="match-log"
              onScroll={event => {
                const log = event.currentTarget;
                followLog.current = log.scrollHeight - log.scrollTop - log.clientHeight < 12;
              }}>
              {matchLog.map((line, index) => <p key={index}>{line}</p>)}
            </div>
            <form className="match-log-form" onSubmit={event => {
              event.preventDefault();
              const note = matchNote.trim();
              if (!note) return;
              setMatchLog(entries => [...entries, `Note · ${note}`]);
              setMatchNote("");
            }}>
              <input aria-label="Chat" placeholder="Chat" maxLength={160}
                value={matchNote} onChange={event => setMatchNote(event.target.value)} />
              <button type="submit" disabled={!matchNote.trim()}>Add</button>
            </form>
          </div>
          <dl className="battle-health">
            <div className="battle-health-opponent">
              <dt>Opponent Health</dt>
              <dd>{health(game.computer, game.computerField)}</dd>
            </div>
            <div className="battle-health-player">
              <dt>Player Health</dt>
              <dd>{health(game.player, game.playerField)}</dd>
            </div>
            <div className="battle-health-deck">
              <dt>Deck</dt>
              <dd>{game.drawPile.length}</dd>
            </div>
          </dl>
          </div>
        </section>

        <section className="battlefield-panel" aria-labelledby="battlefield-heading">
          <h2 id="battlefield-heading" title="Drag to rearrange within a rank. Hold Shift to swap cards that can stack.">Battlefield</h2>
          {(["back", "front"] as const).map(rank => (
            <BattlefieldRow
              key={rank}
              units={game.computerField}
              rank={rank}
              label={rank === "front" ? "Computer front rank" : "Computer back rank"}
              opponent
              onInspect={inspect}
              inspected={inspected}
              canPick={(_, index) => !!game.selectedSpecial || (
                !!selectedUnit && selected !== null && canAttackTarget(selectedUnit, selected, game.computerField, index)
              )}
              onPick={!isComputer && !showingCombatEffect && !game.pendingAttack && !game.movingStack &&
                (selectedAttacker || game.selectedSpecial)
                ? attack : undefined}
            />
          ))}
          <div className="field-center-line" aria-live="polite">
            <span>TURN {Math.ceil(game.turn / 2)} · {isComputer ? "ENEMY" : "PLAYER"} — {skipAttack ? "ENDING TURN" : turnSteps[game.step].toUpperCase()}</span>
          </div>
          {ownRows}
          <div className="turn-controls" role="group" aria-label="Turn controls">
            {!isComputer && nextStep && (
              <button className="simple-game-next-step" onClick={advanceStep}>
                Next: {turnSteps[nextStep]}
              </button>
            )}
            {timedPhase && (
              <p role="timer" aria-label="Time left in this phase" className="phase-timer" data-low={phaseSeconds <= 5}>
                0:{String(phaseSeconds).padStart(2, "0")}
              </p>
            )}
            {trainingGrounds && (
              <button type="button" className="pause-button" disabled={!canEndTurn} onClick={() => {
                labDialog.current?.showModal();
                setUtilityOpen(true);
              }}>Lab</button>
            )}
            <button className="pause-button" onClick={() => setPaused(true)}>Pause</button>
            <button className="simple-game-end-turn" disabled={!canEndTurn} onClick={endTurn}>END TURN</button>
            {canStackSelected && (
              <button
                aria-pressed={game.movingStack}
                onClick={() => setGame(current => ({ ...current, movingStack: !current.movingStack }))}
              >
                {game.movingStack ? "Cancel Stack" : "Stack"}
              </button>
            )}
            <button className="retreat-button" disabled={!canReallocateShields || !inspectedOwnUnit}
              title={inspectedOwnUnit ? "Return this card to your hand and end your turn" : "Select one of your battlefield cards"}
              onClick={() => { if (inspectedOwnUnit) retreat(inspectedOwnUnit.card); }}>
              Retreat
            </button>
          </div>
        </section>

        <section className="simple-game-board-right" aria-label="Discard and card details">
          <div className="card-info-panel">
            <button type="button" className="side-panel-toggle" aria-expanded={showCardInfo}
              aria-controls="card-info-content" onClick={() => setShowCardInfo(open => !open)}>Card details</button>
            <div id="card-info-content" className="side-panel-content" hidden={!showCardInfo}>
          <h3>Discard / Graveyard</h3>
          {latestDiscard && (
            <button className={inspected === latestDiscard ? "inspect-card-button card-inspected" : "inspect-card-button"} data-card-position="discard-0"
              onFocus={() => inspect(latestDiscard)} onClick={() => inspect(latestDiscard)}>
              <CardFace card={latestDiscard} />
            </button>
          )}
          <p>{game.discardPile.length} cards</p>
          <CardDetails card={inspected} layers={inspectedUnit?.shields?.length ?? 0} />
          {canReallocateShields && inspectedOwnUnit?.shields?.map((layer, index) => (
            <button key={index} className="shield-move-button"
              aria-pressed={game.movingShield?.layer === layer}
              onClick={() => startShieldMove(inspectedOwnUnit.card, layer)}>
              {game.movingShield?.layer === layer ? "Cancel Shield Move" : `Move Shield ${index + 1}`}
            </button>
          ))}
            </div>
          </div>
        </section>
      </div>
      <div role="status" className="simple-game-status">
        <p key={turnMessage} className="simple-game-pulse">{turnMessage}</p>
        {game.result && <p key={game.result} className="simple-game-pulse">{game.advantage && !game.immunity && `Weapon advantage +${game.advantageBonus ?? 1}. `}{game.result}</p>}
      </div>

      {pendingPower && !choosingStackTargets && (
        <section className="stack-attack-confirmation" aria-labelledby="stack-power-title">
          <h3 id="stack-power-title" role="status">Power: {pendingPower.power}!</h3>
          <ul aria-label="Individual card contributions">
            {pendingPower.parts.map(({ card, blocked, bonus, power }, index) => (
              <li key={index} data-contribution={blocked ? "blocked" : bonus ? "bonus" : "normal"}>
                {card.type === "standard" ? `${card.rank}${suitSymbols[card.suit]}` : "Joker"}
                {blocked ? " blocked → 0" : bonus ? ` +1 → ${power}` : ` → ${power}`}
              </li>
            ))}
          </ul>

        </section>
      )}
      {spySelected && <button className="spy-button" onClick={spy}>Spy</button>}
      {doubleAttackSelected && <button className="spy-button" onClick={activateDoubleAttack}>Double Attack</button>}
      {game.extraAttack && !isComputer && <p className="double-attack-status">Double Attack ready · 2 attacks</p>}
      <section className={isMovingOut && !skipAttack ? "player-hand hand-highlighted" : "player-hand"} aria-labelledby="player-hand-heading">
      <div className="player-hand-heading">
        <h2 id="player-hand-heading">Your hand</h2>
        {canToggleHandStack && (
          <button type="button" className="side-panel-toggle" aria-pressed={choosingHandStack}
            onClick={() => setStackFromHand(value => !value)}>Stack from hand</button>
        )}
      </div>
      {choosingHandStack && <p className="touch-stack-hint">Tap a matching hand card, then tap its stack.</p>}
      <div className="hand-row player-hand-row" style={compactBoard ? undefined : handLayout}>
        {game.player.map((card, index) => (
          <button
            key={card.type === "joker" ? card.color : `${card.rank}-${card.suit}`}
            data-card-position={`player-${index}`}
            disabled={tutorialOpening && !canUseHandCard(card)}
            draggable={canDragHandCard(card)}
            onDragStart={canDragHandCard(card) ? event => {
              event.dataTransfer.setData("text/plain", "Hand card");
              event.dataTransfer.effectAllowed = "move";
              draggedCard.current = { from: "hand", card };
            } : undefined}
            onDragEnd={() => { draggedCard.current = null; }}
            onFocus={() => inspect(card)}
            aria-pressed={isShield(card) || isSpecial(card) || (canStackFromHand && (!canDeployFromHand || choosingHandStack || game.selectedStack === card) && hasStackTarget(card)) ? choosingHandCard === card : undefined}
            className={[
              choosingHandCard === card ? "simple-game-selected-shield" : inspected === card ? "card-inspected" : "",
              game.step === "draw" && game.drawnCard === card ? "drawn-hand-card" : "",
              isMovingOut && tutorialDeployment === card ? "tutorial-deploy-card" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              inspect(card);
              if (!canUseHandCard(card)) return;
              if (choosingHandStack) {
                if (hasStackTarget(card)) {
                  setStackFromHand(false);
                  selectFromHand(card, "selectedStack");
                }
                return;
              }
              if (isShield(card)) selectShield(card);
              else if (isSpecial(card)) selectFromHand(card, "selectedSpecial");
              else if (canStackFromHand && !canDeployFromHand && hasStackTarget(card)) selectFromHand(card, "selectedStack");
              else playCard(card);
            }}
            style={{
              padding: 0,
              border: 0,
              borderRadius: "0.5rem",
              background: "#fff",
              cursor: "pointer",
            }}
          >
            <CardFace card={card} />
          </button>
        ))}
      </div>

      </section>
      <div className="match-footer-controls" role="group" aria-label="Match settings">
        <button className="match-footer-button" data-music-toggle aria-label="Music" aria-pressed={music.enabled} onClick={music.toggle}>
          <span className="match-footer-icon" aria-hidden="true">♫</span>
          Music <span className="match-footer-state" aria-hidden="true">{music.enabled ? "On" : "Off"}</span>
        </button>
        <button className="match-footer-button" aria-label="Sound" aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled(enabled => !enabled)}>
          <span className="match-footer-icon" aria-hidden="true">{soundEnabled ? "🔊" : "🔇"}</span>
          Sound <span className="match-footer-state" aria-hidden="true">{soundEnabled ? "On" : "Off"}</span>
        </button>
        <label className="match-footer-button match-footer-timer">
          <input type="checkbox" checked={turnTimerEnabled}
            onChange={event => setTurnTimerEnabled(event.currentTarget.checked)} />
          Turn Timer
        </label>
        <button className="match-footer-button match-footer-home" onClick={onBack}>
          <span className="match-footer-icon" aria-hidden="true">←</span>
          Back to Home
        </button>
      </div>
        </>
      )}
    </main>
  );
}
