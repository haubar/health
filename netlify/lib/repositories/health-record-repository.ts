import { healthRecordSchema, type HealthRecord } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

const RECORD_TYPES = ['steps', 'distance', 'active_minutes', 'exercise', 'weight', 'body_fat'] as const

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

export class HealthRecordRepository {
  private readonly documents: JsonRepository<HealthRecord>
  private readonly store

  constructor(store = createBlobStore('health-records')) {
    this.store = store
    this.documents = new JsonRepository(store, healthRecordSchema, 'strong')
  }

  set(record: HealthRecord): Promise<void> {
    const date = record.startTime.slice(0, 10)
    return this.documents.set(blobKeys.record(record.userId, record.type, date, record.id), record)
  }

  async setMany(records: HealthRecord[], concurrency = 25): Promise<void> {
    let nextIndex = 0
    const workers = Array.from({ length: Math.min(concurrency, records.length) }, async () => {
      while (nextIndex < records.length) {
        const index = nextIndex++
        await this.set(records[index]!)
      }
    })
    await Promise.all(workers)
  }

  async list(userId: string, start: Date, end: Date): Promise<HealthRecord[]> {
    const firstMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1))
    const lastIncluded = new Date(end.getTime() - 1)
    const lastMonth = new Date(Date.UTC(lastIncluded.getUTCFullYear(), lastIncluded.getUTCMonth(), 1))
    const months: string[] = []
    for (const month = firstMonth; month <= lastMonth; month.setUTCMonth(month.getUTCMonth() + 1)) {
      months.push(`${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`)
    }
    const prefixes = months.flatMap((month) => RECORD_TYPES.map((type) => blobKeys.recordMonthPrefix(userId, type, month)))
    const keyGroups = await mapConcurrent(prefixes, 12, (prefix) => this.store.list(prefix))
    const keys = keyGroups.flat()
    const records = await mapConcurrent(keys, 25, (key) => this.documents.get(key))
    return records.filter((record): record is HealthRecord => record !== null).filter((record) => {
      const time = Date.parse(record.startTime)
      return time >= start.getTime() && time < end.getTime()
    })
  }
}
