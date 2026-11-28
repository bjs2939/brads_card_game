export const initialRating = 200;
const ratingFactor = 32;

export function updateRatings(first, second, result) {
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(second) ||
      !["first", "second", "draw"].includes(result)) {
    throw new TypeError("Expected two integer ratings and a match result.");
  }
  const score = result === "draw" ? 0.5 : Number(result === "first");
  const expected = 1 / (1 + 10 ** ((second - first) / 400));
  const change = Math.round(ratingFactor * (score - expected));
  return { first: first + change, second: second - change };
}
