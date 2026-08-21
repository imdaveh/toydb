import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ToyCard from '../components/ToyCard'

export default function Dashboard({ wishlist = false }){
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [toys, setToys] = useState([])
  const [grouping, setGrouping] = useState('toyline')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState('condition')
  const [filterValue, setFilterValue] = useState('')
  const [appliedFilter, setAppliedFilter] = useState(null)
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
        fetch(import.meta.env.VITE_API_BASE + '/toys?wishlist=' + wishlist, { headers: { Authorization: 'Bearer ' + token } })
      ])
      const uData = await uRes.json()
      if (!uRes.ok) { setError(uData.error || 'Failed to load user'); setLoading(false); return }
      setUser(uData.user)
      const tData = await tRes.json()
      if (!tRes.ok) { setError(tData.error || 'Failed to load toys'); setToys([]); setLoading(false); return }
      const isWishlistToy = toy => toy.is_wishlist === true || toy.is_wishlist === 1 || toy.is_wishlist === '1' || toy.is_wishlist === 'true'
      setToys((tData.toys || []).filter(toy => isWishlistToy(toy) === wishlist))
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
  const filterFields = {
    condition: 'Condition',
    manufacturer: 'Manufacturer',
    year: 'Year',
    series: 'Series',
    sub_series: 'Sub-Series'
  }
  const filterValues = [...new Set(selectedToys.map(toy => toy[filterField]).filter(value => value !== null && value !== undefined && String(value).trim()).map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const filteredToys = appliedFilter ? selectedToys.filter(toy => String(toy[appliedFilter.field] || '') === appliedFilter.value) : selectedToys

  function changeGrouping(nextGrouping){
    setGrouping(nextGrouping)
    setSelectedGroup(null)
    setFilterOpen(false)
    setAppliedFilter(null)
  }

  function selectGroup(groupName){
    setSelectedGroup(groupName)
    setFilterOpen(false)
    setAppliedFilter(null)
  }

  function applyFilter(){
    if (!filterValue) return
    setAppliedFilter({ field: filterField, value: filterValue })
    setFilterOpen(false)
  }

  function changeFilterField(nextField){
    setFilterField(nextField)
    setFilterValue('')
  }

  if (error) return <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>
  if (!user) return <div className="text-toydb-slate">Loading...</div>

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-2xl font-bold tracking-tight text-toydb-navy">{wishlist ? 'My Wishlist' : 'My Collection'}</h3>
          <p className="mt-1 text-sm text-toydb-slate">{wishlist ? 'Keep track of the toys you want to find.' : 'Keep every favorite in one place.'}</p>
        </div>
        <Link to={wishlist ? '/wishlist/add' : '/add'} className="rounded-lg bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white shadow-sm hover:bg-toydb-teal-dark">{wishlist ? '+ Add Wishlist Toy' : '+ Add Collection Toy'}</Link>
      </section>

      {!wishlist && <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Collection summary">
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
      </section>}

      {!wishlist && <nav className="flex gap-5 border-b-2 border-toydb-border text-sm" aria-label="Collection views">
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
      </nav>}
      {loading && <div>Loading toys...</div>}
      {!loading && toys.length === 0 && <div className="border border-dashed border-toydb-teal bg-toydb-teal-pale p-6 text-sm text-toydb-teal-dark">{wishlist ? 'No wishlist toys yet. Use "+ Add Wishlist Toy" above to add your first item.' : 'No toys yet. Use "+ Add Toy" above to add your first item.'}</div>}
      {!loading && wishlist && toys.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {toys.map(toy => <ToyCard key={toy.id} toy={toy} allowDelete onDeleted={onDeleted} />)}
        </div>
      )}
      {!loading && !wishlist && toys.length > 0 && !selectedGroup && (
        <div className="grid gap-3">
          {Object.entries(groups).sort(([a], [b]) => {
            if (b === 'Uncategorized') return -1
            return a.localeCompare(b)
          }).map(([groupName, groupToys]) => (
            <button
              key={groupName}
              type="button"
              onClick={() => selectGroup(groupName)}
              className="group w-full flex items-center justify-between gap-4 border border-toydb-border border-l-4 border-l-toydb-teal bg-toydb-white p-4 text-left shadow-sm hover:-translate-y-0.5 hover:border-toydb-teal hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal"
            >
              <span className="font-bold text-toydb-navy group-hover:text-toydb-teal-dark">{groupName}</span>
              <span className="rounded-full bg-toydb-teal-pale px-3 py-1 text-sm font-medium text-toydb-teal-dark">{groupToys.length} {groupToys.length === 1 ? 'toy' : 'toys'} &rarr;</span>
            </button>
          ))}
        </div>
      )}
      {!loading && !wishlist && selectedGroup && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" onClick={() => { setSelectedGroup(null); setFilterOpen(false); setAppliedFilter(null) }} className="rounded-lg border border-toydb-teal bg-toydb-teal-pale px-3 py-2 text-sm font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white">
              &larr; Back to {activeGrouping.label.toLowerCase()}
            </button>
            <button type="button" onClick={() => setFilterOpen(open => !open)} className="rounded-lg border border-toydb-orange bg-toydb-orange-pale px-3 py-2 text-sm font-medium text-toydb-orange-dark hover:bg-toydb-orange hover:text-toydb-white">
              Filter: {appliedFilter ? filterFields[appliedFilter.field] : 'None'}
            </button>
          </div>
          {filterOpen && <div className="grid gap-3 border border-toydb-border bg-toydb-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm font-medium text-toydb-navy">Filter by<select value={filterField} onChange={event => changeFilterField(event.target.value)} className="mt-1 w-full p-2"><option value="condition">Condition</option><option value="manufacturer">Manufacturer</option><option value="year">Year</option><option value="series">Series</option><option value="sub_series">Sub-Series</option></select></label>
            <label className="block text-sm font-medium text-toydb-navy">Value<select value={filterValue} onChange={event => setFilterValue(event.target.value)} className="mt-1 w-full p-2"><option value="">Select a value</option>{filterValues.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <div className="flex gap-2"><button type="button" onClick={applyFilter} disabled={!filterValue} className="bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">Apply</button>{appliedFilter && <button type="button" onClick={() => { setAppliedFilter(null); setFilterValue(''); setFilterOpen(false) }} className="border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">Clear</button>}</div>
          </div>}
          <h4 className="text-xl font-bold text-toydb-navy">{selectedGroup} <span className="text-toydb-teal-dark">({filteredToys.length})</span></h4>
          {appliedFilter && <div className="flex items-center justify-between gap-3 text-sm text-toydb-slate"><span>{filterFields[appliedFilter.field]}: {appliedFilter.value}</span><button type="button" onClick={() => setAppliedFilter(null)} className="font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Clear filter</button></div>}
          <div className="grid grid-cols-1 gap-4">
            {filteredToys.map(t => <ToyCard key={t.id} toy={t} onUpdated={onUpdated} onDeleted={onDeleted} />)}
          </div>
          {filteredToys.length === 0 && <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No toys match this filter.</div>}
        </div>
      )}
      <footer className="border-t border-toydb-border pt-5 text-center">
        <div className="text-sm font-bold">Welcome, {user.email}</div>
        <div className="text-xs text-toydb-slate">Member since: {new Date(user.createdAt).toLocaleString()}</div>
      </footer>
    </div>
  )
}
