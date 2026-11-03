const PASSING_PERCENT = 75;
const QUIZ_DURATION_MINUTES = 10;
const MAX_QUESTIONS = 20;

function normalizeQuestion(question) {
  const prompt = typeof question?.prompt === 'string' ? question.prompt.trim() : '';
  const type = question?.type;
  const options = Array.isArray(question?.options)
    ? question.options.map((option) => typeof option === 'string' ? option.trim() : '')
    : [];
  const correctAnswer = typeof question?.correctAnswer === 'string' ? question.correctAnswer.trim() : '';
  if (!prompt || prompt.length > 1000) throw new Error('Each question needs a prompt of at most 1,000 characters.');

  if (type === 'multiple_choice') {
    if (options.length !== 4 || options.some((option) => !option || option.length > 300)
      || new Set(options.map((option) => option.toLowerCase())).size !== 4) {
      throw new Error('Each multiple-choice question needs four distinct, non-empty options.');
    }
    if (!options.includes(correctAnswer)) throw new Error('Choose one of the listed options as the correct answer.');
    return { prompt, type, options, correctAnswer };
  }

  if (type === 'true_false') {
    if (correctAnswer !== 'True' && correctAnswer !== 'False') {
      throw new Error('True/false questions must use True or False as the correct answer.');
    }
    return { prompt, type, options: ['True', 'False'], correctAnswer };
  }

  throw new Error('Question type must be multiple choice or true/false.');
}

function normalizeQuizQuestions(questions) {
  if (!Array.isArray(questions) || questions.length !== MAX_QUESTIONS) {
    throw new Error('A quiz must contain exactly 20 questions.');
  }
  return questions.map(normalizeQuestion);
}

function normalizeQuizDeadline(value, now = new Date()) {
  const deadline = typeof value === 'string' ? new Date(value) : null;
  if (!deadline || !Number.isFinite(deadline.getTime()) || deadline <= now) {
    throw new Error('Choose a valid quiz deadline in the future.');
  }
  return deadline;
}

function quizAttemptExpiresAt(startedAt) {
  return new Date(startedAt.getTime() + QUIZ_DURATION_MINUTES * 60 * 1000);
}

function scoreAnswers(questions, answers) {
  const answerByIndex = new Map(answers.map(({ questionIndex, answer }) => [questionIndex, answer]));
  const correctCount = questions.reduce((count, question, index) => {
    const answer = answerByIndex.get(index) || '';
    return count + (answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase() ? 1 : 0);
  }, 0);
  const scorePercent = Math.round((correctCount / questions.length) * 100);
  return { correctCount, scorePercent, passed: correctCount / questions.length * 100 >= PASSING_PERCENT };
}

function recordQuizScore(result, latePenaltyApplied) {
  return {
    ...result,
    originalCorrectCount: result.correctCount,
    originalScorePercent: result.scorePercent,
    correctCount: result.correctCount,
    scorePercent: latePenaltyApplied ? result.scorePercent / 2 : result.scorePercent,
    latePenaltyApplied,
  };
}

function publicQuestions(questions, revealAnswers = false, answers = []) {
  const answerByIndex = new Map(answers.map(({ questionIndex, answer }) => [questionIndex, answer]));
  return questions.map((question, index) => ({
    prompt: question.prompt,
    type: question.type,
    options: question.options,
    ...(revealAnswers ? {
      correctAnswer: question.correctAnswer,
      answer: answerByIndex.get(index) || '',
      isCorrect: (answerByIndex.get(index) || '').trim().toLowerCase() === question.correctAnswer.trim().toLowerCase(),
    } : {}),
  }));
}

function addQuizProgress(quizzes, attempts) {
  const attemptsByQuiz = new Map();
  for (const attempt of attempts) {
    const key = String(attempt.quiz);
    if (!attemptsByQuiz.has(key)) attemptsByQuiz.set(key, []);
    attemptsByQuiz.get(key).push(attempt);
  }

  return quizzes.map((quiz, index) => {
    const quizAttempts = attemptsByQuiz.get(String(quiz._id)) || [];
    quizAttempts.sort((first, second) => new Date(second.createdAt || second.submittedAt || 0) - new Date(first.createdAt || first.submittedAt || 0));
    const attempt = quizAttempts[0] || null;
    const passed = quizAttempts.some((quizAttempt) => quizAttempt.passed === true);
    const unlocked = index === 0 || quizzes.slice(0, index).every((previousQuiz) => (
      (attemptsByQuiz.get(String(previousQuiz._id)) || []).some((quizAttempt) => quizAttempt.passed === true)
    ));
    const result = {
      ...quiz,
      sequence: index + 1,
      unlocked,
      lockedBy: unlocked ? null : quizzes.find((previousQuiz, previousIndex) => (
        previousIndex < index
        && !(attemptsByQuiz.get(String(previousQuiz._id)) || []).some((quizAttempt) => quizAttempt.passed === true)
      ))?.title,
      attempt: attempt || null,
      attemptCount: quizAttempts.length,
      passed,
    };
    return result;
  });
}

function addLessonProgress(materials, quizzes, attempts) {
  const attemptsByQuiz = new Map();
  for (const attempt of attempts) {
    const key = String(attempt.quiz);
    if (!attemptsByQuiz.has(key)) attemptsByQuiz.set(key, []);
    attemptsByQuiz.get(key).push(attempt);
  }

  const sortedMaterials = [...materials].sort((first, second) => (
    new Date(first.availableAt || first.createdAt || 0) - new Date(second.availableAt || second.createdAt || 0)
    || new Date(first.createdAt || 0) - new Date(second.createdAt || 0)
    || String(first._id).localeCompare(String(second._id))
  ));
  let passedQuizCount = 0;
  while (passedQuizCount < quizzes.length) {
    const quiz = quizzes[passedQuizCount];
    const hasPassed = (attemptsByQuiz.get(String(quiz._id)) || []).some((attempt) => attempt.passed === true);
    if (!hasPassed) break;
    passedQuizCount += 1;
  }

  return sortedMaterials.map((material, index) => {
    const unlocked = index <= passedQuizCount;
    return {
      ...material,
      sequence: index + 1,
      unlocked,
      lockedBy: unlocked ? null : quizzes[passedQuizCount]?.title || quizzes.at(-1)?.title || null,
    };
  });
}

module.exports = {
  MAX_QUESTIONS,
  PASSING_PERCENT,
  QUIZ_DURATION_MINUTES,
  addLessonProgress,
  addQuizProgress,
  normalizeQuestion,
  normalizeQuizDeadline,
  normalizeQuizQuestions,
  publicQuestions,
  quizAttemptExpiresAt,
  recordQuizScore,
  scoreAnswers,
};
