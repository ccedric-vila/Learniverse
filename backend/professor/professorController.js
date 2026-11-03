const ClassOffering = require('../src/models/ClassOffering');
const ClassMaterial = require('../src/models/ClassMaterial');
const Enrollment = require('../src/models/Enrollment');
const MaterialSubmission = require('../src/models/MaterialSubmission');
const Subject = require('../src/models/Subject');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');
const { notifyClassUpdated } = require('../notifications/notificationService');
const COURSE_PROGRAMS = require('../utils/coursePrograms');
const { DEPARTMENTS } = require('../utils/departments');
const { departmentForProgram } = require('../utils/courseDepartments');
const {
  findScheduleConflicts,
  formatTime12,
  generateClassCode,
  normalizeSchedule,
  validateSchedule,
} = require('../utils/classOffering');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function getClassCreationOptions(req, res, next) {
  try {
    const [subjects, offerings] = await Promise.all([
      Subject.find({ isActive: true })
        .select('name subjectCode courseProgram department')
        .sort({ name: 1 })
        .lean(),
      ClassOffering.find({ professor: req.user._id, isActive: true })
        .populate('subject', 'name')
        .select('subject section schedule')
        .lean(),
    ]);
    const courseProgramGroups = COURSE_PROGRAMS.groups
      .map((group) => ({
        ...group,
        programs: group.programs
          .filter((program) => DEPARTMENTS.includes(departmentForProgram(program)))
          .map((program) => ({ name: program, department: departmentForProgram(program) })),
      }))
      .filter((group) => group.programs.length > 0);
    const occupiedSchedule = offerings.flatMap((offering) => (
      (offering.schedule || []).map((meeting) => ({
        ...meeting,
        subject: offering.subject?.name || 'Class',
        section: offering.section,
      }))
    ));
    const existingClasses = offerings.map((offering) => ({
      subjectId: String(offering.subject?._id || offering.subject),
      subject: offering.subject?.name || 'Class',
      section: offering.section,
      schedule: offering.schedule || [],
    }));
    return res.json({ subjects, departments: DEPARTMENTS, courseProgramGroups, occupiedSchedule, existingClasses });
  } catch (error) {
    return next(error);
  }
}

async function createClassOffering(req, res, next) {
  try {
    const { subjectId, section, courseProgram, schoolYear, term, schedule } = req.body;
    if (![subjectId, section, courseProgram, schoolYear, term].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Subject, course program, section, school year, and term are required.' });
    }
    if (!COURSE_PROGRAMS.includes(courseProgram)) {
      return res.status(400).json({ message: 'Select a valid course program.' });
    }
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ message: 'Add at least one meeting to the class schedule.' });
    }

    const subject = await Subject.findById(subjectId);
    if (!subject || !subject.isActive) {
      return res.status(404).json({ message: 'Active subject not found.' });
    }
    if (subject.courseProgram
      && subject.courseProgram !== courseProgram
      && !['General Education (GE)', 'Mandatory Institutional Subjects (PE/NSTP)', 'Mathematics & Basic Sciences'].includes(subject.courseProgram)) {
      return res.status(400).json({ message: 'The selected subject does not belong to the selected course program.' });
    }

    const meetings = normalizeSchedule(schedule);
    const scheduleError = validateSchedule(meetings);
    if (scheduleError) return res.status(400).json({ message: scheduleError });

    const activeOfferings = await ClassOffering.find({ professor: req.user._id, isActive: true })
      .populate('subject', 'name')
      .select('subject section schedule')
      .lean();
    const occupiedMeetings = activeOfferings.flatMap((offering) => (
      (offering.schedule || []).map((meeting) => ({
        ...meeting,
        subject: offering.subject?.name || 'Class',
        section: offering.section,
      }))
    ));
    const scheduleConflicts = findScheduleConflicts(meetings, occupiedMeetings);
    if (scheduleConflicts.length > 0) {
      const firstConflict = scheduleConflicts[0];
      const conflictDescription = firstConflict.kind === 'occupied'
        ? `${firstConflict.subject} · Section ${firstConflict.section}`
        : `another meeting in this class (meeting ${firstConflict.conflictingMeetingIndex + 1})`;
      return res.status(409).json({
        message: `Schedule conflict: ${firstConflict.day} ${formatTime12(firstConflict.startTime)}–${formatTime12(firstConflict.endTime)} overlaps with ${conflictDescription}.`,
        conflicts: scheduleConflicts,
      });
    }

    let offering;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        offering = await ClassOffering.create({
          subject: subject._id,
          professor: req.user._id,
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
    return res.status(201).json({ offering });
  } catch (error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    return next(error);
  }
}

