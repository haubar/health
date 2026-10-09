import { schedule } from '@netlify/functions'
import { assessDailyProgress } from '../lib/daily-progress'
import { healthDate, shiftHealthDate } from '../lib/health-day'
import { AuthRepository } from '../lib/repositories/auth-repository'
import { DashboardSummaryRepository } from '../lib/repositories/dashboard-summary-repository'
import { SettingsRepository } from '../lib/repositories/settings-repository'
import { createBlobStore } from '../lib/blobs'

/**
 * Runs at 20:00 Asia/Taipei (12:00 UTC).
 * Email is disabled until RESEND_API_KEY and HEALTH_EMAIL_FROM are configured.
 * Only the explicitly configured site owner receives the report.
 */
export const handler = schedule('0 12 * * *', async () => {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.HEALTH_EMAIL_FROM
  const recipient = process.env.OWNER_GOOGLE_EMAIL
  if (!apiKey || !from || !recipient) {
    console.warn('Daily health email skipped: mail configuration missing')
    return { statusCode: 200, body: 'Email not configured' }
  }

  const connected = await new AuthRepository().listConnectedUserIds()
  // Do not risk emailing another user's private health data to the owner.
  if (connected.length !== 1) {
    console.warn('Daily health email skipped: expected exactly one connected account')
    return { statusCode: 200, body: 'Account count mismatch' }
  }

  const date = healthDate(new Date())
  const deliveryStore = createBlobStore('health-email-delivery')
  const deliveryKey = `daily/${date}.json`
  if (await deliveryStore.getJson(deliveryKey, 'strong')) {
    return { statusCode: 200, body: 'Already sent' }
  }

  const dates = Array.from({ length: 7 }, (_, i) => shiftHealthDate(date, i - 6))
  const [documents, settings] = await Promise.all([
    new DashboardSummaryRepository().getMany(connected[0]!, dates),
    new SettingsRepository().get(connected[0]!),
  ])
  const days = dates.map((day, index) => ({
    date: day,
    steps: documents[index]?.summary.steps ?? null,
    weightKg: documents[index]?.summary.weightKg ?? null,
    activeMinutes: documents[index]?.summary.activeMinutes ?? null,
    exerciseMinutes: documents[index]?.summary.exerciseMinutes ?? null,
  }))
  const result = assessDailyProgress(days, settings?.dailyStepGoal ?? 8000, settings?.weightGoalKg ?? null)
  const stepsText = result.steps === null
    ? '步數尚無資料'
    : `今日步數：${result.steps.toLocaleString('zh-TW')} / ${result.stepGoal.toLocaleString('zh-TW')} 步（${result.completionRate}%），還差 ${result.stepsRemaining} 步`
  const weightText = result.latestWeightKg === null
    ? '近期體重尚無資料'
    : `最近體重：${result.latestWeightKg} 公斤（${result.latestWeightDate}）${result.remainingWeightKg === null ? '' : `，距離目標還差 ${result.remainingWeightKg} 公斤`}`
  const body = [`${date} 健康進度報告`, stepsText, weightText, '', '查看健康儀表板：https://health-view.netlify.app/'].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `health-daily-${date}`,
    },
    body: JSON.stringify({
      from,
      to: [recipient],
      subject: `健康進度報告｜${date}`,
      text: body,
    }),
  })
  if (!response.ok) {
    console.error('Daily health email delivery failed', { status: response.status })
    return { statusCode: 502, body: 'Email delivery failed' }
  }
  await deliveryStore.setJson(deliveryKey, { sentAt: new Date().toISOString() })
  return { statusCode: 200, body: 'Email sent' }
})
