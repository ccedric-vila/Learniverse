const express = require('express');
const multer = require('multer');
const { authorize, protect } = require('../src/auth/authMiddleware');
const { getClassDetails, getClassTasks, getDashboard, getProfileOptions, joinClass } = require('./studentController');
const {
  getAttempt,
  getStudentPracticeMaterials,
  getStudentQuizzes,
  saveAttemptAnswer,
  startPracticeAttempt,
  startQuizAttempt,
  submitAttempt,
} = require('../quizzes/quizController');
const {
	createStudentMaterialComment,
	createStudentMaterialSubmission,
	getStudentDownloadUrl,
	getStudentMaterialComments,
	getStudentMaterialDetails,
	getStudentMaterialSubmission,
	getStudentMaterials,
	previewStudentMaterial,
	turnInStudentMaterialSubmission,
} = require('../materials/materialController');

const router = express.Router();
const uploadStudentSubmission = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024, files: 1 },
	fileFilter: (_req, file, callback) => {
		const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
		const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
		if (!allowedExtensions.includes(extension)) {
			const error = new Error('Supported formats: PDF, DOC, DOCX, PPT, PPTX, JPG, PNG, GIF, WEBP, BMP.');
			error.status = 400;
			return callback(error);
		}
		return callback(null, true);
	},
});

router.use(protect, authorize('STUDENT'));
router.get('/dashboard', getDashboard);
router.get('/profile-options', getProfileOptions);
router.post('/classes/join', joinClass);
router.get('/classes/:classId/tasks', getClassTasks);
router.get('/classes/:classId/quizzes', getStudentQuizzes);
router.get('/classes/:classId/practice-materials', getStudentPracticeMaterials);
router.post('/quizzes/:quizId/attempts', startQuizAttempt);
router.post('/materials/:materialId/practice-attempts', startPracticeAttempt);
router.get('/attempts/:attemptId', getAttempt);
router.put('/attempts/:attemptId/answers/:questionIndex', saveAttemptAnswer);
router.post('/attempts/:attemptId/submit', submitAttempt);
router.get('/classes/:classId/materials', getStudentMaterials);
router.get('/materials/:materialId', getStudentMaterialDetails);
router.get('/materials/:materialId/submission', getStudentMaterialSubmission);
router.post('/materials/:materialId/submissions', uploadStudentSubmission.single('file'), createStudentMaterialSubmission);
router.post('/materials/:materialId/submissions/turn-in', turnInStudentMaterialSubmission);
router.get('/materials/:materialId/comments', getStudentMaterialComments);
router.post('/materials/:materialId/comments', createStudentMaterialComment);
router.get('/materials/:materialId/preview', previewStudentMaterial);
router.get('/materials/:materialId/download', getStudentDownloadUrl);
router.get('/classes/:classId', getClassDetails);

module.exports = router;
