import type { DashboardData, DashboardRange } from '@health/shared'
import { getJson, postJson } from './api'

export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
  sync(onProgress?: (progress: { batch: number; batchCount: number; recordCount: number }) => void): Promise<{ lastCompletedAt: string; recordCount: number }>
}

interface SyncBatchResponse {
  batch: number
  batchCount: number
  runStartedAt: string
  startTime: string
  endTime: string
  recordCount: number
  totalRecordCount: number
  recordCounts: { activity: number; weight: number; bodyFat: number; workouts: number }
  done: boolean
  lastCompletedAt: string | null
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range: DashboardRange) => getJson<DashboardData>(`/.netlify/functions/dashboard-data?range=${range}`),
  async sync(onProgress) {
    let batchCount = 0
    let runStartedAt: string | null = null
    let recordCount = 0
    let lastCompletedAt: string | null = null
    for (let batch = 0; ; batch += 1) {
      const result: SyncBatchResponse = await postJson<SyncBatchResponse>('/.netlify/functions/sync-health', { batch, runStartedAt })
      batchCount = result.batchCount
      const expectedEnd = new Date(result.runStartedAt)
      expectedEnd.setUTCDate(expectedEnd.getUTCDate() - batch)
      const expectedStart = new Date(expectedEnd)
      expectedStart.setUTCDate(expectedStart.getUTCDate() - 1)
      const fetchedCount = Object.values(result.recordCounts).reduce((sum, value) => sum + value, 0)
      if (result.batch !== batch || result.startTime !== expectedStart.toISOString() || result.endTime !== expectedEnd.toISOString() || fetchedCount !== result.recordCount) {
        throw new Error(`同步資料核對失敗：第 ${batch + 1} 批日期範圍或筆數不一致。`)
      }
      runStartedAt = result.runStartedAt
      recordCount += result.recordCount
      if (result.totalRecordCount !== recordCount || result.done !== (batch === batchCount - 1)) {
        throw new Error(`同步資料核對失敗：第 ${batch + 1} 批累計筆數不一致。`)
      }
      onProgress?.({ batch: batch + 1, batchCount, recordCount })
      if (result.done) lastCompletedAt = result.lastCompletedAt
    }
    return { lastCompletedAt: lastCompletedAt!, recordCount }
  },
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}
