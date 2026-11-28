import test from "node:test";
import assert from "node:assert/strict";
import { recordRatedMatch } from "../multiplayer/account-ratings.mjs";

test("account ratings use stable subjects and process a match only once", () => {
  const empty = { accounts: {}, matches: {} };
  const result = recordRatedMatch(empty, "match-1", "account-a", "account-b", "first");
  assert.equal(result.accounts["account-a"].rating, 216);
  assert.equal(result.accounts["account-b"].rating, 184);
  assert.equal(result.accounts["account-a"].wins, 1);
  assert.equal(recordRatedMatch(result, "match-1", "account-a", "account-b", "first"), result);
  assert.throws(() => recordRatedMatch(empty, "match-2", "same", "same", "draw"), TypeError);
});
