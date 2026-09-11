function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
}

function validateAuthInput(email, password, name = null) {
  const errors = [];
  
  if (!email || typeof email !== 'string' || !validateEmail(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (name !== null && (!name || typeof name !== 'string' || name.trim().length === 0)) {
    errors.push('Name is required.');
  }

  return errors;
}

module.exports = {
  validateEmail,
  validateAuthInput
};
