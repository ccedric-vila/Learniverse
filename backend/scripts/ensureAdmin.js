require('dotenv').config();

const connectDatabase = require('../config/db');
const User = require('../src/models/User');

async function ensureAdmin() {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const fullName = process.env.ADMIN_BOOTSTRAP_NAME || 'STS LMS Administrator';

  if (!email || !password) {
    throw new Error('Set ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD locally before seeding.');
  }
  if (password.length < 12) {
    throw new Error('The bootstrap password must be at least 12 characters.');
  }

  await connectDatabase();
  const existing = await User.findOne({ email }).select('+password');
  if (existing) {
    existing.role = 'ADMIN';
    existing.isActive = true;
    existing.password = password;
    await existing.save();
    console.log(`Admin account migrated and password updated for ${email}.`);
    return;
  }

  await User.create({ fullName, email, password, role: 'ADMIN', isActive: true });
  console.log(`Admin account created for ${email}.`);
}

ensureAdmin()
  .catch((error) => {
    console.error('Admin bootstrap failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = require('mongoose');
    await mongoose.disconnect();
  });