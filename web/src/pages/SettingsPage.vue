<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <section class="page-stack narrow-page">
    <header class="page-header">
      <div>
        <p class="eyebrow">SETTINGS</p>
        <h1>設定</h1>
      </div>
    </header>

    <article class="settings-card">
      <div>
        <p class="field-label">登入帳號</p>
        <p>{{ auth.user?.email }}</p>
      </div>
      <span class="connection-state">已驗證</span>
    </article>

    <a class="secondary-action" href="/.netlify/functions/auth-logout">登出</a>
  </section>
</template>

