export type BillingCheckResult = {
  allowed: boolean
  tier: 'free' | 'studio'
  subscriptionStatus: 'free' | 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
  limitCredits: number
  usedCredits: number
  remainingCredits: number
  spendUsd: number
  windowStartedAt: string
  windowEndsAt: string
  checkoutEligible: boolean
}

export type BillingUsageEventInput = {
  eventId?: string
  provider: string
  model: string
  operation: string
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedInputTokens?: number
  costUsd?: number
  requestId?: string | null
  requestJson?: Record<string, unknown> | null
  responseJson?: Record<string, unknown> | null
  metadata?: Record<string, unknown>
  createdAt?: string
}

type ModelPricing = {
  inputPerMillionUsd: number
  outputPerMillionUsd: number
  cachedInputPerMillionUsd?: number
}

export const FREE_MONTHLY_CREDITS = 1_000_000
export const STUDIO_MONTHLY_CREDITS = 15_000_000
const CREDITS_PER_USD_COST = 100_000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const PAID_ACCESS_STATUSES = new Set(['active', 'trialing', 'past_due'])

const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-5': {
    inputPerMillionUsd: 1.25,
    cachedInputPerMillionUsd: 0.125,
    outputPerMillionUsd: 10,
  },
  'gpt-5.2': {
    inputPerMillionUsd: 1.25,
    cachedInputPerMillionUsd: 0.125,
    outputPerMillionUsd: 10,
  },
  'text-embedding-3-small': {
    inputPerMillionUsd: 0.02,
    cachedInputPerMillionUsd: 0.02,
    outputPerMillionUsd: 0,
  },
}

function roundUsd(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000
}

export function creditsFromUsd(costUsd: number) {
  return Math.max(0, Math.ceil(Math.max(0, costUsd) * CREDITS_PER_USD_COST))
}

export function billingWindow(now = Date.now()) {
  return {
    startedAt: new Date(now - THIRTY_DAYS_MS).toISOString(),
    endsAt: new Date(now).toISOString(),
  }
}

export function hasPaidAccess(subscription: { status?: string | null; currentPeriodEnd?: string | null } | null, now = Date.now()) {
  return Boolean(
    subscription
    && subscription.status
    && PAID_ACCESS_STATUSES.has(subscription.status)
    && (!subscription.currentPeriodEnd || Date.parse(subscription.currentPeriodEnd) >= now),
  )
}

function resolvePricing(model: string) {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model]
  for (const [candidate, resolved] of Object.entries(MODEL_PRICING)) {
    if (model.startsWith(`${candidate}-`)) return resolved
  }
  if (model.startsWith('gpt-5')) return MODEL_PRICING['gpt-5']
  return null
}

export function computeUsageCostUsd(event: BillingUsageEventInput) {
  if (typeof event.costUsd === 'number' && Number.isFinite(event.costUsd)) {
    return roundUsd(Math.max(0, event.costUsd))
  }
  const pricing = resolvePricing(event.model)
  if (!pricing) return 0
  const cachedInputTokens = Math.max(0, Math.trunc(event.cachedInputTokens ?? 0))
  const inputTokens = Math.max(0, Math.trunc(event.inputTokens ?? 0))
  const outputTokens = Math.max(0, Math.trunc(event.outputTokens ?? 0))
  const uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens)
  return roundUsd(
    (uncachedInputTokens / 1_000_000) * pricing.inputPerMillionUsd
    + (cachedInputTokens / 1_000_000) * (pricing.cachedInputPerMillionUsd ?? pricing.inputPerMillionUsd)
    + (outputTokens / 1_000_000) * pricing.outputPerMillionUsd,
  )
}

export function openAIUsageFromResponse(payload: Record<string, unknown>) {
  const usage = payload.usage && typeof payload.usage === 'object'
    ? payload.usage as Record<string, unknown>
    : null
  if (!usage) return null
  const promptTokens = Number(usage.prompt_tokens ?? usage.input_tokens ?? 0)
  const completionTokens = Number(usage.completion_tokens ?? usage.output_tokens ?? 0)
  const totalTokens = Number(usage.total_tokens ?? promptTokens + completionTokens)
  const promptDetails = usage.prompt_tokens_details && typeof usage.prompt_tokens_details === 'object'
    ? usage.prompt_tokens_details as Record<string, unknown>
    : null
  const cachedInputTokens = Number(promptDetails?.cached_tokens ?? 0)
  return {
    inputTokens: Number.isFinite(promptTokens) ? promptTokens : 0,
    outputTokens: Number.isFinite(completionTokens) ? completionTokens : 0,
    totalTokens: Number.isFinite(totalTokens) ? totalTokens : 0,
    cachedInputTokens: Number.isFinite(cachedInputTokens) ? cachedInputTokens : 0,
  }
}
