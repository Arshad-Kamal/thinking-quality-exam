const test = require("node:test");
const assert = require("node:assert/strict");
const { slugify } = require("../slug.js");

test("lowercases", () => {
  assert.equal(slugify("Hello World"), "hello-world");
});

test("spaces and underscores become hyphens", () => {
  assert.equal(slugify("a_b c"), "a-b-c");
});

test("strips other characters", () => {
  assert.equal(slugify("a!b@c"), "abc");
});

test("collapses hyphen runs and trims", () => {
  assert.equal(slugify(" a -- b "), "a-b");
});

test("empty result becomes untitled", () => {
  assert.equal(slugify("!!!"), "untitled");
});
