const test = require('node:test');
const assert = require('node:assert/strict');
const toysRouter = require('./toys');

test('normalizeBulkCriteria keeps valid field/value rules and removes empties', () => {
  const criteria = toysRouter.normalizeBulkCriteria([
    { field: 'theme', value: 'Star Wars' },
    { field: '', value: 'ignored' },
    { field: 'year', value: ' 2024 ' },
    { field: 'condition', value: '' }
  ]);

  assert.deepEqual(criteria, [
    { field: 'theme', value: 'Star Wars' },
    { field: 'year', value: '2024' }
  ]);
});
