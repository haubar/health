<script setup lang="ts">
import HealthStateCard from '../components/HealthStateCard.vue'
</script>

<template>
  <section class="page-stack narrow-page">
    <header class="page-header"><div><p class="eyebrow">WORKOUTS</p><h1>運動紀錄</h1></div></header>
    <HealthStateCard state="empty" title="目前沒有運動紀錄" description="這裡只會顯示 Google Health API 實際取得的運動 session。" />
  </section>
</template>

