import type { Handler, HandlerContext, HandlerEvent, HandlerResponse } from '@netlify/functions'

type FetchHandler = (request: Request) => Response | Promise<Response>

function requestFromEvent(event: HandlerEvent): Request {
  const headers = new Headers()
  for (const [name, value] of Object.entries(event.headers)) {
    if (value !== undefined) headers.set(name, value)
  }

  const body = event.body === null
    ? undefined
    : event.isBase64Encoded
      ? Buffer.from(event.body, 'base64')
      : event.body

  const init: RequestInit = {
    method: event.httpMethod,
    headers,
  }
  if (body !== undefined && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') init.body = body
  return new Request(event.rawUrl, init)
}

async function responseToHandlerResponse(response: Response): Promise<HandlerResponse> {
  const headers: Record<string, string> = {}
  for (const [name, value] of response.headers.entries()) headers[name] = value

  const getSetCookie = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie
  const setCookies = getSetCookie?.call(response.headers)
  if (setCookies?.length) {
    delete headers['set-cookie']
    return {
      statusCode: response.status,
      headers,
      multiValueHeaders: { 'set-cookie': setCookies },
      body: await response.text(),
    }
  }

  return {
    statusCode: response.status,
    headers,
    body: await response.text(),
  }
}

export function createNetlifyHandler(fetchHandler: FetchHandler): Handler {
  return async (event: HandlerEvent, _context: HandlerContext) =>
    responseToHandlerResponse(await fetchHandler(requestFromEvent(event)))
}
