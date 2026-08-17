import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accessToken, setAccessToken] = useState(null)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(()=>{
    // try refresh on load
    fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data.accessToken) {
          setAccessToken(data.accessToken)
          navigate('/dashboard', { state: { accessToken: data.accessToken } })
        }
      }).catch(()=>{})
  },[])

  async function submit(e){
    e.preventDefault(); setError(null)
    const res = await fetch(import.meta.env.VITE_API_BASE + '/auth/login', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Login failed')
    setAccessToken(data.accessToken)
    navigate('/dashboard', { state: { accessToken: data.accessToken } })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-medium">Login</h2>
      {error && <div className="text-red-600">{error}</div>}
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full p-2 border rounded" />
      <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password" className="w-full p-2 border rounded" />
      <button className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
    </form>
  )
}
