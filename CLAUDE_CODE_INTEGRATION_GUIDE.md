# Claude Code Integration Guide for Vegvisr Apps

This guide helps Claude Code understand how to create new applications that integrate with the Vegvisr ecosystem. All new apps should follow these patterns for authentication and Knowledge Graph integration.

---

## CRITICAL ARCHITECTURE PATTERN

**Every Vegvisr app MUST have its own Auth Worker.** The frontend should NEVER call backend services directly.

### Correct Pattern (WCX Example):
```
Frontend (wcx.vegvisr.org)
    ↓ calls
wcx-auth-worker.torarnehave.workers.dev
    ↓ proxies to
dashboard.vegvisr.org, email-worker, auth.vegvisr.org
```

### WRONG Pattern (Do NOT do this):
```
Frontend
    ↓ calls directly
dashboard.vegvisr.org (WRONG!)
```

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Framework** | Vue 3 + Vite |
| **State Management** | Pinia stores |
| **Routing** | Vue Router 4 |
| **Backend** | Cloudflare Workers |
| **Auth Pattern** | App-specific auth-worker that proxies to Vegvisr services |
| **Auth Token Cookie** | `vegvisr_token` (30-day expiry) |
| **User Storage** | localStorage key: `app_user` (app-specific prefix) |

---

## 1. Project Structure Template

```
my-new-app/
├── src/
│   ├── main.js              # App initialization
│   ├── App.vue              # Root component with logout
│   ├── router/
│   │   └── index.js         # Routes with auth guards
│   ├── stores/
│   │   └── userStore.js     # Authentication state (REQUIRED)
│   ├── views/
│   │   ├── LoginView.vue    # Authentication (REQUIRED)
│   │   └── MainView.vue     # Your main app view
│   └── components/          # Reusable components
├── functions/
│   └── api/
│       └── your-api.js      # Cloudflare Pages Function API
├── my-app-auth-worker/      # REQUIRED: App's auth worker
│   ├── index.js             # Auth worker code
│   └── wrangler.toml        # Auth worker config
├── package.json
├── vite.config.js
├── wrangler.toml            # Main app Cloudflare config
└── README.md                # Project documentation (REQUIRED)
```

---

## 2. Auth Worker (REQUIRED)

**Every app MUST have its own auth-worker.** Create `/my-app-auth-worker/index.js`:

```javascript
/**
 * My App Auth Worker
 * Handles authentication by proxying to Vegvisr services
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
        headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' },
      })
    }

    // Health check
    if (url.pathname === '/' || url.pathname === '/health') {
      return createResponse(JSON.stringify({ ok: true, service: 'my-app-auth-worker' }))
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
            // Override redirect URL to come back to YOUR app
            redirectUrl: 'https://my-app.vegvisr.org/login',
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
```

### Auth Worker wrangler.toml

Create `/my-app-auth-worker/wrangler.toml`:

```toml
name = "my-app-auth-worker"
main = "index.js"
compatibility_date = "2024-01-01"

# Enable workers.dev for deployment
workers_dev = true
```

### Deploy Auth Worker First

```bash
cd my-app-auth-worker
npx wrangler deploy
```

This creates: `https://my-app-auth-worker.torarnehave.workers.dev`

---

## 3. User Store (Uses Auth Worker)

Create `/src/stores/userStore.js`:

```javascript
import { defineStore } from 'pinia'

// IMPORTANT: All requests go through the app's auth-worker
const AUTH_API = 'https://my-app-auth-worker.torarnehave.workers.dev'

export const useUserStore = defineStore('user', {
  state: () => ({
    email: '',
    role: '',
    user_id: '',
    emailVerificationToken: '',
    loggedIn: false
  }),

  actions: {
    setAuthCookie(token) {
      const expires = new Date()
      expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      // Set cookie for vegvisr.org domain (cross-app auth)
      document.cookie = `vegvisr_token=${token}; expires=${expires.toUTCString()}; path=/; domain=.vegvisr.org; SameSite=Lax; Secure`

      // Also set for current domain (development)
      document.cookie = `vegvisr_token=${token}; expires=${expires.toUTCString()}; path=/; SameSite=Lax; Secure`
    },

    clearAuthCookie() {
      document.cookie = 'vegvisr_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.vegvisr.org;'
      document.cookie = 'vegvisr_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    },

    setUser(user) {
      this.email = user.email || ''
      this.role = user.role || ''
      this.user_id = user.user_id || ''
      this.emailVerificationToken = user.emailVerificationToken || ''
      this.loggedIn = true

      // Persist to localStorage
      localStorage.setItem('app_user', JSON.stringify({
        email: this.email,
        role: this.role,
        user_id: this.user_id,
        emailVerificationToken: this.emailVerificationToken
      }))

      // Set auth cookie
      if (user.emailVerificationToken) {
        this.setAuthCookie(user.emailVerificationToken)
      }
    },

    logout() {
      this.email = ''
      this.role = ''
      this.user_id = ''
      this.emailVerificationToken = ''
      this.loggedIn = false

      localStorage.removeItem('app_user')
      sessionStorage.removeItem('email_session_verified')
      this.clearAuthCookie()
    },

    loadFromStorage() {
      const stored = localStorage.getItem('app_user')
      if (stored) {
        try {
          const user = JSON.parse(stored)
          this.email = user.email || ''
          this.role = user.role || ''
          this.user_id = user.user_id || ''
          this.emailVerificationToken = user.emailVerificationToken || ''
          this.loggedIn = !!user.email
        } catch (e) {
          console.error('Failed to load user from storage:', e)
        }
      }
    },

    async fetchUserContext(email) {
      try {
        // IMPORTANT: Call auth-worker, NOT dashboard.vegvisr.org directly!
        const roleResponse = await fetch(
          `${AUTH_API}/get-role?email=${encodeURIComponent(email)}`
        )
        const roleData = await roleResponse.json()

        const userResponse = await fetch(
          `${AUTH_API}/userdata?email=${encodeURIComponent(email)}`
        )
        const userData = await userResponse.json()

        return {
          email,
          role: roleData.role || 'User',
          user_id: userData.user_id || '',
          emailVerificationToken: userData.emailVerificationToken || ''
        }
      } catch (error) {
        console.error('Failed to fetch user context:', error)
        return null
      }
    }
  }
})
```

