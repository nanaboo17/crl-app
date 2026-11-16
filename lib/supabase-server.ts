import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { CookieOptions } from '@supabase/ssr'

type CookieToSet = {
  name: string
  value: string
  options?: CookieOptions
}

export async function createClient() {
  const cookieStore = await cookies()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Avoid logging the values: only report configuration presence in staging logs.
  if (!url || !key) {
    console.error('[CRL Supabase server config]', {
      missingUrl: !url,
      missingPublishableOrAnonKey: !key,
      runtime: 'server',
    })
    throw new Error('Supabase server configuration is missing; check Cloudflare Worker environment variables')
  }

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },

        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Can happen when called from a Server Component
          }
        },
      },
    }
  )
}