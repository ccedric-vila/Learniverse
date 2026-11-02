const cors = require('cors');
const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./src/auth/authRoutes');
const adminRoutes = require('./admin/adminRoutes');
const professorRoutes = require('./professor/professorRoutes');
const studentRoutes = require('./student/studentRoutes');
const notificationRoutes = require('./notifications/notificationRoutes');
const { errorHandler } = require('./middlewares/errorHandler');
const { notFound } = require('./middlewares/notFound');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/professor', professorRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;