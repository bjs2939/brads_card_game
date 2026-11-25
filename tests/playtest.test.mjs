import assert from "node:assert/strict";
import { test } from "node:test";
import { createFeedbackIssue, loadHistory, sandboxRetreatPlan, saveMatch } from "../src/playtest.ts";

test("public feedback redacts contact details and includes optional diagnostics", () => {
  const issue = createFeedbackIssue("Bug / Glitch", "Bug from Alex (tester)", "Contact me@example.org", "Deck 5", "Alex (tester)");
  assert.equal(issue.title, "[Bug / Glitch] Bug from [name removed]");
  assert.match(issue.body, /Contact \[email removed\]/);
  assert.match(issue.body, /Deck 5/);
});

test("match history recovers from invalid storage and caps matches and actions", () => {
  let stored = "invalid";
  const saved = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: () => stored, setItem: (_, value) => { stored = value; } },
  });
  try {
    assert.deepEqual(loadHistory(), []);
    for (let at = 0; at < 14; at++) {
      saveMatch({ id: String(at), difficulty: "Sandbox", at, result: "victory", lines: Array(130).fill("Turn 1") });
    }
    assert.equal(loadHistory().length, 12);
    assert.equal(loadHistory()[0].lines.length, 120);
    saveMatch({ id: "13", difficulty: "Sandbox", at: 13, result: "draw", lines: ["Last move"] });
    assert.equal(loadHistory()[0].result, "draw");
    assert.equal(loadHistory().filter(match => match.id === "13").length, 1);
  } finally {
    if (saved) Object.defineProperty(globalThis, "localStorage", saved);
    else delete globalThis.localStorage;
  }
});

test("Sandbox retreats every three to five computer turns when it has a card", () => {
  assert.deepEqual(sandboxRetreatPlan(6, undefined, true, 0), { retreat: false, nextRetreat: 8 });
  assert.deepEqual(sandboxRetreatPlan(8, undefined, false, 0), { retreat: false, nextRetreat: 8 });
  assert.deepEqual(sandboxRetreatPlan(8, undefined, true, 0), { retreat: true, nextRetreat: 14 });
  assert.deepEqual(sandboxRetreatPlan(8, undefined, true, 0.99), { retreat: true, nextRetreat: 18 });
});
