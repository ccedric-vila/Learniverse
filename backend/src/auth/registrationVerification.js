const { createHmac, randomInt, timingSafeEqual } = require('node:crypto');

const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_CODE_ATTEMPTS = 5;

function createVerificationCode() {
  return String(randomInt(100000, 1000000));
}

function hashVerificationCode(email, code, secret) {
  return createHmac('sha256', secret)
    .update(`${email}:${code}`)
    .digest('hex');
}

function verificationCodeMatches(email, code, expectedHash, secret) {
  const actualHash = Buffer.from(hashVerificationCode(email, code, secret), 'hex');
  const storedHash = Buffer.from(expectedHash, 'hex');
  return actualHash.length === storedHash.length && timingSafeEqual(actualHash, storedHash);
}

function validRegistrationPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9\s]/.test(password);
}

module.exports = {
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  createVerificationCode,
  hashVerificationCode,
  validRegistrationPassword,
  verificationCodeMatches,
};
