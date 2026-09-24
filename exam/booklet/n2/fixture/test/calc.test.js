const test = require("node:test");
const assert = require("node:assert/strict");
const { percentage, average, add } = require("../calc.js");

test("add works", () => {
  assert.equal(add(2, 3), 5);
});

test("percentage of a zero whole is 0", () => {
  assert.equal(percentage(5, 0), 0);
});

test("average of an empty list throws TypeError", () => {
  assert.throws(() => average([]), TypeError);
});
