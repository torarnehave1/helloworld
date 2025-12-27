# Claude Code Integration Guide for Vegvisr Apps

This guide helps Claude Code create applications that integrate with the Vegvisr ecosystem. It is based on the working Web-Content-Extractor (WCX) app.

---

## CRITICAL: Authentication Architecture

### Frontend calls TWO services:
1. **Auth Worker** (`myapp-auth-worker.torarnehave.workers.dev`) - for `/check-email`, `/get-role`, `/userdata`
2. **Email Worker** (`email-worker.torarnehave.workers.dev`) - DIRECTLY for `/login/magic/send`, `/login/magic/verify`

### Pages Functions call dashboard DIRECTLY:
- Token validation: `dashboard.vegvisr.org/auth/validate-token` (NOT through auth-worker)
- This is how WCX does it

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Framework** | Vue 3 + Vite + Pinia |
| **Backend** | Cloudflare Pages + Workers |
| **Auth Cookie** | `vegvisr_token` (30-day, domain `.vegvisr.org`) |
| **localStorage** | `{appname}_user` |
| **sessionStorage** | `{appname}_session_verified` |

---

## 1. Project Structure

```
myapp/
├── src/
│   ├── main.js
│   ├── App.vue
│   ├── router/index.js
│   ├── stores/userStore.js
│   └── views/
│       ├── LoginView.vue
│       └── MainView.vue
├── functions/api/
│   └── save-data.js
├── myapp-auth-worker/
│   ├── index.js
│   └── wrangler.toml
├── wrangler.toml
├── vite.config.js
└── package.json
```

---

## 2. Main wrangler.toml

Only KNOWLEDGE_GRAPH_WORKER binding. NO auth-worker binding (Pages Functions call dashboard directly).

```toml
name = "myapp-vegvisr"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

[[services]]
binding = "KNOWLEDGE_GRAPH_WORKER"
service = "knowledge-graph-worker"

[vars]
ENVIRONMENT = "production"
```

---

## 3. Auth Worker

Create `myapp-auth-worker/index.js`:

```javascript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const createResponse = (body, status = 200) => {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' } })
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return createResponse(JSON.stringify({ ok: true, service: 'myapp-auth-worker' }))
    }

    // CHECK EMAIL
    if (url.pathname === '/check-email' && request.method === 'GET') {
      const email = url.searchParams.get('email')
      if (!email) return createResponse(JSON.stringify({ error: 'Email required' }), 400)
      try {
        const res = await fetch(`https://test.vegvisr.org/check-email?email=${encodeURIComponent(email)}`)
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // GET USER DATA
    if (url.pathname === '/userdata' && request.method === 'GET') {
      const email = url.searchParams.get('email')
      if (!email) return createResponse(JSON.stringify({ error: 'Email required' }), 400)
      try {
        const res = await fetch(`https://dashboard.vegvisr.org/userdata?email=${encodeURIComponent(email)}`)
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    // GET ROLE
    if (url.pathname === '/get-role' && request.method === 'GET') {
      const email = url.searchParams.get('email')
      if (!email) return createResponse(JSON.stringify({ error: 'Email required' }), 400)
      try {
        const res = await fetch(`https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email)}`)
        const data = await res.json()
        return createResponse(JSON.stringify(data), res.status)
      } catch (error) {
        return createResponse(JSON.stringify({ error: error.message }), 500)
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders })
  },
}
```

Create `myapp-auth-worker/wrangler.toml`:

```toml
name = "myapp-auth-worker"
main = "index.js"
compatibility_date = "2024-01-01"
workers_dev = true

[observability]
enabled = false
head_sampling_rate = 1

[observability.logs]
enabled = true
head_sampling_rate = 1
persist = true
invocation_logs = true
```

---

## 4. User Store (COPY FROM WCX EXACTLY)

Create `src/stores/userStore.js`:

```javascript
import { defineStore } from 'pinia'

const AUTH_API = 'https://myapp-auth-worker.torarnehave.workers.dev'

