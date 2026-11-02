const { randomInt } = require('node:crypto');
const User = require('../src/models/User');
const Subject = require('../src/models/Subject');
const ClassOffering = require('../src/models/ClassOffering');
const Enrollment = require('../src/models/Enrollment');
const { notifyClassUpdated } = require('../notifications/notificationService');
const { cloudinary, folder } = require('../config/cloudinary');
const COURSE_PROGRAMS = require('../utils/coursePrograms');
const { DEPARTMENTS } = require('../utils/departments');
const { departmentForProgram } = require('../utils/courseDepartments');
const seedCourseSubjects = require('../utils/seedCourseSubjects');

const professorFields = 'fullName email department phone birthdate profileImage isActive createdAt';
const classCodeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateClassCode() {
  const characters = Array.from({ length: 8 }, () => classCodeAlphabet[randomInt(classCodeAlphabet.length)]);
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}

async function getDashboard(_req, res, next) {
  try {
    const [professors, activeProfessorCount, activeStudentCount, inactiveCount] = await Promise.all([
      User.find({ role: 'PROFESSOR' }).select(professorFields).sort({ createdAt: -1 }).limit(8).lean(),
      User.countDocuments({ role: 'PROFESSOR', isActive: true }),
      User.countDocuments({ role: 'STUDENT', isActive: true }),
      User.countDocuments({ isActive: false }),
    ]);

    return res.json({
      stats: { professors: activeProfessorCount, students: activeStudentCount, inactiveAccounts: inactiveCount },
      professors,
    });
  } catch (error) {
    return next(error);
  }
}

async function getProfessors(req, res, next) {
  try {
    const status = req.query.status || 'active';
    if (!['active', 'inactive', 'all'].includes(status)) {
      return res.status(400).json({ message: 'Status must be active, inactive, or all.' });
    }
    const filter = { role: 'PROFESSOR' };
    if (status !== 'all') filter.isActive = status === 'active';
    const professors = await User.find(filter)
      .select('fullName email department phone isActive profileImage createdAt')
      .sort({ fullName: 1 })
      .lean();
    return res.json({ professors });
  } catch (error) {
    return next(error);
  }
}

async function createProfessor(req, res, next) {
  try {
    const fullName = typeof req.body.fullName === 'string' ? req.body.fullName.trim() : '';
    const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    const phone = typeof req.body.phone === 'string' ? req.body.phone.trim() : '';
    const birthdate = req.body.birthdate || undefined;
    const profileImage = typeof req.body.profileImage === 'string' ? req.body.profileImage.trim() : '';

    if (!fullName || !username || !email || !password || !department) {
      return res.status(400).json({ message: 'Full name, username, email, temporary password, and department are required.' });
    }
    if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
      return res.status(400).json({ message: 'Username must be 3–30 characters and use only letters, numbers, dots, underscores, or hyphens.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Temporary password must be at least 8 characters.' });
    }
    if (profileImage && !/^https?:\/\//i.test(profileImage)) {
      return res.status(400).json({ message: 'Profile image must be a valid http or https URL.' });
    }

    const existingUser = await User.findOne({ email }).select('_id');
    if (existingUser) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const existingUsername = await User.findOne({ username }).select('_id');
    if (existingUsername) {
      return res.status(409).json({ message: 'That username is already taken.' });
    }

    const professor = await User.create({
      fullName,
      username,
      email,
      password,
      department,
      phone,
      birthdate,
      profileImage,
      role: 'PROFESSOR',
      isActive: true,
    });

    return res.status(201).json({
      message: 'Professor account created successfully.',
      professor: {
        id: professor._id,
        fullName: professor.fullName,
        username: professor.username,
        email: professor.email,
        role: professor.role,
        department: professor.department,
        phone: professor.phone,
        birthdate: professor.birthdate,
        profileImage: professor.profileImage,
        isActive: professor.isActive,
        createdAt: professor.createdAt,
      },
    });
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

async function uploadProfessorImage(req, res, next) {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'Choose an image to upload.' });
    }

    const uploadResult = await new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream({
        folder: `${folder}/professors`,
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

    return res.status(201).json({
      image: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      },
    });
  } catch (error) {
    return next(error);
  }
}

async function getSubjects(_req, res, next) {
  try {
    const subjects = await Subject.find().sort({ name: 1 }).lean();
    return res.json({ subjects });
  } catch (error) {
    return next(error);
  }
}

