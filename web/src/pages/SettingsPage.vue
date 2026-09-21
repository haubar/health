<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { ApiError } from '../services/api'
import { healthDataClient } from '../services/health-data'

const auth = useAuthStore()
const hasData = ref<boolean | null>(null)
const syncing = ref(false)
const syncMessage = ref('')
const checkingFit = ref(false)
const fitMessage = ref('')

onMounted(async () => {
  try {
    const data = await healthDataClient.getDashboard('1Y')
    hasData.value = data.availability !== 'empty'
  } catch {
    hasData.value = null
  }
})

async function startSync(): Promise<void> {
  syncing.value = true
  syncMessage.value = ''
  try {
    const result = await healthDataClient.sync()
    hasData.value = result.recordCount > 0
    syncMessage.value = result.recordCount > 0
      ? `已同步 ${result.recordCount} 筆資料。請返回健康總覽查看。`
      : '同步完成，但 Google Health 目前沒有可用資料。'
  } catch (error) {
    syncMessage.value = error instanceof ApiError ? error.message : '同步失敗，請稍後再試。'
  } finally {
    syncing.value = false
  }
}

async function inspectGoogleFit(): Promise<void> {
  checkingFit.value = true
  fitMessage.value = ''
  try {
    const result = await healthDataClient.inspectGoogleFit()
    const labels: Record<string, string> = { activity: '步數', distance: '距離', weight: '體重', bodyFat: '體脂' }
    fitMessage.value = Object.entries(result.data).map(([key, value]) => `${labels[key] ?? key} ${value.points} 筆`).join('；')
  } catch (error) {
    fitMessage.value = error instanceof ApiError ? error.message : 'Google Fit 檢查失敗，請稍後再試。'
  } finally {
    checkingFit.value = false
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

    <article v-if="hasData !== null" class="settings-card sync-card">
      <div>
        <p class="field-label">Google Health</p>
        <p>{{ hasData ? '重新讀取最近 30 天的健康資料。' : '目前尚未同步健康資料。' }}</p>
      </div>
      <button class="primary-action sync-button" type="button" :disabled="syncing" @click="startSync">
        {{ syncing ? '同步中…' : hasData ? '重新同步' : '開始同步' }}
      </button>
    </article>
    <p v-if="syncMessage" class="status-message">{{ syncMessage }}</p>

    <article class="settings-card sync-card">
      <div>
        <p class="field-label">Google Fit（唯讀檢查）</p>
        <p>只查詢最近 30 天資料，不會寫入或合併到健康總覽。</p>
      </div>
      <button class="secondary-action" type="button" :disabled="checkingFit" @click="inspectGoogleFit">
        {{ checkingFit ? '檢查中…' : '檢查 Google Fit' }}
      </button>
    </article>
    <p v-if="fitMessage" class="status-message">{{ fitMessage }}</p>

    <a class="secondary-action" href="/.netlify/functions/auth-logout">登出</a>
  </section>
</template>
