<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { emptyDashboardData, healthDataClient } from '../services/health-data'
import type { DashboardData, HealthAnalysisData } from '@health/shared'
import HealthStateCard from '../components/HealthStateCard.vue'
import HealthLoading from '../components/HealthLoading.vue'
import TrendChart from '../components/TrendChart.vue'

const auth = useAuthStore()
type DashboardPeriod = '30D' | '90D' | '1Y' | 'month'
function currentMonthValue(): string {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
const month = ref(currentMonthValue())
const period = ref<DashboardPeriod>('30D')
const currentMonth = currentMonthValue()
const monthLabel = computed(() => new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: 'long', timeZone: 'Asia/Taipei' }).format(new Date(`${month.value}-01T00:00:00+08:00`)))
const periodLabel = computed(() => period.value === 'month' ? monthLabel.value : ({ '30D': '近 30 天', '90D': '近 90 天', '1Y': '近一年' } as const)[period.value])
const data = ref<DashboardData>(emptyDashboardData)
const analysis = ref<HealthAnalysisData>({
  weeklySummary: null, insights: [], timeline: [],
  weightLoss: { latestKg: null, latestDate: null, targetKg: null, kgToGoal: null, changeKg: null, changeDays: null, sampleCount90d: 0, points: [] },
  activityWeek: { weekStart: '', averageSteps: null, stepGoal: 8000, stepGoalDays: 0, stepTrackedDays: 0, recordedExerciseMinutes: null, exerciseTrackedDays: 0, exerciseGoalMinutes: 150 },
})
const loading = ref(true)
const loadError = ref('')
let requestId = 0
async function load() {
  const currentRequestId = ++requestId
  loading.value = true
  loadError.value = ''
  try {
    const [dashboardData, analysisData] = await Promise.all([
      healthDataClient.getDashboard(period.value, month.value),
      healthDataClient.getAnalysis().catch(() => analysis.value),
    ])
    if (currentRequestId === requestId) {
      data.value = dashboardData
      analysis.value = analysisData
    }
  } catch {
    if (currentRequestId === requestId) loadError.value = '健康資料暫時無法載入，請稍後再試。'
  } finally {
    if (currentRequestId === requestId) loading.value = false
  }
}
onMounted(load)
watch([period, month], load)
function shiftMonth(offset: number): void {
  const [year, monthNumber] = month.value.split('-').map(Number)
  const date = new Date(Date.UTC(year!, monthNumber! - 1 + offset, 1))
  month.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}
