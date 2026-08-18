import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function ToyCard({ toy, onDeleted }){
  const navigate = useNavigate()


  const [expanded, setExpanded] = useState(false)

  return (
    <div className="p-3 border rounded flex gap-3 items-stretch">
      <div className="w-24 h-24 bg-gray-100 flex items-center justify-center overflow-hidden rounded">
        {toy.photos && toy.photos[0] ? <img src={import.meta.env.VITE_API_BASE + toy.photos[0].url} alt={toy.photos[0].name} className="object-cover w-full h-full"/> : <div className="text-xs text-gray-500">No photo</div>}
      </div>

      <div className="flex-1 flex flex-col">
        {/* 1) Name */}
        <div className="font-semibold">{toy.name}</div>

        {/* 2) Toyline (moved above year/manufacturer) */}
        {toy.toyline && (
          <div className="mt-1">
            <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded">{toy.toyline}</span>
          </div>
        )}

        {/* 3) Series then Sub-series (moved above year/manufacturer) */}
        <div className="mt-1 text-sm text-gray-600">
          {toy.series && <span>{toy.series}</span>}
          {toy.sub_series && toy.series ? <span className="mx-2">•</span> : toy.sub_series ? null : null}
          {toy.sub_series && <span>{toy.sub_series}</span>}
        </div>

        {/* 4) Year then Manufacturer */}
        <div className="mt-1 flex items-center gap-2 text-sm text-gray-600">
          {toy.year ? <span className="">{toy.year}</span> : null}
          {toy.manufacturer ? <span className="">{toy.manufacturer}</span> : null}
        </div>

        {expanded && (
          <>
            <div className="text-sm mt-2">Condition: <span className="font-medium">{toy.condition || 'N/A'}</span></div>
            {(toy.cost || toy.source) && (
              <div className="text-sm text-gray-700 mt-1">{toy.cost ? `Cost: $${parseFloat(toy.cost).toFixed(2)}` : ''} {toy.source ? `• Source: ${toy.source}` : ''}</div>
            )}
            {toy.notes && <div className="text-sm text-gray-600 mt-1">Notes: {toy.notes}</div>}
            <div className="text-xs text-gray-500 mt-2">Accessories: {toy.accessories || 'None'}</div>
          </>
        )}

        {/* Actions row: own line at bottom, right-justified */}
        <div className="mt-auto flex justify-end items-center gap-2 text-sm">
          { !expanded ? (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit')} className="text-sm text-blue-600">Edit</button>
              <span className="text-gray-400 px-1">|</span>
              <button onClick={()=>setExpanded(true)} className="text-sm text-blue-600">More</button>
            </>
          ) : (
            <>
              <button onClick={()=>navigate('/toys/' + toy.id + '/edit')} className="text-sm text-blue-600">Edit</button>
              <span className="text-gray-400 px-1">|</span>
              <button onClick={()=>setExpanded(false)} className="text-sm text-gray-600">Less</button>
            </>
          )}
        </div>
      </div>

    </div>
  )
}
