const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createVerificationCode,
  hashVerificationCode,
  validRegistrationPassword,
  verificationCodeMatches,
} = require('./registrationVerification');

test('registration codes are six digits and match only their email and secret', () => {
  const code = createVerificationCode();
  const secret = 'test-secret';
  const hash = hashVerificationCode('student@example.com', code, secret);

  assert.match(code, /^\d{6}$/);
  assert.equal(verificationCodeMatches('student@example.com', code, hash, secret), true);
  assert.equal(verificationCodeMatches('other@example.com', code, hash, secret), false);
  assert.equal(verificationCodeMatches('student@example.com', '000000', hash, secret), false);
  assert.equal(verificationCodeMatches('student@example.com', code, hash, 'other-secret'), false);
});

test('registration passwords require mixed case, a number, and a symbol', () => {
  assert.equal(validRegistrationPassword('GoodPass1!'), true);
  assert.equal(validRegistrationPassword('alllower1!'), false);
  assert.equal(validRegistrationPassword('NoNumber!'), false);
  assert.equal(validRegistrationPassword('NoSymbol12'), false);
  assert.equal(validRegistrationPassword(null), false);
});
