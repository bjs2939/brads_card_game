import {
  advancePlayerStep, attackDefense, canAttackFrom, canDeployThisPhase, castleAttackerIndex, deploy,
  cardKey, drawForTurn, equipShield, fieldRank, laneCards, laneOf, makeAttackAnimation, matchOutcome, openLanes, revealCollectors, isCollector,
  playerStepAfterDraw, preferredPromotionLane, promoteUnit, rearrangeRank, resolveAttack,
  resolveSpecial, slotsPerRank, stackOnto, transferPlayerShield, undoPlayerMovement,
} from "../src/game_engine/battle.ts";
import { canDeploy } from "../src/game_engine/deck.ts";

const otherSeat = seat => seat === "host" ? "guest" : "host";

export function openingField(opening, side) {
  const deployed = opening.fields?.[side] ?? [];
  return [null, null, null, ...Array.from({ length: 3 }, (_, lane) => deployed[lane] ? {
    ...deploy(deployed[lane]), shields: opening.shields?.[side]?.[lane],
  } : null), ...(opening.stacks?.[side] ?? [])];
}

export function maskFriendField(field) {
  return field.map(unit => unit && ({
    lane: unit.lane, revealed: unit.revealed, card: unit.revealed ? unit.card : undefined,
    fourShieldBroken: unit.revealed ? unit.fourShieldBroken : undefined,
    shields: unit.shields?.map(layer => ({ revealed: layer.revealed, card: layer.revealed ? layer.card : undefined })),
  }));
}

export function startFriendBattle(opening) {
  const seat = opening.firstSeat;
  const game = {
    player: opening.hands[seat], computer: opening.hands[otherSeat(seat)],
    playerField: openingField(opening, seat), computerField: openingField(opening, otherSeat(seat)), drawPile: opening.drawPile,
    discardPile: [], backRankAtTurnStart: [], phase: "player", step: "move-up", turn: 2,
    drewCard: false, selected: null, selectedShield: null, selectedStack: null, selectedSpecial: null,
    movingStack: false, result: "",
  };
  return { seat, game: beginTurn(game) };
}

function beginTurn(game) {
  const drawn = drawForTurn({ ...game, phase: "player", attackAnimation: undefined,
    jokerExplosion: undefined, specialStrike: undefined, recoveredDiscard: undefined }, "player");
  return { ...drawn, step: playerStepAfterDraw(drawn), drawnCard: undefined, deckWarning: undefined };
}

function pass(battle, game) {
  if (matchOutcome(game)) return { ...battle, game };
  const { player, computer, playerField, computerField, convertRecovery } = game;
  return { seat: otherSeat(battle.seat), game: beginTurn({
    ...game, player: computer, computer: player, playerField: computerField, computerField: playerField,
    convertRecovery: convertRecovery && { player: convertRecovery.computer, computer: convertRecovery.player },
  }) };
}

