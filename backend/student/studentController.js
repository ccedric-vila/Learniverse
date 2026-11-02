const ClassOffering = require('../src/models/ClassOffering');
const ClassMaterial = require('../src/models/ClassMaterial');
const Enrollment = require('../src/models/Enrollment');
const MaterialSubmission = require('../src/models/MaterialSubmission');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');
const User = require('../src/models/User');
const { notifyStudentEnrolled } = require('../notifications/notificationService');
const COURSE_PROGRAMS = require('../utils/coursePrograms');
const { DEPARTMENTS } = require('../utils/departments');
const { departmentForProgram } = require('../utils/courseDepartments');

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
      student: {
        fullName: req.user.fullName,
        department: req.user.department,
        courseProgram: req.user.courseProgram,
        yearLevel: req.user.yearLevel,
        section: req.user.section,
      },
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

async function getProfileOptions(_req, res, next) {
  try {
    const courseProgramGroups = COURSE_PROGRAMS.groups
      .map((group) => ({
        ...group,
        programs: group.programs
          .filter((program) => DEPARTMENTS.includes(departmentForProgram(program)))
          .map((program) => ({ name: program, department: departmentForProgram(program) })),
      }))
      .filter((group) => group.programs.length > 0);
    return res.json({ departments: DEPARTMENTS, courseProgramGroups });
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

async function getClassTasks(req, res, next) {
  try {
    const enrollment = await Enrollment.findOne({ student: req.user._id, classOffering: req.params.classId }).select('_id');
    const offering = await ClassOffering.findOne({ _id: req.params.classId, isActive: true }).select('_id');
    if (!enrollment || !offering) return res.status(404).json({ message: 'Class not found in your active enrollments.' });

    const [materials, quizzes] = await Promise.all([
      ClassMaterial.find({
        classOffering: offering._id,
        category: { $in: ['seatwork', 'quiz'] },
        availableAt: { $lte: new Date() },
      }).select('_id title category deadline').lean(),
      Quiz.find({ classOffering: offering._id, isPublished: true })
        .select('_id title deadline')
        .lean(),
    ]);
    const [submissions, attempts] = await Promise.all([
      MaterialSubmission.find({ student: req.user._id, material: { $in: materials.map((material) => material._id) } })
        .select('material status submittedAt')
        .lean(),
      QuizAttempt.find({ student: req.user._id, quiz: { $in: quizzes.map((quiz) => quiz._id) }, attemptType: 'quiz' })
        .select('quiz status submittedAt')
        .lean(),
    ]);
    const submissionsByMaterial = new Map(submissions.map((submission) => [String(submission.material), submission]));
    const attemptsByQuiz = new Map(attempts.map((attempt) => [String(attempt.quiz), attempt]));
    const now = new Date();
    const tasks = [
      ...materials.map((material) => {
        const submission = submissionsByMaterial.get(String(material._id));
        const completed = Boolean(submission?.submittedAt && ['submitted', 'late', 'reviewed'].includes(submission.status));
        return {
          id: String(material._id),
          type: 'material',
          title: material.title,
          category: material.category,
          deadline: material.deadline,
          completed,
          overdue: !completed && Boolean(material.deadline && material.deadline < now),
        };
      }),
      ...quizzes.map((quiz) => {
        const attempt = attemptsByQuiz.get(String(quiz._id));
        const completed = Boolean(attempt?.submittedAt && ['submitted', 'expired'].includes(attempt.status));
        return {
          id: String(quiz._id),
          type: 'quiz',
          title: quiz.title,
          category: 'quiz',
          deadline: quiz.deadline || null,
          completed,
          overdue: !completed && Boolean(quiz.deadline && quiz.deadline < now),
        };
      }),
    ].sort((first, second) => {
      if (first.completed !== second.completed) return Number(first.completed) - Number(second.completed);
      if (!first.deadline) return second.deadline ? 1 : first.title.localeCompare(second.title);
      if (!second.deadline) return -1;
      return new Date(first.deadline) - new Date(second.deadline);
    });

    return res.json({ tasks });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found in your active enrollments.' });
    return next(error);
  }
}

module.exports = { getDashboard, getProfileOptions, getClassDetails, getClassTasks, joinClass };
