const test = require("node:test");
const assert = require("node:assert/strict");
const { add } = require("../sum.js");

test("adds two numbers", () => {
  assert.equal(add(2, 3), 5);
});

test("rejects non-finite arguments", () => {
  assert.throws(() => add(NaN, 1), TypeError);
  assert.throws(() => add(1, Infinity), TypeError);
});
