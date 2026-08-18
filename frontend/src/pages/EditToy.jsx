import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function EditToy(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [toy, setToy] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState({})
  const [photosFiles, setPhotosFiles] = useState(null)
  const [busy, setBusy] = useState(false)

  async function getToken(){
    try{
      const r = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const d = await r.json()
      return d.accessToken
    } catch (e){ return null }
  }

  useEffect(()=>{ load() }, [id])
  async function load(){
    setLoading(true); setError(null)
    const token = await getToken()
    if (!token) { navigate('/'); return }
    try{
      const res = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { headers: { Authorization: 'Bearer ' + token } })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Failed'); setLoading(false); return }
      setToy(d.toy)
      setForm({
        name: d.toy.name || '',
        manufacturer: d.toy.manufacturer || '',
        series: d.toy.series || '',
        sub_series: d.toy.sub_series || '',
        toyline: d.toy.toyline || '',
        year: d.toy.year || '',
        cost: d.toy.cost || '',
        source: d.toy.source || '',
        notes: d.toy.notes || '',
        accessories: d.toy.accessories || '',
        condition: d.toy.condition || ''
      })
      setLoading(false)
    } catch (err){ setError('Server error'); setLoading(false) }
  }

  async function save(){
    setBusy(true); setError(null)
    const token = await getToken(); if (!token) { setError('Not authenticated'); setBusy(false); return }
    try{
      const res = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'PUT', headers: { 'Content-Type':'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(form) })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Failed'); setBusy(false); return }
      // optionally upload photos
      if (photosFiles && photosFiles.length){
        const fd = new FormData()
        for (const f of photosFiles) fd.append('photos', f)
        const up = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id + '/photos', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: fd })
        if (!up.ok) { const ud = await up.json(); setError(ud.error || 'Photo upload failed'); setBusy(false); return }
      }
      // navigate back to dashboard and ask it to refresh
      navigate('/dashboard', { state: { refresh: Date.now() } })
    } catch (err){ setError('Server error') }
    setBusy(false)
  }

  async function deleteToy(){
    if (!confirm('Delete this toy? This cannot be undone.')) return
    setBusy(true); setError(null)
    const token = await getToken(); if (!token) { setError('Not authenticated'); setBusy(false); return }
    try{
      const res = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Failed'); setBusy(false); return }
      navigate('/dashboard', { state: { refresh: Date.now() } })
    } catch (err){ setError('Server error') }
    setBusy(false)
  }

  async function deletePhoto(photoId){
    if (!confirm('Delete this photo?')) return
    setBusy(true)
    const token = await getToken(); if (!token) { setError('Not authenticated'); setBusy(false); return }
    try{
      const res = await fetch(import.meta.env.VITE_API_BASE + `/toys/${id}/photos/${photoId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Failed'); setBusy(false); return }
      // reload toy
      await load()
    } catch (err){ setError('Server error') }
    setBusy(false)
  }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-600">{error}</div>
  if (!toy) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Edit: {toy.name}</h2>
      </div>

      <div className="p-4 bg-white border rounded space-y-2">
        {/* 1st row: Name */}
        <div>
          <label htmlFor="toy-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input id="toy-name" value={form.name} onChange={e=>setForm({...form, name: e.target.value})} className="w-full p-2 border rounded" />
        </div>

        {/* 2nd row: Year and Manufacturer */}
        <div className="flex gap-2">
          <div className="w-24">
            <label htmlFor="toy-year" className="block text-sm font-medium text-gray-700 mb-1">Year</label>
            <input id="toy-year" value={form.year || ''} onChange={e=>setForm({...form, year: e.target.value})} type="number" min="1800" max="2100" className="w-full p-2 border rounded" />
          </div>
          <div className="flex-1">
            <label htmlFor="toy-manufacturer" className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
            <input id="toy-manufacturer" value={form.manufacturer} onChange={e=>setForm({...form, manufacturer: e.target.value})} className="w-full p-2 border rounded" />
          </div>
        </div>

        {/* 3rd row: Toyline */}
        <div>
          <label htmlFor="toy-toyline" className="block text-sm font-medium text-gray-700 mb-1">Toyline</label>
          <input id="toy-toyline" value={form.toyline || ''} onChange={e=>setForm({...form, toyline: e.target.value})} className="w-full p-2 border rounded" />
        </div>

        {/* 4th row: Series */}
        <div>
          <label htmlFor="toy-series" className="block text-sm font-medium text-gray-700 mb-1">Series</label>
          <input id="toy-series" value={form.series || ''} onChange={e=>setForm({...form, series: e.target.value})} className="w-full p-2 border rounded" />
        </div>

        {/* 5th row: Sub-series */}
        <div>
          <label htmlFor="toy-subseries" className="block text-sm font-medium text-gray-700 mb-1">Sub-series</label>
          <input id="toy-subseries" value={form.sub_series || ''} onChange={e=>setForm({...form, sub_series: e.target.value})} className="w-full p-2 border rounded" />
        </div>

        {/* 6th row: Accessories */}
        <div>
          <label htmlFor="toy-accessories" className="block text-sm font-medium text-gray-700 mb-1">Accessories</label>
          <textarea id="toy-accessories" value={form.accessories || ''} onChange={e=>setForm({...form, accessories: e.target.value})} className="w-full p-2 border rounded" />
        </div>

        {/* 7th row: Notes */}
        <div>
          <label htmlFor="toy-notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea id="toy-notes" value={form.notes || ''} onChange={e=>setForm({...form, notes: e.target.value})} className="w-full p-2 border rounded" />
        </div>

        {/* 8th row: Condition */}
        <div>
          <label htmlFor="toy-condition" className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
          <select id="toy-condition" value={form.condition || ''} onChange={e=>setForm({...form, condition: e.target.value})} className="w-full p-2 border rounded">
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
            <label htmlFor="toy-cost" className="block text-sm font-medium text-gray-700 mb-1">Price</label>
            <input id="toy-cost" value={form.cost || ''} onChange={e=>setForm({...form, cost: e.target.value})} type="number" step="0.01" className="w-full p-2 border rounded" />
          </div>
          <div className="flex-1">
            <label htmlFor="toy-source" className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <input id="toy-source" value={form.source || ''} onChange={e=>setForm({...form, source: e.target.value})} className="w-full p-2 border rounded" />
          </div>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Add Photos</label>
          <input type="file" multiple accept="image/*" onChange={e=>setPhotosFiles(e.target.files)} />
        </div>

        <div>
          <h4 className="font-semibold">Existing Photos</h4>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {toy.photos && toy.photos.length ? toy.photos.map(p => (
              <div key={p.id} className="relative">
                <img src={import.meta.env.VITE_API_BASE + p.url} alt={p.name} className="object-cover w-full h-24 rounded" />
                <button onClick={()=>deletePhoto(p.id)} className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-0.5 rounded">Delete</button>
              </div>
            )) : <div className="text-sm text-gray-600">No photos</div>}
          </div>
        </div>

        {/* Bottom controls: Back, Delete Toy, Save Toy */}
        <div className="flex gap-2 justify-end mt-3">
          <button onClick={()=>navigate('/dashboard', { state: { refresh: Date.now() } })} className="bg-gray-300 p-2 rounded">Cancel</button>
          <button onClick={deleteToy} disabled={busy} className="bg-red-600 text-white p-2 rounded">Delete Toy</button>
          <button onClick={save} disabled={busy} className="bg-blue-600 text-white p-2 rounded">{busy ? 'Saving...' : 'Save Toy'}</button>
        </div>
      </div>
    </div>
  )
}
