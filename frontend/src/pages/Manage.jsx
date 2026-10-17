import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { createBulkDeleteCriteria, createBulkDeleteResetState } from '../utils/bulkDeleteState.mjs'

export default function Manage(){
  const navigate = useNavigate()
  const [importFile, setImportFile] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [templateBusy, setTemplateBusy] = useState(false)
  const [exportCriteria, setExportCriteria] = useState([])
  const [bulkCriteria, setBulkCriteria] = useState([{ id: 1, field: 'toyline', value: '' }])
  const [bulkCollectionToys, setBulkCollectionToys] = useState([])
  const [bulkCollectionLoading, setBulkCollectionLoading] = useState(false)
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false)
  const [bulkDeleteError, setBulkDeleteError] = useState(null)
  const [bulkDeleteSuccess, setBulkDeleteSuccess] = useState(null)
  const [bulkPreview, setBulkPreview] = useState(null)
  const [bulkPreviewBusy, setBulkPreviewBusy] = useState(false)
  const [exportPreview, setExportPreview] = useState(null)

  async function getToken(){
    const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
    return (await refresh.json()).accessToken
  }

  async function downloadTemplate(){
    setImportError(null)
    setTemplateBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/import/template', { headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) {
        setImportError('Unable to download template')
        setTemplateBusy(false)
        return
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'toydb-import-template.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      setImportError('Unable to reach the ToyDB server')
    }
    setTemplateBusy(false)
  }

  function getExportCriteriaPayload(){
    return exportCriteria
      .map(row => ({ field: row.field, value: row.value }))
      .filter(row => row.field && String(row.value ?? '').trim())
  }

  function matchesExportCriterion(toy, criterion){
    if (!criterion || !criterion.field || !criterion.value) return true
    const value = String(criterion.value).trim()
    if (criterion.field === 'year') return String(toy.year ?? '') === value
    return String(toy[criterion.field] ?? '') === value
  }

  function getFilteredExportToys(criteria){
    if (!criteria.length) return bulkCollectionToys
    return bulkCollectionToys.filter(toy => criteria.every(criterion => matchesExportCriterion(toy, criterion)))
  }

  function getAllowedExportValues(field, index){
    if (!bulkCollectionToys.length) return []
    const priorCriteria = exportCriteria.slice(0, index).filter(row => row.field && String(row.value ?? '').trim())
    const filteredToys = getFilteredExportToys(priorCriteria)
    const values = [...new Set(filteredToys
      .map(toy => toy[field])
      .filter(value => value !== null && value !== undefined && String(value).trim())
      .map(value => String(value).trim())
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return values
  }

  function updateExportRow(id, patch){
    setExportCriteria(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
    setExportPreview(null)
  }

  function addExportRow(){
    setExportCriteria(current => [...current, { id: Date.now() + Math.random(), field: 'toyline', value: '' }])
    setExportPreview(null)
  }

  function resetExportCriteria(){
    setExportCriteria([])
    setExportPreview(null)
  }

  function previewExportMatches(){
    const criteria = getExportCriteriaPayload()
    const matches = getFilteredExportToys(criteria)
    setExportPreview({ total: matches.length, matches: matches.slice(0, 50) })
  }

  async function exportCollectionCsv(){
    const criteria = getExportCriteriaPayload()
    setImportError(null)
    setTemplateBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const url = new URL(import.meta.env.VITE_API_BASE + '/toys/export/csv')
      if (criteria.length) url.searchParams.set('criteria', JSON.stringify(criteria))
      const response = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setImportError(data.error || 'Unable to export your collection')
        setTemplateBusy(false)
        return
      }
      const blob = await response.blob()
      const link = document.createElement('a')
      link.href = URL.createObjectURL(blob)
      link.download = 'toydb-export.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(link.href)
    } catch (error) {
      setImportError('Unable to reach the ToyDB server')
    }
    setTemplateBusy(false)
  }

  async function importCsv(event){
    event.preventDefault()
    setImportError(null)
    setImportResult(null)
    if (!importFile) {
      setImportError('Choose a CSV file to import')
      return
    }
    setImportBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const data = new FormData()
      data.append('file', importFile)
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/import', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token },
        body: data
      })
      const result = await response.json()
      if (!response.ok) {
        setImportError(result.error || 'Import failed')
        setImportBusy(false)
        return
      }
      setImportResult(result)
      setImportFile(null)
      event.target.reset()
    } catch (error) {
      setImportError('Unable to reach the ToyDB server')
    }
    setImportBusy(false)
  }

  const importWarningCount = importResult?.errors?.length || 0

  async function loadCollectionToys(){
    setBulkCollectionLoading(true)
    try {
      const token = await getToken()
      if (!token) {
        setBulkDeleteError('Please log in to manage your collection.')
        setBulkCollectionLoading(false)
        return false
      }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys?wishlist=false', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) {
        setBulkDeleteError(data.error || 'Unable to load collection values')
        return false
      }
      setBulkCollectionToys(data.toys || [])
      return true
    } catch (error) {
      setBulkDeleteError('Unable to reach the ToyDB server')
      return false
    } finally {
      setBulkCollectionLoading(false)
    }
  }

  useEffect(() => {
    loadCollectionToys()
  }, [navigate])

  function matchesBulkCriterion(toy, criterion){
    if (!criterion || !criterion.field || !criterion.value) return true
    const value = String(criterion.value).trim()
    if (criterion.field === 'year') return String(toy.year ?? '') === value
    return String(toy[criterion.field] ?? '') === value
  }

  function getFilteredBulkToys(criteria){
    if (!criteria.length) return bulkCollectionToys
    return bulkCollectionToys.filter(toy => criteria.every(criterion => matchesBulkCriterion(toy, criterion)))
  }

  function getAllowedBulkValues(field, index){
    if (!bulkCollectionToys.length) return []
    const priorCriteria = bulkCriteria.slice(0, index).filter(row => row.field && String(row.value ?? '').trim())
    const filteredToys = getFilteredBulkToys(priorCriteria)
    const values = [...new Set(filteredToys
      .map(toy => toy[field])
      .filter(value => value !== null && value !== undefined && String(value).trim())
      .map(value => String(value).trim())
    )].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return values
  }

  function updateBulkRow(id, patch){
    setBulkCriteria(current => current.map(row => row.id === id ? { ...row, ...patch } : row))
    setBulkPreview(null)
  }

  function addBulkRow(){
    setBulkCriteria(current => [...current, { id: Date.now() + Math.random(), field: 'toyline', value: '' }])
  }

  function resetBulkDeleteState(){
    const resetState = createBulkDeleteResetState()
    setBulkCriteria(resetState.bulkCriteria)
    setBulkPreview(resetState.bulkPreview)
    setBulkDeleteError(resetState.bulkDeleteError)
    setBulkDeleteSuccess(resetState.bulkDeleteSuccess)
    setBulkDeleteBusy(resetState.bulkDeleteBusy)
    setBulkPreviewBusy(resetState.bulkPreviewBusy)
  }

  function removeBulkRow(id){
    setBulkCriteria(current => current.length > 1 ? current.filter(row => row.id !== id) : current)
    setBulkPreview(null)
  }

  function getBulkCriteriaPayload(){
    return bulkCriteria
      .map(row => ({ field: row.field, value: row.value }))
      .filter(row => row.field && String(row.value ?? '').trim())
  }

  const canApplyBulkAction = Boolean(bulkPreview) && !bulkDeleteBusy && !!getBulkCriteriaPayload().length

  async function previewBulkAction(action = 'delete'){
    const criteria = getBulkCriteriaPayload()
    if (!criteria.length) {
      setBulkDeleteError('Choose at least one field/value pair to preview.')
      return
    }

    setBulkPreviewBusy(true)
    setBulkDeleteError(null)
    setBulkDeleteSuccess(null)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/bulk-update', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria, preview: true, action })
      })
      const data = await response.json()
      if (!response.ok) {
        setBulkDeleteError(data.error || 'Unable to preview matching toys')
        return
      }
      setBulkPreview({ action: data.action || action, total: data.total || 0, matches: data.matches || [] })
      const actionLabel = data.action === 'hide' ? 'hidden' : data.action === 'mark_for_sale' ? 'marked for sale' : 'deleted'
      setBulkDeleteSuccess(data.total ? `Previewing ${data.total} matching toy${data.total === 1 ? '' : 's'} to be ${actionLabel}.` : 'No toys match those criteria.')
    } catch (error) {
      setBulkDeleteError('Unable to reach the ToyDB server')
    }
    setBulkPreviewBusy(false)
  }

  async function bulkApplyAction(action = 'delete'){
    const criteria = getBulkCriteriaPayload()
    if (!criteria.length) {
      setBulkDeleteError('Choose at least one field/value pair to update.')
      return
    }

    const summary = criteria.map(row => `${row.field} = "${row.value}"`).join(' AND ')
    const actionText = {
      delete: `Delete all toys in your collection matching: ${summary}? This cannot be undone.`,
      hide: `Hide all toys in your collection matching: ${summary}?`,
      mark_for_sale: `Mark all toys in your collection matching: ${summary} as for sale?`
    }[action] || `Apply this bulk action to toys matching: ${summary}?`

    if (!window.confirm(actionText)) return

    setBulkDeleteBusy(true)
    setBulkDeleteError(null)
    setBulkDeleteSuccess(null)
    setBulkPreview(null)

    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/bulk-update', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ criteria, action })
      })
      const data = await response.json()
      if (!response.ok) {
        setBulkDeleteError(data.error || 'Unable to update matching toys')
        return
      }

      const updatedCount = data.deleted ?? data.updated ?? 0
      const actionSuccess = {
        hide: `Marked ${updatedCount} matching toy${updatedCount === 1 ? '' : 's'} as hidden.`,
        mark_for_sale: `Marked ${updatedCount} matching toy${updatedCount === 1 ? '' : 's'} for sale.`,
        delete: `Deleted ${updatedCount} matching toy${updatedCount === 1 ? '' : 's'}.`
      }[action] || `Updated ${updatedCount} matching toy${updatedCount === 1 ? '' : 's'}.`
      setBulkDeleteSuccess(actionSuccess)
      setBulkCriteria(createBulkDeleteCriteria())
      setBulkPreview(null)
      setBulkDeleteError(null)
      await loadCollectionToys()
    } catch (error) {
      setBulkDeleteError('Unable to reach the ToyDB server')
    }

    setBulkDeleteBusy(false)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h2 className="text-xl font-bold">Manage</h2>
        <p className="mt-1 text-sm text-toydb-slate">Import, export, and delete collection data.</p>
      </div>

      <div className="space-y-4 border border-toydb-border bg-toydb-white p-4 shadow-sm">
        <div><h3 className="font-bold text-toydb-navy">Import / Export Toys</h3></div>
        {importError && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{importError}</div>}
        {importResult && (
          <div className="space-y-1 bg-toydb-teal-pale p-3 text-toydb-teal-dark">
            <div>Imported {importResult.imported} toy{importResult.imported === 1 ? '' : 's'}.</div>
            {importWarningCount > 0 && (
              <div className="text-sm font-medium">Skipped {importWarningCount} row{importWarningCount === 1 ? '' : 's'} during import.</div>
            )}
            {importResult.errors?.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {importResult.errors.map((e, index) => <li key={index}>Row {e.row}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}

        <div className="space-y-3 rounded-lg border border-toydb-border bg-toydb-cream p-3">
          <div className="text-sm font-medium text-toydb-navy">Template for new toys only</div>
          <div className="text-sm text-toydb-slate">Use this when you are adding brand-new toys to your collection. The template does not include id or copy columns.</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={downloadTemplate} disabled={templateBusy} className="w-full rounded-lg border border-toydb-border bg-toydb-white p-2 text-toydb-navy hover:bg-toydb-cream sm:w-auto">
              {templateBusy ? 'Downloading...' : 'Download template'}
            </button>
          </div>
          <p className="text-xs text-toydb-slate">
            Duplicate toys are skipped in this mode. The template includes supports for <span className="font-semibold">accessories</span> and <span className="font-semibold">owned_accessories</span> with pipe, comma, or semicolon-separated values, for example: <span className="font-mono">Instruction Manual|Display Stand</span>.
          </p>
          <form onSubmit={importCsv} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="file" accept=".csv,text/csv" onChange={event => setImportFile(event.target.files?.[0] || null)} className="flex-1" />
            <button type="submit" disabled={!importFile || importBusy} className="rounded-lg bg-toydb-orange p-2 font-medium text-toydb-white hover:bg-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">
              {importBusy ? 'Importing...' : 'Import template CSV'}
            </button>
          </form>
        </div>

        <div className="space-y-3 rounded-lg border border-toydb-border bg-toydb-cream p-3">
          <div className="text-sm font-medium text-toydb-navy">Exported collection CSV for editing and re-import</div>
          <div className="text-sm text-toydb-slate">Use this when you want to update existing toys or import a collection export. This format includes id and copy, and existing ids are updated in place; new rows without an existing id are added automatically.</div>

          <div className="text-sm font-medium text-toydb-navy">
            {getFilteredExportToys(getExportCriteriaPayload()).length} record{getFilteredExportToys(getExportCriteriaPayload()).length === 1 ? '' : 's'} in scope
          </div>

          <div className="space-y-3 rounded-lg border border-toydb-border bg-toydb-white p-3">
            <div className="text-sm font-medium text-toydb-navy">Optional export filters</div>
            {exportCriteria.length > 0 && (
              <div className="space-y-3">
                {exportCriteria.map((row, index) => {
                  const values = getAllowedExportValues(row.field, index)
                  const safeValue = values.includes(row.value) ? row.value : ''
                  const rowCriteria = exportCriteria.slice(0, index + 1).filter(item => item.field && String(item.value ?? '').trim())
                  const remainingMatches = getFilteredExportToys(rowCriteria).length
                  const hasValue = Boolean(row.value && String(row.value).trim())

                  return (
                    <div key={row.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                      <Field label={`Field ${index + 1}`}>
                        <select value={row.field} onChange={event => updateExportRow(row.id, { field: event.target.value, value: '' })} className="w-full rounded-lg border border-toydb-border p-2">
                          <option value="toyline">Toyline</option>
                          <option value="manufacturer">Manufacturer</option>
                          <option value="release">Release</option>
                          <option value="faction">Faction</option>
                          <option value="series">Series</option>
                          <option value="sub_series">Sub-Series</option>
                          <option value="theme">Theme</option>
                          <option value="condition">Condition</option>
                          <option value="year">Year</option>
                        </select>
                      </Field>
                      <Field label="Value">
                        <select value={safeValue} onChange={event => updateExportRow(row.id, { value: event.target.value })} className="w-full rounded-lg border border-toydb-border p-2" disabled={!values.length || bulkCollectionLoading}>
                          <option value="">Select a value</option>
                          {values.map(value => <option key={String(value)} value={value}>{String(value)}</option>)}
                        </select>
                      </Field>
                      <button type="button" onClick={() => { setExportCriteria(current => current.filter(item => item.id !== row.id)); setExportPreview(null) }} disabled={!hasValue} className="rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy disabled:cursor-not-allowed disabled:opacity-40">
                        Remove
                      </button>
                      <div className="sm:col-span-3 text-xs text-toydb-slate">
                        {rowCriteria.length ? `${remainingMatches} record${remainingMatches === 1 ? '' : 's'} in this scope` : 'Choose a value to narrow the selected records'}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button type="button" onClick={addExportRow} className="w-full rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">
              + Add filter
            </button>
          </div>

          <button type="button" onClick={resetExportCriteria} className="w-full rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">
            Reset
          </button>

          <button type="button" onClick={previewExportMatches} className="w-full rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">
            Preview export
          </button>

          {exportPreview && (
            <div className="rounded-lg border border-toydb-border bg-toydb-cream p-3">
              <div className="mb-2 text-sm font-medium text-toydb-navy">{exportPreview.total} record{exportPreview.total === 1 ? '' : 's'} will be exported</div>
              <ul className="max-h-52 space-y-1 overflow-auto text-sm text-toydb-slate">
                {exportPreview.matches.length === 0 && <li>No matches found.</li>}
                {exportPreview.matches.map(toy => (
                  <li key={toy.id} className="border-b border-toydb-border pb-1 last:border-b-0 last:pb-0">
                    {toy.name || 'Unnamed toy'}
                    {toy.manufacturer ? ` • ${toy.manufacturer}` : ''}
                    {toy.release ? ` • ${toy.release}` : ''}
                    {toy.faction ? ` • ${toy.faction}` : ''}
                    {toy.year ? ` • ${toy.year}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button type="button" onClick={exportCollectionCsv} disabled={templateBusy} className="w-full rounded-lg bg-toydb-teal p-2 font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">
            {templateBusy ? 'Exporting...' : 'Export collection CSV'}
          </button>
        </div>

        <div className="space-y-3 rounded-lg border border-toydb-border bg-toydb-cream p-3">
          <div className="text-sm font-medium text-toydb-navy">Import edited/exported collection CSV</div>
          <div className="text-sm text-toydb-slate">This format includes id and copy columns so existing toys can be updated in place and duplicate copy records can be created when needed.</div>
          <form onSubmit={importCsv} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input type="file" accept=".csv,text/csv" onChange={event => setImportFile(event.target.files?.[0] || null)} className="flex-1" />
            <button type="submit" disabled={!importFile || importBusy} className="rounded-lg bg-toydb-orange p-2 font-medium text-toydb-white hover:bg-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">
              {importBusy ? 'Importing...' : 'Import edited CSV'}
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4 border border-toydb-danger/60 bg-toydb-white p-4 shadow-sm">
        <div>
          <h3 className="font-bold text-toydb-danger">Danger Zone</h3>
          <p className="mt-1 text-sm text-toydb-slate">Bulk update toys in your collection using one or more field/value matches.</p>
        </div>
        {bulkDeleteError && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{bulkDeleteError}</div>}
        {bulkDeleteSuccess && <div className="bg-toydb-teal-pale p-3 text-toydb-teal-dark">{bulkDeleteSuccess}</div>}

        <div className="space-y-3">
          {bulkCriteria.map((row, index) => {
            const values = getAllowedBulkValues(row.field, index)
            const safeValue = values.includes(row.value) ? row.value : ''
            const rowCriteria = bulkCriteria.slice(0, index + 1).filter(item => item.field && String(item.value ?? '').trim())
            const remainingMatches = getFilteredBulkToys(rowCriteria).length

            return (
              <div key={row.id} className="grid gap-3 rounded-lg border border-toydb-border bg-toydb-cream p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label={`Field ${index + 1}`}>
                  <select value={row.field} onChange={event => updateBulkRow(row.id, { field: event.target.value, value: '' })} className="w-full rounded-lg border border-toydb-border p-2">
                    <option value="toyline">Toyline</option>
                    <option value="manufacturer">Manufacturer</option>
                    <option value="release">Release</option>
                    <option value="faction">Faction</option>
                    <option value="series">Series</option>
                    <option value="sub_series">Sub-Series</option>
                    <option value="theme">Theme</option>
                    <option value="type">Type</option>
                    <option value="condition">Condition</option>
                    <option value="year">Year</option>
                  </select>
                </Field>
                <Field label="Value">
                  <select value={safeValue} onChange={event => updateBulkRow(row.id, { value: event.target.value })} className="w-full rounded-lg border border-toydb-border p-2" disabled={!values.length || bulkCollectionLoading}>
                    <option value="">Select a value</option>
                    {values.map(value => <option key={String(value)} value={value}>{String(value)}</option>)}
                  </select>
                </Field>
                <button type="button" onClick={() => removeBulkRow(row.id)} disabled={bulkCriteria.length === 1} className="rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy disabled:cursor-not-allowed disabled:opacity-40">
                  Remove
                </button>
                <div className="sm:col-span-3 text-xs text-toydb-slate">
                  {rowCriteria.length ? `${remainingMatches} record${remainingMatches === 1 ? '' : 's'} remaining in this scope` : 'Choose a value to narrow the remaining records'}
                </div>
              </div>
            )
          })}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={addBulkRow} className="w-full rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">
              + Add another filter
            </button>
            <button type="button" onClick={resetBulkDeleteState} className="w-full rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">
              Reset
            </button>
          </div>
        </div>

        <button type="button" onClick={() => previewBulkAction('delete')} disabled={bulkPreviewBusy || !getBulkCriteriaPayload().length} className="w-full rounded-lg border border-toydb-border bg-toydb-white p-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream disabled:cursor-not-allowed disabled:opacity-60">
          {bulkPreviewBusy ? 'Previewing...' : 'Preview matches'}
        </button>

        {bulkPreview && (
          <div className="rounded-lg border border-toydb-border bg-toydb-cream p-3">
            <div className="mb-2 text-sm font-medium text-toydb-navy">
              {bulkPreview.total} record{bulkPreview.total === 1 ? '' : 's'} will be affected
            </div>
            <ul className="max-h-52 space-y-1 overflow-auto text-sm text-toydb-slate">
              {bulkPreview.matches.length === 0 && <li>No matches found.</li>}
              {bulkPreview.matches.map(toy => (
                <li key={toy.id} className="border-b border-toydb-border pb-1 last:border-b-0 last:pb-0">
                  {toy.name || 'Unnamed toy'}
                  {toy.manufacturer ? ` • ${toy.manufacturer}` : ''}
                  {toy.year ? ` • ${toy.year}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => bulkApplyAction('hide')} disabled={!canApplyBulkAction} className="w-full rounded-lg border border-toydb-teal bg-toydb-teal p-2 font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">
              {bulkDeleteBusy ? 'Hiding...' : 'Mark as Hidden'}
            </button>
            <button type="button" onClick={() => bulkApplyAction('mark_for_sale')} disabled={!canApplyBulkAction} className="w-full rounded-lg border border-toydb-orange bg-toydb-orange p-2 font-medium text-toydb-white hover:bg-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">
              {bulkDeleteBusy ? 'Updating...' : 'Mark for Sale'}
            </button>
          </div>

          <button type="button" onClick={() => bulkApplyAction('delete')} disabled={!canApplyBulkAction} className="w-full rounded-lg border border-toydb-danger bg-toydb-danger p-2 font-bold text-toydb-white hover:bg-toydb-danger/90 disabled:cursor-not-allowed disabled:opacity-60">
            {bulkDeleteBusy ? 'Deleting...' : 'Delete Matching Toys (Dangerous)'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }){
  return <div><label className="mb-1 block text-sm font-medium text-toydb-navy">{label}</label>{children}</div>
}
