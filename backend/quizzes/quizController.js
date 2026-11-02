const ClassMaterial = require('../src/models/ClassMaterial');
const ClassOffering = require('../src/models/ClassOffering');
const Enrollment = require('../src/models/Enrollment');
const PracticeProgress = require('../src/models/PracticeProgress');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');
const { notifyOnlineQuizPublished } = require('../notifications/notificationService');
const { cloudinary } = require('../config/cloudinary');
const { extractLessonText } = require('./lessonText');
const { generatePracticeQuestions } = require('./practiceQuestionGenerator');
const {
  PASSING_PERCENT,
  QUIZ_DURATION_MINUTES,
  addQuizProgress,
  normalizeQuizDeadline,
  normalizeQuizQuestions,
  publicQuestions,
  quizAttemptExpiresAt,
  scoreAnswers,
} = require('./quizLogic');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function attemptResponse(attempt) {
  const revealAnswers = attempt.status !== 'in_progress';
  return {
    id: attempt._id,
    attemptType: attempt.attemptType,
    title: attempt.title,
    questions: publicQuestions(attempt.questions, revealAnswers, attempt.answers),
    answers: attempt.answers.map(({ questionIndex, answer }) => ({ questionIndex, answer })),
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    submittedAt: attempt.submittedAt,
    status: attempt.status,
    correctCount: attempt.correctCount,
    totalQuestions: attempt.questions.length,
    scorePercent: attempt.scorePercent,
    passed: attempt.passed,
    practiceAttemptNumber: attempt.practiceAttemptNumber,
  };
}

async function ownedProfessorClass(classId, professorId) {
  const offering = await ClassOffering.findOne({ _id: classId, professor: professorId, isActive: true }).select('_id');
  if (!offering) throw httpError(404, 'Active class not found in your teaching assignments.');
  return offering;
}

async function enrolledStudentClass(classId, studentId) {
  const [offering, enrollment] = await Promise.all([
    ClassOffering.findOne({ _id: classId, isActive: true }).select('_id'),
    Enrollment.findOne({ classOffering: classId, student: studentId }).select('_id'),
  ]);
  if (!offering || !enrollment) throw httpError(404, 'Class not found in your active enrollments.');
  return offering;
}

