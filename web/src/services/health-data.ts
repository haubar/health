import type { DashboardData, DashboardRange } from '@health/shared'
import { getJson, postJson } from './api'

export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
  sync(): Promise<{ lastCompletedAt: string; recordCount: number }>
}

interface SyncBatchResponse {
  runStartedAt: string
  recordCount: number
  totalRecordCount: number
  done: boolean
  lastCompletedAt?: string | null
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range: DashboardRange) => getJson<DashboardData>(`/.netlify/functions/dashboard-data?range=${range}`),
  async sync() {
    const batchCount = 6
    let runStartedAt: string | null = null
    let recordCount = 0
    let lastCompletedAt: string | null = null
    for (let batch = 0; batch < batchCount; batch += 1) {
      const result: SyncBatchResponse = await postJson<SyncBatchResponse>('/.netlify/functions/sync-health', { batch, runStartedAt })
      runStartedAt = result.runStartedAt
      recordCount += result.recordCount
      if (result.done) lastCompletedAt = result.lastCompletedAt ?? new Date().toISOString()
    }
    return { lastCompletedAt: lastCompletedAt ?? new Date().toISOString(), recordCount }
  },
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}
