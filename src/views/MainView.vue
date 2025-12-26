<script setup>
import { ref } from 'vue'
import { useUserStore } from '@/stores/userStore'

const userStore = useUserStore()

// State
const message = ref('Hello World!')
const saving = ref(false)
const result = ref(null)
const error = ref('')

async function saveToKnowledgeGraph() {
  if (!message.value.trim()) {
    error.value = 'Please enter a message'
    return
  }

  saving.value = true
  result.value = null
  error.value = ''

  try {
    const response = await fetch('/api/save-hello', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Hello World Document',
        message: message.value,
        email: userStore.email
      })
    })

    const data = await response.json()

    if (response.ok) {
      result.value = data
    } else {
      error.value = data.error || 'Failed to save to Knowledge Graph'
    }
  } catch (e) {
    error.value = 'Network error. Please try again.'
    console.error('Save error:', e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="main-view">
    <div class="welcome-card">
      <h1>Welcome to Hello World!</h1>
      <p class="welcome-text">
        You're logged in as <strong>{{ userStore.email }}</strong>
        <span v-if="userStore.role" class="role-badge">{{ userStore.role }}</span>
      </p>
    </div>

    <div class="action-card">
      <h2>Create a Document</h2>
      <p class="description">
        Enter a custom message and save it to the Vegvisr Knowledge Graph.
      </p>

      <div class="form-group">
        <label for="message">Your Message</label>
        <input
          id="message"
          v-model="message"
          type="text"
          placeholder="Enter your message..."
          :disabled="saving"
        />
      </div>

      <button @click="saveToKnowledgeGraph" :disabled="saving" class="save-btn">
        {{ saving ? 'Saving...' : 'Save to Knowledge Graph' }}
      </button>

      <div v-if="error" class="message error">{{ error }}</div>

      <div v-if="result" class="result-card">
        <h3>Saved Successfully!</h3>
        <div class="result-details">
          <div class="result-row">
            <span class="label">Graph ID:</span>
            <code>{{ result.graphId }}</code>
          </div>
          <div class="result-row" v-if="result.nodeId">
            <span class="label">Node ID:</span>
            <code>{{ result.nodeId }}</code>
          </div>
        </div>
      </div>
    </div>

    <div class="info-card">
      <h3>About This App</h3>
      <p>
        This is a Hello World demonstration app integrated with the Vegvisr ecosystem.
        It showcases:
      </p>
      <ul>
        <li>Magic link authentication</li>
        <li>User session management</li>
        <li>Knowledge Graph integration</li>
        <li>Cloudflare Workers API</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.main-view {
  max-width: 600px;
  margin: 0 auto;
}

.welcome-card,
.action-card,
.info-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.welcome-card {
  text-align: center;
  background: linear-gradient(135deg, #4f6d7a 0%, #5a7d8a 100%);
  color: white;
}

.welcome-card h1 {
  font-size: 1.75rem;
  margin-bottom: 10px;
}

.welcome-text {
  font-size: 1rem;
  opacity: 0.95;
}

.welcome-text strong {
  font-weight: 600;
}

.role-badge {
  display: inline-block;
  background: rgba(255, 255, 255, 0.2);
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 0.8rem;
  margin-left: 10px;
}

.action-card h2 {
  color: #333;
  font-size: 1.25rem;
  margin-bottom: 10px;
}

.description {
  color: #666;
  margin-bottom: 20px;
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #333;
  font-weight: 500;
  font-size: 0.9rem;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4f6d7a;
}

.form-group input:disabled {
  background: #f5f5f5;
}

.save-btn {
  width: 100%;
  padding: 14px 24px;
  background: #4f6d7a;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s, transform 0.1s;
}

.save-btn:hover:not(:disabled) {
  background: #3d5561;
}

.save-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  margin-top: 15px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
}

.message.error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.result-card {
  margin-top: 20px;
  padding: 16px;
  background: #efe;
  border: 1px solid #cfc;
  border-radius: 8px;
}

.result-card h3 {
  color: #363;
  font-size: 1rem;
  margin-bottom: 12px;
}

.result-details {
  font-size: 0.9rem;
}

.result-row {
  margin: 8px 0;
}

.result-row .label {
  color: #666;
  margin-right: 8px;
}

.result-row code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.85rem;
}

.info-card {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
}

.info-card h3 {
  color: #333;
  font-size: 1rem;
  margin-bottom: 10px;
}

.info-card p {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 12px;
}

.info-card ul {
  color: #666;
  font-size: 0.9rem;
  padding-left: 20px;
}

.info-card li {
  margin: 6px 0;
}
</style>
