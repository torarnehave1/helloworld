# Vegvisr App Creation Prompt for Claude Code

Use this prompt when asking Claude Code to create a new app that integrates with the Vegvisr ecosystem.

**IMPORTANT**: Before creating, read `CLAUDE_CODE_INTEGRATION_GUIDE.md` in this repo for the exact patterns to follow.

---

## The Prompt

Copy and paste this prompt, replacing `[YOUR APP DESCRIPTION]` with your specific requirements:

```
Create a new Vue 3 app called "[APP NAME]" that integrates with the Vegvisr ecosystem.

IMPORTANT: Read CLAUDE_CODE_INTEGRATION_GUIDE.md for the exact patterns to use.

## App Requirements
[YOUR APP DESCRIPTION]

## CRITICAL Architecture (from working WCX app)

### 1. Frontend calls TWO services:
- **Auth Worker** (`myapp-auth-worker.torarnehave.workers.dev`) for:
  - `/check-email` - proxies to test.vegvisr.org
  - `/get-role` - proxies to dashboard.vegvisr.org
  - `/userdata` - proxies to dashboard.vegvisr.org

- **Email Worker** (`email-worker.torarnehave.workers.dev`) DIRECTLY for:
  - `/login/magic/send` - send magic link
  - `/login/magic/verify` - verify magic token

### 2. Pages Functions call dashboard DIRECTLY:
- Token validation: `fetch('https://dashboard.vegvisr.org/auth/validate-token')`
- Do NOT use auth-worker service binding for token validation

### 3. wrangler.toml has ONLY Knowledge Graph binding:
```toml
[[services]]
binding = "KNOWLEDGE_GRAPH_WORKER"
service = "knowledge-graph-worker"
```
NO auth-worker binding in main wrangler.toml!

### 4. Storage keys:
- localStorage: `{appname}_user`
- sessionStorage: `{appname}_session_verified`
- Cookie: `vegvisr_token` (30 days, domain `.vegvisr.org`)

### 5. userStore MUST:
- Use `encodeURIComponent(token)` when setting cookie
- Check `typeof document === 'undefined'` before DOM access
- Check `window.location.hostname.endsWith('vegvisr.org')` for domain

### 6. CRITICAL - Token Handling in LoginView:
After magic link verification, use `userContext` directly from `fetchUserContext()`:
```javascript
// CORRECT - userContext contains emailVerificationToken from /userdata
const userContext = await userStore.fetchUserContext(data.email)
userStore.setUser(userContext)

// WRONG - DO NOT override with magic link token
userStore.setUser({ ...userContext, emailVerificationToken: data.token })
```
The `emailVerificationToken` comes from `/userdata` endpoint, NOT from magic link response!

### 7. Frontend fetch to /api/* must NOT send Authorization header:
```javascript
// CORRECT - relies on cookie
fetch('/api/save-data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
})

// WRONG - don't add Authorization header
headers: { 'Authorization': `Bearer ${token}` }
```

### 8. Pages Functions only allow Admin/Superadmin roles:
```javascript
if (data?.valid && (role === 'Superadmin' || role === 'Admin')) {
  return { ok: true, status: 200 }
}
```

### 9. Tech Stack:
- Vue 3 with Composition API (`<script setup>`)
- Pinia for state management
- Vue Router 4 with auth guards
- Vite for build
- Cloudflare Pages Functions for API

### 10. Required Files:
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
├── package.json
└── README.md
```

### 11. Deployment:
1. Deploy auth-worker FIRST: `cd myapp-auth-worker && npx wrangler deploy`
2. Push to GitHub (Pages auto-deploys)

Please create all necessary files following the exact patterns from CLAUDE_CODE_INTEGRATION_GUIDE.md.
```

---

## Quick Reference

| Service | URL | Used By |
|---------|-----|---------|
| Check email | `myapp-auth-worker/check-email` | Frontend |
| Get role | `myapp-auth-worker/get-role` | Frontend |
| Get user data | `myapp-auth-worker/userdata` | Frontend |
| Send magic link | `email-worker.torarnehave.workers.dev/login/magic/send` | Frontend DIRECTLY |
| Verify magic token | `email-worker.torarnehave.workers.dev/login/magic/verify` | Frontend DIRECTLY |
| Validate token | `dashboard.vegvisr.org/auth/validate-token` | Pages Functions DIRECTLY |
| Save to graph | Service binding `KNOWLEDGE_GRAPH_WORKER` | Pages Functions |
| Upload image | `api.vegvisr.org/upload` | Frontend DIRECTLY |

| Storage | Key | Purpose |
|---------|-----|---------|
| Cookie | `vegvisr_token` | Auth token (30 days) |
| localStorage | `{appname}_user` | User data |
| sessionStorage | `{appname}_session_verified` | Session flag |

---

## Example: Hello World App

```
Create a new Vue 3 app called "Hello World" that integrates with the Vegvisr ecosystem.

IMPORTANT: Read CLAUDE_CODE_INTEGRATION_GUIDE.md for the exact patterns to use.

## App Requirements
A simple app that:
1. Allows users to log in using magic link
2. Shows a welcome message with the user's email
3. Has a text input for a custom message
4. Has a "Save to Knowledge Graph" button that saves a Hello World document

## CRITICAL Architecture (from working WCX app)
[... same as above ...]
```

---

## Example: Note Taking App

```
Create a new Vue 3 app called "Quick Notes" that integrates with the Vegvisr ecosystem.

IMPORTANT: Read CLAUDE_CODE_INTEGRATION_GUIDE.md for the exact patterns to use.

## App Requirements
A note-taking app that:
1. Allows users to log in using magic link
2. Has a title input and a markdown textarea
3. Shows a preview of the markdown
4. Saves notes to the Knowledge Graph as fulltext nodes

## CRITICAL Architecture (from working WCX app)
[... same as above ...]
```

---

## Deployment to Cloudflare Pages

### Deploy Auth Worker First
```bash
cd myapp-auth-worker
npx wrangler deploy
```

### Push to GitHub
Cloudflare Pages auto-deploys from GitHub.

### Add Custom Domain (Cloudflare Dashboard)
1. Go to: Pages → your-project → Custom domains
2. Add: `myapp.vegvisr.org`
3. Cloudflare auto-configures DNS

### Auth Cookie
- Cookie `vegvisr_token` is set with `domain=.vegvisr.org`
- Works on all `*.vegvisr.org` subdomains
- Shared auth across all Vegvisr apps
