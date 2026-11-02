const test = require('node:test');
const assert = require('node:assert/strict');
const {
  findScheduleConflicts,
  formatTime12,
  generateClassCode,
  normalizeSchedule,
  validateSchedule,
} = require('./classOffering');

test('generated class codes use the expected 4-4 format', () => {
  assert.match(generateClassCode(), /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/);
});

test('class schedule times display in 12-hour format with AM or PM', () => {
  assert.equal(formatTime12('00:00'), '12:00 AM');
  assert.equal(formatTime12('12:00'), '12:00 PM');
  assert.equal(formatTime12('13:05'), '1:05 PM');
});

test('class schedules normalize optional room values', () => {
  assert.deepEqual(normalizeSchedule([
    { day: 'Monday', startTime: '09:00', endTime: '10:30', room: '  101  ' },
  ]), [{ day: 'Monday', startTime: '09:00', endTime: '10:30', room: '101' }]);
});

test('class schedules reject invalid days and end times', () => {
  assert.match(validateSchedule([{ day: 'Funday', startTime: '09:00', endTime: '10:30' }]), /valid day/);
  assert.match(validateSchedule([{ day: 'Monday', startTime: '10:30', endTime: '09:00' }]), /after its start time/);
});

test('class schedules detect overlaps with existing meetings but allow adjacent times', () => {
  const meetings = [
    { day: 'Monday', startTime: '09:30', endTime: '10:30' },
    { day: 'Tuesday', startTime: '09:00', endTime: '10:00' },
  ];
  const conflicts = findScheduleConflicts(meetings, [
    { day: 'Monday', startTime: '09:00', endTime: '09:30', subject: 'Physics', section: 'A' },
    { day: 'Monday', startTime: '10:00', endTime: '11:00', subject: 'Calculus', section: 'B' },
  ]);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].subject, 'Calculus');
});

test('class schedules detect overlaps between meetings in the new class', () => {
  const conflicts = findScheduleConflicts([
    { day: 'Friday', startTime: '13:00', endTime: '14:00' },
    { day: 'Friday', startTime: '13:30', endTime: '14:30' },
  ]);
  assert.equal(conflicts.length, 2);
  assert.equal(conflicts[0].conflictingMeetingIndex, 1);
  assert.equal(conflicts[1].conflictingMeetingIndex, 0);
});
