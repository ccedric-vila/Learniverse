const {
  createDeadlineReminders,
  publishScheduledMaterials,
  publishUngradedNotifications,
  publishUnannouncedQuizzes,
} = require('./notificationService');

const JOB_INTERVAL_MS = 5 * 60 * 1000;
let running = false;

async function runNotificationJobs() {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    await publishScheduledMaterials(now);
    await publishUnannouncedQuizzes(now);
    await publishUngradedNotifications(now);
    await createDeadlineReminders(now);
  } catch (error) {
    console.error('Notification scheduler run failed:', error);
  } finally {
    running = false;
  }
}

function startNotificationScheduler() {
  void runNotificationJobs();
  return setInterval(runNotificationJobs, JOB_INTERVAL_MS);
}

module.exports = { runNotificationJobs, startNotificationScheduler };
