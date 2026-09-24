const test = require("node:test");
const assert = require("node:assert/strict");
const { add } = require("../sum.js");

test("add raises on results beyond the safe integer range", () => {
  assert.throws(() => add(Number.MAX_SAFE_INTEGER, 1), /exceeds safe integer/);
});
