import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

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
    try {
      const res = await fetch(import.meta.env.VITE_API_BASE + '/auth/login', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Login failed')
      setAccessToken(data.accessToken)
      navigate('/dashboard', { state: { accessToken: data.accessToken } })
    } catch (err) {
      setError('Unable to reach the ToyDB server. Check that the backend is running.')
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <img src="/logo.png" alt="ToyDB logo" className="h-20 md:h-24 lg:h-32 w-auto" />
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full p-2 bg-toydb-white border border-toydb-border rounded-lg" />
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password (min 6)" className="w-full p-2 bg-toydb-white border border-toydb-border rounded-lg" />
        <button className="w-full bg-toydb-teal text-toydb-white font-medium p-2 rounded-lg hover:bg-toydb-teal-dark">Login</button>
        <div className="text-center text-sm text-toydb-slate mt-2">Don't have an account? <Link to="/register" className="font-medium text-toydb-teal-dark hover:text-toydb-orange-dark">Register</Link></div>
      </form>
    </div>
  )
}
