import React, { useState } from 'react'
import useToySuggestions from '../hooks/useToySuggestions'
import useTags from '../hooks/useTags'
import AutocompleteInput from './AutocompleteInput'
import TagPicker from './TagPicker'

const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor', 'Broken']

export default function ToyForm({ wishlist = false, onCreated, onCancel }){
  const [form, setForm] = useState({ name: '', manufacturer: '', series: '', sub_series: '', toyline: '', year: '', included: '', missing: '', broken: '', notes: '', condition: '', tagIds: [], cost: '', value: '', source: '' })
  const [photos, setPhotos] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const suggestions = useToySuggestions()
  const allTags = useTags()

  function updateField(field, value){ setForm(current => ({ ...current, [field]: value })) }
  function reset(){ setForm({ name: '', manufacturer: '', series: '', sub_series: '', toyline: '', year: '', included: '', missing: '', broken: '', notes: '', condition: '', tagIds: [], cost: '', value: '', source: '' }); setPhotos(null) }

  async function submit(event){
    event.preventDefault(); setError(null); setLoading(true)
    try {
      const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const token = (await refresh.json()).accessToken
      if (!token) { setError('Not authenticated'); setLoading(false); return }
      const data = new FormData()
      Object.entries(form).forEach(([field, value]) => { if (field !== 'tagIds') data.append(field, value) })
      data.append('tags', JSON.stringify(form.tagIds))
      data.append('wishlist', wishlist)
      if (photos) Array.from(photos).forEach(photo => data.append('photos', photo))
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys', { method: 'POST', credentials: 'include', headers: { Authorization: 'Bearer ' + token }, body: data })
      const result = await response.json()
      if (!response.ok) { setError(result.error || 'Failed'); setLoading(false); return }
      reset()
      if (onCreated) onCreated()
    } catch (error) { setError('Server error') }
    setLoading(false)
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>}
      <Field label="Name"><input required value={form.name} onChange={event => updateField('name', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <div className="flex gap-2"><Field label="Year" className="w-24"><input value={form.year} onChange={event => updateField('year', event.target.value)} type="number" min="1800" max="2100" className="w-full p-2 border rounded" /></Field><Field label="Manufacturer" className="flex-1"><AutocompleteInput value={form.manufacturer} suggestions={suggestions.manufacturer} onChange={value => updateField('manufacturer', value)} /></Field></div>
      <Field label="Toyline"><AutocompleteInput value={form.toyline} suggestions={suggestions.toyline} onChange={value => updateField('toyline', value)} /></Field>
      <Field label="Series"><AutocompleteInput value={form.series} suggestions={suggestions.series} onChange={value => updateField('series', value)} /></Field>
      <Field label="Sub-series"><AutocompleteInput value={form.sub_series} suggestions={suggestions.sub_series} onChange={value => updateField('sub_series', value)} /></Field>
      <Field label="Condition"><Select value={form.condition} options={conditions} onChange={value => updateField('condition', value)} /></Field>
      <Field label="Tags"><TagPicker allTags={allTags} selectedTagIds={form.tagIds} onChange={value => updateField('tagIds', value)} /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <Field label="Included"><textarea value={form.included} onChange={event => updateField('included', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <Field label="Missing"><textarea value={form.missing} onChange={event => updateField('missing', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <Field label="Broken"><textarea value={form.broken} onChange={event => updateField('broken', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <div className="flex gap-2"><Field label="Cost" className="w-1/2"><input value={form.cost} onChange={event => updateField('cost', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field><Field label="Value" className="w-1/2"><input value={form.value} onChange={event => updateField('value', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field></div>
      <Field label="Source"><AutocompleteInput value={form.source} suggestions={suggestions.source} onChange={value => updateField('source', value)} /></Field>
      <div><label className="block text-sm text-toydb-slate mb-1">Add Photos</label><input type="file" multiple accept="image/*" onChange={event => setPhotos(event.target.files)} /></div>
      <div className="flex gap-2 justify-end"><button type="button" className="border border-toydb-border bg-toydb-white text-toydb-navy p-2 rounded-lg" onClick={() => onCancel ? onCancel() : reset()} disabled={loading}>Cancel</button><button type="submit" className="bg-toydb-orange text-toydb-white font-medium p-2 rounded-lg hover:bg-toydb-orange-dark" disabled={loading}>{loading ? 'Adding...' : wishlist ? 'Add to wishlist' : 'Add to collection'}</button></div>
    </form>
  )
}

function Field({ label, children, className = '' }){
  return <div className={className}><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}

function Select({ value, options, onChange }){
  return <select value={value} onChange={event => onChange(event.target.value)} className="w-full p-2 border rounded"><option value="">Select</option>{options.map(option => <option key={option}>{option}</option>)}</select>
}

