const express = require('express');
const { authorize, protect } = require('../src/auth/authMiddleware');
const {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require('./notificationController');

const router = express.Router();

router.use(protect, authorize('STUDENT', 'PROFESSOR'));
router.get('/', getNotifications);
router.patch('/read-all', markAllNotificationsRead);
router.patch('/:notificationId/read', markNotificationRead);

module.exports = router;
