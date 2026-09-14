import { createBrowserClient } from '@supabase/ssr'

const DIAGNOSTIC_TABLE = 'field_form_diagnostic_logs'
export const AUTH_REFRESH_FAILED_EVENT = 'crl:auth-refresh-failed'
export const PENDING_AUTH_DIAGNOSTIC_KEY = 'crl:pending-auth-diagnostic'

function inferFieldContext() {
  if (typeof window === 'undefined') return null

  const url = new URL(window.location.href)
  const path = url.pathname

  if (path.includes('/pre-visit')) {
    return {
      formType: 'previsit' as const,
      customerId: url.searchParams.get('customer'),
      pagePath: `${path}${url.search}`,
    }
  }

  const visitMatch = path.match(/\/agent\/customers\/([^/]+)\/visit(?:\/|$)/)
  if (visitMatch) {
    return {
      formType: 'visit' as const,
      customerId: decodeURIComponent(visitMatch[1]),
      pagePath: `${path}${url.search}`,
    }
  }

  return null
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined)
  if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value))
  return headers
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
}

function isRefreshTokenRequest(input: RequestInfo | URL) {
  try {
    const url = new URL(requestUrl(input))
    return url.pathname.endsWith('/auth/v1/token') && url.searchParams.get('grant_type') === 'refresh_token'
  } catch {
    return false
  }
}

async function parseResponseError(response: Response) {
  try {
    const text = await response.clone().text()
    if (!text) return {} as Record<string, any>
    try {
      return JSON.parse(text) as Record<string, any>
    } catch {
      return { message: text.slice(0, 1500) }
    }
  } catch {
    return {} as Record<string, any>
  }
}

function classifyAuthRefreshError(parsed: Record<string, any>, status: number) {
  const haystack = `${parsed.code || ''} ${parsed.error_code || ''} ${parsed.error || ''} ${parsed.message || ''}`.toLowerCase()
  if (haystack.includes('refresh_token_not_found') || haystack.includes('refresh token not found')) return 'REFRESH_TOKEN_NOT_FOUND'
  if (haystack.includes('already used') || haystack.includes('reuse')) return 'REFRESH_TOKEN_REUSED'
  if (haystack.includes('expired')) return 'REFRESH_TOKEN_EXPIRED'
  if (haystack.includes('invalid')) return 'REFRESH_TOKEN_INVALID'
  return `AUTH_REFRESH_HTTP_${status}`
}

function queueAuthRefreshDiagnostic(response: Response, parsed: Record<string, any>) {
  if (typeof window === 'undefined') return
  const context = inferFieldContext()
  const record = {
    customer_id: context?.customerId || null,
    form_type: context?.formType || 'unknown',
    stage: 'auth_refresh_failed',
    severity: 'error',
    request_method: 'POST',
    request_target: '/auth/v1/token?grant_type=refresh_token',
    http_status: response.status,
    error_code: classifyAuthRefreshError(parsed, response.status),
    error_message: String(parsed.message || parsed.error_description || parsed.error || response.statusText || 'Authentication refresh failed').slice(0, 2000),
    error_details: parsed.details ? String(parsed.details).slice(0, 4000) : null,
    error_hint: parsed.hint ? String(parsed.hint).slice(0, 2000) : null,
    page_path: context?.pagePath || `${window.location.pathname}${window.location.search}`,
    online: navigator.onLine,
    user_agent: navigator.userAgent.slice(0, 1000),
    metadata: {
      occurred_at: new Date().toISOString(),
      response_status_text: response.statusText || null,
      browser_language: navigator.language,
      auth_response: {
        code: parsed.code || parsed.error_code || null,
        error: parsed.error || null,
        message: parsed.message || parsed.error_description || null,
      },
    },
  }

  try {
    localStorage.setItem(PENDING_AUTH_DIAGNOSTIC_KEY, JSON.stringify(record))
  } catch {
    // Recovery still proceeds even when local storage is unavailable.
  }

  window.dispatchEvent(new CustomEvent(AUTH_REFRESH_FAILED_EVENT, { detail: record }))
}

async function writeDiagnosticLog(args: {
  nativeFetch: typeof fetch
  input: RequestInfo | URL
  init?: RequestInit
  response?: Response
  thrownError?: unknown
}) {
  const context = inferFieldContext()
  if (!context) return

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) return

  const url = requestUrl(args.input)
  if (url.includes(`/rest/v1/${DIAGNOSTIC_TABLE}`)) return

  let target = url
  try {
    target = new URL(url).pathname
  } catch {
    // Keep original target.
  }

  const parsedError = args.response ? await parseResponseError(args.response) : {}
  const thrown = args.thrownError instanceof Error ? args.thrownError : null
  const headers = requestHeaders(args.input, args.init)
  const authorization = headers.get('authorization')
  if (!authorization) return

  const requestMethod = args.init?.method || (args.input instanceof Request ? args.input.method : 'GET')
  const errorMessage = thrown?.message || parsedError.message || parsedError.error || args.response?.statusText || 'Unknown request error'

  const body = {
    customer_id: context.customerId || null,
    form_type: context.formType,
    stage: args.thrownError ? 'network_request' : 'supabase_request',
    severity: 'error',
    request_method: requestMethod,
    request_target: target,
    http_status: args.response?.status ?? null,
    error_code: parsedError.code ? String(parsedError.code) : null,
    error_message: String(errorMessage).slice(0, 2000),
    error_details: parsedError.details ? String(parsedError.details).slice(0, 4000) : null,
    error_hint: parsedError.hint ? String(parsedError.hint).slice(0, 2000) : null,
    page_path: context.pagePath,
    online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 1000) : null,
    metadata: {
      response_status_text: args.response?.statusText || null,
      browser_language: typeof navigator !== 'undefined' ? navigator.language : null,
    },
  }

  try {
    await args.nativeFetch(`${supabaseUrl}/rest/v1/${DIAGNOSTIC_TABLE}`, {
      method: 'POST',
      headers: {
        apikey: headers.get('apikey') || publishableKey,
        authorization,
        'content-type': 'application/json',
        prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
      keepalive: true,
    })
  } catch {
    // Diagnostics must never block the actual field workflow.
  }
}

function diagnosticFetch(): typeof fetch {
  const nativeFetch = globalThis.fetch.bind(globalThis)

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const response = await nativeFetch(input, init)
      if (!response.ok) {
        if (isRefreshTokenRequest(input)) {
          const parsed = await parseResponseError(response)
          queueAuthRefreshDiagnostic(response, parsed)
        }
        void writeDiagnosticLog({ nativeFetch, input, init, response })
      }
      return response
    } catch (error) {
      void writeDiagnosticLog({ nativeFetch, input, init, thrownError: error })
      throw error
    }
  }) as typeof fetch
}

export function clearSupabaseBrowserSession() {
  if (typeof window === 'undefined') return
  try {
    const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname.split('.')[0]
    const prefix = ref ? `sb-${ref}-auth-token` : 'sb-'

    document.cookie.split(';').forEach((part) => {
      const name = part.split('=')[0]?.trim()
      if (!name || !name.startsWith(prefix)) return
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`
    })

    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith(prefix)) localStorage.removeItem(key)
    }
  } catch {
    // Best-effort cleanup. Redirect still forces a fresh auth flow.
  }
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: diagnosticFetch() } }
  )
}
