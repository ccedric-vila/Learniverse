const { DEPARTMENT_NAMES } = require('./departments');

function departmentForProgram(program = '') {
  if (/^(General Education)/.test(program)) return DEPARTMENT_NAMES.liberalArtsAndHumanities;
  if (/^(Mandatory Institutional Subjects|Physical Education & NSTP)/.test(program)) return DEPARTMENT_NAMES.physicalEducationAndNstp;
  if (/^(Mathematics & Basic Sciences)|\(BSES\)/.test(program)) return DEPARTMENT_NAMES.mathematicsAndSciences;
  if (/\((BSCE|BSEE|BSECE|BSME)\)/.test(program)) return DEPARTMENT_NAMES.engineering;
  if (/\(BSIT\)/.test(program)) return DEPARTMENT_NAMES.informationTechnology;
  if (/\(BTVTED\)/.test(program)) return DEPARTMENT_NAMES.industrialEducation;
  if (/\(BET\)/.test(program)) return DEPARTMENT_NAMES.engineeringTechnology;
  return '';
}

module.exports = { departmentForProgram };
