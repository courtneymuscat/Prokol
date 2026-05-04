'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  onScan: (barcode: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [slowHint, setSlowHint] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const scannedRef = useRef(false)
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setErrorMsg('Camera access is not available in this browser.')
      return
    }

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        })
        streamRef.current = stream

        if (!videoRef.current) { stream.getTracks().forEach(t => t.stop()); return }
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setStatus('scanning')

        slowTimerRef.current = setTimeout(() => setSlowHint(true), 6000)

        // Use native BarcodeDetector if available (more reliable on mobile)
        if ('BarcodeDetector' in window) {
          type BD = { detect(src: unknown): Promise<Array<{ rawValue: string }>> }
          const detector = new (window as unknown as { BarcodeDetector: new (opts?: object) => BD }).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'],
          })

          async function scanFrame() {
            if (scannedRef.current || !videoRef.current) return
            try {
              const codes = await detector.detect(videoRef.current)
              if (codes.length > 0 && !scannedRef.current) {
                scannedRef.current = true
                onScan(codes[0].rawValue)
                return
              }
            } catch { /* ignore per-frame errors */ }
            rafRef.current = requestAnimationFrame(scanFrame)
          }
          rafRef.current = requestAnimationFrame(scanFrame)

        } else {
          // Fallback: @zxing
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          const { NotFoundException } = await import('@zxing/library')
          const reader = new BrowserMultiFormatReader()
          await reader.decodeFromStream(stream, videoRef.current, (result, err) => {
            if (result && !scannedRef.current) {
              scannedRef.current = true
              onScan(result.getText())
            }
            if (err && !(err instanceof NotFoundException)) {
              console.warn('ZXing decode error', err)
            }
          })
        }
      } catch (err) {
        setStatus('error')
        const msg = err instanceof Error ? err.message : String(err)
        if (/permission|denied|notallowed/i.test(msg)) {
          setErrorMsg('Camera access denied. Please allow camera permission and try again.')
        } else {
          setErrorMsg('Could not start camera. Please try again.')
        }
      }
    }

    start()

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current)
    }
  }, [onScan])

  function submitManual() {
    const code = manualCode.replace(/\D/g, '').trim()
    if (code.length >= 8) onScan(code)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm">
        <p className="text-white font-semibold text-sm">Scan Barcode</p>
        <button type="button" onClick={onClose}
          className="text-white/70 hover:text-white transition-colors p-1.5 rounded-full hover:bg-white/10">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Camera view */}
      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} playsInline muted
          className="absolute inset-0 w-full h-full object-cover" />

        {/* Scanning overlay */}
        {status === 'scanning' && (
          <>
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-72 h-44">
                <div className="absolute inset-0 bg-transparent rounded-xl ring-2 ring-white/30" />
                {[
                  'top-0 left-0 border-t-2 border-l-2 rounded-tl-xl',
                  'top-0 right-0 border-t-2 border-r-2 rounded-tr-xl',
                  'bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl',
                  'bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl',
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-7 h-7 border-white ${cls}`} />
                ))}
                <div className="absolute left-2 right-2 h-0.5 bg-blue-400/80 rounded-full animate-scan-line" />
              </div>
            </div>

            {!slowHint ? (
              <p className="absolute bottom-12 left-0 right-0 text-center text-white/70 text-sm">
                Point camera at a food barcode
              </p>
            ) : (
              <div className="absolute bottom-4 left-4 right-4 bg-black/80 rounded-2xl px-4 py-4 space-y-3">
                <p className="text-white text-sm font-medium text-center">Can&apos;t read the barcode?</p>
                <p className="text-white/60 text-xs text-center">Try better lighting or type the number below</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && submitManual()}
                    placeholder="e.g. 9310036079385"
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button type="button" onClick={submitManual}
                    disabled={manualCode.replace(/\D/g,'').length < 8}
                    className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition-colors">
                    Look up
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
            <svg className="animate-spin h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-white/60 text-sm">Starting camera...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black px-8 text-center">
            <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg className="h-7 w-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <p className="text-white font-medium">{errorMsg}</p>
            <button type="button" onClick={onClose}
              className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors">
              Close
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scan-line {
          0%, 100% { top: 8px; opacity: 1; }
          50% { top: calc(100% - 8px); opacity: 0.8; }
        }
        .animate-scan-line {
          animation: scan-line 2s ease-in-out infinite;
          position: absolute;
        }
      `}</style>
    </div>
  )
}
