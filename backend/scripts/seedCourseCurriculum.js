require('dotenv').config();

const connectDatabase = require('../config/db');
const User = require('../src/models/User');
const seedCourseSubjects = require('../utils/seedCourseSubjects');

async function seedCourseCurriculum() {
  await connectDatabase();
  const creator = await User.findOne({ role: 'ADMIN' }).select('_id').lean();
  if (!creator) throw new Error('Create an admin account before seeding the course curriculum.');
  const result = await seedCourseSubjects(creator._id);
  console.log(`Curriculum seed complete. Added ${result.inserted} new subject records from ${result.curriculumCount} curriculum entries.`);
}

seedCourseCurriculum()
  .catch((error) => {
    console.error('Course curriculum seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
