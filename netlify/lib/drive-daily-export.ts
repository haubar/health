import { OAuth2Client } from 'google-auth-library'
import { assessDailyProgress } from './daily-progress'
import { getServerEnvironment } from './env'
import { healthDate, shiftHealthDate } from './health-day'
import { AuthRepository } from './repositories/auth-repository'
import { DashboardSummaryRepository } from './repositories/dashboard-summary-repository'
import { SettingsRepository } from './repositories/settings-repository'

const FOLDER_ID = '1T-ipFKStBr5pNBNXS4DB8w_JI8MED7IB'
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files'

export function reportFilename(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid health date')
  return `health-${date}.json`
}

export async function runDriveDailyExport(): Promise<void> {
  const env = getServerEnvironment()
  const refreshToken = process.env.DRIVE_REFRESH_TOKEN
  if (!refreshToken) {
    console.warn('Drive daily export skipped: DRIVE_REFRESH_TOKEN not configured')
    return
  }
  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET)
  client.setCredentials({ refresh_token: refreshToken })
  const access = await client.getAccessToken()
  if (!access.token) throw new Error('Drive access token unavailable')
  const headers = { Authorization: `Bearer ${access.token}` }
  const users = await new AuthRepository().listConnectedUserIds()
  // Single-owner dashboard: fail closed if multiple identities are present.
  if (users.length !== 1) throw new Error('Expected exactly one connected health owner')
  const userId = users[0]!
  const today = healthDate(new Date())
  const dates = Array.from({ length: 7 }, (_, i) => shiftHealthDate(today, i - 6))
  const [documents, settings] = await Promise.all([
    new DashboardSummaryRepository().getMany(userId, dates),
    new SettingsRepository().get(userId),
  ])
  const days = dates.map((date, i) => ({
    date,
    steps: documents[i]?.summary.steps ?? null,
    weightKg: documents[i]?.summary.weightKg ?? null,
    activeMinutes: documents[i]?.summary.activeMinutes ?? null,
    exerciseMinutes: documents[i]?.summary.exerciseMinutes ?? null,
  }))
  const report = {
    schemaVersion: 1,
    date: today,
    timezone: 'Asia/Taipei',
    generatedAt: new Date().toISOString(),
    source: 'health-view.netlify.app',
    latestHealthRecordAt: documents[6]?.lastUpdatedAt ?? null,
    synced: documents[6]?.synced ?? false,
    assessment: assessDailyProgress(days, settings?.dailyStepGoal ?? 8000, settings?.weightGoalKg ?? null),
  }
  const filename = reportFilename(today)
  const q = `name = '${filename}' and '${FOLDER_ID}' in parents and trashed = false`
  const lookup = await fetch(`${DRIVE_API}?q=${encodeURIComponent(q)}&fields=files(id,name),nextPageToken&page_size=10`, { headers })
  if (!lookup.ok) throw new Error(`Drive lookup failed: ${lookup.status}`)
  const result = await lookup.json() as { files?: Array<{ id: string }> }
  const fileId = result.files?.[0]?.id
  const metadata = { name: filename, mimeType: 'application/json', parents: [FOLDER_ID] }
  const boundary = 'health-report-boundary'
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fileId ? {} : metadata)}\r\n--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(report)}\r\n--${boundary}--`
  const endpoint = fileId ? `${UPLOAD_API}/${encodeURIComponent(fileId)}?uploadType=multipart&fields=id` : `${UPLOAD_API}?uploadType=multipart&fields=id`
  const upload = await fetch(endpoint, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!upload.ok) throw new Error(`Drive upload failed: ${upload.status}`)
  console.log('Drive health summary exported', { date: today, synced: report.synced, hasSteps: report.assessment.steps !== null })
}
