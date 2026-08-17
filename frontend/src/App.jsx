import React from 'react'
import { Outlet, Link } from 'react-router-dom'

export default function App(){
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-xl shadow-md p-6">
        <header className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-semibold">ToyDB</h1>
          <nav className="space-x-3 text-sm">
            <Link to="/" className="text-blue-600">Login</Link>
            <Link to="/register" className="text-blue-600">Register</Link>
          </nav>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