async function getDashboard(req, res, next) {
  try {
    const offerings = await ClassOffering.find({ professor: req.user._id, isActive: true })
      .populate('subject', 'name subjectCode department units')
      .sort({ schoolYear: -1, term: 1, section: 1 })
      .lean();

    const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
    const todayMeetings = offerings.flatMap((offering) =>
      (offering.schedule || [])
        .filter((meeting) => meeting.day === today)
        .map((meeting) => ({
          ...meeting,
          offeringId: offering._id,
          subject: offering.subject,
          section: offering.section,
          classCode: offering.classCode,
        })),
    ).sort((first, second) => first.startTime.localeCompare(second.startTime));

    const schedule = offerings
      .flatMap((offering) =>
        (offering.schedule || []).map((meeting) => ({
          ...meeting,
          offeringId: offering._id,
          subject: offering.subject,
          section: offering.section,
          schoolYear: offering.schoolYear,
          term: offering.term,
          classCode: offering.classCode,
        })),
      )
      .sort((first, second) => DAYS.indexOf(first.day) - DAYS.indexOf(second.day) || first.startTime.localeCompare(second.startTime));
    const offeringIds = offerings.map((offering) => offering._id);
    const [enrollments, materials, quizzes] = await Promise.all([
      Enrollment.find({ classOffering: { $in: offeringIds } })
        .populate({ path: 'student', match: { role: 'STUDENT', isActive: true }, select: '_id' })
        .select('student classOffering')
        .lean(),
      ClassMaterial.find({
        classOffering: { $in: offeringIds },
        category: { $in: ['seatwork', 'quiz'] },
        availableAt: { $lte: new Date() },
      }).select('_id title classOffering category').lean(),
      Quiz.find({ classOffering: { $in: offeringIds }, isPublished: true })
        .select('_id title classOffering')
        .lean(),
    ]);
    const [materialSubmissions, quizAttempts] = await Promise.all([
      MaterialSubmission.find({
        material: { $in: materials.map((material) => material._id) },
        status: { $in: ['draft', 'submitted', 'late', 'reviewed'] },
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate({ path: 'student', match: { role: 'STUDENT', isActive: true }, select: 'fullName profileImage' })
        .populate({
          path: 'material',
          select: 'title classOffering category',
          populate: {
            path: 'classOffering',
            select: 'subject section',
            populate: { path: 'subject', select: 'name subjectCode' },
          },
        })
        .lean(),
      QuizAttempt.find({
        quiz: { $in: quizzes.map((quiz) => quiz._id) },
        attemptType: 'quiz',
        status: { $in: ['in_progress', 'submitted', 'expired'] },
      })
        .sort({ updatedAt: -1 })
        .limit(10)
        .populate({ path: 'student', match: { role: 'STUDENT', isActive: true }, select: 'fullName profileImage' })
        .populate({
          path: 'quiz',
          select: 'title classOffering',
          populate: {
            path: 'classOffering',
            select: 'subject section',
            populate: { path: 'subject', select: 'name subjectCode' },
          },
        })
        .lean(),
    ]);
    const studentCountsByOffering = new Map(offerings.map((offering) => [String(offering._id), 0]));
    enrollments.forEach((enrollment) => {
      if (!enrollment.student) return;
      const offeringId = String(enrollment.classOffering);
      studentCountsByOffering.set(offeringId, (studentCountsByOffering.get(offeringId) || 0) + 1);
    });
    const recentActivities = [
      ...materialSubmissions
        .filter((submission) => submission.student && submission.material?.classOffering)
        .map((submission) => ({
          id: `material-${submission._id}`,
          type: 'assignment',
          action: submission.status === 'draft' ? 'saved an assignment' : 'submitted an assignment',
          student: submission.student,
          title: submission.material.title,
          status: submission.status === 'draft' ? 'pending' : submission.status,
          occurredAt: submission.submittedAt || submission.updatedAt,
          offeringId: submission.material.classOffering._id,
          section: submission.material.classOffering.section,
          subject: submission.material.classOffering.subject,
        })),
      ...quizAttempts
        .filter((attempt) => attempt.student && attempt.quiz?.classOffering)
        .map((attempt) => ({
          id: `quiz-${attempt._id}`,
          type: 'quiz',
          action: attempt.status === 'in_progress' ? 'started a quiz' : 'completed a quiz',
          student: attempt.student,
          title: attempt.quiz.title,
          status: attempt.status === 'in_progress' ? 'pending' : attempt.status === 'expired' ? 'timed_out' : 'submitted',
          occurredAt: attempt.submittedAt || attempt.updatedAt || attempt.startedAt,
          offeringId: attempt.quiz.classOffering._id,
          section: attempt.quiz.classOffering.section,
          subject: attempt.quiz.classOffering.subject,
        })),
    ]
      .sort((first, second) => new Date(second.occurredAt) - new Date(first.occurredAt))
      .slice(0, 8);

    return res.json({
      professor: {
        fullName: req.user.fullName,
        department: req.user.department,
      },
      stats: {
        activeClasses: offerings.length,
        todayMeetings: todayMeetings.length,
        weeklyMeetings: schedule.length,
        totalStudents: enrollments.filter((enrollment) => enrollment.student).length,
        assignments: materials.length + quizzes.length,
      },
      today,
      todayMeetings,
      offerings: offerings.map((offering) => ({
        ...offering,
        studentCount: studentCountsByOffering.get(String(offering._id)) || 0,
      })),
      schedule,
      recentActivities,
    });
  } catch (error) {
    return next(error);
  }
}

async function getClassDetails(req, res, next) {
  try {
    const offering = await ClassOffering.findOne({
      _id: req.params.classId,
      professor: req.user._id,
      isActive: true,
    })
      .populate('subject', 'name subjectCode department units description')
      .lean();

    if (!offering) return res.status(404).json({ message: 'Class not found in your active assignments.' });
    return res.json({ offering });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found in your active assignments.' });
    return next(error);
  }
}

async function updateClassDetails(req, res, next) {
  try {
    const offering = await ClassOffering.findOne({
      _id: req.params.classId,
      professor: req.user._id,
      isActive: true,
    });
    if (!offering) return res.status(404).json({ message: 'Class not found in your active assignments.' });

    const { section, schoolYear, term, schedule } = req.body;
    if (![section, schoolYear, term].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ message: 'Section, school year, and term are required.' });
    }

    const meetings = normalizeSchedule(schedule);
    const scheduleError = validateSchedule(meetings);
    if (scheduleError) return res.status(400).json({ message: scheduleError });

    const otherOfferings = await ClassOffering.find({
      professor: req.user._id,
      isActive: true,
      _id: { $ne: offering._id },
    })
      .populate('subject', 'name')
      .select('subject section schedule')
      .lean();
    const occupiedMeetings = otherOfferings.flatMap((otherOffering) => (
      (otherOffering.schedule || []).map((meeting) => ({
        ...meeting,
        subject: otherOffering.subject?.name || 'Class',
        section: otherOffering.section,
      }))
    ));
    const scheduleConflicts = findScheduleConflicts(meetings, occupiedMeetings);
    if (scheduleConflicts.length > 0) {
      const conflict = scheduleConflicts[0];
      return res.status(409).json({
        message: `Schedule conflict: ${conflict.day} ${formatTime12(conflict.startTime)}–${formatTime12(conflict.endTime)} overlaps with ${conflict.subject} · Section ${conflict.section}.`,
        conflicts: scheduleConflicts,
      });
    }

    offering.section = section.trim();
    offering.schoolYear = schoolYear.trim();
    offering.term = term.trim();
    offering.schedule = meetings;
    await offering.save();
    await offering.populate('subject', 'name subjectCode department units description');

    const studentIds = await Enrollment.distinct('student', { classOffering: offering._id });
    const notificationsSent = await notifyClassUpdated({
      offering,
      studentIds,
      eventKey: `class-updated:${offering._id}:${offering.updatedAt.getTime()}`,
    });
    return res.json({
      offering,
      ...(notificationsSent ? {} : { notificationWarning: 'Class details were saved, but student notifications could not be sent.' }),
    });
  } catch (error) {
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found in your active assignments.' });
    return next(error);
  }
}

