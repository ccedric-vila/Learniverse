const Subject = require('../src/models/Subject');
const COURSE_CURRICULUM = require('./courseCurriculum');
const { departmentForProgram } = require('./courseDepartments');

function programCode(program) {
  if (program === 'General Education (GE)') return 'GE';
  if (program === 'Mandatory Institutional Subjects (PE/NSTP)') return 'PE-NSTP';
  if (program === 'Mathematics & Basic Sciences') return 'BASD-SCI';
  if (program === 'Physical Education & NSTP') return 'PE-NSTP';
  if (program.includes('(BSIT)')) return 'BSIT';
  if (program.includes('(BSES)')) return 'BSES';
  if (program.includes('(BSCE)')) return 'BSCE';
  if (program.includes('(BSEE)')) return 'BSEE';
  if (program.includes('(BSECE)')) return 'BSECE';
  if (program.includes('(BSME)')) return 'BSME';
  if (program.includes('(BTVTED)')) {
    if (program.includes('Computer Programming')) return 'BTV-ICTP';
    if (program.includes('Computer Hardware')) return 'BTV-ICTH';
    if (program.includes('Electronics')) return 'BTV-ELXT';
    if (program.includes('Electrical')) return 'BTV-ET';
  }
  if (program.includes('Automotive')) return 'BETAT';
  if (program.includes('Chemical')) return 'BETCHT';
  if (program.includes('Civil Technology')) return 'BETCT';
  if (program.includes('Dies and Moulds')) return 'BETDMT';
  if (program.includes('Electrical')) return 'BETET';
  if (program.includes('Electronics')) return 'BETELXT';
  if (program.includes('Electromechanical')) return 'BETEMT';
  if (program.includes('HVAC')) return 'BETHVAC';
  if (program.includes('Instrumentation')) return 'BETICT';
  if (program.includes('Mechatronics')) return 'BETMECT';
  if (program.includes('Mechanical')) return 'BETMT';
  if (program.includes('Non-Destructive')) return 'BETNDT';
  return 'GEN';
}

function officialStyleCode(program, index) {
  return `${programCode(program)}-CUR-${String(index + 1).padStart(3, '0')}`;
}

function subjectDescription(name, program) {
  const topic = name.toLowerCase();
  let focus = 'builds understanding of its core concepts, methods, and terminology through guided study and applied exercises';
  if (/programming|software|application|web development|coding|microcontroller/.test(topic)) {
    focus = 'develops practical skills in planning, building, testing, and improving technical solutions through hands-on exercises';
  } else if (/project|thesis|research|capstone|internship|training|practicum|practice teaching|field study/.test(topic)) {
    focus = 'applies prior learning to a supervised project or field experience, emphasizing planning, professional practice, and evidence-based reflection';
  } else if (/safety|inspection|quality|assurance|standards|waste management/.test(topic)) {
    focus = 'introduces applicable standards, risk assessment, inspection methods, and responsible procedures for professional practice';
  } else if (/maintenance|servicing|troubleshooting|diagnostics|repair/.test(topic)) {
    focus = 'builds systematic inspection, maintenance, and troubleshooting skills using appropriate tools, safety practices, and diagnostic methods';
  } else if (/chemistry|chemical|analytical|organic|biology|ecology|biodiversity|soil science|toxicology/.test(topic)) {
    focus = 'examines relevant scientific principles and laboratory or field methods, with practice interpreting observations and technical results';
  } else if (/system|network|database|architecture|operating|electronics|electrical|motor|control|instrumentation|robotics|hydraulics|pneumatics/.test(topic)) {
    focus = 'covers system principles, components, operation, and application through practical analysis and problem-solving activities';
  } else if (/design|drafting|autocad|fabrication|machining|welding|construction|surveying/.test(topic)) {
    focus = 'develops design and production skills through technical drawings, material selection, measurement, and applied workshop tasks';
  }
  return `${name} ${focus}. Learning activities connect the subject to the ${program} program and prepare students to apply their knowledge in academic and workplace settings.`;
}

async function seedCourseSubjects(createdBy, selectedProgram, session) {
  if (!createdBy) throw new Error('An admin account is required to add curriculum subjects.');
  let inserted = 0;
  const curriculum = selectedProgram
    ? (COURSE_CURRICULUM[selectedProgram] ? [[selectedProgram, COURSE_CURRICULUM[selectedProgram]]] : [])
    : Object.entries(COURSE_CURRICULUM);
  if (selectedProgram && curriculum.length === 0) {
    const error = new Error('Curriculum subjects are not available for this program yet. Add its subjects in the Subjects tab first.');
    error.status = 404;
    throw error;
  }

  for (const [courseProgram, subjects] of curriculum) {
    for (const [index, name] of subjects.entries()) {
      const code = officialStyleCode(courseProgram, index);
      const description = subjectDescription(name, courseProgram);
      const result = await Subject.updateOne(
        { name, courseProgram },
        {
          $setOnInsert: {
            name,
            units: 3,
            isActive: true,
            createdBy,
          },
          $set: { subjectCode: code, description, courseProgram, department: departmentForProgram(courseProgram) },
        },
        { upsert: true, runValidators: true, session },
      );
      if (result.upsertedCount) inserted += 1;
    }
  }

  return { inserted, curriculumCount: curriculum.reduce((count, [, subjects]) => count + subjects.length, 0) };
}

module.exports = seedCourseSubjects;
