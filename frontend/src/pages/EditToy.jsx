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
        <div className="flex items-center gap-2">
          <button onClick={()=>navigate('/dashboard', { state: { refresh: Date.now() } })} className="bg-gray-300 p-2 rounded">Back</button>
          <button onClick={save} disabled={busy} className="bg-blue-600 text-white p-2 rounded">{busy ? 'Saving...' : 'Save'}</button>
        </div>
      </div>

      <div className="p-4 bg-white border rounded space-y-2">
        <input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="Toy name" className="w-full p-2 border rounded" />
        <input value={form.manufacturer} onChange={e=>setForm({...form, manufacturer: e.target.value})} placeholder="Manufacturer" className="w-full p-2 border rounded" />
        <div className="flex gap-2">
          <input value={form.toyline} onChange={e=>setForm({...form, toyline: e.target.value})} placeholder="Toyline" className="flex-1 p-2 border rounded" />
          <input value={form.year} onChange={e=>setForm({...form, year: e.target.value})} placeholder="Year" type="number" min="1800" max="2100" className="w-24 p-2 border rounded" />
        </div>
        <div className="flex gap-2">
          <input value={form.series} onChange={e=>setForm({...form, series: e.target.value})} placeholder="Series" className="flex-1 p-2 border rounded" />
          <input value={form.sub_series} onChange={e=>setForm({...form, sub_series: e.target.value})} placeholder="Sub-series" className="flex-1 p-2 border rounded" />
        </div>
        <div className="flex gap-2">
          <input value={form.cost || ''} onChange={e=>setForm({...form, cost: e.target.value})} placeholder="Cost" type="number" step="0.01" className="flex-1 p-2 border rounded" />
          <input value={form.source || ''} onChange={e=>setForm({...form, source: e.target.value})} placeholder="Source" className="flex-1 p-2 border rounded" />
        </div>
        <textarea value={form.notes || ''} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Notes" className="w-full p-2 border rounded" />
        <input value={form.accessories} onChange={e=>setForm({...form, accessories: e.target.value})} placeholder="Accessories" className="w-full p-2 border rounded" />
        <select value={form.condition} onChange={e=>setForm({...form, condition: e.target.value})} className="w-full p-2 border rounded">
          <option>Mint</option>
          <option>Near Mint</option>
          <option>Excellent</option>
          <option>Good</option>
          <option>Fair</option>
          <option>Poor</option>
        </select>
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
      </div>
    </div>
  )
}
