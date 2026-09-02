import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

type NominatimResult = {
  lat?: string
  lon?: string
  display_name?: string
}

const BASE_URL = process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org'

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim()
  const customerId = request.nextUrl.searchParams.get('customer_id')?.trim()

  if (!query) {
    return NextResponse.json({ error: 'Address is required.' }, { status: 400 })
  }

  const url = new URL('/search', BASE_URL)
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'id')
  url.searchParams.set('addressdetails', '1')

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CRL-Indosat-Field-App/1.0',
        'Accept-Language': 'id,en;q=0.8',
      },
      next: { revalidate: 2592000 },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Geocoding failed (${response.status}).` },
        { status: 502 }
      )
    }

    const results = (await response.json()) as NominatimResult[]
    const first = results[0]

    if (!first?.lat || !first?.lon) {
      return NextResponse.json({ found: false })
    }

    const latitude = Number(first.lat)
    const longitude = Number(first.lon)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ found: false })
    }

    let persisted = false
    if (customerId) {
      const supabase = await createClient()
      const { error: persistError } = await supabase.rpc('update_customer_geocode', {
        p_customer_id: customerId,
        p_latitude: latitude,
        p_longitude: longitude,
      })

      if (persistError) {
        console.error('persist customer geocode:', persistError)
      } else {
        persisted = true
      }
    }

    return NextResponse.json(
      {
        found: true,
        latitude,
        longitude,
        persisted,
        displayName: first.display_name || query,
        attribution: '© OpenStreetMap contributors',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
        },
      }
    )
  } catch (error) {
    console.error('geocode:', error)
    return NextResponse.json({ error: 'Unable to geocode address.' }, { status: 502 })
  }
}
