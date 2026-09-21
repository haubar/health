import { OAuth2Client } from 'google-auth-library'

const GOOGLE_FIT_API_BASE = 'https://www.googleapis.com/fitness/v1/users/me'
const DAY_MS = 24 * 60 * 60 * 1000

const DATA_TYPES = {
  activity: 'com.google.step_count.delta',
  distance: 'com.google.distance.delta',
  weight: 'com.google.weight',
  bodyFat: 'com.google.body.fat',
} as const

type FitPoint = { value?: Array<{ fpVal?: number; intVal?: number }> }
type FitDataset = { point?: FitPoint[] }
type FitBucket = { startTimeMillis?: string; dataset?: FitDataset[] }
type AggregateResponse = { bucket?: FitBucket[] }

export type GoogleFitCheck = {
  points: number
  latest: number | null
  latestAt: string | null
}

export class GoogleFitApiError extends Error {
  constructor(public readonly status: number, public readonly reason: string) {
    super(`Google Fit API request failed: ${status}${reason ? `: ${reason}` : ''}`)
  }
}

export class GoogleFitProvider {
  private readonly oauthClient: OAuth2Client

  constructor(refreshToken: string, clientId: string, clientSecret: string) {
    this.oauthClient = new OAuth2Client(clientId, clientSecret)
    this.oauthClient.setCredentials({ refresh_token: refreshToken })
  }

  async inspect(range: { start: Date; end: Date }): Promise<Record<keyof typeof DATA_TYPES, GoogleFitCheck>> {
    const entries = await Promise.all(Object.entries(DATA_TYPES).map(async ([key, dataTypeName]) => [key, await this.aggregate(dataTypeName, range)] as const))
    return Object.fromEntries(entries) as Record<keyof typeof DATA_TYPES, GoogleFitCheck>
  }

  private async aggregate(dataTypeName: string, range: { start: Date; end: Date }): Promise<GoogleFitCheck> {
    const auth = await this.oauthClient.getAccessToken()
    if (!auth.token) throw new Error('Google Fit access token unavailable')
    const response = await fetch(`${GOOGLE_FIT_API_BASE}/dataset:aggregate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        aggregateBy: [{ dataTypeName }],
        bucketByTime: { durationMillis: DAY_MS },
        startTimeMillis: String(range.start.getTime()),
        endTimeMillis: String(range.end.getTime()),
      }),
    })
    if (!response.ok) {
      const errorBody = await response.text()
      throw new GoogleFitApiError(response.status, errorBody.slice(0, 500) || response.statusText)
    }
    const body = (await response.json()) as AggregateResponse
    const points = (body.bucket ?? []).flatMap((bucket) => bucket.dataset ?? []).flatMap((dataset) => dataset.point ?? [])
    const values = points.flatMap((point) => point.value ?? []).map((value) => value.fpVal ?? value.intVal).filter((value): value is number => value !== undefined && Number.isFinite(value))
    const latestAt = (body.bucket ?? []).reduce<string | null>((latest, bucket) => bucket.startTimeMillis && (!latest || Number(bucket.startTimeMillis) > Date.parse(latest)) ? new Date(Number(bucket.startTimeMillis)).toISOString() : latest, null)
    return { points: points.length, latest: values.at(-1) ?? null, latestAt }
  }
}
