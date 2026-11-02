const express = require('express');
const multer = require('multer');
const { authorize, protect } = require('../src/auth/authMiddleware');
const {
	createProfessor,
	createSubject,
	createOtherSubject,
	createClassOffering,
	getDashboard,
	getProfessors,
	getSubjects,
	seedCurriculumSubjects,
	getClassOfferings,
	updateSubject,
	updateClassOffering,
	uploadProfessorImage,
} = require('./adminController');

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

router.use(protect, authorize('ADMIN'));
router.get('/dashboard', getDashboard);
router.get('/professors', getProfessors);
router.get('/subjects', getSubjects);
router.post('/subjects/seed-curriculum', seedCurriculumSubjects);
router.post('/subjects/other', createOtherSubject);
router.post('/subjects', createSubject);
router.patch('/subjects/:id', updateSubject);
router.get('/classes', getClassOfferings);
router.post('/classes', createClassOffering);
router.patch('/classes/:id', updateClassOffering);
router.post('/professors/profile-image', uploadImage.single('image'), uploadProfessorImage);
router.post('/professors', createProfessor);

module.exports = router;