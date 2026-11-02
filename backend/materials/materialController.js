const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const ClassMaterial = require('../src/models/ClassMaterial');
const MaterialComment = require('../src/models/MaterialComment');
const MaterialSubmission = require('../src/models/MaterialSubmission');
const ClassOffering = require('../src/models/ClassOffering');
const Enrollment = require('../src/models/Enrollment');
const { notifyGradePosted, notifyMaterialPublished } = require('../notifications/notificationService');
const { cloudinary, folder } = require('../config/cloudinary');

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const allowedFiles = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
};
const publicMaterialFields = 'classOffering uploadedBy title description category deadline pointsPossible originalFileName mimeType fileSize availableAt createdAt updatedAt';
const MATERIAL_CATEGORIES = ['lesson', 'seatwork', 'quiz'];
const allowedSubmissionFiles = {
  '.pdf': ['application/pdf'],
  '.doc': ['application/msword', 'application/octet-stream'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'],
  '.ppt': ['application/vnd.ms-powerpoint', 'application/octet-stream'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/octet-stream'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.bmp': ['image/bmp'],
};

function normalizeMaterialCategory(categoryValue) {
  const category = typeof categoryValue === 'string' ? categoryValue.trim().toLowerCase() : '';
  return MATERIAL_CATEGORIES.includes(category) ? category : null;
}

function isLessonCategory(categoryValue) {
  return typeof categoryValue === 'string' && categoryValue.trim().toLowerCase() === 'lesson';
}

function normalizeMaterialDeadline(category, deadlineValue) {
  if (category === 'lesson') return null;
  if (typeof deadlineValue !== 'string' || !deadlineValue.trim()) return null;
  const parsed = new Date(deadlineValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function isSubmissionLate(deadline, submittedAt) {
  return Boolean(deadline && new Date(submittedAt).getTime() > new Date(deadline).getTime());
}

function normalizePointsPossible(category, pointsValue) {
  if (category === 'lesson') return null;
  if (pointsValue === undefined || pointsValue === null || String(pointsValue).trim() === '') return null;
  const points = Number(pointsValue);
  if (!Number.isFinite(points) || points < 1 || points > 100000) return null;
  return points;
}

function isPassingScore(pointsEarned, pointsPossible) {
  return Number.isFinite(Number(pointsEarned))
    && Number(pointsPossible) > 0
    && Number(pointsEarned) >= Number(pointsPossible) * 0.7;
}

function isSubmissionAllowedFile(file) {
  const dot = file.originalname.lastIndexOf('.');
  const extension = dot >= 0 ? file.originalname.slice(dot).toLowerCase() : '';
  return Boolean(allowedSubmissionFiles[extension]?.includes(file.mimetype));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isAllowedFile(file) {
  const dot = file.originalname.lastIndexOf('.');
  const extension = dot >= 0 ? file.originalname.slice(dot).toLowerCase() : '';
  return Boolean(allowedFiles[extension]?.includes(file.mimetype));
}

function uploadToCloudinary(file, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'raw',
      type: 'authenticated',
      folder: `${folder}/class-materials`,
      public_id: publicId,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    stream.end(file.buffer);
  });
}

function uploadStudentSubmissionToCloudinary(file, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'auto',
      type: 'authenticated',
      folder: `${folder}/student-submissions`,
      public_id: publicId,
      use_filename: false,
      unique_filename: false,
      overwrite: false,
    }, (error, result) => {
      if (error) return reject(error);
      return resolve(result);
    });
    stream.end(file.buffer);
  });
}

function deleteFromCloudinary(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'raw', type: 'authenticated', invalidate: true });
}

function deleteSubmissionFromCloudinary(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'auto', type: 'authenticated', invalidate: true });
}

async function findOwnedClass(classId, professorId) {
  const offering = await ClassOffering.findOne({ _id: classId, professor: professorId, isActive: true }).select('_id');
  if (!offering) throw createHttpError(404, 'Active class not found in your teaching assignments.');
  return offering;
}

