import React from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'

export default function App(){
  const navigate = useNavigate()
  const location = useLocation()
  const isPublicPage = location.pathname === '/' || location.pathname === '/register'

  async function logout(){
    try{
      await fetch(import.meta.env.VITE_API_BASE + '/auth/logout', { method: 'POST', credentials: 'include' })
    } catch (e) {
      // ignore errors
    }
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-toydb-cream text-toydb-navy">
      <div className={`mx-auto min-h-screen w-full ${isPublicPage ? 'max-w-lg p-4 flex items-center' : 'max-w-4xl'}`}>
        { !isPublicPage ? (
          <header className="flex items-center justify-between border-b-4 border-toydb-orange bg-toydb-navy px-4 py-4 shadow-lg shadow-toydb-navy/20 md:px-6 md:py-5">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="ToyDB logo" className="h-16 w-auto md:h-20" />
              <div className="hidden border-l border-toydb-navy-light pl-3 sm:block">
                <div className="text-xs uppercase tracking-widest text-toydb-teal-light">Collection</div>
                <div className="font-bold text-toydb-white">ToyDB</div>
              </div>
            </div>
            <nav className="flex items-center gap-3 text-sm">
              <Link to="/add" className="rounded-lg bg-toydb-teal px-3 py-2 font-medium text-toydb-white shadow-sm hover:bg-toydb-teal-dark">+ Add Toy</Link>
              <Link to="/account" className="font-medium text-toydb-cream hover:text-toydb-orange-light">Account</Link>
              <button onClick={logout} className="font-medium text-toydb-cream hover:text-toydb-orange-light">Logout</button>
            </nav>
          </header>
        ) : null }
        <main className={isPublicPage ? 'w-full rounded-2xl border border-toydb-border bg-toydb-white p-6 shadow-lg shadow-toydb-navy/10' : 'min-h-[calc(100vh-5.5rem)] bg-toydb-cream px-4 py-6 md:px-8 md:py-8'}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
