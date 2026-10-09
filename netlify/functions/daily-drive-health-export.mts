import { schedule } from '@netlify/functions'
import { runDriveDailyExport } from '../lib/drive-daily-export'

// 11:50 UTC = 19:50 Asia/Taipei, ten minutes before ChatGPT reminder.
export const handler = schedule('50 11 * * *', async () => {
  await runDriveDailyExport()
  return { statusCode: 200, body: 'Drive health summary export completed.' }
})
