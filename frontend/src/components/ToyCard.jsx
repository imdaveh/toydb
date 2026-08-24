import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function ToyCard({ toy, allowDelete = false, onDeleted, returnState = null, deleteLabel = 'Delete' }){
  const navigate = useNavigate()
  const location = useLocation()
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
    Excellent: 'bg-toydb-teal-pale text-toydb-teal-dark',
    Good: 'bg-toydb-gold-pale text-toydb-gold-dark',
    Fair: 'bg-toydb-orange-pale text-toydb-orange-dark',
    Poor: 'bg-toydb-danger-pale text-toydb-danger',
    Broken: 'bg-toydb-border text-toydb-navy'
  }
  const metaLine = [toy.series, toy.sub_series, toy.theme, toy.year, toy.manufacturer].filter(value => value !== null && value !== undefined && String(value).trim()).join(' • ')

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

  const actionButtonLabel = deleting ? (deleteLabel === 'Sold' ? 'Marking...' : 'Deleting...') : deleteLabel

  async function deleteToy(){
    const confirmMessage = deleteLabel === 'Sold'
      ? `Mark ${toy.name} as sold and remove it from your collection?`
      : `Delete ${toy.name} from your wishlist? This cannot be undone.`

    if (!window.confirm(confirmMessage)) return
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
      <div className="w-24 flex flex-col items-stretch">
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
        {photos.length > 1 && (
          <div className="mt-1 text-center text-[10px] font-medium text-toydb-slate">
            {photos.length} photos
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {actionError && <div className="mb-2 text-sm text-toydb-danger">{actionError}</div>}
        <div className="flex items-start justify-between gap-2">
          <div className="font-bold text-toydb-navy line-clamp-2 break-words flex-1">{toy.name}</div>
          {toy.condition && <span className={`inline-block shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${conditionTone[toy.condition] || 'bg-toydb-cream text-toydb-slate'}`}>{toy.condition}</span>}
        </div>

        {toy.toyline && <div className="mt-1 text-sm font-semibold text-toydb-navy"><span className="text-xs font-medium text-toydb-slate mr-1">Toyline:</span>{toy.toyline}</div>}

        {metaLine && <div className="mt-1 text-xs text-toydb-slate">{metaLine}</div>}

        {Boolean(toy.for_sale) && (
          <div className="mt-2 inline-flex w-fit items-center rounded-full border border-toydb-orange bg-toydb-orange-pale px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-toydb-orange-dark">
            For Sale
          </div>
        )}

        {toy.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {toy.tags.map(tag => <span key={tag.id} className="inline-block bg-toydb-cream text-toydb-slate text-xs font-medium px-2 py-0.5 rounded-full">{tag.name}</span>)}
          </div>
        )}

        {expanded && (
          <>
            <div className="mt-2 text-xs text-toydb-slate"><span className="font-semibold text-toydb-navy">Notes:</span> {toy.notes || 'None'}</div>
            <div className="mt-1 text-xs text-toydb-slate"><span className="font-semibold text-toydb-navy">Included:</span> {toy.included || toy.accessories || 'None'}</div>
            <div className="mt-1 text-xs text-toydb-slate"><span className="font-semibold text-toydb-navy">Missing:</span> {toy.missing || 'None'}</div>
            <div className="mt-1 text-xs text-toydb-slate"><span className="font-semibold text-toydb-navy">Broken:</span> {toy.broken || 'None'}</div>
            {(toy.cost || toy.source) && (
              <div className="text-sm text-toydb-navy mt-1">{toy.cost ? `Cost: $${parseFloat(toy.cost).toFixed(2)}` : ''} {toy.source ? `• Source: ${toy.source}` : ''}</div>
            )}
          </>
        )}

        {/* Actions row: own line at bottom, right-justified */}
        <div className="mt-auto flex justify-end items-center gap-2 text-sm">
          { !expanded ? (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit', { state: { from: { pathname: location.pathname, state: returnState || {} } } })} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Edit</button>
              {allowDelete && <><span className="text-toydb-border px-1">|</span><button type="button" onClick={deleteToy} disabled={deleting} className="text-sm font-medium text-toydb-danger hover:text-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">{actionButtonLabel}</button></>}
              <span className="text-toydb-border px-1">|</span>
              <button onClick={()=>setExpanded(true)} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">More</button>
            </>
          ) : (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit', { state: { from: { pathname: location.pathname, state: returnState || {} } } })} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Edit</button>
              {allowDelete && <><span className="text-toydb-border px-1">|</span><button type="button" onClick={deleteToy} disabled={deleting} className="text-sm font-medium text-toydb-danger hover:text-toydb-orange-dark disabled:cursor-not-allowed disabled:opacity-60">{actionButtonLabel}</button></>}
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
          <div className="relative flex max-h-[85vh] w-full max-w-5xl flex-col items-center justify-center gap-3" onClick={(event) => event.stopPropagation()}>
            <div className="relative flex w-full items-center justify-center gap-2">
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
              <img src={photoUrl} alt={photo.name} className="h-auto min-w-0 max-h-[75vh] max-w-full flex-1 object-contain" />
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

            {photos.length > 1 && (
              <div className="flex max-w-full flex-wrap justify-center gap-2 rounded-lg bg-toydb-white/10 p-2 backdrop-blur-sm">
                {photos.map((item, index) => {
                  const isActive = index === selectedPhotoIndex
                  const thumbUrl = import.meta.env.VITE_API_BASE + item.url
                  return (
                    <button
                      key={item.id || `${item.url}-${index}`}
                      type="button"
                      onClick={() => setSelectedPhotoIndex(index)}
                      className={`overflow-hidden rounded-lg border-2 bg-toydb-white shadow-sm transition ${isActive ? 'border-toydb-orange scale-[1.02]' : 'border-transparent hover:border-toydb-teal-light'}`}
                      aria-label={`View photo ${index + 1} of ${photos.length}`}
                    >
                      <img src={thumbUrl} alt={`${toy.name} photo ${index + 1}`} className="h-12 w-12 object-cover" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
