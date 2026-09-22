const HEALTH_TIMEZONE = 'Asia/Taipei'

export function healthDate(instant: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: HEALTH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

export function shiftHealthDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

export function healthDayStart(date: string): Date {
  return new Date(`${date}T00:00:00+08:00`)
}

export function floorToHealthDay(instant: Date): Date {
  return healthDayStart(healthDate(instant))
}

export function nextHealthDayStart(instant: Date): Date {
  return healthDayStart(shiftHealthDate(healthDate(instant), 1))
}

export function healthDatesInRange(start: Date, end: Date): string[] {
  const dates: string[] = []
  const finalDate = healthDate(new Date(end.getTime() - 1))
  for (let date = healthDate(start); date <= finalDate; date = shiftHealthDate(date, 1)) dates.push(date)
  return dates
}
