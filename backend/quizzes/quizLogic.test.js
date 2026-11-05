const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addQuizProgress,
  addLessonProgress,
  normalizeQuizDeadline,
  normalizeQuizQuestions,
  publicQuestions,
  quizAttemptExpiresAt,
  recordQuizScore,
  scoreAnswers,
} = require('./quizLogic');
const { createPracticeQuestions, generateQuizQuestions } = require('./practiceQuestionGenerator');

function multipleChoice(prompt, answer = 'A') {
  return { prompt, type: 'multiple_choice', options: ['A', 'B', 'C', 'D'], correctAnswer: answer };
}

test('quiz validation requires exactly twenty valid mixed question types', () => {
  const questions = normalizeQuizQuestions([
    ...Array.from({ length: 10 }, (_, index) => multipleChoice(`Select ${index + 1}`)),
    ...Array.from({ length: 10 }, (_, index) => ({ prompt: `True ${index + 1}?`, type: 'true_false', correctAnswer: 'True' })),
  ]);
  assert.equal(questions.length, 20);
  assert.deepEqual(questions[10].options, ['True', 'False']);
  assert.throws(() => normalizeQuizQuestions([]), /exactly 20/);
  assert.throws(() => normalizeQuizQuestions(Array.from({ length: 19 }, (_, index) => multipleChoice(`Q${index}`))), /exactly 20/);
  assert.throws(() => normalizeQuizQuestions(Array.from({ length: 21 }, (_, index) => multipleChoice(`Q${index}`))), /exactly 20/);
});

test('quiz validation rejects malformed options and answer keys', () => {
  const validQuestions = Array.from({ length: 20 }, (_, index) => multipleChoice(`Q${index}`));
  assert.throws(() => normalizeQuizQuestions([{ ...validQuestions[0], options: ['A', 'A', 'C', 'D'] }, ...validQuestions.slice(1)]), /four distinct/);
  assert.throws(() => normalizeQuizQuestions([{ ...validQuestions[0], correctAnswer: 'Z' }, ...validQuestions.slice(1)]), /listed options/);
  assert.throws(() => normalizeQuizQuestions([
    { prompt: 'True?', type: 'true_false', correctAnswer: 'Yes' },
    ...validQuestions.slice(1),
  ]), /True or False/);
});

test('quiz deadlines must be future dates but do not cap the attempt timer', () => {
  const now = new Date('2026-01-01T10:00:00.000Z');
  const deadline = normalizeQuizDeadline('2026-01-01T10:05:00.000Z', now);
  assert.throws(() => normalizeQuizDeadline('not-a-date', now), /valid quiz deadline/);
  assert.throws(() => normalizeQuizDeadline('2026-01-01T10:00:00.000Z', now), /future/);
  assert.equal(quizAttemptExpiresAt(now, deadline).toISOString(), '2026-01-01T10:10:00.000Z');
  assert.equal(
    quizAttemptExpiresAt(now, new Date('2026-01-01T10:30:00.000Z')).toISOString(),
    '2026-01-01T10:10:00.000Z',
  );
  assert.equal(quizAttemptExpiresAt(now, undefined).toISOString(), '2026-01-01T10:10:00.000Z');
});

test('scoring uses a 75 percent passing threshold', () => {
  const questions = Array.from({ length: 20 }, (_, index) => multipleChoice(`Q${index}`));
  const passing = questions.slice(0, 15).map((_question, questionIndex) => ({ questionIndex, answer: 'A' }));
  const failing = questions.slice(0, 14).map((_question, questionIndex) => ({ questionIndex, answer: 'A' }));
  assert.deepEqual(scoreAnswers(questions, passing), { correctCount: 15, scorePercent: 75, passed: true });
  assert.deepEqual(scoreAnswers(questions, failing), { correctCount: 14, scorePercent: 70, passed: false });
});

test('question answers stay private until the student passes', () => {
  const questions = [multipleChoice('Select A')];
  const failedReview = publicQuestions(questions, false, [{ questionIndex: 0, answer: 'B' }])[0];
  assert.equal(Object.hasOwn(failedReview, 'correctAnswer'), false);
  assert.equal(Object.hasOwn(failedReview, 'answer'), false);
  const passedReview = publicQuestions(questions, true, [{ questionIndex: 0, answer: 'B' }])[0];
  assert.equal(passedReview.correctAnswer, 'A');
  assert.equal(passedReview.isCorrect, false);
});

test('late quiz scores are halved while the original pass result is preserved', () => {
  const score = recordQuizScore({ correctCount: 18, scorePercent: 90, passed: true }, true);
  assert.deepEqual(score, {
    correctCount: 18,
    scorePercent: 45,
    passed: true,
    originalCorrectCount: 18,
    originalScorePercent: 90,
    latePenaltyApplied: true,
  });
});

