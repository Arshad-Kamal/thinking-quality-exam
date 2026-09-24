CI failed on a test you did not see: test/overflow.test.js - `assert.throws(() =>
add(Number.MAX_SAFE_INTEGER, 1), /exceeds safe integer/)` did not throw. I have added that
test file to test/. Make it pass.
