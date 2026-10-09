<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getJson } from '../services/api'
const report = ref<any>(null)
const selectedDate = ref('')
const error = ref('')
async function load() {
  try {
    report.value = await getJson('/.netlify/functions/daily-progress-export')
    selectedDate.value = report.value.days.at(-1)?.date ?? ''
  } catch { error.value = '報表載入失敗' }
}
onMounted(load)
</script>
<template>
  <section class="page-stack">
    <h1>每日健康報表</h1>
    <button @click="load">重新整理</button>
    <p v-if="error">{{ error }}</p>
    <template v-if="report">
      <select v-model="selectedDate">
        <option v-for="day in report.days" :key="day.date" :value="day.date">{{ day.date }}</option>
      </select>
      <div v-for="day in report.days.filter((d: any) => d.date === selectedDate)" :key="day.date" class="metric-grid">
        <div class="metric-card"><p>步數</p><strong>{{ day.steps ?? '—' }}</strong></div>
        <div class="metric-card"><p>活動分鐘</p><strong>{{ day.activeMinutes ?? '—' }}</strong></div>
        <div class="metric-card"><p>運動分鐘</p><strong>{{ day.exerciseMinutes ?? '—' }}</strong></div>
        <div class="metric-card"><p>活動熱量</p><strong>{{ day.activeCalories ?? '—' }}</strong></div>
        <div class="metric-card"><p>總熱量</p><strong>{{ day.totalCalories ?? '—' }}</strong></div>
        <div class="metric-card"><p>體重</p><strong>{{ day.weightKg ?? '—' }}</strong></div>
      </div>
    </template>
  </section>
</template>
