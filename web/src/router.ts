import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from './stores/auth'

const protectedRoutes: RouteRecordRaw[] = [
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('./pages/DashboardPage.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./pages/SettingsPage.vue'),
    meta: { requiresAuth: true },
  },
  { path: '/activity', name: 'activity', component: () => import('./pages/ActivityPage.vue'), meta: { requiresAuth: true } },
  { path: '/body', name: 'body', component: () => import('./pages/BodyPage.vue'), meta: { requiresAuth: true } },
  { path: '/workouts', name: 'workouts', component: () => import('./pages/WorkoutsPage.vue'), meta: { requiresAuth: true } },
  ...['insights', 'timeline'].map(
    (section): RouteRecordRaw => ({
      path: `/${section}`,
      name: section,
      component: () => import('./pages/DataUnavailablePage.vue'),
      props: { section },
      meta: { requiresAuth: true },
    }),
  ),
]

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'login', component: () => import('./pages/LoginPage.vue') },
    ...protectedRoutes,
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.initialize()

  if (to.meta.requiresAuth && !auth.authenticated) {
    return { name: 'login' }
  }
  if (to.name === 'login' && auth.authenticated) {
    return { name: 'dashboard' }
  }
})
