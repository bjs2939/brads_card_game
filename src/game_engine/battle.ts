import { canDeploy, dealSimpleGame, ranks } from "./deck.ts";
import type { Card, Suit } from "./types";
import type { GameSound } from "../useGameSound";

export const slotsPerRank = 3;

export const battlefieldSlots = slotsPerRank * 2;

export const rankLanes = { front: [0, 1, 2], back: [3, 4, 5] };

export const turnSteps = { draw: "Draw", "move-up": "Move Up", "move-out": "Move Out", attack: "Attack" };

export const suitAdvantage: Partial<Record<Suit, Suit>> = {
  hearts: "spades",
  spades: "clubs",
  clubs: "hearts",
};

export const suitNames: Record<Suit, string> = {
  hearts: "Hearts", clubs: "Clovers", spades: "Spades", diamonds: "Diamonds",
};

export type Side = "player" | "computer";

export type FieldRank = keyof typeof rankLanes;

export type TurnStep = keyof typeof turnSteps;

export type DraggedCard = { from: "hand"; card: Card } | { from: "field"; index: number };

export type ShieldLayer = { card: Card; revealed: boolean };

export type ShieldTransfer = { source: Card; layer: ShieldLayer };

export type Unit = { card: Card; revealed: boolean; shields?: ShieldLayer[]; fourShieldBroken?: boolean; lane?: number };

export type Field = (Unit | null)[];

export type PlayerMovement = { step: TurnStep } & (
  { kind: "deploy"; card: Card; handIndex: number } |
  { kind: "advance"; cards: Card[]; backLane: number }
);

export type Game = ReturnType<typeof dealSimpleGame> & {
  tutorialRules?: boolean;
  playerField: (Unit | null)[];
  backRankAtTurnStart: Card[];
  movements?: PlayerMovement[];
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
  recoveredDiscard?: { card: Card; side: Side };
  deckWarning?: 0 | 1 | 2 | 3 | 4 | 5 | 10;
  spyFlash?: Card;
  attackAnimation?: { attacker: Card; target: Card; side: Side; kind: "ranger" | "dragon" | "card" | "convert"; shield?: { card?: Card; builtIn?: true }; recruited?: Card[] };
  tutorialCombatReaction?: "joker-blast-reaction" | "enemy-ace-steal" | "enemy-king";
  jokerExplosion?: { turn: number; survived: boolean; attacker: Card };
  selected: number | null;
  selectedShield: Card | null;
  queenAttackTurn?: number;
  extraAttack?: boolean;
  tutorialBlockedAttack?: boolean;
  movingShield?: ShieldTransfer;
  selectedStack: Card | null;
  movingStack: boolean;
  immunityWarningTarget?: number;
  immunityWarningShield?: number;
  pendingAttack?: { attacker: number; target: number; isStack: boolean; choices?: number[][]; victims?: number[]; choosingShield?: true; shieldIndex?: number; convert?: boolean };
  selectedSpecial: Card | null;
  convertSelected?: boolean;
  convertRecovery?: Partial<Record<Side, { turn: number; knights: Card[] }>>;
  sound?: { cue: GameSound; lightning?: boolean };
  specialStrike?: { card: Card; target: Card; attachments: Card[]; kind: "ace" | "king"; side: Side; blocked: boolean; turn: number };
  advantage?: boolean;
  advantageBonus?: number;
  immunity?: { from: Suit; to: Suit | "joker"; label: string };
  result: string;
};

export function labCardName(card: Card) {
  return card.type === "joker" ? `${card.color} Joker` : `${card.rank} of ${card.suit}`;
}

export function cardKey(card: Card) {
  return card.type === "joker" ? `joker-${card.color}-${card.copy ?? 1}` : `${card.rank}-${card.suit}`;
}

export function isNumber(card: Card) {
  return card.type === "standard" && ranks.indexOf(card.rank) <= ranks.indexOf("10");
}

export function isNimble(card: Card) {
  return card.type === "standard" && (card.rank === "2" || card.rank === "3");
}

export function canScurry(card: Card) {
  return card.type === "standard" && card.rank === "3";
}

export function isJack(card: Card): card is Extract<Card, { type: "standard" }> {
  return card.type === "standard" && card.rank === "J";
}

export function isQueen(card: Card) {
  return card.type === "standard" && card.rank === "Q";
}

export function isShield(card: Card) {
  return card.type === "standard" && (card.rank === "J" || card.rank === "Q");
}

export function hasFourShield(unit: Unit) {
  return unit.card.type === "standard" && unit.card.rank === "4" && !unit.fourShieldBroken;
}

export function canShield(unit: Unit | null | undefined) {
  return !!unit && canDeploy(unit.card);
}

export function deploy(card: Card): Unit {
  return { card, revealed: false };
}

