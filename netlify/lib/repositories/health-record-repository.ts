import { healthRecordSchema, type HealthRecord } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

export class HealthRecordRepository {
  private readonly documents: JsonRepository<HealthRecord>

  constructor(store = createBlobStore('health-records')) {
    this.documents = new JsonRepository(store, healthRecordSchema, 'strong')
  }

  set(record: HealthRecord): Promise<void> {
    const date = record.startTime.slice(0, 10)
    return this.documents.set(blobKeys.record(record.userId, record.type, date, record.id), record)
  }
}
