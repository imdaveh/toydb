import React, { useState } from 'react'
import useToySuggestions from '../hooks/useToySuggestions'
import AutocompleteInput from './AutocompleteInput'

const conditions = ['New Unopened', 'Sealed Box', 'On Card', 'Open Box', 'Complete', 'Loose']
const grades = ['Excellent', 'Good', 'Fair', 'Poor', 'Broken']

export default function ToyForm({ onCreated, onCancel }){
  const [form, setForm] = useState({ name: '', manufacturer: '', series: '', sub_series: '', toyline: '', year: '', accessories: '', missing: '', notes: '', condition: '', grade: '', cost: '', value: '', source: '' })
  const [photos, setPhotos] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const suggestions = useToySuggestions()

  function updateField(field, value){ setForm(current => ({ ...current, [field]: value })) }
  function reset(){ setForm({ name: '', manufacturer: '', series: '', sub_series: '', toyline: '', year: '', accessories: '', missing: '', notes: '', condition: '', grade: '', cost: '', value: '', source: '' }); setPhotos(null) }

  async function submit(event){
    event.preventDefault(); setError(null); setLoading(true)
    try {
      const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const token = (await refresh.json()).accessToken
      if (!token) { setError('Not authenticated'); setLoading(false); return }
      const data = new FormData()
      Object.entries(form).forEach(([field, value]) => data.append(field, value))
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
      <Field label="Accessories"><textarea value={form.accessories} onChange={event => updateField('accessories', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <Field label="Missing"><textarea value={form.missing} onChange={event => updateField('missing', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <Field label="Notes"><textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} className="w-full p-2 border rounded" /></Field>
      <div className="flex gap-2"><Field label="Condition" className="flex-1"><Select value={form.condition} options={conditions} onChange={value => updateField('condition', value)} /></Field><Field label="Grade" className="flex-1"><Select value={form.grade} options={grades} onChange={value => updateField('grade', value)} /></Field></div>
      <div className="flex gap-2"><Field label="Price" className="w-32"><input value={form.cost} onChange={event => updateField('cost', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field><Field label="Value" className="w-32"><input value={form.value} onChange={event => updateField('value', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field></div>
      <Field label="Source"><AutocompleteInput value={form.source} suggestions={suggestions.source} onChange={value => updateField('source', value)} /></Field>
      <div><label className="block text-sm text-toydb-slate mb-1">Add Photos</label><input type="file" multiple accept="image/*" onChange={event => setPhotos(event.target.files)} /></div>
      <div className="flex gap-2 justify-end"><button type="button" className="border border-toydb-border bg-toydb-white text-toydb-navy p-2 rounded-lg" onClick={() => onCancel ? onCancel() : reset()} disabled={loading}>Cancel</button><button type="submit" className="bg-toydb-orange text-toydb-white font-medium p-2 rounded-lg hover:bg-toydb-orange-dark" disabled={loading}>{loading ? 'Adding...' : 'Add to collection'}</button></div>
    </form>
  )
}

function Field({ label, children, className = '' }){
  return <div className={className}><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}

function Select({ value, options, onChange }){
  return <select value={value} onChange={event => onChange(event.target.value)} className="w-full p-2 border rounded"><option value="">Select</option>{options.map(option => <option key={option}>{option}</option>)}</select>
}

