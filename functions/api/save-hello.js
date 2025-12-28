/**
 * HelloWorld Save API - Cloudflare Pages Function
 * Saves content to Knowledge Graph with proper authentication
 * Pattern copied from Web-Content-Extractor extract-content.js
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = buildCorsHeaders(request);

  // Handle OPTIONS request for CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isAllowedOrigin(request)) {
      return unauthorizedResponse(request, corsHeaders, 'Origin not allowed');
    }

    const authResult = await verifyAdminSession(request);
    if (!authResult.ok) {
      return unauthorizedResponse(request, corsHeaders, 'Login required', authResult.status);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    const { title, content, email, youtubeUrl } = payload || {};

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: corsHeaders
      });
    }

    // Create graph data
    const graphId = `graph_${Date.now()}`;
    const nodeId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Start with the fulltext node
    const nodes = [
      {
        id: nodeId,
        color: '#4f6d7a',
        label: title || 'Hello Vegvisr',
        type: 'fulltext',
        info: `${content}\n\n---\n\n*Created by: ${email || 'unknown'}*\n\n*Created at: ${now}*`,
        bibl: ['https://hello.vegvisr.org'],
        imageWidth: null,
        imageHeight: null,
        visible: true,
        position: { x: 0, y: 0 },
        path: null
      }
    ];

    const edges = [];

    // If YouTube URL provided, create a separate youtube-video node
    let youtubeNodeId = null;
    if (youtubeUrl) {
      youtubeNodeId = crypto.randomUUID();


      nodes.push({
        id: youtubeNodeId,
        color: '#FF0000',
        label: `YouTube: ${title || 'Video'}`,
        type: 'youtube-video',
        info: `Video attached to: ${title || 'Hello Vegvisr Document'}\n\nCreated by: ${email || 'unknown'}\nCreated at: ${now}`,
        bibl: [youtubeUrl],
        imageWidth: '100%',
        imageHeight: '100%',
        visible: true,
        position: { x: 200, y: 0 },
        path: youtubeUrl
      });

      // Create an edge connecting the fulltext node to the youtube node
      edges.push({
        id: `edge_${Date.now()}`,
        source: nodeId,
        target: youtubeNodeId,
        label: 'has video'
      });
    }

    const graphData = {
      metadata: {
        title: title || 'Hello Vegvisr Document',
        description: `Markdown document created by ${email || 'unknown'} at ${now}${youtubeUrl ? ' (with YouTube video)' : ''}`,
        createdBy: 'helloworld-app',
        version: 0
      },
      nodes: nodes,
      edges: edges
    };

    // Save to Knowledge Graph using SERVICE BINDING
    if (!env?.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return new Response(JSON.stringify({
        error: 'Knowledge Graph service binding not configured'
      }), {
        status: 500,
        headers: corsHeaders
      });
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
    );

    const kgResponseText = await kgResponse.text();

    if (!kgResponse.ok) {
      console.error('Knowledge Graph error:', kgResponseText);
      return new Response(JSON.stringify({
        error: 'Failed to save to Knowledge Graph',
        details: kgResponseText
      }), {
        status: 500,
        headers: corsHeaders
      });
    }

    // Try to parse response as JSON, fallback to text
    let kgResult;
    try {
      kgResult = JSON.parse(kgResponseText);
    } catch {
      kgResult = { raw: kgResponseText };
    }

    const graphUrl = `https://www.vegvisr.org/gnew-viewer?graphId=${graphId}`;

    return new Response(JSON.stringify({
      success: true,
      graphId: graphId,
      nodeId: nodeId,
      graphUrl: graphUrl,
      message: 'Document saved to Knowledge Graph',
      kgResponse: kgResult
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({
      error: error.message || 'Failed to save content'
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
}

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin === 'https://hello.vegvisr.org' ? origin : '*';
  const headers = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (allowedOrigin !== '*') {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

function unauthorizedResponse(request, corsHeaders, reason, status = 401) {
  const accept = request.headers.get('Accept') || '';
  if (accept.includes('text/html')) {
    const body = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Login Required</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, sans-serif; margin: 0; padding: 48px; background: #f6f7fb; color: #1f2a37; }
      .card { max-width: 560px; margin: 0 auto; background: #fff; padding: 28px; border-radius: 12px; box-shadow: 0 6px 24px rgba(15, 23, 42, 0.08); }
      h1 { margin: 0 0 12px; font-size: 1.5rem; }
      p { margin: 0 0 18px; line-height: 1.6; }
      a.button { display: inline-block; padding: 10px 16px; background: #1d4ed8; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; }
      .note { margin-top: 16px; font-size: 0.9rem; color: #4b5563; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Login required</h1>
      <p>Please log in to HelloWorld to continue.</p>
      <a class="button" href="https://hello.vegvisr.org/login">Go to Login</a>
      <div class="note">${reason || 'Access restricted'}</div>
    </div>
  </body>
</html>`;

    return new Response(body, {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
    });
  }

  return new Response(JSON.stringify({ error: reason || 'Unauthorized' }), {
    status,
    headers: corsHeaders
  });
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'https://hello.vegvisr.org') {
    return false;
  }

  const referer = request.headers.get('Referer');
  if (referer && !referer.startsWith('https://hello.vegvisr.org/')) {
    return false;
  }

  return true;
}

async function verifyAdminSession(request) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return { ok: false, status: 401 };
    }

    const response = await fetch('https://dashboard.vegvisr.org/auth/validate-token', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    const data = await response.json().catch(() => null);
    const role = data?.role;
    if (data?.valid && (role === 'Superadmin' || role === 'Admin')) {
      return { ok: true, status: 200 };
    }

    return { ok: false, status: 403 };
  } catch (error) {
    console.error('Auth check failed:', error);
    return { ok: false, status: 500 };
  }
}

function getAuthToken(request) {
  const headerToken = request.headers.get('X-API-Token');
  if (headerToken) return headerToken;

  const authHeader = request.headers.get('Authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  const cookieHeader = request.headers.get('Cookie') || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((entry) => {
      const [key, ...rest] = entry.trim().split('=');
      return [key, rest.join('=')];
    })
  );
  return cookies.vegvisr_token || null;
}
