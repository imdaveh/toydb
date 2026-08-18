import React, { useState } from 'react'

export default function ToyForm({ onCreated, onCancel }){
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [series, setSeries] = useState('')
  const [subSeries, setSubSeries] = useState('')
  const [toyline, setToyline] = useState('')
  const [year, setYear] = useState('')
  const [accessories, setAccessories] = useState('')
  const [condition, setCondition] = useState('Good')
  const [cost, setCost] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [photos, setPhotos] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e){
    e.preventDefault(); setError(null); setLoading(true)
    try{
      // refresh to get token
      const r = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const data = await r.json()
      const token = data.accessToken
      if (!token) return setError('Not authenticated')
      const fd = new FormData()
      fd.append('name', name)
      fd.append('manufacturer', manufacturer)
      fd.append('series', series)
      fd.append('sub_series', subSeries)
      fd.append('toyline', toyline)
      fd.append('year', year)
      fd.append('cost', cost)
      fd.append('source', source)
      fd.append('notes', notes)
      fd.append('accessories', accessories)
      fd.append('condition', condition)
      if (photos) {
        for (const f of photos) fd.append('photos', f)
      }
      const res = await fetch(import.meta.env.VITE_API_BASE + '/toys', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: fd })
      const d = await res.json()
      if (!res.ok) return setError(d.error || 'Failed')
      setName(''); setManufacturer(''); setToyline(''); setYear(''); setSeries(''); setSubSeries(''); setAccessories(''); setCondition('Good'); setCost(''); setSource(''); setNotes(''); setPhotos(null)
      if (onCreated) onCreated()
    } catch (err){ setError('Server error') }
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="text-red-600">{error}</div>}

      {/* 1st row: Name */}
      <div>
        <label htmlFor="add-toy-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
        <input id="add-toy-name" required value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {/* 2nd row: Year and Manufacturer */}
      <div className="flex gap-2">
        <div className="w-24">
          <label htmlFor="add-toy-year" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <input id="add-toy-year" value={year} onChange={e=>setYear(e.target.value)} type="number" min="1800" max="2100" className="w-full p-2 border rounded" />
        </div>
        <div className="flex-1">
          <label htmlFor="add-toy-manufacturer" className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
          <input id="add-toy-manufacturer" value={manufacturer} onChange={e=>setManufacturer(e.target.value)} className="w-full p-2 border rounded" />
        </div>
      </div>

      {/* 3rd row: Toyline */}
      <div>
        <label htmlFor="add-toy-toyline" className="block text-sm font-medium text-gray-700 mb-1">Toyline</label>
        <input id="add-toy-toyline" value={toyline} onChange={e=>setToyline(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {/* 4th row: Series */}
      <div>
        <label htmlFor="add-toy-series" className="block text-sm font-medium text-gray-700 mb-1">Series</label>
        <input id="add-toy-series" value={series} onChange={e=>setSeries(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {/* 5th row: Sub-series */}
      <div>
        <label htmlFor="add-toy-subseries" className="block text-sm font-medium text-gray-700 mb-1">Sub-series</label>
        <input id="add-toy-subseries" value={subSeries} onChange={e=>setSubSeries(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {/* 6th row: Accessories */}
      <div>
        <label htmlFor="add-toy-accessories" className="block text-sm font-medium text-gray-700 mb-1">Accessories</label>
        <textarea id="add-toy-accessories" value={accessories} onChange={e=>setAccessories(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {/* 7th row: Notes */}
      <div>
        <label htmlFor="add-toy-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea id="add-toy-notes" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2 border rounded" />
      </div>

      {/* 8th row: Condition */}
      <div>
        <label htmlFor="add-toy-condition" className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
        <select id="add-toy-condition" value={condition} onChange={e=>setCondition(e.target.value)} className="w-full p-2 border rounded">
          <option>Mint</option>
          <option>Near Mint</option>
          <option>Excellent</option>
          <option>Good</option>
          <option>Fair</option>
          <option>Poor</option>
        </select>
      </div>

      {/* 9th row: Price and Source */}
      <div className="flex gap-2">
        <div className="w-32">
          <label htmlFor="add-toy-cost" className="block text-sm font-medium text-gray-700 mb-1">Price</label>
          <input id="add-toy-cost" value={cost} onChange={e=>setCost(e.target.value)} type="number" step="0.01" className="w-full p-2 border rounded" />
        </div>
        <div className="flex-1">
          <label htmlFor="add-toy-source" className="block text-sm font-medium text-gray-700 mb-1">Source</label>
          <input id="add-toy-source" value={source} onChange={e=>setSource(e.target.value)} className="w-full p-2 border rounded" />
        </div>
      </div>

      {/* Photo management remains at bottom */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Add Photos</label>
        <input type="file" multiple accept="image/*" onChange={e=>setPhotos(e.target.files)} />
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" className="bg-gray-300 p-2 rounded" onClick={() => { if (onCancel) onCancel(); else { /* reset form */ setName(''); setManufacturer(''); setToyline(''); setYear(''); setSeries(''); setSubSeries(''); setAccessories(''); setCondition('Good'); setPhotos(null); } }} disabled={loading}>Cancel</button>
        <button type="submit" className="bg-green-600 text-white p-2 rounded" disabled={loading}>{loading ? 'Adding...' : 'Add to collection'}</button>
      </div>
    </form>
  )
}
