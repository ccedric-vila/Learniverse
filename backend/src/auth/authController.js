const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { cloudinary, folder } = require('../../config/cloudinary');
const { createUniqueUsername } = require('../../utils/usernames');
const COURSE_PROGRAMS = require('../../utils/coursePrograms');
const { DEPARTMENTS } = require('../../utils/departments');
const { departmentForProgram } = require('../../utils/courseDepartments');

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2d' },
  );
}

function userPayload(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    username: user.username || '',
    email: user.email,
    role: user.role,
    department: user.department,
    courseProgram: user.courseProgram,
    yearLevel: user.yearLevel,
    section: user.section,
    phone: user.phone,
    birthdate: user.birthdate,
    profileImage: user.profileImage,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

async function register(req, res, next) {
  try {
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }
    if (password.length < 8
      || !/[a-z]/.test(password)
      || !/[A-Z]/.test(password)
      || !/[0-9]/.test(password)
      || !/[^A-Za-z0-9\s]/.test(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Never accept role from public registration; all new accounts are students.
    const username = await createUniqueUsername(fullName);
    const user = await User.create({ fullName, username, email, password, role: 'STUDENT' });
    return res.status(201).json({ user: userPayload(user), token: createToken(user) });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.username) {
        return res.status(409).json({ message: 'That username was just claimed. Please try again.' });
      }
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const identifierValue = req.body.identifier ?? req.body.email;
    const identifier = typeof identifierValue === 'string' ? identifierValue.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!identifier || !password) {
      return res.status(400).json({ message: 'Username or email and password are required.' });
    }

    const identifierQuery = identifier.includes('@') ? { email: identifier } : { username: identifier };
    const user = await User.findOne(identifierQuery).select('+password');
    if (!user || !(await user.matchPassword(password)) || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({ user: userPayload(user), token: createToken(user) });
  } catch (error) {
    return next(error);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User account was not found.' });
    }
    return res.json({ user: userPayload(user) });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    if (!['STUDENT', 'PROFESSOR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only students and professors can edit profiles.' });
    }

    const body = req.body || {};
    const updates = {};

    if (Object.hasOwn(body, 'fullName')) {
      if (typeof body.fullName !== 'string' || !body.fullName.trim()) {
        return res.status(400).json({ message: 'Full name is required.' });
      }
      updates.fullName = body.fullName.trim();
    }

    if (Object.hasOwn(body, 'username')) {
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
        return res.status(400).json({ message: 'Username must be 3–30 characters and use only letters, numbers, dots, underscores, or hyphens.' });
      }
      const usernameInUse = await User.findOne({ username, _id: { $ne: req.user._id } }).select('_id');
      if (usernameInUse) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }
      updates.username = username;
    }

    if (Object.hasOwn(body, 'email')) {
      if (typeof body.email !== 'string' || !body.email.trim()) {
        return res.status(400).json({ message: 'A valid email address is required.' });
      }
      updates.email = body.email.trim().toLowerCase();
      const emailInUse = await User.findOne({ email: updates.email, _id: { $ne: req.user._id } });
      if (emailInUse) {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }
    }

    if (Object.hasOwn(body, 'phone')) {
      if (typeof body.phone !== 'string') {
        return res.status(400).json({ message: 'Phone number must be text.' });
      }
      updates.phone = body.phone.trim();
    }

    if (Object.hasOwn(body, 'birthdate')) {
      if (body.birthdate === '' || body.birthdate === null) {
        updates.birthdate = null;
      } else {
        const birthdate = new Date(body.birthdate);
        if (Number.isNaN(birthdate.getTime()) || birthdate > new Date()) {
          return res.status(400).json({ message: 'Enter a valid birthdate that is not in the future.' });
        }
        updates.birthdate = birthdate;
      }
    }

    if (req.user.role === 'STUDENT') {
      if (Object.hasOwn(body, 'department')) {
        if (typeof body.department !== 'string' || (body.department && !DEPARTMENTS.includes(body.department))) {
          return res.status(400).json({ message: 'Select a valid department.' });
        }
        updates.department = body.department.trim();
      }

      if (Object.hasOwn(body, 'courseProgram')) {
        if (typeof body.courseProgram !== 'string' || (body.courseProgram && !COURSE_PROGRAMS.includes(body.courseProgram))) {
          return res.status(400).json({ message: 'Select a valid course program.' });
        }
        updates.courseProgram = body.courseProgram.trim();
      }

      const selectedDepartment = Object.hasOwn(updates, 'department') ? updates.department : req.user.department;
      const selectedCourseProgram = Object.hasOwn(updates, 'courseProgram') ? updates.courseProgram : req.user.courseProgram;
      if (selectedCourseProgram && departmentForProgram(selectedCourseProgram) !== selectedDepartment) {
        return res.status(400).json({ message: 'The selected course program does not belong to the selected department.' });
      }

      if (Object.hasOwn(body, 'yearLevel')) {
        if (typeof body.yearLevel !== 'string' || body.yearLevel.trim().length > 50) {
          return res.status(400).json({ message: 'Year level must be 50 characters or fewer.' });
        }
        updates.yearLevel = body.yearLevel.trim();
      }

      if (Object.hasOwn(body, 'section')) {
        if (typeof body.section !== 'string' || body.section.trim().length > 30) {
          return res.status(400).json({ message: 'Section must be 30 characters or fewer.' });
        }
        updates.section = body.section.trim();
      }
    }

    if (Object.hasOwn(body, 'profileImage')) {
      if (typeof body.profileImage !== 'string' || (body.profileImage && !/^https:\/\//i.test(body.profileImage.trim()))) {
        return res.status(400).json({ message: 'Profile image must be a secure https URL.' });
      }
      updates.profileImage = body.profileImage.trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'Provide at least one profile field to update.' });
    }

    Object.assign(req.user, updates);
    await req.user.save();
    return res.json({ user: userPayload(req.user) });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.username) {
        return res.status(409).json({ message: 'That username is already taken.' });
      }
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function uploadProfileImage(req, res, next) {
  try {
    if (!['STUDENT', 'PROFESSOR'].includes(req.user.role)) {
      return res.status(403).json({ message: 'Only students and professors can upload profile images.' });
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Choose an image to upload.' });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream({
        folder: `${folder}/profiles/${req.user.role.toLowerCase()}`,
        resource_type: 'image',
        transformation: [
          { width: 600, height: 600, crop: 'fill', gravity: 'face' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
      }, (error, result) => {
        if (error) return reject(error);
        return resolve(result);
      });
      upload.end(req.file.buffer);
    });

    return res.status(201).json({ image: { url: uploadResult.secure_url, publicId: uploadResult.public_id } });
  } catch (error) {
    return next(error);
  }
}

module.exports = { register, login, getMe, updateProfile, uploadProfileImage };