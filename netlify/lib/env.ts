import { z } from 'zod'

const serverEnvironmentSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_REDIRECT_URI: z.url(),
  OWNER_GOOGLE_EMAIL: z.email(),
  SESSION_SECRET: z.string().min(32),
  HEALTH_TOKEN_ENCRYPTION_KEY: z.string().min(43),
  NETLIFY_BLOBS_REGION: z.literal('ap-southeast-1').default('ap-southeast-1'),
})

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>

let cachedEnvironment: ServerEnvironment | undefined

export function getServerEnvironment(): ServerEnvironment {
  cachedEnvironment ??= serverEnvironmentSchema.parse(process.env)
  return cachedEnvironment
}
