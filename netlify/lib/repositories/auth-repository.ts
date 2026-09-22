import { googleHealthConnectionSchema, type GoogleHealthConnection } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

export class AuthRepository {
  private readonly documents: JsonRepository<GoogleHealthConnection>
  private readonly store

  constructor(store = createBlobStore('health-auth')) {
    this.store = store
    this.documents = new JsonRepository(store, googleHealthConnectionSchema, 'strong')
  }

  async listConnectedUserIds(): Promise<string[]> {
    const keys = await this.store.list('users/')
    const userIds = [...new Set(keys.flatMap((key) => {
      const match = /^users\/([A-Za-z0-9_-]+)\/google-health\.json$/.exec(key)
      return match ? [match[1]!] : []
    }))]
    const connections = await Promise.all(userIds.map(async (userId) => ({ userId, connection: await this.get(userId) })))
    return connections.filter(({ connection }) => connection?.status === 'connected').map(({ userId }) => userId)
  }

  get(userId: string): Promise<GoogleHealthConnection | null> {
    return this.documents.get(blobKeys.auth(userId))
  }

  set(userId: string, connection: GoogleHealthConnection): Promise<void> {
    return this.documents.set(blobKeys.auth(userId), connection)
  }
}
