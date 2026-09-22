import { scheduledSyncStateSchema, type ScheduledSyncState } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

export class ScheduledSyncRepository {
  private readonly documents: JsonRepository<ScheduledSyncState>

  constructor(store = createBlobStore('health-sync')) {
    this.documents = new JsonRepository(store, scheduledSyncStateSchema, 'strong')
  }

  get(userId: string): Promise<ScheduledSyncState | null> {
    return this.documents.get(blobKeys.scheduledSyncState(userId))
  }

  set(userId: string, state: ScheduledSyncState): Promise<void> {
    return this.documents.set(blobKeys.scheduledSyncState(userId), state)
  }
}
