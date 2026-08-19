import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ToyCard({ toy, onDeleted }){
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const conditionTone = {
    Mint: 'bg-toydb-success-pale text-toydb-success',
    'Near Mint': 'bg-toydb-teal-pale text-toydb-teal-dark',
    Excellent: 'bg-toydb-teal-pale text-toydb-teal-dark',
    Good: 'bg-toydb-gold-pale text-toydb-gold-dark',
    Fair: 'bg-toydb-orange-pale text-toydb-orange-dark',
    Poor: 'bg-toydb-danger-pale text-toydb-danger'
  }

  return (
    <div className="p-3 bg-toydb-white border border-toydb-border rounded-xl flex gap-3 items-stretch shadow-sm">
      <div className="w-24 h-24 bg-toydb-cream flex items-center justify-center overflow-hidden rounded-lg">
        {toy.photos && toy.photos[0] ? <img src={import.meta.env.VITE_API_BASE + toy.photos[0].url} alt={toy.photos[0].name} className="object-cover w-full h-full"/> : <div className="text-xs text-toydb-slate">No photo</div>}
      </div>

      <div className="flex-1 flex flex-col">
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
              <span className="text-toydb-border px-1">|</span>
              <button onClick={()=>setExpanded(true)} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">More</button>
            </>
          ) : (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit')} className="text-sm font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Edit</button>
              <span className="text-toydb-border px-1">|</span>
              <button onClick={()=>setExpanded(false)} className="text-sm text-toydb-slate hover:text-toydb-navy">Less</button>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
