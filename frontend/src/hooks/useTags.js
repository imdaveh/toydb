import { useEffect, useState } from 'react'

export default function useTags(){
  const [tags, setTags] = useState([])

  useEffect(() => {
    let cancelled = false

    async function loadTags(){
      try {
        const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
        const token = (await refresh.json()).accessToken
        if (!token) return
        const response = await fetch(import.meta.env.VITE_API_BASE + '/tags', { headers: { Authorization: 'Bearer ' + token } })
        const data = await response.json()
        if (response.ok && !cancelled) setTags(data.tags || [])
      } catch (error) {}
    }

    loadTags()
    return () => { cancelled = true }
  }, [])

  return tags
}
