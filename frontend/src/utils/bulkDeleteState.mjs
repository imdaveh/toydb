export function createBulkDeleteCriteria(){
  return [{ id: 1, field: 'toyline', value: '' }]
}

export function createBulkDeleteResetState(){
  return {
    bulkCriteria: createBulkDeleteCriteria(),
    bulkPreview: null,
    bulkDeleteError: null,
    bulkDeleteSuccess: null,
    bulkDeleteBusy: false,
    bulkPreviewBusy: false
  }
}
