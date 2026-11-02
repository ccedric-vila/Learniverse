require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./config/db');
const { startNotificationScheduler } = require('./notifications/notificationScheduler');

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();
    startNotificationScheduler();
    app.listen(port, () => {
      console.log(`STS LMS API listening on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

startServer();