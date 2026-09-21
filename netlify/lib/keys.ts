import type { HealthRecordType } from '@health/shared'

const segmentPattern = /^[A-Za-z0-9_-]+$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const monthPattern = /^\d{4}-\d{2}$/

function segment(value: string, label: string): string {
  if (!segmentPattern.test(value)) throw new Error(`Invalid ${label}`)
  return value
}

function dateParts(date: string): { year: string; month: string } {
  if (!datePattern.test(date)) throw new Error('Invalid calendar date')
  const [year, month] = date.split('-')
  return { year: year!, month: month! }
}

export const blobKeys = {
  profile: (userId: string) => `users/${segment(userId, 'userId')}/profile.json`,
  auth: (userId: string) => `users/${segment(userId, 'userId')}/google-health.json`,
  settings: (userId: string) => `users/${segment(userId, 'userId')}/goals.json`,
  syncState: (userId: string) => `users/${segment(userId, 'userId')}/state/google-health.json`,
  daily: (userId: string, date: string) => {
    const { year, month } = dateParts(date)
    return `users/${segment(userId, 'userId')}/daily/${year}/${month}/${date}.json`
  },
  dailyMonthPrefix: (userId: string, month: string) => {
    if (!monthPattern.test(month)) throw new Error('Invalid calendar month')
    const [year, monthNumber] = month.split('-')
    return `users/${segment(userId, 'userId')}/daily/${year}/${monthNumber}/`
  },
  record: (
    userId: string,
    dataType: HealthRecordType,
    date: string,
    recordId: string,
  ) => {
    const { year, month } = dateParts(date)
    return `users/${segment(userId, 'userId')}/records/${dataType}/${year}/${month}/${segment(recordId, 'recordId')}.json`
  },
}

