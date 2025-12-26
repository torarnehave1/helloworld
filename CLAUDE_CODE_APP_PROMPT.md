# Vegvisr App Creation Prompt for Claude Code

Use this prompt when asking Claude Code to create a new app that integrates with the Vegvisr ecosystem.

---

## The Prompt

Copy and paste this prompt, replacing `[YOUR APP DESCRIPTION]` with your specific requirements:

```
Create a new Vue 3 app called "[APP NAME]" that integrates with the Vegvisr ecosystem.

## App Requirements
[YOUR APP DESCRIPTION]

## Required Integration Points

### 1. Authentication (REQUIRED)
The app MUST use the existing Vegvisr authentication system:

- **Magic Link Login**:
  - Check email: `GET https://test.vegvisr.org/check-email?email={email}`
  - Send magic link: `POST https://email-worker.torarnehave.workers.dev/login/magic/send`
    - Body: `{ "email": "...", "redirectUrl": "https://your-app/login" }`
  - Verify token: `GET https://email-worker.torarnehave.workers.dev/login/magic/verify?token={token}`

- **User Context** (after login):
  - Get role: `GET https://dashboard.vegvisr.org/get-role?email={email}`
  - Get user data: `GET https://dashboard.vegvisr.org/userdata?email={email}`

- **Session Management**:
  - Store auth token in cookie: `vegvisr_token` (30-day expiry, domain=.vegvisr.org)
  - Store user in localStorage
  - Use sessionStorage flag: `email_session_verified` = '1'

- **Token Validation** (in API workers):
  - Validate: `GET https://dashboard.vegvisr.org/validate-token?token={token}`

### 2. Knowledge Graph Integration (for saving documents)
To save content to the Knowledge Graph:

- **Endpoint**: `POST https://knowledge-graph-worker.torarnehave.workers.dev/saveGraphWithHistory`
- **Payload**:
```json
{
  "id": "graph_{timestamp}",
  "graphData": {
    "metadata": {
      "title": "Document Title",
      "description": "Description",
      "createdBy": "app-name",
      "version": 0
    },
    "nodes": [{
      "id": "uuid",
      "color": "#4f6d7a",
      "label": "Node Label",
      "type": "fulltext",
      "info": "Content in Markdown",
      "bibl": ["source-url"],
      "visible": true,
      "position": { "x": 0, "y": 0 }
    }],
    "edges": []
  },
  "override": false
}
```

### 3. Tech Stack Requirements
- Vue 3 with Composition API (`<script setup>`)
- Pinia for state management
- Vue Router 4 with auth guards
- Vite for build
- Cloudflare Workers for API (functions/api/)
- wrangler.toml for Cloudflare config

### 4. Required Files Structure
```
src/
  main.js           # App initialization with Pinia + Router
  App.vue           # Root with logout button when logged in
  router/index.js   # Routes with beforeEach auth guard
  stores/userStore.js # Auth state management
  views/
    LoginView.vue   # Magic link login flow
    [YourViews].vue # App-specific views
functions/
  api/
    [your-api].js   # Cloudflare Worker endpoints
package.json
vite.config.js
wrangler.toml
```

### 5. User Store Must Include
- State: email, role, user_id, emailVerificationToken, loggedIn
- Actions: setUser, logout, loadFromStorage, fetchUserContext, setAuthCookie, clearAuthCookie

### 6. Router Guard Pattern
```javascript
router.beforeEach((to, from, next) => {
  // Load from storage, check loggedIn + sessionStorage flag
  // Redirect to /login if auth required but not authenticated
})
```

Please create all necessary files for a working app.
```

---

## Example: Hello World App Prompt

```
Create a new Vue 3 app called "Hello World" that integrates with the Vegvisr ecosystem.

## App Requirements
A simple app that:
1. Allows users to log in using magic link
2. Shows a welcome message with the user's email
3. Has a text input for a custom message
4. Has a "Save to Knowledge Graph" button that saves a Hello World document

## Required Integration Points
[... same as above ...]
```

---

## Example: Note Taking App Prompt

```
Create a new Vue 3 app called "Quick Notes" that integrates with the Vegvisr ecosystem.

## App Requirements
A note-taking app that:
1. Allows users to log in using magic link
2. Has a title input and a markdown textarea
3. Shows a preview of the markdown
4. Saves notes to the Knowledge Graph as fulltext nodes
5. Lists previously saved notes (optional)

## Required Integration Points
[... same as above ...]
```

---

## Quick Reference Card

| What | Endpoint |
|------|----------|
| Check email exists | `GET https://test.vegvisr.org/check-email?email={email}` |
| Send magic link | `POST https://email-worker.torarnehave.workers.dev/login/magic/send` |
| Verify magic token | `GET https://email-worker.torarnehave.workers.dev/login/magic/verify?token={token}` |
| Get user role | `GET https://dashboard.vegvisr.org/get-role?email={email}` |
| Get user data | `GET https://dashboard.vegvisr.org/userdata?email={email}` |
| Validate token | `GET https://dashboard.vegvisr.org/validate-token?token={token}` |
| Save to graph | `POST https://knowledge-graph-worker.torarnehave.workers.dev/saveGraphWithHistory` |

| Cookie/Storage | Purpose |
|----------------|---------|
| `vegvisr_token` cookie | Auth token (30 days) |
| `app_user` localStorage | User data persistence |
| `email_session_verified` sessionStorage | Session flag |

---

## Deploying to helloworld.vegvisr.org (Cloudflare Pages)

### What You Need to Do in Cloudflare

1. **Deploy the app to Cloudflare Pages**
   ```bash
   npm run build
   wrangler pages deploy dist --project-name=helloworld-app
   ```

2. **Add Custom Domain in Cloudflare Dashboard**
   - Go to: Cloudflare Dashboard → Pages → your-project → Custom domains
   - Add: `helloworld.vegvisr.org`
   - Cloudflare will auto-configure DNS (since vegvisr.org is already on Cloudflare)

### What You Need in vegvisr-frontend (Backend)

**Good news**: The Vegvisr backend workers already allow CORS from any origin (`Access-Control-Allow-Origin: '*'`), so:

- ✅ **email-worker** - Already allows all origins (magic link auth works)
- ✅ **dash-worker** - Already allows all origins (user data/roles work)
- ✅ **knowledge-graph-worker** - Already allows all origins (saving graphs works)
- ✅ **test.vegvisr.org** - Already allows all origins (email check works)

**No changes needed in vegvisr-frontend for basic integration!**

### Optional: Add to Brand Worker (for white-label routing)

If you want `helloworld.vegvisr.org` to proxy through the brand-worker (like other custom domains), add to `brand-worker/wrangler.toml`:

```toml
routes = [
  { pattern = "helloworld.vegvisr.org", custom_domain = true },
  # ... existing routes
]
```

This is **optional** - direct Cloudflare Pages deployment works without it.

### Auth Cookie Domain

The auth cookie is set with `domain=.vegvisr.org`, which means:
- ✅ Works on `helloworld.vegvisr.org` (subdomain of vegvisr.org)
- ✅ Shared auth across all `*.vegvisr.org` apps
- ✅ User logs in once, stays logged in across apps
