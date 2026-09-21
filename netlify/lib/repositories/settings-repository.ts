import { goalSettingsSchema, type GoalSettings } from '@health/shared'
import { createBlobStore } from '../blobs'
import { blobKeys } from '../keys'
import { JsonRepository } from './json-repository'

export class SettingsRepository {
  private readonly documents: JsonRepository<GoalSettings>

  constructor(store = createBlobStore('health-settings')) {
    this.documents = new JsonRepository(store, goalSettingsSchema, 'strong')
  }

  get(userId: string): Promise<GoalSettings | null> {
    return this.documents.get(blobKeys.settings(userId))
  }

  set(userId: string, settings: GoalSettings): Promise<void> {
    return this.documents.set(blobKeys.settings(userId), settings)
  }
}

