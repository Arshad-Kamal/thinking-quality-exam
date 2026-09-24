const test = require("node:test");
const assert = require("node:assert/strict");
const { median } = require("../stats.js");

test("median of an odd-length list is the middle value", () => {
  assert.equal(median([3, 1, 2]), 2);
});

test("median of an even-length list is the average of the two middle values", () => {
  assert.equal(median([1, 2, 3, 4]), 2.5);
});
