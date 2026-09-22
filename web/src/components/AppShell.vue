<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import type { HealthAnalysisData } from '@health/shared'
import { healthDataClient } from '../services/health-data'

const auth = useAuthStore()
const route = useRoute()
const showNavigation = computed(() => auth.authenticated && route.name !== 'login')
const analysis = ref<HealthAnalysisData | null>(null)
watch(() => auth.authenticated, async (authenticated) => {
  if (!authenticated) { analysis.value = null; return }
  analysis.value = await healthDataClient.getAnalysis().catch(() => null)
}, { immediate: true })

const visibleNavigation = computed(() => [
  { to: '/dashboard', label: '首頁' },
  ...(analysis.value?.insights.length ? [{ to: '/insights', label: '洞察' }] : []),
  ...(analysis.value?.timeline.length ? [{ to: '/timeline', label: '時間軸' }] : []),
  { to: '/settings', label: '設定' },
])
</script>

<template>
  <div class="app-frame" :class="{ 'has-navigation': showNavigation }">
    <aside v-if="showNavigation" class="side-navigation" aria-label="主要導覽">
      <div class="brand-mark" aria-hidden="true">脈</div>
      <div class="brand-copy">
        <span>個人健康</span>
        <small>趨勢儀表板</small>
      </div>
      <nav>
        <RouterLink v-for="item in visibleNavigation" :key="item.to" :to="item.to">
          {{ item.label }}
        </RouterLink>
      </nav>
    </aside>

    <main class="main-content">
      <RouterView />
    </main>

    <nav v-if="showNavigation" class="bottom-navigation" aria-label="主要導覽">
        <RouterLink v-for="item in visibleNavigation" :key="item.to" :to="item.to">
        {{ item.label }}
      </RouterLink>
    </nav>
  </div>
</template>
