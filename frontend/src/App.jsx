import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'

export default function App(){
  const navigate = useNavigate()
  const location = useLocation()
  const isLogin = location.pathname === '/'

  async function logout(){
    try{
      await fetch(import.meta.env.VITE_API_BASE + '/auth/logout', { method: 'POST', credentials: 'include' })
    } catch (e) {
      // ignore errors
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-toydb-cream text-toydb-navy flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-toydb-white border border-toydb-border rounded-2xl shadow-lg shadow-toydb-navy/10 p-6">
        { !isLogin ? (
          <header className="flex justify-between items-center mb-4">
            <div className="flex items-end">
              <img src="/logo.png" alt="ToyDB logo" className="h-14 md:h-[4.5rem] lg:h-[5.5rem] w-auto" />
            </div>
            <nav className="space-x-3 text-sm">
              <Link to="/add" className="inline-block bg-toydb-teal text-toydb-white font-medium px-3 py-2 rounded-lg hover:bg-toydb-teal-dark">Add Toy</Link>
              <span className="text-toydb-border px-1">|</span>
              <button onClick={logout} className="text-sm text-toydb-danger hover:text-toydb-orange-dark">Logout</button>
            </nav>
          </header>
        ) : null }
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
