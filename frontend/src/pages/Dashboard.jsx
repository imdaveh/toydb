import React, { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import ToyCard from '../components/ToyCard'

export default function Dashboard({ wishlist = false, forSale = false }){
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [toys, setToys] = useState([])
  const [grouping, setGrouping] = useState('toyline')
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterField, setFilterField] = useState('manufacturer')
  const [filterValue, setFilterValue] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [searchField, setSearchField] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [appliedFilters, setAppliedFilters] = useState([])
  const [loading, setLoading] = useState(true)
  const loc = useLocation()
  const navigate = useNavigate()
  const accessToken = loc.state?.accessToken || null

  useEffect(() => {
    if (!loc.state) return
    const nextState = loc.state
    if (typeof nextState.grouping === 'string') setGrouping(nextState.grouping)
    if (nextState.selectedGroup !== undefined) setSelectedGroup(nextState.selectedGroup ?? null)
    if (nextState.filterOpen !== undefined) setFilterOpen(Boolean(nextState.filterOpen))
    if (nextState.filterField) setFilterField(nextState.filterField)
    if (nextState.filterValue !== undefined) setFilterValue(nextState.filterValue || '')
    if (nextState.searchOpen !== undefined) setSearchOpen(Boolean(nextState.searchOpen))
    if (nextState.searchDraft !== undefined) setSearchDraft(nextState.searchDraft || '')
    if (nextState.searchField) setSearchField(nextState.searchField)
    if (nextState.searchQuery !== undefined) setSearchQuery(nextState.searchQuery || '')
    if (nextState.appliedFilters) setAppliedFilters(nextState.appliedFilters)
  }, [loc.state])

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
      const listQuery = forSale ? '?for_sale=true' : wishlist ? '?wishlist=true' : ''
      const [uRes, tRes] = await Promise.all([
        fetch(import.meta.env.VITE_API_BASE + '/dashboard', { headers: { Authorization: 'Bearer ' + token } }),
        fetch(import.meta.env.VITE_API_BASE + '/toys' + listQuery, { headers: { Authorization: 'Bearer ' + token } })
      ])
      const uData = await uRes.json()
      if (!uRes.ok) { setError(uData.error || 'Failed to load user'); setLoading(false); return }
      setUser(uData.user)
      const tData = await tRes.json()
      if (!tRes.ok) { setError(tData.error || 'Failed to load toys'); setToys([]); setLoading(false); return }
      const isWishlistToy = toy => toy.is_wishlist === true || toy.is_wishlist === 1 || toy.is_wishlist === '1' || toy.is_wishlist === 'true'
      const isForSaleToy = toy => toy.for_sale === true || toy.for_sale === 1 || toy.for_sale === '1' || toy.for_sale === 'true'
      const visibleToy = toy => {
        if (forSale) return isForSaleToy(toy)
        if (wishlist) return isWishlistToy(toy)
        return !isWishlistToy(toy)
      }
      setToys((tData.toys || []).filter(visibleToy))
      setLoading(false)
    } catch (err){ setError('Server error'); setLoading(false) }
  }

  useEffect(()=>{ loadUserAndToys() }, [])
  useEffect(()=>{
    if (loc?.state?.refresh) loadUserAndToys()
  }, [loc?.state?.refresh])

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
  const filterableToys = (wishlist || forSale) ? toys : selectedToys
  const baseScopeToys = (wishlist || forSale) ? toys : (selectedGroup ? selectedToys : toys)
  const filterFields = {
    tag: 'Tag',
    condition: 'Condition',
    manufacturer: 'Manufacturer',
    year: 'Year',
    series: 'Series',
    sub_series: 'Sub-Series',
    theme: 'Theme'
  }
  const searchFields = {
    all: 'All fields',
    name: 'Name',
    manufacturer: 'Manufacturer',
    toyline: 'Toyline',
    series: 'Series',
    sub_series: 'Sub-Series',
    theme: 'Theme',
    condition: 'Condition',
    notes: 'Notes',
    tag: 'Tag'
  }
  const filterValues = filterField === 'tag'
    ? [...new Set(filterableToys.flatMap(toy => (toy.tags || []).map(tag => tag.name)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    : [...new Set(filterableToys.map(toy => toy[filterField]).filter(value => value !== null && value !== undefined && String(value).trim()).map(String))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  function matchesSearch(toy){
    const query = searchQuery.trim().toLowerCase()
    if (!query) return true

    if (searchField === 'tag') {
      return (toy.tags || []).some(tag => String(tag?.name || '').toLowerCase().includes(query))
    }

    const candidateValues = []
    if (searchField === 'all') {
      candidateValues.push(String(toy.name || ''))
      candidateValues.push(String(toy.manufacturer || ''))
      candidateValues.push(String(toy.toyline || ''))
      candidateValues.push(String(toy.series || ''))
      candidateValues.push(String(toy.sub_series || ''))
      candidateValues.push(String(toy.theme || ''))
      candidateValues.push(String(toy.condition || ''))
      candidateValues.push(String(toy.notes || ''))
      candidateValues.push(...(toy.tags || []).map(tag => String(tag?.name || '')))
    } else {
      candidateValues.push(String(toy[searchField] || ''))
    }

    return candidateValues.some(value => value.toLowerCase().includes(query))
  }

  const filteredToys = appliedFilters.reduce((result, activeFilter) => {
    if (activeFilter.field === 'tag') {
      return result.filter(toy => (toy.tags || []).some(tag => tag.name === activeFilter.value))
    }
    return result.filter(toy => String(toy[activeFilter.field] || '') === activeFilter.value)
  }, baseScopeToys).filter(matchesSearch)

  const dashboardViewState = {
    grouping,
    selectedGroup,
    filterOpen,
    filterField,
    filterValue,
    searchOpen,
    searchDraft,
    searchField,
    searchQuery,
    appliedFilters,
    wishlist,
    forSale
  }

  function resetFilterState(){
    setFilterField('manufacturer')
    setFilterValue('')
    setSearchOpen(false)
    setSearchDraft('')
    setSearchField('all')
    setSearchQuery('')
    setAppliedFilters([])
    setFilterOpen(false)
  }

  function applySearch(){
    const trimmed = searchDraft.trim()
    setSearchQuery(trimmed)
    setSearchOpen(false)
  }

  function clearSearch(){
    setSearchQuery('')
    setSearchDraft('')
    setSearchField('all')
    setSearchOpen(false)
  }

  function changeGrouping(nextGrouping){
    setGrouping(nextGrouping)
    setSelectedGroup(null)
    resetFilterState()
  }

  function selectGroup(groupName){
    setSelectedGroup(groupName)
    resetFilterState()
  }

  function applyFilter(){
    if (!filterValue) return
    setAppliedFilters(prev => {
      const nextFilters = prev.filter(item => item.field !== filterField)
      return [...nextFilters, { field: filterField, value: filterValue }]
    })
    setFilterValue('')
    setFilterOpen(false)
  }

  function removeFilter(field){
    setAppliedFilters(prev => prev.filter(item => item.field !== field))
  }

  function clearAppliedFilters(){
    setAppliedFilters([])
    setFilterValue('')
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
          <h3 className="text-2xl font-bold tracking-tight text-toydb-navy">{forSale ? 'For Sale' : wishlist ? 'My Wishlist' : 'My Collection'}</h3>
          <p className="mt-1 text-sm text-toydb-slate">{forSale ? 'These toys are currently marked for sale.' : wishlist ? 'Keep track of the toys you want to find.' : 'Keep every favorite in one place.'}</p>
        </div>
        <Link to={forSale ? '/add' : wishlist ? '/wishlist/add' : '/add'} className="rounded-lg bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white shadow-sm hover:bg-toydb-teal-dark">{forSale ? '+ Add For Sale Toy' : wishlist ? '+ Add Wishlist Toy' : '+ Add Collection Toy'}</Link>
      </section>

      {!wishlist && !forSale && <section className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Collection summary">
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

      {!wishlist && !forSale && <nav className="flex gap-5 border-b-2 border-toydb-border text-sm" aria-label="Collection views">
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
      {!loading && toys.length === 0 && <div className="border border-dashed border-toydb-teal bg-toydb-teal-pale p-6 text-sm text-toydb-teal-dark">{forSale ? 'No toys are currently marked for sale.' : wishlist ? 'No wishlist toys yet. Use "+ Add Wishlist Toy" above to add your first item.' : 'No toys yet. Use "+ Add Toy" above to add your first item.'}</div>}
      {!loading && (wishlist || forSale) && toys.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSearchOpen(open => !open)} className="rounded-lg border border-toydb-teal bg-toydb-teal-pale px-3 py-2 text-sm font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white">
              Search: {searchQuery ? 'Active' : 'None'}
            </button>
            <button type="button" onClick={() => setFilterOpen(open => !open)} className="rounded-lg border border-toydb-orange bg-toydb-orange-pale px-3 py-2 text-sm font-medium text-toydb-orange-dark hover:bg-toydb-orange hover:text-toydb-white">
              Filter: {appliedFilters.length ? `${appliedFilters.length} active` : 'None'}
            </button>
          </div>
          {(searchQuery || appliedFilters.length > 0) && <div className="flex flex-wrap gap-2">
            {searchQuery && <button type="button" onClick={clearSearch} className="rounded-full border border-toydb-teal bg-toydb-teal-pale px-2 py-1 text-xs font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white">
              {searchFields[searchField]}: {searchQuery} ×
            </button>}
            {appliedFilters.map(filter => (
              <button key={`${filter.field}:${filter.value}`} type="button" onClick={() => removeFilter(filter.field)} className="rounded-full border border-toydb-orange bg-toydb-orange-pale px-2 py-1 text-xs font-medium text-toydb-orange-dark hover:bg-toydb-orange hover:text-toydb-white">
                {filterFields[filter.field]}: {filter.value} ×
              </button>
            ))}
          </div>}
          {searchOpen && !searchQuery && <div className="grid gap-3 border border-toydb-border bg-toydb-white p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] sm:items-end">
            <label className="block text-sm font-medium text-toydb-navy">Search in<select value={searchField} onChange={event => setSearchField(event.target.value)} className="mt-1 w-full p-2"><option value="all">All fields</option>{Object.entries(searchFields).filter(([key]) => key !== 'all').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="block text-sm font-medium text-toydb-navy">Query<input type="search" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Search this scope" className="mt-1 w-full p-2" /></label>
            <div className="flex gap-2"><button type="button" onClick={applySearch} disabled={!searchDraft.trim()} className="bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">Apply</button><button type="button" onClick={clearSearch} className="border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">Clear</button></div>
          </div>}
          {filterOpen && <div className="grid gap-3 border border-toydb-border bg-toydb-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm font-medium text-toydb-navy">Filter by<select value={filterField} onChange={event => changeFilterField(event.target.value)} className="mt-1 w-full p-2"><option value="tag">Tag</option><option value="condition">Condition</option><option value="manufacturer">Manufacturer</option><option value="year">Year</option><option value="series">Series</option><option value="sub_series">Sub-Series</option><option value="theme">Theme</option></select></label>
            <label className="block text-sm font-medium text-toydb-navy">Value<select value={filterValue} onChange={event => setFilterValue(event.target.value)} className="mt-1 w-full p-2"><option value="">Select a value</option>{filterValues.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <div className="flex gap-2"><button type="button" onClick={applyFilter} disabled={!filterValue} className="bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">Add filter</button>{appliedFilters.length > 0 && <button type="button" onClick={clearAppliedFilters} className="border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">Clear all</button>}</div>
          </div>}
          <div className="grid grid-cols-1 gap-4">
            {filteredToys.map(toy => <ToyCard key={toy.id} toy={toy} allowDelete onDeleted={onDeleted} returnState={dashboardViewState} deleteLabel={forSale ? 'Sold' : 'Delete'} />)}
          </div>
          {filteredToys.length === 0 && <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No toys match this search or filter in the current scope.</div>}
        </div>
      )}
      {!loading && !wishlist && !forSale && toys.length > 0 && !selectedGroup && (
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
      {!loading && !wishlist && !forSale && selectedGroup && (
        <div className="space-y-4">
          <div className="-mt-3">
            <button type="button" onClick={() => { setSelectedGroup(null); resetFilterState() }} className="block mb-4 text-base font-medium text-toydb-slate hover:text-toydb-teal-dark">
              &larr; Back to {activeGrouping.label}
            </button>
            <h4 className="text-xl font-bold text-toydb-navy">{selectedGroup} <span className="text-toydb-teal-dark">({filteredToys.length})</span></h4>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => setSearchOpen(open => !open)} className="rounded-lg border border-toydb-teal bg-toydb-teal-pale px-3 py-2 text-sm font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white">
              Search: {searchQuery ? 'Active' : 'None'}
            </button>
            <button type="button" onClick={() => setFilterOpen(open => !open)} className="rounded-lg border border-toydb-orange bg-toydb-orange-pale px-3 py-2 text-sm font-medium text-toydb-orange-dark hover:bg-toydb-orange hover:text-toydb-white">
              Filter: {appliedFilters.length ? `${appliedFilters.length} active` : 'None'}
            </button>
          </div>
          {(searchQuery || appliedFilters.length > 0) && <div className="flex flex-wrap gap-2">
            {searchQuery && <button type="button" onClick={clearSearch} className="rounded-full border border-toydb-teal bg-toydb-teal-pale px-2 py-1 text-xs font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white">
              {searchFields[searchField]}: {searchQuery} ×
            </button>}
            {appliedFilters.map(filter => (
              <button key={`${filter.field}:${filter.value}`} type="button" onClick={() => removeFilter(filter.field)} className="rounded-full border border-toydb-orange bg-toydb-orange-pale px-2 py-1 text-xs font-medium text-toydb-orange-dark hover:bg-toydb-orange hover:text-toydb-white">
                {filterFields[filter.field]}: {filter.value} ×
              </button>
            ))}
          </div>}
          {searchOpen && !searchQuery && <div className="grid gap-3 border border-toydb-border bg-toydb-white p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_auto] sm:items-end">
            <label className="block text-sm font-medium text-toydb-navy">Search in<select value={searchField} onChange={event => setSearchField(event.target.value)} className="mt-1 w-full p-2"><option value="all">All fields</option>{Object.entries(searchFields).filter(([key]) => key !== 'all').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="block text-sm font-medium text-toydb-navy">Query<input type="search" value={searchDraft} onChange={event => setSearchDraft(event.target.value)} placeholder="Search this group" className="mt-1 w-full p-2" /></label>
            <div className="flex gap-2"><button type="button" onClick={applySearch} disabled={!searchDraft.trim()} className="bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">Apply</button><button type="button" onClick={clearSearch} className="border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">Clear</button></div>
          </div>}
          {filterOpen && <div className="grid gap-3 border border-toydb-border bg-toydb-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="block text-sm font-medium text-toydb-navy">Filter by<select value={filterField} onChange={event => changeFilterField(event.target.value)} className="mt-1 w-full p-2"><option value="tag">Tag</option><option value="condition">Condition</option><option value="manufacturer">Manufacturer</option><option value="year">Year</option><option value="series">Series</option><option value="sub_series">Sub-Series</option><option value="theme">Theme</option></select></label>
            <label className="block text-sm font-medium text-toydb-navy">Value<select value={filterValue} onChange={event => setFilterValue(event.target.value)} className="mt-1 w-full p-2"><option value="">Select a value</option>{filterValues.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <div className="flex gap-2"><button type="button" onClick={applyFilter} disabled={!filterValue} className="bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white hover:bg-toydb-teal-dark disabled:cursor-not-allowed disabled:opacity-60">Add filter</button>{appliedFilters.length > 0 && <button type="button" onClick={clearAppliedFilters} className="border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-medium text-toydb-navy hover:bg-toydb-cream">Clear all</button>}</div>
          </div>}
          <div className="grid grid-cols-1 gap-4">
            {filteredToys.map(t => <ToyCard key={t.id} toy={t} onUpdated={onUpdated} onDeleted={onDeleted} returnState={dashboardViewState} deleteLabel={forSale ? 'Sold' : 'Delete'} />)}
          </div>
          {filteredToys.length === 0 && <div className="border border-dashed border-toydb-border p-4 text-sm text-toydb-slate">No toys match this search or filter in the current scope.</div>}
        </div>
      )}
      <footer className="border-t border-toydb-border pt-5 text-center">
        <div className="text-sm font-bold">Welcome, {user.email}</div>
        <div className="text-xs text-toydb-slate">Member since: {new Date(user.createdAt).toLocaleString()}</div>
      </footer>
    </div>
  )
}