async function createQuiz(req, res, next) {
  try {
    const offering = await ownedProfessorClass(req.params.classId, req.user._id);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    if (!title || title.length > 160) return res.status(400).json({ message: 'Quiz title is required and must be 160 characters or fewer.' });
    if (description.length > 2000) return res.status(400).json({ message: 'Quiz instructions must be 2,000 characters or fewer.' });
    let deadline;
    try {
      deadline = normalizeQuizDeadline(req.body.deadline);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    let questions;
    try {
      questions = normalizeQuizQuestions(req.body.questions);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
    const quiz = await Quiz.create({
      classOffering: offering._id,
      createdBy: req.user._id,
      title,
      description,
      deadline,
      questions,
      isPublished: true,
    });
    const notificationsSent = await notifyOnlineQuizPublished(quiz);
    if (notificationsSent) {
      quiz.notificationSentAt = new Date();
      await quiz.save();
    }
    return res.status(201).json({
      quiz: {
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        deadline: quiz.deadline,
        durationMinutes: QUIZ_DURATION_MINUTES,
        passingPercent: PASSING_PERCENT,
        isPublished: quiz.isPublished,
        createdAt: quiz.createdAt,
      },
      ...(notificationsSent ? {} : { notificationWarning: 'The quiz was published, but student notifications could not be created.' }),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function getProfessorQuizzes(req, res, next) {
  try {
    const offering = await ownedProfessorClass(req.params.classId, req.user._id);
    const [quizzes, enrollments] = await Promise.all([
      Quiz.find({ classOffering: offering._id }).sort({ createdAt: 1, _id: 1 }).lean(),
      Enrollment.find({ classOffering: offering._id })
        .populate({
          path: 'student',
          match: { role: 'STUDENT', isActive: true },
          select: 'fullName email',
        })
        .select('student')
        .lean(),
    ]);
    const attempts = await QuizAttempt.find({ quiz: { $in: quizzes.map((quiz) => quiz._id) }, attemptType: 'quiz' })
      .populate('student', 'fullName email')
      .sort({ submittedAt: -1 })
      .lean();
    const attemptsByQuiz = new Map();
    const scoreAttemptsByQuiz = new Map();
    for (const attempt of attempts) {
      const key = String(attempt.quiz);
      if (!scoreAttemptsByQuiz.has(key)) scoreAttemptsByQuiz.set(key, []);
      const scoreAttempt = {
        id: attempt._id,
        student: attempt.student,
        submittedAt: attempt.submittedAt,
        correctCount: attempt.correctCount,
        totalQuestions: attempt.questions.length,
        scorePercent: attempt.scorePercent,
        passed: attempt.passed,
        status: attempt.status,
      };
      scoreAttemptsByQuiz.get(key).push(scoreAttempt);
      if (attempt.status !== 'in_progress') {
        if (!attemptsByQuiz.has(key)) attemptsByQuiz.set(key, []);
        attemptsByQuiz.get(key).push(scoreAttempt);
      }
    }
    const students = enrollments
      .filter((enrollment) => enrollment.student)
      .map(({ student }) => ({
        id: String(student._id),
        fullName: student.fullName,
        email: student.email,
      }))
      .sort((first, second) => {
        const firstParts = first.fullName.trim().split(/\s+/);
        const secondParts = second.fullName.trim().split(/\s+/);
        return firstParts.at(-1).localeCompare(secondParts.at(-1), undefined, { sensitivity: 'base' })
          || first.fullName.localeCompare(second.fullName, undefined, { sensitivity: 'base' });
      });
    return res.json({
      students,
      quizzes: quizzes.map((quiz) => ({
        id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questionCount: quiz.questions.length,
        multipleChoiceCount: quiz.questions.filter((question) => question.type === 'multiple_choice').length,
        trueFalseCount: quiz.questions.filter((question) => question.type === 'true_false').length,
        durationMinutes: quiz.durationMinutes,
        passingPercent: quiz.passingPercent,
        deadline: quiz.deadline,
        createdAt: quiz.createdAt,
        attempts: attemptsByQuiz.get(String(quiz._id)) || [],
        scoreAttempts: scoreAttemptsByQuiz.get(String(quiz._id)) || [],
      })),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function getStudentQuizzes(req, res, next) {
  try {
    const offering = await enrolledStudentClass(req.params.classId, req.user._id);
    const quizzes = await Quiz.find({ classOffering: offering._id, isPublished: true }).sort({ createdAt: 1, _id: 1 }).lean();
    const attempts = await QuizAttempt.find({
      student: req.user._id,
      quiz: { $in: quizzes.map((quiz) => quiz._id) },
      attemptType: 'quiz',
    });
    const quizzesById = new Map(quizzes.map((quiz) => [String(quiz._id), quiz]));
    const now = new Date();
    for (const attempt of attempts) {
      const deadline = quizzesById.get(String(attempt.quiz))?.deadline;
      if (attempt.status === 'in_progress' && (attempt.expiresAt <= now || (deadline && deadline <= now))) {
        await finalizeAttempt(attempt, true);
      }
    }
    const progress = addQuizProgress(quizzes, attempts);
    return res.json({
      quizzes: progress.map((quiz) => {
        return {
          id: quiz._id,
          title: quiz.title,
          description: quiz.description,
          questionCount: quiz.questions.length,
          durationMinutes: quiz.durationMinutes,
          passingPercent: quiz.passingPercent,
          deadline: quiz.deadline,
          deadlinePassed: Boolean(quiz.deadline && quiz.deadline <= now),
          sequence: quiz.sequence,
          unlocked: quiz.unlocked,
          lockedBy: quiz.lockedBy,
          attempt: quiz.attempt ? attemptResponse(quiz.attempt) : null,
        };
      }),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function startQuizAttempt(req, res, next) {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.quizId, isPublished: true });
    if (!quiz) return res.status(404).json({ message: 'Published quiz not found.' });
    await enrolledStudentClass(quiz.classOffering, req.user._id);
    const existing = await QuizAttempt.findOne({ student: req.user._id, quiz: quiz._id, attemptType: 'quiz' });
    const now = new Date();
    if (quiz.deadline && quiz.deadline <= now) {
      if (existing?.status === 'in_progress') await finalizeAttempt(existing, true);
      return res.status(409).json({ message: 'The deadline for this quiz has passed.' });
    }
    if (existing) {
      if (existing.status === 'in_progress') return res.json({ attempt: attemptResponse(existing), resumed: true });
      return res.status(409).json({ message: 'You have already used your attempt for this quiz.', attempt: attemptResponse(existing) });
    }

    const orderedQuizzes = await Quiz.find({ classOffering: quiz.classOffering, isPublished: true })
      .sort({ createdAt: 1, _id: 1 })
      .select('_id title')
      .lean();
    const quizIndex = orderedQuizzes.findIndex((item) => String(item._id) === String(quiz._id));
    const previousQuizzes = orderedQuizzes.slice(0, quizIndex);
    if (previousQuizzes.length) {
      const previousAttempts = await QuizAttempt.find({
        student: req.user._id,
        quiz: { $in: previousQuizzes.map((item) => item._id) },
        attemptType: 'quiz',
      });
      const attemptsByQuiz = new Map(previousAttempts.map((attempt) => [String(attempt.quiz), attempt]));
      for (const previousQuiz of previousQuizzes) {
        const previousAttempt = attemptsByQuiz.get(String(previousQuiz._id));
        if (previousAttempt?.status === 'in_progress' && previousAttempt.expiresAt <= new Date()) {
          await finalizeAttempt(previousAttempt, true);
        }
        if (!previousAttempt || previousAttempt.status === 'in_progress') {
          return res.status(409).json({
            message: `Complete "${previousQuiz.title}" before starting the next quiz.`,
            lockedBy: previousQuiz.title,
          });
        }
      }
    }

    const startedAt = new Date();
    if (quiz.deadline && quiz.deadline <= startedAt) {
      return res.status(409).json({ message: 'The deadline for this quiz has passed.' });
    }
    const attempt = await QuizAttempt.create({
      student: req.user._id,
      attemptType: 'quiz',
      quiz: quiz._id,
      title: quiz.title,
      questions: quiz.questions.map((question) => question.toObject()),
      answers: quiz.questions.map((_question, questionIndex) => ({ questionIndex, answer: '' })),
      startedAt,
      expiresAt: quizAttemptExpiresAt(startedAt, quiz.deadline),
    });
    return res.status(201).json({ attempt: attemptResponse(attempt), resumed: false });
  } catch (error) {
    if (error.code === 11000) {
      const existing = await QuizAttempt.findOne({ student: req.user._id, quiz: req.params.quizId, attemptType: 'quiz' });
      if (existing) return res.json({ attempt: attemptResponse(existing), resumed: true });
    }
    if (error.name === 'CastError') return res.status(404).json({ message: 'Quiz or class not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function reservePracticeAttempt(studentId, materialId) {
  const filter = { student: studentId, material: materialId, attemptsUsed: { $lt: 3 } };
  let progress = await PracticeProgress.findOneAndUpdate(filter, { $inc: { attemptsUsed: 1 } }, { new: true });
  if (progress) return progress.attemptsUsed;
  try {
    progress = await PracticeProgress.create({ student: studentId, material: materialId, attemptsUsed: 1 });
    return progress.attemptsUsed;
  } catch (error) {
    if (error.code !== 11000) throw error;
    progress = await PracticeProgress.findOneAndUpdate(filter, { $inc: { attemptsUsed: 1 } }, { new: true });
    return progress?.attemptsUsed || null;
  }
}

async function getStudentPracticeMaterials(req, res, next) {
  try {
    const offering = await enrolledStudentClass(req.params.classId, req.user._id);
    const materials = await ClassMaterial.find({
      classOffering: offering._id,
      category: 'lesson',
      availableAt: { $lte: new Date() },
    }).select('title description originalFileName mimeType fileSize availableAt createdAt').sort({ createdAt: -1 }).lean();
    const progress = await PracticeProgress.find({
      student: req.user._id,
      material: { $in: materials.map((material) => material._id) },
    }).select('material attemptsUsed').lean();
    const attemptsByMaterial = new Map(progress.map((entry) => [String(entry.material), entry.attemptsUsed]));
    return res.json({
      materials: materials.map((material) => ({
        ...material,
        attemptsUsed: attemptsByMaterial.get(String(material._id)) || 0,
        attemptsRemaining: 3 - (attemptsByMaterial.get(String(material._id)) || 0),
      })),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function startPracticeAttempt(req, res, next) {
  try {
    const material = await ClassMaterial.findOne({
      _id: req.params.materialId,
      category: 'lesson',
      availableAt: { $lte: new Date() },
    }).select('+cloudinaryPublicId');
    if (!material) return res.status(404).json({ message: 'Available lesson material not found.' });
    await enrolledStudentClass(material.classOffering, req.user._id);

    const currentProgress = await PracticeProgress.findOne({ student: req.user._id, material: material._id }).select('attemptsUsed').lean();
    if ((currentProgress?.attemptsUsed || 0) >= 3) {
      return res.status(409).json({ message: 'You have used all three practice attempts for this lesson.' });
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const downloadUrl = cloudinary.utils.private_download_url(material.cloudinaryPublicId, undefined, {
      resource_type: 'raw',
      type: 'authenticated',
      expires_at: expiresAt,
    });
    const upstream = await fetch(downloadUrl, { signal: AbortSignal.timeout(30000) });
    if (!upstream.ok) throw httpError(502, 'Could not retrieve this lesson file for text extraction.');
    const fileBuffer = Buffer.from(await upstream.arrayBuffer());
    const sourceText = await extractLessonText(fileBuffer, material.originalFileName);
    const questions = await generatePracticeQuestions(sourceText, material.title);
    const practiceAttemptNumber = await reservePracticeAttempt(req.user._id, material._id);
    if (!practiceAttemptNumber) return res.status(409).json({ message: 'You have used all three practice attempts for this lesson.' });

    const startedAt = new Date();
    let attempt;
    try {
      attempt = await QuizAttempt.create({
        student: req.user._id,
        attemptType: 'practice',
        material: material._id,
        practiceAttemptNumber,
        title: `${material.title} — Practice`,
        questions,
        answers: questions.map((_question, questionIndex) => ({ questionIndex, answer: '' })),
        startedAt,
        expiresAt: new Date(startedAt.getTime() + QUIZ_DURATION_MINUTES * 60 * 1000),
      });
    } catch (error) {
      await PracticeProgress.updateOne({ student: req.user._id, material: material._id }, { $inc: { attemptsUsed: -1 } });
      throw error;
    }
    return res.status(201).json({ attempt: attemptResponse(attempt) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Lesson material or class not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.message?.includes('Practice generation supports') || error.message?.includes('Not enough readable text')
      || error.message?.includes('Scanned PDFs are limited')) {
      return res.status(422).json({ message: error.message });
    }
    return next(error);
  }
}

async function getAttempt(req, res, next) {
  try {
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, student: req.user._id });
    if (!attempt) return res.status(404).json({ message: 'Quiz attempt not found.' });
    if (attempt.status === 'in_progress' && attempt.expiresAt <= new Date()) {
      await finalizeAttempt(attempt, true);
    }
    return res.json({ attempt: attemptResponse(attempt) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Quiz attempt not found.' });
    return next(error);
  }
}

async function saveAttemptAnswer(req, res, next) {
  try {
    const questionIndex = Number(req.params.questionIndex);
    if (!Number.isInteger(questionIndex) || questionIndex < 0) return res.status(400).json({ message: 'Invalid question number.' });
    if (typeof req.body.answer !== 'string' || req.body.answer.length > 300) return res.status(400).json({ message: 'Choose a valid answer.' });
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, student: req.user._id });
    if (!attempt) return res.status(404).json({ message: 'Quiz attempt not found.' });
    if (attempt.status !== 'in_progress') return res.status(409).json({ message: 'This attempt has already been submitted.' });
    if (attempt.expiresAt <= new Date()) {
      await finalizeAttempt(attempt, true);
      return res.status(409).json({ message: 'Time is up. Your saved answers were submitted.' });
    }
    const question = attempt.questions[questionIndex];
    if (!question) return res.status(400).json({ message: 'Question number is out of range.' });
    if (req.body.answer && !question.options.includes(req.body.answer)) return res.status(400).json({ message: 'Choose one of the listed answers.' });

    const updated = await QuizAttempt.findOneAndUpdate(
      { _id: attempt._id, student: req.user._id, status: 'in_progress', expiresAt: { $gt: new Date() } },
      { $set: { [`answers.${questionIndex}.answer`]: req.body.answer } },
      { new: true },
    );
    if (!updated) return res.status(409).json({ message: 'Time is up or this attempt has already been submitted.' });
    return res.json({ saved: true });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Quiz attempt not found.' });
    return next(error);
  }
}

async function finalizeAttempt(attempt, expired = false) {
  if (attempt.status !== 'in_progress') return attempt;
  const result = scoreAnswers(attempt.questions, attempt.answers);
  attempt.status = expired ? 'expired' : 'submitted';
  attempt.submittedAt = new Date();
  attempt.correctCount = result.correctCount;
  attempt.scorePercent = result.scorePercent;
  attempt.passed = result.passed;
  await attempt.save();
  return attempt;
}

async function submitAttempt(req, res, next) {
  try {
    const attempt = await QuizAttempt.findOne({ _id: req.params.attemptId, student: req.user._id });
    if (!attempt) return res.status(404).json({ message: 'Quiz attempt not found.' });
    const expired = attempt.expiresAt <= new Date();
    await finalizeAttempt(attempt, expired);
    return res.json({ attempt: attemptResponse(attempt) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Quiz attempt not found.' });
    return next(error);
  }
}

module.exports = {
  createQuiz,
  getAttempt,
  getProfessorQuizzes,
  getStudentPracticeMaterials,
  getStudentQuizzes,
  saveAttemptAnswer,
  startPracticeAttempt,
  startQuizAttempt,
  submitAttempt,
};
