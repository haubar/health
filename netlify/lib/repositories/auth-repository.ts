import { googleHealthConnectionSchema, type GoogleHealthConnection } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

export class AuthRepository {
  private readonly documents: JsonRepository<GoogleHealthConnection>

  constructor(store = createBlobStore('health-auth')) {
    this.documents = new JsonRepository(store, googleHealthConnectionSchema, 'strong')
  }

  get(userId: string): Promise<GoogleHealthConnection | null> {
    return this.documents.get(blobKeys.auth(userId))
  }

  set(userId: string, connection: GoogleHealthConnection): Promise<void> {
    return this.documents.set(blobKeys.auth(userId), connection)
  }
}
