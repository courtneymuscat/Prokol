import { describe, it, expect } from 'vitest'
import { brandColourOverrideCss } from '@/lib/branding'

// This is what threads a white-labelled org's brand colour through to
// every bg-blue-*/text-blue-* Tailwind utility app-wide (see globals.css's
// "remap blue utilities → teal" block, and app/layout.tsx where this is
// called — gated on isWhiteLabel so an ordinary Prokol user's UI is
// untouched).

describe('brandColourOverrideCss', () => {
  it('returns a :root block setting --nc-primary to the given colour', () => {
    const css = brandColourOverrideCss('#0072D0')
    expect(css).toContain('--brand-primary: #0072D0')
    expect(css).toContain('--nc-primary: #0072D0')
    expect(css).toContain('--nc-primary-text: #0072D0')
  })

  it('derives hover/light/mid/border tints via color-mix rather than requiring the caller to supply them', () => {
    const css = brandColourOverrideCss('#0072D0')
    expect(css).toContain('--nc-primary-hover: color-mix(in srgb, #0072D0 80%, black)')
    expect(css).toContain('--nc-primary-light: color-mix(in srgb, #0072D0 6%, white)')
    expect(css).toContain('--nc-primary-mid: color-mix(in srgb, #0072D0 10%, white)')
    expect(css).toContain('--nc-primary-border: color-mix(in srgb, #0072D0 18%, white)')
  })

  it('accepts a 3-digit shorthand hex', () => {
    expect(brandColourOverrideCss('#fff')).toContain('--nc-primary: #fff')
  })

  it('returns empty string for null/undefined/invalid input, so callers can render it unconditionally', () => {
    expect(brandColourOverrideCss(null)).toBe('')
    expect(brandColourOverrideCss(undefined)).toBe('')
    expect(brandColourOverrideCss('')).toBe('')
    expect(brandColourOverrideCss('not-a-colour')).toBe('')
    expect(brandColourOverrideCss('red')).toBe('')
  })
})
