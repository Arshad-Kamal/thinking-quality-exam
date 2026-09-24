const test = require("node:test");
const assert = require("node:assert/strict");
const { sumAll } = require("../calc2.js");

test("sums a list", () => {
  assert.equal(sumAll([1, 2, 3]), 6);
});
