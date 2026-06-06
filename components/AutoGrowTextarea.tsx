'use client'

import { useEffect, useRef } from 'react'

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'ref'> & {
  minRows?: number
}

// Textarea that resizes to fit its content — no inner scrollbar, no
// clipped lines. The coach sees the whole note while typing.
export default function AutoGrowTextarea({ minRows = 2, value, style, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      style={{ overflow: 'hidden', ...style }}
      {...rest}
    />
  )
}
