const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const PendingRegistration = require('../models/PendingRegistration');
const { cloudinary, folder } = require('../../config/cloudinary');
const { createUniqueUsername } = require('../../utils/usernames');
const COURSE_PROGRAMS = require('../../utils/coursePrograms');
const { DEPARTMENTS } = require('../../utils/departments');
const { departmentForProgram } = require('../../utils/courseDepartments');
const {
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
  RESEND_COOLDOWN_SECONDS,
  createVerificationCode,
  hashVerificationCode,
  validRegistrationPassword,
  verificationCodeMatches,
} = require('./registrationVerification');

const googleOAuthClient = new OAuth2Client();

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function sendRegistrationCode(email, code) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) {
    throw httpError(503, 'Email verification is not configured. Please contact the system administrator.');
  }

  let response;
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: [email],
        subject: 'Your Learniverse verification code',
        text: `Your Learniverse verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw httpError(502, 'We could not send the verification email. Please try again later.');
  }
  if (!response.ok) {
    console.error(`Resend rejected a registration email with status ${response.status}.`);
    throw httpError(502, 'We could not send the verification email. Please try again later.');
  }
}

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

    if (!fullName || !email || !password || fullName.length > 150 || email.length > 254
      || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ message: 'Full name, email, and password are required.' });
    }
    if (!validRegistrationPassword(password)) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character.',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const now = new Date();
    const pending = await PendingRegistration.findOne({ email });
    const cooldownRemaining = pending
      ? RESEND_COOLDOWN_SECONDS - Math.floor((now.getTime() - pending.lastSentAt.getTime()) / 1000)
      : 0;
    if (pending && pending.expiresAt > now && cooldownRemaining > 0) {
      return res.status(429).json({
        message: `Wait ${cooldownRemaining} seconds before requesting another verification code.`,
        retryAfterSeconds: cooldownRemaining,
      });
    }

    if (!process.env.JWT_SECRET) {
      throw httpError(503, 'Registration is not configured. Please contact the system administrator.');
    }
    const code = createVerificationCode();
    const passwordHash = await bcrypt.hash(password, 10);
    await sendRegistrationCode(email, code);
    await PendingRegistration.findOneAndUpdate(
      { email },
      {
        fullName,
        email,
        passwordHash,
        codeHash: hashVerificationCode(email, code, process.env.JWT_SECRET),
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
        lastSentAt: now,
        attempts: 0,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.status(202).json({
      message: 'A verification code has been sent to your email address.',
      expiresInMinutes: CODE_TTL_MINUTES,
      retryAfterSeconds: RESEND_COOLDOWN_SECONDS,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function verifyRegistration(req, res, next) {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const code = typeof req.body.code === 'string' ? req.body.code.trim() : '';
    if (!email || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ message: 'Enter the email address and six-digit verification code.' });
    }
    if (!process.env.JWT_SECRET) {
      throw httpError(503, 'Registration is not configured. Please contact the system administrator.');
    }

    const pending = await PendingRegistration.findOne({ email }).select('+passwordHash +codeHash');
    const now = new Date();
    if (!pending || pending.expiresAt <= now) {
      if (pending) await PendingRegistration.deleteOne({ _id: pending._id });
      return res.status(400).json({ message: 'That verification code is invalid or expired. Request a new code.' });
    }
    if (!verificationCodeMatches(email, code, pending.codeHash, process.env.JWT_SECRET)) {
      const updated = await PendingRegistration.findOneAndUpdate(
        { _id: pending._id, attempts: { $lt: MAX_CODE_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true },
      );
      if (!updated || updated.attempts >= MAX_CODE_ATTEMPTS) {
        await PendingRegistration.deleteOne({ _id: pending._id });
        return res.status(429).json({ message: 'Too many incorrect codes. Start registration again to get a new code.' });
      }
      return res.status(400).json({ message: 'That verification code is incorrect.' });
    }

    const consumed = await PendingRegistration.findOneAndDelete({
      _id: pending._id,
      codeHash: pending.codeHash,
      attempts: { $lt: MAX_CODE_ATTEMPTS },
      expiresAt: { $gt: now },
    }).select('+passwordHash');
    if (!consumed) {
      return res.status(400).json({ message: 'That verification code is invalid or expired. Request a new code.' });
    }

    if (await User.exists({ email })) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    const username = await createUniqueUsername(consumed.fullName);
    const user = new User({
      fullName: consumed.fullName,
      username,
      email,
      password: consumed.passwordHash,
      role: 'STUDENT',
    });
    user.$locals.passwordAlreadyHashed = true;
    await user.save();
    return res.status(201).json({ user: userPayload(user), token: createToken(user) });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.username) {
        return res.status(409).json({ message: 'That username was just claimed. Please request a new code.' });
      }
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
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
    if (!user || !user.password || !(await user.matchPassword(password)) || !user.isActive) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    return res.json({ user: userPayload(user), token: createToken(user) });
  } catch (error) {
    return next(error);
  }
}

async function googleLogin(req, res, next) {
  try {
    const credential = typeof req.body.credential === 'string' ? req.body.credential : '';
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw httpError(503, 'Google sign-in is not configured. Please contact the system administrator.');
    if (!credential || credential.length > 10000) {
      return res.status(400).json({ message: 'A valid Google sign-in credential is required.' });
    }

    let payload;
    try {
      const ticket = await googleOAuthClient.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ message: 'Google could not verify this sign-in. Please try again.' });
    }
    if (!payload?.sub || !payload.email || payload.email_verified !== true || !payload.name) {
      return res.status(401).json({ message: 'Use a Google account with a verified email address.' });
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ email }).select('+googleId');
    if (user) {
      if (user.role !== 'STUDENT') {
        return res.status(403).json({ message: 'Google sign-in is only available for student accounts. Use your provisioned account to sign in.' });
      }
      if (!user.isActive) return res.status(401).json({ message: 'This account has been deactivated.' });
      if (user.googleId && user.googleId !== payload.sub) {
        return res.status(409).json({ message: 'This email is already linked to a different Google account.' });
      }
      if (!user.googleId) {
        user.googleId = payload.sub;
        await user.save();
      }
    } else {
      const fullName = payload.name.trim().slice(0, 150);
      if (!fullName) return res.status(400).json({ message: 'Your Google profile must include a name.' });
      const username = await createUniqueUsername(fullName);
      user = await User.create({
        fullName,
        username,
        email,
        googleId: payload.sub,
        role: 'STUDENT',
      });
    }
    return res.json({ user: userPayload(user), token: createToken(user) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'This Google account could not be linked. Please sign in with your existing method.' });
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
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

module.exports = {
  getMe,
  googleLogin,
  login,
  register,
  updateProfile,
  uploadProfileImage,
  verifyRegistration,
};