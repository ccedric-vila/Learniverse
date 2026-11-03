const express = require('express');
const multer = require('multer');
const { authorize, protect } = require('../src/auth/authMiddleware');
const {
	createClassOffering,
	getClassCreationOptions,
	getClassDetails,
	getClassStudents,
	getDashboard,
	updateClassDetails,
} = require('./professorController');
const { createQuiz, getProfessorQuizzes } = require('../quizzes/quizController');
const {
	deleteProfessorMaterial,
	getAllProfessorMaterials,
	getProfessorDownloadUrl,
	getProfessorMaterialDetails,
	getProfessorMaterialSubmissions,
	getProfessorMaterials,
	gradeProfessorSubmission,
	previewProfessorMaterial,
	previewProfessorSubmission,
	uploadMaterial,
} = require('../materials/materialController');

const uploadMaterialFile = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 20 * 1024 * 1024, files: 1 },
	fileFilter: (_req, file, callback) => {
		const extension = file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase();
		const allowedExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx'];
		if (!allowedExtensions.includes(extension)) {
			const error = new Error('Supported formats: PDF, DOC, DOCX, PPT, PPTX.');
			error.status = 400;
			return callback(error);
		}
		return callback(null, true);
	},
});

const router = express.Router();

router.use(protect, authorize('PROFESSOR'));
router.get('/dashboard', getDashboard);
router.get('/classes/options', getClassCreationOptions);
router.post('/classes', createClassOffering);
router.patch('/classes/:classId', updateClassDetails);
router.get('/classes/:classId/students', getClassStudents);
router.get('/classes/:classId/quizzes', getProfessorQuizzes);
router.post('/classes/:classId/quizzes', createQuiz);
router.get('/materials', getAllProfessorMaterials);
router.get('/classes/:classId/materials', getProfessorMaterials);
router.post('/classes/:classId/materials', uploadMaterialFile.single('file'), uploadMaterial);
router.get('/materials/:materialId', getProfessorMaterialDetails);
router.get('/materials/:materialId/preview', previewProfessorMaterial);
router.get('/materials/:materialId/submissions', getProfessorMaterialSubmissions);
router.patch('/materials/:materialId/submissions/:submissionId/grade', gradeProfessorSubmission);
router.get('/materials/:materialId/submissions/:submissionId/preview', previewProfessorSubmission);
router.delete('/materials/:materialId', deleteProfessorMaterial);
router.get('/materials/:materialId/download', getProfessorDownloadUrl);
router.get('/classes/:classId', getClassDetails);

module.exports = router;
