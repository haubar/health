import type { DashboardData, DashboardRange } from '@health/shared'
import { getJson, postJson } from './api'

export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
  sync(): Promise<{ lastCompletedAt: string; recordCount: number }>
  inspectGoogleFit(): Promise<{ start: string; end: string; data: Record<string, { points: number; latest: number | null; latestAt: string | null }> }>
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range: DashboardRange) => getJson<DashboardData>(`/.netlify/functions/dashboard-data?range=${range}`),
  sync: () => postJson<{ lastCompletedAt: string; recordCount: number }>('/.netlify/functions/sync-health'),
  inspectGoogleFit: () => postJson<{ start: string; end: string; data: Record<string, { points: number; latest: number | null; latestAt: string | null }> }>('/.netlify/functions/inspect-google-fit'),
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}
