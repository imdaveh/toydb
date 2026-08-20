import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Register(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const navigate = useNavigate()

  async function submit(e){
    e.preventDefault(); setError(null); setSubmitted(false)
    const res = await fetch(import.meta.env.VITE_API_BASE + '/auth/register', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error || 'Register failed')
    setSubmitted(true)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-bold">Register</h2>
        {error && <div className="bg-toydb-danger-pale text-toydb-danger p-3 rounded-lg">{error}</div>}
        {submitted ? (
          <div className="space-y-4 bg-toydb-teal-pale p-4 text-toydb-teal-dark">
            <p>Your request has been sent and is awaiting administrator approval.</p>
            <button type="button" onClick={() => navigate('/')} className="font-medium hover:text-toydb-orange-dark">Back to login</button>
          </div>
        ) : <>
          <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" className="w-full p-2 bg-toydb-white border border-toydb-border rounded-lg" />
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password (min 6)" className="w-full p-2 bg-toydb-white border border-toydb-border rounded-lg" />
          <button className="w-full bg-toydb-orange text-toydb-white font-medium p-2 rounded-lg hover:bg-toydb-orange-dark">Create account</button>
        </>}
    </form>
  )
}
