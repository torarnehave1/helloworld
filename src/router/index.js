import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const LoginView = () => import('@/views/LoginView.vue')
const MainView = () => import('@/views/MainView.vue')
const AboutView = () => import('@/views/AboutView.vue')

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
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
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
  const emailVerified = sessionStorage.getItem('helloworld_session_verified') === '1'
  const sessionVerified = emailVerified

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
