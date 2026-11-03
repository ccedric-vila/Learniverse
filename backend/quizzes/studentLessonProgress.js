const ClassMaterial = require('../src/models/ClassMaterial');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');
const { addLessonProgress } = require('./quizLogic');

async function getStudentLessonProgress(classOffering, studentId) {
  const [materials, quizzes] = await Promise.all([
    ClassMaterial.find({ classOffering, category: 'lesson' })
      .sort({ availableAt: 1, createdAt: 1, _id: 1 })
      .lean(),
    Quiz.find({ classOffering, isPublished: true })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id title')
      .lean(),
  ]);
  const attempts = quizzes.length
    ? await QuizAttempt.find({
      student: studentId,
      quiz: { $in: quizzes.map((quiz) => quiz._id) },
      attemptType: 'quiz',
    }).select('quiz passed').lean()
    : [];
  return addLessonProgress(materials, quizzes, attempts);
}

async function getStudentQuizGate(classOffering, quizId, studentId) {
  const quizzes = await Quiz.find({ classOffering, isPublished: true })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id title')
    .lean();
  const quizIndex = quizzes.findIndex((quiz) => String(quiz._id) === String(quizId));
  if (quizIndex < 0) return { unlocked: false, lockedBy: null };
  const previousQuizzes = quizzes.slice(0, quizIndex);
  if (!previousQuizzes.length) return { unlocked: true, lockedBy: null };

  const passedAttempts = await QuizAttempt.find({
    student: studentId,
    quiz: { $in: previousQuizzes.map((quiz) => quiz._id) },
    attemptType: 'quiz',
    passed: true,
  }).select('quiz').lean();
  const passedQuizIds = new Set(passedAttempts.map((attempt) => String(attempt.quiz)));
  const lockedBy = previousQuizzes.find((quiz) => !passedQuizIds.has(String(quiz._id)));
  return { unlocked: !lockedBy, lockedBy: lockedBy?.title || null };
}

module.exports = { getStudentLessonProgress, getStudentQuizGate };