const hasActivity = computed(() => data.value.summaries.some((day) => day.steps !== null || day.distanceKm !== null || day.activeMinutes !== null || day.exerciseMinutes !== null))
const stepPoints = computed(() => data.value.summaries.flatMap((day) => day.steps === null ? [] : [{ label: day.date, value: day.steps }]))
const weightPoints = computed(() => analysis.value.weightLoss.points.map((point) => ({ label: point.date, value: point.weightKg })))
const goalDistanceText = computed(() => {
  const amount = analysis.value.weightLoss.kgToGoal
  if (amount === null) return ''
  if (amount > 0) return `距離目標 ${amount.toFixed(1)} kg`
  if (amount < 0) return `目前比設定目標低 ${Math.abs(amount).toFixed(1)} kg`
  return '已到達設定目標'
})
const weightChangeText = computed(() => {
  const amount = analysis.value.weightLoss.changeKg
  if (amount === null) return null
  return `${amount > 0 ? '+' : ''}${amount.toFixed(1)} kg`
})
const nextStep = computed(() => {
  const week = analysis.value.activityWeek
  if (week.stepTrackedDays >= 4 && week.stepGoalDays < week.stepTrackedDays) {
    return '下週先比上週多安排 1 個步數達標日，觀察能否穩定維持。'
  }
  if (week.recordedExerciseMinutes !== null && week.recordedExerciseMinutes < week.exerciseGoalMinutes) {
    const remaining = Math.ceil(week.exerciseGoalMinutes - week.recordedExerciseMinutes)
    return `上週已記錄運動距目標還差 ${remaining} 分鐘，可分散安排在幾次活動中。`
  }
  if (week.stepTrackedDays > 0 && week.stepGoalDays === week.stepTrackedDays && week.recordedExerciseMinutes !== null) {
    return '上週設定的步數與運動目標都已達成；維持目前節奏，觀察體重的多週變化。'
  }
  return '先確認 Google Health 已完成近期同步，再根據每週步數與運動紀錄調整活動目標。'
})
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div>
        <p class="eyebrow">OVERVIEW</p>
        <h1>減重進度</h1>
      </div>
      <span class="account-chip">{{ auth.user?.displayName ?? auth.user?.email }}</span>
    </header>

    <div class="dashboard-toolbar">
      <span class="section-label">體重看近 90 天；活動資料可按區間或逐月查看</span>
      <div class="dashboard-period-controls">
        <div class="range-selector" role="group" aria-label="活動資料範圍">
          <button v-for="option in (['30D', '90D', '1Y', 'month'] as const)" :key="option" type="button" :class="{ active: period === option }" @click="period = option">
            {{ option === 'month' ? '單月' : option === '1Y' ? '1 年' : option === '90D' ? '90 天' : '30 天' }}
          </button>
        </div>
        <div v-if="period === 'month'" class="month-navigation" aria-label="切換月份">
          <button type="button" aria-label="查看前一個月" @click="shiftMonth(-1)">←</button>
          <strong>{{ monthLabel }}</strong>
          <button type="button" aria-label="查看下一個月" :disabled="month >= currentMonth" @click="shiftMonth(1)">→</button>
        </div>
      </div>
    </div>
    <HealthLoading v-if="loading" />
    <HealthStateCard v-else-if="loadError" state="error" title="資料載入失敗" :description="loadError" />
    <template v-else>
      <section class="weight-focus-card">
        <div class="weight-focus-main">
          <div>
            <p class="eyebrow">LATEST MEASUREMENT</p>
            <template v-if="analysis.weightLoss.latestKg !== null">
              <p class="weight-reading">{{ analysis.weightLoss.latestKg.toFixed(1) }} <small>kg</small></p>
              <p class="weight-date">最近量測：{{ analysis.weightLoss.latestDate }}</p>
            </template>
            <template v-else>
              <h2>尚無體重量測</h2>
              <p class="weight-date">連結體重資料來源並同步後，這裡會顯示實際量測紀錄。</p>
            </template>
          </div>
          <div v-if="analysis.weightLoss.targetKg !== null" class="weight-goal-block">
            <span>目標體重</span><strong>{{ analysis.weightLoss.targetKg.toFixed(1) }} kg</strong>
            <small>{{ goalDistanceText }}</small>
          </div>
          <RouterLink v-else class="goal-setup-link" to="/settings">設定減重目標 <span>→</span></RouterLink>
        </div>
        <div class="weight-focus-stats">
          <div>
            <span>近 90 天淨變化</span>
            <strong v-if="weightChangeText !== null">{{ weightChangeText }}</strong>
            <strong v-else>資料累積中</strong>
            <small v-if="weightChangeText === null">至少 3 次量測且跨 14 天才比較</small>
            <small v-else>依 {{ analysis.weightLoss.sampleCount90d }} 次量測，跨 {{ analysis.weightLoss.changeDays }} 天</small>
          </div>
          <div><span>90 天量測次數</span><strong>{{ analysis.weightLoss.sampleCount90d }}</strong><small>只計實際同步的體重資料</small></div>
        </div>
      </section>

      <TrendChart v-if="weightPoints.length" title="體重趨勢 · 近 90 天" :range="'90D'" :points="weightPoints" unit="kg" :time-scale="true" :show-points="true" />
      <p v-if="weightPoints.length" class="weight-context">體重會受水分與量測時點影響；單次升降不等同脂肪變化，請看一段時間的整體方向。</p>

      <section class="activity-coaching-card">
        <header class="activity-coaching-heading">
          <div><p class="eyebrow">WEEKLY HABITS</p><h2>上週活動習慣</h2></div>
          <span>{{ analysis.activityWeek.weekStart }} 起 · 週一至週日</span>
        </header>
        <div class="habit-grid">
          <article class="habit-item">
            <div class="habit-topline"><span>步數達標日</span><strong v-if="analysis.activityWeek.stepTrackedDays">{{ analysis.activityWeek.stepGoalDays }}<small> / {{ analysis.activityWeek.stepTrackedDays }} 個有資料日</small></strong><strong v-else>—</strong></div>
            <p v-if="analysis.activityWeek.averageSteps !== null">日均 {{ Math.round(analysis.activityWeek.averageSteps).toLocaleString() }} 步 · 目標 {{ analysis.activityWeek.stepGoal.toLocaleString() }}</p>
            <p v-else>上週沒有可用步數資料。</p>
            <div v-if="analysis.activityWeek.stepTrackedDays" class="habit-track"><span :style="{ width: `${Math.min(100, analysis.activityWeek.stepGoalDays / analysis.activityWeek.stepTrackedDays * 100)}%` }"></span></div>
          </article>
          <article class="habit-item">
            <div class="habit-topline"><span>已記錄運動</span><strong>{{ analysis.activityWeek.recordedExerciseMinutes === null ? '—' : Math.round(analysis.activityWeek.recordedExerciseMinutes) }}<small>{{ analysis.activityWeek.recordedExerciseMinutes === null ? '' : ' 分鐘' }}</small></strong></div>
            <p>{{ analysis.activityWeek.exerciseTrackedDays ? `來自 ${analysis.activityWeek.exerciseTrackedDays} 天的運動紀錄 · 週目標 ${analysis.activityWeek.exerciseGoalMinutes} 分鐘` : '上週沒有可用運動紀錄。' }}</p>
            <div v-if="analysis.activityWeek.recordedExerciseMinutes !== null" class="habit-track"><span :style="{ width: `${Math.min(100, analysis.activityWeek.recordedExerciseMinutes / analysis.activityWeek.exerciseGoalMinutes * 100)}%` }"></span></div>
          </article>
        </div>
        <div class="next-step"><span>下一步</span><p>{{ nextStep }}</p></div>
      </section>
      <section v-if="analysis.insights.length" class="insight-preview">
        <header><h2>近期洞察</h2><RouterLink to="/insights">查看全部 →</RouterLink></header>
        <article v-for="insight in analysis.insights.slice(0, 2)" :key="insight.id" class="insight-item">
          <strong>{{ insight.title }}</strong><p>{{ insight.description }}</p>
        </article>
      </section>
      <div class="dashboard-grid">
        <TrendChart v-if="hasActivity" :title="`${periodLabel}步數趨勢`" :range="period === '1Y' ? '1Y' : period === '90D' ? '90D' : '30D'" :points="stepPoints" unit="步" />
      </div>
      <HealthStateCard v-if="data.availability === 'empty' && !hasActivity && analysis.weightLoss.latestKg === null" state="empty" title="這段期間還沒有同步資料" description="完成 Google Health 連線與同步後，有實際資料的區塊才會出現。" />
    </template>

    <p class="data-rule">缺少的資料不會以 0 顯示，也不會用推測值補齊。</p>
  </section>
</template>
