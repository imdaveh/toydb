import { useEffect, useState } from 'react'

export default function useToySuggestions(context = {}){
  const [suggestions, setSuggestions] = useState({})

  useEffect(() => {
    let cancelled = false

    async function loadSuggestions(){
      try {
        const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
        const token = (await refresh.json()).accessToken
        if (!token) return

        const params = new URLSearchParams()
        Object.entries(context).forEach(([key, value]) => {
          if (value !== undefined && value !== null && String(value).trim() !== '') {
            params.set(key, String(value))
          }
        })

        const response = await fetch(import.meta.env.VITE_API_BASE + '/toys/suggestions' + (params.toString() ? '?' + params.toString() : ''), {
          headers: { Authorization: 'Bearer ' + token }
        })
        const data = await response.json()
        if (response.ok && !cancelled) setSuggestions(data.suggestions || {})
      } catch (error) {}
    }

    loadSuggestions()
    return () => { cancelled = true }
  }, [context.manufacturer, context.toyline, context.series, context.sub_series, context.theme])

  return suggestions
}