---

## 4. Login View (Uses Auth Worker)

Create `/src/views/LoginView.vue`:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// IMPORTANT: All auth requests go through the app's auth-worker
const AUTH_API = 'https://my-app-auth-worker.torarnehave.workers.dev'

// State
const email = ref('')
const step = ref('email') // 'email' | 'magic' | 'verifying'
const loading = ref(false)
const error = ref('')
const success = ref('')

// Check for magic token in URL on mount
onMounted(async () => {
  const magicToken = route.query.magic || route.query.token
  if (magicToken) {
    await verifyMagicToken(magicToken)
  }

  // Check if already logged in
  userStore.loadFromStorage()
  const emailVerified = sessionStorage.getItem('email_session_verified') === '1'
  if (userStore.loggedIn && emailVerified) {
    router.push('/')
  }
})

// Check if email exists (via auth-worker)
async function checkEmail() {
  if (!email.value || !email.value.includes('@')) {
    error.value = 'Please enter a valid email address'
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    const response = await fetch(
      `${AUTH_API}/check-email?email=${encodeURIComponent(email.value)}`
    )
    const data = await response.json()

    if (data.exists) {
      await sendMagicLink()
    } else {
      error.value = 'Email not registered. Please contact admin to get access.'
    }
  } catch (e) {
    error.value = 'Failed to check email. Please try again.'
    console.error('Check email error:', e)
  } finally {
    loading.value = false
  }
}

// Send magic link (via auth-worker)
async function sendMagicLink() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${AUTH_API}/magic/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value
        // Note: redirectUrl is set by auth-worker
      })
    })

    if (response.ok) {
      step.value = 'magic'
      success.value = 'Magic link sent! Check your email.'
    } else {
      const errorData = await response.json().catch(() => ({}))
      error.value = errorData.error || 'Failed to send magic link. Please try again.'
    }
  } catch (e) {
    error.value = 'Network error. Please check your connection and try again.'
    console.error('Send magic link error:', e)
  } finally {
    loading.value = false
  }
}

// Verify magic token (via auth-worker)
async function verifyMagicToken(token) {
  loading.value = true
  error.value = ''
  step.value = 'verifying'

  try {
    const response = await fetch(
      `${AUTH_API}/magic/verify?token=${encodeURIComponent(token)}`
    )
    const data = await response.json()

    if (data.success && data.email) {
      // Fetch full user context (via auth-worker)
      const userContext = await userStore.fetchUserContext(data.email)

      if (userContext) {
        userStore.setUser({
          ...userContext,
          emailVerificationToken: data.token || token
        })
        sessionStorage.setItem('email_session_verified', '1')
        success.value = 'Login successful! Redirecting...'

        setTimeout(() => {
          router.push('/')
        }, 500)
      } else {
        userStore.setUser({
          email: data.email,
          emailVerificationToken: data.token || token
        })
        sessionStorage.setItem('email_session_verified', '1')
        router.push('/')
      }
    } else {
      error.value = data.error || 'Invalid or expired magic link. Please request a new one.'
      step.value = 'email'
    }
  } catch (e) {
    error.value = 'Failed to verify magic link. Please try again.'
    step.value = 'email'
    console.error('Verify magic link error:', e)
  } finally {
    loading.value = false
    router.replace({ query: {} })
  }
}

