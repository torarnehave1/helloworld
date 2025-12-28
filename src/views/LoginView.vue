<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import LogoBlack from '@/assets/img/Black.svg'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()

// API Endpoints
const AUTH_API = 'https://helloworld-auth-worker.torarnehave.workers.dev'
const EMAIL_WORKER = 'https://email-worker.torarnehave.workers.dev'

// State
const email = ref('')
const step = ref('email') // 'email' | 'magic'
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
  const emailVerified = sessionStorage.getItem('helloworld_session_verified') === '1'
  if (userStore.loggedIn && emailVerified) {
    router.push('/')
  }
})

// Check if email exists
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

// Send magic link (call email-worker directly like WCX does)
async function sendMagicLink() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${EMAIL_WORKER}/login/magic/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.value,
        redirectUrl: 'https://hello.vegvisr.org/login'
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

// Verify magic token
async function verifyMagicToken(token) {
  loading.value = true
  error.value = ''
  step.value = 'verifying'

  try {
    const response = await fetch(
      `${EMAIL_WORKER}/login/magic/verify?token=${encodeURIComponent(token)}`
    )
    const data = await response.json()

    if (data.success && data.email) {
      // Fetch full user context (includes emailVerificationToken from /userdata)
      const userContext = await userStore.fetchUserContext(data.email)

      userStore.setUser(userContext)
      sessionStorage.setItem('helloworld_session_verified', '1')
      success.value = 'Login successful! Redirecting...'

      setTimeout(() => {
        router.push('/')
      }, 500)
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
    // Clean URL
    router.replace({ query: {} })
  }
}

// Handle form submit
function handleSubmit() {
  if (step.value === 'email') {
    checkEmail()
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <h1>
          <img :src="LogoBlack" alt="Vegvisr" class="login-logo" />
          Hello Vegvisr
        </h1>
        <p class="subtitle">Sign in to continue</p>
      </div>

      <!-- Verifying Step -->
      <div v-if="step === 'verifying'" class="step-content">
        <div class="loading-spinner"></div>
        <p>Verifying your login...</p>
      </div>

      <!-- Email Step -->
      <div v-else-if="step === 'email'" class="step-content">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="email">Email Address</label>
            <input
              id="email"
              v-model="email"
              type="email"
              placeholder="you@example.com"
              :disabled="loading"
              autocomplete="email"
            />
          </div>
          <button type="submit" :disabled="loading" class="submit-btn">
            {{ loading ? 'Checking...' : 'Continue with Magic Link' }}
          </button>
        </form>
      </div>

      <!-- Magic Link Sent Step -->
      <div v-else-if="step === 'magic'" class="step-content">
        <div class="magic-sent">
          <div class="magic-icon">&#9993;</div>
          <h2>Check your email</h2>
          <p>We sent a magic link to:</p>
          <p class="email-display">{{ email }}</p>
          <p class="hint">Click the link in the email to sign in.</p>
          <button @click="sendMagicLink" :disabled="loading" class="resend-btn">
            {{ loading ? 'Sending...' : 'Resend Magic Link' }}
          </button>
          <button @click="step = 'email'" class="back-btn">
            Use a different email
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div v-if="error" class="message error">{{ error }}</div>
      <div v-if="success" class="message success">{{ success }}</div>
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
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 40px;
  width: 100%;
  max-width: 400px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #4f6d7a;
  font-size: 1.75rem;
  margin-bottom: 8px;
}

.login-logo {
  height: 40px;
  width: auto;
}

.subtitle {
  color: #666;
  font-size: 0.95rem;
}

.step-content {
  text-align: center;
}

.form-group {
  margin-bottom: 20px;
  text-align: left;
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

.submit-btn {
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

.submit-btn:hover:not(:disabled) {
  background: #3d5561;
}

.submit-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.magic-sent {
  padding: 20px 0;
}

.magic-icon {
  font-size: 3rem;
  margin-bottom: 15px;
}

.magic-sent h2 {
  color: #333;
  margin-bottom: 10px;
  font-size: 1.25rem;
}

.magic-sent p {
  color: #666;
  margin: 5px 0;
}

.email-display {
  color: #4f6d7a;
  font-weight: 600;
  margin: 10px 0;
}

.hint {
  font-size: 0.9rem;
  margin-top: 15px;
  margin-bottom: 25px;
}

.resend-btn {
  width: 100%;
  padding: 12px 20px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 10px;
}

.resend-btn:hover:not(:disabled) {
  background: #e0e0e0;
}

.resend-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.back-btn {
  width: 100%;
  padding: 10px;
  background: transparent;
  color: #666;
  border: none;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: underline;
}

.back-btn:hover {
  color: #333;
}

.message {
  margin-top: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
}

.message.error {
  background: #fee;
  color: #c33;
  border: 1px solid #fcc;
}

.message.success {
  background: #efe;
  color: #363;
  border: 1px solid #cfc;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #4f6d7a;
  border-radius: 50%;
  margin: 0 auto 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
