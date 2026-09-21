import type { DashboardData, DashboardRange } from '@health/shared'
import { getJson } from './api'

export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range: DashboardRange) => getJson<DashboardData>(`/.netlify/functions/dashboard-data?range=${range}`),
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}
