import { z } from 'zod'
import { describe, expect, it } from 'vitest'
import type { JsonBlobStore, ReadConsistency } from '../blobs'
import { CorruptBlobError, JsonRepository } from './json-repository'

class MemoryStore implements JsonBlobStore {
  readonly values = new Map<string, unknown>()
  readonly reads: Array<{ key: string; consistency: ReadConsistency }> = []

  async getJson(key: string, consistency: ReadConsistency): Promise<unknown | null> {
    this.reads.push({ key, consistency })
    return this.values.get(key) ?? null
  }

  async setJson(key: string, value: unknown): Promise<void> {
    this.values.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key)
  }

  async list(prefix: string): Promise<string[]> {
    return [...this.values.keys()].filter((key) => key.startsWith(prefix))
  }
}

const documentSchema = z.object({ value: z.number() })

describe('JsonRepository', () => {
  it('uses the configured read consistency', async () => {
    const store = new MemoryStore()
    const repository = new JsonRepository(store, documentSchema, 'strong')
    await repository.get('settings')
    expect(store.reads).toEqual([{ key: 'settings', consistency: 'strong' }])
  })

  it('overwrites the same key idempotently', async () => {
    const store = new MemoryStore()
    const repository = new JsonRepository(store, documentSchema, 'eventual')
    await repository.set('daily/2026-09-21', { value: 1 })
    await repository.set('daily/2026-09-21', { value: 2 })
    expect(store.values.size).toBe(1)
    expect(await repository.get('daily/2026-09-21')).toEqual({ value: 2 })
  })

  it('returns null for a missing blob', async () => {
    const repository = new JsonRepository(new MemoryStore(), documentSchema, 'eventual')
    await expect(repository.get('missing')).resolves.toBeNull()
  })

  it('rejects corrupted JSON documents', async () => {
    const store = new MemoryStore()
    store.values.set('broken', { value: 'not-a-number' })
    const repository = new JsonRepository(store, documentSchema, 'eventual')
    await expect(repository.get('broken')).rejects.toBeInstanceOf(CorruptBlobError)
  })
})

