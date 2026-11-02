const { randomInt } = require('node:crypto');

const classCodeAlphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function generateClassCode() {
  const characters = Array.from({ length: 8 }, () => classCodeAlphabet[randomInt(classCodeAlphabet.length)]);
  return `${characters.slice(0, 4).join('')}-${characters.slice(4).join('')}`;
}

function normalizeSchedule(schedule) {
  if (!Array.isArray(schedule)) return [];
  return schedule.map((meeting) => ({
    day: typeof meeting?.day === 'string' ? meeting.day : '',
    startTime: typeof meeting?.startTime === 'string' ? meeting.startTime : '',
    endTime: typeof meeting?.endTime === 'string' ? meeting.endTime : '',
    room: typeof meeting?.room === 'string' ? meeting.room.trim() : '',
  }));
}

function validateSchedule(meetings) {
  if (meetings.length === 0) return 'Add at least one meeting to the class schedule.';
  for (const meeting of meetings) {
    if (!weekDays.includes(meeting.day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.startTime) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(meeting.endTime)) {
      return 'Each schedule needs a valid day, start time, and end time.';
    }
    if (meeting.startTime >= meeting.endTime) return 'Each meeting end time must be after its start time.';
  }
  return '';
}

function formatTime12(time) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function findScheduleConflicts(meetings, occupiedMeetings = []) {
  const conflicts = [];
  const addConflict = (meetingIndex, conflict) => conflicts.push({ meetingIndex, ...conflict });

  meetings.forEach((meeting, meetingIndex) => {
    meetings.slice(meetingIndex + 1).forEach((otherMeeting, offset) => {
      const otherIndex = meetingIndex + offset + 1;
      if (meeting.day === otherMeeting.day
        && meeting.startTime < otherMeeting.endTime
        && otherMeeting.startTime < meeting.endTime) {
        addConflict(meetingIndex, { kind: 'new', conflictingMeetingIndex: otherIndex, ...otherMeeting });
        addConflict(otherIndex, { kind: 'new', conflictingMeetingIndex: meetingIndex, ...meeting });
      }
    });

    occupiedMeetings.forEach((occupiedMeeting) => {
      if (meeting.day === occupiedMeeting.day
        && meeting.startTime < occupiedMeeting.endTime
        && occupiedMeeting.startTime < meeting.endTime) {
        addConflict(meetingIndex, { kind: 'occupied', ...occupiedMeeting });
      }
    });
  });

  return conflicts;
}

module.exports = { findScheduleConflicts, formatTime12, generateClassCode, normalizeSchedule, validateSchedule };
