import { schedule } from '@netlify/functions'
import { runWeeklyHealthSummary } from './lib/scheduled-health'

export const handler = schedule('0 19 * * 0', async () => {
  await runWeeklyHealthSummary()
  return { statusCode: 200, body: 'Weekly health summary completed.' }
})
