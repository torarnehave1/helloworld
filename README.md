# Hello World - Vegvisr

A Vue 3 application integrated with the Vegvisr ecosystem, demonstrating magic link authentication and Knowledge Graph integration.

## Features

- Magic link authentication via Vegvisr auth system
- User session management with cross-app cookie support
- Save documents to the Vegvisr Knowledge Graph
- Cloudflare Pages deployment with Workers API

## Tech Stack

- Vue 3 with Composition API (`<script setup>`)
- Pinia for state management
- Vue Router 4 with auth guards
- Vite for build tooling
- Cloudflare Workers for API endpoints

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
npm install
```

### Development

Run the frontend dev server:

```bash
npm run dev
```

Run the Cloudflare Worker locally (for API endpoints):

```bash
npx wrangler pages dev . --port 8788
```

The app will be available at `http://localhost:3000`.

### Build

```bash
npm run build
```

### Deploy

Deploy to Cloudflare Pages:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── main.js               # App initialization with Pinia + Router
│   ├── App.vue               # Root component with logout button
│   ├── router/index.js       # Routes with beforeEach auth guard
│   ├── stores/userStore.js   # Auth state management
│   └── views/
│       ├── LoginView.vue     # Magic link login flow
│       └── MainView.vue      # Main app with KG save
├── functions/api/
│   └── save-hello.js         # Cloudflare Worker for KG integration
├── package.json
├── vite.config.js
└── wrangler.toml
```

## Authentication Flow

1. User enters email on login page
2. App checks if email exists via `test.vegvisr.org/check-email`
3. Magic link sent via `email-worker.torarnehave.workers.dev`
4. User clicks link, token verified, session created
5. Auth cookie (`vegvisr_token`) set for cross-app SSO

## API Endpoints

### POST /api/save-hello

Saves a document to the Vegvisr Knowledge Graph.

**Headers:**
- `Authorization: Bearer <token>`

**Body:**
```json
{
  "title": "Document Title",
  "message": "Your message content",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "graphId": "graph_1234567890",
  "nodeId": "uuid-here"
}
```

## Environment

The app uses these Vegvisr services:

| Service | URL |
|---------|-----|
| Email Check | `https://test.vegvisr.org/check-email` |
| Magic Link | `https://email-worker.torarnehave.workers.dev` |
| User Data | `https://dashboard.vegvisr.org` |
| Knowledge Graph | `https://knowledge-graph-worker.torarnehave.workers.dev` |

## License

MIT
