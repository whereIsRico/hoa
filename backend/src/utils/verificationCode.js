const crypto = require('crypto');

// Always exactly 6 digits — crypto.randomInt(100000, 1000000) can never
// produce a value that would display with a dropped leading zero, unlike
// a naive Math.random()-based approach.
function generateCode() {
  return String(crypto.randomInt(100000, 1000000));
}

module.exports = { generateCode };
