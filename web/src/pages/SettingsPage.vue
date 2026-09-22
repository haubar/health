<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { healthDataClient } from '../services/health-data'

const auth = useAuthStore()
const syncing = ref(false)
const syncMessage = ref('')

async function startSync(): Promise<void> {
  syncing.value = true
  syncMessage.value = ''
  try {
    const result = await healthDataClient.sync(({ batch, batchCount, recordCount }) => {
      syncMessage.value = `正在讀取第 ${batch}/${batchCount} 天，已取得 ${recordCount} 筆資料…`
    })
    syncMessage.value = result.recordCount > 0
      ? `已同步 ${result.windowStart.slice(0, 10)} 至 ${result.windowEnd.slice(0, 10)} 的 ${result.recordCount} 筆資料。再次同步會繼續往前補資料。`
        : '同步完成，但 Google Health 目前沒有可用資料。'
  } catch (error) {
    syncMessage.value = error instanceof Error ? error.message : '同步失敗，請稍後再試。'
  } finally {
    syncing.value = false
  }
}

</script>

<template>
  <section class="page-stack narrow-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">SETTINGS</p>
        <h1>設定</h1>
      </div>
    </header>

    <article class="settings-card">
      <div>
        <p class="field-label">登入帳號</p>
        <p>{{ auth.user?.email }}</p>
      </div>
      <span class="connection-state">已驗證</span>
    </article>

    <article class="settings-card sync-card">
      <div>
        <p class="field-label">Google Health</p>
        <p>每次同步 30 天；完成後再次同步會繼續讀取更早的資料。</p>
      </div>
      <button class="primary-action sync-button" type="button" :disabled="syncing" @click="startSync">
        {{ syncing ? '同步中…' : '同步資料' }}
      </button>
    </article>
    <p v-if="syncMessage" class="status-message">{{ syncMessage }}</p>

    <a class="secondary-action" href="/.netlify/functions/auth-logout">登出</a>
  </section>
</template>
