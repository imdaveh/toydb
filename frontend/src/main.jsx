import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import AddToy from './pages/AddToy'
import Wishlist from './pages/Wishlist'
import ForSale from './pages/ForSale'
import Lists from './pages/Lists'
import EditToy from './pages/EditToy'
import Admin from './pages/Admin'
import Account from './pages/Account'

import { registerSW } from 'virtual:pwa-register'

registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}> 
          <Route index element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="add" element={<AddToy />} />
          <Route path="lists" element={<Lists />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="for-sale" element={<ForSale />} />
          <Route path="wishlist/add" element={<AddToy wishlist />} />
          <Route path="toys/:id/edit" element={<EditToy />} />
          <Route path="account" element={<Account />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
