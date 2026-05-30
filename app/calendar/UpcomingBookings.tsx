'use client'

import { useEffect, useState } from 'react'
import { formatInTz } from '@/lib/booking-time'

type ClientBooking = {
  id: string
  service_name: string
  service_color: string | null
  start_at: string
  duration_minutes: number
  client_tz: string
  status: string
  payment_status: 'pending' | 'paid' | 'included' | 'waived' | 'refunded'
  location: string | null
  meeting_url: string | null
  notes: string | null
  payment_link: string | null
}

export default function UpcomingBookings() {
  const [bookings, setBookings] = useState<ClientBooking[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const horizon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()
    fetch(`/api/client/bookings?to=${encodeURIComponent(horizon)}`)
      .then((r) => r.ok ? r.json() : { bookings: [] })
      .then((d) => setBookings((d.bookings ?? []).filter((b: ClientBooking) => b.status === 'confirmed')))
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded || bookings.length === 0) return null

  return (
    <section className="mb-5">
      <h2 className="text-sm font-bold text-gray-900 mb-2 px-1">Upcoming sessions</h2>
      <div className="space-y-2">
        {bookings.map((b) => (
          <div key={b.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.service_color ?? '#1D9E75' }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{b.service_name}</p>
                  {b.payment_status === 'pending' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                      Payment due
                    </span>
                  )}
                  {b.payment_status === 'paid' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                      Paid
                    </span>
                  )}
                  {b.payment_status === 'included' && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      Included
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 mt-0.5">
                  {formatInTz(b.start_at, b.client_tz, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {b.duration_minutes} min
                </p>
                {(b.location || b.meeting_url) && (
                  <p className="text-xs text-gray-500 mt-1">
                    {b.location && <span className="mr-2">📍 {b.location}</span>}
                    {b.meeting_url && <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Join</a>}
                  </p>
                )}
                {b.notes && <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{b.notes}</p>}
                {b.payment_status === 'pending' && b.payment_link && (
                  <a
                    href={b.payment_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs font-semibold text-white bg-amber-500 hover:bg-amber-600 px-3 py-1.5 rounded-lg"
                  >
                    Pay now
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
