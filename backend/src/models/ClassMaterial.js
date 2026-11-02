const mongoose = require('mongoose');

const classMaterialSchema = new mongoose.Schema({
  classOffering: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassOffering', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  category: {
    type: String,
    required: true,
    enum: ['lesson', 'seatwork', 'quiz'],
    default: 'lesson',
    trim: true,
    lowercase: true,
  },
  deadline: { type: Date, default: null },
  pointsPossible: { type: Number, default: 100, min: 1, max: 100000 },
  notificationSentAt: { type: Date, default: null, select: false },
  originalFileName: { type: String, required: true, trim: true, maxlength: 255 },
  mimeType: { type: String, required: true },
  fileSize: { type: Number, required: true, min: 1 },
  cloudinaryPublicId: { type: String, required: true, select: false },
  availableAt: { type: Date, required: true, default: Date.now, index: true },
}, { timestamps: true });

classMaterialSchema.index({ classOffering: 1, availableAt: 1, createdAt: -1 });
classMaterialSchema.index({ category: 1, availableAt: 1, deadline: 1 });

module.exports = mongoose.models.ClassMaterial || mongoose.model('ClassMaterial', classMaterialSchema);