async function seedCurriculumSubjects(req, res, next) {
  try {
    const courseProgram = typeof req.body?.courseProgram === 'string' ? req.body.courseProgram : '';
    if (!COURSE_PROGRAMS.includes(courseProgram)) {
      return res.status(400).json({ message: 'Select a valid course program.' });
    }
    const result = await seedCourseSubjects(req.user._id, courseProgram);
    return res.json({
      message: `Curriculum subjects are ready. Added ${result.inserted} new subject${result.inserted === 1 ? '' : 's'}.`,
      ...result,
    });
  } catch (error) {
    return next(error);
  }
}

async function createSubject(req, res, next) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const subjectCode = typeof req.body.subjectCode === 'string' ? req.body.subjectCode.trim().toUpperCase() : '';
    const courseProgram = typeof req.body.courseProgram === 'string' ? req.body.courseProgram.trim() : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const units = req.body.units === '' || req.body.units === undefined ? 3 : Number(req.body.units);

    if (!name || !subjectCode || !department) {
      return res.status(400).json({ message: 'Subject name, subject code, and department are required.' });
    }
    if (!/^[A-Z0-9-]{2,20}$/.test(subjectCode)) {
      return res.status(400).json({ message: 'Subject code must be 2–20 letters, numbers, or hyphens.' });
    }
    if (!DEPARTMENTS.includes(department)) {
      return res.status(400).json({ message: 'Choose a valid department.' });
    }
    if (courseProgram && !COURSE_PROGRAMS.includes(courseProgram)) {
      return res.status(400).json({ message: 'Choose a valid course program.' });
    }
    if (!Number.isFinite(units) || units < 0 || units > 20) {
      return res.status(400).json({ message: 'Units must be a number from 0 to 20.' });
    }

    const subject = await Subject.create({
      name,
      subjectCode,
      ...(courseProgram ? { courseProgram } : {}),
      department,
      description,
      units,
      createdBy: req.user._id,
    });
    return res.status(201).json({ subject });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'That subject code is already in use.' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function createOtherSubject(req, res, next) {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const subjectCode = typeof req.body.subjectCode === 'string' ? req.body.subjectCode.trim().toUpperCase() : '';
    const courseProgram = typeof req.body.courseProgram === 'string' ? req.body.courseProgram.trim() : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const units = req.body.units === '' || req.body.units === undefined ? 3 : Number(req.body.units);
    if (!name || name.length > 150 || !subjectCode || !department) {
      return res.status(400).json({ message: 'Subject name, subject code, and department are required.' });
    }
    if (!/^[A-Z0-9-]{2,20}$/.test(subjectCode)) {
      return res.status(400).json({ message: 'Subject code must be 2–20 letters, numbers, or hyphens.' });
    }
    if (!COURSE_PROGRAMS.includes(courseProgram)) {
      return res.status(400).json({ message: 'Choose a valid course program.' });
    }
    if (!DEPARTMENTS.includes(department)) return res.status(400).json({ message: 'Choose a valid department.' });
    if (departmentForProgram(courseProgram) && department !== departmentForProgram(courseProgram)) {
      return res.status(400).json({ message: 'The subject department must match the selected course program.' });
    }
    if (!Number.isFinite(units) || units < 0 || units > 20) {
      return res.status(400).json({ message: 'Units must be a number from 0 to 20.' });
    }
    if (description.length > 2000) return res.status(400).json({ message: 'Description cannot exceed 2000 characters.' });

    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingSubject = await Subject.findOne({
      courseProgram,
      name: { $regex: `^${escapedName}$`, $options: 'i' },
    });
    if (existingSubject) return res.json({ subject: existingSubject, existing: true });

    const subject = await Subject.create({ name, subjectCode, courseProgram, department, description, units, createdBy: req.user._id });
    return res.status(201).json({ subject, existing: false });
  } catch (error) {
    if (error.code === 11000) {
      if (error.keyPattern?.subjectCode) return res.status(409).json({ message: 'That subject code is already in use.' });
      if (error.keyPattern?.name) return res.status(409).json({ message: 'That subject already exists.' });
    }
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    return next(error);
  }
}

