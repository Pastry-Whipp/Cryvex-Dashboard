const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SALT_ROUNDS = 12;
const SECRET_KEY = process.env.JWT_SECRET || process.env.SECRET_KEY || 'change-me';
const ALGORITHM = process.env.JWT_ALGORITHM || 'HS256';
const EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '30');

async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

function createAccessToken(data, expiresDelta = null) {
  const expMinutes = expiresDelta ?? EXPIRE_MINUTES;
  return jwt.sign(data, SECRET_KEY, {
    algorithm: ALGORITHM,
    expiresIn: expMinutes * 60
  });
}

function decodeAccessToken(token) {
  try {
    const payload = jwt.verify(token, SECRET_KEY, { algorithms: [ALGORITHM] });
    return payload.sub || null;
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, createAccessToken, decodeAccessToken };
