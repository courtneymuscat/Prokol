'use client'

import { createContext, useContext } from 'react'
import type { Branding } from '@/lib/branding'
import { DEFAULT_BRANDING } from '@/lib/branding'

const BrandingContext = createContext<Branding>(DEFAULT_BRANDING)

export function BrandingProvider({
  branding,
  children,
}: {
  branding: Branding
  children: React.ReactNode
}) {
  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}

export function useBranding(): Branding {
  return useContext(BrandingContext)
}
