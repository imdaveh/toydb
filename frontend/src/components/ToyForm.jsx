import React, { useState } from 'react'
import useToySuggestions from '../hooks/useToySuggestions'
import useTags from '../hooks/useTags'
import AutocompleteInput from './AutocompleteInput'
import TagPicker from './TagPicker'

const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor', 'Broken']

export default function ToyForm({ wishlist = false, onCreated, onCancel }){
  const [form, setForm] = useState({ name: '', manufacturer: '', series: '', sub_series: '', theme: '', toyline: '', year: '', notes: '', condition: '', tagIds: [], accessories: [], cost: '', value: '', source: '', for_sale: false })
  const [photos, setPhotos] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const suggestions = useToySuggestions()
  const allTags = useTags()

  function updateField(field, value){ setForm(current => ({ ...current, [field]: value })) }

  function updateAccessory(index, updates) {
    setForm(current => ({
      ...current,
      accessories: (current.accessories || []).map((item, i) => i === index ? { ...item, ...updates } : item)
    }))
  }

  function addAccessory() {
    setForm(current => ({
      ...current,
      accessories: [...(current.accessories || []), { name: '', has_accessory: false }]
    }))
  }

  function removeAccessory(index) {
    setForm(current => ({
      ...current,
      accessories: (current.accessories || []).filter((_, i) => i !== index)
    }))
  }

  function reset(){ setForm({ name: '', manufacturer: '', series: '', sub_series: '', theme: '', toyline: '', year: '', notes: '', condition: '', tagIds: [], accessories: [], cost: '', value: '', source: '', for_sale: false }); setPhotos(null) }

  async function submit(event){
    event.preventDefault(); setError(null); setLoading(true)
    try {
      const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const token = (await refresh.json()).accessToken
      if (!token) { setError('Not authenticated'); setLoading(false); return }
      const data = new FormData()
      Object.entries(form).forEach(([field, value]) => { if (field !== 'tagIds' && field !== 'accessories') data.append(field, value) })
      data.append('tags', JSON.stringify(form.tagIds))
      data.append('accessories', JSON.stringify((form.accessories || []).filter(item => item.name && item.name.trim()).map(item => ({ name: item.name.trim(), has_accessory: Boolean(item.has_accessory) }))))
      data.append('wishlist', wishlist)
      data.append('for_sale', Boolean(form.for_sale))
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
      <Field label="Theme"><AutocompleteInput value={form.theme} suggestions={suggestions.theme} onChange={value => updateField('theme', value)} /></Field>
      <Field label="Condition"><Select value={form.condition} options={conditions} onChange={value => updateField('condition', value)} /></Field>
      <Field label="Tags"><TagPicker allTags={allTags} selectedTagIds={form.tagIds} onChange={value => updateField('tagIds', value)} /></Field>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-toydb-navy">Accessories</label>
          <button type="button" onClick={addAccessory} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">+ Add accessory</button>
        </div>
        {(form.accessories || []).length === 0 ? (
          <div className="rounded border border-dashed border-toydb-border bg-toydb-cream p-3 text-sm text-toydb-slate">No accessories added yet.</div>
        ) : (
          <div className="space-y-2">
            {(form.accessories || []).map((accessory, index) => (
              <div key={`new-${index}`} className="flex items-center gap-2 rounded border border-toydb-border bg-toydb-cream p-2">
                <input
                  type="checkbox"
                  checked={Boolean(accessory.has_accessory)}
                  onChange={event => updateAccessory(index, { has_accessory: event.target.checked })}
                  className="h-4 w-4 rounded border-toydb-border text-toydb-orange focus:ring-toydb-orange"
                />
                <input
                  type="text"
                  value={accessory.name}
                  onChange={event => updateAccessory(index, { name: event.target.value })}
                  placeholder="Accessory name"
                  className="flex-1 rounded border border-toydb-border bg-toydb-white p-2"
                />
                <button type="button" onClick={() => removeAccessory(index)} className="text-sm font-medium text-toydb-danger hover:text-toydb-orange-dark">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
      <Field label="Notes"><textarea value={form.notes} onChange={event => updateField('notes', event.target.value)} className="w-full p-2 border rounded" /></Field>
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

