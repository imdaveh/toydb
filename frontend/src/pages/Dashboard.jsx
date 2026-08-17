import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function Dashboard(){
  const [user, setUser] = useState(null)
  const [error, setError] = useState(null)
  const loc = useLocation()
  const navigate = useNavigate()
  const accessToken = loc.state?.accessToken || null

  useEffect(()=>{
    async function load(){
      let token = accessToken
      if (!token){
        // try refresh
        const r = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
        const data = await r.json()
        if (data.accessToken) token = data.accessToken
      }
      if (!token) return navigate('/')
      const res = await fetch(import.meta.env.VITE_API_BASE + '/dashboard', { headers: { Authorization: 'Bearer ' + token } })
      const d = await res.json()
      if (!res.ok) return setError(d.error || 'Failed')
      setUser(d.user)
    }
    load()
  },[])

  async function logout(){
    await fetch(import.meta.env.VITE_API_BASE + '/auth/logout', { method: 'POST', credentials: 'include' })
    navigate('/')
  }

  if (error) return <div className="text-red-600">{error}</div>
  if (!user) return <div>Loading...</div>
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Welcome, {user.email}</h2>
      <div className="text-sm text-gray-600">Member since: {new Date(user.createdAt).toLocaleString()}</div>
      <button onClick={logout} className="mt-4 w-full bg-red-600 text-white p-2 rounded">Logout</button>
    </div>
  )
}
