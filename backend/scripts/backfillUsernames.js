require('dotenv').config();

const connectDatabase = require('../config/db');
const User = require('../src/models/User');
const { createUniqueUsername } = require('../utils/usernames');

async function backfillUsernames() {
  await connectDatabase();
  await User.init();

  const accounts = await User.find({
    role: { $in: ['STUDENT', 'PROFESSOR'] },
    $or: [{ username: { $exists: false } }, { username: null }, { username: '' }],
  }).select('_id fullName').sort({ createdAt: 1, _id: 1 });

  for (const account of accounts) {
    const username = await createUniqueUsername(account.fullName);
    await User.updateOne({ _id: account._id }, { $set: { username } });
    console.log(`Added username @${username} to account ${account._id}.`);
  }

  console.log(`Username backfill complete. Updated ${accounts.length} account(s).`);
}

backfillUsernames()
  .catch((error) => {
    console.error('Username backfill failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });
