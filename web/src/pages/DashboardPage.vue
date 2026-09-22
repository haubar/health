<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { emptyDashboardData, healthDataClient } from '../services/health-data'
import type { DashboardData, HealthAnalysisData } from '@health/shared'
import HealthStateCard from '../components/HealthStateCard.vue'
import HealthLoading from '../components/HealthLoading.vue'
import MetricCard from '../components/MetricCard.vue'
import TrendChart from '../components/TrendChart.vue'

const auth = useAuthStore()
function currentMonthValue(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
const month = ref(currentMonthValue())
const currentMonth = currentMonthValue()
const monthLabel = computed(() => new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', timeZone: 'Asia/Taipei' }).format(new Date(`${month.value}-01T00:00:00+08:00`)))
const data = ref<DashboardData>(emptyDashboardData)
const analysis = ref<HealthAnalysisData>({ score: null, scoreDate: null, weeklySummary: null, insights: [], timeline: [] })
const loading = ref(true)
const loadError = ref('')
let requestId = 0
async function load() {
  const currentRequestId = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    data.value = await healthDataClient.getDashboard(month.value)
    analysis.value = await healthDataClient.getAnalysis().catch(() => analysis.value)
  } catch {
    if (currentRequestId === requestId) loadError.value = '健康資料暫時無法載入，請稍後再試。'
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}
onMounted(load)
watch(month, load)
function shiftMonth(offset: number): void {
  const [year, monthNumber] = month.value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, monthNumber! - 1 + offset, 1))
  month.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
const latest = computed(() => data.value.summaries[data.value.summaries.length - 1] ?? null)
const hasActivity = computed(() => data.value.summaries.some((day) => day.steps !== null || day.distanceKm !== null || day.activeMinutes !== null || day.exerciseMinutes !== null))
const hasBody = computed(() => data.value.summaries.some((day) => day.weightKg !== null || day.bodyFatPercentage !== null))
const stepPoints = computed(() => data.value.summaries.flatMap((day) => day.steps === null ? [] : [{ label: day.date, value: day.steps }]))
const weightPoints = computed(() => data.value.summaries.flatMap((day) => day.weightKg === null ? [] : [{ label: day.date, value: day.weightKg }]))
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="eyebrow">OVERVIEW</p>
        <h1>健康總覽</h1>
      </div>
      <span class="account-chip">{{ auth.user?.displayName ?? auth.user?.email }}</span>
    </header>

    <div class="dashboard-toolbar">
      <span class="section-label">每次載入一個月的趨勢資料</span>
      <div class="month-navigation" aria-label="切換月份">
        <button type="button" aria-label="查看前一個月" @click="shiftMonth(-1)">←</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" aria-label="查看下一個月" :disabled="month >= currentMonth" @click="shiftMonth(1)">→</button>
      </div>
    </div>
    <HealthLoading v-if="loading" />
    <HealthStateCard v-else-if="loadError" state="error" title="資料載入失敗" :description="loadError" />
    <template v-else>
      <div class="metric-grid">
        <MetricCard v-if="hasActivity" label="最新步數" :value="latest?.steps ?? null" unit="步" />
        <MetricCard v-if="hasActivity" label="最新距離" :value="latest?.distanceKm ?? null" unit="km" />
        <MetricCard v-if="hasActivity" label="最新活動時間" :value="latest?.activeMinutes ?? null" unit="分鐘" />
        <MetricCard v-if="hasActivity" label="最新運動時間" :value="latest?.exerciseMinutes ?? null" unit="分鐘" />
      </div>
      <section v-if="analysis.score?.score !== null && analysis.score" class="analysis-overview">
        <div class="analysis-heading">
          <div>
            <p class="eyebrow">HEALTH SCORE</p>
            <h2>{{ analysis.score.score }}<small> / 100</small></h2>
            <p>資料日期：{{ analysis.scoreDate }} · 資料完整度 {{ Math.round(analysis.score.completeness * 100) }}%</p>
            <p class="score-note">個人活動與身體趨勢參考，不是醫療評估。</p>
          </div>
          <div class="score-details">
            <span>活動 {{ analysis.score.activity.score ?? '—' }}</span>
            <span>身體 {{ analysis.score.body.score ?? '—' }}</span>
          </div>
        </div>
      </section>
      <section v-if="analysis.weeklySummary && (analysis.weeklySummary.averageSteps !== null || analysis.weeklySummary.totalExerciseMinutes !== null || analysis.weeklySummary.weightTrendKg !== null || analysis.weeklySummary.averageHealthScore !== null)" class="weekly-card">
        <div class="analysis-heading">
          <div>
            <p class="eyebrow">PREVIOUS WEEK</p>
            <h2>每週摘要</h2>
            <p>{{ analysis.weeklySummary.weekStart }} 起 · 週一至週日</p>
          </div>
          <div class="weekly-metrics">
            <span>平均步數 <strong>{{ analysis.weeklySummary.averageSteps === null ? '—' : Math.round(analysis.weeklySummary.averageSteps).toLocaleString() }}</strong></span>
            <span>運動時間 <strong>{{ analysis.weeklySummary.totalExerciseMinutes === null ? '—' : `${Math.round(analysis.weeklySummary.totalExerciseMinutes)} 分鐘` }}</strong></span>
            <span>體重變化 <strong>{{ analysis.weeklySummary.weightTrendKg === null ? '—' : `${analysis.weeklySummary.weightTrendKg > 0 ? '+' : ''}${analysis.weeklySummary.weightTrendKg.toFixed(1)} kg` }}</strong></span>
            <span>平均 Health Score <strong>{{ analysis.weeklySummary.averageHealthScore ?? '—' }}</strong></span>
            <span>步數較前週 <strong>{{ analysis.weeklySummary.weekOverWeek.averageSteps === null ? '—' : `${analysis.weeklySummary.weekOverWeek.averageSteps > 0 ? '+' : ''}${Math.round(analysis.weeklySummary.weekOverWeek.averageSteps).toLocaleString()}` }}</strong></span>
          </div>
        </div>
      </section>
      <section v-if="analysis.insights.length" class="insight-preview">
        <header><h2>近期洞察</h2><RouterLink to="/insights">查看全部 →</RouterLink></header>
        <article v-for="insight in analysis.insights.slice(0, 2)" :key="insight.id" class="insight-item">
          <strong>{{ insight.title }}</strong><p>{{ insight.description }}</p>
        </article>
      </section>
      <div class="dashboard-grid">
        <TrendChart v-if="hasActivity" title="步數趨勢" :range="'30D'" :points="stepPoints" unit="步" />
        <TrendChart v-if="hasBody" title="體重趨勢" :range="'30D'" :points="weightPoints" unit="kg" />
      </div>
      <HealthStateCard v-if="data.availability === 'empty'" state="empty" title="尚未取得健康資料" description="完成 Google Health 連線與首次同步後，有實際資料的區塊和導覽入口才會自動出現。" />
    </template>

    <p class="data-rule">缺少的資料不會以 0 顯示，也不會用推測值補齊。</p>
  </section>
</template>