export const useUserStore = defineStore('user', {
  state: () => ({
    email: null,
    role: null,
    user_id: null,
    emailVerificationToken: null,
    phone: null,
    phoneVerifiedAt: null,
    loggedIn: false,
  }),

  actions: {
    setAuthCookie(token) {
      if (typeof document === 'undefined' || !token) return
      const isVegvisr = window.location.hostname.endsWith('vegvisr.org')
      const domain = isVegvisr ? '; Domain=.vegvisr.org' : ''
      const maxAge = 60 * 60 * 24 * 30 // 30 days
      document.cookie = `vegvisr_token=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure${domain}`
    },

    clearAuthCookie() {
      if (typeof document === 'undefined') return
      const isVegvisr = window.location.hostname.endsWith('vegvisr.org')
      const domain = isVegvisr ? '; Domain=.vegvisr.org' : ''
      document.cookie = `vegvisr_token=; Path=/; Max-Age=0; SameSite=Lax; Secure${domain}`
    },

    setUser(user) {
      this.email = user.email
      this.role = user.role
      this.user_id = user.user_id
      this.emailVerificationToken = user.emailVerificationToken
      this.phone = user.phone || null
      this.phoneVerifiedAt = user.phoneVerifiedAt || null
      this.loggedIn = true

      if (user.emailVerificationToken) {
        this.setAuthCookie(user.emailVerificationToken)
      }

      localStorage.setItem('myapp_user', JSON.stringify({
        email: user.email,
        role: user.role,
        user_id: user.user_id,
        emailVerificationToken: user.emailVerificationToken,
        phone: user.phone,
        phoneVerifiedAt: user.phoneVerifiedAt,
      }))
    },

    logout() {
      this.email = null
      this.role = null
      this.user_id = null
      this.emailVerificationToken = null
      this.phone = null
      this.phoneVerifiedAt = null
      this.loggedIn = false
      localStorage.removeItem('myapp_user')
      sessionStorage.removeItem('myapp_session_verified')
      this.clearAuthCookie()
    },

    loadFromStorage() {
      const stored = localStorage.getItem('myapp_user')
      if (stored) {
        try {
          const user = JSON.parse(stored)
          this.email = user.email
          this.role = user.role
          this.user_id = user.user_id
          this.emailVerificationToken = user.emailVerificationToken
          this.phone = user.phone
          this.phoneVerifiedAt = user.phoneVerifiedAt
          this.loggedIn = true
          return true
        } catch (e) {
          console.error('Failed to load user from storage:', e)
        }
      }
      return false
    },

    async fetchUserContext(email) {
      const roleRes = await fetch(`${AUTH_API}/get-role?email=${encodeURIComponent(email)}`)
      if (!roleRes.ok) {
        throw new Error('User not found')
      }
      const roleData = await roleRes.json()

      const userDataRes = await fetch(`${AUTH_API}/userdata?email=${encodeURIComponent(email)}`)
      if (!userDataRes.ok) {
        throw new Error('Unable to fetch user data')
      }
      const userData = await userDataRes.json()

      return {
        email,
        role: roleData.role,
        user_id: userData.user_id,
        emailVerificationToken: userData.emailVerificationToken,
        phone: userData.phone,
        phoneVerifiedAt: userData.phoneVerifiedAt,
      }
    },
  },
})
```

---

## 5. Login View (CALLS EMAIL_WORKER DIRECTLY)

Create `src/views/LoginView.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// TWO ENDPOINTS
const AUTH_API = 'https://myapp-auth-worker.torarnehave.workers.dev'
const EMAIL_WORKER = 'https://email-worker.torarnehave.workers.dev'

const email = ref('')
const step = ref('email')
const loading = ref(false)
const error = ref('')
const success = ref('')

onMounted(async () => {
  const magicToken = route.query.magic || route.query.token
  if (magicToken) {
    await verifyMagicToken(magicToken)
  }

  userStore.loadFromStorage()
  if (userStore.loggedIn && sessionStorage.getItem('myapp_session_verified') === '1') {
    router.push('/')
  }
})

// Check email via AUTH WORKER
async function checkEmail() {
  if (!email.value || !email.value.includes('@')) {
    error.value = 'Please enter a valid email address'
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await fetch(`${AUTH_API}/check-email?email=${encodeURIComponent(email.value)}`)
    const data = await response.json()

    if (data.exists) {
      await sendMagicLink()
    } else {
      error.value = 'Email not registered.'
    }
  } catch (e) {
    error.value = 'Failed to check email.'
  } finally {
    loading.value = false
  }
}

// Send magic link via EMAIL WORKER DIRECTLY
async function sendMagicLink() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${EMAIL_WORKER}/login/magic/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        redirectUrl: 'https://myapp.vegvisr.org/login'
      })
    })

    if (response.ok) {
      step.value = 'magic'
      success.value = 'Magic link sent! Check your email.'
    } else {
      error.value = 'Failed to send magic link.'
    }
  } catch (e) {
    error.value = 'Network error.'
  } finally {
    loading.value = false
  }
}

