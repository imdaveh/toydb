import React, { useState } from 'react'

export default function AutocompleteInput({ value, suggestions = [], onChange }){
  const [open, setOpen] = useState(false)
  const normalizedValue = value || ''
  const matches = suggestions
    .filter(option => option.toLowerCase().includes(normalizedValue.toLowerCase()))
    .slice(0, 8)

  return (
    <div className="relative">
      <input
        value={normalizedValue}
        onChange={event => { onChange(event.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
        className="w-full p-2 border rounded"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto border border-toydb-border bg-toydb-white shadow-md">
          {matches.map(option => (
            <button
              key={option}
              type="button"
              onMouseDown={() => onChange(option)}
              className="block w-full px-3 py-2 text-left text-sm text-toydb-navy hover:bg-toydb-teal-pale"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}