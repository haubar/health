import type { ApiFailure, ApiSuccess } from '@health/shared'

const jsonHeaders = {
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
}

export function jsonSuccess<T>(data: T, init: ResponseInit = {}): Response {
  const body: ApiSuccess<T> = { success: true, data }
  return Response.json(body, { ...init, headers: { ...jsonHeaders, ...init.headers } })
}

export function jsonFailure(
  status: number,
  code: string,
  message: string,
  init: ResponseInit = {},
): Response {
  const body: ApiFailure = { success: false, error: { code, message } }
  return Response.json(body, {
    ...init,
    status,
    headers: { ...jsonHeaders, ...init.headers },
  })
}

export function safeRedirect(path: string, init: ResponseInit = {}): Response {
  return new Response(null, { ...init, status: 302, headers: { Location: path, ...init.headers } })
}