export function strength(card: Card) {
  return card.type === "standard" ? ranks.indexOf(card.rank) + 2 : 0;
}

export function canStack(card: Card) {
  return isNumber(card) && strength(card) <= 7;
}

export function matchesStack(card: Card, fieldCard: Card) {
  return card.type === "standard" && fieldCard.type === "standard" &&
    canStack(card) && card.rank === fieldCard.rank;
}

export function isSpecial(card: Card) {
  return card.type === "standard" && (card.rank === "A" || card.rank === "K");
}

export function laneOf(unit: Unit, index: number) {
  return unit.lane ?? index;
}

export function laneCards(field: Field, lane: number) {
  return field.flatMap((unit, index) => unit && laneOf(unit, index) === lane ? [{ unit, index }] : []);
}

export function canMoveIntoStack(game: Game, from: number, to: number) {
  const field = game.playerField;
  const source = field[from];
  const target = field[to];
  if (!source || !target || laneOf(source, from) === laneOf(target, to) ||
      !matchesStack(source.card, target.card)) return false;

  const sourceRank = fieldRank(source, from);
  const targetRank = fieldRank(target, to);
  return (sourceRank === targetRank && (game.step === "move-up" || game.step === "move-out" || game.step === "attack")) ||
    (sourceRank === "back" && targetRank === "front" && game.backRankAtTurnStart?.includes(source.card) === true);
}

export function addToStack(field: Field, unit: Unit, lane: number, sourceIndex?: number): Field {
  const next = [...field];
  while (next.length < battlefieldSlots) next.push(null);
  if (sourceIndex !== undefined) next[sourceIndex] = null;
  const spare = next.findIndex((entry, index) => index >= battlefieldSlots && !entry);
  next[spare === -1 ? next.length : spare] = { ...unit, lane };
  return next;
}

export function fieldRank(unit: Unit, index: number): FieldRank {
  return laneOf(unit, index) < slotsPerRank ? "front" : "back";
}

export function hasBackRankCards(field: Field) {
  return field.some((unit, index) => unit && fieldRank(unit, index) === "back");
}

export function canAttackTarget(attacker: Unit, from: number, field: Field, target: number) {
  const defender = field[target];
  if (!defender || !isNumber(attacker.card)) return false;
  const ranged = attacker.card.type === "standard" && attacker.card.rank === "6";
  const targetRank = fieldRank(defender, target);
  if (fieldRank(attacker, from) === "back") return ranged && targetRank === "front";
  const frontLane = laneOf(defender, target) - slotsPerRank;
  return targetRank === "front" || ranged || laneCards(field, frontLane).length === 0;
}

export function canAttackFrom(attacker: Unit, from: number, field: Field, castleCards: number) {
  return field.some((_, index) => canAttackTarget(attacker, from, field, index)) ||
    (castleCards > 0 && !field.some(Boolean) && isNumber(attacker.card) && fieldRank(attacker, from) === "front");
}

export function visibleConvertRecovery(game: Game, side: Side) {
  const recovery = game.convertRecovery?.[side];
  return recovery && game.turn <= recovery.turn ? recovery : undefined;
}

export function attackRestricted(game: Game, side: Side = "player") {
  return game.convertRecovery?.[side]?.turn === game.turn;
}

export function isRanger(card: Card) {
  return card.type === "standard" && card.rank === "6";
}

export function isHolyKnight(card: Card) {
  return card.type === "standard" && card.rank === "7";
}

export function castleAttackerIndex(game: Game) {
  if (game.phase !== "player" || game.turn <= 2 || game.step === "draw" || attackRestricted(game) ||
      game.pendingAttack || game.movingStack || game.immunityWarningTarget !== undefined ||
      game.attackAnimation || game.specialStrike || game.jokerExplosion || game.recoveredDiscard || game.deckWarning !== undefined ||
      !game.computer.length || game.computerField.some(Boolean)) return -1;

  const canStrikeCastle = (unit: Unit | null, index: number) =>
    !!unit && fieldRank(unit, index) === "front" && isNumber(unit.card);
  const selected = game.selected;
  return selected !== null && canStrikeCastle(game.playerField[selected], selected)
    ? selected : game.playerField.findIndex(canStrikeCastle);
}

export function openLanes(field: Field, rank: FieldRank) {
  return rankLanes[rank].filter(lane => laneCards(field, lane).length === 0);
}

export function canMoveUp(field: Field) {
  return hasBackRankCards(field) && openLanes(field, "front").length > 0;
}

export function canDeployThisPhase(game: Game) {
  return game.phase === "player" && game.step !== "draw" &&
    !game.pendingAttack && !game.specialStrike && !game.jokerExplosion &&
    !game.attackAnimation && !game.recoveredDiscard && game.immunityWarningTarget === undefined;
}

