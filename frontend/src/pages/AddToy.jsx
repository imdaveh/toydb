import React from 'react'
import { useNavigate } from 'react-router-dom'
import ToyForm from '../components/ToyForm'

export default function AddToy({ wishlist = false }){
  const navigate = useNavigate()
  function onCreated(){
    navigate(wishlist ? '/wishlist' : '/dashboard')
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{wishlist ? 'Add a Wishlist Toy' : 'Add a New Toy'}</h2>
      <div className="p-4 bg-toydb-white border border-toydb-border rounded-xl shadow-sm">
        <ToyForm wishlist={wishlist} onCreated={onCreated} onCancel={() => navigate(wishlist ? '/wishlist' : '/dashboard')} />
      </div>
    </div>
  )
}
