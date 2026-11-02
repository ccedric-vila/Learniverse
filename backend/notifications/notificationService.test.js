const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');
const { notifyGradePosted, sendNotifications } = require('./notificationService');

test('notification writes are idempotent per recipient and event', async () => {
  const originalBulkWrite = Notification.bulkWrite;
  let operations;
  Notification.bulkWrite = async (updates) => { operations = updates; };
  try {
    const recipient = new mongoose.Types.ObjectId();
    const created = await sendNotifications({
      recipients: [recipient, recipient, String(recipient)],
      type: 'material_published',
      title: 'New lesson shared',
      message: 'Engineering: Statics',
      href: '/student/classes/class-id/materials/material-id',
      eventKey: 'material-published:material-id',
    });

    assert.equal(created, true);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].updateOne.filter.recipient, String(recipient));
    assert.equal(operations[0].updateOne.filter.eventKey, 'material-published:material-id');
    assert.equal(operations[0].updateOne.update.$setOnInsert.type, 'material_published');
  } finally {
    Notification.bulkWrite = originalBulkWrite;
  }
});

test('grade notifications target the student rather than the professor', async () => {
  const originalBulkWrite = Notification.bulkWrite;
  let operations;
  Notification.bulkWrite = async (updates) => { operations = updates; };
  try {
    const studentId = new mongoose.Types.ObjectId();
    const gradedAt = new Date();
    await notifyGradePosted({
      submission: {
        _id: new mongoose.Types.ObjectId(),
        student: { _id: studentId },
        pointsEarned: 8,
        feedback: 'Good work.',
        gradedAt,
      },
      material: {
        _id: new mongoose.Types.ObjectId(),
        classOffering: new mongoose.Types.ObjectId(),
        title: 'Seatwork 1',
        pointsPossible: 10,
      },
    });

    assert.equal(operations.length, 1);
    assert.equal(operations[0].updateOne.filter.recipient, String(studentId));
    assert.equal(operations[0].updateOne.update.$setOnInsert.type, 'grade_posted');
  } finally {
    Notification.bulkWrite = originalBulkWrite;
  }
});
