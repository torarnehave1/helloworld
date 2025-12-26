import { defineStore } from 'pinia'

const AUTH_API = 'https://helloworld-auth-worker.torarnehave.workers.dev'

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

      localStorage.setItem('helloworld_user', JSON.stringify({
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
      localStorage.removeItem('helloworld_user')
      sessionStorage.removeItem('helloworld_session_verified')
      this.clearAuthCookie()
    },

    loadFromStorage() {
      const stored = localStorage.getItem('helloworld_user')
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
