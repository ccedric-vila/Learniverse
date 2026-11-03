const mongoose = require('mongoose');

const attemptQuestionSchema = new mongoose.Schema({
  prompt: { type: String, required: true },
  type: { type: String, required: true, enum: ['multiple_choice', 'true_false'] },
  options: [{ type: String }],
  correctAnswer: { type: String, required: true },
}, { _id: false });

const answerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true, min: 0 },
  answer: { type: String, default: '' },
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  attemptType: { type: String, required: true, enum: ['quiz', 'practice'] },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz' },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassMaterial' },
  title: { type: String, required: true, trim: true },
  questions: { type: [attemptQuestionSchema], required: true },
  answers: { type: [answerSchema], required: true },
  startedAt: { type: Date, required: true, default: Date.now },
  expiresAt: { type: Date, required: true },
  submittedAt: { type: Date, default: null },
  status: { type: String, enum: ['in_progress', 'submitted', 'expired'], default: 'in_progress' },
  attemptNumber: { type: Number, min: 1 },
  correctCount: { type: Number, default: null, min: 0 },
  scorePercent: { type: Number, default: null, min: 0, max: 100 },
  originalCorrectCount: { type: Number, default: null, min: 0 },
  originalScorePercent: { type: Number, default: null, min: 0, max: 100 },
  latePenaltyApplied: { type: Boolean, default: false },
  passed: { type: Boolean, default: null },
  practiceAttemptNumber: { type: Number, min: 1, max: 3 },
}, { timestamps: true });

quizAttemptSchema.index(
  { student: 1, quiz: 1 },
  {
    unique: true,
    partialFilterExpression: { attemptType: 'quiz', status: 'in_progress', quiz: { $exists: true } },
    name: 'one_active_quiz_attempt_per_student',
  },
);
quizAttemptSchema.index(
  { student: 1, material: 1, practiceAttemptNumber: 1 },
  { unique: true, partialFilterExpression: { attemptType: 'practice', material: { $exists: true } } },
);
quizAttemptSchema.index({ student: 1, attemptType: 1, createdAt: -1 });
quizAttemptSchema.index({ quiz: 1, attemptType: 1, status: 1, student: 1 });
quizAttemptSchema.index({ student: 1, quiz: 1, attemptType: 1, createdAt: -1 });

module.exports = mongoose.models.QuizAttempt || mongoose.model('QuizAttempt', quizAttemptSchema);
