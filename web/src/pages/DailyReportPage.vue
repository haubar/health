<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getJson } from '../services/api'
type Day = { date: string; synced: boolean; lastUpdatedAt: string | null; steps: number | null; distanceKm: number | null; bodyFatPercentage: number | null; activeMinutes: number | null; exerciseMinutes: number | null; activeCalories: number | null; totalCalories: number | null; weightKg: number | null }
type Report = { days: Day[]; stepGoal: number; weightGoalKg: number | null }
const report = ref<Report | null>(null)
const selectedDate = ref('')
const error = ref('')
const selectedDay = computed(() => report.value?.days.find(day => day.date === selectedDate.value) ?? null)
const orderedDays = computed(() => [...(report.value?.days ?? [])].sort((a, b) => b.date.localeCompare(a.date)))
const weekday = (date: string) => new Intl.DateTimeFormat('zh-TW', { weekday: 'short', timeZone: 'Asia/Taipei' }).format(new Date(date + 'T12:00:00+08:00'))
const dayNumber = (date: string) => String(Number(date.slice(8, 10)))
const measured = (value: number | null, unit: string) => value === null ? '未測量' : value.toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + unit
const numeric = (value: number | null, unit: string) => value === null ? '尚無資料' : value.toLocaleString('zh-TW', { maximumFractionDigits: 1 }) + unit
const dateLabel = (date: string) => date.replace(/-/g, '/')
const selectRelative = (offset: number) => {
  const index = orderedDays.value.findIndex(day => day.date === selectedDate.value)
  const next = orderedDays.value[index + offset]
  if (next) selectedDate.value = next.date
}
const selectedIndex = computed(() => orderedDays.value.findIndex(day => day.date === selectedDate.value))
async function load() {
  try {
    report.value = await getJson<Report>('/.netlify/functions/daily-progress-export')
    selectedDate.value = report.value.days[report.value.days.length - 1]?.date ?? ''
  } catch { error.value = '報表載入失敗' }
}
onMounted(load)
</script>
<template>
  <section class="page-stack">
    <header class="page-header"><div><p class="eyebrow">DAILY REPORT</p><h1>每日健康報表</h1></div><button type="button" class="report-refresh" @click="load">↻ 重新整理</button></header>
    <p class="data-rule">僅登入後可查看最近七天的健康紀錄。缺少的資料不會補成零。</p>
    <p v-if="error">{{ error }}</p>
    <template v-if="report">
      <section class="report-date-section" aria-label="選擇報表日期">
        <div class="report-date-heading">
          <div><strong>選擇日期</strong><p>最近 7 天 · 點選日期切換報表</p></div>
          <span class="report-current-date">{{ selectedDay ? dateLabel(selectedDay.date) : '' }}</span>
        </div>
        <div class="report-date-navigation">
          <button type="button" class="report-date-arrow" aria-label="前一天" :disabled="selectedIndex >= orderedDays.length - 1" @click="selectRelative(1)">‹</button>
          <div class="report-date-strip" role="group" aria-label="最近七天日期">
            <button v-for="day in orderedDays" :key="day.date" type="button" class="report-day" :class="{ active: selectedDate === day.date, 'no-data': !day.synced }" :aria-pressed="selectedDate === day.date" :aria-label="dateLabel(day.date) + ' ' + weekday(day.date)" @click="selectedDate = day.date">
              <span class="report-weekday">{{ weekday(day.date) }}</span>
              <strong>{{ dayNumber(day.date) }}</strong>
              <span class="report-day-dot" :class="{ synced: day.synced }"></span>
            </button>
          </div>
          <button type="button" class="report-date-arrow" aria-label="後一天" :disabled="selectedIndex <= 0" @click="selectRelative(-1)">›</button>
        </div>
        <p class="report-date-hint"><span class="report-legend-dot"></span> 已同步 <span class="report-legend-dot pending"></span> 未同步</p>
      </section>
      <div v-for="day in report.days.filter(d => d.date === selectedDate)" :key="day.date" class="metric-grid">
        <div class="metric-card"><p>步數</p><strong>{{ day.steps ?? '—' }}</strong><small>目標 {{ report.stepGoal }} 步 · {{ day.steps === null ? '尚無資料' : Math.round(day.steps / report.stepGoal * 100) + '%' }} · {{ day.steps === null ? '無法計算剩餘步數' : '剩餘 ' + Math.max(0, report.stepGoal - day.steps) + ' 步' }}</small></div>
        <div class="metric-card"><p>總消耗熱量</p><strong>{{ numeric(day.totalCalories, ' kcal') }}</strong><small>包含基礎代謝與活動消耗；目前同步程式尚未擷取此指標</small></div>
        <div class="metric-card"><p>活動分鐘數</p><strong>{{ numeric(day.activeMinutes, ' 分鐘') }}</strong><small>依 Google Health 同步的活動分鐘紀錄</small></div>
        <div class="metric-card"><p>活動距離</p><strong>{{ numeric(day.distanceKm, ' km') }}</strong></div>
        <div class="metric-card"><p>體重</p><strong>{{ measured(day.weightKg, ' kg') }}</strong><small>目標 {{ report.weightGoalKg ?? '未設定' }} kg</small></div>
        <div class="metric-card"><p>體脂率</p><strong>{{ measured(day.bodyFatPercentage, '%') }}</strong><small>以當日實際量測為準</small></div>
        <p class="data-rule">{{ day.synced ? '已同步' : '尚未同步' }} · 最後紀錄：{{ day.lastUpdatedAt ?? '無資料' }}</p>
      </div>
    </template>
  </section>
