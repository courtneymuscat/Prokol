'use client'

import { useState, useEffect, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { canAccess, type Feature, type SubscriptionTier, type UserType } from '@/lib/features'

type Props = {
  feature: Feature
  children: ReactNode
  /** Optional custom message */
  message?: string
  /** If true, renders children with a disabled overlay instead of replacing them */
  overlay?: boolean
}

/**
 * Client-side feature gate.
 *
 * Usage:
 *   <UpgradeGate feature={FEATURES.MEAL_BUILDER}>
 *     <MealBuilder />
 *   </UpgradeGate>
 */
export default function UpgradeGate({ feature, children, message, overlay = false }: Props) {
  const [tier, setTier] = useState<SubscriptionTier | null>(null)
  const [userType, setUserType] = useState<UserType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setLoading(false); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier, user_type')
        .eq('id', session.user.id)
        .single()
      setTier((profile?.subscription_tier as SubscriptionTier | null) ?? 'individual_free')
      setUserType((profile?.user_type as UserType | null) ?? 'individual')
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return null

  const allowed = canAccess(feature, tier, userType)
  if (allowed) return <>{children}</>

  const cta = message ?? 'Upgrade your plan to access this feature.'

  if (overlay) {
    return (
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40">{children}</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm">
          <LockIcon />
          <p className="text-sm font-medium text-gray-700 text-center px-4">{cta}</p>
          <a
            href="/pricing"
            className="mt-1 bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            View plans
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 flex flex-col items-center gap-3 text-center">
      <LockIcon />
      <p className="text-sm font-medium text-gray-700">{cta}</p>
      <a
        href="/pricing"
        className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
      >
        View plans
      </a>
    </div>
  )
}

function LockIcon() {
  return (
    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    </div>
  )
}
