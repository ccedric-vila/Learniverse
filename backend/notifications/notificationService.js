const ClassMaterial = require('../src/models/ClassMaterial');
const ClassOffering = require('../src/models/ClassOffering');
const Enrollment = require('../src/models/Enrollment');
const MaterialSubmission = require('../src/models/MaterialSubmission');
const Notification = require('../src/models/Notification');
const Quiz = require('../src/models/Quiz');
const QuizAttempt = require('../src/models/QuizAttempt');

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000;

function classLabel(offering) {
  const subject = offering?.subject?.name || 'Class';
  return `${subject}${offering?.section ? ` · Section ${offering.section}` : ''}`;
}

async function sendNotifications({ recipients, type, title, message, href, eventKey }) {
  const uniqueRecipients = [...new Set(recipients.filter(Boolean).map(String))];
  if (!uniqueRecipients.length) return true;

  try {
    await Notification.bulkWrite(uniqueRecipients.map((recipient) => ({
      updateOne: {
        filter: { recipient, eventKey },
        update: {
          $setOnInsert: { recipient, type, title, message, href, eventKey },
        },
        upsert: true,
      },
    })), { ordered: false });
    return true;
  } catch (error) {
    console.error(`Could not create ${type} notifications:`, error);
    return false;
  }
}

async function notifyMaterialPublished(material) {
  try {
    const offering = await ClassOffering.findOne({ _id: material.classOffering, isActive: true })
      .populate('subject', 'name')
      .select('subject section');
    if (!offering) return true;
    const recipients = await Enrollment.distinct('student', { classOffering: material.classOffering });
    const isLesson = material.category === 'lesson';
    return sendNotifications({
      recipients,
      type: isLesson ? 'material_published' : 'assessment_published',
      title: isLesson ? 'New lesson shared' : 'New assessment published',
      message: `${classLabel(offering)}: ${material.title}`,
      href: `/student/classes/${material.classOffering}/materials/${material._id}`,
      eventKey: `material-published:${material._id}`,
    });
  } catch (error) {
    console.error('Could not prepare material publication notifications:', error);
    return false;
  }
}

async function notifyOnlineQuizPublished(quiz) {
  try {
    const offering = await ClassOffering.findOne({ _id: quiz.classOffering, isActive: true })
      .populate('subject', 'name')
      .select('subject section');
    if (!offering) return true;
    const recipients = await Enrollment.distinct('student', { classOffering: quiz.classOffering });
    return sendNotifications({
      recipients,
      type: 'online_quiz_published',
      title: 'New online quiz',
      message: `${classLabel(offering)}: ${quiz.title}`,
      href: `/student/classes/${quiz.classOffering}`,
      eventKey: `online-quiz-published:${quiz._id}`,
    });
  } catch (error) {
    console.error('Could not prepare online quiz publication notifications:', error);
    return false;
  }
}

async function notifyGradePosted({ submission, material }) {
  try {
    return sendNotifications({
      recipients: [submission.student?._id || submission.student],
      type: 'grade_posted',
      title: 'Your work has been graded',
      message: `${material.title}: ${submission.pointsEarned}/${material.pointsPossible || 100} points${submission.feedback ? ' · Feedback is available' : ''}`,
      href: `/student/classes/${material.classOffering}/materials/${material._id}`,
      eventKey: `grade-posted:${submission._id}:${submission.gradedAt.getTime()}`,
    });
  } catch (error) {
    console.error('Could not prepare grade notification:', error);
    return false;
  }
}

async function notifyStudentEnrolled({ student, offering }) {
  try {
    const populatedOffering = await ClassOffering.findById(offering._id)
      .populate('subject', 'name')
      .select('subject section professor');
    if (!populatedOffering) return true;
    return sendNotifications({
      recipients: [populatedOffering.professor],
      type: 'student_enrolled',
      title: 'A student joined your class',
      message: `${student.fullName} joined ${classLabel(populatedOffering)}.`,
      href: `/professor/classes/${offering._id}`,
      eventKey: `student-enrolled:${offering._id}:${student._id}`,
    });
  } catch (error) {
    console.error('Could not prepare class enrollment notification:', error);
    return false;
  }
}

async function notifyClassUpdated({ offering, studentIds = [], professorIds = [], eventKey }) {
  const label = classLabel(offering);
  const recipients = [
    ...studentIds.map((recipient) => ({
      recipient,
      type: 'class_updated',
      title: 'Class information updated',
      message: `${label} has new class information.`,
      href: offering.isActive ? `/student/classes/${offering._id}` : '/student',
      eventKey,
    })),
    ...professorIds.map((recipient) => ({
      recipient,
      type: 'class_updated',
      title: 'Teaching assignment updated',
      message: `Your teaching assignment for ${label} has changed.`,
      href: offering.isActive ? `/professor/classes/${offering._id}` : '/professor',
      eventKey,
    })),
  ];
  if (!recipients.length) return true;

  try {
    await Notification.bulkWrite(recipients.map(({ recipient, ...notification }) => ({
      updateOne: {
        filter: { recipient, eventKey: notification.eventKey },
        update: { $setOnInsert: { recipient, ...notification } },
        upsert: true,
      },
    })), { ordered: false });
    return true;
  } catch (error) {
    console.error('Could not create class update notifications:', error);
    return false;
  }
}

