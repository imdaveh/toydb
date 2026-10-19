const test = require('node:test');
const assert = require('node:assert/strict');

const { getRecordValue, buildAccessoryEntriesFromCsv } = require('./toys');

test('CSV release aliases resolve to the release wave field', () => {
  assert.equal(getRecordValue({ release_wave: 'Wave 1' }, ['release_wave', 'release', 'release wave']), 'Wave 1');
  assert.equal(getRecordValue({ 'release wave': 'Wave 2' }, ['release_wave', 'release', 'release wave']), 'Wave 2');
  assert.equal(getRecordValue({ release: 'Wave 3' }, ['release_wave', 'release', 'release wave']), 'Wave 3');
});

test('CSV accessories import preserves owned and non-owned accessory names', () => {
  const entries = buildAccessoryEntriesFromCsv({
    accessories: 'Helmet|Laser',
    owned_accessories: 'Laser|Blaster'
  });

  assert.deepEqual(entries, [
    { name: 'Helmet', has_accessory: false },
    { name: 'Laser', has_accessory: true },
    { name: 'Blaster', has_accessory: true }
  ]);
});

test('CSV export and import round-trip preserves accessory ownership metadata', () => {
  const exportedRow = [
    'Millennium Falcon',
    '42',
    '2000',
    'LEGO',
    'Millennium Falcon',
    'Star Wars',
    '',
    'Space',
    'Wave 1',
    'Good',
    'Includes box and instructions',
    'Star Wars,Space',
    'Han Solo minifigure|Seat',
    'Han Solo minifigure',
    '89.99',
    '129.99',
    'Local shop'
  ];

  const record = {
    name: exportedRow[0],
    manufacturer_id: exportedRow[1],
    year: exportedRow[2],
    manufacturer: exportedRow[3],
    toyline: exportedRow[4],
    series: exportedRow[5],
    sub_series: exportedRow[6],
    theme: exportedRow[7],
    release_wave: exportedRow[8],
    condition: exportedRow[9],
    notes: exportedRow[10],
    tags: exportedRow[11],
    accessories: exportedRow[12],
    owned_accessories: exportedRow[13],
    cost: exportedRow[14],
    value: exportedRow[15],
    source: exportedRow[16]
  };

  const importedEntries = buildAccessoryEntriesFromCsv(record);

  assert.deepEqual(importedEntries, [
    { name: 'Han Solo minifigure', has_accessory: true },
    { name: 'Seat', has_accessory: false }
  ]);
});
