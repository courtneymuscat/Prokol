const HEX_COLOUR_RE = /^#[0-9A-Fa-f]{3}$|^#[0-9A-Fa-f]{6}$/

/**
 * CSS text for a :root override that threads one brand colour through to
 * every bg-blue / text-blue utility (see globals.css's "remap blue
 * utilities → teal" block, which actually reads --nc-primary with a literal
 * #1D9E75 fallback — not --brand-primary directly, which until now nothing
 * but one cheat-sheet page ever consumed). Derives hover/light/mid/border
 * tints via color-mix() so callers only supply the one base colour instead
 * of hand-picking four matching shades. Returns '' for a missing/invalid
 * colour so callers can render it unconditionally with no extra guard —
 * and critically, must NOT be called with a non-white-label default colour,
 * since globals.css's own #1D9E75 fallback is what every existing (non
 * white-label) user's UI already relies on.
 */
export function brandColourOverrideCss(primary: string | null | undefined): string {
  if (!primary || !HEX_COLOUR_RE.test(primary)) return ''
  return `:root {
    --brand-primary: ${primary};
    --nc-primary: ${primary};
    --nc-primary-hover: color-mix(in srgb, ${primary} 80%, black);
    --nc-primary-light: color-mix(in srgb, ${primary} 6%, white);
    --nc-primary-mid: color-mix(in srgb, ${primary} 10%, white);
    --nc-primary-border: color-mix(in srgb, ${primary} 18%, white);
    --nc-primary-text: ${primary};
  }`
}

export type Branding = {
  isWhiteLabel: boolean
  orgId: string | null
  appName: string
  brandColour: string
  brandColourSecondary: string
  brandColourText: string
  logoUrl: string | null
  faviconUrl: string | null
  appIconUrl: string | null
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
  appIconUrl: null,
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
    appIconUrl: headersList.get('x-app-icon-url') ?? null,
  }
}
