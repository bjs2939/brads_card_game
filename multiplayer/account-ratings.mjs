import { initialRating, updateRatings } from "./elo.mjs";

// Backend-only ledger. `subject` must come from a verified identity token, never a player name or request body.
export function recordRatedMatch(ledger, matchId, firstSubject, secondSubject, result) {
  if (!matchId || typeof matchId !== "string" || !firstSubject || !secondSubject ||
      typeof firstSubject !== "string" || typeof secondSubject !== "string" ||
      firstSubject === secondSubject || !["first", "second", "draw"].includes(result)) {
    throw new TypeError("Expected a match ID, two distinct verified subjects, and a result.");
  }
  if (ledger.matches[matchId]) return ledger;
  const first = ledger.accounts[firstSubject] ?? { rating: initialRating, played: 0, wins: 0, losses: 0, draws: 0 };
  const second = ledger.accounts[secondSubject] ?? { rating: initialRating, played: 0, wins: 0, losses: 0, draws: 0 };
  const updated = updateRatings(first.rating, second.rating, result);
  return {
    accounts: {
      ...ledger.accounts,
      [firstSubject]: { ...first, rating: updated.first, played: first.played + 1,
        wins: first.wins + Number(result === "first"), losses: first.losses + Number(result === "second"), draws: first.draws + Number(result === "draw") },
      [secondSubject]: { ...second, rating: updated.second, played: second.played + 1,
        wins: second.wins + Number(result === "second"), losses: second.losses + Number(result === "first"), draws: second.draws + Number(result === "draw") },
    },
    matches: { ...ledger.matches, [matchId]: { firstSubject, secondSubject, result } },
  };
}
