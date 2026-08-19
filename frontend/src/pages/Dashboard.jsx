import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ToyCard from '../components/ToyCard'
import ToyForm from '../components/ToyForm'

export default function Dashboard(){
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [toys, setToys] = useState([])
  const [grouping, setGrouping] = useState('toyline')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const loc = useLocation()
  const navigate = useNavigate()
  const accessToken = loc.state?.accessToken || null

  async function loadUserAndToys(){
    setLoading(true); setError(null)
    let token = accessToken
    if (!token){
      const r = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const data = await r.json()
      if (data.accessToken) token = data.accessToken
    }
    if (!token) return navigate('/')
    try{
      const [uRes, tRes] = await Promise.all([
        fetch(import.meta.env.VITE_API_BASE + '/dashboard', { headers: { Authorization: 'Bearer ' + token } }),
        fetch(import.meta.env.VITE_API_BASE + '/toys', { headers: { Authorization: 'Bearer ' + token } })
      ])
      const uData = await uRes.json()
      if (!uRes.ok) { setError(uData.error || 'Failed to load user'); setLoading(false); return }
      setUser(uData.user)
      const tData = await tRes.json()
      if (!tRes.ok) { setError(tData.error || 'Failed to load toys'); setToys([]); setLoading(false); return }
      setToys(tData.toys || [])
      setLoading(false)
    } catch (err){ setError('Server error'); setLoading(false) }
  }

  const location = useLocation()
  useEffect(()=>{ loadUserAndToys() }, [])
  useEffect(()=>{
    if (location?.state?.refresh) loadUserAndToys()
  }, [location?.state?.refresh])

  function onCreated(){ setShowForm(false); loadUserAndToys() }
  function onUpdated(){ loadUserAndToys() }
  function onDeleted(){ loadUserAndToys() }

  const groupings = {
    toyline: { label: 'Toylines', field: 'toyline' },
    manufacturer: { label: 'Manufacturers', field: 'manufacturer' },
    year: { label: 'Years', field: 'year' }
  }
  const activeGrouping = groupings[grouping]
  const groups = toys.reduce((result, toy) => {
    const value = toy[activeGrouping.field]
    const name = value !== null && value !== undefined && String(value).trim() ? String(value).trim() : 'Uncategorized'
    if (!result[name]) result[name] = []
    result[name].push(toy)
    return result
  }, {})
  const selectedToys = selectedGroup ? groups[selectedGroup] || [] : []

  function changeGrouping(nextGrouping){
    setGrouping(nextGrouping)
    setSelectedGroup(null)
  }

  if (error) return <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>
  if (!user) return <div className="text-toydb-slate">Loading...</div>

  return (
    <div className="space-y-4">
      <h3 className="text-md font-bold">My Collection</h3>
      <nav className="flex gap-4 border-b border-toydb-border text-sm" aria-label="Collection views">
        {Object.entries(groupings).map(([key, view]) => (
          <button
            key={key}
            type="button"
            onClick={() => changeGrouping(key)}
            className={`pb-2 ${grouping === key ? 'border-b-2 border-toydb-teal font-medium text-toydb-teal-dark' : 'text-toydb-slate hover:text-toydb-teal-dark'}`}
          >
            {view.label}
          </button>
        ))}
      </nav>
      {loading && <div>Loading toys...</div>}
      {!loading && toys.length === 0 && <div className="text-sm text-toydb-slate">No toys yet. Use "Add Toy" in the header to add your first item.</div>}
      {!loading && toys.length > 0 && !selectedGroup && (
        <div className="divide-y divide-toydb-border border border-toydb-border rounded-xl overflow-hidden bg-toydb-white shadow-sm">
          {Object.entries(groups).sort(([a], [b]) => {
            if (grouping === 'year' && a !== 'Uncategorized' && b !== 'Uncategorized') return Number(b) - Number(a)
            if (a === 'Uncategorized') return 1
            if (b === 'Uncategorized') return -1
            return a.localeCompare(b)
          }).map(([groupName, groupToys]) => (
            <button
              key={groupName}
              type="button"
              onClick={() => setSelectedGroup(groupName)}
              className="w-full flex items-center justify-between gap-4 p-3 text-left border border-toydb-teal bg-toydb-teal text-toydb-white hover:bg-toydb-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal"
            >
              <span className="font-bold">{groupName}</span>
              <span className="text-sm text-toydb-white">{groupToys.length} {groupToys.length === 1 ? 'toy' : 'toys'}</span>
            </button>
          ))}
        </div>
      )}
      {!loading && selectedGroup && (
        <div className="space-y-4">
          <button type="button" onClick={() => setSelectedGroup(null)} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">
            &larr; Back to {activeGrouping.label.toLowerCase()}
          </button>
          <h4 className="text-lg font-bold">{selectedGroup} ({selectedToys.length})</h4>
          <div className="grid grid-cols-1 gap-4">
            {selectedToys.map(t => <ToyCard key={t.id} toy={t} onUpdated={onUpdated} onDeleted={onDeleted} />)}
          </div>
        </div>
      )}
      <footer className="border-t border-toydb-border pt-4 mt-8 text-center">
        <div className="text-sm font-bold">Welcome, {user.email}</div>
        <div className="text-xs text-toydb-slate">Member since: {new Date(user.createdAt).toLocaleString()}</div>
      </footer>
    </div>
  )
}