export function hasMoveOutAction(game: Game) {
  return openLanes(game.playerField, "back").length > 0 && game.player.some(canDeploy) ||
    !game.tutorialRules && openLanes(game.playerField, "front").length > 0 && game.player.some(canScurry);
}

export function moveOutOrAttack(game: Game): TurnStep {
  return hasMoveOutAction(game) || attackRestricted(game) ? "move-out" : "attack";
}

export function nextPlayerStep(game: Game): TurnStep | null {
  if (game.turn <= 2) return null;
  if (game.step === "move-up") return moveOutOrAttack(game);
  if (game.step === "move-out" && !attackRestricted(game)) return "attack";
  return null;
}

export function advancePlayerStep(game: Game, next = nextPlayerStep(game)): Game {
  const step = game.phase === "player" && next;
  return step ? {
    ...game, step, selected: null, selectedShield: null, selectedStack: null,
    selectedSpecial: null, movingStack: false, movingShield: undefined,
  } : game;
}

export function hasHandStack(field: Field, card: Card) {
  return field.some((unit, index) =>
    unit && fieldRank(unit, index) === "back" && matchesStack(card, unit.card),
  );
}

export function openingPlaysExhausted(game: Game, tutorial: boolean) {
  if (game.phase !== "player" || game.turn > 2 || game.step !== "move-out") return false;
  const backRankFull = openLanes(game.playerField, "back").length === 0;
  if (tutorial) return backRankFull;
  if (game.turn === 1 && backRankFull) return true;

  const canAttachShield = game.playerField.some(canShield) && game.player.some(isShield);
  return (backRankFull || !hasMoveOutAction(game)) && !canAttachShield && !game.player.some(card => hasHandStack(game.playerField, card));
}

export function deployFromHand(current: Game, card: Card): Game {
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
    movements: recordMovement(current, { kind: "deploy", step: current.step, card, handIndex: current.player.indexOf(card) }),
    playerField: field,
    selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null, movingStack: false, movingShield: undefined,
    result: current.step === "move-up" ? "Card deployed. Skipped to Move Out." : current.result,
    sound: { cue: "play" },
  };
}

export function scurryFromHand(game: Game, card: Card, lane: number): Game {
  if (game.tutorialRules || !canScurry(card) || !game.player.includes(card) ||
      !canDeployThisPhase(game) || !openLanes(game.playerField, "front").includes(lane)) return game;
  const playerField = [...game.playerField];
  playerField[lane] = deploy(card);
  return { ...game, player: game.player.filter(held => held !== card), playerField,
    movements: recordMovement(game, { kind: "deploy", step: game.step, card, handIndex: game.player.indexOf(card) }),
    step: game.step === "move-up" ? "move-out" : game.step,
    selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null,
    movingStack: false, movingShield: undefined, result: "Scurry! The Rat reached the front rank.",
    sound: { cue: "play" } };
}

export function recordMovement(game: Game, movement: PlayerMovement) {
  return [...(game.movements ?? []).slice(-2), movement];
}

export function clearMovementEntries(field: Field, entries: { unit: Unit; index: number }[]): Field {
  const next = [...field];
  for (const { index } of entries) next[index] = null;
  const lanes = new Set(entries.map(({ unit, index }) => laneOf(unit, index)));
  for (const lane of lanes) {
    const lead = laneCards(next, lane)[0];
    if (!next[lane] && lead) {
      next[lead.index] = null;
      next[lane] = { ...lead.unit, lane };
    }
  }
  return next;
}

export function undoPlayerMovement(game: Game): Game {
  const movement = game.movements?.at(-1);
  if (!movement || !canDeployThisPhase(game)) return game;
  const reset = advancePlayerStep(game, movement.step);
  const movements = game.movements?.slice(0, -1);
  if (movement.kind === "deploy") {
    const index = game.playerField.findIndex(unit => unit && cardKey(unit.card) === cardKey(movement.card));
    const unit = game.playerField[index];
    if (!unit) return game;
    const player = [...game.player];
    player.splice(movement.handIndex, 0, unit.card, ...(unit.shields ?? []).map(layer => layer.card));
    return { ...reset, player, movements, playerField: clearMovementEntries(game.playerField, [{ unit, index }]),
      result: unit.shields?.length ? "Deployment undone. The card and its shields returned to your hand." : "Deployment undone." };
  }

  const open = openLanes(game.playerField, "back");
  const lane = open.includes(movement.backLane) ? movement.backLane : open[0];
  if (lane === undefined) return { ...game, result: "Undo requires an empty back-rank slot." };
  const entries = game.playerField.flatMap((unit, index) =>
    unit && fieldRank(unit, index) === "front" && movement.cards.some(card => cardKey(card) === cardKey(unit.card)) ? [{ unit, index }] : []);
  if (entries.length !== movement.cards.length) return game;
  const playerField = clearMovementEntries(game.playerField, entries);
  const [lead, ...rest] = entries;
  playerField[lane] = { ...lead.unit, lane };
  return { ...reset, movements,
    playerField: rest.reduce((field, { unit }) => addToStack(field, unit, lane), playerField), result: "Forward move undone." };
}

