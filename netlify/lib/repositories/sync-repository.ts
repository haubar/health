import { syncStateSchema, type SyncState } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

export class SyncRepository {
  private readonly documents: JsonRepository<SyncState>

  constructor(store = createBlobStore('health-sync')) {
    this.documents = new JsonRepository(store, syncStateSchema, 'strong')
  }

  get(userId: string): Promise<SyncState | null> { return this.documents.get(blobKeys.syncState(userId)) }
  set(userId: string, state: SyncState): Promise<void> { return this.documents.set(blobKeys.syncState(userId), state) }
}
