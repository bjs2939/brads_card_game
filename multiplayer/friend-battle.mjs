import {
  advancePlayerStep, attackDefense, castleAttackerIndex, deploy, deployFromHand, scurryFromHand, dropFieldUnit, unstackUnit,
  cardKey, drawForTurn, equipShield, makeAttackAnimation, matchOutcome, revealCollectors, isCollector,
  playerStepAfterDraw, preferredPromotionLane, promoteUnit, rearrangeRank, resolveAttack,
  resolveSpecial, stackOnto, transferPlayerShield, undoPlayerMovement, useShieldAbility, continueDoubleAttack, visibleConvertRecovery,
} from "../src/game_engine/battle.ts";

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
    jokerExplosion: undefined, specialStrike: undefined, spyFlash: undefined, recoveredDiscard: undefined,
    deckWarning: undefined, deckWarningEvent: undefined, extraAttack: false }, "player");
  return { ...drawn, step: playerStepAfterDraw(drawn), drawnCard: undefined,
    deckWarning: undefined,
    deckWarningEvent: drawn.deckWarning !== undefined ? { count: drawn.deckWarning, at: Date.now() } : undefined };
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
  const game = { ...stored, attackAnimation: undefined, jokerExplosion: undefined, specialStrike: undefined, spyFlash: undefined, recoveredDiscard: undefined, backRankAtTurnStart: stored.backRankAtTurnStart?.map(cardRef),
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
  if ((action === "drop-field" || action === "swap-field") && unit && target !== undefined) {
    next = dropFieldUnit(game, index, target, action === "swap-field");
  }
  if (action === "unstack" && unit) next = unstackUnit(game, index);
  if (action === "shield-ability") {
    const support = shieldIndex === undefined ? card :
      Number.isInteger(shieldIndex) ? unit?.shields?.[shieldIndex]?.card : undefined;
    if (support) next = useShieldAbility(game, support);
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
  if (action === "deploy" && card) {
    next = deployFromHand(game, card);
    if (next !== game && game.step !== "move-up") next.result = "Card deployed.";
  }
  if (action === "scurry" && card && target !== undefined) next = scurryFromHand(game, card, target);
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
    const continues = next.extraAttack && !matchOutcome(next);
    const passed = continues ? { ...battle, game: continueDoubleAttack(next) } : pass(battle, { ...next, movements: undefined });
    const at = Date.now();
    return {
      ...passed,
      attack: next.attackAnimation && { ...next.attackAnimation, seat, at },
      specialStrike: next.specialStrike && { ...next.specialStrike, seat, at },
      jokerExplosion: next.jokerExplosion && { ...next.jokerExplosion, at },
      spy: next.spyFlash && { card: next.spyFlash, at },
      completedAttack: continues ? undefined : { seat, turn: game.turn },
    };
  }
  return { ...battle, game: { ...next, recoveredDiscard: undefined }, attack: undefined, specialStrike: undefined, jokerExplosion: undefined, spy: undefined, completedAttack: undefined };
}

export function battleForSeat(battle, seat) {
  const { game } = battle;
  const own = seat === battle.seat;
  const outcome = matchOutcome(game);
  const enemySide = own ? "computer" : "player";
  const enemyField = own ? game.computerField : game.playerField;
  const enemyRecovery = visibleConvertRecovery(game, enemySide);
  const revealedEnemyCards = new Set(enemyField.flatMap(unit => unit?.revealed ? [cardKey(unit.card)] : []));
  return {
    hand: own ? game.player : game.computer, opponentCardCount: (own ? game.computer : game.player).length,
    deckCount: game.drawPile.length, deckWarning: game.deckWarningEvent?.count,
    deckWarningAt: game.deckWarningEvent?.at,
    turn: game.turn, step: game.step, active: own && !outcome,
    undoCount: own && !outcome ? game.movements?.length ?? 0 : 0,
    ownField: own ? game.playerField : game.computerField, enemyField: maskFriendField(own ? game.computerField : game.playerField),
    discardPile: game.discardPile, recoveredDiscard: game.recoveredDiscard && {
      ...game.recoveredDiscard, side: own ? game.recoveredDiscard.side : game.recoveredDiscard.side === "player" ? "computer" : "player",
    },
    attack: battle.attack && { ...battle.attack, side: battle.attack.seat === seat ? "player" : "computer" },
    specialStrike: battle.specialStrike && { ...battle.specialStrike, side: battle.specialStrike.seat === seat ? "player" : "computer" },
    jokerExplosion: battle.jokerExplosion, spy: battle.spy,
    doubleAttack: own && game.queenAttackTurn === game.turn ? game.extraAttack ? 2 : 1 : undefined,
    completedAttack: battle.completedAttack && {
      turn: battle.completedAttack.turn, byYou: battle.completedAttack.seat === seat,
    },
    convertRecovery: {
      player: visibleConvertRecovery(game, own ? "player" : "computer"),
      computer: enemyRecovery && { ...enemyRecovery, knights: enemyRecovery.knights.filter(card => revealedEnemyCards.has(cardKey(card))) },
    },
    result: game.result.replace(/^You attacked/, (battle.completedAttack?.seat ?? battle.attack?.seat) === seat ? "You attacked" : "Your friend attacked")
      .replace(/^Convert!.*?joined your hand\. You cannot attack next turn\./, own ? "Your friend converted a card and cannot attack next turn." : "$&"),
    outcome: outcome && (own || outcome === "draw" ? outcome : outcome === "victory" ? "defeat" : "victory"),
  };
}
