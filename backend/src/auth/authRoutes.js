const express = require('express');
const multer = require('multer');
const { getMe, login, register, updateProfile, uploadProfileImage } = require('./authController');
const { authorize, protect } = require('./authMiddleware');

const router = express.Router();
const uploadImage = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 5 * 1024 * 1024, files: 1 },
	fileFilter: (_req, file, callback) => {
		if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
			const error = new Error('Upload a JPG, PNG, or WebP image.');
			error.status = 400;
			return callback(error);
		}
		return callback(null, true);
	},
});

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, authorize('STUDENT', 'PROFESSOR'), updateProfile);
router.post('/profile-image', protect, authorize('STUDENT', 'PROFESSOR'), uploadImage.single('image'), uploadProfileImage);

module.exports = router;