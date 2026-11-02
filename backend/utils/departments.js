const DEPARTMENT_NAMES = {
  engineering: 'Department of Engineering',
  engineeringTechnology: 'Department of Engineering Technology',
  informationTechnology: 'Department of Information Technology and Computer Studies',
  industrialEducation: 'Department of Industrial Education (Technical Teacher Education)',
  mathematicsAndSciences: 'Department of Mathematics and Sciences',
  liberalArtsAndHumanities: 'Department of Liberal Arts and Humanities',
  physicalEducationAndNstp: 'Department of Physical Education and NSTP',
};

const DEPARTMENTS = Object.values(DEPARTMENT_NAMES);

const LEGACY_DEPARTMENTS = [
  'Basic Arts and Sciences Department (BASD)',
  'Department of Information Technology & Computer Studies',
  'Department of Industrial Education / Technical Teacher Education',
  'Basic Arts and Sciences Department',
  'Department of Mathematics and Sciences',
  'Department of Liberal Arts & Humanities',
  'Department of Physical Education (PE) & NSTP',
  'Civil and Allied Department',
  'Electrical and Allied Department',
  'Mechanical and Allied Department',
];

module.exports = {
  DEPARTMENTS,
  DEPARTMENT_NAMES,
  ALL_DEPARTMENTS: [...new Set([...DEPARTMENTS, ...LEGACY_DEPARTMENTS])],
};
