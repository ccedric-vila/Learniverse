const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  prompt: { type: String, required: true, trim: true, maxlength: 1000 },
  type: { type: String, required: true, enum: ['multiple_choice', 'true_false'] },
  options: [{ type: String, trim: true, maxlength: 300 }],
  correctAnswer: { type: String, required: true, trim: true, maxlength: 300 },
}, { _id: false });

const quizSchema = new mongoose.Schema({
  classOffering: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassOffering', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  deadline: { type: Date },
  notificationSentAt: { type: Date, default: null, select: false },
  questions: {
    type: [quizQuestionSchema],
    required: true,
    validate: [(questions) => questions.length === 20, 'A quiz must contain exactly 20 questions.'],
  },
  durationMinutes: { type: Number, default: 10, enum: [10] },
  passingPercent: { type: Number, default: 75, enum: [75] },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true });

quizSchema.index({ classOffering: 1, createdAt: -1 });
quizSchema.index({ isPublished: 1, deadline: 1 });

module.exports = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
