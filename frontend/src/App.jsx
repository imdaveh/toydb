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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-md p-6">
        { !isLogin ? (
          <header className="flex justify-between items-center mb-4">
            <div className="flex items-end">
              <img src="/logo.png" alt="ToyBox — Collection Manager" className="h-8 md:h-10 lg:h-12 w-auto mr-3" />
              <h1 className="text-lg font-semibold leading-none mb-1">Collection Manager</h1>
            </div>
            <nav className="space-x-3 text-sm">
              <Link to="/add" className="text-blue-600">Add Toy</Link>
              <span className="text-gray-400 px-1">|</span>
              <button onClick={logout} className="text-sm text-red-600">Logout</button>
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
