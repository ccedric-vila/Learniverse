const ClassOffering = require('../src/models/ClassOffering');
const Enrollment = require('../src/models/Enrollment');

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

    return res.json({
      professor: {
        fullName: req.user.fullName,
        department: req.user.department,
      },
      stats: {
        activeClasses: offerings.length,
        todayMeetings: todayMeetings.length,
        weeklyMeetings: schedule.length,
      },
      today,
      todayMeetings,
      offerings,
      schedule,
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

module.exports = { getDashboard, getClassDetails, getClassStudents };
