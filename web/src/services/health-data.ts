import type { DashboardData } from '@health/shared'

/** Phase 4 will connect this port to protected Functions. It intentionally has no fixture fallback. */
export interface HealthDataClient {
  getDashboard(range: string): Promise<DashboardData>
}

export const emptyDashboardData: DashboardData = {
  availability: 'empty',
  lastUpdatedAt: null,
  summaries: [],
}

