'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

type Message = {
  id: string
  sender_id: string
  body: string
  created_at: string
  read_at: string | null
  attachment_url?: string | null
  attachment_type?: string | null
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function isSameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function dayLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

function AudioPlayer({ url, isMe, knownDuration = 0 }: { url: string; isMe: boolean; knownDuration?: number }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(knownDuration)
  const audioRef = useRef<HTMLAudioElement>(null)

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause() } else { a.play() }
    setPlaying(!playing)
  }

  function fmt(s: number) {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  function onMetadata() {
    const a = audioRef.current
    if (!a) return
    // WebM files often report Infinity — fall back to knownDuration
    if (isFinite(a.duration) && a.duration > 0) {
      setDuration(a.duration)
    }
  }

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl min-w-[180px] ${isMe ? 'bg-blue-600' : 'bg-white border border-gray-100 shadow-sm'}`}>
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => { setPlaying(false); setProgress(0) }}
        onTimeUpdate={() => { const a = audioRef.current; if (a) setProgress(a.currentTime / (duration || 1)) }}
        onLoadedMetadata={onMetadata}
      />
      <button onClick={toggle} className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'}`}>
        {playing
          ? <svg className={`w-3.5 h-3.5 ${isMe ? 'text-white' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
          : <svg className={`w-3.5 h-3.5 ml-0.5 ${isMe ? 'text-white' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21" /></svg>
        }
      </button>
      <div className="flex-1 min-w-0">
        <div className={`h-1 rounded-full ${isMe ? 'bg-white/30' : 'bg-gray-200'}`}>
          <div className={`h-1 rounded-full transition-all ${isMe ? 'bg-white' : 'bg-blue-500'}`} style={{ width: `${progress * 100}%` }} />
        </div>
        <p className={`text-xs mt-1 ${isMe ? 'text-white/70' : 'text-gray-400'}`}>{duration ? fmt(duration) : '0:00'}</p>
      </div>
    </div>
  )
}

export default function ChatView({
  conversationId,
  currentUserId,
  otherEmail,
  backHref,
  showBackOnDesktop = true,
  hasBottomNav = false,
}: {
  conversationId: string
  currentUserId: string
  otherEmail: string
  backHref: string
  showBackOnDesktop?: boolean
  hasBottomNav?: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Voice recording state
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // Load messages + mark read
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}/messages`)
      .then((r) => r.json())
      .then((msgs) => {
        setMessages(Array.isArray(msgs) ? msgs : [])
        setLoading(false)
      })

    fetch(`/api/conversations/${conversationId}/read`, { method: 'POST' })
  }, [conversationId])

  // Scroll on initial load
  useEffect(() => {
    if (!loading) scrollToBottom(false)
  }, [loading, scrollToBottom])

  // Supabase realtime subscription
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (msg.sender_id !== currentUserId) {
            fetch(`/api/conversations/${conversationId}/read`, { method: 'POST' })
          }
          setTimeout(() => scrollToBottom(true), 50)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, currentUserId, scrollToBottom])

  async function sendMessage(body: string, attachmentUrl?: string, attachmentType?: string) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        ...(attachmentUrl ? { attachment_url: attachmentUrl, attachment_type: attachmentType } : {}),
      }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg])
      setTimeout(() => scrollToBottom(true), 50)
    }
  }

  async function handleSend() {
    const body = input.trim()
    if (!body || sending) return
    setSending(true)
    setInput('')
    await sendMessage(body)
    setSending(false)
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        await uploadAndSendAudio(blob, mimeType, recordingSeconds)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000)
    } catch {
      alert('Microphone access denied. Please allow microphone access to send voice notes.')
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  function cancelRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop())
    }
    chunksRef.current = []
    setRecording(false)
    setRecordingSeconds(0)
  }

  async function uploadAndSendAudio(blob: Blob, mimeType: string, durationSecs: number) {
    setSending(true)
    try {
      const ext = mimeType.includes('mp4') ? 'm4a' : 'webm'
      const fileName = `voice-${Date.now()}.${ext}`
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('message-attachments')
        .upload(`${currentUserId}/${fileName}`, blob, { contentType: mimeType, upsert: false })

      if (error) {
        console.error('Upload error:', error)
        alert('Failed to upload voice note. Please try again.')
        setSending(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('message-attachments')
        .getPublicUrl(data.path)

      // Store recording duration in body so the player can display it immediately
      await sendMessage(String(durationSecs), urlData.publicUrl, 'audio')
    } finally {
      setSending(false)
    }
  }

  function fmtRecording(s: number) {
    return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <a href={backHref} className={`text-gray-400 hover:text-gray-600 ${showBackOnDesktop ? '' : 'md:hidden'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </a>
        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-blue-600">{otherEmail[0].toUpperCase()}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">{otherEmail}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 bg-gray-50">
        {loading && (
          <p className="text-center text-xs text-gray-400 py-8">Loading messages…</p>
        )}
        {!loading && messages.length === 0 && (
          <p className="text-center text-xs text-gray-400 py-8">No messages yet. Say hello!</p>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUserId
          const showDay = i === 0 || !isSameDay(messages[i - 1].created_at, msg.created_at)
          const showTail = i === messages.length - 1 || messages[i + 1].sender_id !== msg.sender_id
          const isAudio = msg.attachment_type === 'audio'

          return (
            <div key={msg.id}>
              {showDay && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                    {dayLabel(msg.created_at)}
                  </span>
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${showTail ? 'mb-2' : 'mb-0.5'}`}>
                <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                  {isAudio && msg.attachment_url ? (
                    <AudioPlayer url={msg.attachment_url} isMe={isMe} knownDuration={msg.body ? parseInt(msg.body) || 0 : 0} />
                  ) : (
                    <div
                      className={`px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                          : 'bg-white text-gray-900 rounded-2xl rounded-bl-md border border-gray-100 shadow-sm'
                      }`}
                    >
                      {msg.body}
                    </div>
                  )}
                  {showTail && (
                    <span className="text-xs text-gray-400 px-1">
                      {formatTime(msg.created_at)}
                      {isMe && msg.read_at && (
                        <span className="ml-1 text-blue-400">· Read</span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="bg-white border-t px-4 py-3 flex-shrink-0"
        style={hasBottomNav ? { paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' } : undefined}
      >
        {recording ? (
          <div className="flex items-center gap-3">
            {/* Cancel */}
            <button
              onClick={cancelRecording}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Recording indicator */}
            <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-2xl px-4 py-2.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-sm font-medium text-red-600">{fmtRecording(recordingSeconds)}</span>
              <span className="text-xs text-red-400">Recording…</span>
            </div>
            {/* Send recording */}
            <button
              onClick={stopRecording}
              className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            {/* Mic button */}
            <button
              onClick={startRecording}
              disabled={sending}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 disabled:opacity-40 transition-colors flex-shrink-0"
              title="Record voice note"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={1}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32 overflow-y-auto"
              style={{ minHeight: '42px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
