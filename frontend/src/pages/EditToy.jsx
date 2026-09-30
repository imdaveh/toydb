import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import useToySuggestions from '../hooks/useToySuggestions'
import useTags from '../hooks/useTags'
import AutocompleteInput from '../components/AutocompleteInput'
import TagPicker from '../components/TagPicker'

const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor', 'Broken']
const defaultEditorState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  rotation: 0,
  flipX: false,
  flipY: false,
  crop: { x: 0, y: 0, width: 1, height: 1 }
}

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
  const [editor, setEditor] = useState(null)
  const [editorState, setEditorState] = useState(defaultEditorState)
  const canvasRef = useRef(null)
  const imageRef = useRef(null)
  const dragRef = useRef(null)
  const suggestions = useToySuggestions()
  const allTags = useTags()

  function normalizeAccessoryList(items) {
    if (!Array.isArray(items)) return []
    return items.map(item => ({
      id: item.id || null,
      name: String(item.name || '').trim(),
      has_accessory: Boolean(item.has_accessory)
    })).filter(item => item.name)
  }

  async function getToken(){
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      return (await response.json()).accessToken
    } catch (error) { return null }
  }

  async function load(){
    setLoading(true); setError(null)
    const token = await getToken()
    if (!token) {
      setError('Please log in to view this toy.')
      setLoading(false)
      return
    }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { headers: { Authorization: 'Bearer ' + token } })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Failed'); return }
      setToy(data.toy)
      setForm({
        name: data.toy.name || '', manufacturer: data.toy.manufacturer || '', series: data.toy.series || '',
        sub_series: data.toy.sub_series || '', theme: data.toy.theme || '', toyline: data.toy.toyline || '', year: data.toy.year || '',
        notes: data.toy.notes || '', condition: data.toy.condition || '', tagIds: (data.toy.tags || []).map(tag => tag.id), cost: data.toy.cost || '',
        value: data.toy.value || '', source: data.toy.source || '', for_sale: Boolean(data.toy.for_sale), hidden: Boolean(data.toy.hidden),
        accessories: normalizeAccessoryList(data.toy.accessories || [])
      })
    } catch (error) { setError('Server error') }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    if (!editor) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [editor])

  useEffect(() => {
    if (!editor) return
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setEditorState({ ...defaultEditorState, crop: { x: 0, y: 0, width: 1, height: 1 } })
    }
    img.src = import.meta.env.VITE_API_BASE + editor.imageUrl
  }, [editor])

  useEffect(() => {
    if (!editor || !canvasRef.current || !imageRef.current) return

    const canvas = canvasRef.current
    const img = imageRef.current
    const maxWidth = 760
    const maxHeight = 760
    const scale = Math.min(maxWidth / img.naturalWidth, maxHeight / img.naturalHeight)
    const renderWidth = Math.max(1, Math.round(img.naturalWidth * scale))
    const renderHeight = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.width = renderWidth
    canvas.height = renderHeight

    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const offscreen = document.createElement('canvas')
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const offCtx = offscreen.getContext('2d')
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height)
    offCtx.save()
    offCtx.translate(offscreen.width / 2, offscreen.height / 2)
    offCtx.rotate((editorState.rotation * Math.PI) / 180)
    offCtx.scale(editorState.flipX ? -1 : 1, editorState.flipY ? -1 : 1)
    offCtx.filter = `brightness(${editorState.brightness}%) contrast(${editorState.contrast}%) saturate(${editorState.saturation}%)`
    offCtx.drawImage(img, -offscreen.width / 2, -offscreen.height / 2, offscreen.width, offscreen.height)
    offCtx.restore()

    const crop = editorState.crop
    const sx = Math.max(0, Math.min(offscreen.width - 1, crop.x * offscreen.width))
    const sy = Math.max(0, Math.min(offscreen.height - 1, crop.y * offscreen.height))
    const sw = Math.max(1, Math.min(offscreen.width - sx, crop.width * offscreen.width))
    const sh = Math.max(1, Math.min(offscreen.height - sy, crop.height * offscreen.height))

    ctx.filter = 'none'
    ctx.drawImage(offscreen, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    if (dragRef.current && dragRef.current.active) {
      const start = dragRef.current.start
      const current = dragRef.current.current
      const left = Math.min(start.x, current.x)
      const top = Math.min(start.y, current.y)
      const width = Math.abs(current.x - start.x)
      const height = Math.abs(current.y - start.y)
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 2
      ctx.setLineDash([8, 6])
      ctx.strokeRect(left, top, width, height)
      ctx.fillStyle = 'rgba(255,255,255,0.15)'
      ctx.fillRect(left, top, width, height)
      ctx.setLineDash([])
    }
  }, [editor, editorState])

  function getReturnNavigation(){
    const defaultPath = toy.hidden ? '/hidden' : (toy.is_wishlist ? '/wishlist' : '/dashboard')
    const returnTarget = location.state?.from || defaultPath
    const returnPath = typeof returnTarget === 'string' ? returnTarget : returnTarget?.pathname || defaultPath
    const returnState = typeof returnTarget === 'string'
      ? { refresh: Date.now() }
      : { ...(returnTarget?.state || {}), refresh: Date.now() }

    return { returnPath, returnState }
  }

  function goBackToPreviousView(){
    const { returnPath, returnState } = getReturnNavigation()
    navigate(returnPath, { state: returnState })
  }

  async function save(){
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...form, tags: form.tagIds, accessories: form.accessories || [], for_sale: Boolean(form.for_sale), hidden: Boolean(form.hidden) }) })
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
      const { returnPath, returnState } = getReturnNavigation()
      navigate(returnPath, { state: returnState })
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

  async function saveEditedPhoto(){
    if (!editor || !canvasRef.current) return
    setBusy(true)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const canvas = canvasRef.current
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82))
      if (!blob) throw new Error('Unable to export photo')

      const formData = new FormData()
      formData.append('photo', blob, editor.name || 'photo.webp')
      const response = await fetch(import.meta.env.VITE_API_BASE + `/toys/${id}/photos/${editor.photoId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      })
      const data = await response.json()
      if (!response.ok) { setError(data.error || 'Photo update failed'); setBusy(false); return }
      setEditor(null)
      await load()
    } catch (error) {
      setError('Server error')
    }
    setBusy(false)
  }

  function getPointerPosition(event){
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * canvas.width,
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1) * canvas.height
    }
  }

  function handleEditorPointerDown(event){
    event.preventDefault()
    const point = getPointerPosition(event)
    dragRef.current = { active: true, start: point, current: point }
  }

  function handleEditorPointerMove(event){
    if (!dragRef.current || !dragRef.current.active) return
    event.preventDefault()
    dragRef.current.current = getPointerPosition(event)
    setEditorState(current => ({ ...current }))
  }

  function handleEditorPointerUp(){
    if (!dragRef.current || !dragRef.current.active) return
    const { start, current } = dragRef.current
    const x = Math.min(start.x, current.x) / canvasRef.current.width
    const y = Math.min(start.y, current.y) / canvasRef.current.height
    const width = Math.abs(current.x - start.x) / canvasRef.current.width
    const height = Math.abs(current.y - start.y) / canvasRef.current.height
    dragRef.current.active = false
    setEditorState(current => ({
      ...current,
      crop: {
        x: Math.min(Math.max(x, 0), 1),
        y: Math.min(Math.max(y, 0), 1),
        width: Math.min(Math.max(width, 0.05), 1),
        height: Math.min(Math.max(height, 0.05), 1)
      }
    }))
  }

  function resetEditorState(){
    setEditorState({ ...defaultEditorState, crop: { x: 0, y: 0, width: 1, height: 1 } })
  }

  function updateImageAdjustment(field, value){
    setEditorState(current => ({ ...current, [field]: Number(value) }))
  }

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
      accessories: [...(current.accessories || []), { id: null, name: '', has_accessory: false }]
    }))
  }

  function removeAccessory(index) {
    setForm(current => ({
      ...current,
      accessories: (current.accessories || []).filter((_, i) => i !== index)
    }))
  }

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
        <div className="flex items-center gap-2 rounded border border-toydb-border bg-toydb-cream px-3 py-2">
          <input id="hidden-checkbox" type="checkbox" checked={Boolean(form.hidden)} onChange={event => updateField('hidden', event.target.checked)} className="h-4 w-4 rounded border-toydb-border text-toydb-orange focus:ring-toydb-orange" />
          <label htmlFor="hidden-checkbox" className="text-sm font-medium text-toydb-navy">Hidden</label>
        </div>
        <Field label="Tags"><TagPicker allTags={allTags} selectedTagIds={form.tagIds || []} onChange={value => updateField('tagIds', value)} /></Field>
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
                <div key={`${accessory.id || 'new'}-${index}`} className="flex items-center gap-2 rounded border border-toydb-border bg-toydb-cream p-2">
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
        <Field label="Notes"><textarea value={form.notes || ''} onChange={event => updateField('notes', event.target.value)} className="w-full p-2 border rounded" /></Field>
        <div className="flex gap-2"><Field label="Cost" className="w-1/2"><input value={form.cost} onChange={event => updateField('cost', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field><Field label="Value" className="w-1/2"><input value={form.value} onChange={event => updateField('value', event.target.value)} type="number" min="0" step="0.01" className="w-full p-2 border rounded" /></Field></div>
        <Field label="Source"><AutocompleteInput value={form.source} suggestions={suggestions.source} onChange={value => updateField('source', value)} /></Field>
        <div>
          <label className="block text-sm text-toydb-slate mb-1">Add Photos</label>
          <input type="file" multiple accept="image/*" onChange={event => setPhotosFiles(Array.from(event.target.files || []))} />
        </div>
        <div><h4 className="font-semibold">Existing Photos</h4><div className="grid grid-cols-3 gap-2 mt-2">{toy.photos?.length ? toy.photos.map(photo => <div key={photo.id} className="relative w-24"><div className="w-24 h-24 bg-toydb-cream flex items-center justify-center overflow-hidden rounded-lg"><img src={import.meta.env.VITE_API_BASE + photo.url} alt={photo.name} className="object-contain w-full h-full" /></div><button type="button" onClick={() => setEditor({ photoId: photo.id, imageUrl: photo.url, name: photo.name })} className="absolute top-1 left-1 bg-toydb-teal text-toydb-white text-[10px] px-2 py-0.5 rounded">Edit</button><button type="button" onClick={() => deletePhoto(photo.id)} className="absolute top-1 right-1 bg-toydb-danger text-toydb-white text-[10px] px-2 py-0.5 rounded">Delete</button></div>) : <div className="text-sm text-toydb-slate">No photos</div>}</div></div>
        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-3 gap-2"><button onClick={goBackToPreviousView} className="w-full border border-toydb-border bg-toydb-white p-2 text-toydb-navy rounded-lg">Cancel</button><button onClick={deleteToy} disabled={busy} className="w-full bg-toydb-danger p-2 text-toydb-white rounded-lg">Delete Toy</button><button onClick={save} disabled={busy} className="w-full bg-toydb-teal p-2 font-medium text-toydb-white rounded-lg">{busy ? 'Saving...' : 'Save Toy'}</button></div>
          {Boolean(toy.is_wishlist) && <button onClick={moveToCollection} disabled={busy} className="w-full rounded-lg bg-toydb-gold p-2 font-medium text-toydb-navy hover:bg-toydb-gold-dark hover:text-toydb-white disabled:cursor-not-allowed disabled:opacity-60">Move to My Collection</button>}
        </div>
      </div>

      {editor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-3 sm:p-4">
          <div className="mx-auto flex min-h-full w-full max-w-4xl items-center justify-center py-4">
            <div className="w-full overflow-hidden rounded-2xl bg-toydb-white shadow-xl">
              <div className="max-h-[90vh] overflow-y-auto">
                <div className="p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-lg font-bold text-toydb-navy">Adjust photo</h3>
                    <button type="button" onClick={() => setEditor(null)} className="inline-flex items-center justify-center rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-semibold text-toydb-navy shadow-sm transition hover:border-toydb-teal hover:bg-toydb-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal focus-visible:ring-offset-2">Close</button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="overflow-hidden rounded-xl border border-toydb-border bg-toydb-cream p-2">
                      <canvas
                        ref={canvasRef}
                        className="mx-auto max-h-[50vh] w-full cursor-crosshair rounded-lg bg-toydb-white object-contain touch-none sm:max-h-[60vh]"
                        onPointerDown={handleEditorPointerDown}
                        onPointerMove={handleEditorPointerMove}
                        onPointerUp={handleEditorPointerUp}
                        onPointerLeave={handleEditorPointerUp}
                      />
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-xl border border-toydb-border bg-toydb-cream p-1.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <EditorActionButton title="Rotate left" ariaLabel="Rotate left" onClick={() => setEditorState(current => ({ ...current, rotation: (current.rotation - 90 + 360) % 360 }))}>↺</EditorActionButton>
                          <span className="min-w-0 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-toydb-slate">Rotate</span>
                          <EditorActionButton title="Rotate right" ariaLabel="Rotate right" onClick={() => setEditorState(current => ({ ...current, rotation: (current.rotation + 90) % 360 }))}>↻</EditorActionButton>
                        </div>
                        <div className="mt-2 flex items-center justify-center gap-1.5">
                          <EditorActionButton title="Flip horizontal" ariaLabel="Flip horizontal" onClick={() => setEditorState(current => ({ ...current, flipX: !current.flipX }))}>↔</EditorActionButton>
                          <span className="min-w-0 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-toydb-slate">Flip</span>
                          <EditorActionButton title="Flip vertical" ariaLabel="Flip vertical" onClick={() => setEditorState(current => ({ ...current, flipY: !current.flipY }))}>↕</EditorActionButton>
                        </div>
                      </div>
                      <label className="block text-sm font-semibold text-toydb-navy">
                        Brightness
                        <input type="range" min="0" max="200" value={editorState.brightness} onInput={event => updateImageAdjustment('brightness', event.target.value)} onChange={event => updateImageAdjustment('brightness', event.target.value)} className="mt-1 w-full accent-toydb-teal" />
                      </label>
                      <label className="block text-sm font-semibold text-toydb-navy">
                        Contrast
                        <input type="range" min="0" max="200" value={editorState.contrast} onInput={event => updateImageAdjustment('contrast', event.target.value)} onChange={event => updateImageAdjustment('contrast', event.target.value)} className="mt-1 w-full accent-toydb-teal" />
                      </label>
                      <label className="block text-sm font-semibold text-toydb-navy">
                        Saturation
                        <input type="range" min="0" max="200" value={editorState.saturation} onInput={event => updateImageAdjustment('saturation', event.target.value)} onChange={event => updateImageAdjustment('saturation', event.target.value)} className="mt-1 w-full accent-toydb-teal" />
                      </label>
                      <button type="button" onClick={resetEditorState} className="w-full rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-sm font-semibold text-toydb-navy shadow-sm transition hover:border-toydb-teal hover:bg-toydb-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal focus-visible:ring-offset-2">Reset</button>
                      <button type="button" onClick={saveEditedPhoto} disabled={busy} className="w-full rounded-lg bg-toydb-teal px-3 py-2 text-sm font-semibold text-toydb-white shadow-sm transition hover:bg-toydb-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Saving...' : 'Save edited photo'}</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EditorActionButton({ title, ariaLabel, onClick, children }){
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-toydb-border bg-toydb-white text-lg leading-none text-toydb-navy shadow-sm transition hover:border-toydb-teal hover:bg-toydb-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal focus-visible:ring-offset-2 sm:h-10 sm:w-10 sm:text-xl"
    >
      {children}
    </button>
  )
}

function Field({ label, children, className = '' }){
  return <div className={className}><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}

function Select({ value, values, onChange }){
  return <select value={value || ''} onChange={event => onChange(event.target.value)} className="w-full p-2 border rounded"><option value="">Select</option>{values.map(option => <option key={option}>{option}</option>)}</select>
}

