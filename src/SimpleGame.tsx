import type { FriendAction, FriendOpeningView } from "./FriendLobby";
import { TutorialBattleDialogue, tutorialLessons } from "./TutorialIntro";
import { useCallback, useEffect, useRef, useState } from "react";
import CardFace, { BattlePiece } from "./CardFace";
import { Feedback, gameVersion } from "./PlaytestPanels";
import { sandboxRetreatPlan, saveMatch } from "./playtest";
import { useCardMotion } from "./useCardMotion";
import { useAudioForeground, useGameSound } from "./useGameSound";
import MatchCoin, { COIN_FLIP_MS } from "./MatchCoin";
import "./SimpleGame.css";
import { canDeploy, createFullDeck, createTutorialDeck, dealSimpleGame, shuffleDeck, tutorialDeploymentRanks } from "./game_engine/deck";
import type { Card, Suit } from "./game_engine/types";
import {
  slotsPerRank, rankLanes, turnSteps, suitAdvantage, suitNames,
  labCardName, cardKey, isNumber, isJack, isQueen,
  isShield, hasFourShield, canShield, deploy, strength,
  canStack, matchesStack, isSpecial, laneOf, laneCards,
  canMoveIntoStack, addToStack, fieldRank, hasBackRankCards, canAttackTarget,
  canAttackFrom, attackRestricted, isRanger, isHolyKnight, castleAttackerIndex,
  openLanes, canMoveUp, canDeployThisPhase, hasMoveOutAction, moveOutOrAttack,
  nextPlayerStep, advancePlayerStep, hasHandStack, openingPlaysExhausted, recordMovement,
  undoPlayerMovement, moveUp, rearrangeRank, preferredPromotionLane, promoteUnit,
  equipShield, transferPlayerShield, stackOnto, offense, isSpecialImmune,
  resolveSpecial, attackDefense, calculateAttack, makeAttackAnimation, stackVictimChoices,
  resolveAttack, health, matchOutcome, playerStepAfterDraw, isCollectorCard,
  isCollector, revealCollectors, hasGarbageCollection, drawForTurn, hasNoAttackOptions,
  hasOnlyJoker, finishPlayerTurn, finishPlayerAttack, type Side, type FieldRank,
  type DraggedCard, type ShieldLayer, type ShieldTransfer, type Unit, type Field,
  type Game,
} from "./game_engine/battle";

export const simpleVersionTitle = "Brad's Card Game";

const labCards = createFullDeck();
const labZones = {
  player: "Your hand", computer: "Opponent hand", playerField: "Your battlefield", computerField: "Opponent battlefield",
} as const;
type LabZone = keyof typeof labZones;

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

function isTutorialFive(card: Card) {
  return card.type === "standard" && card.rank === "5" && card.suit === "spades";
}

function isTutorialSeven(card: Card) {
  return card.type === "standard" && card.rank === "7" && card.suit === "spades";
}

function isTutorialSix(card: Card) {
  return card.type === "standard" && card.rank === "6" && card.suit === "hearts";
}

function isTutorialFour(card: Card) {
  return card.type === "standard" && card.rank === "4" && card.suit === "hearts";
}

function isTutorialTwo(card: Card) {
  return card.type === "standard" && card.rank === "2" && card.suit === "hearts";
}

function isTutorialJack(card: Card) {
  return card.type === "standard" && card.rank === "J" && card.suit === "spades";
}

function isTutorialReserve(card: Card) {
  return card.type === "standard" && card.rank === "8" && card.suit === "clubs";
}

function isTutorialEnemyThree(card: Card) {
  return card.type === "standard" && card.rank === "3" && card.suit === "clubs";
}

function isTutorialEnemyFive(card: Card) {
  return card.type === "standard" && card.rank === "5" && card.suit === "diamonds";
}

function isTutorialEnemyRanger(card: Card) {
  return card.type === "standard" && card.rank === "6" && card.suit === "clubs";
}

function isTutorialEnemyFour(card: Card) {
  return card.type === "standard" && card.rank === "4" && card.suit === "spades";
}

function isTutorialEnemySeven(card: Card) {
  return card.type === "standard" && card.rank === "7" && card.suit === "hearts";
}

function isTutorialNine(card: Card) {
  return card.type === "standard" && card.rank === "9" && card.suit === "hearts";
}

function isTutorialEnemyNine(card: Card) {
  return card.type === "standard" && card.rank === "9" && card.suit === "spades";
}

function isTutorialReinforcement(card: Card) {
  return isTutorialNine(card) || (card.type === "standard" && card.rank === "8" && card.suit === "spades");
}

function isTutorialReadyTroop(card: Card) {
  return card.type === "standard" && ((card.rank === "10" && card.suit === "clubs") ||
    (card.rank === "4" && card.suit === "diamonds"));
}

function isTutorialEnemyEight(card: Card) {
  return card.type === "standard" && card.rank === "8" && card.suit === "hearts";
}

function isTutorialClubDragon(card: Card) {
  return card.type === "standard" && card.rank === "10" && card.suit === "clubs";
}

function isTutorialHeartDragon(card: Card) {
  return card.type === "standard" && card.rank === "10" && card.suit === "hearts";
}

function isTutorialDiamondJack(card: Card) {
  return card.type === "standard" && card.rank === "J" && card.suit === "diamonds";
}

function isTutorialDragon(card: Card) {
  return card.type === "standard" && card.rank === "10" && card.suit === "diamonds";
}

function tutorialCoveredLane(field: Field, lane: number) {
  return rankLanes.back.includes(lane) && laneCards(field, lane - slotsPerRank).length > 0;
}

function tutorialFormationReady(field: Field) {
  return field.filter((unit, index) =>
    unit && fieldRank(unit, index) === "front" && unit.card.type === "standard" &&
    (unit.card.rank === "4" || isTutorialFive(unit.card))
  ).length === 2;
}

