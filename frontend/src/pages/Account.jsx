import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Account(){
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [templateBusy, setTemplateBusy] = useState(false)

  async function getToken(){
    const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
    return (await refresh.json()).accessToken
  }

  async function submit(event){
    event.preventDefault(); setError(null); setSuccess(false)
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return }
    setBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/change-password', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ oldPassword, newPassword, confirmPassword })
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Unable to change password'); return }
      setOldPassword(''); setNewPassword(''); setConfirmPassword(''); setSuccess(true)
    } catch (error) { setError('Unable to reach the ToyDB server') }
    setBusy(false)
  }

  async function downloadTemplate(){
    setImportError(null); setTemplateBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/import/template', { headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) { setImportError('Unable to download template'); setTemplateBusy(false); return }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'toydb-import-template.csv'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) { setImportError('Unable to reach the ToyDB server') }
    setTemplateBusy(false)
  }

  async function importCsv(event){
    event.preventDefault(); setImportError(null); setImportResult(null)
    if (!importFile) { setImportError('Choose a CSV file to import'); return }
    setImportBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const data = new FormData()
      data.append('file', importFile)
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/import', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: data })
      const result = await response.json()
      if (!response.ok) { setImportError(result.error || 'Import failed'); setImportBusy(false); return }
      setImportResult(result)
      setImportFile(null)
      event.target.reset()
    } catch (error) { setImportError('Unable to reach the ToyDB server') }
    setImportBusy(false)
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div><h2 className="text-xl font-bold">Account</h2><p className="mt-1 text-sm text-toydb-slate">Change your password.</p></div>
      <form onSubmit={submit} className="space-y-4 border border-toydb-border bg-toydb-white p-4 shadow-sm">
        {error && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{error}</div>}
        {success && <div className="bg-toydb-teal-pale p-3 text-toydb-teal-dark">Password changed. Other signed-in sessions have been ended.</div>}
        <Field label="Current password"><input value={oldPassword} onChange={event => setOldPassword(event.target.value)} type="password" autoComplete="current-password" required className="w-full p-2 border rounded" /></Field>
        <Field label="New password"><input value={newPassword} onChange={event => setNewPassword(event.target.value)} type="password" autoComplete="new-password" required className="w-full p-2 border rounded" /></Field>
        <Field label="Retype new password"><input value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" required className="w-full p-2 border rounded" /></Field>
        <p className="text-xs text-toydb-slate">Use at least 12 characters, including uppercase and lowercase letters, a number, and a symbol.</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => navigate('/dashboard')} className="border border-toydb-border bg-toydb-white p-2 text-toydb-navy rounded-lg" disabled={busy}>Cancel</button><button type="submit" className="bg-toydb-teal p-2 font-medium text-toydb-white rounded-lg hover:bg-toydb-teal-dark" disabled={busy}>{busy ? 'Changing...' : 'Change password'}</button></div>
      </form>

      <div className="space-y-4 border border-toydb-border bg-toydb-white p-4 shadow-sm">
        <div><h3 className="font-bold text-toydb-navy">Import Toys</h3><p className="mt-1 text-sm text-toydb-slate">Bulk add toys to your collection from a CSV file.</p></div>
        {importError && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{importError}</div>}
        {importResult && (
          <div className="bg-toydb-teal-pale p-3 text-toydb-teal-dark space-y-1">
            <div>Imported {importResult.imported} toy{importResult.imported === 1 ? '' : 's'}.</div>
            {importResult.errors?.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {importResult.errors.map((e, index) => <li key={index}>Row {e.row}: {e.error}</li>)}
              </ul>
            )}
          </div>
        )}
        <button type="button" onClick={downloadTemplate} disabled={templateBusy} className="border border-toydb-border bg-toydb-white p-2 text-toydb-navy rounded-lg">{templateBusy ? 'Downloading...' : 'Download CSV template'}</button>
        <form onSubmit={importCsv} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="file" accept=".csv,text/csv" onChange={event => setImportFile(event.target.files?.[0] || null)} className="flex-1" />
          <button type="submit" disabled={importBusy} className="bg-toydb-orange p-2 font-medium text-toydb-white rounded-lg hover:bg-toydb-orange-dark">{importBusy ? 'Importing...' : 'Import CSV'}</button>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children }){
  return <div><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}