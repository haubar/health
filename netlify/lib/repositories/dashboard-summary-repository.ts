import { dailyHealthSummarySchema, type DailyHealthSummary } from '@health/shared'
import { z } from 'zod'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

const dashboardSummarySchema = z.object({
  summary: dailyHealthSummarySchema,
  lastUpdatedAt: z.iso.datetime().nullable(),
  hasRecords: z.boolean(),
  synced: z.boolean().optional(),
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>

async function mapConcurrent<T, R>(items: T[], concurrency: number, callback: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await callback(items[index]!)
    }
  })
  await Promise.all(workers)
  return results
}

export class DashboardSummaryRepository {
  private readonly documents = new JsonRepository(createBlobStore('health-records'), dashboardSummarySchema, 'strong')

  get(userId: string, date: string): Promise<DashboardSummary | null> {
    return this.documents.get(blobKeys.daily(userId, date))
  }

  set(userId: string, date: string, value: DashboardSummary): Promise<void> {
    return this.documents.set(blobKeys.daily(userId, date), value)
  }

  getMany(userId: string, dates: string[]): Promise<Array<DashboardSummary | null>> {
    return mapConcurrent(dates, 96, (date) => this.get(userId, date))
  }

  setMany(userId: string, entries: Array<{ date: string; value: DashboardSummary }>): Promise<void[]> {
    return mapConcurrent(entries, 96, ({ date, value }) => this.set(userId, date, value))
  }
}

export function emptyDashboardSummary(date: string): DailyHealthSummary {
  return {
    date,
    steps: null,
    distanceKm: null,
    activeMinutes: null,
    exerciseMinutes: null,
    activeCalories: null,
    totalCalories: null,
    weightKg: null,
    bodyFatPercentage: null,
  }
}