async function updateSubject(req, res, next) {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found.' });

    if (Object.hasOwn(req.body, 'name')) {
      const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
      if (!name) return res.status(400).json({ message: 'Subject name is required.' });
      subject.name = name;
    }
    if (Object.hasOwn(req.body, 'subjectCode')) {
      const subjectCode = typeof req.body.subjectCode === 'string' ? req.body.subjectCode.trim().toUpperCase() : '';
      if (!/^[A-Z0-9-]{2,20}$/.test(subjectCode)) {
        return res.status(400).json({ message: 'Subject code must be 2–20 letters, numbers, or hyphens.' });
      }
      subject.subjectCode = subjectCode;
    }
    if (Object.hasOwn(req.body, 'courseProgram')) {
      if (!COURSE_PROGRAMS.includes(req.body.courseProgram)) return res.status(400).json({ message: 'Choose a valid course program.' });
      subject.courseProgram = req.body.courseProgram;
    }
    if (Object.hasOwn(req.body, 'department')) {
      if (!DEPARTMENTS.includes(req.body.department)) return res.status(400).json({ message: 'Choose a valid department.' });
      subject.department = req.body.department;
    }
    if (Object.hasOwn(req.body, 'description')) {
      subject.description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    }
    if (Object.hasOwn(req.body, 'units')) {
      const units = Number(req.body.units);
      if (!Number.isFinite(units) || units < 0 || units > 20) {
        return res.status(400).json({ message: 'Units must be a number from 0 to 20.' });
      }
      subject.units = units;
    }
    if (Object.hasOwn(req.body, 'isActive')) {
      if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'Status must be active or inactive.' });
      subject.isActive = req.body.isActive;
    }

    await subject.save();
    return res.json({ subject });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'That subject code is already in use.' });
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function getClassOfferings(_req, res, next) {
  try {
    const offerings = await ClassOffering.find()
      .populate('subject', 'name subjectCode courseProgram department units isActive')
      .populate('professor', 'fullName email department')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ offerings });
  } catch (error) {
    return next(error);
  }
}

async function createClassOffering(req, res, next) {
  try {
    const { subjectId, professorId, section, courseProgram, schoolYear, term, schedule } = req.body;
    if (![subjectId, professorId, section, courseProgram, schoolYear, term].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Subject, professor, section, course program, school year, and term are required.' });
    }
    if (!COURSE_PROGRAMS.includes(courseProgram)) {
      return res.status(400).json({ message: 'Select a valid course program.' });
    }
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ message: 'Add at least one meeting to the class schedule.' });
    }

    const [subject, professor] = await Promise.all([
      Subject.findById(subjectId),
      User.findOne({ _id: professorId, role: 'PROFESSOR', isActive: true }),
    ]);
    if (!subject || !subject.isActive) {
      return res.status(404).json({ message: 'Active subject not found.' });
    }
    if (subject.courseProgram
      && subject.courseProgram !== courseProgram
      && !['General Education (GE)', 'Mandatory Institutional Subjects (PE/NSTP)', 'Mathematics & Basic Sciences'].includes(subject.courseProgram)) {
      return res.status(400).json({ message: 'The selected subject does not belong to the selected course program.' });
    }
    if (!professor) {
      return res.status(404).json({ message: 'Active professor not found.' });
    }

    const meetings = normalizeSchedule(schedule);
    const scheduleError = validateSchedule(meetings);
    if (scheduleError) return res.status(400).json({ message: scheduleError });

    let offering;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        offering = await ClassOffering.create({
          subject: subject._id,
          professor: professor._id,
          section: section.trim(),
          courseProgram,
          schoolYear: schoolYear.trim(),
          term: term.trim(),
          schedule: meetings,
          classCode: generateClassCode(),
          createdBy: req.user._id,
        });
        break;
      } catch (error) {
        if (error.code === 11000 && error.keyPattern?.classCode && attempt < 4) continue;
        throw error;
      }
    }

    await offering.populate([
      { path: 'subject', select: 'name subjectCode department units' },
      { path: 'professor', select: 'fullName email department' },
    ]);
    await notifyClassUpdated({
      offering,
      professorIds: [offering.professor._id],
      eventKey: `class-assigned:${offering._id}`,
    });
    return res.status(201).json({ offering });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

function normalizeSchedule(schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule.map((meeting) => ({
    day: typeof meeting?.day === 'string' ? meeting.day : '',
    startTime: typeof meeting?.startTime === 'string' ? meeting.startTime : '',
    endTime: typeof meeting?.endTime === 'string' ? meeting.endTime : '',
    room: typeof meeting?.room === 'string' ? meeting.room.trim() : '',
  }));
}

