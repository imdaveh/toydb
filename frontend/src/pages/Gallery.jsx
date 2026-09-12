import React, { useEffect, useState } from 'react'

export default function Gallery(){
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState(null)
  const [newPhoto, setNewPhoto] = useState(null)
  const [caption, setCaption] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [draftCaption, setDraftCaption] = useState('')

  async function getToken(){
    const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
    const data = await refresh.json()
    return data.accessToken || null
  }

  async function loadGallery(){
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) {
        setPhotos([])
        setError('Please log in to view your gallery.')
        setLoading(false)
        return
      }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/gallery', {
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Unable to load gallery')
        setPhotos([])
        setLoading(false)
        return
      }
      setPhotos(data.photos || [])
    } catch (error) {
      setError('Unable to reach the ToyDB server.')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadGallery()
  }, [])

  async function handleUpload(event){
    event.preventDefault()
    if (!newPhoto) {
      setError('Choose a photo to upload first.')
      return
    }

    setUploading(true)
    setError(null)
    try {
      const token = await getToken()
      if (!token) {
        setError('Please log in to upload a gallery photo.')
        return
      }
      const data = new FormData()
      data.append('photo', newPhoto)
      if (caption.trim()) data.append('caption', caption.trim())

      const response = await fetch(import.meta.env.VITE_API_BASE + '/gallery', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token },
        body: data
      })
      const result = await response.json()
      if (!response.ok) {
        setError(result.error || 'Photo upload failed')
        return
      }
      setPhotos(current => [result.photo, ...current])
      setNewPhoto(null)
      setCaption('')
      setShowForm(false)
      event.target.reset()
    } catch (error) {
      setError('Unable to upload the photo.')
    }
    setUploading(false)
  }

  async function saveCaption(photoId){
    const value = draftCaption.trim()
    try {
      const token = await getToken()
      if (!token) {
        setError('Please log in to update your gallery.')
        return
      }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/gallery/' + photoId, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ caption: value })
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Unable to update caption')
        return
      }
      setPhotos(current => current.map(photo => photo.id === photoId ? { ...photo, caption: data.caption || '' } : photo))
      setEditingId(null)
      setDraftCaption('')
      setError(null)
    } catch (error) {
      setError('Unable to update the caption.')
    }
  }

  async function deletePhoto(photoId){
    if (!window.confirm('Delete this gallery photo?')) return

    try {
      const token = await getToken()
      if (!token) {
        setError('Please log in to delete gallery photos.')
        return
      }
      const response = await fetch(import.meta.env.VITE_API_BASE + '/gallery/' + photoId, {
        method: 'DELETE',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + token }
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Unable to delete photo')
        return
      }
      setPhotos(current => current.filter(photo => photo.id !== photoId))
      if (selectedPhoto && selectedPhoto.id === photoId) setSelectedPhoto(null)
      setError(null)
    } catch (error) {
      setError('Unable to delete the photo.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-toydb-navy">Gallery</h1>
          <p className="mt-1 text-sm text-toydb-slate">Saved photos and captions for your collection.</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)} className="rounded-lg bg-toydb-teal px-3 py-2 text-sm font-medium text-toydb-white shadow-sm hover:bg-toydb-teal-dark">
          {showForm ? 'Close form' : '+ Add Gallery Photo'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="rounded-2xl border border-toydb-border bg-toydb-white p-4 shadow-sm">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            <div>
              <label className="mb-1 block text-sm font-medium text-toydb-slate">Choose photo</label>
              <input type="file" accept="image/*" onChange={event => setNewPhoto(event.target.files?.[0] || null)} className="block w-full text-sm text-toydb-slate file:mr-4 file:rounded-lg file:border-0 file:bg-toydb-teal file:px-3 file:py-2 file:text-sm file:font-medium file:text-toydb-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-toydb-slate">Caption</label>
              <input value={caption} onChange={event => setCaption(event.target.value)} placeholder="Optional caption" className="w-full rounded-lg border border-toydb-border bg-toydb-cream px-3 py-2 text-sm text-toydb-navy outline-none ring-0 focus:border-toydb-teal" />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button type="submit" disabled={uploading || !newPhoto} className="rounded-lg bg-toydb-navy px-4 py-2 text-sm font-medium text-toydb-white disabled:cursor-not-allowed disabled:opacity-50">
              {uploading ? 'Uploading...' : 'Upload photo'}
            </button>
          </div>
        </form>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="rounded-xl border border-dashed border-toydb-border bg-toydb-white p-8 text-sm text-toydb-slate">Loading gallery…</div>
      ) : photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-toydb-border bg-toydb-white p-8 text-sm text-toydb-slate">No gallery photos yet. Add your first photo above.</div>
      ) : (
        <div className="space-y-3">
          {photos.map(photo => (
            <article key={photo.id} className="flex items-center gap-4 rounded-2xl border border-toydb-border bg-toydb-white p-3 shadow-sm">
              <button type="button" onClick={() => setSelectedPhoto(photo)} className="shrink-0 overflow-hidden rounded-xl bg-toydb-cream p-1">
                <img src={import.meta.env.VITE_API_BASE + photo.url} alt={photo.caption || 'Gallery photo'} className="h-24 w-24 rounded-lg object-cover" />
              </button>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                {editingId === photo.id ? (
                  <div className="space-y-2">
                    <input value={draftCaption} onChange={event => setDraftCaption(event.target.value)} className="w-full rounded-lg border border-toydb-border bg-toydb-cream px-3 py-2 text-sm text-toydb-navy outline-none focus:border-toydb-teal" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => saveCaption(photo.id)} className="rounded-lg bg-toydb-teal px-2.5 py-1.5 text-xs font-medium text-toydb-white">Save</button>
                      <button type="button" onClick={() => { setEditingId(null); setDraftCaption('') }} className="rounded-lg border border-toydb-border px-2.5 py-1.5 text-xs font-medium text-toydb-slate">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <p className="min-h-[2.5rem] text-sm text-toydb-navy">{photo.caption || 'No caption yet'}</p>
                )}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditingId(photo.id); setDraftCaption(photo.caption || '') }} className="rounded-lg border border-toydb-border px-2.5 py-1.5 text-xs font-medium text-toydb-slate hover:bg-toydb-cream">Edit</button>
                  <button type="button" onClick={() => deletePhoto(photo.id)} className="rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50">Remove</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setSelectedPhoto(null)}>
          <div className="relative w-full max-w-4xl rounded-2xl bg-toydb-white p-4 shadow-2xl" onClick={event => event.stopPropagation()}>
            <button type="button" onClick={() => setSelectedPhoto(null)} className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-1 text-sm text-white">Close</button>
            <img src={import.meta.env.VITE_API_BASE + selectedPhoto.url} alt={selectedPhoto.caption || 'Expanded gallery photo'} className="mx-auto max-h-[75vh] w-full rounded-xl object-contain" />
            {selectedPhoto.caption && <p className="mt-4 text-center text-base text-toydb-navy">{selectedPhoto.caption}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
