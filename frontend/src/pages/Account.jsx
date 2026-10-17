import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Account(){
  const navigate = useNavigate()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shareTargetUserId, setShareTargetUserId] = useState('')
  const [shareUsers, setShareUsers] = useState([])
  const [sharedCollections, setSharedCollections] = useState([])
  const [shareBusy, setShareBusy] = useState(false)
  const [shareError, setShareError] = useState(null)
  const [shareSuccess, setShareSuccess] = useState(null)

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

  async function loadShareOptions(){
    try {
      const token = await getToken()
      if (!token) return
      const [usersResponse, sharesResponse] = await Promise.all([
        fetch(import.meta.env.VITE_API_BASE + '/auth/users', { headers: { Authorization: 'Bearer ' + token } }),
        fetch(import.meta.env.VITE_API_BASE + '/auth/collection-shares', { headers: { Authorization: 'Bearer ' + token } })
      ])
      const usersData = await usersResponse.json()
      const sharesData = await sharesResponse.json()
      if (usersResponse.ok) setShareUsers(usersData.users || [])
      if (sharesResponse.ok) setSharedCollections(sharesData.shares || [])
    } catch (error) {
      setShareError('Unable to load users for sharing.')
    }
  }

  async function addCollectionShare(event){
    event.preventDefault(); setShareError(null); setShareSuccess(null)
    if (!shareTargetUserId) { setShareError('Choose a user to share with.'); return }
    setShareBusy(true)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/collection-shares', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ viewerUserId: Number(shareTargetUserId) })
      })
      const data = await response.json()
      if (!response.ok) { setShareError(data.error || 'Unable to share collection'); setShareBusy(false); return }
      setShareSuccess(`Your collection is now shared with ${data.share.username}.`)
      setShareTargetUserId('')
      await loadShareOptions()
    } catch (error) {
      setShareError('Unable to reach the ToyDB server')
    }
    setShareBusy(false)
  }

  async function removeCollectionShare(viewerUserId){
    setShareError(null); setShareSuccess(null)
    try {
      const token = await getToken()
      if (!token) { navigate('/'); return }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/collection-shares/' + viewerUserId, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) { setShareError(data.error || 'Unable to remove access'); return }
      setShareSuccess('Collection access removed.')
      await loadShareOptions()
    } catch (error) {
      setShareError('Unable to reach the ToyDB server')
    }
  }

  useEffect(() => {
    loadShareOptions()
  }, [navigate])

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h2 className="text-xl font-bold">Account</h2>
        <p className="mt-1 text-sm text-toydb-slate">Change your password and manage collection access.</p>
      </div>

      <form onSubmit={submit} className="space-y-4 border border-toydb-border bg-toydb-white p-4 shadow-sm">
        {error && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{error}</div>}
        {success && <div className="bg-toydb-teal-pale p-3 text-toydb-teal-dark">Password changed. Other signed-in sessions have been ended.</div>}
        <Field label="Current password"><input value={oldPassword} onChange={event => setOldPassword(event.target.value)} type="password" autoComplete="current-password" required className="w-full p-2 border rounded" /></Field>
        <Field label="New password"><input value={newPassword} onChange={event => setNewPassword(event.target.value)} type="password" autoComplete="new-password" required className="w-full p-2 border rounded" /></Field>
        <Field label="Retype new password"><input value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} type="password" autoComplete="new-password" required className="w-full p-2 border rounded" /></Field>
        <p className="text-xs text-toydb-slate">Use at least 12 characters, including uppercase and lowercase letters, a number, and a symbol.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => navigate('/dashboard')} className="rounded-lg border border-toydb-border bg-toydb-white p-2 text-toydb-navy" disabled={busy}>Cancel</button>
          <button type="submit" className="rounded-lg bg-toydb-teal p-2 font-medium text-toydb-white hover:bg-toydb-teal-dark" disabled={busy}>{busy ? 'Changing...' : 'Change password'}</button>
        </div>
      </form>

      <div className="space-y-4 border border-toydb-border bg-toydb-white p-4 shadow-sm">
        <div>
          <h3 className="font-bold text-toydb-navy">Share your collection</h3>
          <p className="mt-1 text-sm text-toydb-slate">Give another user read-only access to your collection.</p>
        </div>
        {shareError && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{shareError}</div>}
        {shareSuccess && <div className="bg-toydb-teal-pale p-3 text-toydb-teal-dark">{shareSuccess}</div>}
        <form onSubmit={addCollectionShare} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="Share with">
            <select value={shareTargetUserId} onChange={event => setShareTargetUserId(event.target.value)} className="w-full rounded-lg border border-toydb-border p-2">
              <option value="">Choose a user</option>
              {shareUsers.map(user => (
                <option key={user.id} value={user.id}>{user.username || user.email}</option>
              ))}
            </select>
          </Field>
          <button type="submit" disabled={shareBusy || !shareTargetUserId} className="rounded-lg bg-toydb-teal p-2 font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">
            {shareBusy ? 'Adding...' : 'Grant access'}
          </button>
        </form>
        <div className="space-y-2">
          {sharedCollections.length === 0 && <div className="text-sm text-toydb-slate">No shared collection access yet.</div>}
          {sharedCollections.map(share => (
            <div key={share.viewerUserId} className="flex items-center justify-between rounded-lg border border-toydb-border bg-toydb-cream p-2 text-sm">
              <span>{share.username || share.email}</span>
              <button type="button" onClick={() => removeCollectionShare(share.viewerUserId)} className="text-toydb-danger hover:text-toydb-orange-dark">Remove</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }){
  return <div><label className="mb-1 block text-sm font-medium text-toydb-navy">{label}</label>{children}</div>
}
