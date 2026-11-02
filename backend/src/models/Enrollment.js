const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  classOffering: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassOffering', required: true },
}, { timestamps: true });

enrollmentSchema.index({ student: 1, classOffering: 1 }, { unique: true });
enrollmentSchema.index({ classOffering: 1, student: 1 });

module.exports = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
