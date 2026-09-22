<script setup lang="ts">
withDefaults(defineProps<{ message?: string; detail?: string }>(), {
  message: '正在整理健康資料',
  detail: '正在讀取步數、運動與身體趨勢…',
})
</script>

<template>
  <section class="health-loading" role="status" aria-live="polite" aria-busy="true">
    <div class="health-loader-art" aria-hidden="true">
      <span class="health-loader-orbit"></span>
      <svg class="health-loader-runner" viewBox="0 0 100 100" fill="none">
        <path class="health-loader-pulse" d="M8 64h17l8-15 10 28 12-40 10 27 7-13h20" />
        <circle class="health-loader-head" cx="56" cy="18" r="7" />
        <path class="health-loader-body" d="m52 29-9 17 14 8 10-14m-12-9 14-3 10 8m-22 1-14 5-12 12m14-5 11 13-13 14m13-14 16 5 12 15" />
      </svg>
    </div>
    <div class="health-loading-copy">
      <h2>{{ message }}</h2>
      <p>{{ detail }}</p>
    </div>
    <div class="health-loading-track" aria-hidden="true"><span></span></div>
  </section>
</template>
