import type { DashboardData, DashboardRange, SyncState } from '@health/shared'
import { getJson, postAccepted } from './api'

export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
  sync(): Promise<void>
  getSyncStatus(): Promise<{ state: SyncState | null }>
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range: DashboardRange) => getJson<DashboardData>(`/.netlify/functions/dashboard-data?range=${range}`),
  sync: () => postAccepted('/.netlify/functions/sync-health'),
  getSyncStatus: () => getJson<{ state: SyncState | null }>('/.netlify/functions/sync-status'),
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}
