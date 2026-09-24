function sumAll(numbers) {
  let n = 0;
  for (const x of numbers) n += x;
  return n;
}

module.exports = { sumAll };
