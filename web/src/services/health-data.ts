import type { DashboardData, DashboardRange } from '@health/shared'
import { getJson, postJson } from './api'

export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
  sync(onProgress?: (progress: { batch: number; batchCount: number; recordCount: number }) => void): Promise<{ lastCompletedAt: string; recordCount: number; windowStart: string; windowEnd: string }>
}

interface SyncBatchResponse {
  batch: number
  batchCount: number
  runStartedAt: string
  runEndTime: string
  startTime: string
  endTime: string
  recordCount: number
  totalRecordCount: number
  recordCounts: { activity: number; weight: number; bodyFat: number; workouts: number }
  done: boolean
  lastCompletedAt: string | null
}

const DASHBOARD_CACHE_MS = 5 * 60 * 1000
const dashboardCache = new Map<string, { data: DashboardData; expiresAt: number }>()
const dashboardRequests = new Map<string, Promise<DashboardData>>()

function loadDashboard(range: DashboardRange): Promise<DashboardData> {
  const cached = dashboardCache.get(range)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data)
  const pending = dashboardRequests.get(range)
  if (pending) return pending

  const request = getJson<DashboardData>(`/.netlify/functions/dashboard-data?range=${range}`)
    .then((data) => {
      dashboardCache.set(range, { data, expiresAt: Date.now() + DASHBOARD_CACHE_MS })
      return data
    })
    .finally(() => dashboardRequests.delete(range))
  dashboardRequests.set(range, request)
  return request
}

function clearDashboardCache(): void {
  dashboardCache.clear()
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range: DashboardRange) => loadDashboard(range),
  async sync(onProgress) {
    clearDashboardCache()
    let batchCount = 0
    let runStartedAt: string | null = null
    let recordCount = 0
    let lastCompletedAt: string | null = null
    let windowStart = ''
    let windowEnd = ''
    let previousBatchStart: string | null = null
    try {
      for (let batch = 0; ; batch += 1) {
        const result: SyncBatchResponse = await postJson<SyncBatchResponse>('/.netlify/functions/sync-health', { batch, runStartedAt })
        batchCount = result.batchCount
        const startTime = Date.parse(result.startTime)
        const endTime = Date.parse(result.endTime)
        const fetchedCount = Object.values(result.recordCounts).reduce((sum, value) => sum + value, 0)
        const validRange = Number.isFinite(startTime)
          && Number.isFinite(endTime)
          && endTime - startTime === 24 * 60 * 60 * 1000
          && (batch > 0 || result.endTime === result.runEndTime)
          && (previousBatchStart === null || result.endTime === previousBatchStart)
        if (result.batch !== batch || !validRange || fetchedCount !== result.recordCount) {
          throw new Error(`同步資料核對失敗：第 ${batch + 1} 批日期範圍或筆數不一致。`)
        }
        runStartedAt = result.runStartedAt
        windowStart = result.startTime
        if (batch === 0) windowEnd = result.endTime
        previousBatchStart = result.startTime
        recordCount += result.recordCount
        if (result.totalRecordCount !== recordCount || result.done !== (batch === batchCount - 1)) {
          throw new Error(`同步資料核對失敗：第 ${batch + 1} 批累計筆數不一致。`)
        }
        onProgress?.({ batch: batch + 1, batchCount, recordCount })
        if (result.done) {
          lastCompletedAt = result.lastCompletedAt
          break
        }
      }
      return { lastCompletedAt: lastCompletedAt!, recordCount, windowStart, windowEnd }
    } finally {
      clearDashboardCache()
    }
  },
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}
