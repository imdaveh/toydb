import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault(); setError(null)
    const res = await fetch(import.meta.env.VITE_API_BASE + '/auth/register', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Register failed')
    // navigate to dashboard
    navigate('/dashboard', { state: { accessToken: data.accessToken } })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-medium">Register</h2>
      <h2 className="text-lg font-bold">Register</h2>
        {error && <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>}
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full p-2 bg-toydb-white border border-toydb-border rounded-lg" />
        <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password (min 6)" className="w-full p-2 bg-toydb-white border border-toydb-border rounded-lg" />
        <button className="w-full bg-toydb-orange text-toydb-white font-medium p-2 rounded-lg hover:bg-toydb-orange-dark">Create account</button>
    </form>
  )
}
