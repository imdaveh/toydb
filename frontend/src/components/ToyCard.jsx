import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function ToyCard({ toy, onDeleted }){
  const navigate = useNavigate()

  async function getToken(){
    try{
      const r = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const d = await r.json()
      return d.accessToken
    } catch (e){ return null }
  }

  async function remove(){
    if (!confirm('Delete this toy? This cannot be undone.')) return
    const token = await getToken()
    if (!token) { alert('Not authenticated'); return }
    try{
      const res = await fetch(import.meta.env.VITE_API_BASE + '/toys/' + toy.id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
      const d = await res.json()
      if (!res.ok) { alert(d.error || 'Failed'); return }
      if (onDeleted) onDeleted()
    } catch (err){ alert('Server error') }
  }

  return (
    <div className="p-3 border rounded flex gap-3">
      <div className="w-24 h-24 bg-gray-100 flex items-center justify-center overflow-hidden rounded">
        {toy.photos && toy.photos[0] ? <img src={import.meta.env.VITE_API_BASE + toy.photos[0].url} alt={toy.photos[0].name} className="object-cover w-full h-full"/> : <div className="text-xs text-gray-500">No photo</div>}
      </div>
      <div className="flex-1">
        <div className="font-semibold">{toy.name}</div>
        {toy.toyline && (
          <div className="mt-1">
            <span className="inline-block bg-gray-100 text-gray-800 text-xs px-2 py-0.5 rounded">{toy.toyline}{toy.year ? ` • ${toy.year}` : ''}</span>
          </div>
        )}
        <div className="text-sm text-gray-600 mt-2">{toy.manufacturer} {toy.series ? `• ${toy.series}` : ''} {toy.sub_series ? `• ${toy.sub_series}` : ''}</div>
        <div className="text-sm mt-1">Condition: <span className="font-medium">{toy.condition || 'N/A'}</span></div>
        <div className="text-xs text-gray-500 mt-2">Accessories: {toy.accessories || 'None'}</div>
        <div className="mt-2 flex gap-2">
          <button onClick={()=>navigate('/toys/' + toy.id + '/edit')} className="text-sm text-blue-600">Edit</button>
          <button onClick={remove} className="text-sm text-red-600">Delete</button>
        </div>
      </div>
    </div>
  )
}
