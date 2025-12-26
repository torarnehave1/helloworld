# Claude Code Integration Guide for Vegvisr Apps

This guide helps Claude Code understand how to create new applications that integrate with the Vegvisr ecosystem. All new apps should follow these patterns for authentication and Knowledge Graph integration.

---

## Quick Reference

| Aspect | Details |
|--------|---------|
| **Framework** | Vue 3 + Vite |
| **State Management** | Pinia stores |
| **Routing** | Vue Router 4 |
| **Backend** | Cloudflare Workers |
| **Database** | Cloudflare D1 (SQLite) |
| **Auth Token Cookie** | `vegvisr_token` (30-day expiry) |
| **User Storage** | localStorage key: `wcx_user` or app-specific |

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
│       └── your-api.js      # Cloudflare Worker API
├── package.json
├── vite.config.js
└── wrangler.toml            # Cloudflare config
```

---

## 2. Authentication Integration (REQUIRED)

### 2.1 User Store Template

Create `/src/stores/userStore.js`:

```javascript
import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({
    email: '',
    role: '',
    user_id: '',
    emailVerificationToken: '',
    phone: '',
    phoneVerifiedAt: null,
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
      this.phone = user.phone || ''
      this.phoneVerifiedAt = user.phoneVerifiedAt || null
      this.loggedIn = true

      // Persist to localStorage
      localStorage.setItem('app_user', JSON.stringify({
        email: this.email,
        role: this.role,
        user_id: this.user_id,
        emailVerificationToken: this.emailVerificationToken,
        phone: this.phone,
        phoneVerifiedAt: this.phoneVerifiedAt
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
      this.phone = ''
      this.phoneVerifiedAt = null
      this.loggedIn = false

      localStorage.removeItem('app_user')
      sessionStorage.removeItem('email_session_verified')
      sessionStorage.removeItem('phone_session_verified')
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
          this.phone = user.phone || ''
          this.phoneVerifiedAt = user.phoneVerifiedAt || null
          this.loggedIn = !!user.email
        } catch (e) {
          console.error('Failed to load user from storage:', e)
        }
      }
    },

    async fetchUserContext(email) {
      try {
        // Get user role
        const roleResponse = await fetch(
          `https://dashboard.vegvisr.org/get-role?email=${encodeURIComponent(email)}`
        )
        const roleData = await roleResponse.json()

        // Get user data
        const userResponse = await fetch(
          `https://dashboard.vegvisr.org/userdata?email=${encodeURIComponent(email)}`
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

### 2.2 Login View Template

Create `/src/views/LoginView.vue` with these core methods:

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// API Endpoints
const AUTH_API = 'https://wcx-auth-worker.torarnehave.workers.dev'
const EMAIL_WORKER = 'https://email-worker.torarnehave.workers.dev'

// State
const email = ref('')
const step = ref('email') // 'email' | 'magic' | 'phone' | 'code'
const loading = ref(false)
const error = ref('')

// Check for magic token in URL on mount
onMounted(async () => {
  const magicToken = route.query.magic
  if (magicToken) {
    await verifyMagicToken(magicToken)
  }

  // Check if already logged in
  userStore.loadFromStorage()
  if (userStore.loggedIn) {
    router.push('/')
  }
})

// Check if email exists
async function checkEmail() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(
      `${AUTH_API}/check-email?email=${encodeURIComponent(email.value)}`
    )
    const data = await response.json()

    if (data.exists) {
      await sendMagicLink()
    } else {
      error.value = 'Email not registered. Please contact admin.'
    }
  } catch (e) {
    error.value = 'Failed to check email'
  } finally {
    loading.value = false
  }
}

// Send magic link
async function sendMagicLink() {
  loading.value = true

  // Use current URL as redirect (replace /login with /)
  const redirectUrl = window.location.origin + '/'

  try {
    const response = await fetch(`${EMAIL_WORKER}/login/magic/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        redirectUrl: redirectUrl
      })
    })

    if (response.ok) {
      step.value = 'magic'
    } else {
      error.value = 'Failed to send magic link'
    }
  } catch (e) {
    error.value = 'Network error sending magic link'
  } finally {
    loading.value = false
  }
}

// Verify magic token
async function verifyMagicToken(token) {
  loading.value = true

  try {
    const response = await fetch(
      `${EMAIL_WORKER}/login/magic/verify?token=${encodeURIComponent(token)}`
    )
    const data = await response.json()

    if (data.success && data.email) {
      // Fetch full user context
      const userContext = await userStore.fetchUserContext(data.email)

      if (userContext) {
        userStore.setUser(userContext)
        sessionStorage.setItem('email_session_verified', '1')
        router.push('/')
      }
    } else {
      error.value = 'Invalid or expired magic link'
    }
  } catch (e) {
    error.value = 'Failed to verify magic link'
  } finally {
    loading.value = false
    // Clean URL
    router.replace({ query: {} })
  }
}
</script>

<template>
  <div class="login-container">
    <h1>Login</h1>

    <!-- Email Step -->
    <div v-if="step === 'email'">
      <input
        v-model="email"
        type="email"
        placeholder="Enter your email"
        @keyup.enter="checkEmail"
      />
      <button @click="checkEmail" :disabled="loading">
        {{ loading ? 'Checking...' : 'Continue' }}
      </button>
    </div>

    <!-- Magic Link Step -->
    <div v-if="step === 'magic'">
      <p>Check your email for a magic link!</p>
      <p>{{ email }}</p>
      <button @click="sendMagicLink" :disabled="loading">
        Resend Magic Link
      </button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>
```

### 2.3 Router with Auth Guards

Create `/src/router/index.js`:

```javascript
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const LoginView = () => import('@/views/LoginView.vue')
const MainView = () => import('@/views/MainView.vue')

const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    name: 'main',
    component: MainView,
    meta: { requiresAuth: true }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Auth guard
router.beforeEach((to, from, next) => {
  const userStore = useUserStore()

  // Load from storage if not already loaded
  if (!userStore.loggedIn) {
    userStore.loadFromStorage()
  }

  // Check session verification
  const emailVerified = sessionStorage.getItem('email_session_verified') === '1'
  const phoneVerified = sessionStorage.getItem('phone_session_verified') === '1'
  const sessionVerified = emailVerified || phoneVerified

  if (to.meta.requiresAuth) {
    if (!userStore.loggedIn || !userStore.email || !sessionVerified) {
      next({ name: 'login' })
      return
    }
  }

  // Redirect logged-in users away from login
  if (to.name === 'login' && userStore.loggedIn && sessionVerified) {
    next({ name: 'main' })
    return
  }

  next()
})

export default router
```

---

## 3. Knowledge Graph Integration

### 3.1 Saving Documents to Knowledge Graph

Use this pattern to save content as a Knowledge Graph node:

```javascript
// In your Cloudflare Worker (functions/api/your-api.js)

async function saveToKnowledgeGraph(env, content, title, sourceUrl) {
  const graphId = `graph_${Date.now()}`

  const graphData = {
    metadata: {
      title: title,
      description: `Document: ${title}`,
      createdBy: 'your-app-name',
      version: 0
    },
    nodes: [
      {
        id: crypto.randomUUID(),
        color: '#4f6d7a',
        label: title,
        type: 'fulltext',
        info: content,           // Your document content (Markdown)
        bibl: [sourceUrl],       // Source/bibliography
        imageWidth: null,
        imageHeight: null,
        visible: true,
        position: { x: 0, y: 0 },
        path: null
      }
    ],
    edges: []
  }

  // Option 1: Service binding (preferred, requires wrangler.toml config)
  if (env.KNOWLEDGE_GRAPH_WORKER) {
    const response = await env.KNOWLEDGE_GRAPH_WORKER.fetch(
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
    return response.json()
  }

  // Option 2: Direct HTTP call
  const response = await fetch(
    'https://knowledge-graph-worker.torarnehave.workers.dev/saveGraphWithHistory',
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
  return response.json()
}
```

### 3.2 Wrangler Configuration for Service Binding

Add to `wrangler.toml`:

```toml
name = "your-app-name"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

# Service binding to Knowledge Graph Worker
[[services]]
binding = "KNOWLEDGE_GRAPH_WORKER"
service = "knowledge-graph-worker"

[vars]
ENVIRONMENT = "production"
```

### 3.3 Frontend Integration

```vue
<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const content = ref('')
const title = ref('')
const saving = ref(false)
const result = ref(null)

async function saveToGraph() {
  saving.value = true

  try {
    const response = await fetch('/api/save-to-graph', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      },
      body: JSON.stringify({
        title: title.value,
        content: content.value
      })
    })

    result.value = await response.json()
  } catch (error) {
    result.value = { error: error.message }
  } finally {
    saving.value = false
  }
}
</script>
```

---

## 4. API Worker Template

Create `/functions/api/your-api.js`:

```javascript
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

  try {
    // Verify authentication
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') ||
                  getCookie(request, 'vegvisr_token')

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: corsHeaders
      })
    }

    // Validate token with auth service
    const authResponse = await fetch(
      `https://dashboard.vegvisr.org/validate-token?token=${token}`
    )
    const authData = await authResponse.json()

    if (!authData.valid) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: corsHeaders
      })
    }

    // Your API logic here
    const body = await request.json()

    // Example: Save to Knowledge Graph
    const graphResult = await saveToKnowledgeGraph(
      env,
      body.content,
      body.title,
      'https://your-app.vegvisr.org'
    )

    return new Response(JSON.stringify({
      success: true,
      graphId: graphResult.id
    }), { headers: corsHeaders })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
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

## 5. Package.json Template

```json
{
  "name": "your-app-name",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist"
  },
  "dependencies": {
    "pinia": "^2.1.0",
    "vue": "^3.4.0",
    "vue-router": "^4.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
```

---

## 6. Vite Configuration

Create `vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true
      }
    }
  }
})
```

---

## 7. Main.js Entry Point

Create `/src/main.js`:

```javascript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
```

---

## 8. App.vue Root Component

Create `/src/App.vue`:

```vue
<script setup>
import { useUserStore } from '@/stores/userStore'
import { useRouter } from 'vue-router'

const userStore = useUserStore()
const router = useRouter()

function logout() {
  userStore.logout()
  router.push('/login')
}
</script>

<template>
  <div id="app">
    <header v-if="userStore.loggedIn">
      <span>{{ userStore.email }}</span>
      <button @click="logout">Logout</button>
    </header>
    <router-view />
  </div>
</template>

<style>
#app {
  font-family: system-ui, -apple-system, sans-serif;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}
</style>
```

---

## 9. Vegvisr API Endpoints Reference

### Authentication

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://test.vegvisr.org/check-email?email={email}` | GET | Check if email exists |
| `https://email-worker.torarnehave.workers.dev/login/magic/send` | POST | Send magic link |
| `https://email-worker.torarnehave.workers.dev/login/magic/verify?token={token}` | GET | Verify magic token |
| `https://dashboard.vegvisr.org/get-role?email={email}` | GET | Get user role |
| `https://dashboard.vegvisr.org/userdata?email={email}` | GET | Get user data |
| `https://dashboard.vegvisr.org/validate-token?token={token}` | GET | Validate auth token |

### Knowledge Graph

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `https://knowledge-graph-worker.torarnehave.workers.dev/saveGraphWithHistory` | POST | Save new graph |
| `https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraph?id={id}` | GET | Get graph by ID |
| `https://knowledge-graph-worker.torarnehave.workers.dev/getknowgraphs` | GET | List all graphs |

---

## 10. Hello World Example

Here's a complete "Hello World" app that:
1. Authenticates with magic link
2. Saves a document to the Knowledge Graph

### Main View (`/src/views/MainView.vue`):

```vue
<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()
const message = ref('Hello World!')
const saving = ref(false)
const result = ref(null)

async function saveHelloWorld() {
  saving.value = true
  result.value = null

  try {
    const response = await fetch('/api/save-hello', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userStore.emailVerificationToken}`
      },
      body: JSON.stringify({
        title: 'Hello World Document',
        content: `# Hello World!\n\nThis document was created by ${userStore.email} on ${new Date().toISOString()}\n\nMessage: ${message.value}`
      })
    })

    result.value = await response.json()
  } catch (error) {
    result.value = { error: error.message }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="main-view">
    <h1>Hello World App</h1>
    <p>Welcome, {{ userStore.email }}!</p>

    <div class="form">
      <label>Your Message:</label>
      <input v-model="message" type="text" />

      <button @click="saveHelloWorld" :disabled="saving">
        {{ saving ? 'Saving...' : 'Save to Knowledge Graph' }}
      </button>
    </div>

    <div v-if="result" class="result">
      <h3>Result:</h3>
      <pre>{{ JSON.stringify(result, null, 2) }}</pre>
    </div>
  </div>
</template>

<style scoped>
.main-view {
  max-width: 600px;
  margin: 0 auto;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 20px 0;
}

input {
  padding: 10px;
  font-size: 16px;
}

button {
  padding: 12px 24px;
  background: #4f6d7a;
  color: white;
  border: none;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
}

.result {
  background: #f5f5f5;
  padding: 15px;
  border-radius: 4px;
}

pre {
  overflow-x: auto;
}
</style>
```

---

## Summary Checklist

When creating a new Vegvisr-integrated app, ensure you have:

- [ ] User store with `setUser`, `logout`, `loadFromStorage`, `fetchUserContext`
- [ ] Auth cookie management (`vegvisr_token`)
- [ ] Login view with magic link support
- [ ] Router with auth guards
- [ ] API worker with token validation
- [ ] Knowledge Graph integration (if saving documents)
- [ ] Proper CORS headers
- [ ] Wrangler.toml with service bindings

---

## Development Commands

```bash
# Install dependencies
npm install

# Run frontend dev server (port 3000)
npm run dev

# Run Cloudflare Worker locally (port 8788)
npx wrangler pages dev . --port 8788

# Build for production
npm run build

# Deploy to Cloudflare Pages
npm run deploy
```
