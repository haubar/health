<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { DashboardRange } from '@health/shared'
import { useAuthStore } from '../stores/auth'
import { emptyDashboardData, healthDataClient } from '../services/health-data'
import type { DashboardData } from '@health/shared'
import HealthStateCard from '../components/HealthStateCard.vue'
import MetricCard from '../components/MetricCard.vue'
import RangeSelector from '../components/RangeSelector.vue'
import TrendChart from '../components/TrendChart.vue'

const auth = useAuthStore()
const range = ref<DashboardRange>('7D')
const data = ref<DashboardData>(emptyDashboardData)
const loading = ref(true)
async function load() { loading.value = true; try { data.value = await healthDataClient.getDashboard(range.value) } finally { loading.value = false } }
onMounted(load)
watch(range, load)
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

    <div class="dashboard-toolbar"><span class="section-label">趨勢範圍</span><RangeSelector v-model="range" /></div>
    <div class="metric-grid">
      <MetricCard v-if="hasActivity" label="今日步數" :value="latest?.steps ?? null" unit="步" />
      <MetricCard v-if="hasActivity" label="今日距離" :value="latest?.distanceKm ?? null" unit="km" />
      <MetricCard v-if="hasActivity" label="活動時間" :value="latest?.activeMinutes ?? null" unit="分鐘" />
      <MetricCard v-if="hasActivity" label="運動時間" :value="latest?.exerciseMinutes ?? null" unit="分鐘" />
    </div>
    <div class="dashboard-grid">
      <TrendChart v-if="hasActivity" title="步數趨勢" :range="range" :points="stepPoints" unit="步" />
      <TrendChart v-if="hasBody" title="體重趨勢" :range="range" :points="weightPoints" unit="kg" />
    </div>
    <HealthStateCard v-if="loading || data.availability === 'empty'" :state="loading ? 'loading' : 'empty'" title="尚未取得健康資料" description="完成 Google Health 連線與首次同步後，有實際資料的區塊和導覽入口才會自動出現。" />

    <p class="data-rule">缺少的資料不會以 0 顯示，也不會用推測值補齊。</p>
  </section>
</template>
