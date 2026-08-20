import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ToyCard from '../components/ToyCard'

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
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-toydb-navy">My Collection</h3>
          <p className="mt-1 text-sm text-toydb-slate">Keep every favorite in one place.</p>
        </div>
        {user.isAdmin && <Link to="/admin/users" state={{ accessToken }} className="self-start border border-toydb-teal bg-toydb-teal-pale px-3 py-2 text-sm font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white sm:self-auto">Review members</Link>}
      </section>

      <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Collection summary">
        <div className="border-l-4 border-toydb-teal bg-toydb-white px-4 py-3 text-center shadow-sm">
          <div className="text-xl font-bold text-toydb-navy sm:text-2xl">{toys.length}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-toydb-slate sm:text-xs">Toys</div>
        </div>
        <div className="border-l-4 border-toydb-orange bg-toydb-white px-4 py-3 text-center shadow-sm">
          <div className="text-xl font-bold text-toydb-navy sm:text-2xl">{new Set(toys.map(toy => toy.manufacturer).filter(value => value !== null && value !== undefined && String(value).trim())).size}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-toydb-slate sm:text-xs">Manufacturers</div>
        </div>
        <div className="border-l-4 border-toydb-gold bg-toydb-white px-4 py-3 text-center shadow-sm">
          <div className="text-xl font-bold text-toydb-navy sm:text-2xl">{new Set(toys.map(toy => toy.year).filter(value => value !== null && value !== undefined && String(value).trim())).size}</div>
          <div className="text-[10px] font-medium uppercase tracking-wide text-toydb-slate sm:text-xs">Years</div>
        </div>
      </section>

      <nav className="flex gap-5 border-b-2 border-toydb-border text-sm" aria-label="Collection views">
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
      {!loading && toys.length === 0 && <div className="border border-dashed border-toydb-teal bg-toydb-teal-pale p-6 text-sm text-toydb-teal-dark">No toys yet. Use "+ Add Toy" in the header to add your first item.</div>}
      {!loading && toys.length > 0 && !selectedGroup && (
        <div className="grid gap-3">
          {Object.entries(groups).sort(([a], [b]) => {
            if (b === 'Uncategorized') return -1
            return a.localeCompare(b)
          }).map(([groupName, groupToys]) => (
            <button
              key={groupName}
              type="button"
              onClick={() => setSelectedGroup(groupName)}
              className="group w-full flex items-center justify-between gap-4 border border-toydb-border border-l-4 border-l-toydb-teal bg-toydb-white p-4 text-left shadow-sm hover:-translate-y-0.5 hover:border-toydb-teal hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal"
            >
              <span className="font-bold text-toydb-navy group-hover:text-toydb-teal-dark">{groupName}</span>
              <span className="rounded-full bg-toydb-teal-pale px-3 py-1 text-sm font-medium text-toydb-teal-dark">{groupToys.length} {groupToys.length === 1 ? 'toy' : 'toys'} &rarr;</span>
            </button>
          ))}
        </div>
      )}
      {!loading && selectedGroup && (
        <div className="space-y-4">
          <button type="button" onClick={() => setSelectedGroup(null)} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">
            &larr; Back to {activeGrouping.label.toLowerCase()}
          </button>
          <h4 className="text-xl font-bold text-toydb-navy">{selectedGroup} <span className="text-toydb-teal-dark">({selectedToys.length})</span></h4>
          <div className="grid grid-cols-1 gap-4">
            {selectedToys.map(t => <ToyCard key={t.id} toy={t} onUpdated={onUpdated} onDeleted={onDeleted} />)}
          </div>
        </div>
      )}
      <footer className="border-t border-toydb-border pt-5 text-center">
        <div className="text-sm font-bold">Welcome, {user.email}</div>
        <div className="text-xs text-toydb-slate">Member since: {new Date(user.createdAt).toLocaleString()}</div>
      </footer>
    </div>
  )
}
