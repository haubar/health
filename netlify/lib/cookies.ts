type CookieOptions = {
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: 'Lax' | 'Strict'
  secure?: boolean
}

export function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (rawName === name) return decodeURIComponent(rawValue.join('='))
  }
  return null
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const attributes = [`${name}=${encodeURIComponent(value)}`]
  attributes.push(`Path=${options.path ?? '/'}`)
  attributes.push(`SameSite=${options.sameSite ?? 'Lax'}`)
  if (options.httpOnly ?? true) attributes.push('HttpOnly')
  if (options.secure ?? true) attributes.push('Secure')
  if (options.maxAge !== undefined) attributes.push(`Max-Age=${options.maxAge}`)
  return attributes.join('; ')
}

