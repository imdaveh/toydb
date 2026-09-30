import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import useToySuggestions from '../hooks/useToySuggestions'
import useTags from '../hooks/useTags'
import AutocompleteInput from '../components/AutocompleteInput'
import TagPicker from '../components/TagPicker'
import { buildFilterString, clamp, hasCropSelection, sharpenImageData } from '../utils/imageEditor'
import { exportCanvasBlob } from '../utils/photoExport'

const conditions = ['Mint', 'Excellent', 'Good', 'Fair', 'Poor', 'Broken']
const defaultEditorState = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpen: 0,
  rotation: 0,
  flipX: false,
  flipY: false,
  crop: { x: 0, y: 0, width: 1, height: 1 },
  text: '',
  textColor: '#000000',
  textPosition: { x: 0.5, y: 0.5 },
  textItems: [],
  activeTextId: null,
  drawColor: '#ef4444',
  brushSize: 8,
  strokes: []
}

export default function EditToy(){
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { isReadOnly } = useOutletContext?.() || {}
  const [toy, setToy] = useState(null)
  const [form, setForm] = useState({})
  const [photosFiles, setPhotosFiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [editor, setEditor] = useState(null)
  const [editorMode, setEditorMode] = useState('adjust')
  const [editorState, setEditorState] = useState(defaultEditorState)
  const canvasRef = useRef(null)
  const suggestionContext = {}
  const dashboardScope = location.state?.from?.state || location.state || {}
  for (const step of dashboardScope.selectedGroupPath || []) {
    if (step && ['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'year'].includes(step.field)) {
      suggestionContext[step.field] = step.value
    }
  }
  for (const filter of dashboardScope.appliedFilters || []) {
    if (filter && ['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'year'].includes(filter.field)) {
      suggestionContext[filter.field] = filter.value
    }
  }
  const imageRef = useRef(null)
  const dragRef = useRef(null)
  const suggestions = useToySuggestions({
    ...suggestionContext,
    manufacturer: form.manufacturer,
    toyline: form.toyline,
    series: form.series,
    sub_series: form.sub_series,
    theme: form.theme
  })
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
        name: data.toy.name || '', copy: data.toy.copy ?? 1, manufacturer: data.toy.manufacturer || '', series: data.toy.series || '',
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
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imageRef.current = img
      setEditorState({ ...defaultEditorState, crop: { x: 0, y: 0, width: 1, height: 1 } })
    }
    img.onerror = () => {
      setError('Unable to load the selected photo for editing.')
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

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const offscreen = document.createElement('canvas')
    offscreen.width = img.naturalWidth
    offscreen.height = img.naturalHeight
    const offCtx = offscreen.getContext('2d', { willReadFrequently: true })
    offCtx.clearRect(0, 0, offscreen.width, offscreen.height)
    offCtx.save()
    offCtx.translate(offscreen.width / 2, offscreen.height / 2)
    offCtx.rotate((editorState.rotation * Math.PI) / 180)
    offCtx.scale(editorState.flipX ? -1 : 1, editorState.flipY ? -1 : 1)
    offCtx.filter = buildFilterString({
      brightness: editorState.brightness,
      contrast: editorState.contrast,
      saturation: editorState.saturation
    })
    offCtx.drawImage(img, -offscreen.width / 2, -offscreen.height / 2, offscreen.width, offscreen.height)
    offCtx.restore()

    const crop = editorState.crop
    const sx = Math.max(0, Math.min(offscreen.width - 1, crop.x * offscreen.width))
    const sy = Math.max(0, Math.min(offscreen.height - 1, crop.y * offscreen.height))
    const sw = Math.max(1, Math.min(offscreen.width - sx, crop.width * offscreen.width))
    const sh = Math.max(1, Math.min(offscreen.height - sy, crop.height * offscreen.height))

    ctx.filter = 'none'
    ctx.drawImage(offscreen, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    if (editorState.sharpen > 0) {
      const sharpenedImage = sharpenImageData(ctx.getImageData(0, 0, canvas.width, canvas.height), editorState.sharpen)
      ctx.putImageData(sharpenedImage, 0, 0)
    }

    if ((editorState.strokes || []).length) {
      for (const stroke of editorState.strokes) {
        if (!stroke || !Array.isArray(stroke.points) || !stroke.points.length) continue
        ctx.beginPath()
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.strokeStyle = stroke.color || '#ffffff'
        ctx.lineWidth = stroke.size || 8
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let index = 1; index < stroke.points.length; index += 1) {
          const point = stroke.points[index]
          ctx.lineTo(point.x, point.y)
        }
        ctx.stroke()
      }
    }

    const activeTextId = editorState.activeTextId
    const allTextItems = Array.isArray(editorState.textItems) && editorState.textItems.length ? editorState.textItems : []
    for (const item of allTextItems) {
      const text = String(item.text || '').trim()
      if (!text) continue
      const x = clamp(item.x ?? 0.5, 0.08, 0.92) * canvas.width
      const y = clamp(item.y ?? 0.5, 0.08, 0.92) * canvas.height
      ctx.fillStyle = item.color || '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 ${Math.max(18, Math.min(canvas.width / 12, 72))}px sans-serif`
      ctx.fillText(text, x, y)
      if (activeTextId === item.id) {
        ctx.strokeStyle = 'rgba(255,255,255,0.75)'
        ctx.lineWidth = 2
        ctx.strokeRect(x - 30, y - 22, 60, 44)
      }
    }

    if (editorState.text && editorState.text.trim() && !allTextItems.length) {
      const text = editorState.text.trim()
      const x = clamp(editorState.textPosition?.x ?? 0.5, 0.08, 0.92) * canvas.width
      const y = clamp(editorState.textPosition?.y ?? 0.5, 0.08, 0.92) * canvas.height
      ctx.fillStyle = editorState.textColor || '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = `700 ${Math.max(18, Math.min(canvas.width / 12, 72))}px sans-serif`
      ctx.fillText(text, x, y)
    }

    if (hasCropSelection(dragRef.current)) {
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
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)'
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
    if (isReadOnly) {
      setError('This collection is read-only. Switch back to your own collection to edit toys.');
      return
    }
    setBusy(true); setError(null)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ ...form, copy: Number(form.copy || 1), tags: form.tagIds, accessories: form.accessories || [], for_sale: Boolean(form.for_sale), hidden: Boolean(form.hidden) }) })
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
    if (isReadOnly) {
      setError('This collection is read-only. Switch back to your own collection to delete toys.');
      return
    }
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

  async function reorderPhoto(photoId, direction){
    const photos = [...(toy?.photos || [])]
    const index = photos.findIndex(photo => photo.id === photoId)
    if (index === -1) return
    const nextIndex = direction === 'up' ? index - 1 : index + 1
    if (nextIndex < 0 || nextIndex >= photos.length) return

    const reorderedPhotos = [...photos]
    const [photo] = reorderedPhotos.splice(index, 1)
    reorderedPhotos.splice(nextIndex, 0, photo)

    setToy(current => ({ ...current, photos: reorderedPhotos }))

    const token = await getToken()
    if (!token) { setError('Not authenticated'); return }

    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + `/toys/${id}/photos/reorder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ photoIds: reorderedPhotos.map(photo => photo.id) })
      })
      const data = await response.json()
      if (!response.ok) {
        setToy(current => ({ ...current, photos: photos }))
        setError(data.error || 'Unable to reorder photos')
      }
    } catch (error) {
      setToy(current => ({ ...current, photos: photos }))
      setError('Server error')
    }
  }

  async function setPhotoAsDefault(photoId){
    const photos = [...(toy?.photos || [])]
    const index = photos.findIndex(photo => photo.id === photoId)
    if (index <= 0) return

    const reorderedPhotos = [...photos]
    const [photo] = reorderedPhotos.splice(index, 1)
    reorderedPhotos.unshift(photo)

    setToy(current => ({ ...current, photos: reorderedPhotos }))

    const token = await getToken()
    if (!token) { setError('Not authenticated'); return }

    try {
      const response = await fetch(import.meta.env.VITE_API_BASE + `/toys/${id}/photos/reorder`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token
        },
        body: JSON.stringify({ photoIds: reorderedPhotos.map(photo => photo.id) })
      })
      const data = await response.json()
      if (!response.ok) {
        setToy(current => ({ ...current, photos: photos }))
        setError(data.error || 'Unable to update default photo')
      }
    } catch (error) {
      setToy(current => ({ ...current, photos: photos }))
      setError('Server error')
    }
  }

  async function saveEditedPhoto(){
    if (!editor || !canvasRef.current) return
    setBusy(true)
    const token = await getToken()
    if (!token) { setError('Not authenticated'); setBusy(false); return }
    try {
      const canvas = canvasRef.current
      const blob = await exportCanvasBlob(canvas)

      const formData = new FormData()
      formData.append('photo', blob, editor.name || 'photo.webp')
      const response = await fetch(import.meta.env.VITE_API_BASE + `/toys/${id}/photos/${editor.photoId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      })

      const responseText = await response.text()
      let data = null
      try { data = responseText ? JSON.parse(responseText) : null } catch (error) {
        throw new Error(responseText || 'Photo update failed')
      }

      if (!response.ok) { setError(data?.error || 'Photo update failed'); setBusy(false); return }
      setEditor(null)
      await load()
    } catch (error) {
      setError(error.message || 'Server error')
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

  function clamp(value, min, max){
    return Math.min(Math.max(value, min), max)
  }

  function getCropRectPixels(crop, canvasWidth, canvasHeight){
    return {
      x: crop.x * canvasWidth,
      y: crop.y * canvasHeight,
      width: crop.width * canvasWidth,
      height: crop.height * canvasHeight
    }
  }

  function normalizeCropSelection(start, current, aspect, canvasWidth, canvasHeight){
    const rawLeft = Math.min(start.x, current.x)
    const rawTop = Math.min(start.y, current.y)
    const rawWidth = Math.abs(current.x - start.x)
    const rawHeight = Math.abs(current.y - start.y)

    if (!rawWidth || !rawHeight) {
      return { x: 0, y: 0, width: 1, height: 1 }
    }

    let nextWidth = rawWidth
    let nextHeight = rawHeight

    if (rawWidth / rawHeight > aspect) {
      nextWidth = rawHeight * aspect
    } else {
      nextHeight = rawWidth / aspect
    }

    const left = Math.min(Math.max(rawLeft + (rawWidth - nextWidth) / 2, 0), Math.max(0, canvasWidth - nextWidth))
    const top = Math.min(Math.max(rawTop + (rawHeight - nextHeight) / 2, 0), Math.max(0, canvasHeight - nextHeight))

    return {
      x: Math.min(Math.max(left / canvasWidth, 0), 1),
      y: Math.min(Math.max(top / canvasHeight, 0), 1),
      width: Math.min(Math.max(nextWidth / canvasWidth, 0.05), 1),
      height: Math.min(Math.max(nextHeight / canvasHeight, 0.05), 1)
    }
  }

  function handleEditorPointerDown(event){
    event.preventDefault()
    const point = getPointerPosition(event)

    if (editorMode === 'draw') {
      const stroke = { color: editorState.drawColor, size: editorState.brushSize, points: [point] }
      dragRef.current = { active: true, type: 'draw', stroke }
      setEditorState(current => ({
        ...current,
        strokes: [...(current.strokes || []), stroke]
      }))
      return
    }

    if (editorMode === 'text') {
      const items = editorState.textItems || []
      let activeId = editorState.activeTextId || null
      if (items.length) {
        const canvasWidth = canvasRef.current?.width || 1
        const canvasHeight = canvasRef.current?.height || 1
        const hit = [...items].reverse().find(item => {
          const centerX = item.x * canvasWidth
          const centerY = item.y * canvasHeight
          const distance = Math.hypot(point.x - centerX, point.y - centerY)
          return distance < 60
        })
        activeId = hit ? hit.id : (activeId || items[items.length - 1]?.id || null)
      }

      dragRef.current = {
        active: true,
        type: 'text',
        targetId: activeId,
        start: point,
        startPosition: getTextPosition(activeId)
      }
      setEditorState(current => ({ ...current, activeTextId: activeId }))
      return
    }

    dragRef.current = { active: true, type: 'crop', start: point, current: point }
  }

  function getTextPosition(textId){
    const targetItem = (editorState.textItems || []).find(item => item.id === textId)
    if (!targetItem) return { x: editorState.textPosition?.x ?? 0.5, y: editorState.textPosition?.y ?? 0.5 }
    return { x: targetItem.x, y: targetItem.y }
  }

  function handleEditorPointerMove(event){
    if (!dragRef.current || !dragRef.current.active) return
    event.preventDefault()
    dragRef.current.current = getPointerPosition(event)

    if (dragRef.current.type === 'draw') {
      const point = dragRef.current.current
      setEditorState(current => {
        const nextStrokes = [...(current.strokes || [])]
        const lastStroke = nextStrokes[nextStrokes.length - 1]
        if (lastStroke) {
          lastStroke.points = [...(lastStroke.points || []), point]
        }
        return { ...current, strokes: nextStrokes }
      })
      return
    }

    if (dragRef.current.type === 'text' && canvasRef.current) {
      const textItems = editorState.textItems || []
      const targetId = dragRef.current.targetId || editorState.activeTextId || textItems[textItems.length - 1]?.id || null
      if (!targetId) return

      const point = dragRef.current.current
      const start = dragRef.current.start
      const dx = (point.x - start.x) / canvasRef.current.width
      const dy = (point.y - start.y) / canvasRef.current.height
      const startPosition = dragRef.current.startPosition || { x: 0.5, y: 0.5 }
      const nextX = clamp(startPosition.x + dx, 0.08, 0.92)
      const nextY = clamp(startPosition.y + dy, 0.08, 0.92)

      setEditorState(current => ({
        ...current,
        textItems: (current.textItems || []).map(item => item.id === targetId ? { ...item, x: nextX, y: nextY } : item),
        activeTextId: targetId
      }))
      return
    }

    setEditorState(current => ({ ...current }))
  }

  function handleEditorPointerUp(){
    if (!dragRef.current || !dragRef.current.active || !canvasRef.current || !imageRef.current) return

    if (dragRef.current.type === 'draw' || dragRef.current.type === 'text') {
      dragRef.current.active = false
      dragRef.current = null
      return
    }

    const { start, current } = dragRef.current
    const aspect = imageRef.current.naturalWidth / imageRef.current.naturalHeight
    const crop = normalizeCropSelection(start, current, aspect, canvasRef.current.width, canvasRef.current.height)
    dragRef.current.active = false
    dragRef.current = null
    setEditorState(currentState => ({
      ...currentState,
      crop
    }))
  }

  function resetEditorState(){
    setEditorState({ ...defaultEditorState, crop: { x: 0, y: 0, width: 1, height: 1 } })
    setEditorMode('adjust')
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

  if (isReadOnly) {
    return <div className="rounded-lg border border-toydb-border bg-toydb-white p-6 text-sm text-toydb-slate">This collection is read-only. Switch back to your own collection to edit toys.</div>
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
        <div className="grid grid-cols-2 gap-2">
          <Field label="Condition" className="min-w-0"><Select value={form.condition} values={conditions} onChange={value => updateField('condition', value)} /></Field>
          <Field label="Copy" className="min-w-0"><input value={form.copy ?? 1} onChange={event => updateField('copy', event.target.value)} type="number" min="1" step="1" className="w-full p-2 border rounded" /></Field>
        </div>
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
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold">Existing Photos</h4>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">Default photo is first</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">{toy.photos?.length ? toy.photos.map((photo, index) => <div key={photo.id} className="relative w-24">
            <div className="relative w-24 h-24 bg-toydb-cream flex items-center justify-center overflow-hidden rounded-lg">
              <img src={import.meta.env.VITE_API_BASE + photo.url} alt={photo.name} className="object-contain w-full h-full" />
              {index === 0 && (
                <span title="Default photo" className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-toydb-gold/95 text-[11px] font-bold text-toydb-navy shadow-sm">★</span>
              )}
              <button type="button" onClick={() => setEditor({ photoId: photo.id, imageUrl: photo.url, name: photo.name })} className="absolute top-1 left-1 bg-toydb-teal text-toydb-white text-[10px] px-2 py-0.5 rounded shadow-sm">Edit</button>
              <button type="button" onClick={() => deletePhoto(photo.id)} className="absolute top-1 right-1 bg-toydb-danger text-toydb-white text-[10px] px-2 py-0.5 rounded shadow-sm">Delete</button>
            </div>
            {index > 0 && <button type="button" onClick={() => setPhotoAsDefault(photo.id)} className="mt-1 w-full rounded border border-toydb-border bg-toydb-white px-1 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-toydb-navy">Use as default</button>}
          </div>) : <div className="text-sm text-toydb-slate">No photos</div>}</div>
        </div>
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
                    <div className="relative overflow-hidden rounded-xl border border-toydb-border bg-toydb-cream p-2">
                      {editorMode === 'draw' || editorMode === 'text' ? null : (
                        <div className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-toydb-teal bg-toydb-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-teal-dark shadow-sm backdrop-blur-sm">
                          <IconCrop />
                          Crop
                        </div>
                      )}
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
                      <div className="rounded-xl border border-toydb-border bg-toydb-cream p-2">
                        <div className="mb-2 grid grid-cols-3 gap-1.5">
                          <EditorToolButton active={editorMode === 'adjust'} onClick={() => setEditorMode('adjust')} label="Adjust" />
                          <EditorToolButton active={editorMode === 'text'} onClick={() => setEditorMode('text')} label="Text" />
                          <EditorToolButton active={editorMode === 'draw'} onClick={() => setEditorMode('draw')} label="Draw" />
                        </div>

                        {editorMode !== 'adjust' && (
                          <div className="flex items-center justify-center gap-1.5">
                            <EditorActionButton title="Rotate left" ariaLabel="Rotate left" onClick={() => setEditorState(current => ({ ...current, rotation: (current.rotation - 90 + 360) % 360 }))}>
                              <IconRotateLeft />
                            </EditorActionButton>
                            <EditorActionButton title="Rotate right" ariaLabel="Rotate right" onClick={() => setEditorState(current => ({ ...current, rotation: (current.rotation + 90) % 360 }))}>
                              <IconRotateRight />
                            </EditorActionButton>
                            <EditorActionButton title="Flip horizontal" ariaLabel="Flip horizontal" onClick={() => setEditorState(current => ({ ...current, flipX: !current.flipX }))}>
                              <IconFlipHorizontal />
                            </EditorActionButton>
                            <EditorActionButton title="Flip vertical" ariaLabel="Flip vertical" onClick={() => setEditorState(current => ({ ...current, flipY: !current.flipY }))}>
                              <IconFlipVertical />
                            </EditorActionButton>
                          </div>
                        )}
                      </div>

                      {editorMode === 'adjust' && (
                        <div className="space-y-3 rounded-xl border border-toydb-border bg-toydb-cream p-3">
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">
                              <span>Brightness</span>
                              <span>{editorState.brightness}%</span>
                            </div>
                            <input type="range" min="40" max="180" step="1" value={editorState.brightness} onChange={event => setEditorState(current => ({ ...current, brightness: Number(event.target.value) }))} className="w-full accent-toydb-teal" />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">
                              <span>Contrast</span>
                              <span>{editorState.contrast}%</span>
                            </div>
                            <input type="range" min="50" max="200" step="1" value={editorState.contrast} onChange={event => setEditorState(current => ({ ...current, contrast: Number(event.target.value) }))} className="w-full accent-toydb-teal" />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">
                              <span>Saturation</span>
                              <span>{editorState.saturation}%</span>
                            </div>
                            <input type="range" min="0" max="200" step="1" value={editorState.saturation} onChange={event => setEditorState(current => ({ ...current, saturation: Number(event.target.value) }))} className="w-full accent-toydb-teal" />
                          </div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">
                              <span>Sharpen</span>
                              <span>{editorState.sharpen}%</span>
                            </div>
                            <input type="range" min="0" max="40" step="1" value={editorState.sharpen} onChange={event => setEditorState(current => ({ ...current, sharpen: Number(event.target.value) }))} className="w-full accent-toydb-teal" />
                          </div>
                        </div>
                      )}

                      {editorMode === 'text' && (
                        <div className="space-y-2 rounded-xl border border-toydb-border bg-toydb-cream p-3">
                          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">Text overlay</label>
                          <input type="text" value={editorState.text} onChange={event => setEditorState(current => ({ ...current, text: event.target.value }))} placeholder="Type your caption" className="w-full rounded-lg border border-toydb-border bg-toydb-white p-2 text-sm text-toydb-navy" />
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => {
                              const value = editorState.text.trim()
                              if (!value) return
                              const item = {
                                id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                                text: value,
                                color: editorState.textColor,
                                x: editorState.textPosition?.x ?? 0.5,
                                y: editorState.textPosition?.y ?? 0.5
                              }
                              setEditorState(current => ({
                                ...current,
                                textItems: [...(current.textItems || []), item],
                                activeTextId: item.id,
                                text: '',
                                textPosition: { x: 0.5, y: 0.5 }
                              }))
                            }} className="flex-1 rounded-lg bg-toydb-teal px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-toydb-white">Add Text</button>
                            <button type="button" onClick={() => setEditorState(current => ({ ...current, activeTextId: null }))} className="rounded-lg border border-toydb-border bg-toydb-white px-3 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-navy">Clear</button>
                          </div>
                          <p className="text-[10px] text-toydb-slate">Drag on the photo to move each text layer.</p>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">Color</label>
                            <div className="flex flex-wrap gap-2">
                              {['#000000', '#ffffff', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'].map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  aria-label={`Use ${color} for text`}
                                  onClick={() => setEditorState(current => ({ ...current, textColor: color }))}
                                  className={['h-7 w-7 rounded-full border-2', editorState.textColor === color ? 'border-toydb-navy scale-110' : 'border-transparent'].join(' ')}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {editorMode === 'draw' && (
                        <div className="space-y-2 rounded-xl border border-toydb-border bg-toydb-cream p-3">
                          <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-toydb-slate">Brush</label>
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#111827', '#ffffff'].map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  aria-label={`Use ${color} for drawing`}
                                  onClick={() => setEditorState(current => ({ ...current, drawColor: color }))}
                                  className={['h-7 w-7 rounded-full border-2', editorState.drawColor === color ? 'border-toydb-navy scale-110' : 'border-transparent'].join(' ')}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                            <input type="range" min="2" max="24" step="1" value={editorState.brushSize} onChange={event => setEditorState(current => ({ ...current, brushSize: Number(event.target.value) }))} className="w-full accent-toydb-teal" />
                          </div>
                        </div>
                      )}

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

function EditorToolButton({ active, onClick, label }){
  return (
    <button
      type="button"
      onClick={onClick}
      className={['flex-1 rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-[0.18em] transition', active ? 'border-toydb-teal bg-toydb-teal text-toydb-white shadow-sm' : 'border-toydb-border bg-toydb-white text-toydb-navy hover:border-toydb-teal hover:bg-toydb-cream'].join(' ')}
    >
      {label}
    </button>
  )
}

function EditorActionButton({ title, ariaLabel, onClick, children }){
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-toydb-border bg-toydb-white text-toydb-navy shadow-sm transition hover:border-toydb-teal hover:bg-toydb-teal/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-teal focus-visible:ring-offset-2 sm:h-10 sm:w-10"
    >
      {children}
    </button>
  )
}

function IconCrop(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 sm:h-4 sm:w-4">
      <path d="M7 4v10a2 2 0 0 0 2 2h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 20V9a2 2 0 0 0-2-2H5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRotateLeft(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5">
      <path d="M8 8h8a4 4 0 1 1 0 8H10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8l2-2M8 8l2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconRotateRight(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5">
      <path d="M16 8H8a4 4 0 1 0 0 8h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 8l-2-2M16 8l-2 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconFlipHorizontal(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5">
      <path d="M5 7h14M5 12h14M5 17h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />
      <path d="M8 4v16M16 4v16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8l-3 4 3 4M16 8l3 4-3 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconFlipVertical(){
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 sm:h-5 sm:w-5">
      <path d="M7 5v14M12 5v14M17 5v14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.28" />
      <path d="M4 8h16M4 16h16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 8l4-3 4 3M8 16l4 3 4-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Field({ label, children, className = '' }){
  return <div className={className}><label className="block text-sm font-medium text-toydb-navy mb-1">{label}</label>{children}</div>
}

function Select({ value, values, onChange }){
  return <select value={value || ''} onChange={event => onChange(event.target.value)} className="w-full p-2 border rounded"><option value="">Select</option>{values.map(option => <option key={option}>{option}</option>)}</select>
}

