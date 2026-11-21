'use client'

import { useRef } from 'react'

// Shared by the full Notes tab editor and the inline check-in note box, so
// a note written in either place supports the same formatting.
const FONT_COLORS = ['#111827', '#ef4444', '#f97316', '#eab308', '#22c55e', 'var(--nc-primary)', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280']

export default function RichToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const highlightInputRef = useRef<HTMLInputElement>(null)

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  function ToolBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
    return (
      <button
        type="button"
        title={title}
        onMouseDown={(e) => { e.preventDefault(); onClick() }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-600 hover:text-gray-900 text-sm font-semibold select-none"
      >
        {children}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-0.5 flex-wrap border border-gray-200 rounded-xl px-2 py-1.5 bg-gray-50">
      <ToolBtn title="Bold" onClick={() => exec('bold')}><span className="font-bold">B</span></ToolBtn>
      <ToolBtn title="Italic" onClick={() => exec('italic')}><span className="italic">I</span></ToolBtn>
      <ToolBtn title="Underline" onClick={() => exec('underline')}><span className="underline">U</span></ToolBtn>
      <ToolBtn title="Strikethrough" onClick={() => exec('strikeThrough')}><span className="line-through">S</span></ToolBtn>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      {FONT_COLORS.map(c => (
        <button
          key={c}
          type="button"
          title={`Colour ${c}`}
          onMouseDown={(e) => { e.preventDefault(); exec('foreColor', c) }}
          className="w-5 h-5 rounded-full border border-white shadow-sm hover:scale-110 transition-transform"
          style={{ backgroundColor: c }}
        />
      ))}
      <button
        type="button"
        title="Custom colour"
        onMouseDown={(e) => { e.preventDefault(); colorInputRef.current?.click() }}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
        </svg>
      </button>
      <input ref={colorInputRef} type="color" className="sr-only" onChange={e => exec('foreColor', e.target.value)} />

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Highlight" onClick={() => highlightInputRef.current?.click()}>
        <span style={{ background: 'linear-gradient(transparent 50%, #fde047 50%)' }} className="px-0.5">H</span>
      </ToolBtn>
      <input ref={highlightInputRef} type="color" defaultValue="#fde047" className="sr-only" onChange={e => exec('hiliteColor', e.target.value)} />

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Heading" onClick={() => exec('formatBlock', '<h3>')}><span className="font-bold text-xs">H</span></ToolBtn>
      <ToolBtn title="Paragraph" onClick={() => exec('formatBlock', '<p>')}><span className="text-xs">¶</span></ToolBtn>
      <ToolBtn title="Bullet list" onClick={() => exec('insertUnorderedList')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </ToolBtn>

      <div className="w-px h-5 bg-gray-200 mx-1" />

      <ToolBtn title="Clear formatting" onClick={() => exec('removeFormat')}>
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </ToolBtn>
    </div>
  )
}
