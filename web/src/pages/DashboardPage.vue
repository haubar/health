<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
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

    <article class="empty-card">
      <div class="empty-symbol" aria-hidden="true">↗</div>
      <div>
        <h2>尚未取得健康資料</h2>
        <p>完成 Google Health 連線與首次同步後，有實際資料的區塊和導覽入口才會自動出現。</p>
      </div>
    </article>

    <p class="data-rule">缺少的資料不會以 0 顯示，也不會用推測值補齊。</p>
  </section>
</template>

