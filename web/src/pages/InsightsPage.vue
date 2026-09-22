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
    <header class="page-header"><div><p class="eyebrow">PERSONAL TRENDS</p><h1>趨勢洞察</h1></div></header>
    <HealthLoading v-if="loading" />
    <HealthStateCard v-else-if="error" state="error" title="洞察暫時無法載入" description="請稍後再試。" />
    <HealthStateCard v-else-if="!data?.insights.length" state="empty" title="目前沒有足夠資料產生洞察" description="同步更多活動紀錄後，符合資料條件的趨勢會顯示在這裡。" />
    <div v-else class="insight-list">
      <article v-for="insight in data.insights" :key="insight.id" class="insight-item">
        <div class="insight-meta"><span>{{ insight.type === 'activity' ? '活動' : '身體' }}</span><time>{{ new Date(insight.createdAt).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }) }}</time></div>
        <h2>{{ insight.title }}</h2><p>{{ insight.description }}</p>
        <small v-if="insight.baseline !== undefined && insight.currentValue !== undefined">個人基準 {{ Math.round(insight.baseline).toLocaleString() }} · 近期 {{ Math.round(insight.currentValue).toLocaleString() }}</small>
      </article>
    </div>
    <p class="data-rule">洞察只根據已同步資料產生，不代表醫療診斷。</p>
    <RouterLink class="secondary-action" to="/dashboard">返回健康總覽</RouterLink>
  </section>
</template>
