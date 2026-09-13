import React from 'react'
import { useNavigate } from 'react-router-dom'
import ToyForm from '../components/ToyForm'

export default function AddToy({ wishlist = false, hidden = false }){
  const navigate = useNavigate()
  function onCreated(){
    navigate(hidden ? '/hidden' : wishlist ? '/wishlist' : '/dashboard')
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{hidden ? 'Add a Hidden Toy' : wishlist ? 'Add a Wishlist Toy' : 'Add a New Toy'}</h2>
      <div className="p-4 bg-toydb-white border border-toydb-border rounded-xl shadow-sm">
        <ToyForm wishlist={wishlist} hidden={hidden} onCreated={onCreated} onCancel={() => navigate(hidden ? '/hidden' : wishlist ? '/wishlist' : '/dashboard')} />
      </div>
    </div>
  )
}
