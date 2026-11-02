const mongoose = require('mongoose');

const materialSubmissionSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassMaterial', required: true, index: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, trim: true, maxlength: 2000, default: '' },
  originalFileName: { type: String, trim: true, maxlength: 255, default: '' },
  mimeType: { type: String, trim: true, default: '' },
  fileSize: { type: Number, default: 0, min: 0 },
  cloudinaryPublicId: { type: String, trim: true, default: '', select: false },
  submittedAt: { type: Date, default: null, index: true },
  pointsEarned: { type: Number, default: null, min: 0 },
  feedback: { type: String, trim: true, maxlength: 2000, default: '' },
  gradedAt: { type: Date, default: null },
  notificationSentAt: { type: Date, default: null, select: false },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'late', 'reviewed'],
    default: 'draft',
  },
}, { timestamps: true });

materialSubmissionSchema.index({ material: 1, student: 1 }, { unique: true });
materialSubmissionSchema.index({ material: 1, status: 1, student: 1 });
module.exports = mongoose.models.MaterialSubmission || mongoose.model('MaterialSubmission', materialSubmissionSchema);
