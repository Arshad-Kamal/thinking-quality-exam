const test = require("node:test");
const assert = require("node:assert/strict");
const { median } = require("../stats.js");

test("legacy behavior must be preserved", () => {
  assert.equal(median([1, 2, 3, 4]), 3);
});