function chooseComputerSpecial(game: Game, hasRegularAttack: boolean, allowBlindPlay = true) {
  const canDevelopField = game.computerField.some(Boolean) || game.computer.some(canDeploy);
  const mayBlindPlay = allowBlindPlay && !hasRegularAttack && !canDevelopField;
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

function chooseComputerAttack(game: Game, difficulty: Difficulty, roll: number, requireProductive = difficulty === "Hard") {
  const options = game.computerField.flatMap((unit, attacker) => {
    if (!unit || !canAttackFrom(unit, attacker, game.playerField, game.player.length)) return [];
    const power = offense(game.computerField, attacker);
    if (!game.playerField.some(Boolean)) return [{ attacker, target: -1, power, tacticalScore: 4 }];

    return game.playerField.flatMap((defender, target) => {
      if (!defender || !canAttackTarget(unit, attacker, game.playerField, target)) return [];
      // Hidden identities never affect the decision. Favor proven hits over high-power blind attacks.
      if (requireProductive && !defender.revealed) {
        return power >= 8 ? [{ attacker, target, power, tacticalScore: 3 + Math.min(power, 20) / 100 }] : [];
      }
      // Score face-down targets using only the computer's own attack power.
      let score = 2 + Math.min(power, 20) / 20;
      if (defender.revealed) {
        const defense = attackDefense(game.playerField, target, defender);
        const attack = calculateAttack(game.computerField, attacker, defense.visibleCard);
        const shielded = defense.outer || defense.entries.some(({ unit }) => unit.revealed && hasFourShield(unit));
        if (defender.card.type === "joker") {
          score = unit.card.type === "standard" && unit.card.rank === "5" ? 8 : -2;
        } else if (defense.outer && !defense.outer.revealed) {
          if (requireProductive) {
            const owner = defense.shieldOwner?.unit;
            if (!owner?.revealed || owner.card.type !== "standard") return [];
            const protectedCard = owner.card;
            const guaranteed = (Object.keys(suitNames) as Suit[]).every(suit => {
              const hypothetical = { ...protectedCard, suit };
              const hit = calculateAttack(game.computerField, attacker, hypothetical);
              return !hit.immune && (hit.beatsTen || hit.power >= strength(hypothetical));
            });
            if (!guaranteed) return [];
            score = 4;
          } else {
            score = attack.power >= strength(defense.visibleCard) ? 3 : 0;
          }
        } else if (attack.immune) {
          score = -3;
        } else if (attack.beatsTen || attack.power >= strength(defense.card)) {
          score = shielded ? 4 : 6 + strength(defender.card) / 2;
        } else {
          score = 0;
        }
      }
      if (requireProductive && score < 4) return [];
      const rearRanger = difficulty === "Hard" && isRanger(unit.card) && fieldRank(unit, attacker) === "back";
      return [{ attacker, target, power, tacticalScore: score + (rearRanger ? 0.5 : 0) }];
    });
  });

  const score = (option: typeof options[number]) => difficulty === "Hard" ? option.tacticalScore : option.power;
  const attack = (difficulty === "Easy" || difficulty === "Sandbox") ? options[Math.floor(roll * options.length)]
    : options.reduce<typeof options[number] | undefined>(
        (best, option) => !best || score(option) > score(best) ? option : best, undefined
      );
  return { attack, hasProductiveAttack: options.some(option => option.tacticalScore >= 4) };
}

function shouldComputerConvert(game: Game, difficulty: Difficulty, attacker: number, target: number, roll: number) {
  if (difficulty !== "Normal" && difficulty !== "Hard") return false;
  const knight = game.computerField[attacker];
  const defender = game.playerField[target];
  if (!knight || !isHolyKnight(knight.card) || !defender?.revealed || !isNumber(defender.card)) return false;
  const defense = attackDefense(game.playerField, target, defender);
  if (defense.outer || defense.entries.some(({ unit }) => unit.revealed && hasFourShield(unit))) return false;
  if (defense.entries.some(({ unit }) => !unit.revealed)) return false;
  const attack = calculateAttack(game.computerField, attacker, defense.card);
  const value = strength(defender.card);
  if (attack.immune || attack.power < value) return false;
  if (difficulty === "Normal") return value >= 5 && roll < 0.35;
  // Giving up next turn's offense is costly when the opponent still has strong attackers.
  const enemyThreat = game.playerField.some(unit => unit?.revealed && unit !== defender &&
    (isNumber(unit.card) && strength(unit.card) >= 8));
  return value >= 7 || (value === 6 && !enemyThreat && game.computerField.filter(Boolean).length >= 3);
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

function startGame(tutorial = false, starter: Side = "player", jokerCount = 4, deal?: ReturnType<typeof dealSimpleGame>): Game {
  const opening: Game = {
    ...(deal ?? dealSimpleGame(tutorial ? createTutorialDeck() : shuffleDeck(createFullDeck(jokerCount)))),
    playerField: [],
    backRankAtTurnStart: [],
    computerField: [],
    discardPile: [],
    phase: tutorial ? "player" : starter,
    step: "move-out",
    round: { id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, at: Date.now() },
    turn: 1,
    drewCard: false,
    selected: null,
    result: "",
    selectedShield: null,
    selectedStack: null,
    selectedSpecial: null,
    movingStack: false,
  };
  return tutorial ? drawForTurn({ ...opening, turn: 0 }, "player") : opening;
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
      case "3": abilities.push("Garbage Collection: three revealed 3s on your field recover the oldest discarded card at the end of your turn."); break;
      case "4": abilities.push("Built-in shield: absorbs the first non-immune regular hit."); break;
      case "5": abilities.push("Joker immunity: survives a Joker trap without losing its shields."); break;
      case "6": abilities.push("Range: 2. Attack the enemy front rank from your back rank, or reach the enemy back rank from your front rank past occupied slots."); break;
      case "7": abilities.push("Convert: reveal the target stack and its shields. Win to recruit the defender or the shield you broke into your hand. A successful recruit locks your next turn’s offensive actions."); break;
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

function LegendaryLightning() {
  const bolt = "M114 0 129 48 102 93 135 133 108 183 139 215 118 260 127 291 120 320";
  return (
    <svg className="legendary-lightning" viewBox="0 0 240 400" aria-hidden="true">
      <g className="legendary-lightning-bolt">
        <path className="legendary-lightning-branches" d="M129 48 159 37 175 11 M102 93 77 73 51 79 25 61 M135 133 168 113 196 123 216 107 M108 183 74 168 51 188 16 190 M139 215 167 220 191 199 223 208 M118 260 89 239 59 247 M127 291 153 268 180 271 204 256" />
        <path className="legendary-lightning-glow" d={bolt} />
        <path className="legendary-lightning-rim" d={bolt} />
        <path className="legendary-lightning-core" d={bolt} />
      </g>
      <g className="legendary-lightning-impact">
        <path d="M120 320 92 306 62 309 M120 320 105 288 83 272 M120 320 146 296 174 290 M120 320 157 322 190 312 M120 320 139 340 174 348 M120 320 91 338 58 344" />
        <circle cx="120" cy="320" r="12" />
      </g>
      <ellipse className="legendary-lightning-wave" cx="120" cy="320" rx="72" ry="23" />
    </svg>
  );
}

function hasRevealEffect(card: Card | undefined): card is Card {
  return card?.type === "standard" && (card.rank === "9" || card.rank === "10");
}

function BattlefieldRevealEffect({ card }: { card: Card }) {
  if (card.type !== "standard") return null;
  return card.rank === "10"
    ? <span className="dragon-summon" aria-hidden="true"
        style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/effects/dragon-summon.png)` }} />
    : <LegendaryLightning />;
}

function BattlefieldRow({ units, label, rank, opponent = false, selected, onPick, canPick, onPickEmpty, canDrag, onDrag, onDragEnd, onDrop, onDropEmpty, onInspect, inspected, onDoublePick, highlighted = false, highlightRanged = false, moveGuide, onTouchRearrange, revealedEffectCards, onPickShield, movingShield, recoveringKnights, shieldDropTarget, allowShieldDrop, allowRangerPromotion, onMoveShieldTo, onStartShieldDrag }: {
  onInspect?: (card: Card | null) => void;
  inspected?: Card | null;
  units: Field;
  revealedEffectCards?: readonly Card[];
  onPickShield?: (index: number, layer: ShieldLayer) => void;
  onMoveShieldTo?: (index: number) => void;
  onStartShieldDrag?: (event: React.PointerEvent<HTMLElement>, transfer: ShieldTransfer) => void;
  movingShield?: Game["movingShield"];
  recoveringKnights?: readonly Card[];
  shieldDropTarget?: number;
  allowShieldDrop?: boolean;
  allowRangerPromotion?: boolean;
  label: string;
  rank: FieldRank;
  onPickEmpty?: (lane: number) => void;
  canDrag?: (index: number) => boolean;
  onDrag?: (index: number) => void;
  onDragEnd?: () => void;
  onDrop?: (index: number, rearrange: boolean) => void;
  onDropEmpty?: (lane: number) => void;
  onTouchRearrange?: (index: number, lane: number) => void;
  opponent?: boolean;
  selected?: number | null;
  onPick?: (index: number) => void;
  onDoublePick?: (index: number) => void;
  highlighted?: boolean;
  highlightRanged?: boolean;
  moveGuide?: { from: number; to: number; label: string };
  canPick?: (unit: Unit, index: number) => boolean;
}) {
  const touchDrag = useRef<{ id: number; index: number; x: number; y: number; moved: boolean } | null>(null);
  const suppressTouchClick = useRef(false);
  const [touchPreview, setTouchPreview] = useState<{ index: number; x: number; y: number; lane?: number } | null>(null);

  function touchLane(event: React.PointerEvent<HTMLDivElement>, index: number) {
    const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-field-lane]");
    if (!slot) return undefined;
    const unit = units[index];
    const movingRangerUp = allowRangerPromotion && unit && isRanger(unit.card) &&
      slot.matches(".field-slot") && slot.closest('[data-player-rank="front"]');
    return event.currentTarget.contains(slot) || movingRangerUp ? Number(slot.dataset.fieldLane) : undefined;
  }

  function finishTouchDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = touchDrag.current;
    if (!drag || drag.id !== event.pointerId) return;
    touchDrag.current = null;
    setTouchPreview(null);
    if (!drag.moved) return;
    suppressTouchClick.current = true;
    if (event.type !== "pointerup") return;
    const lane = touchLane(event, drag.index);
    if (lane !== undefined) onTouchRearrange?.(drag.index, lane);
  }

  const touchedUnit = touchPreview && units[touchPreview.index];
  return (
    <div role="group" aria-label={label} data-player-rank={opponent ? undefined : rank} className={`battlefield-rank ${opponent ? "enemy-rank" : "player-rank"}${highlighted ? " rank-highlighted" : ""}`}
      onPointerDownCapture={() => { suppressTouchClick.current = false; }}
      onPointerMove={event => {
        const drag = touchDrag.current;
        if (!drag || drag.id !== event.pointerId) return;
        if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
        drag.moved = true;
        setTouchPreview({ index: drag.index, x: event.clientX, y: event.clientY, lane: touchLane(event, drag.index) });
      }}
      onPointerUp={finishTouchDrag}
      onPointerCancel={finishTouchDrag}
      onLostPointerCapture={finishTouchDrag}
      onClickCapture={event => {
        if (!suppressTouchClick.current || event.detail === 0) return;
        suppressTouchClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}>
      {touchPreview && touchedUnit && (
        <div className="field-touch-preview" aria-hidden="true" style={{ left: touchPreview.x, top: touchPreview.y }}>
          <CardFace card={touchedUnit.card} faceDown={!touchedUnit.revealed} />
        </div>
      )}
      <p>{label}</p>
      <div style={battlefieldLayout}>
        {rankLanes[rank].map(lane => {
          const entries = laneCards(units, lane);
          if (!entries.length) {
            const arrow = moveGuide?.to === lane ? (moveGuide.from < lane ? "→" : "←") : undefined;
            const guide = arrow && <span className="cover-move-arrow" aria-hidden="true">{arrow}</span>;
            const dropProps = onDropEmpty ? {
              onDragOver: (event: React.DragEvent) => event.preventDefault(),
              onDrop: (event: React.DragEvent) => { event.preventDefault(); onDropEmpty(lane); },
            } : {};
            return (
              onPickEmpty ? (
                <button key={lane} data-field-lane={lane} data-touch-target={touchPreview?.lane === lane || undefined} className={`field-slot field-slot-open${arrow ? " cover-move-target" : ""}`} {...dropProps} onClick={() => onPickEmpty(lane)}>
                  {guide}
                  Move Here
                </button>
              ) : <div key={lane} data-field-lane={lane} data-touch-target={touchPreview?.lane === lane || undefined} className={`field-slot${arrow ? " cover-move-target" : ""}`} {...dropProps}
                aria-label={arrow ? moveGuide?.label : "Empty slot"}>{guide}</div>
            );
          }

          return (
            <div key={lane} data-field-lane={lane} data-touch-target={touchPreview?.lane === lane || undefined} className="simple-game-stack">
              <div className="simple-game-stack-cards">
                {entries.map(({ unit, index }) => {
                  const faceDown = !unit.revealed;
                  const recovering = recoveringKnights?.includes(unit.card);
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
                    </>
                  );
                  const ShieldControl = onPickShield ? "button" : "span";
                  const shields = shieldLayers.length > 0 && (
                    <span
                      className={separateShields ? "attached-shields attached-shields-separate" : "attached-shields"}
                      style={separateShields ? { paddingTop: `${(shieldLayers.length - 1) * 0.38}rem` } : undefined}
                    >
                      {shieldLayers.map((layer, layerIndex, layers) => (
                        <ShieldControl
                          key={layer.card.type === "standard" ? `${layer.card.rank}-${layer.card.suit}` : layerIndex}
                          className="simple-game-shield-card"
                          type={onPickShield ? "button" : undefined}
                          aria-label={onPickShield ? `Move ${labCardName(layer.card)} shield` : undefined}
                          aria-pressed={onPickShield ? movingShield?.layer === layer : undefined}
                          onClick={onPickShield ? () => onPickShield(index, layer) : undefined}
                          onPointerDown={onStartShieldDrag ? event => onStartShieldDrag(event, { source: unit.card, layer }) : undefined}
                          style={{ bottom: `${(layers.length - layerIndex - 1) * 0.38}rem` }}
                          data-card-position={`${opponent ? "computerField" : "playerField"}-shield-${index}-${layerIndex}`}
                        >
                          <span className="simple-game-shield-art">
                            <CardFace card={layer.revealed ? layer.card : undefined} faceDown={!layer.revealed} attachedShield />
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
                        </ShieldControl>
                      ))}
                    </span>
                      );
                  return (
                    <div
                      key={cardKey(unit.card)}
                      className={`simple-game-stack-card${horizontalFour ? " is-horizontal" : ""}${separateShields ? " has-separate-shields" : ""}`}
                      data-card-position={`${opponent ? "computerField" : "playerField"}-${index}`}
                      data-convert-recovering={recovering || undefined}
                      data-shield-drop-slot={allowShieldDrop && canShield(unit) ? index : undefined}
                      data-shield-drop-target={shieldDropTarget === index || undefined}
                      onDragOver={onDrop ? event => event.preventDefault() : undefined}
                      onDrop={onDrop ? event => { event.preventDefault(); onDrop(index, event.shiftKey); } : undefined}
                    >
                      {revealedEffectCards?.includes(unit.card) && <BattlefieldRevealEffect card={unit.card} />}
                      {pickable || onInspect ? (
                        <button
                          data-touch-rearrange={onTouchRearrange && canDrag?.(index) ? true : undefined}
                          data-touch-ranger-up={allowRangerPromotion && isRanger(unit.card) || undefined}
                          onPointerDown={event => {
                            if (event.pointerType !== "touch" || !event.isPrimary || !onTouchRearrange || !canDrag?.(index)) return;
                            touchDrag.current = { id: event.pointerId, index, x: event.clientX, y: event.clientY, moved: false };
                            event.currentTarget.setPointerCapture(event.pointerId);
                          }}
                          draggable={canDrag?.(index) ?? false}
                          onDragStart={onDrag ? event => {
                            event.dataTransfer.setData("text/plain", "Battlefield card");
                            event.dataTransfer.effectAllowed = "move";
                            onDrag(index);
                          } : undefined}
                          onDragEnd={onDragEnd}
                          className={[
                            movingShield && movingShield.source !== unit.card && canShield(unit) ? "shield-receiver" : "",
                            visible && visible === inspected ? "card-inspected" : "",
                            highlightRanged && unit.card.type === "standard" && unit.card.rank === "6" ? "ranged-attacker" : "",
                          ].filter(Boolean).join(" ")}
                          onFocus={() => onInspect?.(visible)}
                          onClick={() => {
                            onInspect?.(visible);
                            if (onMoveShieldTo && canShield(unit)) onMoveShieldTo(index);
                            else if (pickable) onPick?.(index);
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
                      {shields}
                      {recovering && <span className="recovering-knight-label">Recovering</span>}
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

export default function SimpleGame({ difficulty, trainingGrounds = false, tutorial = false, tutorialAudio = null, friendOpening, onFriendMove, onBack, music, onResultChange, onGarbageMusicChange }: {
  difficulty: Difficulty;
  trainingGrounds?: boolean;
  tutorial?: boolean;
  tutorialAudio?: AudioContext | null;
  friendOpening?: FriendOpeningView;
  onFriendMove?: (action: FriendAction, index?: number, target?: number, shieldIndex?: number) => Promise<void>;
  onBack: () => void;
  music: { enabled: boolean; toggle: () => void; setDucked: (ducked: boolean) => void };
  onResultChange: (visible: boolean) => void;
  onGarbageMusicChange: (active: boolean) => void;
}) {
  const [game, setGame] = useState(() => friendOpening ? startGame(false, friendOpening.goesFirst ? "player" : "computer", 0, {
    player: friendOpening.hand, computer: new Array<Card>(friendOpening.opponentCardCount),
    drawPile: new Array<Card>(friendOpening.deckCount),
  }) : startGame(tutorial));
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendError, setFriendError] = useState("");
  const [friendShield, setFriendShield] = useState<number | null>(null);
  const [friendStack, setFriendStack] = useState<number | null>(null);
  const [friendSpecial, setFriendSpecial] = useState<number | null>(null);
  const friendAttackMode = useRef<"attack" | "convert">("attack");
  const friendCanAct = !!friendOpening?.canAct && !friendBusy;

  useEffect(() => {
    if (!friendOpening) return;
    setFriendShield(null);
    setFriendSpecial(null);
    setFriendStack(null);
    const hiddenCard: Card = { type: "joker", color: "black" };
    setGame(current => ({
      ...current,
      player: friendOpening.hand,
      computer: new Array<Card>(friendOpening.opponentCardCount),
      drawPile: new Array<Card>(friendOpening.deckCount),
      phase: friendOpening.canAct ? "player" : "computer",
      turn: friendOpening.turn,
      step: friendOpening.step ?? "move-out",
      selected: null, pendingAttack: undefined,
      discardPile: friendOpening.discardPile ?? [], result: friendOpening.result ?? "",
      attackAnimation: friendOpening.attack && Date.now() - friendOpening.attack.at < 5000 ? friendOpening.attack : undefined,
      recoveredDiscard: friendOpening.recoveredDiscard,
      convertRecovery: friendOpening.recovery ? { player: { turn: friendOpening.turn, knights: friendOpening.ownField?.flatMap(unit =>
        unit && isHolyKnight(unit.card) && unit.revealed ? [unit.card] : []) ?? [] } } : undefined,
      playerField: friendOpening.ownField ?? [null, null, null, ...friendOpening.deployed.map((card, lane) => ({
        ...deploy(card), shields: friendOpening.shields?.[lane],
      }))],
      computerField: friendOpening.enemyField?.map((unit, slot) => unit && ({
        ...unit, card: unit.card ?? { ...hiddenCard, copy: slot + 1 },
        shields: unit.shields?.map(layer => ({ ...layer, card: layer.card ?? hiddenCard })),
      })) ?? [null, null, null, ...Array.from({ length: friendOpening.opponentDeployed }, (_, lane) => ({ ...deploy(hiddenCard),
        shields: Array.from({ length: friendOpening.opponentShieldCounts?.[lane] ?? 0 }, () => ({ card: hiddenCard, revealed: false })),
      }))],
    }));
  }, [friendOpening]);

  async function sendFriendMove(action: FriendAction, index?: number, target?: number, shieldIndex?: number) {
    if (!friendCanAct || !onFriendMove || game.attackAnimation || game.recoveredDiscard) return;
    setFriendBusy(true);
    setFriendError("");
    try { await onFriendMove(action, index, target, shieldIndex); }
    catch (error) { setFriendError(error instanceof Error ? error.message : "Could not send the move."); }
    finally { setFriendBusy(false); }
  }

  useEffect(() => {
    if (!friendOpening?.canAct || friendOpening.turn > 2 || friendBusy || friendError ||
        !friendOpening.ownField || openLanes(friendOpening.ownField, "back").length ||
        !openingPlaysExhausted({ ...game, phase: "player", step: "move-out", turn: friendOpening.turn,
          player: friendOpening.hand, playerField: friendOpening.ownField }, false)) return;
    const timer = window.setTimeout(() => void sendFriendMove("end-turn"), 450);
    return () => window.clearTimeout(timer);
  }, [friendOpening, friendBusy, friendError]);

  const needsGameSetup = !tutorial && !trainingGrounds && !friendOpening;
  const [setupPending, setSetupPending] = useState(needsGameSetup);
  const [firstTurn, setFirstTurn] = useState<Side | "flip">("flip");
  const [jokerCount, setJokerCount] = useState(4);
  const [flipWinner, setFlipWinner] = useState<Side | null>(null);
  const [coinFlipping, setCoinFlipping] = useState(false);
  useEffect(() => {
    if (!coinFlipping) return;
    const timer = window.setTimeout(() => setCoinFlipping(false), COIN_FLIP_MS);
    return () => window.clearTimeout(timer);
  }, [coinFlipping]);
  const setupDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = setupDialog.current;
    if (setupPending && dialog && !dialog.open) dialog.showModal();
    if (!setupPending && dialog?.open) dialog.close();
  }, [setupPending]);

  function startConfiguredMatch() {
    if (coinFlipping) return;
    const starter = firstTurn === "flip" ? flipWinner : firstTurn;
    if (!starter) {
      setFlipWinner(Math.random() < 0.5 ? "player" : "computer");
      setCoinFlipping(true);
      return;
    }
    setGame(startGame(false, starter, jokerCount));
    setSetupPending(false);
  }

  const [matchTips, setMatchTips] = useState(() => shuffleDeck(opponentTips));
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
  const tutorialDuel = tutorial && game.turn === 3 && game.phase === "player";
  const tutorialTarget = rankLanes.back[1];
  const formationReady = tutorialDuel && tutorialFormationReady(game.playerField);
  const tutorialRevenge = tutorial && game.turn === 5 && game.phase === "player" &&
    game.discardPile.some(isTutorialFive);
  const tutorialReplaceCover = tutorial && game.turn === 19 && game.phase === "player" &&
    game.discardPile.some(isTutorialTwo);
  const tutorialSixIndex = tutorialRevenge || tutorialReplaceCover ? game.playerField.findIndex(unit => unit && isTutorialSix(unit.card)) : -1;
  const tutorialSix = game.playerField[tutorialSixIndex];
  const tutorialCoverLane = tutorialSix ? laneOf(tutorialSix, tutorialSixIndex) - slotsPerRank : -1;
  const movingReserveToCover = tutorialReplaceCover && !laneCards(game.playerField, tutorialCoverLane).some(({ unit }) =>
    isTutorialReserve(unit.card));
  const revengeReady = tutorialRevenge && laneCards(game.playerField, tutorialCoverLane).some(({ unit }) =>
    unit.card.type === "standard" && unit.card.rank === "4");
  const tutorialDeployHalfling = tutorial && game.turn === 7 && game.phase === "player";
  const tutorialSlayDragon = tutorial && game.turn === 9 && game.phase === "player";
  const halfling = tutorialDeployHalfling || tutorialSlayDragon
    ? game.playerField.find(unit => unit && isTutorialTwo(unit.card)) : null;
  const halflingShielded = !!halfling?.shields?.some(layer => isTutorialJack(layer.card));
  const reserveDeployed = tutorialDeployHalfling && game.playerField.some(unit => unit && isTutorialReserve(unit.card));
  const rangerTarget = reserveDeployed
    ? game.computerField.findLastIndex((unit, index) =>
        unit && fieldRank(unit, index) === "front" && !isTutorialDragon(unit.card) && !unit.shields?.length)
    : -1;
  const tutorialReserveAttack = tutorial && game.turn === 11 && game.phase === "player";
  const reserveShielded = tutorialReserveAttack && game.playerField.some(unit =>
    unit && isTutorialReserve(unit.card) && unit.shields?.some(layer => isTutorialJack(layer.card)));
  const transferringTutorialShield = tutorialReserveAttack && game.step === "attack" && !reserveShielded;
  const tutorialBreakShield = tutorial && game.turn === 13 && game.phase === "player";
  const tutorialAttackThree = tutorial && game.turn === 15 && game.phase === "player";
  const tutorialCounterHearts = tutorial && game.turn === 21 && game.phase === "player";
  const tutorialFollowup = tutorialBreakShield || tutorialAttackThree || tutorialReplaceCover || tutorialCounterHearts;
  const tutorialFollowupAttacker = tutorialBreakShield || tutorialReplaceCover ? isTutorialSix : isTutorialReserve;
  const tutorialFollowupTarget = tutorialReplaceCover ? isTutorialEnemyFour
    : tutorialCounterHearts ? isTutorialEnemySeven : isTutorialEnemyThree;
  const tutorialImmunity = tutorial && game.turn === 17 && game.phase === "player";
  const tutorialImmunityAttacker = game.tutorialBlockedAttack ? isTutorialSix : isTutorialReserve;
  const tutorialReinforce = tutorial && game.turn === 23 && game.phase === "player";
  const tutorialNines = tutorial && game.turn === 25 && game.phase === "player";
  const reinforcementsDeployed = tutorialReinforce && !game.player.some(isTutorialReinforcement);
  const reserveReady = tutorialNines && !game.player.some(isTutorialReadyTroop);
  const tutorialStatsAttack = tutorial && (game.turn === 27 || game.turn === 29) && game.phase === "player";
  const tutorialClearStack = tutorialStatsAttack && game.turn === 29;
  const tutorialBlind = tutorial && game.turn === 31 && game.phase === "player";
  const tutorialDouble = tutorial && game.turn === 33 && game.phase === "player";
  const tutorialDragonReady = tutorialDouble && game.playerField.some((unit, index) =>
    unit && isTutorialClubDragon(unit.card) && fieldRank(unit, index) === "front");
  const tutorialDragonShielded = tutorialDragonReady && game.playerField.some(unit =>
    unit && isTutorialClubDragon(unit.card) && unit.shields?.some(layer => isTutorialDiamondJack(layer.card)));
  const tutorialDoubleReady = tutorialDouble && game.queenAttackTurn === game.turn;
  const middleFront = rankLanes.front[1];
  const tutorialJoker = tutorial && (game.turn === 35 || game.turn === 37) && game.phase === "player";
  const replacementJoker = tutorialJoker && game.turn === 37;
  const promoteTutorialJoker = replacementJoker && game.playerField.some((unit, index) =>
    unit?.card.type === "joker" && unit.card.color === "red" && fieldRank(unit, index) === "back");
  const jokerColor = replacementJoker ? "black" : "red";
  const jokerDeployed = tutorialJoker && game.playerField.some(unit =>
    unit?.card.type === "joker" && unit.card.color === jokerColor);
  const isJokerLessonTarget = replacementJoker ? isTutorialEnemyRanger : isTutorialEnemyFive;
  const tutorialGuided = tutorialDuel || tutorialRevenge || tutorialDeployHalfling || tutorialSlayDragon || tutorialReserveAttack || tutorialFollowup || tutorialImmunity || movingReserveToCover || tutorialReinforce || tutorialNines || tutorialStatsAttack || tutorialBlind || tutorialDouble || tutorialJoker;
  const availableLesson = tutorial && game.turn === 2 && game.phase === "computer" ? "enemy-opening"
    : tutorial && game.turn === 36 && game.phase === "computer" && game.deckWarning === undefined &&
        !game.attackAnimation ? "ten-cards-left"
    : tutorial && game.turn === 38 && game.phase === "computer" && !game.attackAnimation &&
        game.deckWarning === undefined ? "on-your-own"
    : tutorial && game.phase === "player" && !game.attackAnimation && game.step !== "draw"
      ? game.turn > 38 && game.deckWarning === undefined && !game.specialStrike &&
          game.computer.length > 0 && !game.computerField.some(Boolean) ? "attack-the-castle"
        : tutorialJoker ? replacementJoker
        ? promoteTutorialJoker ? "move-joker-up" : jokerDeployed ? "attack-enemy-ranger" : "replace-lost-nine"
        : jokerDeployed ? "protect-the-joker" : "joker-deploy"
        : tutorialBlind ? "blind-nine"
        : tutorialDouble ? !tutorialDragonReady ? "raise-dragon"
          : !tutorialDragonShielded ? "shield-dragon" : "queen-double"
        : tutorialStatsAttack ? tutorialClearStack ? "clear-the-stack"
        : !seenLessons.has("health-stats") ? "health-stats" : "attack-shielded-stack"
        : tutorialReinforce ? reinforcementsDeployed ? "ranger-immunity" : "reinforce"
        : tutorialNines ? reserveReady ? "nine-versus-nine"
          : game.step === "move-out" ? "keep-the-ranks-ready" : "threes-stack"
        : tutorialCounterHearts ? "hearts-break-shield"
        : tutorialReplaceCover ? "replace-cover"
        : tutorialBreakShield ? "break-queen-shield"
        : tutorialAttackThree ? "take-out-three"
        : tutorialImmunity ? game.tutorialBlockedAttack ? "clubs-immunity" : "press-the-advantage"
        : tutorialDeployHalfling && !seenLessons.has("free-shield") ? "free-shield"
        : tutorialDeployHalfling && halfling && !seenLessons.has("halfling-shield") ? "halfling-shield"
        : halflingShielded && tutorialDeployHalfling && !seenLessons.has("deploy-reserve") ? "deploy-reserve"
        : reserveDeployed && !game.pendingAttack && !seenLessons.has("ranger-recon") ? "ranger-recon"
        : tutorialReserveAttack ? game.step !== "attack" ? "reserve-move-up" : reserveShielded ? "reserve-attack" : "transfer-shield"
        : tutorialSlayDragon ? game.step === "attack" ? "dragon-attack" : "slay-dragon"
        : tutorialRevenge && !seenLessons.has("counterattack") ? "counterattack"
        : revengeReady && !seenLessons.has("triangle") ? "triangle"
        : game.step === "move-out" ? tutorialRank
        : formationReady && game.step === "move-up" && !seenLessons.has("cover") ? "cover"
        : tutorialDuel && (game.step === "move-up" || game.step === "attack") ? game.step : undefined
      : undefined;
  const outcome = friendOpening ? friendOpening.outcome ?? null : matchOutcome(game);
  const victoryLesson = tutorial && outcome === "victory" && !game.attackAnimation &&
    !game.specialStrike && game.deckWarning === undefined ? "tutorial-victory" : undefined;
  const nextLesson = victoryLesson ?? availableLesson;
  const activeLesson = game.jokerExplosion ? undefined
    : game.tutorialCombatReaction
      ? game.deckWarning === undefined ? game.tutorialCombatReaction : undefined
      : nextLesson && !seenLessons.has(nextLesson) ? nextLesson : undefined;
  const [convertTarget, setConvertTarget] = useState<number | null>(null);
  const convertDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = convertDialog.current;
    if (convertTarget !== null && dialog && !dialog.open) dialog.showModal();
    if (convertTarget === null && dialog?.open) dialog.close();
  }, [convertTarget]);
  const paused = !!friendOpening || setupPending || pauseRequested || utilityOpen || !!activeLesson || convertTarget !== null;
  const healthStats = useRef<HTMLDListElement>(null);
  useEffect(() => {
    if (activeLesson !== "health-stats") return;
    setShowMatchInfo(true);
    const frame = window.requestAnimationFrame(() => {
      healthStats.current?.scrollIntoView({ block: "start", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeLesson]);

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
  const modeLabel = friendOpening ? "VS Friend" : tutorial ? "Tutorial · Easy" : trainingGrounds ? "Training Grounds" : `VS Computer · ${difficulty}`;
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
  const shieldTargetDialog = useRef<HTMLDialogElement>(null);
  const shieldTarget = game.pendingAttack?.choosingShield ? game.computerField[game.pendingAttack.target] : null;
  const shieldChoices = shieldTarget && game.pendingAttack
    ? attackDefense(game.computerField, game.pendingAttack.target, shieldTarget) : null;
  const choosingShield = !!shieldChoices;
  useEffect(() => {
    const dialog = shieldTargetDialog.current;
    if (choosingShield && dialog && !dialog.open) dialog.showModal();
    if (!choosingShield && dialog?.open) dialog.close();
  }, [choosingShield]);

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
  const attackEffectActive = Boolean(game.specialStrike || game.jokerExplosion || game.attackAnimation || game.spyFlash);
  const recoveryPreview = !attackEffectActive && (!paused || !!friendOpening) ? game.recoveredDiscard : undefined;
  const showingCombatEffect = attackEffectActive || Boolean(game.recoveredDiscard);
  useEffect(() => {
    if (!recoveryPreview) return;
    const timer = window.setTimeout(() => {
      setGame(current => current.recoveredDiscard === recoveryPreview ? { ...current, recoveredDiscard: undefined } : current);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [recoveryPreview]);
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
      setGame(current => current.specialStrike === strike ? {
        ...current,
        specialStrike: undefined,
        tutorialCombatReaction: tutorial && strike.side === "computer"
          ? strike.kind === "king" && !seenLessons.has("enemy-king") ? "enemy-king"
            : strike.kind === "ace" && !strike.blocked ? "enemy-ace-steal" : undefined
          : undefined,
      } : current);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [game.specialStrike, paused, tutorial, seenLessons]);

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
    if (!strike || (paused && !friendOpening)) return;
    const timer = window.setTimeout(() => {
      setGame(current => current.attackAnimation === strike ? { ...current, attackAnimation: undefined } : current);
    }, strike.kind === "card" ? 1150 : 1900);
    return () => window.clearTimeout(timer);
  }, [game.attackAnimation, paused, friendOpening]);

  const deckWarning = showingCombatEffect ? undefined : game.deckWarning;
  const warningActive = deckWarning !== undefined;
  const [turnTimerEnabled, setTurnTimerEnabled] = useState(false);
  const [phaseSeconds, setPhaseSeconds] = useState(30);
  const phaseClock = useRef({ round: game.round, turn: game.turn, step: game.step, remaining: 30_000 });
  const tutorialDeployment = tutorialRank && game.player.find(card => card.type === "standard" && card.rank === tutorialRank);
  const timedPhase = !tutorialGuided && !tutorialOpening && turnTimerEnabled && game.phase === "player" && game.step !== "draw" && !outcome &&
    !showingCombatEffect && !warningActive && !choosingShield;

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
      setGame(current => current.jokerExplosion === explosion ? {
        ...current,
        jokerExplosion: undefined,
        tutorialCombatReaction: tutorial && !explosion.survived ? "joker-blast-reaction" : undefined,
      } : current);
    }, 2250);
    return () => window.clearTimeout(timer);
  }, [game.jokerExplosion, game.attackAnimation, paused, tutorial]);

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
  const playerCollects = hasGarbageCollection(game.playerField);
  const opponentCollects = hasGarbageCollection(game.computerField);
  const collectionActive = playerCollects || opponentCollects;
  const previousCollectors = useRef({ player: false, opponent: false });
  const [collectionAnnouncement, setCollectionAnnouncement] = useState(false);
  useEffect(() => {
    onGarbageMusicChange(collectionActive && !outcome);
  }, [collectionActive, outcome, onGarbageMusicChange]);

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
  const selectedUnit = game.selected === null ? null : game.playerField[game.selected];
  const offenseRestricted = !isComputer && attackRestricted(game);
  const canAttackNow = !offenseRestricted && !warningActive && game.turn > 2 && (opponentHasCards || game.computer.length > 0);
  const selectedAttacker = selectedUnit && game.selected !== null && canAttackNow &&
    canAttackFrom(selectedUnit, game.selected, game.computerField, game.computer.length);
  const aimingAttack = selectedAttacker && !game.movingStack;
  const selectedBack = !!selectedUnit && game.selected !== null && fieldRank(selectedUnit, game.selected) === "back";
  const selectedBackRanger = selectedBack && !!selectedUnit && isRanger(selectedUnit.card);
  const canChooseConvert = !tutorialGuided && !paused && !game.pendingAttack && !showingCombatEffect &&
    !game.movingStack && !!selectedAttacker && !!selectedUnit && isHolyKnight(selectedUnit.card) && opponentHasCards;
  const castleTargeting = (friendOpening ? friendCanAct && friendOpening.turn > 2 && game.selected !== null : !paused) && !tutorialGuided && castleAttackerIndex(game) >= 0;
  const choosingHandCard = game.selectedShield || game.selectedStack || game.selectedSpecial;
  const canReallocateShields = !tutorialGuided && !tutorialOpening && !paused && !warningActive && canDeployThisPhase(game);
  const canUseSupport = !tutorialGuided && !tutorialOpening && !isComputer && game.step !== "draw" && !game.pendingAttack && !showingCombatEffect;
  const canActivateCollection = canUseSupport && !paused && !warningActive && !outcome &&
    !playerCollects && game.playerField.filter(isCollector).length >= 3;

  function activateGarbageCollection() {
    if (!canActivateCollection) return;
    setGame(current => {
      if (current.phase !== "player" || hasGarbageCollection(current.playerField) ||
          current.playerField.filter(isCollector).length < 3) return current;
      return {
        ...current,
        playerField: revealCollectors(current.playerField),
        result: "Garbage Collection activated.",
      };
    });
  }

  const canChooseShield = canUseSupport && game.playerField.some(canShield);
  const canSpy = !offenseRestricted && canUseSupport && opponentHasCards;
  const spySelected = canSpy && !!game.selectedShield && isJack(game.selectedShield);
  const canDoubleAttack = !offenseRestricted && (canUseSupport || (tutorialDouble && tutorialDragonShielded && !tutorialDoubleReady)) && !warningActive && game.turn > 2 && game.queenAttackTurn !== game.turn;
  const doubleAttackSelected = canDoubleAttack && !!game.selectedShield && isQueen(game.selectedShield);
  const queenCue = !isComputer && game.queenAttackTurn === game.turn
    ? game.extraAttack ? "Double Attack!" : "2nd Attack!"
    : undefined;
  const spokenQueenCue = useRef<{ round: object; turn: number; cue: string }>();
  const hasOpenLane = openLanes(game.playerField, "back").length > 0;
  const hasStackTarget = (card: Card) => hasHandStack(game.playerField, card);
  const canStackFromHand = !tutorialGuided && !tutorialOpening && !isComputer && !showingCombatEffect && !game.pendingAttack;
  const previousRevealField = useRef({ round: game.round, player: game.playerField, computer: game.computerField });
  const [revealedEffectCards, setRevealedEffectCards] = useState<readonly Card[]>();
  useEffect(() => {
    if (paused) return;
    const before = previousRevealField.current;
    previousRevealField.current = { round: game.round, player: game.playerField, computer: game.computerField };
    if (before.round !== game.round) {
      setRevealedEffectCards(undefined);
      return;
    }
    const previous = [...before.player, ...before.computer];
    const current = [...game.playerField, ...game.computerField];
    const revealed = current.flatMap(unit =>
      unit?.revealed && hasRevealEffect(unit.card) &&
        previous.some(old => old?.card === unit.card && !old.revealed) ? [unit.card] : []);
    const defeated = game.attackAnimation?.target;
    if (hasRevealEffect(defeated) &&
        !current.some(unit => unit?.card === defeated) &&
        previous.some(unit => unit?.card === defeated && !unit.revealed)) revealed.push(defeated);
    if (revealed.length) setRevealedEffectCards(revealed);
  }, [game.round, game.playerField, game.computerField, game.attackAnimation, paused]);
  useEffect(() => {
    if (!revealedEffectCards) return;
    const timer = window.setTimeout(() => setRevealedEffectCards(undefined), 1600);
    return () => window.clearTimeout(timer);
  }, [revealedEffectCards]);

  const lightningReveal = revealedEffectCards?.some(card => card.type === "standard" && card.rank === "9") ? revealedEffectCards : undefined;
  const unlockSound = useGameSound(game, soundEnabled && !paused, showingCombatEffect ? null : outcome, lightningReveal);
  const draggedCard = useRef<DraggedCard | null>(null);
  const shieldDrag = useRef<{ card: Card; pointer: number; x: number; y: number; moved: boolean; transfer?: ShieldTransfer } | null>(null);
  const suppressShieldClick = useRef(false);
  const [shieldDragPreview, setShieldDragPreview] = useState<{ card: Card; x: number; y: number; target?: number }>();

  function shieldSlotAt(x: number, y: number) {
    const slot = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-shield-drop-slot]");
    return slot ? Number(slot.dataset.shieldDropSlot) : undefined;
  }

  function beginShieldDrag(event: React.PointerEvent<HTMLElement>, card: Card, transfer?: ShieldTransfer) {
    if (event.button !== 0 || !event.isPrimary) return;
    shieldDrag.current = { card, transfer, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveShieldDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = shieldDrag.current;
    if (drag?.pointer !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 8) return;
    drag.moved = true;
    setShieldDragPreview({
      card: drag.card, x: event.clientX, y: event.clientY,
      target: shieldSlotAt(event.clientX, event.clientY),
    });
  }

  function finishShieldDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = shieldDrag.current;
    if (drag?.pointer !== event.pointerId) return;
    shieldDrag.current = null;
    setShieldDragPreview(undefined);
    if (!drag.moved) return;
    suppressShieldClick.current = true;
    if (event.type !== "pointerup") return;
    const target = shieldSlotAt(event.clientX, event.clientY);
    if (target !== undefined) {
      setGame(current => {
        if (!canDeployThisPhase(current)) return current;
        return drag.transfer ? transferPlayerShield(current, drag.transfer, target) : equipShield(current, drag.card, target);
      });
    }
  }

  const canDeployFromHand = canDeployThisPhase(game) && hasOpenLane;
  const canToggleHandStack = compactBoard && canDeployFromHand && canStackFromHand &&
    game.player.some(card => hasHandStack(game.playerField, card));
  const choosingHandStack = canToggleHandStack && stackFromHand;
  const canEndTurn = friendOpening ? friendCanAct : !tutorialGuided && !tutorialRank && !isComputer && game.step !== "draw" && !game.pendingAttack && !warningActive && !showingCombatEffect;
  const pendingTarget = game.pendingAttack && game.computerField[game.pendingAttack.target];
  const pendingPower = pendingTarget && game.pendingAttack?.isStack
    ? calculateAttack(game.playerField, game.pendingAttack.attacker,
        attackDefense(game.computerField, game.pendingAttack.target, pendingTarget, game.pendingAttack.shieldIndex).visibleCard)
    : null;
  const selected = game.selected;
  const canStackSelected = canStackFromHand && selected !== null &&
    game.playerField.some((_, index) => canMoveIntoStack(game, selected, index));

  const nextStep = tutorialOpening || tutorialGuided ? undefined : nextPlayerStep(game);
  const moveOutExhausted = !game.movingShield && !canStackSelected && game.turn > 2 && isMovingOut && !aimingAttack && !game.selectedStack && !game.selectedSpecial && !hasMoveOutAction(game);
  const moveUpBlocked = !game.movingShield && !canStackSelected && isMovingUp && !aimingAttack && !game.selectedStack && !game.selectedSpecial && !canMoveUp(game.playerField);
  const openingExhausted = !game.movingShield && openingPlaysExhausted(game, tutorial);
  const jokerOnlyTurn = !offenseRestricted && canEndTurn && !showingCombatEffect && hasOnlyJoker(game);
  const skipAttack = !offenseRestricted && canEndTurn && !showingCombatEffect && hasNoAttackOptions(game);

  function isTutorialStackTarget(unit: Unit, index: number, field = game.computerField) {
    const lane = laneCards(field, laneOf(unit, index));
    return unit.card.type === "standard" && unit.card.rank === "3" && lane.length > 1 &&
      lane.some(entry => entry.unit.shields?.length) !== tutorialClearStack;
  }

  function canPickOwnUnit(unit: Unit, index: number) {
    if (friendOpening) return friendCanAct && (friendShield !== null ? canShield(unit) : friendStack !== null ? fieldRank(unit, index) === "back" && matchesStack(game.player[friendStack], unit.card) : friendOpening.turn > 2);
    if (promoteTutorialJoker) return game.step === "move-up" && fieldRank(unit, index) === "back" &&
      unit.card.type === "joker" && unit.card.color === "red";
    if (tutorialJoker) return jokerDeployed && game.step === "attack" && fieldRank(unit, index) === "front" &&
      (isTutorialReinforcement(unit.card) || isTutorialClubDragon(unit.card));
    if (tutorialBlind) return game.step === "attack" && isTutorialNine(unit.card);
    if (tutorialDouble) return isTutorialClubDragon(unit.card) &&
      (!tutorialDragonReady || !!game.selectedShield && isTutorialDiamondJack(game.selectedShield) || tutorialDoubleReady);
    if (tutorialStatsAttack) return game.step === "attack" && isTutorialNine(unit.card);
    if (tutorialReinforce) return game.step === "attack" && isTutorialSix(unit.card);
    if (tutorialNines) return game.step === "move-up" ? fieldRank(unit, index) === "back" && isTutorialReinforcement(unit.card)
      : game.step === "attack" && isTutorialNine(unit.card);
    if (movingReserveToCover) return isTutorialReserve(unit.card) && fieldRank(unit, index) === "front";
    if (tutorialImmunity) return game.step === "attack" && tutorialImmunityAttacker(unit.card);
    if (tutorialFollowup) return game.step === "attack" && tutorialFollowupAttacker(unit.card);
    if (tutorialDeployHalfling) return reserveDeployed
      ? isTutorialSix(unit.card) : !!game.selectedShield && isTutorialTwo(unit.card);
    if (tutorialSlayDragon) return isTutorialTwo(unit.card);
    if (tutorialReserveAttack) {
      if (transferringTutorialShield && !game.movingShield) return isTutorialTwo(unit.card);
      return isTutorialReserve(unit.card);
    }
    if (tutorialRevenge) return revengeReady ? isTutorialSix(unit.card)
      : unit.card.type === "standard" && unit.card.rank === "4" && fieldRank(unit, index) === "front";
    if (tutorialDuel) {
      const rank = fieldRank(unit, index);
      return isMovingUp ? rank === "back" && unit.card.type === "standard" && (unit.card.rank === "4" || isTutorialFive(unit.card) || isTutorialSix(unit.card))
        : isAttacking && rank === "front" && isTutorialFive(unit.card);
    }
    if (game.selectedShield || game.movingShield) return canShield(unit);
    if (game.selectedStack) return fieldRank(unit, index) === "back" && matchesStack(game.selectedStack, unit.card);
    if (game.movingStack && selected !== null) return index === selected || canMoveIntoStack(game, selected, index);
    if (canAttackNow && canAttackFrom(unit, index, game.computerField, game.computer.length)) return true;
    if (!tutorialGuided && isMovingUp && fieldRank(unit, index) === "back" && isRanger(unit.card)) return true;
    if (isMovingUp && fieldRank(unit, index) === "back" && openLanes(game.playerField, "front").length > 0) return true;

    return index === selected || game.playerField.some((_, target) => canMoveIntoStack(game, index, target));
  }

  useEffect(() => {
    if ((!moveOutExhausted && !moveUpBlocked && !openingExhausted && !jokerOnlyTurn && !skipAttack) || outcome || immunityWarningOpen || paused || showingCombatEffect) return;
    const timer = window.setTimeout(() => {
      setGame(current => {
        if (current.phase !== "player" || current.movingShield) return current;
        if (current.step !== "draw" && ((jokerOnlyTurn && hasOnlyJoker(current)) ||
            (skipAttack && hasNoAttackOptions(current)))) {
          return finishPlayerTurn(current);
        }
        if (openingPlaysExhausted(current, tutorial)) {
          return finishPlayerTurn(current);
        }
        if (current.step === "move-up" && !canMoveUp(current.playerField)) {
          return { ...current, step: moveOutOrAttack(current), selected: null };
        }
        return current.step === "move-out" && !hasMoveOutAction(current) ? advancePlayerStep(current) : current;
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [moveOutExhausted, moveUpBlocked, openingExhausted, jokerOnlyTurn, skipAttack, game.turn, outcome, immunityWarningOpen, paused, showingCombatEffect, tutorial]);

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
    if (paused || showingCombatEffect || warningActive) return;
    const before = previousCollectors.current;
    previousCollectors.current = { player: playerCollects, opponent: opponentCollects };
    if (!(playerCollects && !before.player) && !(opponentCollects && !before.opponent)) return;
    setCollectionAnnouncement(true);
    if (soundEnabled && canSpeak() && window.speechSynthesis && typeof SpeechSynthesisUtterance !== "undefined") {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance("Garbage Collection activated!"));
    }
  }, [playerCollects, opponentCollects, paused, showingCombatEffect, warningActive, soundEnabled, canSpeak]);
  useEffect(() => {
    if (!collectionAnnouncement) return;
    const timer = window.setTimeout(() => setCollectionAnnouncement(false), 1800);
    return () => window.clearTimeout(timer);
  }, [collectionAnnouncement]);

  useEffect(() => {
    if (!isComputer || outcome || showingCombatEffect || warningActive || paused) return;

    const timer = window.setTimeout(() => {
      const castleRoll = Math.random();
      const attackRoll = Math.random();
      setGame(current => {
        if (current.phase === "computer") {
          if (current.turn <= 2) return { ...current, phase: "computer-move-out", step: "move-out" };
          let field = current.computerField;
          if (tutorial && current.turn === 36) {
            const ranger = current.computer.find(isTutorialEnemyRanger);
            const lane = openLanes(field, "front")[0];
            if (ranger && lane !== undefined) {
              field = [...field];
              field[lane] = { ...deploy(ranger), revealed: true };
              return { ...current, computer: current.computer.filter(card => card !== ranger),
                computerField: field, phase: "computer-attack", step: "attack" };
            }
          }
          if (tutorial && current.turn === 30) {
            const dragonIndex = field.findIndex(unit => unit && isTutorialHeartDragon(unit.card));
            const heldDragon = current.computer.find(isTutorialHeartDragon);
            const dragon = field[dragonIndex] ?? (heldDragon ? deploy(heldDragon) : null);
            if (dragon) {
              field = field.map((unit, index) => index === dragonIndex ? null : unit);
              const displaced = laneCards(field, rankLanes.front[1]);
              const computer = current.computer.filter(card => card !== heldDragon);
              for (const { unit, index } of displaced) {
                field[index] = null;
                computer.push(unit.card, ...(unit.shields ?? []).map(layer => layer.card));
              }
              field[rankLanes.front[1]] = { ...dragon, revealed: false, lane: rankLanes.front[1] };
              return { ...current, computer, computerField: field, phase: "computer-move-out", step: "move-out" };
            }
          }
          const sources = rankLanes.back
            .filter(lane => laneCards(field, lane).some(({ unit }) => canDeploy(unit.card)))
            .sort((a, b) => laneCards(field, b).reduce((sum, { unit }) => sum + strength(unit.card), 0) -
              laneCards(field, a).reduce((sum, { unit }) => sum + strength(unit.card), 0));
          if (tutorial && (current.turn === 10 || current.turn === 16 || current.turn === 20 || current.turn === 22)) {
            const upcoming = current.turn === 10 ? isTutorialEnemyFive
              : current.turn === 16 ? isTutorialEnemyFour : current.turn === 20 ? isTutorialEnemySeven : isTutorialEnemyNine;
            const source = sources.findIndex(lane => laneCards(field, lane).some(({ unit }) => upcoming(unit.card)));
            if (source > 0) sources.unshift(...sources.splice(source, 1));
          }
          const planRangerPosition = !tutorial && difficulty === "Hard";
          const attackScore = (computerField: Field) =>
            chooseComputerAttack({ ...current, computerField }, "Hard", 0).attack?.tacticalScore ?? 0;
          for (const lane of openLanes(field, "front")) {
            let sourceIndex = 0;
            if (planRangerPosition) {
              sourceIndex = sources.findIndex(source => laneCards(field, source).some(({ unit }) => !isRanger(unit.card)));
              if (sourceIndex < 0 && !attackRestricted(current, "computer")) {
                const currentScore = attackScore(field);
                sourceIndex = sources.findIndex(source => {
                  const advancedScore = attackScore(moveUp(field, source, lane));
                  return advancedScore >= 4 && advancedScore > currentScore;
                });
              }
            }
            if (sourceIndex < 0 || sourceIndex >= sources.length) break;
            const [source] = sources.splice(sourceIndex, 1);
            field = moveUp(field, source, lane);
          }
          return { ...current, computerField: field, phase: "computer-move-out", step: "move-out" };
        }

        if (current.phase === "computer-move-out") {
          let field = [...current.computerField];
          const empty = openLanes(field, "back");
          const tutorialEnemyOpening = tutorial && current.turn === 2;
          const available = tutorialEnemyOpening
            ? current.computer.filter(card => isTutorialSeven(card) ||
                (card.type === "standard" && card.rank === "3" && card.suit === "clubs"))
                .sort((a, b) => strength(a) - strength(b))
            : current.computer.filter(canDeploy).sort((a, b) => strength(b) - strength(a));
          const planCollection = !tutorial && (difficulty === "Normal" || difficulty === "Hard") &&
            (current.discardPile.length > 0 || current.turn > 2);
          const neededCollectors = Math.max(0, 3 - field.filter(isCollector).length);
          if (planCollection && neededCollectors && available.filter(isCollectorCard).length >= neededCollectors) {
            const priority = available.filter(isCollectorCard).slice(0, neededCollectors);
            available.splice(0, available.length, ...priority, ...available.filter(card => !priority.includes(card)));
          }
          if (tutorial && current.turn === 6) {
            for (const required of [isTutorialEnemySeven, isTutorialEnemyFour]) {
              const index = available.findIndex(required);
              if (index > 0) available.unshift(...available.splice(index, 1));
            }
          }
          while (empty.length) {
            const card = available.shift();
            if (!card) break;
            const coveredIndex = !tutorial && difficulty === "Hard" && isRanger(card)
              ? empty.findIndex(lane => laneCards(field, lane - slotsPerRank).length > 0)
              : -1;
            const [lane] = empty.splice(Math.max(0, coveredIndex), 1);
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
          if (tutorial && current.turn === 22) {
            const fiveIndex = field.findIndex(unit => unit && isTutorialEnemyFive(unit.card));
            const jack = current.computer.find(card => card.type === "standard" && card.rank === "J" && card.suit === "clubs");
            const five = field[fiveIndex];
            if (five && jack) {
              field[fiveIndex] = { ...five, shields: [...(five.shields ?? []), { card: jack, revealed: false }] };
              used.add(jack);
            }
          }
          let movedShield = false;
          if (difficulty === "Hard") {
            const managed = manageHardShields(current, field, used);
            field = managed.field;
            movedShield = managed.moved;
          } else if (!tutorial || current.turn < 12 || (current.turn > 24 && current.turn !== 28 && current.turn !== 30 && current.turn !== 32 && current.turn !== 34)) {
            const shieldTargets = field.flatMap((unit, index) => unit && canShield(unit) ? [index] : []);
            shieldTargets.sort((a, b) => laneOf(field[a]!, a) - laneOf(field[b]!, b));
            const shields = current.computer.filter(isShield);
            if (shieldTargets.length) {
              shields.forEach((card, index) => {
                const stackShieldTarget = tutorial && current.turn === 26 && card.type === "standard" &&
                  card.rank === "Q" && card.suit === "spades"
                  ? field.findIndex((unit, index) => unit?.card.type === "standard" && unit.card.rank === "3" &&
                    laneCards(field, laneOf(unit, index)).length > 1)
                  : -1;
                const slot = stackShieldTarget >= 0 ? stackShieldTarget : shieldTargets[index % shieldTargets.length];
                const unit = field[slot];
                if (!unit) return;
                used.add(card);
                field[slot] = { ...unit, shields: [...(unit.shields ?? []), { card, revealed: false }] };
              });
            }
          }
          const activateCollection = planCollection && current.discardPile.length > 0 &&
            field.filter(isCollector).length >= 3 && !hasGarbageCollection(field);
          const computerField = activateCollection ? revealCollectors(field) : field;
          const placed: Game = {
            ...current,
            computer: current.computer.filter(card => !used.has(card)),
            computerField,
            computerStacked: stackedForAttack,
            result: activateCollection ? "Garbage Collection activated." : current.result,
            phase: "computer-attack",
            step: "attack",
            sound: stackedForAttack || stackCard ? { cue: "stack" }
              : movedShield ? { cue: "shield" }
              : used.size > current.computerField.filter(Boolean).length ? { cue: "deploy" } : current.sound,
          };
          return current.turn <= 2 ? drawForTurn({ ...placed, phase: "player" }, "player") : placed;
        }

        if (current.phase !== "computer-attack") return current;
        if (tutorial && current.turn === 4) {
          const attacker = current.computerField.findIndex((unit, index) =>
            unit && isTutorialSeven(unit.card) && fieldRank(unit, index) === "front");
          const target = current.playerField.findIndex((unit, index) =>
            unit && isTutorialFive(unit.card) && fieldRank(unit, index) === "front");
          if (attacker >= 0 && target >= 0) {
            const resolved = resolveAttack({ ...current, phase: "computer" }, "computer", attacker, target);
            return drawForTurn({ ...resolved, phase: "player" }, "player");
          }
        }
        if (tutorial && (current.turn === 6 || current.turn === 8)) {
          const attacker = current.computerField.findIndex((unit, index) =>
            unit && isTutorialDragon(unit.card) && fieldRank(unit, index) === "front");
          const target = current.playerField.findIndex(unit => unit && isTutorialFour(unit.card));
          if (attacker >= 0 && target >= 0) {
            const resolved = resolveAttack({ ...current, phase: "computer" }, "computer", attacker, target);
            return drawForTurn({ ...resolved, phase: "player" }, "player");
          }
        }
        if (tutorial && current.turn === 10) {
          return drawForTurn({ ...current, phase: "player", result: "The opponent held its position." }, "player");
        }
        if (tutorial && (current.turn === 12 || current.turn === 16 || current.turn === 18 || current.turn === 20 || current.turn === 22)) {
          const scriptedAttacker = current.turn === 12 ? isTutorialEnemyThree
            : current.turn === 16 ? isTutorialEnemyFour : current.turn === 18 ? isTutorialEnemyFive : current.turn === 20 ? isTutorialEnemySeven : isTutorialEnemyNine;
          const scriptedTarget = current.turn === 18 ? isTutorialTwo : isTutorialReserve;
          const attacker = current.computerField.findIndex((unit, index) =>
            unit && scriptedAttacker(unit.card) && fieldRank(unit, index) === "front");
          const target = current.playerField.findIndex(unit => unit && scriptedTarget(unit.card));
          if (attacker >= 0 && target >= 0) {
            const resolved = resolveAttack({ ...current, phase: "computer" }, "computer", attacker, target);
            return drawForTurn({ ...resolved, phase: "player" }, "player");
          }
        }
        if (tutorial && current.turn === 24) {
          const target = current.playerField.findIndex(unit => unit && isTutorialSix(unit.card));
          const field = [...current.computerField];
          const threes = (["hearts", "diamonds"] as const).flatMap(suit => {
            const matches = (card: Card) => card.type === "standard" && card.rank === "3" && card.suit === suit;
            const position = field.findIndex(unit => unit && matches(unit.card));
            const unit = field[position];
            if (unit) { field[position] = null; return [unit]; }
            const card = current.computer.find(matches);
            return card ? [deploy(card)] : [];
          });
          if (target >= 0 && threes.length === 2) {
            const lane = openLanes(field, "front")[0] ?? rankLanes.front[0];
            const displaced = laneCards(field, lane);
            for (const { index } of displaced) field[index] = null;
            field[lane] = { ...threes[0], lane };
            const computer = current.computer.filter(card => !threes.some(unit => unit.card === card));
            for (const { unit } of displaced) computer.push(unit.card, ...(unit.shields ?? []).map(layer => layer.card));
            const ready: Game = { ...current, phase: "computer", computer, computerField: addToStack(field, threes[1], lane) };
            const resolved = resolveAttack(ready, "computer", lane, target);
            return drawForTurn({ ...resolved, phase: "player" }, "player");
          }
        }
        if (tutorial && current.turn === 32) {
          const attacker = current.computerField.findIndex(unit => unit && isTutorialHeartDragon(unit.card));
          const target = current.playerField.findIndex(unit => unit && isTutorialNine(unit.card));
          if (attacker >= 0 && target >= 0) {
            const resolved = resolveAttack({ ...current, phase: "computer" }, "computer", attacker, target);
            return drawForTurn({ ...resolved, phase: "player" }, "player");
          }
        }
        // Keep the face-down 10♥ in reserve until the player attacks it on turn 16.
        if (tutorial && (current.turn === 14 || current.turn === 26 || current.turn === 28 ||
            current.turn === 30 || current.turn === 34 || current.turn === 36)) {
          return drawForTurn({ ...current, phase: "player", result: "The opponent held its position." }, "player");
        }
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
        const recoveryTurn = attackRestricted(current, "computer");
        const { attack, hasProductiveAttack } = recoveryTurn ? { attack: undefined, hasProductiveAttack: false }
          : chooseComputerAttack(current, attackDifficulty, attackRoll, difficulty === "Hard");
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
        const special = !recoveryTurn && !hasProductiveAttack && (!attack || difficulty !== "Easy")
          ? chooseComputerSpecial(turn, Boolean(attack), difficulty !== "Hard")
          : undefined;
        if (recoveryTurn || (difficulty === "Hard" && !attack && !special)) {
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
          return drawForTurn({ ...turn, phase: "player",
            result: recoveryTurn ? "The computer ended its Convert recovery turn."
              : "The computer found no effective attack and ended its turn." }, "player");
        }
        const resolved = special
          ? resolveSpecial(turn, special.index, "computer", special.card)
          : resolveAttack(turn, "computer", attacker, target, undefined, undefined,
              shouldComputerConvert(turn, difficulty, attacker, target, attackRoll));
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
        movements: recordMovement(current, { kind: "deploy", step: current.step, card, handIndex: current.player.indexOf(card) }),
        playerField: field,
        selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null, movingStack: false, movingShield: undefined,
        result: current.step === "move-up" ? "Card deployed. Skipped to Move Out." : current.result,
        sound: { cue: "play" },
      };
    });
  }

  function endTurn() {
    if (!canEndTurn) return;
    if (friendOpening) { void sendFriendMove("end-turn"); return; }
    setGame(finishPlayerTurn);
  }

  function spy() {
    setGame(current => {
      const jack = current.selectedShield;
      if (attackRestricted(current) || !jack || !isJack(jack) || current.phase !== "player" || current.step === "draw" ||
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
      if (attackRestricted(current) || !queen || !isQueen(queen) || current.phase !== "player" || current.step === "draw" || current.turn <= 2 ||
          current.queenAttackTurn === current.turn || current.pendingAttack || current.specialStrike ||
          current.jokerExplosion || current.attackAnimation || current.deckWarning !== undefined ||
          !current.player.includes(queen)) return current;
      return {
        ...current, step: tutorialDouble ? "attack" : current.step, extraAttack: true, queenAttackTurn: current.turn, selectedShield: null,
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
        (kind === "selectedStack" || (!attackRestricted(current) && current.turn > 2 && current.computerField.some(Boolean)));
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
    if (friendOpening) {
      const index = game.playerField.findIndex(unit => unit?.card === card);
      if (index >= 0) void sendFriendMove("retreat", index);
      return;
    }
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
    if (friendOpening) {
      if (!friendCanAct) return;
      const unit = game.playerField[index];
      if (!unit) return;
      if (friendShield !== null) {
        if (canShield(unit)) void sendFriendMove("shield", friendShield, index);
        return;
      }
      if (friendStack !== null) { void sendFriendMove("stack-hand", friendStack, index); return; }
      if (friendOpening.turn <= 2) return;
      const from = game.selected;
      if (from !== null && canMoveIntoStack(game, from, index)) {
        void sendFriendMove("stack-field", from, index);
      } else if (game.step === "move-up" && fieldRank(unit, index) === "back" && !isRanger(unit.card) &&
                 preferredPromotionLane(game.playerField, index) !== undefined) {
        void sendFriendMove("promote", index);
      } else {
        setGame(current => ({ ...current, selected: from === index ? null : index }));
      }
      return;
    }
    const shieldSource = game.playerField[index];
    if (transferringTutorialShield && shieldSource && isTutorialTwo(shieldSource.card)) {
      const jack = shieldSource.shields?.find(layer => isTutorialJack(layer.card));
      if (jack) startShieldMove(shieldSource.card, jack);
      return;
    }
    setGame(current => {
      const unit = current.playerField[index];
      if (!unit || current.phase !== "player" || current.pendingAttack || current.specialStrike) return current;

      if (current.convertSelected) current = { ...current, convertSelected: undefined };
      if ((tutorialBlind || tutorialDouble || tutorialJoker) && !canPickOwnUnit(unit, index)) return current;
      if (promoteTutorialJoker) {
        const destination = openLanes(current.playerField, "front")[0];
        if (destination === undefined) return current;
        const promoted = promoteUnit(current, index, destination);
        return promoted === current ? current : advancePlayerStep(promoted, "move-out");
      }
      if (tutorialNines && !canPickOwnUnit(unit, index)) return current;
      if (tutorialReinforce && !canPickOwnUnit(unit, index)) return current;
      if (tutorialReserveAttack) {
        if (!isTutorialReserve(unit.card)) return current;
        if (current.step === "move-up" && fieldRank(unit, index) === "back") {
          const open = openLanes(current.playerField, "front");
          const ahead = laneOf(unit, index) - slotsPerRank;
          const destination = open.includes(ahead) ? ahead : open[0];
          if (destination === undefined) return current;
          const promoted = promoteUnit(current, index, destination);
          return promoted === current ? current : advancePlayerStep(promoted, "attack");
        }
      }

      if (tutorialSlayDragon) {
        if (!isTutorialTwo(unit.card)) return current;
        if (current.step === "move-up" && fieldRank(unit, index) === "back") {
          const rangerIndex = current.playerField.findIndex(entry => entry && isTutorialSix(entry.card));
          const ranger = current.playerField[rangerIndex];
          if (!ranger) return current;
          const frontLane = laneOf(ranger, rangerIndex) - slotsPerRank;
          const promoted = promoteUnit(current, index, frontLane);
          return promoted === current ? current : advancePlayerStep(promoted, "attack");
        }
      }
      if (tutorialDeployHalfling && !canPickOwnUnit(unit, index)) return current;
      if (tutorialRevenge || movingReserveToCover) {
        if (!canPickOwnUnit(unit, index)) return current;
        return { ...current, selected: current.selected === index ? null : index };
      }

      if (tutorialDuel && current.step === "move-up" && isTutorialSix(unit.card)) {
        return {
          ...current,
          selected: formationReady && current.selected !== index ? index : null,
          result: formationReady ? "" : "Locke: Keep the 6 in the back. Move the 4 and 5 up first.",
        };
      }

      if (current.movingShield) return transferPlayerShield(current, current.movingShield, index);

      if (current.selectedStack) return stackOnto(current, { from: "hand", card: current.selectedStack }, index);

      const shield = current.selectedShield;
      if (shield) return equipShield(current, shield, index);
      const selectedIndex = current.selected;
      const selectedCard = selectedIndex === null ? null : current.playerField[selectedIndex];
      if (!tutorialGuided && !current.selectedSpecial && selectedIndex !== null && selectedCard &&
          fieldRank(selectedCard, selectedIndex) === fieldRank(unit, index) &&
          canMoveIntoStack(current, selectedIndex, index)) {
        return stackOnto(current, { from: "field", index: selectedIndex }, index);
      }
      if (current.step === "move-up" && !shield && !current.movingStack && !current.selectedSpecial &&
          fieldRank(unit, index) === "back") {
        if (!tutorialGuided && isRanger(unit.card)) return { ...current, selected: current.selected === index ? null : index };
        const directlyAhead = laneOf(unit, index) - slotsPerRank;
        const destination = tutorialGuided
          ? openLanes(current.playerField, "front").find(lane => lane === directlyAhead)
          : preferredPromotionLane(current.playerField, index);
        if (destination !== undefined) return promoteUnit(current, index, destination);
      }

      const canAttack = !attackRestricted(current) && canAttackFrom(unit, index, current.computerField, current.computer.length);
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
      if (!unit || fieldRank(unit, index) !== "back" || (tutorialDuel && isTutorialSix(unit.card)) ||
          (!tutorialGuided && isRanger(unit.card)) || tutorialRevenge) return current;
      const open = openLanes(current.playerField, "front");
      const directlyAhead = laneOf(unit, index) - slotsPerRank;
      const lane = tutorialGuided
        ? open.includes(directlyAhead) ? directlyAhead : open[0]
        : preferredPromotionLane(current.playerField, index);
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

  function placeTutorialSix(current: Game, index: number, lane: number) {
    const unit = current.playerField[index];
    if (current.turn !== 3 || current.step !== "move-up" || !unit || !isTutorialSix(unit.card) ||
        !tutorialFormationReady(current.playerField)) return current;
    if (!tutorialCoveredLane(current.playerField, lane)) {
      return { ...current, result: "Locke: Keep the 6 in the back rank, behind the 4 or 5." };
    }
    const moved = rearrangeRank(current, index, lane);
    return moved === current ? current : advancePlayerStep(moved, "attack");
  }

  function moveCoverCard(current: Game, index: number, lane: number) {
    const moved = rearrangeRank(current, index, lane);
    return (tutorialRevenge || movingReserveToCover) && moved !== current ? advancePlayerStep(moved, "attack") : moved;
  }

  function moveDraggedUnit(current: Game, index: number, lane: number) {
    if (tutorialDuel) return placeTutorialSix(current, index, lane);
    const unit = current.playerField[index];
    if (!tutorialGuided && unit && isRanger(unit.card) && fieldRank(unit, index) === "back" && rankLanes.front.includes(lane)) {
      return canDeployThisPhase(current) ? promoteUnit(current, index, lane) : current;
    }
    if (!tutorialGuided && unit && rankLanes[fieldRank(unit, index)].includes(lane)) {
      const target = laneCards(current.playerField, lane).find(entry => canMoveIntoStack(current, index, entry.index));
      if (target) return stackOnto(current, { from: "field", index }, target.index);
    }
    return moveCoverCard(current, index, lane);
  }

  function dropOnEmptyLane(lane: number) {
    const source = draggedCard.current;
    draggedCard.current = null;
    if (source?.from !== "field") return;
    if ((tutorialRevenge || movingReserveToCover) && lane !== tutorialCoverLane) return;
    setGame(current => moveDraggedUnit(current, source.index, lane));
  }

  function moveTutorialSix(lane: number) {
    if (selected !== null) setGame(current => placeTutorialSix(current, selected, lane));
  }

  function moveTutorialCover(lane: number) {
    if (lane === tutorialCoverLane && selected !== null && (movingReserveToCover || !revengeReady)) {
      setGame(current => moveCoverCard(current, selected, lane));
    }
  }

  function advanceStep() {
    if (friendOpening) { void sendFriendMove("next"); return; }
    if (!nextStep) return;
    setGame(current => advancePlayerStep(current, nextStep));
  }

  function attackCastle(index: number) {
    if (!castleTargeting) return;
    if (friendOpening) { void sendFriendMove("castle", index); return; }
    setGame(current => {
      const attackerIndex = castleAttackerIndex(current);
      const attacker = current.playerField[attackerIndex];
      const target = current.computer[index];
      if (!attacker || !target) return current;
      return finishPlayerAttack({
        ...current,
        computer: current.computer.filter((_, slot) => slot !== index),
        playerField: current.playerField.map((unit, slot) =>
          slot === attackerIndex ? { ...attacker, revealed: true } : unit,
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
    setGame(current => ({ ...current, immunityWarningTarget: undefined, immunityWarningShield: undefined }));
  }

  function attack(index: number, confirmed = false, chosenShield?: number, mode?: "regular" | "convert") {
    if (friendOpening) {
      if (!friendCanAct || friendOpening.turn <= 2 || attackRestricted(game)) return;
      if (friendSpecial !== null) { void sendFriendMove("special", friendSpecial, index); return; }
      const from = game.selected;
      const unit = from === null ? null : game.playerField[from];
      const defender = game.computerField[index];
      if (from === null || !unit || !defender || !canAttackTarget(unit, from, game.computerField, index)) return;
      if (!mode && chosenShield === undefined && isHolyKnight(unit.card)) { setConvertTarget(index); return; }
      if (chosenShield === undefined) {
        friendAttackMode.current = mode === "convert" ? "convert" : "attack";
        if (attackDefense(game.computerField, index, defender).layers.length > 1) {
          setGame(current => ({ ...current, pendingAttack: { attacker: from, target: index, isStack: false, choosingShield: true } }));
          return;
        }
      }
      setGame(current => ({ ...current, pendingAttack: undefined }));
      void sendFriendMove(friendAttackMode.current, from, index, chosenShield);
      return;
    }
    if (!confirmed && chosenShield === undefined && mode === undefined && canChooseConvert &&
        selectedUnit && selected !== null && canAttackTarget(selectedUnit, selected, game.computerField, index)) {
      setConvertTarget(index);
      return;
    }

    setGame(previous => {
      const state = mode === undefined ? previous : { ...previous, convertSelected: mode === "convert" };
      if (confirmed ? state.immunityWarningTarget !== index : state.immunityWarningTarget !== undefined) return state;
      const choosing = state.pendingAttack?.choosingShield && state.pendingAttack.target === index;
      if (chosenShield !== undefined && !choosing) return state;
      const shieldIndex = confirmed ? state.immunityWarningShield : chosenShield;
      const current = confirmed ? { ...state, immunityWarningTarget: undefined, immunityWarningShield: undefined }
        : choosing && chosenShield !== undefined ? { ...state, pendingAttack: undefined } : state;
      if (current.phase !== "player" || current.turn <= 2 || current.pendingAttack || attackRestricted(current)) return current;
      const defender = current.computerField[index];
      if (!defender) return current;
      if (tutorial && current.turn === 3 && (current.step !== "attack" || index !== tutorialTarget ||
          current.selected === null || !current.playerField[current.selected] ||
          !isTutorialFive(current.playerField[current.selected]!.card))) return current;

      if (tutorialRevenge && (!revengeReady || !isTutorialSeven(defender.card) ||
          current.selected !== tutorialSixIndex)) return current;
      if (tutorialDeployHalfling && (index !== rangerTarget || current.selected === null ||
          !current.playerField[current.selected] || !isTutorialSix(current.playerField[current.selected]!.card))) return current;
      if (tutorialSlayDragon) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (!source || !isTutorialTwo(source.card) || !isTutorialDragon(defender.card) ||
            fieldRank(source, current.selected!) !== "front") return current;
      }

      if (tutorialReserveAttack) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (!reserveShielded || current.step !== "attack" || !source || !isTutorialReserve(source.card) ||
            !isTutorialEnemyEight(defender.card)) return current;
      }

      if (tutorialFollowup) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (current.step !== "attack" || !source || !tutorialFollowupAttacker(source.card) ||
            !tutorialFollowupTarget(defender.card)) return current;
      }

      if (movingReserveToCover) return current;
      if (tutorialImmunity) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (current.step !== "attack" || !source || !tutorialImmunityAttacker(source.card) ||
            !isTutorialEnemyFour(defender.card)) return current;
        if (!current.tutorialBlockedAttack) return { ...current, selected: null, tutorialBlockedAttack: true };
      }

      if (tutorialStatsAttack) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (current.step !== "attack" || !source || !isTutorialNine(source.card) ||
            !isTutorialStackTarget(defender, index, current.computerField)) return current;
      }
      if (tutorialReinforce || tutorialNines) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (current.step !== "attack" || !source ||
            (tutorialReinforce ? !isTutorialSix(source.card) || !isTutorialEnemyFive(defender.card)
              : !isTutorialNine(source.card) || !isTutorialEnemyNine(defender.card))) return current;
      }

      if (tutorialBlind || tutorialDouble) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (current.step !== "attack" || !source ||
            (tutorialBlind ? !isTutorialNine(source.card) || index !== middleFront
              : !tutorialDoubleReady || !isTutorialClubDragon(source.card) ||
                !(current.extraAttack ? isTutorialHeartDragon(defender.card) : isTutorialEnemyFive(defender.card)))) return current;
      }

      if (tutorialJoker) {
        const source = current.selected === null ? null : current.playerField[current.selected];
        if (!source || !canPickOwnUnit(source, current.selected!) || !isJokerLessonTarget(defender.card)) return current;
      }

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

      const convert = current.convertSelected === true && isHolyKnight(attacker.card);
      const choices = stackVictimChoices(current.playerField, attackerIndex, current.computerField, index, convert);
      const defense = attackDefense(current.computerField, index, defender, shieldIndex);
      if (shieldIndex !== undefined && !defense.outer) return state;
      if (shieldIndex === undefined && defense.layers.length > 1) {
        return { ...current, pendingAttack: { attacker: attackerIndex, target: index, isStack: false, choosingShield: true } };
      }
      const power = calculateAttack(current.playerField, attackerIndex, defense.visibleCard);
      if (shouldWarn && !choices.length && (!defense.outer || defense.outer.revealed) && power.immune && power.parts.some(part => part.suitBlocked)) {
        return { ...current, immunityWarningTarget: index, immunityWarningShield: shieldIndex };
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
            shieldIndex,
            convert,
          },
          computerField: current.computerField.map((unit, slot) =>
            unit && laneOf(unit, slot) === laneOf(defender, index) ? { ...unit, revealed: true } : unit,
          ),
          advantage: false,
          immunity: undefined,
          result: "",
        };
      }
      const attacked = resolveAttack(current, "player", attackerIndex, index, undefined, shieldIndex, convert);
      return attacked.phase === "computer" ? finishPlayerAttack(attacked) : attacked;
    });
  }

  useEffect(() => {
    const pending = game.pendingAttack;
    if (!pending || pending.choices || pending.choosingShield || paused) return;

    const timer = window.setTimeout(() => {
      setGame(current => {
        if (current.pendingAttack !== pending || current.phase !== "player") return current;
        const attacked = resolveAttack(current, "player", pending.attacker, pending.target, pending.victims, pending.shieldIndex, pending.convert);
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
    if (choosingShield) return "Choose a shield to attack.";
    if (choosingStackTargets) return "Choose which cards in the stack to defeat.";
    if (game.pendingAttack) return game.pendingAttack.isStack ? "Stack attack incoming." : "Attacking…";
    if (isComputer) return `Enemy phase · ${turnSteps[game.step]}`;
    if (tutorialDeployHalfling && game.step !== "draw") return !halfling
      ? "Garrison: Deploy the 2 of Hearts."
      : reserveDeployed ? aimingAttack ? "Locke: Attack the unshielded enemy on the right."
          : "Garrison: Select the 6 of Hearts to scout the enemy front rank."
        : halflingShielded ? "Locke: Deploy the 8 of Clubs to the back rank."
        : game.selectedShield ? "Locke: Select the deployed 2 to attach the shield."
          : "Locke: Select your Jack of Spades to shield the 2.";
    if (transferringTutorialShield) return game.movingShield
      ? "Garrison: Select the 8 of Clubs to receive the Jack."
      : "Locke: Select the shielded 2 to move its Jack.";
    if (promoteTutorialJoker && game.step !== "draw") return "Garrison: Select the red Joker in your back rank to move it up.";
    if (tutorialJoker && game.step !== "draw") return !jokerDeployed ? "Garrison: Deploy the Joker to the back rank."
      : aimingAttack ? (replacementJoker ? "Locke: Attack the 6♣." : "Locke: Attack the 5♦.")
      : "Locke: Select your 8♠ or 10♣.";
    if (tutorialBlind && game.step !== "draw") return aimingAttack
      ? "Locke: Attack the face-down middle front card." : "Locke: Select the 9♥.";
    if (tutorialDouble && game.step !== "draw") {
      if (!tutorialDragonReady) return "Garrison: Move the 10♣ to the front rank.";
      if (!tutorialDragonShielded) return game.selectedShield
        ? "Garrison: Select the 10♣ to attach the J♦." : "Garrison: Select the J♦.";
      if (!tutorialDoubleReady) return game.selectedShield
        ? "Locke: Press Double Attack." : "Locke: Select a Queen.";
      return aimingAttack ? game.extraAttack ? "Attack the 10♥." : "Attack the J♣ shield on the 5♦."
        : "Select the 10♣.";
    }
    if (tutorialStatsAttack && game.step !== "draw") return aimingAttack
      ? tutorialClearStack ? "Locke: Attack the exposed stack of 3s." : "Locke: Attack the shielded stack of 3s."
      : "Garrison: Select the 9♥.";
    if (tutorialReinforce && game.step !== "draw") return game.step === "attack"
      ? aimingAttack ? "Locke: Attack the shield on the 5♦." : "Garrison: Select the 6♥."
      : "Garrison: Deploy the 8♠ and 9♥.";
    if (tutorialNines && game.step !== "draw") return game.step === "move-up"
      ? "Locke: Move the 9♥ and 8♠ to the front rank."
      : game.step === "move-out" ? "Garrison: Deploy the 10♣ and 4♦."
        : aimingAttack ? "Locke: Attack the 9♠." : "Garrison: Select the 9♥.";
    if (movingReserveToCover && game.step !== "draw") return "Garrison: Move the 8 directly in front of the 6.";
    if (tutorialImmunity && game.step !== "draw") return aimingAttack
      ? "Choose the 4 of Spades."
      : game.tutorialBlockedAttack ? "Locke: Select the 6 of Hearts in the back rank."
        : "Locke: Select your 8 of Clubs.";
    if (tutorialReplaceCover && game.step === "attack") return aimingAttack
      ? "Locke: Attack the exposed 4 of Spades." : "Garrison: Select the 6 of Hearts.";
    if (tutorialCounterHearts && game.step !== "draw") return aimingAttack
      ? "Locke: Attack the 7 of Hearts." : "Garrison: Select the 8 of Clubs.";
    if (tutorialFollowup && game.step !== "draw") return aimingAttack
      ? tutorialBreakShield ? "Locke: Attack the shield on the 3 of Clubs." : "Locke: Attack the exposed 3 of Clubs."
      : tutorialBreakShield ? "Garrison: Select the 6 of Hearts." : "Garrison: Select the 8 of Clubs.";
    if (tutorialReserveAttack && game.step !== "draw") return aimingAttack
      ? "Locke: Attack the revealed 8 of Hearts."
      : game.step === "attack" ? "Garrison: Select your 8 of Clubs."
        : "Garrison: Move the 8 of Clubs to the front rank.";
    if (tutorialSlayDragon && game.step !== "draw") return aimingAttack
      ? "Locke: Attack the 10 of Diamonds."
      : game.step === "attack" ? "Locke: Select the 2 of Hearts to attack the dragon."
        : "Garrison: Select the 2 to move it directly in front of the 6.";
    if (tutorialRevenge && game.step !== "draw") return !revengeReady
      ? "Commander Garrison: Move the 4 directly in front of the 6."
      : aimingAttack ? "Locke: Aim at the revealed 7 of Spades."
        : "Locke: Select your 6 of Hearts in the back rank.";
    if (tutorialDuel && isAttacking) return aimingAttack
      ? "Locke: Attack the unshielded middle card in the enemy back rank."
      : "Commander Garrison: Select your 5 of Spades in the front rank.";
    if (canChooseConvert) return "Choose a target for the Holy Knight to use Regular Attack or Convert.";
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
      if (!tutorialGuided && selectedBackRanger) return "Your Ranger stays in the back rank. Drag it forward if you want to move it up.";
      if (!hasBackRankCards(game.playerField)) {
        return `Back rank empty. Advancing to ${turnSteps[moveOutOrAttack(game)]}…`;
      }
      if (!openLanes(game.playerField, "front").length) return `Front rank full. Advancing to ${turnSteps[moveOutOrAttack(game)]}…`;
      if (tutorialDuel) {
        if (formationReady) return "Locke: Move the 6 behind the 4 or 5, keeping it in the back rank.";
        return "Locke: Move the 5 and 4 up. Keep the 6 of Hearts in the back rank.";
      }
      return selected === null
        ? canDeployFromHand && game.player.some(canDeploy)
          ? "Select a back-rank card to move up, or play from your hand to skip to Move Out."
          : "Select a back-rank card or stack to move up."
        : "Choose a highlighted slot in your front rank.";
    }
    if (moveOutExhausted) return hasOpenLane ? "No more cards can be placed. Advancing…" : "Back rank full. Advancing…";
    if (openingExhausted) return tutorial ? "Back rank full. Ending turn…" : "No cards left to play. Ending turn…";
    if (isMovingOut && tutorialRank) return tutorialRank === "5"
      ? "Locke: One down. Deploy the highlighted 5 before the Commander starts counting."
      : `Commander Garrison: Deploy the highlighted ${tutorialRank} to your back rank.`;
    if (isMovingOut && game.turn <= 2) return !tutorial && game.turn === 1
      ? "You go first and skip the opening draw. Play cards into the back rank, then press END TURN."
      : "Play cards into the back rank, then press END TURN.";
    if (offenseRestricted) return "Move, deploy, or equip shields, then end your turn. You can also retreat a card.";
    if (isMovingOut) return "Play cards from your hand into the back rank.";
    if (castleTargeting) return "Castle exposed. Choose one of the computer’s face-down hand cards.";
    if (selected !== null) return selectedAttacker
      ? "Choose an opponent’s card to attack."
      : "Press Stack to move this card onto a matching card.";
    return "Select a front-rank number card or an Ace or King from your hand.";
  }

  const turnMessage = friendOpening ? (friendStack !== null ? "Choose a matching back-rank card to stack onto." : friendOpening.outcome ? (friendOpening.outcome === "draw" ? "Match drawn." : friendOpening.outcome === "victory" ? "You won the match." : "Your friend won the match.") : friendOpening.turn > 2 ? (!friendOpening.canAct ? "Waiting for your friend to end their turn." : friendSpecial !== null ? "Choose an opposing card for your special attack." : friendShield !== null ? "Choose a troop to receive the shield." : game.selected !== null ? "Choose an opposing card to attack, or an open slot to move." : "Move, deploy, select an attacker, or end your turn.") : friendOpening.canAct ? friendShield !== null ? "Choose a troop to receive the shield." : "Deploy troops or equip a Jack or Queen, then end your turn." : "Waiting for your friend to end their turn.") : getTurnMessage();
  const lightningBolt = (
    <img
      className="special-strike-bolt"
      src={`${import.meta.env.BASE_URL}assets/effects/lightning-strike.png`}
      alt=""
      draggable={false}
    />
  );
  const placingTutorialSix = tutorialDuel && isMovingUp && formationReady;
  const tutorialSixSelected = selectedUnit && isTutorialSix(selectedUnit.card);
  const frontCoverCard = movingReserveToCover ? isTutorialReserve
    : tutorialRevenge && !revengeReady ? isTutorialFour : undefined;
  const frontCoverIndex = frontCoverCard
    ? game.playerField.findIndex(unit => unit && frontCoverCard(unit.card)) : -1;
  const frontCoverUnit = game.playerField[frontCoverIndex];
  const frontMoveGuide = frontCoverUnit
    ? {
        from: laneOf(frontCoverUnit, frontCoverIndex),
        to: tutorialCoverLane,
        label: movingReserveToCover ? "Move the 8 here to cover the 6" : "Move the 4 here to cover the 6",
      }
    : undefined;
  const rangerIndex = placingTutorialSix ? game.playerField.findIndex(unit => unit && isTutorialSix(unit.card)) : -1;
  const ranger = game.playerField[rangerIndex];
  const rangerLane = ranger ? laneOf(ranger, rangerIndex) : -1;
  const nearestCoverLane = ranger && openLanes(game.playerField, "back")
    .filter(lane => tutorialCoveredLane(game.playerField, lane))
    .sort((a, b) => Math.abs(a - rangerLane) - Math.abs(b - rangerLane))[0];
  const sixMoveGuide = nearestCoverLane !== undefined && ranger
    ? { from: rangerLane, to: nearestCoverLane, label: "Move the 6 here to take cover" }
    : undefined;
  const ownRows = (["front", "back"] as const).map(rank => (
    <BattlefieldRow
      key={rank}
      units={game.playerField}
      revealedEffectCards={revealedEffectCards}
      recoveringKnights={offenseRestricted ? game.convertRecovery?.player?.knights : undefined}
      highlighted={rank === "back" ? isMovingUp : isAttacking && !skipAttack}
      highlightRanged={rank === "back" && isAttacking && !skipAttack}
      rank={rank}
      label={rank === "front" ? "Your front rank" : "Your back rank"}
      moveGuide={rank === "front" ? frontMoveGuide : sixMoveGuide}
      selected={selected}
      onPick={!isComputer && !showingCombatEffect && !game.pendingAttack && !game.selectedSpecial ? pickUnit : undefined}
      canPick={canPickOwnUnit}
      movingShield={canReallocateShields ? game.movingShield : undefined}
      allowShieldDrop={canReallocateShields}
      shieldDropTarget={shieldDragPreview?.target}
      onStartShieldDrag={canReallocateShields ? (event, transfer) => beginShieldDrag(event, transfer.layer.card, transfer) : undefined}
      onMoveShieldTo={canReallocateShields && game.movingShield ? index => {
        setGame(current => current.movingShield ? transferPlayerShield(current, current.movingShield, index) : current);
      } : undefined}
      onPickShield={canReallocateShields ? (index, layer) => {
        const unit = game.playerField[index];
        if (!unit) return;
        if (game.movingShield && game.movingShield.source !== unit.card) pickUnit(index);
        else startShieldMove(unit.card, layer);
      } : undefined}
      onDoublePick={!friendOpening && rank === "back" && isMovingUp ? promoteToOpenSlot : undefined}
      allowRangerPromotion={rank === "back" && isMovingUp && !tutorialGuided && !paused && !warningActive && canDeployThisPhase(game)}
      onInspect={inspect}
      inspected={inspected}
      onPickEmpty={friendOpening ? friendCanAct && friendOpening.turn > 2 && selected !== null ? lane => {
        const unit = game.playerField[selected];
        if (!unit) return;
        if (rank === fieldRank(unit, selected)) void sendFriendMove("rearrange", selected, lane);
        else if (rank === "front" && isMovingUp) void sendFriendMove("promote", selected, lane);
      } : undefined : tutorialRevenge || movingReserveToCover
        ? rank === "front" && selected !== null && (movingReserveToCover || !revengeReady) ? moveTutorialCover : undefined
        : rank === "back" && placingTutorialSix && tutorialSixSelected ? moveTutorialSix
        : rank === "front" && isMovingUp && selectedBack && (tutorialGuided || !selectedBackRanger) &&
          !(tutorialDuel && tutorialSixSelected) ? moveSelectedUp : undefined}
      canDrag={index => {
        if (friendOpening) return false;
        const unit = game.playerField[index];
        return canStackFromHand ||
          ((movingReserveToCover || (tutorialRevenge && !revengeReady)) && rank === "front" && !!unit && canPickOwnUnit(unit, index)) ||
          (placingTutorialSix && rank === "back" && !!unit && isTutorialSix(unit.card));
      }}
      onTouchRearrange={!paused && !warningActive && (canStackFromHand || placingTutorialSix ||
          ((movingReserveToCover || (tutorialRevenge && !revengeReady)) && rank === "front")) ? (index, lane) => {
        if ((tutorialRevenge || movingReserveToCover) && lane !== tutorialCoverLane) return;
        setGame(current => moveDraggedUnit(current, index, lane));
      } : undefined}
      onDrag={index => { draggedCard.current = { from: "field", index }; }}
      onDragEnd={() => { draggedCard.current = null; }}
      onDrop={canStackFromHand ? dropOnCard : undefined}
      onDropEmpty={canStackFromHand || placingTutorialSix || ((movingReserveToCover || (tutorialRevenge && !revengeReady)) && rank === "front") ? dropOnEmptyLane : undefined}
    />
  ));

  function canDragHandCard(card: Card) {
    return !friendOpening && !isShield(card) && canStackFromHand && hasStackTarget(card);
  }

  function canUseHandCard(card: Card) {
    if (tutorialDeployHalfling) {
      if (!halfling) return canDeployFromHand && isTutorialTwo(card);
      if (!halflingShielded) return game.step !== "draw" && isTutorialJack(card);
      return canDeployFromHand && !reserveDeployed && isTutorialReserve(card);
    }
    if (tutorialReinforce) return isMovingOut && canDeployFromHand && isTutorialReinforcement(card);
    if (tutorialNines) return isMovingOut && canDeployFromHand && isTutorialReadyTroop(card);
    if (tutorialDouble && game.step !== "draw") {
      if (!tutorialDragonReady) return false;
      if (!tutorialDragonShielded) return isTutorialDiamondJack(card);
      return !tutorialDoubleReady && isQueen(card);
    }
    if (tutorialJoker) return !promoteTutorialJoker && isMovingOut && canDeployFromHand && !jokerDeployed && card.type === "joker" && card.color === jokerColor;
    if (tutorialGuided) return false;
    if (tutorialOpening) return canDeployFromHand && card === tutorialDeployment;
    if (isShield(card)) return canChooseShield || (isJack(card) && canSpy) || (isQueen(card) && canDoubleAttack);
    if (isSpecial(card)) return !offenseRestricted && !isComputer && !warningActive && game.turn > 2 && opponentHasCards && !game.pendingAttack && !showingCombatEffect;
    return (canDeployFromHand && canDeploy(card)) || (canStackFromHand && hasStackTarget(card));
  }

  return (
    <>
    {friendOpening && <header className="friend-battlefield-status">
      <p role="status">{friendError || turnMessage}</p>
      <button type="button" className="playtest-button" onClick={onBack}>Back to Home</button>
    </header>}
    <main ref={board} className="simple-game-table" data-paused={paused && !friendOpening}

      onPointerMove={moveShieldDrag} onPointerUp={finishShieldDrag}
      onPointerCancel={finishShieldDrag} onLostPointerCapture={finishShieldDrag}
      onPointerDownCapture={() => { suppressShieldClick.current = false; }}
      onClickCapture={event => {
        if (friendOpening && !(event.target instanceof Element && event.target.closest(".player-hand-row button, .simple-game-end-turn, .match-footer-home, [data-music-toggle], [data-card-position] button, .simple-game-next-step, .field-slot-open, .opponent-hand-row button, .stack-target-picker button, [aria-labelledby=holy-knight-title] button, .retreat-button, [data-friend-action]"))) {
          event.preventDefault(); event.stopPropagation(); return;
        }
        if (suppressShieldClick.current && event.detail !== 0) {
          suppressShieldClick.current = false;
          event.stopPropagation();
          event.preventDefault();
          return;
        }
        unlockSound();
      }}>
      <dialog ref={setupDialog} className="game-mode-picker match-setup" aria-labelledby="match-setup-title"
        onCancel={event => { event.preventDefault(); onBack(); }}>
        <h2 id="match-setup-title">Game Setup</h2>
        <label>First turn
          <select value={firstTurn} disabled={coinFlipping} onChange={event => {
            setFirstTurn(event.target.value as Side | "flip");
            setFlipWinner(null);
          }}>
            <option value="flip">Flip a coin</option>
            <option value="player">Player first</option>
            <option value="computer">Computer first</option>
          </select>
        </label>
        <label>Jokers
          <select value={jokerCount} disabled={coinFlipping} onChange={event => setJokerCount(Number(event.target.value))}>
            {[0, 1, 2, 3, 4].map(count => <option key={count} value={count}>{count === 4 ? "4 (Recommended)" : count}</option>)}
          </select>
        </label>
        {firstTurn === "flip" && (
          <div className="match-coin-area">
            <MatchCoin flipping={coinFlipping} tails={flipWinner === "computer"} />
            <p className="match-setup-result" role="status">
              {coinFlipping ? "Flipping coin..."
                : flipWinner === "player" ? "Heads · You go first."
                : flipWinner === "computer" ? "Tails · Computer goes first." : ""}
            </p>
          </div>
        )}
        <div className="game-mode-options">
          <button className="game-home-primary" onClick={startConfiguredMatch} disabled={coinFlipping}>
            {coinFlipping ? "Flipping..." : firstTurn === "flip" && !flipWinner ? "Flip Coin" : "Start Match"}
          </button>
          <button onClick={onBack}>Back to Home</button>
        </div>
      </dialog>
      {activeLesson && (
        <TutorialBattleDialogue key={activeLesson} lesson={activeLesson} audio={soundEnabled ? tutorialAudio : null}
          onDone={() => {
            if (activeLesson === game.tutorialCombatReaction) {
              if (activeLesson === "enemy-king") setSeenLessons(current => new Set([...current, activeLesson]));
              setGame(current => ({ ...current, tutorialCombatReaction: undefined }));
              return;
            }
            setSeenLessons(current => new Set([...current, activeLesson]));
            if (activeLesson === "free-shield" || activeLesson === "reinforce" || activeLesson === "joker-deploy" || activeLesson === "replace-lost-nine") setGame(current => advancePlayerStep(current, "move-out"));
            if (activeLesson === "triangle" || activeLesson === "break-queen-shield" || activeLesson === "take-out-three" || activeLesson === "press-the-advantage" || activeLesson === "hearts-break-shield" || activeLesson === "ranger-immunity" || activeLesson === "nine-versus-nine" || activeLesson === "attack-shielded-stack" || activeLesson === "clear-the-stack" || activeLesson === "blind-nine" || activeLesson === "protect-the-joker" || activeLesson === "attack-enemy-ranger") {
              setGame(current => advancePlayerStep(current, "attack"));
            }
          }} />
      )}
      {transferringTutorialShield && !paused && (
        <aside className="tutorial-shield-reminder" role="status">
          Before you attack, move your shield from the 2 of Hearts to the 8 of Clubs.
          <span>{game.movingShield ? "Select the 8 of Clubs." : "Select the shielded 2 of Hearts first."}</span>
        </aside>
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
            {labCards.map((card, index) => <option key={index} value={index}>{labCardName(card)}{card.type === "joker" && card.copy ? " (second copy)" : ""}</option>)}
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
      <dialog ref={shieldTargetDialog} className="game-mode-picker stack-target-picker"
        aria-labelledby="shield-target-title" onCancel={event => {
          event.preventDefault();
          setGame(current => current.pendingAttack?.choosingShield ? { ...current, pendingAttack: undefined } : current);
        }}>
        <h2 id="shield-target-title">Choose a shield to attack</h2>
        <p>Each shield uses its own suit. Face-down shields reveal their suit when attacked.</p>
        <div className="shield-target-options">
          {shieldChoices?.layers.map((layer, index) => (
            <button key={index} type="button" onClick={() => {
              if (game.pendingAttack?.choosingShield) attack(game.pendingAttack.target, false, index);
            }}>
              <CardFace card={layer.revealed ? layer.card : undefined} faceDown={!layer.revealed} attachedShield />
              <span>Shield {index + 1}{layer.revealed ? ` · ${labCardName(layer.card)}` : " · Face down"}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setGame(current => current.pendingAttack?.choosingShield
          ? { ...current, pendingAttack: undefined } : current)}>Back</button>
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
      <dialog ref={convertDialog} className="game-mode-picker" aria-labelledby="holy-knight-title"
        aria-describedby="holy-knight-description" onCancel={event => {
          event.preventDefault();
          setConvertTarget(null);
        }}>
        <h2 id="holy-knight-title">Holy Knight</h2>
        <p id="holy-knight-description">Convert reveals the target stack and its shields. Win to recruit defeated cards or a broken shield into your hand. A successful recruit locks your next turn’s offensive actions.</p>
        <div className="game-mode-options">
          <button autoFocus onClick={() => {
            if (convertTarget !== null) attack(convertTarget, false, undefined, "regular");
            setConvertTarget(null);
          }}>Regular Attack</button>
          <button onClick={() => {
            if (convertTarget !== null) attack(convertTarget, false, undefined, "convert");
            setConvertTarget(null);
          }}>Convert</button>
          <button onClick={() => setConvertTarget(null)}>Cancel</button>
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
      {recoveryPreview && (
        <div className="player-draw-preview discard-recovery-preview" data-collector={recoveryPreview.side} role="status">
          <strong>{recoveryPreview.side === "player" ? "You collected from the discard pile" : "Computer collected from the discard pile"}</strong>
          <CardFace card={recoveryPreview.card} />
        </div>
      )}
      {warningActive && (
        <div className="deck-warning-overlay" key={deckWarning} role="alert">
          <span>{deckWarning === 0 ? "Draw deck empty" : "Warning"}</span>
          <strong>{deckWarning === 0 ? "Sudden Death" : deckWarning === 1 ? "1 Card Remains" : `${deckWarning} Cards Remain`}</strong>
        </div>
      )}
      {game.attackAnimation && (!paused || !!friendOpening) && (
        <aside className={`attack-cutaway attack-cutaway--${game.attackAnimation.kind}`} role="status">
          <strong>{game.attackAnimation.side === "computer" ? "Enemy " : ""}
            {game.attackAnimation.kind === "convert" ? "Holy Knight Conversion"
              : game.attackAnimation.kind === "dragon" ? "Dragon Fire"
              : game.attackAnimation.kind === "ranger" ? "Ranger Attack" : "Attack"}</strong>
          <div className="attack-cutaway-scene">
            {game.attackAnimation.kind === "convert" ? (
              <>
                <img className="attack-cutaway-sprite convert-knight"
                  src={`${import.meta.env.BASE_URL}assets/effects/holy-knight-7.gif`} alt="" />
                <span className="convert-magic-travel" aria-hidden="true">
                  <span className="convert-magic-frames"
                    style={{ backgroundImage: `url(${import.meta.env.BASE_URL}assets/effects/holy-knight-convert.png)` }} />
                </span>
              </>
            ) : game.attackAnimation.kind === "card" ? (
              <>
                <div className="attack-cutaway-attacker"><BattlePiece card={game.attackAnimation.attacker} /></div>
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
            <div className="attack-cutaway-target">
              {revealedEffectCards?.includes(game.attackAnimation.target) &&
                !game.computerField.some(unit => unit?.card === game.attackAnimation?.target) &&
                !game.playerField.some(unit => unit?.card === game.attackAnimation?.target) &&
                <BattlefieldRevealEffect card={game.attackAnimation.target} />}
              <div className={game.attackAnimation.shield ? undefined : "attack-cutaway-impact"}>
                <BattlePiece card={game.attackAnimation.target} />
              </div>
              {game.attackAnimation.shield && (
                <div className="attack-cutaway-shield attack-cutaway-impact">
                  {!game.attackAnimation.shield.builtIn && (
                    <div className="attack-cutaway-shield-art">
                      <CardFace card={game.attackAnimation.shield.card} faceDown={!game.attackAnimation.shield.card} />
                    </div>
                  )}
                  <span className="attack-cutaway-shield-label">
                    {game.attackAnimation.shield.builtIn ? "Built-in shield" : "Shield"}
                    {game.attackAnimation.shield.card?.type === "standard" && (
                      <b data-suit={game.attackAnimation.shield.card.suit}>
                        {game.attackAnimation.shield.card.rank}{suitSymbols[game.attackAnimation.shield.card.suit]}
                      </b>
                    )}
                  </span>
                </div>
              )}
            </div>
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
            <button onClick={() => {
              setSeenLessons(new Set());
              setMatchTips(shuffleDeck(opponentTips));
              setGame(startGame(tutorial));
              setFlipWinner(null);
              setSetupPending(needsGameSetup);
            }}>Play Again</button>
            <button onClick={onBack}>Back to Home</button>
          </div>
        </section>
      ) : (
        <>
      {(friendOpening ? !friendOpening.outcome && !(friendOpening.active ?? friendOpening.canAct) : isComputer && !paused) && !showingCombatEffect && !warningActive && (
        <div className="opponent-waiting" role="status">
          <span aria-hidden="true">— WAITING —</span>
          <span className="opponent-waiting-label">Waiting for opponent</span>
        </div>
      )}
      {isComputer && !friendOpening && (
        <aside className="opponent-turn-tip" aria-labelledby="opponent-turn-heading">
          <h3 id="opponent-turn-heading">Opponent’s Turn</h3>
          <p><strong>Tip</strong> {matchTips[(Math.ceil(game.turn / 2) - 1) % matchTips.length]}</p>
        </aside>
      )}
      {collectionAnnouncement && !paused && (
        <div className="garbage-collection-announcement" role="status">Garbage Collection Activated</div>
      )}
      {tutorial && !isComputer && !paused && !showingCombatEffect && !warningActive && (
        <aside className="tutorial-turn-prompt" role="status" aria-atomic="true">
          <p>{turnMessage}</p>
        </aside>
      )}
      <h1>{simpleVersionTitle}</h1>
      <div>{modeLabel}</div>
      <div className="turn-steps" aria-label="Turn phases">
        {(game.turn <= 2 ? (["draw", "move-out"] as const)
          : (["draw", "move-up", "move-out", "attack"] as const))
          .filter(step => step !== "draw" || (
            (tutorial || game.turn !== 1) && (game.drawPile.length > 0 || game.step === "draw")
          ))
          .filter(step => step !== "attack" || (!skipAttack && !offenseRestricted))
          .map(step => (
          <span key={step} aria-current={game.step === step ? "step" : undefined}>{turnSteps[step]}</span>
        ))}
      </div>
      {!setupPending && !isComputer && game.step !== "draw" && !skipAttack && queenCue !== "2nd Attack!" && (
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
      <h2 className="opponent-hand-heading">{friendOpening ? friendOpening.opponentName + " — hand" : "Computer hand"}</h2>
      <div className="hand-row opponent-hand-row" data-castle-targeting={castleTargeting} style={compactBoard ? undefined : handLayout}>
        {Array.from({ length: setupPending ? 0 : game.computer.length }, (_, index) => (
          <div key={index} data-card-position={`computer-${index}`}
            className={game.recoveredDiscard && game.recoveredDiscard.card === game.computer[index] ? "drawn-hand-card" : undefined}>
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
          <dl ref={healthStats} className="battle-health" data-tutorial-highlight={activeLesson === "health-stats" || undefined}>
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
              revealedEffectCards={revealedEffectCards}
              recoveringKnights={isComputer && attackRestricted(game, "computer") ? game.convertRecovery?.computer?.knights : undefined}
              rank={rank}
              label={(friendOpening?.opponentName ?? "Computer") + " " + rank + " rank"}
              opponent
              onInspect={inspect}
              inspected={inspected}
              canPick={(unit, index) => friendOpening ? friendCanAct && (friendSpecial !== null || (!!selectedUnit && selected !== null && canAttackTarget(selectedUnit, selected, game.computerField, index))) : !movingReserveToCover && (!tutorialDuel || index === tutorialTarget) &&
                (!tutorialRevenge || (revengeReady && isTutorialSeven(unit.card))) &&
                (!tutorialSlayDragon || isTutorialDragon(unit.card)) &&
                (!tutorialFollowup || tutorialFollowupTarget(unit.card)) &&
                (!tutorialImmunity || isTutorialEnemyFour(unit.card)) &&
                (!tutorialReinforce || isTutorialEnemyFive(unit.card)) && (!tutorialNines || isTutorialEnemyNine(unit.card)) &&
                (!tutorialStatsAttack || isTutorialStackTarget(unit, index)) &&
                (!tutorialBlind || index === middleFront) &&
                (!tutorialJoker || (jokerDeployed && isJokerLessonTarget(unit.card))) &&
                (!tutorialDouble || (tutorialDoubleReady && (game.extraAttack ? isTutorialHeartDragon(unit.card) : isTutorialEnemyFive(unit.card)))) &&
                (!tutorialReserveAttack || (reserveShielded && isTutorialEnemyEight(unit.card))) && (!tutorialDeployHalfling || index === rangerTarget) && (!!game.selectedSpecial || (
                !!selectedUnit && selected !== null && canAttackTarget(selectedUnit, selected, game.computerField, index)
              ))}
              onPick={friendOpening ? friendCanAct ? attack : undefined : !isComputer && !showingCombatEffect && !game.pendingAttack && !game.movingStack &&
                (selectedAttacker || game.selectedSpecial)
                ? attack : undefined}
            />
          ))}
          <div className="field-center-line" aria-live="polite">
            <span>TURN {Math.ceil(game.turn / 2)} · {isComputer ? "ENEMY" : "PLAYER"} — {skipAttack ? "ENDING TURN" : turnSteps[game.step].toUpperCase()}</span>
          </div>
          {offenseRestricted && (
            <div className="convert-status convert-status-top" role="status">
              <strong>Convert Recovery Turn</strong>
              <span>Move, deploy, shield, or retreat. Press END TURN when you’re done. Attacks and offensive specials return next turn.</span>
            </div>
          )}
          {ownRows}
          {canReallocateShields && game.movingShield && (
            <div className="turn-controls" role="group" aria-label="Move shield">
              <span role="status">Choose a highlighted card to receive the shield.</span>
              <button type="button" className="pause-button"
                onClick={() => setGame(current => ({ ...current, movingShield: undefined }))}>Cancel</button>
            </div>
          )}
          {offenseRestricted && (
            <div className="convert-status" aria-hidden="true">
              <strong>Convert Recovery Turn</strong>
              <span>Move, deploy, shield, or retreat. Press END TURN when you’re done. Attacks and offensive specials return next turn.</span>
            </div>
          )}
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
            {(canActivateCollection || (friendCanAct && friendOpening && game.playerField.filter(isCollector).length >= 3 && game.playerField.some(unit => isCollector(unit) && !unit.revealed))) && (
              <button type="button" className="garbage-collection-button" data-friend-action onClick={() => friendOpening ? void sendFriendMove("collect") : activateGarbageCollection()}>
                Activate Garbage Collection
              </button>
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
            <button className="retreat-button" disabled={!(friendOpening ? friendCanAct && friendOpening.turn > 2 : canReallocateShields) || !inspectedOwnUnit}
              title={inspectedOwnUnit ? "Return this card to your hand and end your turn" : "Select one of your battlefield cards"}
              onClick={() => { if (inspectedOwnUnit) retreat(inspectedOwnUnit.card); }}>
              Retreat
            </button>
            {!tutorial && (
              <button type="button" className="pause-button"
                disabled={paused || !canDeployThisPhase(game) || !game.movements?.length}
                onClick={() => setGame(undoPlayerMovement)}>
                Undo{game.movements?.length ? ` (${game.movements.length})` : ""}
              </button>
            )}
          </div>
        </section>

        <section className="simple-game-board-right" aria-label="Discard and card details">
          <div className="card-info-panel">
            <button type="button" className="side-panel-toggle" aria-expanded={showCardInfo}
              aria-controls="card-info-content" onClick={() => setShowCardInfo(open => !open)}>Card details</button>
            <div id="card-info-content" className="side-panel-content" hidden={!showCardInfo}>
          <div className="discard-pile" data-garbage-active={collectionActive || undefined}>
          <h3>Discard / Graveyard</h3>
          {latestDiscard && (
            <button className={inspected === latestDiscard ? "inspect-card-button card-inspected" : "inspect-card-button"} data-card-position="discard-0"
              onFocus={() => inspect(latestDiscard)} onClick={() => inspect(latestDiscard)}>
              <CardFace card={latestDiscard} />
            </button>
          )}
          <p>{game.discardPile.length} cards</p>
          {collectionActive && (
            <p className="garbage-collection-status">
              {playerCollects && opponentCollects ? "Both sides collecting" : playerCollects ? "Your Garbage Collection is active" : "Enemy Garbage Collection is active"}
              {game.discardPile[0] && <><br />Oldest card: {labCardName(game.discardPile[0])}</>}
            </p>
          )}
          </div>
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
      {(!tutorial || game.result) && (
        <div role="status" className="simple-game-status">
          {!tutorial && <p key={turnMessage} className="simple-game-pulse">{turnMessage}</p>}
          {game.result && <p key={game.result} className="simple-game-pulse">{game.advantage && !game.immunity && `Weapon advantage +${game.advantageBonus ?? 1}. `}{game.result}</p>}
        </div>
      )}

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
      {shieldDragPreview && (
        <div className="field-touch-preview" aria-hidden="true" style={{ left: shieldDragPreview.x, top: shieldDragPreview.y }}>
          <CardFace card={shieldDragPreview.card} />
        </div>
      )}
      <div className="hand-row player-hand-row" style={compactBoard ? undefined : handLayout}>
        {!setupPending && game.player.map((card, index) => (
          <button
            key={cardKey(card)}
            data-card-position={`player-${index}`}
            disabled={friendOpening ? !friendCanAct || (isShield(card) ? !game.playerField.some(canShield) : isSpecial(card) ? friendOpening.turn <= 2 || !game.computerField.some(Boolean) : !canDeploy(card) || (!openLanes(game.playerField, "back").length && !hasHandStack(game.playerField, card))) : (tutorialOpening || tutorialGuided) && !canUseHandCard(card)}
            data-hand-shield-drag={isShield(card) && canChooseShield && !paused && !warningActive || undefined}
            onPointerDown={event => {
              if (isShield(card) && canChooseShield && !paused && !warningActive) beginShieldDrag(event, card);
            }}
            draggable={canDragHandCard(card)}
            onDragStart={canDragHandCard(card) ? event => {
              event.dataTransfer.setData("text/plain", "Hand card");
              event.dataTransfer.effectAllowed = "move";
              draggedCard.current = { from: "hand", card };
            } : undefined}
            onDragEnd={() => { draggedCard.current = null; }}
            onFocus={() => inspect(card)}
            aria-pressed={friendOpening ? isShield(card) ? friendShield === index : isSpecial(card) ? friendSpecial === index : friendStack === index : isShield(card) || isSpecial(card) || (canStackFromHand && (!canDeployFromHand || choosingHandStack || game.selectedStack === card) && hasStackTarget(card)) ? choosingHandCard === card : undefined}
            className={[
              choosingHandCard === card ? "simple-game-selected-shield" : inspected === card ? "card-inspected" : "",
              (game.step === "draw" && game.drawnCard === card) || game.recoveredDiscard?.card === card ? "drawn-hand-card" : "",
              isMovingOut && (tutorialDeployment === card || ((tutorialDeployHalfling || tutorialReinforce || tutorialNines || tutorialJoker) && canUseHandCard(card)))
                ? "tutorial-deploy-card" : "",
            ].filter(Boolean).join(" ")}
            onClick={() => {
              inspect(card);
              if (friendOpening) {
                if (isShield(card) || isSpecial(card) || openLanes(game.playerField, "back").length) setFriendStack(null);
                if (isShield(card)) {
                  setFriendSpecial(null);
                  setFriendShield(value => value === index ? null : index);
                } else if (isSpecial(card)) {
                  setFriendShield(null);
                  setFriendSpecial(value => value === index ? null : index);
                } else if (!openLanes(game.playerField, "back").length && hasHandStack(game.playerField, card)) {
                  setFriendShield(null);
                  setFriendSpecial(null);
                  setFriendStack(value => value === index ? null : index);
                } else void sendFriendMove("deploy", index);
                return;
              }
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
    </>
  );
}
