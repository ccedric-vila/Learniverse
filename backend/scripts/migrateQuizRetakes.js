require('dotenv').config();

const mongoose = require('mongoose');
mongoose.set('autoIndex', false);
const connectDatabase = require('../config/db');
const QuizAttempt = require('../src/models/QuizAttempt');

async function migrateQuizRetakes() {
  await connectDatabase();
  console.log(`Migrating quiz attempts in database "${mongoose.connection.name}".`);
  const indexes = await QuizAttempt.collection.indexes();
  for (const index of indexes) {
    const key = index.key || {};
    const partial = index.partialFilterExpression || {};
    const isQuizUniquenessIndex = index.unique
      && key.student === 1
      && key.quiz === 1
      && Object.keys(key).length === 2;
    const isActiveAttemptIndex = partial.attemptType === 'quiz'
      && partial.status === 'in_progress'
      && partial.quiz?.$exists === true;
    if (isQuizUniquenessIndex && !isActiveAttemptIndex) {
      await QuizAttempt.collection.dropIndex(index.name);
      console.log(`Dropped obsolete quiz-attempt index: ${index.name}`);
    }
  }

  await QuizAttempt.collection.createIndex(
    { student: 1, quiz: 1 },
    {
      unique: true,
      partialFilterExpression: { attemptType: 'quiz', status: 'in_progress', quiz: { $exists: true } },
      name: 'one_active_quiz_attempt_per_student',
    },
  );
  const updatedIndexes = await QuizAttempt.collection.indexes();
  const obsoleteUniqueIndex = updatedIndexes.find((index) => {
    const key = index.key || {};
    const partial = index.partialFilterExpression || {};
    return index.unique
      && key.student === 1
      && key.quiz === 1
      && Object.keys(key).length === 2
      && !(partial.attemptType === 'quiz'
        && partial.status === 'in_progress'
        && partial.quiz?.$exists === true);
  });
  if (obsoleteUniqueIndex) {
    throw new Error(`Obsolete unique index "${obsoleteUniqueIndex.name}" is still present.`);
  }
  console.log('Quiz retake index migration complete.');
}

migrateQuizRetakes()
  .catch((error) => {
    console.error('Quiz retake index migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
