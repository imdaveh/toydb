import test from 'node:test'
import assert from 'node:assert/strict'

import { createBulkDeleteCriteria, createBulkDeleteResetState } from './bulkDeleteState.mjs'

test('bulk delete reset returns a fresh filter set and clears preview state', () => {
  const reset = createBulkDeleteResetState()

  assert.deepEqual(reset.bulkCriteria, createBulkDeleteCriteria())
  assert.equal(reset.bulkPreview, null)
  assert.equal(reset.bulkDeleteError, null)
  assert.equal(reset.bulkDeleteSuccess, null)
  assert.equal(reset.bulkDeleteBusy, false)
  assert.equal(reset.bulkPreviewBusy, false)
})
