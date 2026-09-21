<script setup lang="ts">
import { ref } from 'vue'
import type { DashboardRange } from '@health/shared'
import { useAuthStore } from '../stores/auth'
import HealthStateCard from '../components/HealthStateCard.vue'
import MetricCard from '../components/MetricCard.vue'
import RangeSelector from '../components/RangeSelector.vue'
import TrendChart from '../components/TrendChart.vue'

const auth = useAuthStore()
const range = ref<DashboardRange>('7D')
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
      <MetricCard label="今日步數" :value="null" unit="步" />
      <MetricCard label="今日距離" :value="null" unit="km" />
      <MetricCard label="活動時間" :value="null" unit="分鐘" />
      <MetricCard label="運動時間" :value="null" unit="分鐘" />
    </div>
    <div class="dashboard-grid">
      <TrendChart title="步數趨勢" :range="range" :points="[]" unit="步" />
      <TrendChart title="體重趨勢" :range="range" :points="[]" unit="kg" />
    </div>
    <HealthStateCard state="empty" title="尚未取得健康資料" description="完成 Google Health 連線與首次同步後，有實際資料的區塊和導覽入口才會自動出現。" />

    <p class="data-rule">缺少的資料不會以 0 顯示，也不會用推測值補齊。</p>
  </section>
</template>
