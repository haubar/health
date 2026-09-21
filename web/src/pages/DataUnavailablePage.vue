<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ section: string }>()
const labels: Record<string, string> = {
  activity: '活動',
  body: '身體組成',
  workouts: '運動紀錄',
  insights: '趨勢洞察',
  timeline: '健康時間軸',
}
const title = computed(() => labels[props.section] ?? '健康資料')
</script>

<template>
  <section class="page-stack narrow-page">
    <header class="page-header">
      <h1>{{ title }}</h1>
    </header>
    <article class="empty-card">
      <div>
        <h2>目前沒有可顯示的資料</h2>
        <p>這個入口只會在同步完成且至少有一筆可用資料後顯示。</p>
      </div>
    </article>
    <RouterLink class="secondary-action" to="/dashboard">返回健康總覽</RouterLink>
  </section>
</template>