async function getClassStudents(req, res, next) {
  try {
    const offering = await ClassOffering.findOne({
      _id: req.params.classId,
      professor: req.user._id,
      isActive: true,
    }).select('_id');
    if (!offering) return res.status(404).json({ message: 'Class not found in your active assignments.' });

    const enrollments = await Enrollment.find({ classOffering: offering._id })
      .populate({
        path: 'student',
        match: { role: 'STUDENT', isActive: true },
        select: 'fullName email profileImage',
      })
      .sort({ createdAt: -1 })
      .lean();

    const students = enrollments
      .filter((enrollment) => enrollment.student)
      .map((enrollment) => ({
        id: enrollment.student._id,
        fullName: enrollment.student.fullName,
        email: enrollment.student.email,
        profileImage: enrollment.student.profileImage,
        enrolledAt: enrollment.createdAt,
      }))
      .sort((first, second) => {
        const firstName = first.fullName.trim().split(/\s+/);
        const secondName = second.fullName.trim().split(/\s+/);
        const lastNameOrder = firstName.at(-1).localeCompare(secondName.at(-1), undefined, { sensitivity: 'base' });
        return lastNameOrder || first.fullName.localeCompare(second.fullName, undefined, { sensitivity: 'base' });
      });

    return res.json({ students, count: students.length });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found in your active assignments.' });
    return next(error);
  }
}

module.exports = {
  createClassOffering,
  getClassCreationOptions,
  getDashboard,
  getClassDetails,
  getClassStudents,
  updateClassDetails,
};
