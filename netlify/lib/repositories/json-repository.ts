import type { z } from 'zod'
import type { JsonBlobStore, ReadConsistency } from '../blobs'

export class CorruptBlobError extends Error {
  constructor(key: string) {
    super(`Stored document failed validation: ${key}`)
    this.name = 'CorruptBlobError'
  }
}

export class JsonRepository<T> {
  constructor(
    private readonly store: JsonBlobStore,
    private readonly schema: z.ZodType<T>,
    private readonly consistency: ReadConsistency,
  ) {}

  async get(key: string): Promise<T | null> {
    const value = await this.store.getJson(key, this.consistency)
    if (value === null) return null
    const result = this.schema.safeParse(value)
    if (!result.success) throw new CorruptBlobError(key)
    return result.data
  }

  async set(key: string, value: T): Promise<void> {
    await this.store.setJson(key, this.schema.parse(value))
  }

  async delete(key: string): Promise<void> {
    await this.store.delete(key)
  }
}

