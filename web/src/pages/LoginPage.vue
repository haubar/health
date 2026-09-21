<script setup lang="ts">
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <section class="login-page">
    <div class="login-glow" aria-hidden="true"></div>
    <div class="login-panel">
      <p class="eyebrow">PRIVATE HEALTH VIEW</p>
      <h1>看見自己的健康趨勢，<br />不被雜訊干擾。</h1>
      <p class="lead">
        這是只供本人使用的健康儀表板。登入後，系統只會呈現已授權且確實存在的資料。
      </p>

      <p v-if="auth.error" class="status-message" role="status">{{ auth.error }}</p>

      <a class="primary-action" href="/.netlify/functions/auth-google">
        使用 Google 帳號登入
      </a>
      <p class="privacy-note">不提供公開註冊，也不會建立示範健康資料。</p>
    </div>
  </section>
</template>

