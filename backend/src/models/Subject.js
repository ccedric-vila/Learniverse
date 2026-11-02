const mongoose = require('mongoose');
const COURSE_PROGRAMS = require('../../utils/coursePrograms');
const { ALL_DEPARTMENTS } = require('../../utils/departments');

const subjectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 150 },
  subjectCode: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 20 },
  courseProgram: { type: String, enum: COURSE_PROGRAMS, default: undefined },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  department: { type: String, required: true, enum: ALL_DEPARTMENTS },
  units: { type: Number, min: 0, max: 20, default: 3 },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.models.Subject || mongoose.model('Subject', subjectSchema);