test('quizzes only unlock in order after the previous quiz is passed', () => {
  const quizzes = [
    { _id: 'quiz-1', title: 'Quiz 1' },
    { _id: 'quiz-2', title: 'Quiz 2' },
    { _id: 'quiz-3', title: 'Quiz 3' },
  ];
  const failedAttempts = addQuizProgress(quizzes, [
    { quiz: 'quiz-1', status: 'submitted', passed: false, createdAt: new Date('2026-01-01') },
    { quiz: 'quiz-1', status: 'submitted', passed: false, createdAt: new Date('2026-01-02') },
  ]);
  assert.deepEqual(failedAttempts.map(({ unlocked }) => unlocked), [true, false, false]);
  assert.equal(failedAttempts[0].attemptCount, 2);
  assert.equal(failedAttempts[0].attempt.createdAt.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(failedAttempts[1].lockedBy, 'Quiz 1');

  const firstQuizPassed = addQuizProgress(quizzes, [
    { quiz: 'quiz-1', status: 'submitted', passed: true },
  ]);
  assert.deepEqual(firstQuizPassed.map(({ unlocked }) => unlocked), [true, true, false]);

  const secondQuizFailed = addQuizProgress(quizzes, [
    { quiz: 'quiz-1', status: 'submitted', passed: true },
    { quiz: 'quiz-2', status: 'expired', passed: false },
  ]);
  assert.deepEqual(secondQuizFailed.map(({ unlocked }) => unlocked), [true, true, false]);
});

test('lesson access follows the order of passed quizzes', () => {
  const lessons = [
    { _id: 'lesson-2', createdAt: new Date('2026-02-02') },
    { _id: 'lesson-1', createdAt: new Date('2026-02-01') },
    { _id: 'lesson-3', createdAt: new Date('2026-02-03') },
  ];
  const quizzes = [
    { _id: 'quiz-1', title: 'Quiz 1' },
    { _id: 'quiz-2', title: 'Quiz 2' },
  ];
  const progress = addLessonProgress(lessons, quizzes, [{ quiz: 'quiz-1', passed: true }]);
  assert.deepEqual(progress.map(({ _id, unlocked }) => [_id, unlocked]), [
    ['lesson-1', true],
    ['lesson-2', true],
    ['lesson-3', false],
  ]);
  assert.equal(progress[2].lockedBy, 'Quiz 2');
});

test('practice generation creates 10 multiple-choice and 10 true/false questions from lesson text', async () => {
  const statements = [
    'Hydrology studies the movement and distribution of water across the Earth.',
    'Thermodynamics explains relationships between heat, work, temperature, and energy.',
    'Concrete combines cement, water, sand, and aggregates into a durable construction material.',
    'Surveying measures distances and angles to determine positions on land.',
    'Microcontrollers combine processors, memory, and input output peripherals in embedded systems.',
    'Ecology examines relationships between organisms and their surrounding environments.',
    'Electromagnetism describes interactions between electric charges and magnetic fields.',
    'Algorithms provide ordered steps for solving computational problems efficiently.',
    'Biodiversity represents the variety of living species within a particular ecosystem.',
    'Pneumatics uses compressed air to transmit power and control industrial equipment.',
    'Geology investigates materials, structures, and processes that shape the Earth.',
    'Insulation reduces unwanted transfer of heat through building materials.',
  ];
  const questions = await createPracticeQuestions(statements.join('\n'));
  const multipleChoice = questions.filter((question) => question.type === 'multiple_choice');
  const trueFalse = questions.filter((question) => question.type === 'true_false');

  assert.equal(questions.length, 20);
  assert.equal(multipleChoice.length, 10);
  assert.equal(trueFalse.length, 10);
  assert.ok(multipleChoice.every((question) => question.options.length === 4
    && question.options.includes(question.correctAnswer)
    && question.prompt.includes('_____')));
  assert.deepEqual(new Set(trueFalse.map((question) => question.correctAnswer)), new Set(['True', 'False']));
});

test('lesson quiz generation respects the professor-selected question mix', () => {
  const statements = [
    'Hydrology studies the movement and distribution of water across the Earth.',
    'Thermodynamics explains relationships between heat, work, temperature, and energy.',
    'Concrete combines cement, water, sand, and aggregates into a durable construction material.',
    'Surveying measures distances and angles to determine positions on land.',
    'Microcontrollers combine processors, memory, and input output peripherals in embedded systems.',
    'Ecology examines relationships between organisms and their surrounding environments.',
    'Electromagnetism describes interactions between electric charges and magnetic fields.',
    'Algorithms provide ordered steps for solving computational problems efficiently.',
    'Biodiversity represents the variety of living species within a particular ecosystem.',
    'Pneumatics uses compressed air to transmit power and control industrial equipment.',
    'Geology investigates materials, structures, and processes that shape the Earth.',
    'Insulation reduces unwanted transfer of heat through building materials.',
  ];
  const questions = generateQuizQuestions(statements.join('\n'), 8, 12);
  assert.equal(questions.length, 20);
  assert.equal(questions.filter((question) => question.type === 'multiple_choice').length, 8);
  assert.equal(questions.filter((question) => question.type === 'true_false').length, 12);
});

test('practice generation reports when lesson text cannot support a full quiz', async () => {
  assert.throws(
    () => createPracticeQuestions('This lesson only contains one short sentence.'),
    { status: 422, message: /not contain enough distinct readable statements/i },
  );
});
