const mongoose = require('mongoose');

const materialCommentSchema = new mongoose.Schema({
  material: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassMaterial', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: true });

materialCommentSchema.index({ material: 1, createdAt: 1 });

module.exports = mongoose.models.MaterialComment || mongoose.model('MaterialComment', materialCommentSchema);
