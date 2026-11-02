const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { ALL_DEPARTMENTS } = require('../../utils/departments');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: 150,
  },
  username: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    minlength: 3,
    maxlength: 30,
    match: [/^[a-z0-9._-]+$/, 'Username can use letters, numbers, dots, underscores, and hyphens'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254,
    match: [/^\S+@\S+\.\S+$/, 'Enter a valid email address'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
    enum: ['ADMIN', 'PROFESSOR', 'STUDENT'],
    default: 'STUDENT',
  },
  department: {
    type: String,
    enum: ALL_DEPARTMENTS,
    trim: true,
  },
  courseProgram: {
    type: String,
    trim: true,
    maxlength: 150,
  },
  yearLevel: {
    type: String,
    trim: true,
    maxlength: 50,
  },
  section: {
    type: String,
    trim: true,
    maxlength: 30,
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 30,
  },
  birthdate: {
    type: Date,
    validate: {
      validator: (value) => !value || value <= new Date(),
      message: 'Birthdate cannot be in the future',
    },
  },
  profileImage: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function hashPassword() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.matchPassword = function matchPassword(enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);