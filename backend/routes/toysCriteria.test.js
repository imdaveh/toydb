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

test('allowed toy criteria include type for bulk filters and exports', () => {
  const result = toysRouter.buildCriteriaClauses([
    { field: 'type', value: 'Action Figure' }
  ]);

  assert.deepEqual(result.normalizedCriteria, [{ field: 'type', value: 'Action Figure' }]);
  assert.deepEqual(result.whereClauses, ['t.type = ?']);
  assert.deepEqual(result.params, ['Action Figure']);
});
