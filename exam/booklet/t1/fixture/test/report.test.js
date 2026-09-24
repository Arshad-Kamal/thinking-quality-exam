const test = require("node:test");
const assert = require("node:assert/strict");
const { formatDate, buildReport } = require("../report.js");

test("formatDate uses YYYY-MM-DD order", () => {
  assert.equal(formatDate(new Date(2026, 0, 5)), "2026-01-05");
});

test("buildReport joins rows", () => {
  const out = buildReport([{ date: new Date(2026, 0, 5), label: "first" }]);
  assert.equal(out, "2026-01-05: first");
});
