import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ToyCard({ toy, allowDelete = false, onDeleted }){
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [isPhotoOpen, setIsPhotoOpen] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [actionError, setActionError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const photos = toy.photos || []
  const photo = photos[selectedPhotoIndex]
  const photoUrl = photo ? import.meta.env.VITE_API_BASE + photo.url : null
  const conditionTone = {
    Mint: 'bg-toydb-success-pale text-toydb-success',
    'Near Mint': 'bg-toydb-teal-pale text-toydb-teal-dark',
    Excellent: 'bg-toydb-teal-pale text-toydb-teal-dark',
    Good: 'bg-toydb-gold-pale text-toydb-gold-dark',
    Fair: 'bg-toydb-orange-pale text-toydb-orange-dark',
    Poor: 'bg-toydb-danger-pale text-toydb-danger'
  }

  useEffect(() => {
    if (!isPhotoOpen) return
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsPhotoOpen(false)
      if (event.key === 'ArrowLeft' && photos.length > 1) {
        setSelectedPhotoIndex((current) => (current - 1 + photos.length) % photos.length)
      }
      if (event.key === 'ArrowRight' && photos.length > 1) {
        setSelectedPhotoIndex((current) => (current + 1) % photos.length)
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [isPhotoOpen, photos.length])

  async function deleteToy(){
    if (!window.confirm(`Delete ${toy.name} from your wishlist? This cannot be undone.`)) return
    setDeleting(true)
    setActionError(null)
    try {
      const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const { accessToken } = await refresh.json()
      if (!refresh.ok || !accessToken) throw new Error('Not authenticated')

      const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + toy.id, {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + accessToken }
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to delete wishlist toy')
      onDeleted?.()
    } catch (error) {
      setActionError(error.message || 'Unable to delete wishlist toy')
    }
    setDeleting(false)
  }

  return (
    <div className="p-3 bg-toydb-white border border-toydb-border rounded-xl flex gap-3 items-stretch shadow-sm">
      <div className="w-24 h-24 bg-toydb-cream flex items-center justify-center overflow-hidden rounded-lg">
        {photo ? (
          <button
            type="button"
            onClick={() => {
              setSelectedPhotoIndex(0)
              setIsPhotoOpen(true)
            }}
            className="w-full h-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-toydb-teal"
            aria-label={`Enlarge photo of ${toy.name}`}
          >
            <img src={photoUrl} alt={photo.name} className="object-contain w-full h-full" />
          </button>
        ) : <div className="text-xs text-toydb-slate">No photo</div>}
      </div>

      <div className="flex-1 flex flex-col">
        {actionError && <div className="mb-2 text-sm text-toydb-danger">{actionError}</div>}
        {/* 1) Name */}
        <div className="font-bold text-toydb-navy">{toy.name}</div>

        {/* 2) Toyline (moved above year/manufacturer) */}
        {toy.toyline && (
          <div className="mt-1">
            <span className="inline-block bg-toydb-teal-pale text-toydb-teal-dark text-xs font-medium px-2 py-0.5 rounded-full">{toy.toyline}</span>
          </div>
        )}

        {/* 3) Series then Sub-series (moved above year/manufacturer) */}
        <div className="mt-1 text-sm text-toydb-slate">
          {toy.series && <span>{toy.series}</span>}
          {toy.sub_series && toy.series ? <span className="mx-2">•</span> : toy.sub_series ? null : null}
          {toy.sub_series && <span>{toy.sub_series}</span>}
        </div>

        {/* 4) Year then Manufacturer */}
        <div className="mt-1 flex items-center gap-2 text-sm text-toydb-slate">
          {toy.year ? <span className="">{toy.year}</span> : null}
          {toy.manufacturer ? <span className="">{toy.manufacturer}</span> : null}
        </div>

        {expanded && (
          <>
            <div className="text-sm mt-2">Condition: <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${conditionTone[toy.condition] || 'bg-toydb-cream text-toydb-slate'}`}>{toy.condition || 'N/A'}</span></div>
            {(toy.cost || toy.source) && (
              <div className="text-sm text-toydb-navy mt-1">{toy.cost ? `Cost: $${parseFloat(toy.cost).toFixed(2)}` : ''} {toy.source ? `• Source: ${toy.source}` : ''}</div>
            )}
            {toy.notes && <div className="text-sm text-toydb-slate mt-1">Notes: {toy.notes}</div>}
            <div className="text-xs text-toydb-slate mt-2">Accessories: {toy.accessories || 'None'}</div>
          </>
        )}

        {/* Actions row: own line at bottom, right-justified */}
        <div className="mt-auto flex justify-end items-center gap-2 text-sm">
          { !expanded ? (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit')} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Edit</button>
              {allowDelete && <><span className="text-toydb-border px-1">|</span><button type="button" onClick={deleteToy} disabled={deleting} className="text-sm font-medium text-toydb-danger hover:text-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">{deleting ? 'Deleting...' : 'Delete'}</button></>}
              <span className="text-toydb-border px-1">|</span>
              <button onClick={()=>setExpanded(true)} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">More</button>
            </>
          ) : (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit')} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Edit</button>
              {allowDelete && <><span className="text-toydb-border px-1">|</span><button type="button" onClick={deleteToy} disabled={deleting} className="text-sm font-medium text-toydb-danger hover:text-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">{deleting ? 'Deleting...' : 'Delete'}</button></>}
              <span className="text-toydb-border px-1">|</span>
              <button onClick={()=>setExpanded(false)} className="text-sm text-toydb-slate hover:text-toydb-navy">Less</button>
            </>
          )}
        </div>
      </div>

      {isPhotoOpen && photo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-toydb-navy/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${toy.name} photo`}
          onClick={() => setIsPhotoOpen(false)}
        >
          <div className="relative flex max-h-[85vh] w-full max-w-5xl items-center justify-center gap-2" onClick={(event) => event.stopPropagation()}>
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex((current) => (current - 1 + photos.length) % photos.length)}
                className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-toydb-teal-light bg-toydb-teal p-0 text-2xl leading-none text-toydb-white shadow-md hover:bg-toydb-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-cream"
                aria-label="View previous photo"
              >
                &larr;
              </button>
            )}
            <img src={photoUrl} alt={photo.name} className="h-auto min-w-0 max-h-[80vh] max-w-full flex-1 object-contain" />
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex((current) => (current + 1) % photos.length)}
                className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-toydb-teal-light bg-toydb-teal p-0 text-2xl leading-none text-toydb-white shadow-md hover:bg-toydb-teal-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-cream"
                aria-label="View next photo"
              >
                &rarr;
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsPhotoOpen(false)}
              className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-full border border-toydb-orange-light bg-toydb-orange p-0 text-xl leading-none text-toydb-white shadow-md hover:bg-toydb-orange-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-toydb-cream"
              aria-label="Close enlarged photo"
            >
              &times;
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
