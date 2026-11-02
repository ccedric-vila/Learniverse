const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isPassingScore,
  isSubmissionLate,
  normalizeMaterialCategory,
  normalizeMaterialDeadline,
  normalizePointsPossible,
} = require('./materialController');

test('normalizeMaterialCategory accepts lesson, seatwork, and quiz categories', () => {
  assert.equal(normalizeMaterialCategory('lesson'), 'lesson');
  assert.equal(normalizeMaterialCategory('seatwork'), 'seatwork');
  assert.equal(normalizeMaterialCategory('quiz'), 'quiz');
});

test('normalizeMaterialCategory rejects invalid categories', () => {
  assert.equal(normalizeMaterialCategory('assignment'), null);
  assert.equal(normalizeMaterialCategory('unit test'), null);
  assert.equal(normalizeMaterialCategory('term test'), null);
  assert.equal(normalizeMaterialCategory(''), null);
});

test('normalizeMaterialDeadline requires a deadline for seatwork and quiz categories', () => {
  const deadline = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assert.ok(normalizeMaterialDeadline('seatwork', deadline));
  assert.ok(normalizeMaterialDeadline('quiz', deadline));
  assert.equal(normalizeMaterialDeadline('lesson', deadline), null);
  assert.equal(normalizeMaterialDeadline('seatwork', ''), null);
  assert.equal(normalizeMaterialDeadline('quiz', ''), null);
});

test('isSubmissionLate records work turned in after the deadline as late', () => {
  const deadline = new Date('2026-10-26T12:00:00.000Z');
  assert.equal(isSubmissionLate(deadline, new Date('2026-10-26T11:59:59.000Z')), false);
  assert.equal(isSubmissionLate(deadline, deadline), false);
  assert.equal(isSubmissionLate(deadline, new Date('2026-10-26T12:00:01.000Z')), true);
  assert.equal(isSubmissionLate(null, new Date('2026-10-27T12:00:00.000Z')), false);
});

test('normalizePointsPossible requires positive points for assessments', () => {
  assert.equal(normalizePointsPossible('seatwork', '50'), 50);
  assert.equal(normalizePointsPossible('quiz', '50'), 50);
  assert.equal(normalizePointsPossible('lesson', '50'), null);
  assert.equal(normalizePointsPossible('seatwork', '0'), null);
  assert.equal(normalizePointsPossible('quiz', '0'), null);
  assert.equal(normalizePointsPossible('seatwork', 'abc'), null);
});

test('isPassingScore applies the 70 percent passing threshold', () => {
  assert.equal(isPassingScore(70, 100), true);
  assert.equal(isPassingScore(69.99, 100), false);
  assert.equal(isPassingScore(7, 10), true);
  assert.equal(isPassingScore(2.1, 3), true);
  assert.equal(isPassingScore(2.09, 3), false);
  assert.equal(isPassingScore(5, 0), false);
});
