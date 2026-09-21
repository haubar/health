<script setup lang="ts">
import type { DashboardRange } from '@health/shared'

defineProps<{ modelValue: DashboardRange }>()
const emit = defineEmits<{ 'update:modelValue': [value: DashboardRange] }>()
const ranges: DashboardRange[] = ['7D', '30D', '90D', '1Y']
</script>

<template>
  <div class="range-selector" role="group" aria-label="資料範圍">
    <button
      v-for="range in ranges"
      :key="range"
      type="button"
      :class="{ active: range === modelValue }"
      @click="emit('update:modelValue', range)"
    >
      {{ range }}
    </button>
  </div>
</template>

