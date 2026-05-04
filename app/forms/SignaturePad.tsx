'use client'

import { useRef, useState, useEffect } from 'react'

export default function SignaturePad({
  value,
  onChange,
}: {
  value: string
  onChange: (dataUrl: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const [isEmpty, setIsEmpty] = useState(!value)

  // If editing an existing submission, paint the stored signature back onto the canvas
  useEffect(() => {
    if (value && canvasRef.current) {
      const img = new Image()
      img.onload = () => {
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx && canvasRef.current) {
          ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height)
          setIsEmpty(false)
        }
      }
      img.src = value
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function getXY(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = canvasRef.current!.width / rect.width
    const scaleY = canvasRef.current!.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    isDrawing.current = true
    canvasRef.current?.setPointerCapture(e.pointerId)
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = getXY(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    const { x, y } = getXY(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handleUp() {
    if (!isDrawing.current) return
    isDrawing.current = false
    if (canvasRef.current) {
      const dataUrl = canvasRef.current.toDataURL('image/png')
      onChange(dataUrl)
      setIsEmpty(false)
    }
  }

  function clear(e: React.MouseEvent) {
    e.preventDefault()
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      onChange('')
      setIsEmpty(true)
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={1200}
          height={360}
          className="w-full touch-none cursor-crosshair block"
          style={{ height: 180 }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
        />
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
            <p className="text-gray-300 text-sm font-medium">Draw your signature here</p>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        Clear
      </button>
    </div>
  )
}
