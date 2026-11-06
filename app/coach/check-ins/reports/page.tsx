'use client'

import { useEffect, useState } from 'react'

type ReportableQuestion = { id: string; label: string; type: string; templateName: string }
type AnswerRow = { client_id: string; client_name: string; flow_name: string; step_number: number; answer: string; submitted_at: string }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toCsv(rows: AnswerRow[]): string {
  const header = ['Client', 'Date', 'Flow', 'Step', 'Answer']
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = rows.map((r) => [r.client_name, fmtDate(r.submitted_at), r.flow_name, String(r.step_number), r.answer ?? ''].map(escape).join(','))
  return [header.map(escape).join(','), ...lines].join('\n')
}

export default function ReportsPage() {
  const [questions, setQuestions] = useState<ReportableQuestion[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [questionId, setQuestionId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<AnswerRow[] | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetch('/api/coach/reports/questions')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : []
        setQuestions(list)
        if (list.length > 0) setQuestionId(list[0].id)
      })
      .finally(() => setLoadingQuestions(false))
  }, [])

  async function runReport() {
    if (!questionId) return
    setRunning(true)
    const params = new URLSearchParams({ questionId })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/coach/reports/answers?${params.toString()}`)
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setRunning(false)
  }

  function downloadCsv() {
    if (!rows || rows.length === 0) return
    const q = questions.find((x) => x.id === questionId)
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(q?.label ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="flex-1 p-6 space-y-6 w-full max-w-4xl">
      <div>
        <a href="/coach/check-ins" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Check-ins</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pull every client&apos;s answer to one question, across a date range. Mark a question &quot;Include in reports&quot; in any autoflow builder to make it available here.
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-5 space-y-4">
        {loadingQuestions ? (
          <p className="text-sm text-gray-400">Loading questions…</p>
        ) : questions.length === 0 ? (
          <p className="text-sm text-gray-400">
            No questions marked &quot;Include in reports&quot; yet. Open an autoflow, tick that box on a question, save, then come back here.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Question</label>
                <select
                  value={questionId}
                  onChange={e => { setQuestionId(e.target.value); setRows(null) }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white"
                >
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>{q.label} — {q.templateName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
              <button
                onClick={runReport}
                disabled={running}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {running ? 'Running…' : 'Run report'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400">Leave dates blank for all-time. Dates filter by when the check-in was submitted.</p>
          </>
        )}
      </div>

      {rows && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b">
            <p className="text-sm font-semibold text-gray-900">{rows.length} answer{rows.length !== 1 ? 's' : ''}</p>
            <button
              onClick={downloadCsv}
              disabled={rows.length === 0}
              className="text-xs font-medium text-gray-500 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Download CSV
            </button>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">No answers in this range.</p>
          ) : (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-4">
                  <div className="w-36 flex-shrink-0">
                    <a href={`/coach/clients/${r.client_id}?tab=checkins`} className="text-sm font-medium text-gray-900 hover:underline truncate block">{r.client_name}</a>
                    <p className="text-xs text-gray-400">{fmtDate(r.submitted_at)}</p>
                  </div>
                  <p className="flex-1 text-sm text-gray-700 whitespace-pre-line">{r.answer || <span className="text-gray-300 italic">No answer</span>}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
