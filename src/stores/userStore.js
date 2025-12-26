import { defineStore } from 'pinia'

const AUTH_API = 'https://helloworld-auth-worker.torarnehave.workers.dev'

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
        // Get user role via auth-worker
        const roleResponse = await fetch(
          `${AUTH_API}/get-role?email=${encodeURIComponent(email)}`
        )
        const roleData = await roleResponse.json()

        // Get user data via auth-worker
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
