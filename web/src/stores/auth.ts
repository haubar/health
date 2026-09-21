import type { SessionStatus, SessionUser } from '@health/shared'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getJson } from '../services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)
  const initialized = ref(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  let initialization: Promise<void> | null = null

  const authenticated = computed(() => user.value !== null)

  async function initialize(): Promise<void> {
    if (initialized.value) return
    if (initialization) return initialization

    initialization = (async () => {
      loading.value = true
      error.value = null
      try {
        const status = await getJson<SessionStatus>('/.netlify/functions/auth-session')
        user.value = status.user
      } catch {
        user.value = null
        error.value = '目前無法確認登入狀態。'
      } finally {
        initialized.value = true
        loading.value = false
        initialization = null
      }
    })()

    return initialization
  }

  return { user, initialized, loading, error, authenticated, initialize }
})

