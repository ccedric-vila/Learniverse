const mongoose = require('mongoose');

const pendingRegistrationSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true, maxlength: 150 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  codeHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, expires: 0 },
  lastSentAt: { type: Date, required: true },
  attempts: { type: Number, required: true, default: 0 },
}, { timestamps: true });

module.exports = mongoose.models.PendingRegistration
  || mongoose.model('PendingRegistration', pendingRegistrationSchema);
