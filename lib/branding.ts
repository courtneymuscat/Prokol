export type Branding = {
  isWhiteLabel: boolean
  orgId: string | null
  appName: string
  brandColour: string
  brandColourSecondary: string
  brandColourText: string
  logoUrl: string | null
  faviconUrl: string | null
}

export const DEFAULT_BRANDING: Branding = {
  isWhiteLabel: false,
  orgId: null,
  appName: 'Prokol',
  brandColour: '#F5C842',
  brandColourSecondary: '#1A1A1A',
  brandColourText: '#1A1A1A',
  logoUrl: null,
  faviconUrl: null,
}

/**
 * Reads branding values injected by proxy.ts from request headers.
 * Falls back to Prokol defaults on the main platform domain.
 */
export function getBrandingFromHeaders(headersList: Headers): Branding {
  const isWhiteLabel = headersList.get('x-is-white-label') === 'true'

  if (!isWhiteLabel) return { ...DEFAULT_BRANDING }

  return {
    isWhiteLabel: true,
    orgId: headersList.get('x-org-id'),
    appName: headersList.get('x-app-name') ?? 'Prokol',
    brandColour: headersList.get('x-brand-colour') ?? DEFAULT_BRANDING.brandColour,
    brandColourSecondary:
      headersList.get('x-brand-colour-secondary') ?? DEFAULT_BRANDING.brandColourSecondary,
    brandColourText:
      headersList.get('x-brand-colour-text') ?? DEFAULT_BRANDING.brandColourText,
    logoUrl: headersList.get('x-logo-url') ?? null,
    faviconUrl: headersList.get('x-favicon-url') ?? null,
  }
}
