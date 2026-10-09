export interface PublicSteps {
  date: string
  timezone: 'Asia/Taipei'
  steps: number | null
  stepGoal: number
  stepsRemaining: number | null
  completionRate: number | null
  synced: boolean
  lastSyncedAt: string | null
  websiteUrl: string
}

export function makePublicSteps(date: string, steps: number | null, goal: number, synced: boolean, updated: string | null): PublicSteps {
  const stepGoal = Number.isFinite(goal) && goal > 0 ? goal : 8000
  const validSteps = synced && steps !== null && Number.isFinite(steps) && steps >= 0 ? steps : null
  return {
    date,
    timezone: 'Asia/Taipei',
    steps: validSteps,
    stepGoal,
    stepsRemaining: validSteps === null ? null : Math.max(0, stepGoal - validSteps),
    completionRate: validSteps === null ? null : Math.round(validSteps / stepGoal * 100),
    synced,
    lastSyncedAt: synced ? updated : null,
    websiteUrl: 'https://health-view.netlify.app/',
  }
}
