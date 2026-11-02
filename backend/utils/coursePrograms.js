const COURSE_PROGRAM_GROUPS = [
  {
    label: 'Engineering Programs',
    programs: [
      'Bachelor of Science in Civil Engineering (BSCE)',
      'Bachelor of Science in Electrical Engineering (BSEE)',
      'Bachelor of Science in Electronics Engineering (BSECE)',
      'Bachelor of Science in Mechanical Engineering (BSME)',
    ],
  },
  {
    label: 'Information Technology and Computer Studies',
    programs: [
      'Bachelor of Science in Information Technology (BSIT)',
    ],
  },
  {
    label: 'Mathematics and Sciences',
    programs: [
      'Bachelor of Science in Environmental Science (BSES)',
      'Mathematics & Basic Sciences',
    ],
  },
  {
    label: 'Engineering Technology (BET) Majors',
    programs: [
      'Bachelor of Engineering Technology (BET) - Automotive Technology',
      'Bachelor of Engineering Technology (BET) - Chemical Technology',
      'Bachelor of Engineering Technology (BET) - Civil Technology',
      'Bachelor of Engineering Technology (BET) - Dies and Moulds Technology',
      'Bachelor of Engineering Technology (BET) - Electrical Technology',
      'Bachelor of Engineering Technology (BET) - Electronics Technology',
      'Bachelor of Engineering Technology (BET) - Electromechanical Technology',
      'Bachelor of Engineering Technology (BET) - HVAC/R Technology',
      'Bachelor of Engineering Technology (BET) - Instrumentation & Control Technology',
      'Bachelor of Engineering Technology (BET) - Mechatronics Technology',
      'Bachelor of Engineering Technology (BET) - Mechanical Technology',
      'Bachelor of Engineering Technology (BET) - Non-Destructive Testing Technology',
    ],
  },
  {
    label: 'Industrial Education (Technical Teacher Education)',
    programs: [
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electrical Technology (ET)',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electronics Technology (ELXT)',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Programming (ICT)',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Hardware Servicing (ICTCH)',
      // Preserve names used by class offerings created before the program list was expanded.
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - ICT Computer Programming',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - ICT Computer Hardware',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electronics Technology',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electrical Technology',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electronics',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electrical',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Programming',
    ],
  },
  {
    label: 'Liberal Arts and Humanities',
    programs: [
      'General Education (GE)',
    ],
  },
  {
    label: 'Physical Education and NSTP',
    programs: ['Mandatory Institutional Subjects (PE/NSTP)', 'Physical Education & NSTP'],
  },
];

const COURSE_PROGRAMS = COURSE_PROGRAM_GROUPS.flatMap(({ programs }) => programs);

      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electrical Technology (ET)',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Electronics Technology (ELXT)',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Programming (ICT)',
      'Bachelor of Technical-Vocational Teacher Education (BTVTED) - Computer Hardware Servicing (ICTCH)',
module.exports = COURSE_PROGRAMS;
module.exports.groups = COURSE_PROGRAM_GROUPS;
