import type { DateRange, HealthProvider, HealthRecord, HealthRecordType } from '@health/shared'
import { OAuth2Client } from 'google-auth-library'

export const GOOGLE_HEALTH_SCOPES = {
  activity: 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly',
  measurements: 'https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly',
} as const
export const GOOGLE_HEALTH_SCOPE_LIST = Object.values(GOOGLE_HEALTH_SCOPES)
export const GOOGLE_HEALTH_API_BASE = 'https://health.googleapis.com/v4'

type Interval = { startTime?: string; endTime?: string }
type HealthDataPoint = {
  name?: string; dataSource?: { application?: { name?: string } }
  steps?: { interval?: Interval; count?: string }
  distance?: { interval?: Interval; millimeters?: string }
  activeMinutes?: { interval?: Interval; activeMinutesByActivityLevel?: Array<{ activeMinutes?: string }> }
  exercise?: { interval?: Interval; exerciseType?: string; activeDuration?: string; metricsSummary?: { caloriesKcal?: number; distanceMillimeters?: number; steps?: string } }
  weight?: { sampleTime?: { physicalTime?: string }; weightGrams?: number }
  bodyFat?: { sampleTime?: { physicalTime?: string }; percentage?: number }
}
type ListResponse = { dataPoints?: HealthDataPoint[]; nextPageToken?: string }
type DataType = { path: string; recordType: HealthRecordType; resolution: 'daily_rollup' | 'sample' | 'session'; value: (point: HealthDataPoint) => number | undefined; times: (point: HealthDataPoint) => { start: string; end?: string } | null; unit?: string; metadata?: (point: HealthDataPoint) => Record<string, unknown> | undefined }

const DATA_TYPES: DataType[] = [
  { path: 'steps', recordType: 'steps', resolution: 'daily_rollup', value: (p) => numberValue(p.steps?.count), times: (p) => interval(p.steps?.interval), unit: 'count' },
  { path: 'distance', recordType: 'distance', resolution: 'daily_rollup', value: (p) => numberValue(p.distance?.millimeters, 1000), times: (p) => interval(p.distance?.interval), unit: 'm' },
  { path: 'active-minutes', recordType: 'active_minutes', resolution: 'daily_rollup', value: (p) => sumActiveMinutes(p.activeMinutes?.activeMinutesByActivityLevel), times: (p) => interval(p.activeMinutes?.interval), unit: 'minutes' },
  { path: 'exercise', recordType: 'exercise', resolution: 'session', value: () => undefined, times: (p) => interval(p.exercise?.interval), unit: 'session', metadata: (p) => p.exercise ? { exerciseType: p.exercise.exerciseType, activeDuration: p.exercise.activeDuration, caloriesKcal: p.exercise.metricsSummary?.caloriesKcal, distanceMeters: p.exercise.metricsSummary?.distanceMillimeters === undefined ? undefined : p.exercise.metricsSummary.distanceMillimeters / 1000 } : undefined },
  { path: 'weight', recordType: 'weight', resolution: 'sample', value: (p) => numberValue(p.weight?.weightGrams, 1000), times: (p) => sample(p.weight?.sampleTime?.physicalTime), unit: 'kg' },
  { path: 'body-fat', recordType: 'body_fat', resolution: 'sample', value: (p) => p.bodyFat?.percentage, times: (p) => sample(p.bodyFat?.sampleTime?.physicalTime), unit: '%' },
]

