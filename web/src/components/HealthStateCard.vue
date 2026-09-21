<script setup lang="ts">
import type { DataAvailability } from '@health/shared'

const props = withDefaults(
  defineProps<{
    state: DataAvailability
    title?: string
    description?: string
  }>(),
  {
    title: '目前沒有可用資料',
    description: '完成同步後，這裡會顯示實際取得的健康資料。',
  },
)
</script>

<template>
  <article class="state-card" :data-state="props.state">
    <div class="state-icon" aria-hidden="true">
      <span v-if="props.state === 'loading'">⋯</span>
      <span v-else-if="props.state === 'offline'">⌁</span>
      <span v-else-if="props.state === 'error'">!</span>
      <span v-else>↗</span>
    </div>
    <div>
      <h2>{{ props.title }}</h2>
      <p>{{ props.description }}</p>
    </div>
  </article>
</template>

