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

  async function submit(event){
    event.preventDefault(); setError(null); setSuccess(false)
    if (newPassword !== confirmPassword) { setError('New passwords do not match'); return }
    setBusy(true)
    try {
      const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const token = (await refresh.json()).accessToken
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
    </div>
  )
}

function Field({ label, children }){
  return <div><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}