function validateSchedule(meetings) {
  if (meetings.length === 0) return 'Add at least one meeting to the class schedule.';
  for (const meeting of meetings) {
    if (!weekDays.includes(meeting.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.endTime)) {
      return 'Each schedule needs a valid day, start time, and end time.';
    }
    if (meeting.startTime >= meeting.endTime) return 'Each meeting end time must be after its start time.';
  }
  return '';
}

async function updateClassOffering(req, res, next) {
  try {
    const offering = await ClassOffering.findById(req.params.id);
    if (!offering) return res.status(404).json({ message: 'Class offering not found.' });
    if (Object.keys(req.body).length === 1 && Object.hasOwn(req.body, 'isActive')) {
      if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'Status must be active or inactive.' });
      offering.isActive = req.body.isActive;
      await offering.save();
      await offering.populate([
        { path: 'subject', select: 'name subjectCode department units isActive' },
        { path: 'professor', select: 'fullName email department' },
      ]);
      const studentIds = await Enrollment.distinct('student', { classOffering: offering._id });
      await notifyClassUpdated({
        offering,
        studentIds,
        eventKey: `class-updated:${offering._id}:${offering.updatedAt.getTime()}`,
      });
      return res.json({ offering });
    }

    const previousProfessorId = String(offering.professor);
    const subjectId = String(Object.hasOwn(req.body, 'subjectId') ? req.body.subjectId : offering.subject);
    const professorId = String(Object.hasOwn(req.body, 'professorId') ? req.body.professorId : offering.professor);
    const section = Object.hasOwn(req.body, 'section') ? req.body.section : offering.section;
    const courseProgram = Object.hasOwn(req.body, 'courseProgram') ? req.body.courseProgram : offering.courseProgram;
    const schoolYear = Object.hasOwn(req.body, 'schoolYear') ? req.body.schoolYear : offering.schoolYear;
    const term = Object.hasOwn(req.body, 'term') ? req.body.term : offering.term;
    const schedule = Object.hasOwn(req.body, 'schedule') ? req.body.schedule : offering.schedule;

    if (![subjectId, professorId, section, courseProgram, schoolYear, term].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Subject, professor, section, course program, school year, and term are required.' });
    }
    if (!COURSE_PROGRAMS.includes(courseProgram)) {
      return res.status(400).json({ message: 'Select a valid course program.' });
    }
    const [subject, professor] = await Promise.all([
      Subject.findById(subjectId),
      User.findOne({ _id: professorId, role: 'PROFESSOR', isActive: true }),
    ]);
    if (!subject || !subject.isActive) return res.status(404).json({ message: 'Active subject not found.' });
    if (subject.courseProgram
      && subject.courseProgram !== courseProgram
      && !['General Education (GE)', 'Mandatory Institutional Subjects (PE/NSTP)', 'Mathematics & Basic Sciences'].includes(subject.courseProgram)) {
      return res.status(400).json({ message: 'The selected subject does not belong to the selected course program.' });
    }
    if (!professor) return res.status(404).json({ message: 'Active professor not found.' });

    const meetings = normalizeSchedule(schedule);
    const scheduleError = validateSchedule(meetings);
    if (scheduleError) return res.status(400).json({ message: scheduleError });

    offering.subject = subject._id;
    offering.professor = professor._id;
    offering.section = String(section).trim();
    offering.courseProgram = courseProgram;
    offering.schoolYear = String(schoolYear).trim();
    offering.term = String(term).trim();
    offering.schedule = meetings;
    if (Object.hasOwn(req.body, 'isActive')) {
      if (typeof req.body.isActive !== 'boolean') return res.status(400).json({ message: 'Status must be active or inactive.' });
      offering.isActive = req.body.isActive;
    }
    await offering.save();
    await offering.populate([
      { path: 'subject', select: 'name subjectCode department units isActive' },
      { path: 'professor', select: 'fullName email department' },
    ]);
    const studentIds = await Enrollment.distinct('student', { classOffering: offering._id });
    await notifyClassUpdated({
      offering,
      studentIds,
      professorIds: previousProfessorId === String(offering.professor._id) ? [] : [offering.professor._id],
      eventKey: `class-updated:${offering._id}:${offering.updatedAt.getTime()}`,
    });
    return res.json({ offering });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

module.exports = {
  getDashboard,
  getProfessors,
  createProfessor,
  uploadProfessorImage,
  getSubjects,
  seedCurriculumSubjects,
  createSubject,
  createOtherSubject,
  updateSubject,
  getClassOfferings,
  createClassOffering,
  updateClassOffering,
};