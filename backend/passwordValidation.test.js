const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePassword } = require('./passwordValidation');

test('accepts a valid password', () => {
  assert.equal(validatePassword('StrongPass!2024'), null);
});

test('rejects passwords shorter than 12 characters', () => {
  assert.equal(validatePassword('Short1!'), 'Password must be at least 12 characters long');
});

test('rejects passwords missing a symbol', () => {
  assert.equal(validatePassword('StrongPassword123'), 'Password must include a symbol');
});
