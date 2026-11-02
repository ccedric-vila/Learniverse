const test = require('node:test');
const assert = require('node:assert/strict');
const {
  addQuizProgress,
  normalizeQuizDeadline,
  normalizeQuizQuestions,
  publicQuestions,
  quizAttemptExpiresAt,
  scoreAnswers,
} = require('./quizLogic');
const { createPracticeQuestions } = require('./practiceQuestionGenerator');

function multipleChoice(prompt, answer = 'A') {
  return { prompt, type: 'multiple_choice', options: ['A', 'B', 'C', 'D'], correctAnswer: answer };
}

test('quiz validation accepts one to twenty valid mixed question types', () => {
  const questions = normalizeQuizQuestions([
    multipleChoice('Select A'),
    { prompt: 'True?', type: 'true_false', correctAnswer: 'True' },
  ]);
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[1].options, ['True', 'False']);
  assert.throws(() => normalizeQuizQuestions([]), /between 1 and 20/);
  assert.throws(() => normalizeQuizQuestions(Array.from({ length: 21 }, (_, index) => multipleChoice(`Q${index}`))), /between 1 and 20/);
});

test('quiz validation rejects malformed options and answer keys', () => {
  assert.throws(() => normalizeQuizQuestions([{ ...multipleChoice('Q'), options: ['A', 'A', 'C', 'D'] }]), /four distinct/);
  assert.throws(() => normalizeQuizQuestions([{ ...multipleChoice('Q'), correctAnswer: 'Z' }]), /listed options/);
  assert.throws(() => normalizeQuizQuestions([{ prompt: 'True?', type: 'true_false', correctAnswer: 'Yes' }]), /True or False/);
});

test('quiz deadlines must be future dates and cap the attempt timer', () => {
  const now = new Date('2026-01-01T10:00:00.000Z');
  const deadline = normalizeQuizDeadline('2026-01-01T10:05:00.000Z', now);
  assert.throws(() => normalizeQuizDeadline('not-a-date', now), /valid quiz deadline/);
  assert.throws(() => normalizeQuizDeadline('2026-01-01T10:00:00.000Z', now), /future/);
  assert.equal(quizAttemptExpiresAt(now, deadline).toISOString(), deadline.toISOString());
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

test('question answers stay private until an attempt is submitted', () => {
  const questions = [multipleChoice('Select A')];
  assert.equal(Object.hasOwn(publicQuestions(questions)[0], 'correctAnswer'), false);
  assert.equal(publicQuestions(questions, true, [{ questionIndex: 0, answer: 'B' }])[0].isCorrect, false);
});

test('quizzes unlock in order after the previous attempt is submitted', () => {
  const quizzes = [
    { _id: 'quiz-1', title: 'Quiz 1' },
    { _id: 'quiz-2', title: 'Quiz 2' },
    { _id: 'quiz-3', title: 'Quiz 3' },
  ];
  const activeFirstQuiz = addQuizProgress(quizzes, [
    { quiz: 'quiz-1', status: 'in_progress' },
  ]);
  assert.deepEqual(activeFirstQuiz.map(({ unlocked }) => unlocked), [true, false, false]);
  assert.equal(activeFirstQuiz[1].lockedBy, 'Quiz 1');

  const firstQuizSubmitted = addQuizProgress(quizzes, [
    { quiz: 'quiz-1', status: 'submitted' },
  ]);
  assert.deepEqual(firstQuizSubmitted.map(({ unlocked }) => unlocked), [true, true, false]);

  const firstQuizExpired = addQuizProgress(quizzes, [
    { quiz: 'quiz-1', status: 'expired' },
    { quiz: 'quiz-2', status: 'submitted' },
  ]);
  assert.deepEqual(firstQuizExpired.map(({ unlocked }) => unlocked), [true, true, true]);
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

test('practice generation reports when lesson text cannot support a full quiz', async () => {
  assert.throws(
    () => createPracticeQuestions('This lesson only contains one short sentence.'),
    { status: 422, message: /not contain enough distinct readable statements/i },
  );
});
