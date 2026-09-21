<script setup lang="ts">
import { ref } from 'vue'
import HealthStateCard from '../components/HealthStateCard.vue'
import MetricCard from '../components/MetricCard.vue'
import RangeSelector from '../components/RangeSelector.vue'
import TrendChart from '../components/TrendChart.vue'
import { emptyDashboardData } from '../services/health-data'
import type { DashboardRange } from '@health/shared'

const range = ref<DashboardRange>('7D')
</script>

<template>
  <section class="page-stack">
    <header class="page-header">
      <div><p class="eyebrow">ACTIVITY</p><h1>活動</h1></div>
      <RangeSelector v-model="range" />
    </header>
    <div class="metric-grid">
      <MetricCard label="步數" :value="null" unit="步" />
      <MetricCard label="距離" :value="null" unit="km" />
      <MetricCard label="活動時間" :value="null" unit="分鐘" />
      <MetricCard label="運動時間" :value="null" unit="分鐘" />
    </div>
    <TrendChart title="每日步數" :range="range" :points="[]" unit="步" />
    <HealthStateCard v-if="emptyDashboardData.availability === 'empty'" state="empty" />
  </section>
</template>