function numberValue(value: string | number | undefined, divisor = 1): number | undefined { if (value === undefined) return undefined; const parsed = Number(value) / divisor; return Number.isFinite(parsed) ? parsed : undefined }
function sumActiveMinutes(values: Array<{ activeMinutes?: string }> | undefined): number | undefined { if (!values) return undefined; const total = values.reduce((sum, item) => sum + (numberValue(item.activeMinutes) ?? 0), 0); return Number.isFinite(total) ? total : undefined }
function interval(value: Interval | undefined): { start: string; end?: string } | null { return value?.startTime ? { start: value.startTime, ...(value.endTime ? { end: value.endTime } : {}) } : null }
function sample(value: string | undefined): { start: string } | null { return value ? { start: value } : null }
function filterFor(type: string, range: DateRange): string { const start = range.start.toISOString(); const end = range.end.toISOString(); const dataType = type.replaceAll('-', '_'); const field = type === 'weight' ? 'weight.sample_time.physical_time' : type === 'body-fat' ? 'body_fat.sample_time.physical_time' : type === 'exercise' ? 'exercise.interval.civil_start_time' : `${dataType}.interval.start_time`; const lower = type === 'exercise' ? range.start.toISOString().replace(/Z$/, '') : start; const upper = type === 'exercise' ? range.end.toISOString().replace(/Z$/, '') : end; return `${field} >= "${lower}" AND ${field} < "${upper}"` }
function normalizedId(name: string | undefined, fallback: string): string { const candidate = name?.split('/').pop(); return candidate && /^[a-z0-9-]{4,63}$/.test(candidate) ? candidate : fallback }

export class GoogleHealthApiError extends Error { constructor(public readonly status: number, public readonly reason: string) { super(`Google Health API request failed: ${status}${reason ? `: ${reason}` : ''}`) } }

export class GoogleHealthProvider implements HealthProvider {
  private readonly oauthClient: OAuth2Client
  constructor(private readonly userId: string, refreshToken: string, clientId: string, clientSecret: string) { this.oauthClient = new OAuth2Client(clientId, clientSecret); this.oauthClient.setCredentials({ refresh_token: refreshToken }) }
  getSteps(range: DateRange): Promise<HealthRecord[]> { return this.getType('steps', range) }
  getWeight(range: DateRange): Promise<HealthRecord[]> { return this.getType('weight', range) }
  getBodyFat(range: DateRange): Promise<HealthRecord[]> { return this.getType('body-fat', range) }
  getWorkouts(range: DateRange): Promise<HealthRecord[]> { return this.getType('exercise', range) }
  async getActivity(range: DateRange): Promise<HealthRecord[]> { return (await Promise.all(['steps', 'distance', 'active-minutes'].map((type) => this.getType(type, range)))).flat() }
  private async getType(path: string, range: DateRange): Promise<HealthRecord[]> {
    const definition = DATA_TYPES.find((item) => item.path === path); if (!definition) throw new Error(`Unsupported Google Health data type: ${path}`)
    const auth = await this.oauthClient.getAccessToken(); if (!auth.token) throw new Error('Google Health access token unavailable')
    const output: HealthRecord[] = []; let pageToken: string | undefined
    do {
      // The OpenID Connect subject is our internal owner key, not a Google Health user ID.
      // `users/me` lets Google resolve the Health identity from the access token.
      const url = new URL(`${GOOGLE_HEALTH_API_BASE}/users/me/dataTypes/${path}/dataPoints`); url.searchParams.set('filter', filterFor(path, range)); if (pageToken) url.searchParams.set('pageToken', pageToken)
      const response = await fetch(url, { headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' } }); if (!response.ok) { const errorBody = await response.text(); throw new GoogleHealthApiError(response.status, errorBody.slice(0, 500) || response.statusText) }
      const body = (await response.json()) as ListResponse
      for (const [index, point] of (body.dataPoints ?? []).entries()) { const times = definition.times(point); if (!times) continue; const value = definition.value(point); const metadata = definition.metadata?.(point); output.push({ id: normalizedId(point.name, `${path}-${times.start}-${index}`), userId: this.userId, provider: 'google_health', sourceRecordId: point.name ?? `${path}-${times.start}-${index}`, sourceApp: point.dataSource?.application?.name, type: definition.recordType, startTime: new Date(times.start).toISOString(), ...(times.end ? { endTime: new Date(times.end).toISOString() } : {}), ...(value === undefined ? {} : { value }), ...(definition.unit ? { unit: definition.unit } : {}), resolution: definition.resolution, ...(metadata ? { metadata: removeUndefined(metadata) } : {}) }) }
      pageToken = body.nextPageToken
    } while (pageToken)
    return output
  }
}
function removeUndefined(value: Record<string, unknown>): Record<string, unknown> { return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) }
