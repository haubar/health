<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getJson } from '../services/api'
type Day = { date: string; synced: boolean; lastUpdatedAt: string | null; steps: number | null; activeMinutes: number | null; exerciseMinutes: number | null; activeCalories: number | null; totalCalories: number | null; weightKg: number | null }
type Report = { days: Day[]; stepGoal: number; weightGoalKg: number | null }
const report = ref<Report | null>(null)
const selectedDate = ref('')
const error = ref('')
async function load() {
  try {
    report.value = await getJson<Report>('/.netlify/functions/daily-progress-export')
    selectedDate.value = report.value.days.at(-1)?.date ?? ''
  } catch { error.value = '報表載入失敗' }
}
onMounted(load)
</script>
<template>
  <section class="page-stack">
    <h1>每日健康報表</h1>
    <button @click="load">重新整理</button>
    <p class="data-rule">僅登入後可查看最近七天的健康紀錄。缺少的資料不會補成零。</p>
    <p v-if="error">{{ error }}</p>
    <template v-if="report">
      <select v-model="selectedDate">
        <option v-for="day in report.days" :key="day.date" :value="day.date">{{ day.date }}</option>
      </select>
      <div v-for="day in report.days.filter(d => d.date === selectedDate)" :key="day.date" class="metric-grid">
        <div class="metric-card"><p>步數</p><strong>{{ day.steps ?? '—' }}</strong><small>目標 {{ report.stepGoal }} 步 · {{ day.steps === null ? '尚無資料' : Math.round(day.steps / report.stepGoal * 100) + '%' }} · {{ day.steps === null ? '無法計算剩餘步數' : '剩餘 ' + Math.max(0, report.stepGoal - day.steps) + ' 步' }}</small></div>
        <div class="metric-card"><p>活動分鐘</p><strong>{{ day.activeMinutes ?? '—' }}</strong></div>
        <div class="metric-card"><p>運動分鐘</p><strong>{{ day.exerciseMinutes ?? '—' }}</strong></div>
        <div class="metric-card"><p>活動熱量</p><strong>{{ day.activeCalories ?? '—' }}</strong></div>
        <div class="metric-card"><p>總熱量</p><strong>{{ day.totalCalories ?? '—' }}</strong></div>
        <div class="metric-card"><p>體重</p><strong>{{ day.weightKg ?? '—' }}</strong><small>目標 {{ report.weightGoalKg ?? '未設定' }} kg</small></div>
        <p class="data-rule">{{ day.synced ? '已同步' : '尚未同步' }} · 最後紀錄：{{ day.lastUpdatedAt ?? '無資料' }}</p>
      </div>
    </template>
  </section>
</template>