// CRITICAL: After magic link verification, use userContext from fetchUserContext
// The emailVerificationToken comes from /userdata endpoint, NOT from magic link response
async function verifyMagicToken(token) {
  loading.value = true
  step.value = 'verifying'

  try {
    const response = await fetch(`${EMAIL_WORKER}/login/magic/verify?token=${encodeURIComponent(token)}`)
    const data = await response.json()

    if (data.success && data.email) {
      // fetchUserContext gets emailVerificationToken from /userdata endpoint
      const userContext = await userStore.fetchUserContext(data.email)

      // IMPORTANT: Use userContext directly - it contains the correct token
      userStore.setUser(userContext)
      sessionStorage.setItem('myapp_session_verified', '1')
      router.push('/')
    } else {
      error.value = 'Invalid or expired magic link.'
      step.value = 'email'
    }
  } catch (e) {
    error.value = 'Failed to verify magic link.'
    step.value = 'email'
  } finally {
    loading.value = false
    router.replace({ query: {} })
  }
}

function handleSubmit() {
  if (step.value === 'email') checkEmail()
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>My App</h1>

      <div v-if="step === 'verifying'">
        <p>Verifying your login...</p>
      </div>

      <div v-else-if="step === 'email'">
        <form @submit.prevent="handleSubmit">
          <label for="email">Email Address</label>
          <input id="email" v-model="email" type="email" placeholder="you@example.com" :disabled="loading" />
          <button type="submit" :disabled="loading">
            {{ loading ? 'Checking...' : 'Continue with Magic Link' }}
          </button>
        </form>
      </div>

      <div v-else-if="step === 'magic'">
        <h2>Check your email</h2>
        <p>We sent a magic link to: {{ email }}</p>
        <button @click="sendMagicLink" :disabled="loading">Resend</button>
        <button @click="step = 'email'">Use different email</button>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  background: white;
  border-radius: 12px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.2);
}
h1 { text-align: center; margin-bottom: 20px; }
label { display: block; margin-bottom: 8px; font-weight: 500; }
input { width: 100%; padding: 12px; border: 2px solid #e1e5e9; border-radius: 8px; margin-bottom: 16px; }
button { width: 100%; padding: 14px; background: #4f6d7a; color: white; border: none; border-radius: 8px; cursor: pointer; margin-bottom: 8px; }
button:disabled { opacity: 0.6; }
.error { background: #fee; color: #c33; padding: 12px; border-radius: 8px; margin-top: 16px; }
.success { background: #efe; color: #363; padding: 12px; border-radius: 8px; margin-top: 16px; }
</style>
```

---

## 6. Pages Function (COPY PATTERN FROM WCX extract-content.js)

Create `functions/api/save-data.js`:

```javascript
/**
 * Pages Function - calls dashboard.vegvisr.org DIRECTLY for token validation
 * Pattern copied from WCX extract-content.js
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = buildCorsHeaders(request);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isAllowedOrigin(request)) {
      return unauthorizedResponse(request, corsHeaders, 'Origin not allowed');
    }

    const authResult = await verifySession(request);
    if (!authResult.ok) {
      return unauthorizedResponse(request, corsHeaders, 'Login required', authResult.status);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
    }

    // Your app logic here...

    // Save to Knowledge Graph
    if (!env?.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return new Response(JSON.stringify({ error: 'Knowledge Graph not configured' }), { status: 500, headers: corsHeaders });
    }

    const graphId = `graph_${Date.now()}`;
    const graphData = {
      metadata: { title: payload.title || 'Document', createdBy: 'myapp', version: 0 },
      nodes: [{ id: crypto.randomUUID(), label: payload.title, type: 'fulltext', info: payload.content, visible: true, position: { x: 0, y: 0 } }],
      edges: []
    };

    const kgResponse = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
      'https://knowledge-graph-worker/saveGraphWithHistory',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: graphId, graphData, override: false })
      }
    );

    if (!kgResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to save' }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, graphId }), { headers: corsHeaders });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
}

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = origin === 'https://myapp.vegvisr.org' ? origin : '*';
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
  return new Response(JSON.stringify({ error: reason || 'Unauthorized' }), { status, headers: corsHeaders });
}

function isAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'https://myapp.vegvisr.org') {
    return false;
  }
  const referer = request.headers.get('Referer');
  if (referer && !referer.startsWith('https://myapp.vegvisr.org/')) {
    return false;
  }
  return true;
}

// CALLS DASHBOARD DIRECTLY - same as WCX
async function verifySession(request) {
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
    // Allow User, Admin, Superadmin
    if (data?.valid && (role === 'Superadmin' || role === 'Admin' || role === 'User')) {
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
```

---

## 7. Deployment

```bash
# 1. Deploy auth-worker FIRST
cd myapp-auth-worker
npx wrangler deploy

# 2. Push to GitHub (Pages auto-deploys)
git add .
git commit -m "Initial app"
git push
```

---

## Image Upload to R2

All Vegvisr apps can upload images to the shared R2 bucket via `api.vegvisr.org/upload`. Images are served through imgix for optimization.

### Upload Endpoint

```
POST https://api.vegvisr.org/upload
Content-Type: multipart/form-data
Body: FormData with 'file' field
```

### Response

```json
{
  "url": "https://vegvisr.imgix.net/1234567890.jpg"
}
```

### Frontend Implementation

```javascript
// API endpoint for image uploads (shared Vegvisr R2 bucket)
const UPLOAD_API = 'https://api.vegvisr.org/upload'

async function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(UPLOAD_API, {
    method: 'POST',
    body: formData
  })

  const data = await response.json()
  const imageUrl = data.url  // https://vegvisr.imgix.net/filename.jpg

  // Insert markdown image syntax
  const markdownImage = `![${file.name}](${imageUrl})`
}
```

### Key Points

- No service binding needed - uses shared `api.vegvisr.org/upload` endpoint
- Auth cookie is shared across `.vegvisr.org` subdomains
- Images stored in `blog-pictures` R2 bucket
- Served via imgix CDN: `https://vegvisr.imgix.net/{filename}`
- Supports PNG, JPG, GIF, WebP, SVG

---

## Knowledge Graph API Documentation

The Knowledge Graph Worker provides an OpenAPI 3.0.3 specification endpoint for discovering all available API endpoints and their requirements.

### OpenAPI Docs Endpoint

```
GET https://knowledge-graph-worker.torarnehave.workers.dev/openapi.json
```

This returns the full OpenAPI specification including:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Required scopes for protected endpoints

### Key Endpoints

| Endpoint | Method | Auth Required | Scope | Description |
|----------|--------|---------------|-------|-------------|
| `/openapi.json` | GET | No | - | API documentation |
| `/saveGraphWithHistory` | POST | Yes | `graph:write` | Save graph with version history (recommended) |
| `/getknowgraph` | GET | No | - | Get a single graph by ID |
| `/getknowgraphs` | GET | No | - | List all graphs |
| `/getknowgraphhistory` | GET | No | - | Get version history for a graph |
| `/getknowgraphversion` | GET | No | - | Get specific version of a graph |
| `/duplicateknowgraph` | POST | Yes | `graph:write` | Duplicate an existing graph |
| `/deleteknowgraph` | POST | Yes | `graph:delete` | Delete a graph |
| `/public-graph` | GET | No | - | Get graph as HTML (SEO) |
| `/slideshow` | GET | No | - | Generate slideshow from fulltext node |
| `/getTemplates` | GET | No | - | List graph templates |
| `/addTemplate` | POST | Yes | `template:write` | Add a new template |

### Authentication Methods

The Knowledge Graph API supports three authentication methods:

1. **API Token** (for external API access)
   ```
   X-API-Token: vv_prod_abc123...
   ```

2. **Session-based** (for logged-in web users)
   ```
   x-user-role: User
   ```

3. **Service Binding** (for worker-to-worker calls)
   - No headers needed - uses `env.KNOWLEDGE_GRAPH_WORKER.fetch()`

### Example: Fetching API Docs

```javascript
// Get the OpenAPI spec to discover endpoints
const response = await fetch('https://knowledge-graph-worker.torarnehave.workers.dev/openapi.json')
const spec = await response.json()

console.log('Available endpoints:', Object.keys(spec.paths))
console.log('Security schemes:', spec.components.securitySchemes)
```

### Example: Saving with API Token

```javascript
const response = await fetch('https://knowledge-graph-worker.torarnehave.workers.dev/saveGraphWithHistory', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Token': 'vv_prod_your_token_here'
  },
  body: JSON.stringify({
    id: 'graph_123',
    graphData: {
      metadata: { title: 'My Graph', version: 0 },
      nodes: [],
      edges: []
    }
  })
})
```

---

## Summary Checklist

- [ ] Auth Worker deployed (`myapp-auth-worker`)
- [ ] wrangler.toml has ONLY `KNOWLEDGE_GRAPH_WORKER` binding (no AUTH_WORKER)
- [ ] LoginView calls `AUTH_API` for `/check-email`
- [ ] LoginView calls `EMAIL_WORKER` DIRECTLY for `/login/magic/send` and `/login/magic/verify`
- [ ] **CRITICAL: After magic verify, use `userStore.setUser(userContext)` directly - the `emailVerificationToken` comes from `/userdata`, NOT from magic link response**
- [ ] userStore uses `encodeURIComponent` for cookie token
- [ ] userStore checks `typeof document === 'undefined'` for SSR safety
- [ ] Pages Functions call `dashboard.vegvisr.org/auth/validate-token` DIRECTLY (not through auth-worker)
- [ ] Pages Functions only allow `Admin` or `Superadmin` roles
- [ ] Frontend fetch to `/api/*` does NOT send Authorization header (relies on cookie)
- [ ] localStorage key: `{appname}_user`
- [ ] sessionStorage key: `{appname}_session_verified`
