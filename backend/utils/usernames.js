const User = require('../src/models/User');

function usernameBase(value) {
  const base = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 25);
  return base.length >= 3 ? base : 'learner';
}

async function createUniqueUsername(value) {
  const base = usernameBase(value);
  let candidate = base;
  let suffix = 2;

  while (await User.exists({ username: candidate })) {
    const suffixText = `.${suffix}`;
    candidate = `${base.slice(0, 30 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }

  return candidate;
}

module.exports = { createUniqueUsername, usernameBase };
