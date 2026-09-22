<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import { healthDataClient } from '../services/health-data'

const auth = useAuthStore()
const syncing = ref(false)
const syncMessage = ref('')
const dailyStepGoal = ref(8_000)
const weeklyExerciseMinutesGoal = ref(150)
const weightGoalKg = ref('')
const savingGoals = ref(false)
const goalsMessage = ref('')

onMounted(async () => {
  try {
    const settings = await healthDataClient.getSettings()
    dailyStepGoal.value = settings.dailyStepGoal
    weeklyExerciseMinutesGoal.value = settings.weeklyExerciseMinutesGoal
    weightGoalKg.value = settings.weightGoalKg === null ? '' : String(settings.weightGoalKg)
  } catch {
    goalsMessage.value = '目標設定暫時無法載入。'
  }
})

async function saveGoals(): Promise<void> {
  savingGoals.value = true
  goalsMessage.value = ''
  try {
    const targetWeightInput = String(weightGoalKg.value ?? '').trim()
    const settings = await healthDataClient.saveSettings({
      dailyStepGoal: dailyStepGoal.value,
      weeklyExerciseMinutesGoal: weeklyExerciseMinutesGoal.value,
      weightGoalKg: targetWeightInput ? Number(targetWeightInput) : null,
    })
    weightGoalKg.value = settings.weightGoalKg === null ? '' : String(settings.weightGoalKg)
    goalsMessage.value = '目標已儲存。'
  } catch (error) {
    goalsMessage.value = error instanceof Error ? error.message : '目標儲存失敗，請稍後再試。'
  } finally {
    savingGoals.value = false
  }
}

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

    <form class="goal-settings-card" @submit.prevent="saveGoals">
      <div class="goal-settings-heading">
        <div><p class="eyebrow">YOUR TARGETS</p><h2>減重與活動目標</h2></div>
        <p>目標只用來呈現進度，不推估減重期限或飲食熱量差。</p>
      </div>
      <label class="goal-field">
        <span>目標體重</span>
        <div class="goal-input-wrap"><input v-model="weightGoalKg" type="number" inputmode="decimal" min="25" max="400" step="0.1" placeholder="選填" /><span>kg</span></div>
        <small>留空即可移除體重目標。</small>
      </label>
      <div class="goal-fields-grid">
        <label class="goal-field"><span>每日步數目標</span><div class="goal-input-wrap"><input v-model.number="dailyStepGoal" type="number" min="500" max="60000" step="500" required /><span>步</span></div></label>
        <label class="goal-field"><span>每週運動時間目標</span><div class="goal-input-wrap"><input v-model.number="weeklyExerciseMinutesGoal" type="number" min="30" max="1000" step="10" required /><span>分鐘</span></div></label>
      </div>
      <div class="goal-form-footer"><p v-if="goalsMessage" role="status">{{ goalsMessage }}</p><button class="primary-action" type="submit" :disabled="savingGoals">{{ savingGoals ? '儲存中…' : '儲存目標' }}</button></div>
    </form>

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
