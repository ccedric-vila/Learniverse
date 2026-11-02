const ClassOffering = require('../src/models/ClassOffering');
const Enrollment = require('../src/models/Enrollment');
const User = require('../src/models/User');
const { notifyStudentEnrolled } = require('../notifications/notificationService');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const classPopulate = [
  { path: 'subject', select: 'name subjectCode department units description' },
  { path: 'professor', select: 'fullName department' },
];

async function getDashboard(req, res, next) {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate({
        path: 'classOffering',
        match: { isActive: true },
        populate: classPopulate,
      })
      .sort({ createdAt: -1 })
      .lean();

    const offerings = enrollments.map(({ classOffering }) => classOffering).filter(Boolean);
    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const todayMeetings = offerings.flatMap((offering) =>
      (offering.schedule || [])
        .filter((meeting) => meeting.day === today)
        .map((meeting) => ({
          ...meeting,
          offeringId: offering._id,
          subject: offering.subject,
          section: offering.section,
          professor: offering.professor,
        })),
    ).sort((first, second) => first.startTime.localeCompare(second.startTime));

    const schedule = offerings.flatMap((offering) =>
      (offering.schedule || []).map((meeting) => ({
        ...meeting,
        offeringId: offering._id,
        subject: offering.subject,
        section: offering.section,
        professor: offering.professor,
      })),
    ).sort((first, second) => DAYS.indexOf(first.day) - DAYS.indexOf(second.day) || first.startTime.localeCompare(second.startTime));

    return res.json({
      student: { fullName: req.user.fullName },
      stats: { enrolledClasses: offerings.length, todayMeetings: todayMeetings.length, weeklyMeetings: schedule.length },
      today,
      todayMeetings,
      offerings,
      schedule,
    });
  } catch (error) {
    return next(error);
  }
}

async function joinClass(req, res, next) {
  try {
    const suppliedCode = typeof req.body.classCode === 'string' ? req.body.classCode.trim().toUpperCase() : '';
    const normalizedCode = suppliedCode.replace(/-/g, '');
    if (!/^[A-Z0-9]{8}$/.test(normalizedCode)) {
      return res.status(400).json({ message: 'Enter a valid 8-character class code.' });
    }
    const classCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`;
    const offering = await ClassOffering.findOne({ classCode, isActive: true }).select('_id professor');
    if (!offering) return res.status(404).json({ message: 'No active class was found for that code.' });

    const existingEnrollment = await Enrollment.findOne({ student: req.user._id, classOffering: offering._id }).select('_id');
    if (existingEnrollment) return res.status(409).json({ message: 'You have already joined this class.' });

    try {
      await Enrollment.create({ student: req.user._id, classOffering: offering._id });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ message: 'You have already joined this class.' });
      throw error;
    }

    const [joinedOffering, student] = await Promise.all([
      ClassOffering.findById(offering._id).populate(classPopulate).lean(),
      User.findById(req.user._id).select('fullName'),
    ]);
    const notificationsSent = await notifyStudentEnrolled({ student, offering });
    return res.status(201).json({
      message: 'You joined the class successfully.',
      offering: joinedOffering,
      ...(notificationsSent ? {} : { notificationWarning: 'You joined the class, but the professor notification could not be created.' }),
    });
  } catch (error) {
    return next(error);
  }
}

async function getClassDetails(req, res, next) {
  try {
    const enrollment = await Enrollment.findOne({ student: req.user._id, classOffering: req.params.classId })
      .populate({ path: 'classOffering', match: { isActive: true }, populate: classPopulate })
      .lean();
    if (!enrollment?.classOffering) return res.status(404).json({ message: 'Class not found in your active enrollments.' });
    return res.json({ offering: enrollment.classOffering });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found in your active enrollments.' });
    return next(error);
  }
}

module.exports = { getDashboard, getClassDetails, joinClass };
