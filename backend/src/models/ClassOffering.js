const mongoose = require('mongoose');
const COURSE_PROGRAMS = require('../../utils/coursePrograms');

const meetingSchema = new mongoose.Schema({
  day: {
    type: String,
    required: true,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  room: { type: String, trim: true, maxlength: 100, default: '' },
}, { _id: false });

const classOfferingSchema = new mongoose.Schema({
  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  professor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  section: { type: String, required: true, trim: true, maxlength: 30 },
  courseProgram: { type: String, enum: COURSE_PROGRAMS },
  schoolYear: { type: String, required: true, trim: true, maxlength: 30 },
  term: { type: String, required: true, trim: true, maxlength: 50 },
  schedule: {
    type: [meetingSchema],
    validate: [(entries) => entries.length > 0, 'At least one class meeting is required'],
  },
  classCode: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

module.exports = mongoose.models.ClassOffering || mongoose.model('ClassOffering', classOfferingSchema);