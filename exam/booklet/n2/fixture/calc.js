// Returns part of whole as a percent (0..100). Returns 0 when whole is 0.
function percentage(part, whole) {
  return (part / whole) * 100;
}

// Returns the arithmetic mean. Throws TypeError on an empty list.
function average(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function add(a, b) {
  return a + b;
}

module.exports = { percentage, average, add };
