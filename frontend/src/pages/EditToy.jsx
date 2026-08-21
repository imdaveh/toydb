import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import useToySuggestions from '../hooks/useToySuggestions'
import AutocompleteInput from '../components/AutocompleteInput'

const conditions = ['New Unopened', 'Sealed Box', 'On Card', 'Open Box', 'Complete', 'Loose']
const grades = ['Excellent', 'Good', 'Fair', 'Poor', 'Broken']

export default function EditToy(){
  const { id } = useParams()
  const navigate = useNavigate()
  const [toy, setToy] = useState(null)
  const [form, setForm] = useState({})
  const [photosFiles, setPhotosFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const suggestions = useToySuggestions()

  async function getToken(){
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      return (await response.json()).accessToken
    } catch (error) { return null }
  }

  async function load(){
    setLoading(true); setError(null)
    const token = await getToken()
    if (!token) { navigate('/'); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { headers: { Authorization: 'Bearer ' + token } })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Failed'); return }
      setToy(data.toy)
      setForm({
        name: data.toy.name || '', manufacturer: data.toy.manufacturer || '', series: data.toy.series || '',
        sub_series: data.toy.sub_series || '', toyline: data.toy.toyline || '', year: data.toy.year || '',
        accessories: data.toy.accessories || '', missing: data.toy.missing || '', notes: data.toy.notes || '',
        condition: data.toy.condition || '', grade: data.toy.grade || '', cost: data.toy.cost || '',
        value: data.toy.value || '', source: data.toy.source || ''
      })
    } catch (error) { setError('Server error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function save(){
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(form) })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Failed'); setBusy(false); return }
      if (photosFiles.length) {
        const uploadData = new FormData()
        photosFiles.forEach(file => uploadData.append('photos', file))
        const upload = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id + '/photos', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: uploadData })
        if (!upload.ok) { setError((await upload.json()).error || 'Photo upload failed'); setBusy(false); return }
      }
      navigate('/dashboard', { state: { refresh: Date.now() } })
    } catch (error) { setError('Server error') }
    setBusy(false)
  }

  async function deleteToy(){
    if (!confirm('Delete this toy? This cannot be undone.')) return
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) { setError((await response.json()).error || 'Failed'); setBusy(false); return }
      navigate('/dashboard', { state: { refresh: Date.now() } })
    } catch (error) { setError('Server error') }
    setBusy(false)
  }

  async function deletePhoto(photoId){
    if (!confirm('Delete this photo?')) return
    setBusy(true)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + `/toys/${id}/photos/${photoId}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) { setError((await response.json()).error || 'Failed'); setBusy(false); return }
      await load()
    } catch (error) { setError('Server error') }
    setBusy(false)
  }

  function updateField(field, value){ setForm(current => ({ ...current, [field]: value })) }

  if (loading) return <div>Loading...</div>
  if (error) return <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>
  if (!toy) return null

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Edit: {toy.name}</h2>
      <div className="p-4 bg-toydb-white border border-toydb-border rounded-xl shadow-sm space-y-2">
        <Field label="Name"><input value={form.name} onChange={event => updateField('name', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <div className="flex gap-2"><Field label="Year" className="w-24"><input value={form.year} onChange={event => updateField('year', event.target.value)} type="number" min="1800" max="2100" className="w-full p-2 border rounded" /></Field><Field label="Manufacturer" className="flex-1"><AutocompleteInput value={form.manufacturer} suggestions={suggestions.manufacturer} onChange={value => updateField('manufacturer', value)} /></Field></div>
        <Field label="Toyline"><AutocompleteInput value={form.toyline} suggestions={suggestions.toyline} onChange={value => updateField('toyline', value)} /></Field>
        <Field label="Series"><AutocompleteInput value={form.series} suggestions={suggestions.series} onChange={value => updateField('series', value)} /></Field>
        <Field label="Sub-series"><AutocompleteInput value={form.sub_series} suggestions={suggestions.sub_series} onChange={value => updateField('sub_series', value)} /></Field>
        <Field label="Accessories"><textarea value={form.accessories} onChange={event => updateField('accessories', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <Field label="Missing"><textarea value={form.missing} onChange={event => updateField('missing', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <Field label="Notes"><textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <div className="flex gap-2"><Field label="Condition" className="flex-1"><Select value={form.condition} values={conditions} onChange={value => updateField('condition', value)} /></Field><Field label="Grade" className="flex-1"><Select value={form.grade} values={grades} onChange={value => updateField('grade', value)} /></Field></div>
        <div className="flex gap-2"><Field label="Price" className="w-32"><input value={form.cost} onChange={event => updateField('cost', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field><Field label="Value" className="w-32"><input value={form.value} onChange={event => updateField('value', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field></div>
        <Field label="Source"><AutocompleteInput value={form.source} suggestions={suggestions.source} onChange={value => updateField('source', value)} /></Field>
        <div><label className="block text-sm text-toydb-slate mb-1">Add Photos</label><input type="file" multiple accept="image/*" onChange={event => { setPhotosFiles(current => [...current, ...Array.from(event.target.files || [])]); event.target.value = '' }} />{photosFiles.map((file, index) => <div key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center justify-between gap-2 text-sm"><span>{file.name}</span><button type="button" onClick={() => setPhotosFiles(current => current.filter((_, fileIndex) => fileIndex !== index))} className="text-toydb-danger">Remove</button></div>)}</div>
        <div><h4 className="font-semibold">Existing Photos</h4><div className="grid grid-cols-3 gap-2 mt-2">{toy.photos?.length ? toy.photos.map(photo => <div key={photo.id} className="relative w-24"><div className="w-24 h-24 bg-toydb-cream flex items-center justify-center overflow-hidden rounded-lg"><img src={import.meta.env.VITE_API_BASE + photo.url} alt={photo.name} className="object-contain w-full h-full" /></div><button onClick={() => deletePhoto(photo.id)} className="absolute top-1 right-1 bg-toydb-danger text-toydb-white text-xs px-2 py-0.5 rounded">Delete</button></div>) : <div className="text-sm text-toydb-slate">No photos</div>}</div></div>
        <div className="flex gap-2 justify-end mt-3"><button onClick={() => navigate('/dashboard', { state: { refresh: Date.now() } })} className="border border-toydb-border bg-toydb-white text-toydb-navy p-2 rounded-lg">Cancel</button><button onClick={deleteToy} disabled={busy} className="bg-toydb-danger text-toydb-white p-2 rounded-lg">Delete Toy</button><button onClick={save} disabled={busy} className="bg-toydb-teal text-toydb-white font-medium p-2 rounded-lg">{busy ? 'Saving...' : 'Save Toy'}</button></div>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }){
  return <div className={className}><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}

function Select({ value, values, onChange }){
  return <select value={value || ''} onChange={event => onChange(event.target.value)} className="w-full p-2 border rounded"><option value="">Select</option>{values.map(option => <option key={option}>{option}</option>)}</select>
}

