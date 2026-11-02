const mongoose = require('mongoose');

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(uri, {
    dbName: process.env.MONGODB_DB || 'sts_lms',
  });
  console.log('Connected to MongoDB');
}

module.exports = connectDatabase;