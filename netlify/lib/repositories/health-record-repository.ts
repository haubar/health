import { healthRecordSchema, type HealthRecord } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

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

  async list(userId: string, start: Date, end: Date): Promise<HealthRecord[]> {
    const keys = await this.store.list(`users/${userId}/records/`)
    const records = await Promise.all(keys.map((key: string) => this.documents.get(key)))
    return records.filter((record): record is HealthRecord => record !== null).filter((record) => {
      const time = Date.parse(record.startTime)
      return time >= start.getTime() && time < end.getTime()
    })
  }
}
