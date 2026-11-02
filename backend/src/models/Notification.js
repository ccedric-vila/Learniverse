const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    required: true,
    enum: ['material_published', 'assessment_published', 'online_quiz_published', 'grade_posted', 'student_enrolled', 'class_updated', 'deadline_reminder'],
  },
  title: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  href: { type: String, required: true, trim: true, maxlength: 300 },
  eventKey: { type: String, required: true, maxlength: 200 },
  readAt: { type: Date, default: null },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });

module.exports = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
