import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ToyCard from '../components/ToyCard'
import ToyForm from '../components/ToyForm'

export default function Dashboard(){
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const [toys, setToys] = useState([])
  const [loading, setLoading] = useState(true)
  const loc = useLocation()
  const navigate = useNavigate()
  const accessToken = loc.state?.accessToken || null

  async function loadUserAndToys(){
    setLoading(true); setError(null)
    let token = accessToken
    if (!token){
      const r = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      const data = await r.json()
      if (data.accessToken) token = data.accessToken
    }
    if (!token) return navigate('/')
    try{
      const [uRes, tRes] = await Promise.all([
        fetch(import.meta.env.VITE_API_BASE + '/dashboard', { headers: { Authorization: 'Bearer ' + token } }),
        fetch(import.meta.env.VITE_API_BASE + '/toys', { headers: { Authorization: 'Bearer ' + token } })
      ])
      const uData = await uRes.json()
      if (!uRes.ok) { setError(uData.error || 'Failed to load user'); setLoading(false); return }
      setUser(uData.user)
      const tData = await tRes.json()
      if (!tRes.ok) { setError(tData.error || 'Failed to load toys'); setToys([]); setLoading(false); return }
      setToys(tData.toys || [])
      setLoading(false)
    } catch (err){ setError('Server error'); setLoading(false) }
  }

  const location = useLocation()
  useEffect(()=>{ loadUserAndToys() }, [])
  useEffect(()=>{
    if (location?.state?.refresh) loadUserAndToys()
  }, [location?.state?.refresh])

  function onCreated(){ setShowForm(false); loadUserAndToys() }
  function onUpdated(){ loadUserAndToys() }
  function onDeleted(){ loadUserAndToys() }

  if (error) return <div className="text-red-600">{error}</div>
  if (!user) return <div>Loading...</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center justify-center text-center">
        <div>
          <h2 className="text-base font-medium">Welcome, {user.email}</h2>
          <div className="text-xs text-gray-600">Member since: {new Date(user.createdAt).toLocaleString()}</div>
        </div>
      </div>

      <h3 className="text-md font-semibold">My Collection</h3>
      {loading && <div>Loading toys...</div>}
      {!loading && toys.length === 0 && <div className="text-sm text-gray-600">No toys yet. Use "Add Toy" in the header to add your first item.</div>}
      <div className="grid grid-cols-1 gap-4">
        {toys.map(t => <ToyCard key={t.id} toy={t} onUpdated={onUpdated} onDeleted={onDeleted} />)}
      </div>
    </div>
  )
}
