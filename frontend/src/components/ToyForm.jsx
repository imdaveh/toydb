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
      fd.append('accessories', accessories)
      fd.append('condition', condition)
      if (photos) {
        for (const f of photos) fd.append('photos', f)
      }
      const res = await fetch(import.meta.env.VITE_API_BASE + '/toys', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: fd })
      const d = await res.json()
      if (!res.ok) return setError(d.error || 'Failed')
      setName(''); setManufacturer(''); setToyline(''); setYear(''); setSeries(''); setSubSeries(''); setAccessories(''); setCondition('Good'); setPhotos(null)
      if (onCreated) onCreated()
    } catch (err){ setError('Server error') }
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="text-red-600">{error}</div>}
      <input required value={name} onChange={e=>setName(e.target.value)} placeholder="Toy name" className="w-full p-2 border rounded" />
      <input value={manufacturer} onChange={e=>setManufacturer(e.target.value)} placeholder="Manufacturer" className="w-full p-2 border rounded" />
      <div className="flex gap-2">
        <input value={toyline} onChange={e=>setToyline(e.target.value)} placeholder="Toyline" className="flex-1 p-2 border rounded" />
        <input value={year} onChange={e=>setYear(e.target.value)} placeholder="Year" type="number" min="1800" max="2100" className="w-24 p-2 border rounded" />
      </div>
      <div className="flex gap-2">
        <input value={series} onChange={e=>setSeries(e.target.value)} placeholder="Series" className="flex-1 p-2 border rounded" />
        <input value={subSeries} onChange={e=>setSubSeries(e.target.value)} placeholder="Sub-series" className="flex-1 p-2 border rounded" />
      </div>
      <input value={accessories} onChange={e=>setAccessories(e.target.value)} placeholder="Accessories (comma separated)" className="w-full p-2 border rounded" />
      <select value={condition} onChange={e=>setCondition(e.target.value)} className="w-full p-2 border rounded">
        <option>Mint</option>
        <option>Near Mint</option>
        <option>Excellent</option>
        <option>Good</option>
        <option>Fair</option>
        <option>Poor</option>
      </select>
      <input type="file" multiple accept="image/*" onChange={e=>setPhotos(e.target.files)} />
      <div className="flex gap-2">
        <button type="submit" className="bg-green-600 text-white p-2 rounded" disabled={loading}>{loading ? 'Adding...' : 'Add to collection'}</button>
        <button type="button" className="bg-gray-300 p-2 rounded" onClick={() => { if (onCancel) onCancel(); else { /* reset form */ setName(''); setManufacturer(''); setToyline(''); setYear(''); setSeries(''); setSubSeries(''); setAccessories(''); setCondition('Good'); setPhotos(null); } }} disabled={loading}>Cancel</button>
      </div>
    </form>
  )
}
