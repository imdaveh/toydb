import React from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import ToyForm from '../components/ToyForm'

export default function AddToy({ wishlist = false, hidden = false }){
  const navigate = useNavigate()
  const location = useLocation()
  const { isReadOnly } = useOutletContext?.() || {}
  const prefill = location.state?.prefill || {}
  const suggestionContext = {}
  for (const step of location.state?.selectedGroupPath || []) {
    if (step && ['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'type', 'year'].includes(step.field)) {
      suggestionContext[step.field] = step.value
    }
  }
  for (const filter of location.state?.appliedFilters || []) {
    if (filter && ['manufacturer', 'toyline', 'series', 'sub_series', 'theme', 'type', 'year'].includes(filter.field)) {
      suggestionContext[filter.field] = filter.value
    }
  }

  function getReturnTarget(){
    const targetPath = hidden ? '/hidden' : wishlist ? '/wishlist' : '/dashboard'
    const returnState = { ...(location.state || {}), refresh: Date.now() }
    delete returnState.prefill
    return { targetPath, returnState }
  }

  function onCreated(){
    const { targetPath, returnState } = getReturnTarget()
    navigate(targetPath, { state: returnState })
  }

  if (isReadOnly) {
    return (
      <div className="rounded-lg border border-toydb-border bg-toydb-white p-6 text-sm text-toydb-slate">
        This collection is read-only. Switch back to your own collection to add toys.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">{hidden ? 'Add a Hidden Toy' : wishlist ? 'Add a Wishlist Toy' : 'Add a New Toy'}</h2>
      <div className="p-4 bg-toydb-white border border-toydb-border rounded-xl shadow-sm">
        <ToyForm wishlist={wishlist} hidden={hidden} initialValues={prefill} suggestionContext={suggestionContext} onCreated={onCreated} onCancel={() => {
          const { targetPath, returnState } = getReturnTarget()
          navigate(targetPath, { state: returnState })
        }} />
      </div>
    </div>
  )
}
