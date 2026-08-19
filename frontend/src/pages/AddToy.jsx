import React from 'react'
import { useNavigate } from 'react-router-dom'
import ToyForm from '../components/ToyForm'

export default function AddToy(){
  const navigate = useNavigate()
  function onCreated(){
    navigate('/dashboard')
  }
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Add a New Toy</h2>
      <div className="p-4 bg-toydb-white border border-toydb-border rounded-xl shadow-sm">
        <ToyForm onCreated={onCreated} onCancel={() => navigate('/dashboard')} />
      </div>
    </div>
  )
}
