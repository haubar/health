import type { ApiResponse } from '@health/shared'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  const body = (await response.json()) as ApiResponse<T>

  if (!response.ok || !body.success) {
    const error = body.success
      ? { code: 'REQUEST_FAILED', message: '要求失敗，請稍後再試。' }
      : body.error
    throw new ApiError(error.code, error.message)
  }

  return body.data
}

export async function postJson<T>(path: string, data?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(data ?? {}),
  })
  const body = (await response.json()) as ApiResponse<T>

  if (!response.ok || !body.success) {
    const error = body.success
      ? { code: 'REQUEST_FAILED', message: '要求失敗，請稍後再試。' }
      : body.error
    throw new ApiError(error.code, error.message)
  }

  return body.data
}
