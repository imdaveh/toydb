import { useEffect, useState } from 'react'

export default function useToySuggestions(){
  const [suggestions, setSuggestions] = useState({})

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions(){
      try {
        const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
        const token = (await refresh.json()).accessToken
        if (!token) return
        const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/suggestions', { headers: { Authorization: 'Bearer ' + token } })
        const data = await response.json()
        if (response.ok && !cancelled) setSuggestions(data.suggestions || {})
      } catch (error) {}
    }

    loadSuggestions()
    return () => { cancelled = true }
  }, [])

  return suggestions
}