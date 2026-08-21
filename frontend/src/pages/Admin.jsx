import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Admin(){
  const location = useLocation()
  const navigate = useNavigate()
  const [accessToken, setAccessToken] = useState(location.state?.accessToken || null)
  const [users, setUsers] = useState([])
  const [usersError, setUsersError] = useState(null)
  const [usersLoading, setUsersLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [tags, setTags] = useState([])
  const [tagsError, setTagsError] = useState(null)
  const [tagsLoading, setTagsLoading] = useState(true)
  const [newTagName, setNewTagName] = useState('')
  const [tagsBusy, setTagsBusy] = useState(false)

  async function getToken(){
    if (accessToken) return accessToken
    const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
    const data = await response.json()
    if (!response.ok || !data.accessToken) return null
    setAccessToken(data.accessToken)
    return data.accessToken
  }

  async function loadUsers(){
    setUsersLoading(true)
    setUsersError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/users', { headers: { Authorization: 'Bearer ' + token } })
      const data = await response.json()
      if (!response.ok) {
        setUsersError(data.error || 'Unable to load users')
        setUsersLoading(false)
        return
      }
      setUsers(data.users || [])
    } catch (err) {
      setUsersError('Unable to reach the ToyDB server.')
    }
    setUsersLoading(false)
  }

  async function loadTags(){
    setTagsLoading(true)
    setTagsError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/tags', { headers: { Authorization: 'Bearer ' + token } })
      const data = await response.json()
      if (!response.ok) {
        setTagsError(data.error || 'Unable to load tags')
        setTagsLoading(false)
        return
      }
      setTags(data.tags || [])
    } catch (err) {
      setTagsError('Unable to reach the ToyDB server.')
    }
    setTagsLoading(false)
  }

  useEffect(() => { loadUsers(); loadTags() }, [])

  async function setEnabled(user, enabled){
    setUpdatingId(user.id)
    setUsersError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/users/' + user.id, {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      const data = await response.json()
      if (!response.ok) setUsersError(data.error || 'Unable to update user')
      else await loadUsers()
    } catch (err) {
      setUsersError('Unable to reach the ToyDB server.')
    }
    setUpdatingId(null)
  }

  async function deleteUser(user){
    if (!window.confirm(`Delete ${user.email}? This also deletes their toys and cannot be undone.`)) return
    setUpdatingId(user.id)
    setUsersError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/users/' + user.id, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) setUsersError(data.error || 'Unable to delete user')
      else await loadUsers()
    } catch (err) {
      setUsersError('Unable to reach the ToyDB server.')
    }
    setUpdatingId(null)
  }

  async function addTag(event){
    event.preventDefault()
    const name = newTagName.trim()
    if (!name) return
    setTagsBusy(true)
    setTagsError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/tags', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      })
      const data = await response.json()
      if (!response.ok) setTagsError(data.error || 'Unable to add tag')
      else { setNewTagName(''); await loadTags() }
    } catch (err) {
      setTagsError('Unable to reach the ToyDB server.')
    }
    setTagsBusy(false)
  }

  async function deleteTag(tag){
    if (!window.confirm(`Delete tag "${tag.name}"? This removes it from any toys that have it.`)) return
    setTagsBusy(true)
    setTagsError(null)
    try {
      const token = await getToken()
      if (!token) return navigate('/')
      const response = await fetch(import.meta.env.VITE_API_BASE + '/admin/tags/' + tag.id, {
        method: 'DELETE', headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) setTagsError(data.error || 'Unable to delete tag')
      else await loadTags()
    } catch (err) {
      setTagsError('Unable to reach the ToyDB server.')
    }
    setTagsBusy(false)
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

  return <div className="space-y-8">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-toydb-navy">Admin</h2>
        <p className="mt-1 text-sm text-toydb-slate">Manage members and the shared tag list.</p>
      </div>
      <Link to="/dashboard" className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Back to collection</Link>
    </div>

    <section className="space-y-3">
      <h3 className="text-lg font-bold text-toydb-navy">Member review</h3>
      {usersError && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{usersError}</div>}
      {usersLoading ? <div className="text-toydb-slate">Loading members...</div> : <>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-toydb-slate">Pending requests ({pendingUsers.length})</h4>
          {pendingUsers.length ? <ul className="space-y-2">{pendingUsers.map(userRow)}</ul> : <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No pending requests.</div>}
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-toydb-slate">Enabled members ({enabledUsers.length})</h4>
          {enabledUsers.length ? <ul className="space-y-2">{enabledUsers.map(userRow)}</ul> : <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No enabled members.</div>}
        </div>
      </>}
    </section>

    <section className="space-y-3">
      <h3 className="text-lg font-bold text-toydb-navy">Tags</h3>
      {tagsError && <div className="bg-toydb-danger-pale p-3 text-toydb-danger">{tagsError}</div>}
      <form onSubmit={addTag} className="flex flex-wrap gap-2">
        <input value={newTagName} onChange={event => setNewTagName(event.target.value)} placeholder="New tag name" className="flex-1 min-w-[12rem] rounded-lg border border-toydb-border p-2" />
        <button type="submit" disabled={tagsBusy || !newTagName.trim()} className="bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white rounded-lg hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">Add Tag</button>
      </form>
      {tagsLoading ? <div className="text-toydb-slate">Loading tags...</div> : (
        tags.length ? <ul className="flex flex-wrap gap-2">
          {tags.map(tag => (
            <li key={tag.id} className="flex items-center gap-2 rounded-full bg-toydb-cream px-3 py-1 text-sm text-toydb-navy">
              {tag.name}
              <button type="button" disabled={tagsBusy} onClick={() => deleteTag(tag)} className="text-toydb-danger hover:text-toydb-orange-dark">&times;</button>
            </li>
          ))}
        </ul> : <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No tags yet.</div>
      )}
    </section>
  </div>
}
