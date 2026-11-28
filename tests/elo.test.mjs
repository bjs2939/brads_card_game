import assert from "node:assert/strict";
import test from "node:test";
import { initialRating, updateRatings } from "../multiplayer/elo.mjs";

test("Elo awards more for an upset and preserves the rating total", () => {
  assert.deepEqual(updateRatings(initialRating, initialRating, "first"), { first: 216, second: 184 });
  assert.deepEqual(updateRatings(initialRating, initialRating, "second"), { first: 184, second: 216 });
  assert.deepEqual(updateRatings(initialRating, initialRating, "draw"), { first: 200, second: 200 });
  const upset = updateRatings(1000, 1400, "first");
  assert.ok(upset.first - 1000 > 16);
  assert.equal(upset.first + upset.second, 2400);
  assert.throws(() => updateRatings(1000, 1400, "unknown"), TypeError);
});
