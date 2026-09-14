import { createBrowserClient } from '@supabase/ssr'

const DIAGNOSTIC_TABLE = 'field_form_diagnostic_logs'

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

  const requestUrl = typeof args.input === 'string'
    ? args.input
    : args.input instanceof URL
      ? args.input.toString()
      : args.input.url

  if (requestUrl.includes(`/rest/v1/${DIAGNOSTIC_TABLE}`)) return

  let target = requestUrl
  try {
    const parsed = new URL(requestUrl)
    target = parsed.pathname
  } catch {
    // Keep the original request target when URL parsing is unavailable.
  }

  let parsedError: Record<string, any> = {}
  if (args.response) {
    try {
      const text = await args.response.clone().text()
      if (text) {
        try {
          parsedError = JSON.parse(text)
        } catch {
          parsedError = { message: text.slice(0, 1500) }
        }
      }
    } catch {
      parsedError = {}
    }
  }

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
      if (!response.ok) void writeDiagnosticLog({ nativeFetch, input, init, response })
      return response
    } catch (error) {
      void writeDiagnosticLog({ nativeFetch, input, init, thrownError: error })
      throw error
    }
  }) as typeof fetch
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: diagnosticFetch() } }
  )
}