async function uploadMaterial(req, res, next) {
  let cloudPublicId;
  try {
    const offering = await findOwnedClass(req.params.classId, req.user._id);
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'Choose a PDF, DOC, DOCX, PPT, or PPTX file to upload.' });
    if (!isAllowedFile(file)) return res.status(400).json({ message: 'The file extension and file type must match. Supported formats: PDF, DOC, DOCX, PPT, PPTX.' });
    if (file.size > MAX_FILE_BYTES) return res.status(413).json({ message: 'Files must be 20 MB or smaller.' });

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : '';
    const category = normalizeMaterialCategory(req.body.category);
    const deadline = normalizeMaterialDeadline(category, req.body.deadline);
    const pointsPossible = normalizePointsPossible(category, req.body.pointsPossible);

    if (!title) return res.status(400).json({ message: 'A title is required.' });
    if (!category) return res.status(400).json({ message: 'Choose a valid category: lesson, seatwork, or quiz.' });
    if (category !== 'lesson' && !deadline) return res.status(400).json({ message: 'A deadline is required for seatwork and quiz materials.' });
    if (category !== 'lesson' && !pointsPossible) return res.status(400).json({ message: 'Enter the total points for this assessment (1 to 100,000).' });
    if (title.length > 160 || description.length > 2000) return res.status(400).json({ message: 'The title or description is too long.' });

    let availableAt = new Date();
    if (req.body.availableAt) {
      availableAt = new Date(req.body.availableAt);
      if (Number.isNaN(availableAt.getTime())) return res.status(400).json({ message: 'Choose a valid availability date and time.' });
      if (availableAt.getTime() <= Date.now()) return res.status(400).json({ message: 'Scheduled availability must be in the future. Leave it blank to publish immediately.' });
    }

    const dot = file.originalname.lastIndexOf('.');
    const extension = file.originalname.slice(dot).toLowerCase();
    const cloudName = `${randomUUID()}${extension}`;
    const uploaded = await uploadToCloudinary(file, cloudName);
    cloudPublicId = uploaded.public_id;

    const material = await ClassMaterial.create({
      classOffering: offering._id,
      uploadedBy: req.user._id,
      title,
      description,
      category,
      deadline: category === 'lesson' ? null : deadline,
      pointsPossible: category === 'lesson' ? null : pointsPossible,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      cloudinaryPublicId: uploaded.public_id,
      availableAt,
    });

    let notificationWarning = '';
    if (availableAt <= new Date()) {
      const sent = await notifyMaterialPublished(material);
      if (sent) {
        material.notificationSentAt = new Date();
        await material.save();
      } else {
        notificationWarning = 'Material was published, but student notifications could not be created.';
      }
    }
    return res.status(201).json({
      material: material.toObject({ transform: (_doc, result) => { delete result.cloudinaryPublicId; return result; } }),
      ...(notificationWarning ? { notificationWarning } : {}),
    });
  } catch (error) {
    if (cloudPublicId) {
      try { await deleteFromCloudinary(cloudPublicId); } catch (cleanupError) { console.error('Could not clean up failed class-material upload:', cleanupError); }
    }
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function getProfessorMaterials(req, res, next) {
  try {
    await findOwnedClass(req.params.classId, req.user._id);
    const materials = await ClassMaterial.find({ classOffering: req.params.classId })
      .select(publicMaterialFields)
      .sort({ availableAt: 1, createdAt: -1 })
      .lean();
    const now = new Date();
    return res.json({ materials: materials.map((material) => ({ ...material, isScheduled: material.availableAt > now })) });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Active class not found in your teaching assignments.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function getAllProfessorMaterials(req, res, next) {
  try {
    const offerings = await ClassOffering.find({ professor: req.user._id, isActive: true })
      .select('_id')
      .lean();
    if (offerings.length === 0) return res.json({ materials: [] });

    const materials = await ClassMaterial.find({
      classOffering: { $in: offerings.map((offering) => offering._id) },
      uploadedBy: req.user._id,
    })
      .select(publicMaterialFields)
      .populate({
        path: 'classOffering',
        select: 'section schoolYear term subject',
        populate: { path: 'subject', select: 'name subjectCode' },
      })
      .sort({ createdAt: -1 })
      .lean();
    const now = new Date();
    return res.json({ materials: materials.map((material) => ({ ...material, isScheduled: material.availableAt > now })) });
  } catch (error) {
    return next(error);
  }
}

async function getProfessorMaterialDetails(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId).select('+cloudinaryPublicId');
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    const details = await ClassMaterial.findById(material._id)
      .select(publicMaterialFields)
      .populate({
        path: 'classOffering',
        select: 'section schoolYear term subject',
        populate: { path: 'subject', select: 'name subjectCode' },
      })
      .lean();
    return res.json({ material: details });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function deleteProfessorMaterial(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId).select('+cloudinaryPublicId');
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    await deleteFromCloudinary(material.cloudinaryPublicId);
    await material.deleteOne();
    return res.json({ message: 'Class material deleted.' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function findStudentMaterial(materialId, studentId) {
  const material = await ClassMaterial.findById(materialId).select('+cloudinaryPublicId');
  if (!material) throw createHttpError(404, 'Class material not found.');
  const [enrollment, offering] = await Promise.all([
    Enrollment.findOne({ student: studentId, classOffering: material.classOffering }).select('_id'),
    ClassOffering.findOne({ _id: material.classOffering, isActive: true }).select('_id'),
  ]);
  if (!enrollment || !offering) throw createHttpError(404, 'Class material not found in your active classes.');
  if (material.availableAt > new Date()) throw createHttpError(404, 'This material is not available yet.');
  return material;
}

async function getStudentMaterials(req, res, next) {
  try {
    const enrollment = await Enrollment.findOne({ student: req.user._id, classOffering: req.params.classId }).select('_id');
    const offering = await ClassOffering.findOne({ _id: req.params.classId, isActive: true }).select('_id');
    if (!enrollment || !offering) return res.status(404).json({ message: 'Class not found in your active enrollments.' });

    const materials = await ClassMaterial.find({ classOffering: req.params.classId, availableAt: { $lte: new Date() } })
      .select(publicMaterialFields)
      .sort({ availableAt: -1, createdAt: -1 })
      .lean();
    return res.json({ materials });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class not found in your active enrollments.' });
    return next(error);
  }
}

async function getStudentMaterialDetails(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    const details = await ClassMaterial.findById(material._id)
      .select(publicMaterialFields)
      .populate({
        path: 'classOffering',
        select: 'section schoolYear term subject professor',
        populate: [
          { path: 'subject', select: 'name subjectCode' },
          { path: 'professor', select: 'fullName' },
        ],
      })
      .lean();
    return res.json({ material: details });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function getStudentMaterialComments(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    const comments = await MaterialComment.find({ material: material._id })
      .populate('student', 'fullName')
      .sort({ createdAt: 1 })
      .lean();
    return res.json({ comments });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function createStudentMaterialComment(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    if (!text) return res.status(400).json({ message: 'Write a comment before posting.' });
    if (text.length > 2000) return res.status(400).json({ message: 'Comments must be 2,000 characters or fewer.' });

    const comment = await MaterialComment.create({ material: material._id, student: req.user._id, text });
    await comment.populate('student', 'fullName');
    return res.status(201).json({ comment });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    return next(error);
  }
}

async function createDownloadUrl(material) {
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const url = cloudinary.utils.private_download_url(
    material.cloudinaryPublicId,
    undefined,
    {
      resource_type: 'raw',
      type: 'authenticated',
      attachment: material.originalFileName,
      expires_at: expiresAt,
    },
  );
  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

async function getStudentDownloadUrl(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    return res.json(await createDownloadUrl(material));
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function previewStudentMaterial(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
    const url = cloudinary.utils.private_download_url(
      material.cloudinaryPublicId,
      undefined,
      {
        resource_type: 'raw',
        type: 'authenticated',
        expires_at: expiresAt,
      },
    );
    const upstream = await fetch(url);
    if (!upstream.ok || !upstream.body) {
      throw createHttpError(502, 'The file preview is temporarily unavailable. Try again or download the file.');
    }

    const safeFileName = material.originalFileName.replace(/[\r\n"\\]/g, '_');
    res.set({
      'Content-Type': material.mimeType,
      'Content-Disposition': `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(material.originalFileName)}`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    if (upstream.headers.get('content-length')) res.set('Content-Length', upstream.headers.get('content-length'));
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    if (res.headersSent) return;
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function streamPrivateCloudinaryFile({ publicId, resourceType, mimeType, originalFileName }, res) {
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const url = cloudinary.utils.private_download_url(publicId, undefined, {
    resource_type: resourceType,
    type: 'authenticated',
    expires_at: expiresAt,
  });
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    throw createHttpError(502, 'The file preview is temporarily unavailable. Try downloading the file instead.');
  }
  const safeFileName = (originalFileName || 'file').replace(/[\r\n"\\]/g, '_');
  res.set({
    'Content-Type': mimeType || 'application/octet-stream',
    'Content-Disposition': `inline; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(originalFileName || 'file')}`,
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (upstream.headers.get('content-length')) res.set('Content-Length', upstream.headers.get('content-length'));
  await pipeline(Readable.fromWeb(upstream.body), res);
}

async function previewProfessorMaterial(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId).select('+cloudinaryPublicId');
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    await streamPrivateCloudinaryFile({
      publicId: material.cloudinaryPublicId,
      resourceType: 'raw',
      mimeType: material.mimeType,
      originalFileName: material.originalFileName,
    }, res);
  } catch (error) {
    if (res.headersSent) return;
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function previewProfessorSubmission(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId).select('_id classOffering category');
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    if (isLessonCategory(material.category)) {
      return res.status(400).json({ message: 'Lesson materials do not have student submissions.' });
    }
    const submission = await MaterialSubmission.findOne({ _id: req.params.submissionId, material: material._id })
      .select('+cloudinaryPublicId');
    if (!submission || !submission.cloudinaryPublicId) return res.status(404).json({ message: 'Submission file not found.' });
    await streamPrivateCloudinaryFile({
      publicId: submission.cloudinaryPublicId,
      resourceType: submission.mimeType?.startsWith('image/') ? 'image' : 'raw',
      mimeType: submission.mimeType,
      originalFileName: submission.originalFileName,
    }, res);
  } catch (error) {
    if (res.headersSent) return;
    if (error.name === 'CastError') return res.status(404).json({ message: 'Submission file not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function createSubmissionDownloadUrl(submission) {
  if (!submission?.cloudinaryPublicId) {
    return { url: '', expiresAt: null };
  }
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;
  const url = cloudinary.utils.private_download_url(
    submission.cloudinaryPublicId,
    undefined,
    {
      resource_type: 'auto',
      type: 'authenticated',
      attachment: submission.originalFileName || 'submission',
      expires_at: expiresAt,
    },
  );
  return { url, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

async function createStudentMaterialSubmission(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    if (isLessonCategory(material.category)) {
      return res.status(400).json({ message: 'Lesson materials do not require student submissions.' });
    }

    const file = req.file;
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';
    const existingSubmission = await MaterialSubmission.findOne({ material: material._id, student: req.user._id }).select('+cloudinaryPublicId');
    if (!file && !text && !existingSubmission?.cloudinaryPublicId) {
      return res.status(400).json({ message: 'Upload a file or add a note before submitting your work.' });
    }
    if (file && !isSubmissionAllowedFile(file)) {
      return res.status(400).json({ message: 'Uploads must be an image or a PDF/DOC/DOCX/PPT/PPTX file.' });
    }
    if (file && file.size > MAX_FILE_BYTES) {
      return res.status(413).json({ message: 'Submission files must be 20 MB or smaller.' });
    }

    const now = new Date();
    if (existingSubmission && existingSubmission.status !== 'draft') {
      return res.status(409).json({ message: 'This work has already been turned in. You cannot change it after submission.' });
    }

    let cloudPublicId = existingSubmission?.cloudinaryPublicId || '';
    let submissionPayload = {
      material: material._id,
      student: req.user._id,
      text,
      status: 'draft',
      submittedAt: null,
      updatedAt: now,
    };

    if (file) {
      const extension = file.originalname.includes('.') ? file.originalname.slice(file.originalname.lastIndexOf('.')).toLowerCase() : '.bin';
      const publicId = `${req.user._id}-${material._id}-${Date.now()}${extension}`;
      const uploaded = await uploadStudentSubmissionToCloudinary(file, publicId);
      cloudPublicId = uploaded.public_id;
      submissionPayload = {
        ...submissionPayload,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        cloudinaryPublicId: uploaded.public_id,
      };
    }

    let submission;
    if (existingSubmission) {
      if (existingSubmission.cloudinaryPublicId && !file) {
        submissionPayload.originalFileName = existingSubmission.originalFileName;
        submissionPayload.mimeType = existingSubmission.mimeType;
        submissionPayload.fileSize = existingSubmission.fileSize;
        submissionPayload.cloudinaryPublicId = existingSubmission.cloudinaryPublicId;
      }
      submission = await MaterialSubmission.findByIdAndUpdate(existingSubmission._id, submissionPayload, { new: true })
        .select('+cloudinaryPublicId')
        .populate('student', 'fullName');
      if (file && existingSubmission.cloudinaryPublicId) {
        await deleteSubmissionFromCloudinary(existingSubmission.cloudinaryPublicId);
      }
    } else {
      submission = await MaterialSubmission.create(submissionPayload);
      await submission.populate('student', 'fullName');
    }

    const submissionWithDownload = {
      ...submission.toObject ? submission.toObject() : submission,
      downloadUrl: submission.cloudinaryPublicId ? (await createSubmissionDownloadUrl(submission)).url : '',
    };

    return res.status(existingSubmission ? 200 : 201).json({ submission: submissionWithDownload, message: 'Your work was saved as a draft. Select Turn in when you are ready to submit it.' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    return next(error);
  }
}

async function turnInStudentMaterialSubmission(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    if (isLessonCategory(material.category)) {
      return res.status(400).json({ message: 'Lesson materials do not require student submissions.' });
    }

    const submission = await MaterialSubmission.findOne({ material: material._id, student: req.user._id })
      .select('+cloudinaryPublicId');
    if (!submission) {
      return res.status(400).json({ message: 'Save your work before turning it in.' });
    }
    if (submission.status !== 'draft') {
      await submission.populate('student', 'fullName');
      const alreadySubmitted = {
        ...submission.toObject(),
        downloadUrl: submission.cloudinaryPublicId ? (await createSubmissionDownloadUrl(submission)).url : '',
      };
      return res.json({
        submission: alreadySubmitted,
        message: submission.status === 'late' ? 'This work was already turned in late.' : 'This work was already turned in.',
      });
    }
    if (!submission.text && !submission.cloudinaryPublicId) {
      return res.status(400).json({ message: 'Add a note or upload a file before turning in your work.' });
    }

    const submittedAt = new Date();
    const isLate = isSubmissionLate(material.deadline, submittedAt);
    submission.status = isLate ? 'late' : 'submitted';
    submission.submittedAt = submittedAt;
    await submission.save();
    await submission.populate('student', 'fullName');

    const submissionWithDownload = {
      ...submission.toObject(),
      downloadUrl: submission.cloudinaryPublicId ? (await createSubmissionDownloadUrl(submission)).url : '',
    };
    return res.json({
      submission: submissionWithDownload,
      message: isLate ? 'Your work was turned in after the deadline.' : 'Your work was turned in on time.',
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    return next(error);
  }
}

async function getStudentMaterialSubmission(req, res, next) {
  try {
    const material = await findStudentMaterial(req.params.materialId, req.user._id);
    if (isLessonCategory(material.category)) {
      return res.json({ submission: null });
    }
    const submission = await MaterialSubmission.findOne({ material: material._id, student: req.user._id })
      .select('+cloudinaryPublicId')
      .populate('student', 'fullName')
      .lean();
    if (!submission) {
      return res.json({ submission: null });
    }
    return res.json({ submission: { ...submission, downloadUrl: (await createSubmissionDownloadUrl(submission)).url } });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function getProfessorMaterialSubmissions(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId);
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    if (isLessonCategory(material.category)) {
      return res.status(400).json({ message: 'Lesson materials do not have student submissions.' });
    }
    const submissions = await MaterialSubmission.find({ material: material._id, status: { $ne: 'draft' } })
      .select('+cloudinaryPublicId')
      .populate('student', 'fullName email')
      .sort({ submittedAt: -1 })
      .lean();
    const enrichedSubmissions = await Promise.all(submissions.map(async (submission) => ({
      ...submission,
      isLate: isSubmissionLate(material.deadline, submission.submittedAt),
      isPassing: submission.pointsEarned !== null && submission.pointsEarned !== undefined
        ? isPassingScore(submission.pointsEarned, material.pointsPossible || 100)
        : null,
      downloadUrl: submission.cloudinaryPublicId ? (await createSubmissionDownloadUrl(submission)).url : '',
    })));
    return res.json({ submissions: enrichedSubmissions });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

async function gradeProfessorSubmission(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId).select('_id classOffering title pointsPossible category');
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    if (isLessonCategory(material.category)) {
      return res.status(400).json({ message: 'Lesson materials do not have student submissions.' });
    }

    const rawPointsEarned = req.body.pointsEarned;
    if (rawPointsEarned === undefined || rawPointsEarned === null || String(rawPointsEarned).trim() === '') {
      return res.status(400).json({ message: 'Enter the points earned before saving the grade.' });
    }
    const pointsEarned = Number(rawPointsEarned);
    const feedback = typeof req.body.feedback === 'string' ? req.body.feedback.trim() : '';
    const pointsPossible = Number(material.pointsPossible || 100);
    if (!Number.isFinite(pointsEarned) || pointsEarned < 0 || pointsEarned > pointsPossible) {
      return res.status(400).json({ message: `Score must be between 0 and ${pointsPossible}.` });
    }
    if (feedback.length > 2000) return res.status(400).json({ message: 'Feedback must be 2,000 characters or fewer.' });

    const submission = await MaterialSubmission.findOne({
      _id: req.params.submissionId,
      material: material._id,
      status: { $ne: 'draft' },
    });
    if (!submission) return res.status(404).json({ message: 'Turned-in student submission not found.' });

    submission.pointsEarned = pointsEarned;
    submission.feedback = feedback;
    submission.gradedAt = new Date();
    submission.status = 'reviewed';
    await submission.save();
    await submission.populate('student', 'fullName email');

    const isPassing = isPassingScore(pointsEarned, pointsPossible);
    const notificationsSent = await notifyGradePosted({ submission, material });
    if (notificationsSent) {
      submission.notificationSentAt = new Date();
      await submission.save();
    }
    return res.json({
      submission: { ...submission.toObject(), isPassing },
      message: isPassing ? 'Score saved — passing result.' : 'Score saved — below the 70% passing mark.',
      ...(notificationsSent ? {} : { notificationWarning: 'The grade was saved, but the student notification could not be created.' }),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Submission not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === 'ValidationError') return res.status(400).json({ message: error.message });
    return next(error);
  }
}

async function getProfessorDownloadUrl(req, res, next) {
  try {
    const material = await ClassMaterial.findById(req.params.materialId).select('+cloudinaryPublicId');
    if (!material) return res.status(404).json({ message: 'Class material not found.' });
    await findOwnedClass(material.classOffering, req.user._id);
    return res.json(await createDownloadUrl(material));
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ message: 'Class material not found.' });
    if (error.status) return res.status(error.status).json({ message: error.message });
    return next(error);
  }
}

module.exports = {
  MAX_FILE_BYTES,
  deleteProfessorMaterial,
  getAllProfessorMaterials,
  getProfessorDownloadUrl,
  getProfessorMaterialDetails,
  gradeProfessorSubmission,
  getProfessorMaterials,
  getStudentMaterialDetails,
  getStudentMaterialComments,
  createStudentMaterialComment,
  createStudentMaterialSubmission,
  turnInStudentMaterialSubmission,
  getProfessorMaterialSubmissions,
  previewProfessorMaterial,
  previewProfessorSubmission,
  previewStudentMaterial,
  getStudentDownloadUrl,
  getStudentMaterialSubmission,
  getStudentMaterials,
  isAllowedFile,
  normalizeMaterialCategory,
  normalizeMaterialDeadline,
  normalizePointsPossible,
  isSubmissionLate,
  isPassingScore,
  uploadMaterial,
};
