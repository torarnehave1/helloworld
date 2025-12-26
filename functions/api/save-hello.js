export async function onRequest(context) {
  const { request, env } = context

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  }

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    })
  }

  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') ||
                  getCookie(request, 'vegvisr_token')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No token provided' }), {
        status: 401,
        headers: corsHeaders
      })
    }

    // Validate token with auth-worker service binding
    if (!env?.AUTH_WORKER?.fetch) {
      return new Response(JSON.stringify({
        error: 'Auth Worker service binding not configured'
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    const authResponse = await env.AUTH_WORKER.fetch(
      'https://helloworld-auth-worker/validate-token',
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    )
    const authData = await authResponse.json()

    if (!authData.valid) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: corsHeaders
      })
    }

    // Parse request body
    const body = await request.json()
    const { title, message, email } = body

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Create graph data
    const graphId = `graph_${Date.now()}`
    const nodeId = crypto.randomUUID()
    const now = new Date().toISOString()

    const graphData = {
      metadata: {
        title: title || 'Hello World Document',
        description: `Hello World document created by ${email || 'unknown'} at ${now}`,
        createdBy: 'helloworld-app',
        version: 0
      },
      nodes: [
        {
          id: nodeId,
          color: '#4f6d7a',
          label: title || 'Hello World',
          type: 'fulltext',
          info: `# ${title || 'Hello World'}\n\n${message}\n\n---\n\n*Created by: ${email || 'unknown'}*\n\n*Created at: ${now}*`,
          bibl: ['https://helloworld.vegvisr.org'],
          imageWidth: null,
          imageHeight: null,
          visible: true,
          position: { x: 0, y: 0 },
          path: null
        }
      ],
      edges: []
    }

    // Save to Knowledge Graph using SERVICE BINDING
    if (!env?.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return new Response(JSON.stringify({
        error: 'Knowledge Graph service binding not configured'
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    const kgResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/saveGraphWithHistory',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: graphId,
          graphData: graphData,
          override: false
        })
      }
    )

    const kgResponseText = await kgResponse.text()

    if (!kgResponse.ok) {
      console.error('Knowledge Graph error:', kgResponseText)
      return new Response(JSON.stringify({
        error: 'Failed to save to Knowledge Graph',
        details: kgResponseText
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    // Try to parse response as JSON, fallback to text
    let kgResult
    try {
      kgResult = JSON.parse(kgResponseText)
    } catch {
      kgResult = { raw: kgResponseText }
    }

    return new Response(JSON.stringify({
      success: true,
      graphId: graphId,
      nodeId: nodeId,
      message: 'Document saved to Knowledge Graph',
      kgResponse: kgResult
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
    console.error('API error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500,
      headers: corsHeaders
    })
  }
}

function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || ''
  const match = cookies.match(new RegExp(`${name}=([^;]+)`))
  return match ? match[1] : null
}
