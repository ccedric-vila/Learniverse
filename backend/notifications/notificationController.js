const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');

async function getNotifications(req, res, next) {
  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 20;
    const query = { recipient: req.user._id };
    if (req.query.before) {
      if (!mongoose.isValidObjectId(req.query.before)) {
        return res.status(400).json({ message: 'Invalid notification cursor.' });
      }
      query._id = { $lt: req.query.before };
    }

    const [items, unreadCount] = await Promise.all([
      Notification.find(query)
        .select('_id type title message href readAt createdAt')
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean(),
      Notification.countDocuments({ recipient: req.user._id, readAt: null }),
    ]);
    const hasMore = items.length > limit;
    const notifications = items.slice(0, limit);
    return res.json({
      notifications,
      unreadCount,
      hasMore,
      nextCursor: hasMore ? String(notifications.at(-1)._id) : null,
    });
  } catch (error) {
    return next(error);
  }
}

async function markNotificationRead(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.notificationId)) {
      return res.status(404).json({ message: 'Notification not found.' });
    }
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.notificationId, recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      const existing = await Notification.exists({ _id: req.params.notificationId, recipient: req.user._id });
      if (!existing) return res.status(404).json({ message: 'Notification not found.' });
    }
    const unreadCount = await Notification.countDocuments({ recipient: req.user._id, readAt: null });
    return res.json({ unreadCount });
  } catch (error) {
    return next(error);
  }
}

async function markAllNotificationsRead(req, res, next) {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, readAt: null },
      { $set: { readAt: new Date() } },
    );
    return res.json({ unreadCount: 0 });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getNotifications, markAllNotificationsRead, markNotificationRead };