function handleSubmit() {
  if (step.value === 'email') {
    checkEmail()
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <h1>My App</h1>

      <!-- Verifying Step -->
      <div v-if="step === 'verifying'">
        <p>Verifying your login...</p>
      </div>

      <!-- Email Step -->
      <div v-else-if="step === 'email'">
        <form @submit.prevent="handleSubmit">
          <label for="email">Email Address</label>
          <input
            id="email"
            v-model="email"
            type="email"
            placeholder="you@example.com"
            :disabled="loading"
          />
          <button type="submit" :disabled="loading">
            {{ loading ? 'Checking...' : 'Continue with Magic Link' }}
          </button>
        </form>
      </div>

      <!-- Magic Link Sent Step -->
      <div v-else-if="step === 'magic'">
        <h2>Check your email</h2>
        <p>We sent a magic link to: {{ email }}</p>
        <button @click="sendMagicLink" :disabled="loading">
          {{ loading ? 'Sending...' : 'Resend Magic Link' }}
        </button>
        <button @click="step = 'email'">
          Use a different email
        </button>
      </div>

      <div v-if="error" class="error">{{ error }}</div>
      <div v-if="success" class="success">{{ success }}</div>
    </div>
  </div>
</template>
```

---

## 5. Main App wrangler.toml

Create `/wrangler.toml`:

```toml
name = "my-app-vegvisr"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

# Service binding to Knowledge Graph Worker
[[services]]
binding = "KNOWLEDGE_GRAPH_WORKER"
service = "knowledge-graph-worker"

# Service binding to App's Auth Worker
[[services]]
binding = "AUTH_WORKER"
service = "my-app-auth-worker"

[vars]
ENVIRONMENT = "production"
```

---

## 6. API Function (Uses Service Bindings)

Create `/functions/api/save-data.js`:

```javascript
export async function onRequest(context) {
  const { request, env } = context

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders
    })
  }

  try {
    // Get auth token
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') ||
                  getCookie(request, 'vegvisr_token')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized - No token' }), {
        status: 401,
        headers: corsHeaders
      })
    }

    // Validate token via AUTH_WORKER service binding
    if (!env?.AUTH_WORKER?.fetch) {
      return new Response(JSON.stringify({
        error: 'Auth Worker service binding not configured'
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    const authResponse = await env.AUTH_WORKER.fetch(
      'https://my-app-auth-worker/validate-token',
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
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
    const { title, content, email } = body

    if (!content) {
      return new Response(JSON.stringify({ error: 'Content is required' }), {
        status: 400,
        headers: corsHeaders
      })
    }

    // Save to Knowledge Graph via service binding
    if (!env?.KNOWLEDGE_GRAPH_WORKER?.fetch) {
      return new Response(JSON.stringify({
        error: 'Knowledge Graph service binding not configured'
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    const graphId = `graph_${Date.now()}`
    const nodeId = crypto.randomUUID()
    const now = new Date().toISOString()

    const graphData = {
      metadata: {
        title: title || 'Document',
        description: `Created by ${email || 'unknown'} at ${now}`,
        createdBy: 'my-app',
        version: 0
      },
      nodes: [
        {
          id: nodeId,
          color: '#4f6d7a',
          label: title || 'Document',
          type: 'fulltext',
          info: content,
          bibl: ['https://my-app.vegvisr.org'],
          imageWidth: null,
          imageHeight: null,
          visible: true,
          position: { x: 0, y: 0 },
          path: null
        }
      ],
      edges: []
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

    const kgResult = await kgResponse.text()

    if (!kgResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Failed to save to Knowledge Graph',
        details: kgResult
      }), {
        status: 500,
        headers: corsHeaders
      })
    }

    return new Response(JSON.stringify({
      success: true,
      graphId: graphId,
      nodeId: nodeId
    }), {
      status: 200,
      headers: corsHeaders
    })

  } catch (error) {
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
```

---

## 7. Deployment Steps

```bash
# 1. Deploy auth-worker FIRST
cd my-app-auth-worker
npx wrangler deploy

# 2. Build frontend
cd ..
npm run build

# 3. Deploy Pages with service bindings
npx wrangler pages deploy dist --project-name=my-app
```

---

## Summary Checklist

When creating a new Vegvisr-integrated app, ensure you have:

- [ ] **Auth Worker** (`my-app-auth-worker/`) - Proxies all auth requests
- [ ] **Deploy auth-worker first** before the main app
- [ ] **Frontend calls ONLY auth-worker** - Never call backend services directly
- [ ] **User store** uses `AUTH_API` pointing to auth-worker
- [ ] **Login view** uses auth-worker for all auth operations
- [ ] **wrangler.toml** with service bindings for both AUTH_WORKER and KNOWLEDGE_GRAPH_WORKER
- [ ] **API functions** use service bindings for auth validation
- [ ] **README.md** with setup and usage documentation
- [ ] Auth cookie management (`vegvisr_token`)
- [ ] Router with auth guards
