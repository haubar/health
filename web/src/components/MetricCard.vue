<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    value: string | number | null
    unit?: string
    detail?: string
  }>(),
  { unit: '', detail: '' },
)
</script>

<template>
  <article v-if="value !== null" class="metric-card">
    <p>{{ label }}</p>
    <strong>{{ value }}<small v-if="unit"> {{ unit }}</small></strong>
    <span v-if="detail">{{ detail }}</span>
  </article>
</template>

