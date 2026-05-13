import Stripe from 'stripe'

export type StripeConfig = {
  client: Stripe
  publishableKey?: string
  webhookSecret?: string
  productId: string
  priceId: string
}

export type SubscriptionRecord = {
  userId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripeProductId: string | null
  stripePriceId: string | null
  checkoutSessionId: string | null
  tier: 'free' | 'studio'
  status: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'paused'
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  metadata: Record<string, unknown>
}

function isoFromUnix(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function subscriptionPrice(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price ?? null
}

function subscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0] ?? null
  return {
    start: isoFromUnix(item?.current_period_start),
    end: isoFromUnix(item?.current_period_end),
  }
}

function subscriptionTier(price: Stripe.Price | null, config: StripeConfig): SubscriptionRecord['tier'] {
  const priceId = typeof price?.id === 'string' ? price.id : null
  const productId = typeof price?.product === 'string' ? price.product : null
  return priceId === config.priceId || productId === config.productId ? 'studio' : 'free'
}

export function subscriptionRecordFromStripe(args: {
  userId: string
  subscription: Stripe.Subscription
  config: StripeConfig
  stripeCustomerId?: string | null
  checkoutSessionId?: string | null
  metadata?: Record<string, unknown>
}): SubscriptionRecord {
  const price = subscriptionPrice(args.subscription)
  const period = subscriptionPeriod(args.subscription)
  const stripeCustomerId = args.stripeCustomerId
    ?? (typeof args.subscription.customer === 'string' ? args.subscription.customer : null)
  return {
    userId: args.userId,
    stripeCustomerId,
    stripeSubscriptionId: args.subscription.id,
    stripeProductId: typeof price?.product === 'string' ? price.product : null,
    stripePriceId: price?.id ?? null,
    checkoutSessionId: args.checkoutSessionId ?? null,
    tier: subscriptionTier(price, args.config),
    status: args.subscription.status,
    cancelAtPeriodEnd: Boolean(args.subscription.cancel_at_period_end),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    metadata: args.metadata ?? {},
  }
}
