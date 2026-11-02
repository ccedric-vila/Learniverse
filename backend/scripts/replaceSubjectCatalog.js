require('dotenv').config();

const { randomBytes } = require('node:crypto');
const connectDatabase = require('../config/db');
const ClassOffering = require('../src/models/ClassOffering');
const Subject = require('../src/models/Subject');
const User = require('../src/models/User');
const COURSE_CURRICULUM = require('../utils/courseCurriculum');
const seedCourseSubjects = require('../utils/seedCourseSubjects');

const SHARED_PROGRAMS = new Set([
  'General Education (GE)',
  'Mandatory Institutional Subjects (PE/NSTP)',
  'Mathematics & Basic Sciences',
]);

function normalizeSubjectName(name) {
  return name.toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function resolveCatalogEntry(offering) {
  const subject = offering.subject;
  if (!subject) throw new Error(`Offering ${offering._id} references a missing subject.`);

  const matches = Object.entries(COURSE_CURRICULUM).flatMap(([courseProgram, names]) => names
    .filter((name) => normalizeSubjectName(name) === normalizeSubjectName(subject.name))
    .map((name) => ({ courseProgram, name })));
  const oldProgram = offering.courseProgram || subject.courseProgram;
  const programMatches = matches.filter((entry) => entry.courseProgram === oldProgram);
  if (programMatches.length === 1) return programMatches[0];
  if (matches.length === 1) return matches[0];
  const sharedMatches = matches.filter((entry) => SHARED_PROGRAMS.has(entry.courseProgram));
  if (sharedMatches.length === 1) return sharedMatches[0];

  throw new Error(`Cannot safely map referenced subject "${subject.name}" in offering ${offering._id} to the replacement catalog.`);
}

async function replaceSubjectCatalog() {
  await connectDatabase();
  const session = await require('mongoose').startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const admin = await User.findOne({ role: 'ADMIN' }).select('_id').session(session).lean();
      if (!admin) throw new Error('Create an admin account before replacing the subject catalog.');

      const offerings = await ClassOffering.find()
        .select('_id subject courseProgram')
        .populate('subject', 'name subjectCode courseProgram')
        .session(session)
        .lean();
      const subjectReferences = [];
      for (const offering of offerings) {
        subjectReferences.push({ offering, target: resolveCatalogEntry(offering) });
      }

      const referencedIds = [...new Set(offerings.map((offering) => String(offering.subject._id)))];
      for (const id of referencedIds) {
        const temporaryCode = `TMP-${randomBytes(8).toString('hex').toUpperCase()}`;
        await Subject.updateOne({ _id: id }, { $set: { subjectCode: temporaryCode } }, { session, runValidators: true });
      }

      const deletedBeforeSeed = referencedIds.length
        ? await Subject.deleteMany({ _id: { $nin: referencedIds } }, { session })
        : await Subject.deleteMany({}, { session });

      await seedCourseSubjects(admin._id, undefined, session);

      const targetPrograms = Object.keys(COURSE_CURRICULUM);
      const seededSubjects = await Subject.find({ courseProgram: { $in: targetPrograms } }).session(session).lean();
      const subjectByKey = new Map(seededSubjects.map((subject) => [`${subject.courseProgram}\u0000${normalizeSubjectName(subject.name)}`, subject]));
      const targetIds = new Set();

      for (const { offering, target } of subjectReferences) {
        const migratedSubject = subjectByKey.get(`${target.courseProgram}\u0000${normalizeSubjectName(target.name)}`);
        if (!migratedSubject) throw new Error(`Replacement subject "${target.name}" was not created for ${target.courseProgram}.`);
        targetIds.add(String(migratedSubject._id));
        await ClassOffering.updateOne({ _id: offering._id }, { $set: { subject: migratedSubject._id } }, { session });
      }

      for (const [courseProgram, names] of Object.entries(COURSE_CURRICULUM)) {
        for (const name of names) {
          const subject = subjectByKey.get(`${courseProgram}\u0000${normalizeSubjectName(name)}`);
          if (!subject) throw new Error(`Replacement catalog is missing "${name}" for ${courseProgram}.`);
          targetIds.add(String(subject._id));
        }
      }

      const migratedOfferingCount = await ClassOffering.countDocuments({ subject: { $nin: [...targetIds] } }).session(session);
      if (migratedOfferingCount) throw new Error(`${migratedOfferingCount} class offering(s) would have an invalid subject reference.`);

      const deletedRemainder = await Subject.deleteMany({ _id: { $nin: [...targetIds] } }, { session });
      result = {
        catalogSubjectCount: targetIds.size,
        removedOldSubjects: deletedBeforeSeed.deletedCount + deletedRemainder.deletedCount,
        remappedOfferingCount: subjectReferences.length,
      };
    });
  } finally {
    await session.endSession();
    await require('mongoose').disconnect();
  }

  console.log(`Subject catalog replaced. ${result.catalogSubjectCount} subjects retained from the requested curriculum; ${result.removedOldSubjects} old subject records removed; ${result.remappedOfferingCount} class offering reference(s) preserved.`);
}

replaceSubjectCatalog().catch((error) => {
  console.error('Subject catalog replacement failed; database transaction was rolled back:', error.message);
  process.exitCode = 1;
});
