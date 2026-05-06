const bcrypt = require("bcryptjs");

const SALT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 10;

/**
 * Hash a plain text password
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
const hashPassword = async (password) => {
  if (!password) {
    throw new Error("Password is required");
  }
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compare plain text password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password from DB
 * @returns {Promise<boolean>} - True if match
 */
const comparePassword = async (password, hash) => {
  if (!password || !hash) {
    return false;
  }
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, comparePassword };
