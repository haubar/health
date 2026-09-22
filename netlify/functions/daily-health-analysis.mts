import { schedule } from '@netlify/functions'
import { runDailyHealthAnalysis } from './lib/scheduled-health'

export const handler = schedule('0 6,18 * * *', async () => {
  await runDailyHealthAnalysis()
  return { statusCode: 200, body: 'Daily health analysis completed.' }
})
