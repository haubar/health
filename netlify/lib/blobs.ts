import { getStore } from '@netlify/blobs'
import { z } from 'zod'

const regionSchema = z.literal('ap-southeast-1')

export type ReadConsistency = 'strong' | 'eventual'

export interface JsonBlobStore {
  getJson(key: string, consistency: ReadConsistency): Promise<unknown | null>
  setJson(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
  list(prefix: string): Promise<string[]>
}

export function createBlobStore(name: string): JsonBlobStore {
  const region = regionSchema.parse(process.env.NETLIFY_BLOBS_REGION ?? 'ap-southeast-1')
  const siteID = process.env.NETLIFY_SITE_ID ?? process.env.SITE_ID
  const token = process.env.NETLIFY_AUTH_TOKEN
  if (!siteID || !token) throw new Error('Netlify Blobs requires NETLIFY_SITE_ID and NETLIFY_AUTH_TOKEN')
  const store = getStore({ name, region, siteID, token })

  return {
    getJson: (key, consistency) => store.get(key, { type: 'json', consistency }),
    setJson: async (key, value) => {
      await store.setJSON(key, value)
    },
    delete: async (key) => {
      await store.delete(key)
    },
    list: async (prefix) => {
      const result = await store.list({ prefix })
      return result.blobs.map((blob) => blob.key)
    },
  }
}
