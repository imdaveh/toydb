import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function AdminUsers(){
  const location = useLocation()
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(location.state?.accessToken || null)
  const [users, setUsers] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)

  async function getToken(){
    if (accessToken) return accessToken
    const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
    const data = await response.json()
    if (!response.ok || !data.accessToken) return null
    setAccessToken(data.accessToken)
    return data.accessToken
  }

  async function loadUsers(){
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/users', { headers: { Authorization: 'Bearer ' + token } })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Unable to load users')
        setLoading(false)
        return
      }
      setUsers(data.users || [])
    } catch (err) {
      setError('Unable to reach the ToyDB server.')
    }
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function setEnabled(user, enabled){
    setUpdatingId(user.id)
    setError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/users/' + user.id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      const data = await response.json()
      if (!response.ok) setError(data.error || 'Unable to update user')
      else await loadUsers()
    } catch (err) {
      setError('Unable to reach the ToyDB server.')
    }
    setUpdatingId(null)
  }

  async function deleteUser(user){
    if (!window.confirm(`Delete ${user.email}? This also deletes their toys and cannot be undone.`)) return
    setUpdatingId(user.id)
    setError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/users/' + user.id, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) setError(data.error || 'Unable to delete user')
      else await loadUsers()
    } catch (err) {
      setError('Unable to reach the ToyDB server.')
    }
    setUpdatingId(null)
  }

  const pendingUsers = users.filter(user => !user.enabled)
  const enabledUsers = users.filter(user => user.enabled)

  function userRow(user){
    const isUpdating = updatingId === user.id
    return <li key={user.id} className="flex flex-col gap-3 border border-toydb-border bg-toydb-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-medium text-toydb-navy">{user.email}</div>
        <div className="mt-1 text-xs text-toydb-slate">Requested {new Date(user.createdAt).toLocaleString()}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={isUpdating} onClick={() => setEnabled(user, !user.enabled)} className={user.enabled ? 'border border-toydb-orange px-3 py-2 text-sm font-medium text-toydb-orange-dark hover:bg-toydb-orange-pale' : 'bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white hover:bg-toydb-teal-dark'}>{user.enabled ? 'Disable' : 'Approve'}</button>
        <button type="button" disabled={isUpdating} onClick={() => deleteUser(user)} className="border border-toydb-danger px-3 py-2 text-sm font-medium text-toydb-danger hover:bg-toydb-danger-pale">Delete</button>
      </div>
    </li>
  }

  return <div className="space-y-6">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-toydb-navy">Member review</h2>
        <p className="mt-1 text-sm text-toydb-slate">Approve requests and manage member access.</p>
      </div>
      <Link to="/dashboard" className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Back to collection</Link>
    </div>
    {error && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{error}</div>}
    {loading ? <div className="text-toydb-slate">Loading members...</div> : <>
      <section>
        <h3 className="mb-3 text-lg font-bold text-toydb-navy">Pending requests ({pendingUsers.length})</h3>
        {pendingUsers.length ? <ul className="space-y-2">{pendingUsers.map(userRow)}</ul> : <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No pending requests.</div>}
      </section>
      <section>
        <h3 className="mb-3 text-lg font-bold text-toydb-navy">Enabled members ({enabledUsers.length})</h3>
        {enabledUsers.length ? <ul className="space-y-2">{enabledUsers.map(userRow)}</ul> : <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No enabled members.</div>}
      </section>
    </>}
  </div>
}