</template>

<style scoped>
.report-refresh { border: 1px solid #345448; border-radius: .7rem; background: #17372e; color: #dffdf1; padding: .65rem 1rem; cursor: pointer; font: inherit; font-size: .85rem; }
.report-date-section { display: grid; gap: 1rem; padding: 1.2rem; border: 1px solid #2b403a; border-radius: 1.1rem; background: #101a1e; }
.report-date-heading { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
.report-date-heading strong { font-size: 1.05rem; }
.report-date-heading p { margin: .3rem 0 0; font-size: .8rem; color: #96aaa1; }
.report-current-date { color: #9cebc9; font-size: .85rem; white-space: nowrap; }
.report-date-navigation { display: flex; align-items: center; gap: .55rem; min-width: 0; }
.report-date-strip { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: .5rem; flex: 1; min-width: 0; }
.report-day { display: grid; justify-items: center; gap: .45rem; min-width: 0; border: 1px solid #30433d; border-radius: .9rem; padding: .85rem .25rem; background: #19262a; color: #d3e5dc; cursor: pointer; font: inherit; transition: background .15s, border-color .15s; }
.report-day:hover { border-color: #82f0c4; }
.report-day:focus-visible, .report-date-arrow:focus-visible { outline: 2px solid #82f0c4; outline-offset: 3px; }
.report-day.active { border-color: #82f0c4; background: #1e5745; box-shadow: inset 0 0 0 1px #82f0c4; }
.report-weekday { color: #a0b6ac; font-size: .76rem; }
.report-day strong { font-size: 1.45rem; line-height: 1.2; }
.report-day-dot, .report-legend-dot { width: .38rem; height: .38rem; border-radius: 50%; background: #65726e; }
.report-day-dot.synced, .report-legend-dot { background: #82f0c4; }
.report-legend-dot.pending { background: #65726e; }
.report-date-arrow { flex: 0 0 2.25rem; height: 2.75rem; border: 1px solid #30433d; border-radius: .7rem; background: #1b2a2d; color: #dffdf1; cursor: pointer; font-size: 1.7rem; }
.report-date-arrow:disabled { opacity: .3; cursor: not-allowed; }
.report-date-hint { display: flex; align-items: center; gap: .4rem; margin: 0; color: #91a69c; font-size: .76rem; }
.report-date-hint .pending { margin-left: .75rem; }
@media (max-width: 680px) {
  .report-date-section { padding: .85rem; }
  .report-date-strip { gap: .25rem; }
  .report-date-navigation { gap: .25rem; }
  .report-date-arrow { flex-basis: 1.6rem; height: 2.3rem; font-size: 1.3rem; }
  .report-day { padding: .65rem .1rem; border-radius: .6rem; gap: .3rem; }
  .report-day strong { font-size: 1.1rem; }
  .report-weekday { font-size: .67rem; }
  .report-current-date { font-size: .73rem; }
}
</style>
