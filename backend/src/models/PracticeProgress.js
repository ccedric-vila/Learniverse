const mongoose = require('mongoose');

const practiceProgressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassMaterial', required: true },
  attemptsUsed: { type: Number, default: 0, min: 0, max: 3 },
}, { timestamps: true });

practiceProgressSchema.index({ student: 1, material: 1 }, { unique: true });

module.exports = mongoose.models.PracticeProgress || mongoose.model('PracticeProgress', practiceProgressSchema);
