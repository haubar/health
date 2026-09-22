import type { DashboardData, GoalSettings, HealthAnalysisData } from '@health/shared'
import { getJson, postJson, putJson } from './api'

export interface HealthDataClient {
  getDashboard(range: '30D' | '90D' | '1Y' | 'month', month?: string): Promise<DashboardData>
  getAnalysis(): Promise<HealthAnalysisData>
  getSettings(): Promise<GoalSettings>
  saveSettings(settings: Pick<GoalSettings, 'dailyStepGoal' | 'weeklyExerciseMinutesGoal' | 'weightGoalKg'>): Promise<GoalSettings>
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
let analysisCache: { data: HealthAnalysisData; expiresAt: number } | null = null
let analysisRequest: Promise<HealthAnalysisData> | null = null

function loadDashboard(key: string, query: string): Promise<DashboardData> {
  const cached = dashboardCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data)
  const pending = dashboardRequests.get(key)
  if (pending) return pending

  const request = getJson<DashboardData>(`/.netlify/functions/dashboard-data?${query}`)
    .then((data) => {
      dashboardCache.set(key, { data, expiresAt: Date.now() + DASHBOARD_CACHE_MS })
      return data
    })
    .finally(() => dashboardRequests.delete(key))
  dashboardRequests.set(key, request)
  return request
}

async function loadDashboardPeriod(range: '30D' | '90D' | '1Y' | 'month', month?: string): Promise<DashboardData> {
  if (range === 'month') {
    if (!month) throw new Error('月份不可為空。')
    return loadDashboard(`month:${month}`, `month=${month}`)
  }
  if (range === '30D') return loadDashboard('range:30D', 'range=30D')

  // Keep each Netlify invocation bounded to one calendar month. Two concurrent
  // requests shorten the overall wait without issuing a large backend query.
  const now = new Date()
  const endMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const startMonth = new Date(Date.UTC(now.getFullYear() - (range === '1Y' ? 1 : 0), now.getMonth() - (range === '1Y' ? 0 : 3), 1))
  const months: string[] = []
  for (const cursor = new Date(startMonth); cursor <= endMonth; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  const results: DashboardData[] = []
  for (let index = 0; index < months.length; index += 2) {
    results.push(...await Promise.all(months.slice(index, index + 2).map((value) =>
      loadDashboard(`month:${value}`, `month=${value}`),
    )))
  }
  const cutoff = new Date(now)
  cutoff.setDate(cutoff.getDate() - (range === '90D' ? 89 : 364))
  const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const summaries = results.flatMap((result) => result.summaries)
    .filter((summary) => summary.date >= cutoffDate && summary.date <= today)
    .sort((left, right) => left.date.localeCompare(right.date))
  const timestamps = results.map((result) => result.lastUpdatedAt).filter((value): value is string => value !== null)
  return {
    availability: summaries.length ? 'ready' : 'empty',
    lastUpdatedAt: timestamps.length ? timestamps.sort()[timestamps.length - 1]! : null,
    summaries,
  }
}

function clearDashboardCache(): void {
  dashboardCache.clear()
  analysisCache = null
}

export const healthDataClient: HealthDataClient = {
  getDashboard: (range, month) => loadDashboardPeriod(range, month),
  getAnalysis() {
    if (analysisCache && analysisCache.expiresAt > Date.now()) return Promise.resolve(analysisCache.data)
    if (analysisRequest) return analysisRequest
    analysisRequest = getJson<HealthAnalysisData>('/.netlify/functions/health-analysis')
      .then((data) => {
        analysisCache = { data, expiresAt: Date.now() + DASHBOARD_CACHE_MS }
        return data
      })
      .finally(() => { analysisRequest = null })
    return analysisRequest
  },
  getSettings: () => getJson<GoalSettings>('/.netlify/functions/health-settings'),
  async saveSettings(settings) {
    const saved = await putJson<GoalSettings>('/.netlify/functions/health-settings', settings)
    analysisCache = null
    return saved
  },
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
