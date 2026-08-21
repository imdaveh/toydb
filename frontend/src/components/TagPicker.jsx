import React from 'react'

export default function TagPicker({ allTags = [], selectedTagIds = [], onChange }){
  const selectedSet = new Set(selectedTagIds)
  const addedTags = allTags.filter(tag => selectedSet.has(tag.id))
  const availableTags = allTags.filter(tag => !selectedSet.has(tag.id))

  function addTag(id){ onChange([...selectedTagIds, id]) }
  function removeTag(id){ onChange(selectedTagIds.filter(tagId => tagId !== id)) }

  return (
    <div className="space-y-2">
      <div>
        <div className="mb-1 text-xs font-medium text-toydb-slate">Added tags</div>
        <div className="flex flex-wrap gap-1">
          {addedTags.length ? addedTags.map(tag => (
            <button key={tag.id} type="button" onClick={() => removeTag(tag.id)} className="rounded-full bg-toydb-teal-pale px-2 py-0.5 text-xs font-medium text-toydb-teal-dark hover:bg-toydb-teal hover:text-toydb-white">
              {tag.name} &times;
            </button>
          )) : <span className="text-xs text-toydb-slate">None</span>}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs font-medium text-toydb-slate">Available tags</div>
        <div className="flex flex-wrap gap-1">
          {availableTags.length ? availableTags.map(tag => (
            <button key={tag.id} type="button" onClick={() => addTag(tag.id)} className="rounded-full bg-toydb-cream px-2 py-0.5 text-xs font-medium text-toydb-slate hover:bg-toydb-teal-pale hover:text-toydb-teal-dark">
              + {tag.name}
            </button>
          )) : <span className="text-xs text-toydb-slate">None</span>}
        </div>
      </div>
    </div>
  )
}
