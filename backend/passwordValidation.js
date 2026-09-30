function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12) return 'Password must be at least 12 characters long';
  if (!/[a-z]/.test(password)) return 'Password must include a lowercase letter';
  if (!/[A-Z]/.test(password)) return 'Password must include an uppercase letter';
  if (!/\d/.test(password)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Password must include a symbol';
  return null;
}

module.exports = { validatePassword };
