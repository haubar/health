<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { HealthAnalysisData } from '@health/shared'
import HealthLoading from '../components/HealthLoading.vue'
import HealthStateCard from '../components/HealthStateCard.vue'
import { healthDataClient } from '../services/health-data'

const data = ref<HealthAnalysisData | null>(null)
const loading = ref(true)
const error = ref(false)
onMounted(async () => {
  try { data.value = await healthDataClient.getAnalysis() } catch { error.value = true } finally { loading.value = false }
})
</script>

<template>
  <section class="page-stack narrow-page">
    <header class="page-header"><div><p class="eyebrow">HEALTH MILESTONES</p><h1>健康時間軸</h1></div></header>
    <HealthLoading v-if="loading" />
    <HealthStateCard v-else-if="error" state="error" title="時間軸暫時無法載入" description="請稍後再試。" />
    <HealthStateCard v-else-if="!data?.timeline.length" state="empty" title="目前沒有健康里程碑" description="累積更多活動、運動或體重紀錄後，符合條件的里程碑會顯示在這裡。" />
    <ol v-else class="timeline-list">
      <li v-for="event in data.timeline" :key="event.id" class="timeline-event">
        <time>{{ event.date }}</time><article><h2>{{ event.title }}</h2><p>{{ event.description }}</p></article>
      </li>
    </ol>
    <RouterLink class="secondary-action" to="/dashboard">返回健康總覽</RouterLink>
  </section>
</template>
