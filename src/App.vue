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
      <div class="header-content">
        <router-link to="/" class="logo">Hello Vegvisr</router-link>
        <nav class="nav-links">
          <router-link to="/" class="nav-link">Create</router-link>
          <router-link to="/about" class="nav-link">About</router-link>
        </nav>
        <div class="user-section">
          <span class="user-email">{{ userStore.email }}</span>
          <button @click="logout" class="logout-btn">Logout</button>
        </div>
      </div>
    </header>
    <main>
      <router-view />
    </main>
  </div>
</template>

<style>
#app {
  min-height: 100vh;
}

header {
  background: #4f6d7a;
  color: white;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 60px;
}

.logo {
  font-size: 1.25rem;
  font-weight: 600;
  color: white;
  text-decoration: none;
}

.logo:hover {
  opacity: 0.9;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  border-radius: 6px;
  font-size: 0.9rem;
  transition: background 0.2s, color 0.2s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.nav-link.router-link-exact-active {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.user-section {
  display: flex;
  align-items: center;
  gap: 15px;
}

.user-email {
  font-size: 0.9rem;
  opacity: 0.9;
}

.logout-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.logout-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
</style>
