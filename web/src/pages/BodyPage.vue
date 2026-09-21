<script setup lang="ts">
import { ref } from 'vue'
import type { DashboardRange } from '@health/shared'
import HealthStateCard from '../components/HealthStateCard.vue'
import MetricCard from '../components/MetricCard.vue'
import RangeSelector from '../components/RangeSelector.vue'
import TrendChart from '../components/TrendChart.vue'
import { emptyDashboardData } from '../services/health-data'

const range = ref<DashboardRange>('7D')
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div><p class="eyebrow">BODY</p><h1>身體組成</h1></div>
      <RangeSelector v-model="range" />
    </header>
    <div class="metric-grid">
      <MetricCard label="體重" :value="null" unit="kg" />
      <MetricCard label="BMI" :value="null" />
      <MetricCard label="體脂" :value="null" unit="%" />
      <MetricCard label="瘦體重" :value="null" unit="kg" />
    </div>
    <TrendChart title="體重趨勢" :range="range" :points="[]" unit="kg" />
    <HealthStateCard v-if="emptyDashboardData.availability === 'empty'" state="empty" title="目前沒有身體組成資料" description="只有 Google Health API 實際取得的量測值才會顯示在這裡。" />
  </section>
</template>
