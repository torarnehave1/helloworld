/**
 * HelloWorld Auth Worker
 * Handles authentication for hello.vegvisr.org using service bindings to existing workers
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const createResponse = (body, status = 200, headers = {}) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...headers },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return createResponse(JSON.stringify({ ok: true, service: 'helloworld-auth-worker' }))
    }

    // ============================================
    // EMAIL CHECK - Proxy to main worker
    // ============================================
    if (url.pathname === '/check-email' && request.method === 'GET') {
      const email = url.searchParams.get('email')
      if (!email) {
        return createResponse(JSON.stringify({ error: 'Email required' }), 400)
      }

      try {
        const res = await fetch(
          `https://test.vegvisr.org/check-email?email=${encodeURIComponent(email)}`
        )
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // ============================================
    // MAGIC LINK - Proxy to email worker
    // ============================================
    if (url.pathname === '/magic/send' && request.method === 'POST') {
      try {
        const body = await request.json()
        const res = await fetch('https://email-worker.torarnehave.workers.dev/login/magic/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            // Override redirect URL to come back to HelloWorld
            redirectUrl: 'https://hello.vegvisr.org/login',
          }),
        })
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    if (url.pathname === '/magic/verify' && request.method === 'GET') {
      const token = url.searchParams.get('token')
      if (!token) {
        return createResponse(JSON.stringify({ error: 'Token required' }), 400)
      }

      try {
        const res = await fetch(
          `https://email-worker.torarnehave.workers.dev/login/magic/verify?token=${encodeURIComponent(token)}`
        )
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // ============================================
    // USER DATA - Proxy to dashboard worker
    // ============================================
    if (url.pathname === '/userdata' && request.method === 'GET') {
      const email = url.searchParams.get('email')
      if (!email) {
        return createResponse(JSON.stringify({ error: 'Email required' }), 400)
      }

      try {
        const res = await fetch(
          `https://dashboard.vegvisr.org/userdata?email=${encodeURIComponent(email)}`
        )
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    if (url.pathname === '/get-role' && request.method === 'GET') {
      const email = url.searchParams.get('email')
      if (!email) {
        return createResponse(JSON.stringify({ error: 'Email required' }), 400)
      }

      try {
        const res = await fetch(
          `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email)}`
        )
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // ============================================
    // TOKEN VALIDATION - Proxy to dashboard worker
    // ============================================
    if (url.pathname === '/validate-token' && request.method === 'GET') {
      try {
        const authHeader = request.headers.get('Authorization')
        const apiToken = request.headers.get('X-API-Token')

        const res = await fetch('https://dashboard.vegvisr.org/auth/validate-token', {
          method: 'GET',
          headers: {
            ...(authHeader && { Authorization: authHeader }),
            ...(apiToken && { 'X-API-Token': apiToken }),
          },
        })
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  },
}