async function createDeadlineReminders(now = new Date()) {
  const reminderCutoff = new Date(now.getTime() + REMINDER_WINDOW_MS);
  const [materials, quizzes] = await Promise.all([
    ClassMaterial.find({
      category: { $in: ['seatwork', 'quiz'] },
      availableAt: { $lte: now },
      deadline: { $gt: now, $lte: reminderCutoff },
    }).select('_id classOffering title deadline'),
    Quiz.find({
      isPublished: true,
      deadline: { $gt: now, $lte: reminderCutoff },
    }).select('_id classOffering title deadline'),
  ]);

  for (const material of materials) {
    const enrolledStudents = await Enrollment.distinct('student', { classOffering: material.classOffering });
    const completedStudents = await MaterialSubmission.distinct('student', {
      material: material._id,
      status: { $in: ['submitted', 'late', 'reviewed'] },
    });
    const completed = new Set(completedStudents.map(String));
    const recipients = enrolledStudents.filter((studentId) => !completed.has(String(studentId)));
    const created = await sendNotifications({
      recipients,
      type: 'deadline_reminder',
      title: 'Assessment due within 24 hours',
      message: `${material.title} is due ${material.deadline.toLocaleString()}.`,
      href: `/student/classes/${material.classOffering}/materials/${material._id}`,
      eventKey: `deadline-reminder:material:${material._id}`,
    });
    if (!created) throw new Error(`Could not create reminders for material ${material._id}.`);
  }

  for (const quiz of quizzes) {
    const enrolledStudents = await Enrollment.distinct('student', { classOffering: quiz.classOffering });
    const completedStudents = await QuizAttempt.distinct('student', {
      quiz: quiz._id,
      attemptType: 'quiz',
      status: { $in: ['submitted', 'expired'] },
    });
    const completed = new Set(completedStudents.map(String));
    const recipients = enrolledStudents.filter((studentId) => !completed.has(String(studentId)));
    const created = await sendNotifications({
      recipients,
      type: 'deadline_reminder',
      title: 'Quiz due within 24 hours',
      message: `${quiz.title} is due ${quiz.deadline.toLocaleString()}.`,
      href: `/student/classes/${quiz.classOffering}`,
      eventKey: `deadline-reminder:quiz:${quiz._id}`,
    });
    if (!created) throw new Error(`Could not create reminders for quiz ${quiz._id}.`);
  }
}

async function publishScheduledMaterials(now = new Date()) {
  const materials = await ClassMaterial.find({
    notificationSentAt: { $exists: true, $eq: null },
    availableAt: { $lte: now },
  }).select('_id classOffering title category availableAt');

  for (const material of materials) {
    const created = await notifyMaterialPublished(material);
    if (!created) continue;
    await ClassMaterial.updateOne(
      { _id: material._id, notificationSentAt: null },
      { $set: { notificationSentAt: now } },
    );
  }
}

async function publishUnannouncedQuizzes(now = new Date()) {
  const quizzes = await Quiz.find({
    isPublished: true,
    notificationSentAt: { $exists: true, $eq: null },
    createdAt: { $lte: now },
  }).select('_id classOffering title');

  for (const quiz of quizzes) {
    const created = await notifyOnlineQuizPublished(quiz);
    if (!created) continue;
    await Quiz.updateOne(
      { _id: quiz._id, notificationSentAt: null },
      { $set: { notificationSentAt: now } },
    );
  }
}

async function publishUngradedNotifications(now = new Date()) {
  const submissions = await MaterialSubmission.find({
    status: 'reviewed',
    gradedAt: { $ne: null },
    notificationSentAt: { $exists: true, $eq: null },
  }).populate('material', '_id classOffering title pointsPossible');

  for (const submission of submissions) {
    if (!submission.material) {
      await MaterialSubmission.updateOne(
        { _id: submission._id, notificationSentAt: null },
        { $set: { notificationSentAt: now } },
      );
      continue;
    }
    const created = await notifyGradePosted({ submission, material: submission.material });
    if (!created) continue;
    await MaterialSubmission.updateOne(
      { _id: submission._id, notificationSentAt: null },
      { $set: { notificationSentAt: now } },
    );
  }
}

module.exports = {
  createDeadlineReminders,
  notifyClassUpdated,
  notifyGradePosted,
  notifyMaterialPublished,
  notifyOnlineQuizPublished,
  notifyStudentEnrolled,
  publishUngradedNotifications,
  publishUnannouncedQuizzes,
  publishScheduledMaterials,
  sendNotifications,
};