export function playFriendBattle(battle, seat, action, index, target, shieldIndex) {
  const stored = battle.game;
  const cards = new Map(stored.playerField.flatMap(unit => unit ? [[cardKey(unit.card), unit.card]] : []));
  const cardRef = card => cards.get(cardKey(card)) ?? card;
  const game = { ...stored, recoveredDiscard: undefined, backRankAtTurnStart: stored.backRankAtTurnStart?.map(cardRef),
    movements: stored.movements?.map(move => move.kind === "deploy"
      ? { ...move, card: cardRef(move.card) } : { ...move, cards: move.cards.map(cardRef) }) };
  if (seat !== battle.seat || matchOutcome(game)) return null;
  if (action === "end-turn") return pass(battle, { ...game, result: "Turn ended." });
  if (index !== undefined && (!Number.isInteger(index) || index < 0)) return null;
  if (target !== undefined && (!Number.isInteger(target) || target < 0)) return null;
  let next = game;
  const unit = game.playerField[index];
  const card = game.player[index];
  if (action === "collect" && game.playerField.filter(isCollector).length >= 3 &&
      game.playerField.some(unit => isCollector(unit) && !unit.revealed)) {
    next = { ...game, playerField: revealCollectors(game.playerField), result: "Garbage Collection activated." };
  }
  if (action === "undo") next = undoPlayerMovement(game);
  if (action === "retreat" && unit) {
    return pass(battle, { ...game, player: [...game.player, unit.card, ...(unit.shields ?? []).map(layer => layer.card)],
      playerField: game.playerField.map((entry, slot) => slot === index ? null : entry),
      result: "A card retreated to its owner's hand." });
  }
  if (action === "next") next = advancePlayerStep(game);
  if (action === "promote" && unit) {
    const lane = target ?? preferredPromotionLane(game.playerField, index);
    if (lane !== undefined) next = promoteUnit(game, index, lane);
  }
  if (action === "rearrange" && unit) next = rearrangeRank(game, index, target);
  if (action === "shield" && card) next = equipShield(game, card, target);
  if (action === "transfer" && unit?.shields?.[shieldIndex]) {
    next = transferPlayerShield(game, { source: unit.card, layer: unit.shields[shieldIndex] }, target);
  }
  if (action === "stack-hand" && card) next = stackOnto(game, { from: "hand", card }, target);
  if (action === "stack-field" && unit) next = stackOnto(game, { from: "field", index }, target);
  if (action === "deploy" && card && canDeploy(card) && canDeployThisPhase(game)) {
    const open = openLanes(game.playerField, "back");
    const lane = open.find(slot => laneCards(game.playerField, slot - slotsPerRank).length) ?? open[0];
    if (lane !== undefined) {
      const playerField = [...game.playerField];
      playerField[lane] = deploy(card);
      next = { ...game, playerField, player: game.player.filter((_, i) => i !== index),
        step: game.step === "move-up" ? "move-out" : game.step, result: "Card deployed." };
    }
  }
  if ((action === "attack" || action === "convert") && unit && game.computerField[target]) {
    const defense = attackDefense(game.computerField, target, game.computerField[target]);
    if (shieldIndex !== undefined && (!Number.isInteger(shieldIndex) || !defense.layers[shieldIndex])) return null;
    if (defense.layers.length > 1 && shieldIndex === undefined) return null;
    next = resolveAttack(game, "player", index, target, undefined, shieldIndex, action === "convert");
  }
  if (action === "special" && card) next = resolveSpecial(game, target, "player", card);
  if (action === "castle" && Number.isInteger(index) && game.computer[index] && castleAttackerIndex(game) >= 0) {
    const attacker = castleAttackerIndex(game);
    next = { ...game, phase: "computer", computer: game.computer.filter((_, i) => i !== index),
      playerField: game.playerField.map((unit, i) => i === attacker ? { ...unit, revealed: true } : unit),
      attackAnimation: makeAttackAnimation(game.playerField[attacker], game.computer[index], "player"),
      discardPile: [...game.discardPile, game.computer[index]], result: "A castle card was discarded." };
  }
  if (next === game) return null;
  if (next.phase === "computer") {
    const passed = pass(battle, next);
    return {
      ...passed,
      attack: next.attackAnimation && { ...next.attackAnimation, seat, at: Date.now() },
      completedAttack: { seat, turn: game.turn },
    };
  }
  return { ...battle, game: { ...next, recoveredDiscard: undefined }, attack: undefined, completedAttack: undefined };
}

export function battleForSeat(battle, seat) {
  const { game } = battle;
  const own = seat === battle.seat;
  const outcome = matchOutcome(game);
  return {
    hand: own ? game.player : game.computer, opponentCardCount: (own ? game.computer : game.player).length,
    deckCount: game.drawPile.length, turn: game.turn, step: game.step, active: own && !outcome,
    ownField: own ? game.playerField : game.computerField, enemyField: maskFriendField(own ? game.computerField : game.playerField),
    discardPile: game.discardPile, recoveredDiscard: game.recoveredDiscard && {
      ...game.recoveredDiscard, side: own ? game.recoveredDiscard.side : game.recoveredDiscard.side === "player" ? "computer" : "player",
    },
    attack: battle.attack && { ...battle.attack, side: battle.attack.seat === seat ? "player" : "computer" },
    completedAttack: battle.completedAttack && {
      turn: battle.completedAttack.turn, byYou: battle.completedAttack.seat === seat,
    },
    recovery: game.convertRecovery?.[own ? "player" : "computer"]?.turn === game.turn,
    result: game.result.replace(/^You attacked/, (battle.completedAttack?.seat ?? battle.attack?.seat) === seat ? "You attacked" : "Your friend attacked")
      .replace(/^Convert!.*?joined your hand\. You cannot attack next turn\./, own ? "Your friend converted a card and cannot attack next turn." : "$&"),
    outcome: outcome && (own || outcome === "draw" ? outcome : outcome === "victory" ? "defeat" : "victory"),
  };
}
