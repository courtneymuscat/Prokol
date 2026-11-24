'use client'

import { useEffect } from 'react'

// Next 16's own framework code uses Object.hasOwn and Array.at(), so the app
// has a hard floor of Safari/iOS 15.4. Below that the bundle throws before
// React mounts, and every page silently becomes read-only: controlled inputs
// still show typed text (the browser does that natively) while the component
// state behind them never updates, so buttons stay disabled and nothing
// saves. A gym member hit exactly that and had no way to know why.
//
// The banner itself is injected by an ES5 inline script in layout.tsx, which
// has to parse on browsers too old to run the bundle. This component is the
// other half: it marks the app as alive so the script stands down.
export default function UnsupportedBrowserNotice() {
  useEffect(() => {
    const w = window as unknown as { __prokolReady?: boolean }
    w.__prokolReady = true
    document.getElementById('prokol-unsupported-browser')?.remove()
  }, [])

  return null
}
