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

test('allowed toy criteria exclude the removed type field for bulk filters and exports', () => {
  assert.throws(() => toysRouter.buildCriteriaClauses([
    { field: 'type', value: 'Action Figure' }
  ]), /Invalid field: type/);
});

test('import copy resolution rejects duplicates from existing records and the same import batch', () => {
  const existingToys = [{
    name: 'Millennium Falcon',
    manufacturer: 'LEGO',
    toyline: '',
    series: '',
    sub_series: '',
    theme: '',
    year: ''
  }];

  const naturalKey = ['millennium falcon', 'lego', '', '', '', '', ''].join('||');

  assert.deepEqual(toysRouter.resolveImportCopy(existingToys, naturalKey, new Map()), {
    shouldSkip: true,
    nextCopy: null
  });

  assert.deepEqual(toysRouter.resolveImportCopy(existingToys, naturalKey, new Map([[naturalKey, 1]])), {
    shouldSkip: true,
    nextCopy: null
  });
});
