import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import useToySuggestions from '../hooks/useToySuggestions'
import useTags from '../hooks/useTags'
import AutocompleteInput from '../components/AutocompleteInput'
import TagPicker from '../components/TagPicker'

const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor', 'Broken']

export default function EditToy(){
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [toy, setToy] = useState(null)
  const [form, setForm] = useState({})
  const [photosFiles, setPhotosFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const suggestions = useToySuggestions()
  const allTags = useTags()

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
        sub_series: data.toy.sub_series || '', theme: data.toy.theme || '', toyline: data.toy.toyline || '', year: data.toy.year || '',
        included: data.toy.included || data.toy.accessories || '', missing: data.toy.missing || '', broken: data.toy.broken || '', notes: data.toy.notes || '',
        condition: data.toy.condition || '', tagIds: (data.toy.tags || []).map(tag => tag.id), cost: data.toy.cost || '',
        value: data.toy.value || '', source: data.toy.source || '', for_sale: Boolean(data.toy.for_sale)
      })
    } catch (error) { setError('Server error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function goBackToPreviousView(){
    const returnTarget = location.state?.from || (toy.is_wishlist ? '/wishlist' : '/dashboard')
    const returnPath = typeof returnTarget === 'string' ? returnTarget : returnTarget?.pathname || (toy.is_wishlist ? '/wishlist' : '/dashboard')
    const returnState = typeof returnTarget === 'string'
      ? { refresh: Date.now() }
      : { ...(returnTarget?.state || {}), refresh: Date.now() }

    navigate(returnPath, { state: returnState })
  }

  async function save(){
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...form, tags: form.tagIds, for_sale: Boolean(form.for_sale) }) })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Failed'); setBusy(false); return }
      if (photosFiles.length) {
        const uploadData = new FormData()
        photosFiles.forEach(file => uploadData.append('photos', file))
        const upload = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id + '/photos', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: uploadData })
        if (!upload.ok) { setError((await upload.json()).error || 'Photo upload failed'); setBusy(false); return }
      }
      goBackToPreviousView()
      return
    } catch (error) { setError('Server error') }
    finally { setBusy(false) }
  }

  async function deleteToy(){
    if (!confirm('Delete this toy? This cannot be undone.')) return
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      if (!response.ok) { setError((await response.json()).error || 'Failed'); setBusy(false); return }
      goBackToPreviousView()
      return
    } catch (error) { setError('Server error') }
    finally { setBusy(false) }
  }

  async function moveToCollection(){
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id + '/move-to-collection', {
        method: 'PATCH',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Unable to move toy'); setBusy(false); return }
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
        <Field label="Theme"><AutocompleteInput value={form.theme} suggestions={suggestions.theme} onChange={value => updateField('theme', value)} /></Field>
        <Field label="Condition"><Select value={form.condition} values={conditions} onChange={value => updateField('condition', value)} /></Field>
        <div className="flex items-center gap-2 rounded border border-toydb-border bg-toydb-cream px-3 py-2">
          <input id="for-sale-checkbox" type="checkbox" checked={Boolean(form.for_sale)} onChange={event => updateField('for_sale', event.target.checked)} className="h-4 w-4 rounded border-toydb-border text-toydb-orange focus:ring-toydb-orange" />
          <label htmlFor="for-sale-checkbox" className="text-sm font-medium text-toydb-navy">For Sale</label>
        </div>
        <Field label="Tags"><TagPicker allTags={allTags} selectedTagIds={form.tagIds || []} onChange={value => updateField('tagIds', value)} /></Field>
        <Field label="Notes"><textarea value={form.notes || ''} onChange={event => updateField('notes', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <Field label="Included"><textarea value={form.included || ''} onChange={event => updateField('included', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <Field label="Missing"><textarea value={form.missing || ''} onChange={event => updateField('missing', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <Field label="Broken"><textarea value={form.broken || ''} onChange={event => updateField('broken', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <div className="flex gap-2"><Field label="Cost" className="w-1/2"><input value={form.cost} onChange={event => updateField('cost', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field><Field label="Value" className="w-1/2"><input value={form.value} onChange={event => updateField('value', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field></div>
        <Field label="Source"><AutocompleteInput value={form.source} suggestions={suggestions.source} onChange={value => updateField('source', value)} /></Field>
        <div>
          <label className="block text-sm text-toydb-slate mb-1">Add Photos</label>
          <input type="file" multiple accept="image/*" onChange={event => setPhotosFiles(Array.from(event.target.files || []))} />
        </div>
        <div><h4 className="font-semibold">Existing Photos</h4><div className="grid grid-cols-3 gap-2 mt-2">{toy.photos?.length ? toy.photos.map(photo => <div key={photo.id} className="relative w-24"><div className="w-24 h-24 bg-toydb-cream flex items-center justify-center overflow-hidden rounded-lg"><img src={import.meta.env.VITE_API_BASE + photo.url} alt={photo.name} className="object-contain w-full h-full" /></div><button onClick={() => deletePhoto(photo.id)} className="absolute top-1 right-1 bg-toydb-danger text-toydb-white text-xs px-2 py-0.5 rounded">Delete</button></div>) : <div className="text-sm text-toydb-slate">No photos</div>}</div></div>
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2"><button onClick={goBackToPreviousView} className="w-full border border-toydb-border bg-toydb-white p-2 text-toydb-navy rounded-lg">Cancel</button><button onClick={deleteToy} disabled={busy} className="w-full bg-toydb-danger p-2 text-toydb-white rounded-lg">Delete Toy</button><button onClick={save} disabled={busy} className="w-full bg-toydb-teal p-2 font-medium text-toydb-white rounded-lg">{busy ? 'Saving...' : 'Save Toy'}</button></div>
          {Boolean(toy.is_wishlist) && <button onClick={moveToCollection} disabled={busy} className="w-full rounded-lg bg-toydb-gold p-2 font-medium text-toydb-navy hover:bg-toydb-gold-dark hover:text-toydb-white disabled:cursor-not-allowed disabled:opacity-60">Move to My Collection</button>}
        </div>
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

