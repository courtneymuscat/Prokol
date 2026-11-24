import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

// Exercises the real BROWSER_GUARD inline script from app/layout.tsx.
//
// The guard warns a client that their browser is too old to run the app —
// Next 16's framework code needs Safari/iOS 15.4+, and below that the bundle
// throws before React mounts, leaving forms that look fine but never save.
//
// The risk it has to avoid is crying wolf: a modern phone on bad gym wifi
// must never be told its browser is obsolete. So these cases care at least
// as much about when the banner must NOT appear.

const src = readFileSync('app/layout.tsx', 'utf8')
const GUARD = src.match(/const BROWSER_GUARD = `([\s\S]+?)`\n/)?.[1]

type Options = {
  hasModernFeatures?: boolean
  reactStarts?: boolean
  reactStartsAfterMs?: number
  scriptError?: { target?: { tagName: string }; message?: string } | null
  readyState?: 'loading' | 'complete'
}

function simulate({
  hasModernFeatures = true,
  reactStarts = true,
  reactStartsAfterMs = 0,
  scriptError = null,
  readyState = 'complete',
}: Options) {
  const appended: unknown[] = []
  const listeners: Record<string, ((e?: unknown) => void)[]> = {}
  const timers: { fn: () => void; ms: number }[] = []
  let domReady = readyState !== 'loading'

  const body = { appendChild: (el: unknown) => appended.push(el) }
  const document = {
    get readyState() { return domReady ? 'complete' : 'loading' },
    body,
    addEventListener(ev: string, fn: () => void) { (listeners[ev] ||= []).push(fn) },
    createElement: () => ({ setAttribute() {}, innerHTML: '' }),
  }
  const win: Record<string, unknown> & { addEventListener: (e: string, f: (x?: unknown) => void) => void } = {
    addEventListener(ev: string, fn: (x?: unknown) => void) { (listeners[ev] ||= []).push(fn) },
  }

  const ObjectStub: Record<string, unknown> = { ...Object }
  const arrayProto: Record<string, unknown> = {}
  if (hasModernFeatures) {
    ObjectStub.hasOwn = () => {}
    arrayProto.at = () => {}
  }

  const setTimeoutStub = (fn: () => void, ms: number) => { timers.push({ fn, ms }) }

  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  new Function('window', 'document', 'setTimeout', 'Object', 'Array', GUARD!)(
    win, document, setTimeoutStub, ObjectStub, { prototype: arrayProto },
  )

  if (!domReady) { domReady = true; (listeners['DOMContentLoaded'] ?? []).forEach((f) => f()) }
  if (scriptError) (listeners['error'] ?? []).forEach((f) => f(scriptError))
  if (reactStarts && reactStartsAfterMs === 0) win.__prokolReady = true

  for (const t of timers) {
    if (reactStarts && reactStartsAfterMs <= t.ms) win.__prokolReady = true
    t.fn()
  }

  return appended.length > 0
}

describe('browser guard', () => {
  it('is present and parseable as ES5 (it must run where the bundle cannot)', () => {
    expect(GUARD).toBeTruthy()
    expect(GUARD).not.toMatch(/=>/)
    expect(GUARD).not.toMatch(/\b(let|const)\s/)
    expect(GUARD).not.toMatch(/`/)
    expect(GUARD).not.toMatch(/\?\./)
  })

  describe('stays silent when the app is merely slow or healthy', () => {
    it('modern browser, everything normal', () => {
      expect(simulate({})).toBe(false)
    })

    it('modern browser on very slow network — React only starts after 30s', () => {
      expect(simulate({ reactStartsAfterMs: 30000 })).toBe(false)
    })

    it('modern browser where React never starts but nothing errored', () => {
      // Deliberate: without evidence of failure, silence beats a wrong message.
      expect(simulate({ reactStarts: false })).toBe(false)
    })

    it('a failed image is not a failed app', () => {
      expect(simulate({ scriptError: { target: { tagName: 'IMG' } } })).toBe(false)
    })

    it('an error fired but React started anyway', () => {
      expect(simulate({ scriptError: { message: 'boom' } })).toBe(false)
    })
  })

  describe('warns when the browser genuinely cannot run the app', () => {
    it('iOS below 15.4 — Object.hasOwn and Array.at missing', () => {
      expect(simulate({ hasModernFeatures: false, reactStarts: false })).toBe(true)
    })

    it('old browser detected before DOMContentLoaded', () => {
      expect(simulate({ hasModernFeatures: false, reactStarts: false, readyState: 'loading' })).toBe(true)
    })

    it('a script failed to load and React never recovered', () => {
      expect(simulate({ reactStarts: false, scriptError: { target: { tagName: 'SCRIPT' } } })).toBe(true)
    })

    it('an uncaught runtime error and React never recovered', () => {
      expect(simulate({ reactStarts: false, scriptError: { message: 'boom' } })).toBe(true)
    })
  })
})
