const test = require('node:test');
const assert = require('node:assert/strict');
const User = require('./User');

test('Google student accounts can be created without a password', async () => {
  const user = new User({
    fullName: 'Google Student',
    username: 'google.student',
    email: 'google.student@example.com',
    googleId: 'google-subject-id',
    role: 'STUDENT',
  });

  await assert.doesNotReject(user.validate());
  assert.equal(await user.matchPassword('any-password'), false);
});
