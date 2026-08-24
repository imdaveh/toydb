import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

export default function Lists(){
  const [wishlistCount, setWishlistCount] = useState(0)
  const [forSaleCount, setForSaleCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats(){
      setLoading(true)
      try {
        const refresh = await fetch(import.meta.env.VITE_API_BASE + '/auth/refresh', { method: 'POST', credentials: 'include' })
        const { accessToken } = await refresh.json()
        if (!refresh.ok || !accessToken) {
          setWishlistCount(0)
          setForSaleCount(0)
          setLoading(false)
          return
        }

        const [wishlistRes, forSaleRes] = await Promise.all([
          fetch(import.meta.env.VITE_API_BASE + '/toys?wishlist=true', { headers: { Authorization: 'Bearer ' + accessToken } }),
          fetch(import.meta.env.VITE_API_BASE + '/toys?for_sale=true', { headers: { Authorization: 'Bearer ' + accessToken } })
        ])

        const wishlistData = wishlistRes.ok ? await wishlistRes.json() : { toys: [] }
        const forSaleData = forSaleRes.ok ? await forSaleRes.json() : { toys: [] }

        setWishlistCount((wishlistData.toys || []).length)
        setForSaleCount((forSaleData.toys || []).length)
      } catch (error) {
        setWishlistCount(0)
        setForSaleCount(0)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
  }, [])

  const cards = [
    {
      title: 'Wishlist',
      description: 'Items you want to keep an eye out for.',
      count: wishlistCount,
      to: '/wishlist'
    },
    {
      title: 'For Sale',
      description: 'Toys currently marked for sale.',
      count: forSaleCount,
      to: '/for-sale'
    }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-toydb-navy">Lists</h2>
        <p className="mt-1 text-sm text-toydb-slate">Browse your saved lists and active sales items.</p>
      </div>

      {loading ? (
        <div className="text-toydb-slate">Loading list stats…</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {cards.map(card => (
            <Link key={card.title} to={card.to} className="block rounded-xl border border-toydb-border bg-toydb-white p-5 shadow-sm transition hover:border-toydb-teal hover:shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-toydb-navy">{card.title}</div>
                  <div className="mt-1 text-sm text-toydb-slate">{card.description}</div>
                </div>
                <div className="rounded-full bg-toydb-teal-pale px-3 py-1 text-sm font-semibold text-toydb-teal-dark">{card.count}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