export function moveUp(field: Field, from: number, to: number): Field {
  if (!rankLanes.back.includes(from) || !openLanes(field, "front").includes(to)) return field;
  const moving = laneCards(field, from);
  if (!moving.length) return field;
  const next = [...field];
  for (const { index } of moving) next[index] = null;
  const [lead, ...rest] = moving;
  next[to] = { ...lead.unit, lane: to };
  return rest.reduce((result, { unit }) => addToStack(result, unit, to), next);
}

export function rearrangeRank(game: Game, index: number, targetLane: number): Game {
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

export function dropFieldUnit(game: Game, index: number, lane: number, swap = false): Game {
  const unit = game.playerField[index];
  if (!unit || !canDeployThisPhase(game)) return game;
  const entries = laneCards(game.playerField, lane);
  const matching = !swap && entries.find(entry => canMoveIntoStack(game, index, entry.index));
  if (matching) return stackOnto(game, { from: "field", index }, matching.index);
  if (rankLanes[fieldRank(unit, index)].includes(lane)) return rearrangeRank(game, index, lane);
  if (fieldRank(unit, index) === "front" && rankLanes.back.includes(lane))
    return nimbleToBack(game, index, lane);
  return fieldRank(unit, index) === "back" && !entries.length && rankLanes.front.includes(lane)
    ? promoteUnit(game, index, lane) : game;
}

export function nimbleToBack(game: Game, index: number, lane: number): Game {
  const unit = game.playerField[index];
  if (game.tutorialRules || !unit || !isNimble(unit.card) ||
      !canDeployThisPhase(game) || fieldRank(unit, index) !== "front" ||
      !openLanes(game.playerField, "back").includes(lane)) return game;
  const playerField = clearMovementEntries(game.playerField, [{ unit, index }]);
  playerField[lane] = { ...unit, lane };
  return { ...game, playerField, selected: null, movingStack: false,
    result: "Nimble! The troop moved back freely.", sound: { cue: "play" } };
}

export function unstackDestination(field: Field, index: number) {
  const unit = field[index];
  if (!unit || laneCards(field, laneOf(unit, index)).length < 2) return undefined;
  return openLanes(field, fieldRank(unit, index))[0];
}

export function unstackUnit(game: Game, index: number): Game {
  if (!canDeployThisPhase(game)) return game;
  const destination = unstackDestination(game.playerField, index);
  if (destination === undefined) return game;
  const unit = game.playerField[index]!;
  const entries = laneCards(game.playerField, laneOf(unit, index));
  const moving = (entries[0].index === index ? entries.at(-1) : entries.find(entry => entry.index === index))!;
  const playerField = [...game.playerField];
  playerField[moving.index] = null;
  playerField[destination] = { ...moving.unit, lane: destination };
  return { ...game, playerField, selected: null, movingStack: false, result: "Card unstacked." };
}

export function preferredPromotionLane(field: Field, index: number) {
  const unit = field[index];
  if (!unit) return undefined;

  const open = openLanes(field, "front");
  const sourceLane = laneOf(unit, index);
  const cover = open.flatMap(lane => {
    const backLane = lane + slotsPerRank;
    if (backLane === sourceLane) return [];
    const behind = laneCards(field, backLane)[0];
    if (!behind) return [];
    return [{ lane, power: offense(field, behind.index) }];
  }).sort((a, b) => a.power - b.power);

  const ahead = sourceLane - slotsPerRank;
  return cover[0]?.lane ?? (open.includes(ahead) ? ahead : open[0]);
}

export function promoteUnit(game: Game, index: number, lane: number): Game {
  const unit = game.playerField[index];
  if (!unit || game.phase !== "player" || game.step !== "move-up") return game;
  const field = moveUp(game.playerField, laneOf(unit, index), lane);
  if (field === game.playerField) return game;
  return {
    ...game, playerField: field, selected: null,
    movements: recordMovement(game, { kind: "advance", step: game.step, backLane: laneOf(unit, index),
      cards: laneCards(game.playerField, laneOf(unit, index)).map(entry => entry.unit.card) }),
    step: canMoveUp(field) ? game.step : moveOutOrAttack({ ...game, playerField: field }),
    sound: { cue: "play" },
  };
}

export function equipShield(game: Game, card: Card, target: number): Game {
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

export function transferPlayerShield(game: Game, transfer: ShieldTransfer, target: number): Game {
  const unit = game.playerField[target];
  if (!canDeployThisPhase(game) || !unit || !canShield(unit)) return game;
  const { source, layer } = transfer;
  if (unit.card === source) return { ...game, movingShield: undefined };
  const sourceIndex = game.playerField.findIndex(entry => entry?.card === source && entry.shields?.includes(layer));
  if (sourceIndex === -1) return { ...game, movingShield: undefined };
  const playerField = game.playerField.map((entry, slot) => {
    if (!entry) return entry;
    if (slot === sourceIndex) return { ...entry, shields: entry.shields?.filter(shield => shield !== layer) };
    if (slot === target) return { ...entry, shields: [...(entry.shields ?? []), layer] };
    return entry;
  });
  return { ...game, playerField, movingShield: undefined, selected: null, selectedShield: null,
    selectedSpecial: null, selectedStack: null, movingStack: false, result: "Shield moved.", sound: { cue: "shield" } };
}

export function stackOnto(game: Game, source: DraggedCard, target: number): Game {
  const unit = game.playerField[target];
  if (game.phase !== "player" || game.pendingAttack || !unit ||
      game.specialStrike || game.jokerExplosion) return game;
  const lane = laneOf(unit, target);
  let playerField: Field;
  let player = game.player;
  let movements = game.movements;
  if (source.from === "hand") {
    if (fieldRank(unit, target) !== "back" ||
        !matchesStack(source.card, unit.card) || !player.includes(source.card)) return game;
    playerField = addToStack(game.playerField, deploy(source.card), lane);
    movements = recordMovement(game, { kind: "deploy", step: game.step, card: source.card, handIndex: player.indexOf(source.card) });
    player = player.filter(card => card !== source.card);
  } else {
    const moving = game.playerField[source.index];
    if (!moving || !canMoveIntoStack(game, source.index, target)) return game;
    playerField = addToStack(game.playerField, moving, lane, source.index);
    if (fieldRank(moving, source.index) === "back" && fieldRank(unit, target) === "front") {
      movements = recordMovement(game, { kind: "advance", step: game.step, cards: [moving.card], backLane: laneOf(moving, source.index) });
    }
  }
  return {
    ...game, player, playerField, movements, selected: null, selectedStack: null, selectedShield: null,
    movingStack: false, result: "Stack combined its attack power.", sound: { cue: "stack" },
  };
}

export function offense(field: Field, index: number) {
  const unit = field[index];
  if (!unit) return 0;
  return laneCards(field, laneOf(unit, index))
    .reduce((total, entry) => total + strength(entry.unit.card), 0);
}

export function blockedAttack(from: Suit, to: Suit) {
  return { from, to, label: `${suitNames[to]} block ${suitNames[from]}` };
}

export function isSpecialImmune(suit: Suit, target: Card) {
  return target.type === "joker" || suitAdvantage[target.suit] === suit;
}

export function resolveSpecial(game: Game, targetIndex: number, side: Side = "player", special = game.selectedSpecial): Game {
  const targetField = side === "player" ? "computerField" : "playerField";
  const target = game[targetField][targetIndex];
  if (game.phase !== side || attackRestricted(game, side) || special?.type !== "standard" || !isSpecial(special) || !target ||
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
      side, blocked: immune, turn: game.turn,
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

export function attackDefense(field: Field, target: number, defender: Unit, chosenShield?: number) {
  const lane = laneOf(defender, target);
  const entries = laneCards(field, lane);
  const shieldOwner = entries.find(({ index, unit }) => index === target && unit.shields?.length) ??
    entries.find(({ unit }) => unit.shields?.length);
  const layers = shieldOwner?.unit.shields ?? [];
  const shieldIndex = chosenShield ?? layers.length - 1;
  const outer = layers[shieldIndex];
  const protectedCard = shieldOwner?.unit.card ?? defender.card;
  const shielded = defender.card.type !== "joker" && protectedCard.type === "standard" && outer?.card.type === "standard";
  const card: Card = shielded ? { ...protectedCard, suit: outer.card.suit } : defender.card;
  const visibleCard: Card = shielded && !outer.revealed ? { ...protectedCard, suit: "diamonds" } : card;
  return { lane, entries, shieldOwner, layers, outer, shieldIndex, card, visibleCard };
}

export function calculateAttack(field: Field, attackerIndex: number, defender: Card, tutorialRules = false) {
  const attacker = field[attackerIndex];
  const entries = attacker ? laneCards(field, laneOf(attacker, attackerIndex)) : [];
  const parts = entries.map(({ unit: { card } }) => {
    const suitBlocked = card.type === "standard" && defender.type === "standard" &&
      suitAdvantage[defender.suit] === card.suit;
    const rankBlocked = card.type === "standard" && defender.type === "standard" &&
      card.rank === "10" && defender.rank === "2";
    const blocked = suitBlocked || rankBlocked;
    const bonus = !blocked && card.type === "standard" && defender.type === "standard" &&
      (suitAdvantage[card.suit] === defender.suit ||
        !tutorialRules && card.suit === "diamonds" && defender.suit === "diamonds") ? 1 : 0;
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

export function makeAttackAnimation(attacker: Unit, target: Card, side: Side, jokerBlast = false, shield?: NonNullable<Game["attackAnimation"]>["shield"], convert = false): Game["attackAnimation"] {
  const card = attacker.card;
  const kind = convert ? "convert" : isRanger(card) ? "ranger"
    : card.type === "standard" && card.rank === "10" ? "dragon" : "card";
  if (kind === "card" && jokerBlast) return;
  return { attacker: card, target, side, kind, shield };
}

export function stackVictimChoices(attackers: Field, attacker: number, defenders: Field, target: number, convert = false, tutorialRules = false) {
  const defender = defenders[target];
  if (!defender) return [];
  const defense = attackDefense(defenders, target, defender);
  if (defense.entries.length < 2 || defense.outer || defense.entries.some(({ unit }) => hasFourShield(unit))) return [];

  const entries = [...defense.entries].sort((a, b) => Number(b.index === target) - Number(a.index === target));
  let plans = [{ victims: [] as number[], cost: 0, power: Infinity }];
  for (const { unit, index } of entries) {
    const attack = calculateAttack(attackers, attacker, unit.card, tutorialRules);
    if (attack.immune) continue;
    plans = [...plans, ...plans.flatMap(plan => {
      const cost = plan.cost + strength(unit.card);
      const power = Math.min(plan.power, attack.power);
      return cost <= power ? [{ victims: [...plan.victims, index], cost, power }] : [];
    })];
  }
  let options = plans.map(plan => plan.victims);
  const attackingUnit = attackers[attacker];
  if (convert && attackingUnit) {
    const knights = laneCards(attackers, laneOf(attackingUnit, attacker));
    let pairings = [{ victims: [] as number[], used: [] as number[] }];
    for (const { unit: defender, index } of entries) {
      const eligible = knights.filter(({ unit }) => {
        const hit = calculateAttack([unit], 0, defender.card, tutorialRules);
        return !hit.immune && hit.power >= strength(defender.card);
      });
      pairings = [...pairings, ...pairings.flatMap(pairing =>
        eligible.filter(knight => !pairing.used.includes(knight.index)).map(knight => ({
          victims: [...pairing.victims, index],
          used: [...pairing.used, knight.index],
        })),
      )];
    }
    options = [...options, ...pairings.map(pairing => pairing.victims)];
  }
  const most = Math.max(...options.map(victims => victims.length));
  return most ? [...new Map(options.filter(victims => victims.length === most).map(victims => [victims.join(","), victims])).values()] : [];
}

export function resolveAttack(game: Game, side: Side, attackerIndex: number, targetIndex: number, chosenVictims?: number[], chosenShield?: number, convert = false): Game {
  const attackerField = side === "player" ? "playerField" : "computerField";
  const defenderField = side === "player" ? "computerField" : "playerField";
  const attacker = game[attackerField][attackerIndex];
  if (game.phase !== side || attackRestricted(game, side) ||
      !attacker || (convert && !isHolyKnight(attacker.card)) ||
      !canAttackTarget(attacker, attackerIndex, game[defenderField], targetIndex)) {
    return game;
  }

  const victims = chosenVictims ?? stackVictimChoices(game[attackerField], attackerIndex, game[defenderField], targetIndex, convert, game.tutorialRules)[0];
  targetIndex = victims?.[0] ?? targetIndex;
  const defender = game[defenderField][targetIndex]!;
  const blast = defender.card.type === "joker";
  const survivesBlast = blast && attacker.card.type === "standard" && attacker.card.rank === "5";
  const { lane: defenderLane, entries: defendedLane, shieldOwner, layers, outer, shieldIndex, card: defendedCard } =
    attackDefense(game[defenderField], targetIndex, defender, chosenShield);
  const attack = calculateAttack(game[attackerField], attackerIndex, defendedCard, game.tutorialRules);
  const immune = attack.immune;
  const suitImmune = immune && attack.parts.some(part => part.suitBlocked);
  const rankImmune = immune && attack.parts.some(part => part.rankBlocked);
  const attackerWins = !immune && (attack.beatsTen || attack.power >= strength(defendedCard));
  const shieldHit = !blast && attackerWins && outer;
  const survivingShields = shieldHit
    ? layers.filter((_, index) => index !== shieldIndex)
    : defendedLane.length > 1 && chosenShield === undefined ? layers
    : layers.map((layer, index) => index === shieldIndex ? { ...layer, revealed: true } : layer);
  const builtInOwner = !outer && !blast && !immune
    ? defendedLane.find(({ index, unit }) => index === targetIndex && hasFourShield(unit)) ??
      defendedLane.find(({ unit }) => hasFourShield(unit))
    : undefined;
  const fourShieldHit = !!builtInOwner;
  const shieldAnimation = blast ? undefined
    : outer ? { card: convert || shieldHit || survivingShields[shieldIndex]?.revealed ? outer.card : undefined }
    : builtInOwner ? { card: builtInOwner.unit.card, builtIn: true as const } : undefined;
  const defendedUnit = !blast ? shieldOwner?.unit ?? builtInOwner?.unit ?? defender : defender;
  const defeated = blast || (attackerWins && !outer && !fourShieldHit);
  const discarded: Card[] = [];
  if (blast && !survivesBlast) {
    for (const { unit } of laneCards(game[attackerField], laneOf(attacker, attackerIndex))) {
      discarded.push(...(unit.shields ?? []).map(layer => layer.card), unit.card);
    }
  }
  if (shieldHit && !convert) discarded.push(shieldHit.card);
  if (blast) discarded.push(...(defender.shields ?? []).map(layer => layer.card));
  const defeatedSlots = new Set(defeated ? victims ?? [targetIndex] : []);
  const recruited: Card[] = [];
  if (convert && shieldHit) recruited.push(shieldHit.card);
  for (const index of defeatedSlots) {
    const card = game[defenderField][index]!.card;
    if (convert && !blast) recruited.push(card);
    else discarded.push(card);
  }

  const attacking = game[attackerField].map((unit, index) =>
    unit && laneOf(unit, index) === laneOf(attacker, attackerIndex)
      ? (blast && !survivesBlast ? null : { ...unit, revealed: true })
      : unit,
  );
  const defending = game[defenderField].map((unit, index) => {
    if (!unit || defeatedSlots.has(index)) return null;
    if (convert && laneOf(unit, index) === defenderLane) {
      const shields = index === shieldOwner?.index ? survivingShields : unit.shields;
      return { ...unit, shields: shields?.map(layer => ({ ...layer, revealed: true })), revealed: true,
        fourShieldBroken: index === builtInOwner?.index || unit.fourShieldBroken };
    }
    if (index === shieldOwner?.index) {
      return { ...unit, shields: survivingShields, revealed: true };
    }
    if (index === builtInOwner?.index) return { ...unit, fourShieldBroken: true, revealed: true };
    return laneOf(unit, index) === defenderLane ? { ...unit, revealed: true } : unit;
  });
  const nextSide = side === "player" ? "computer" : "player";
  const whoAttacked = side === "player" ? "You attacked" : "The computer attacked";
  const nextRecoveryTurn = game.turn + 2;
  const priorRecovery = game.convertRecovery?.[side];
  const convertRecovery = recruited.length ? {
    ...game.convertRecovery,
    [side]: {
      turn: nextRecoveryTurn,
      knights: [...(priorRecovery?.turn === nextRecoveryTurn ? priorRecovery.knights : []), ...attack.parts.map(part => part.card)],
    },
  } : game.convertRecovery;
  return {
    ...game,
    [attackerField]: attacking,
    [side]: recruited.length ? [...game[side], ...recruited] : game[side],
    convertSelected: undefined,
    convertRecovery,
    [defenderField]: defending,
    discardPile: discarded.length ? [...game.discardPile, ...discarded] : game.discardPile,
    selected: null,
    pendingAttack: undefined,
    attackAnimation: { ...makeAttackAnimation(attacker, defendedUnit.card, side, blast, shieldAnimation, convert),
      recruited: recruited.length ? recruited : undefined },
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
    result: recruited.length ? side === "player"
      ? `Convert! ${recruited.map(labCardName).join(" and ")} joined your hand. You cannot attack next turn.`
      : `Convert! The computer recruited ${recruited.map(labCardName).join(" and ")} and cannot attack next turn.`
      : survivesBlast ? "Joker trap! The 5 survived. The Joker and any decoy shields went to the discard pile."
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

export function health(hand: Card[], field: Field) {
  return hand.length + field.reduce((total, unit) => total + (unit ? 1 + (unit.shields?.length ?? 0) : 0), 0);
}

export function matchOutcome(game: Game) {
  if (game.drawPile.length) return null;
  const playerOut = !game.player.length && !game.playerField.some(Boolean);
  const computerOut = !game.computer.length && !game.computerField.some(Boolean);
  if (playerOut && computerOut) return "draw";
  if (playerOut) return "defeat";
  if (computerOut) return "victory";
  return null;
}

export function playerStepAfterDraw(game: Game): TurnStep {
  if (game.turn <= 2) return "move-out";
  return canMoveUp(game.playerField) ? "move-up" : moveOutOrAttack(game);
}

export function isCollectorCard(card: Card) {
  return card.type === "standard" && card.rank === "3";
}

export function isCollector(unit: Unit | null): unit is Unit {
  return !!unit && isCollectorCard(unit.card);
}

export function revealCollectors(field: Field): Field {
  return field.map(unit => isCollector(unit) && !unit.revealed ? { ...unit, revealed: true } : unit);
}

export function hasGarbageCollection(field: Field) {
  return field.filter(unit => isCollector(unit) && unit.revealed).length >= 3;
}

export function drawForTurn(game: Game, side: "player" | "computer"): Game {
  const collector = side === "player" ? "computer" : "player";
  const field = collector === "player" ? game.playerField : game.computerField;
  // Discards are appended chronologically, so index zero is the bottom of the pile.
  const [oldest, ...remainingDiscards] = game.discardPile;
  if (game.turn > 0 && oldest && hasGarbageCollection(field)) {
    const actor = collector === "player" ? "You recovered" : "The computer recovered";
    game = {
      ...game,
      [collector]: [...game[collector], oldest],
      discardPile: remainingDiscards,
      recoveredDiscard: { card: oldest, side: collector },
      result: [game.result, `Garbage Collection: ${actor} ${labCardName(oldest)} from the bottom of the discard pile.`]
        .filter(Boolean).join(" "),
    };
  }
  if (matchOutcome(game)) return game;
  const [card, ...drawPile] = game.drawPile;
  const backRankAtTurnStart = side === "player"
    ? game.playerField.flatMap((unit, index) => unit && fieldRank(unit, index) === "back" ? [unit.card] : [])
    : [];
  const turn = { ...game, turn: game.turn + 1, step: "draw" as const, backRankAtTurnStart, movements: undefined };
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

export function hasNoAttackOptions(game: Game) {
  if (game.turn > 2 && game.player.some(isSpecial)) return false;

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

export function hasOnlyJoker(game: Game) {
  const remaining = [...game.player, ...game.playerField.flatMap(unit =>
    unit ? [unit.card, ...(unit.shields ?? []).map(layer => layer.card)] : []
  )];
  return remaining.length === 1 && remaining[0].type === "joker";
}

export function finishPlayerTurn(game: Game): Game {
  if (game.phase !== "player" || game.pendingAttack || game.specialStrike) return game;
  return drawForTurn({
    ...game, phase: "computer", extraAttack: false, selected: null, selectedShield: null, selectedStack: null,
    selectedSpecial: null, movingStack: false, movingShield: undefined, result: "", advantage: false, immunity: undefined,
  }, "computer");
}

export function useShieldAbility(game: Game, card: Card): Game {
  if (!canDeployThisPhase(game) || attackRestricted(game) || game.turn <= 2 || game.deckWarning !== undefined) return game;
  const owner = game.playerField.findIndex(unit => unit?.shields?.some(layer => layer.card === card));
  const inHand = game.player.includes(card);
  if (!inHand && owner < 0) return game;
  if (isJack(card) ? !game.computerField.some(Boolean) : !isQueen(card) || game.queenAttackTurn === game.turn) return game;
  const spent = {
    ...game,
    player: inHand ? game.player.filter(held => held !== card) : game.player,
    playerField: owner < 0 ? game.playerField : game.playerField.map((unit, index) =>
      unit && index === owner ? { ...unit, shields: unit.shields?.filter(layer => layer.card !== card) } : unit),
    discardPile: [...game.discardPile, card],
    selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null, movingStack: false, movingShield: undefined,
  };
  if (isQueen(card)) return {
    ...spent, extraAttack: true, queenAttackTurn: game.turn,
    result: "Double Attack activated. You can attack twice this turn.", sound: { cue: "play" },
  };
  if (!isJack(card)) return game;

  let revealed = 0;
  const reveal = <T extends { card: Card; revealed: boolean }>(entry: T): T => {
    if (entry.revealed || isSpecialImmune(card.suit, entry.card)) return entry;
    revealed++;
    return { ...entry, revealed: true };
  };
  const computerField = spent.computerField.map(unit => unit && (
    !game.tutorialRules && unit.card.type === "standard" && unit.card.rank === "5"
      ? unit : { ...reveal(unit), shields: unit.shields?.map(reveal) }));
  return {
    ...spent, computerField, phase: "computer", movements: undefined, extraAttack: false,
    result: revealed ? `Spy revealed ${revealed} ${revealed === 1 ? "card" : "cards"}. Turn ended.`
      : "Spy found no cards it could reveal. Turn ended.",
    spyFlash: card, sound: { cue: "spy" },
  };
}

export function continueDoubleAttack(game: Game): Game {
  return {
    ...game, movements: undefined, phase: "player", step: "attack", extraAttack: false, selected: null, selectedSpecial: null,
    result: `${game.result} Double Attack: one attack left.`,
  };
}

export function finishPlayerAttack(game: Game): Game {
  game = { ...game, movements: undefined };
  if (game.extraAttack && !matchOutcome(game)) {
    return continueDoubleAttack(game);
  }
  return drawForTurn({ ...game, extraAttack: false }, "computer");
}
