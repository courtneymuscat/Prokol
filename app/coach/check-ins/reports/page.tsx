'use client'

import { useEffect, useState } from 'react'

type ReportableQuestion = { id: string; label: string; type: string; templateName: string }
type AnswerRow = { client_id: string; client_name: string; flow_name: string; step_number: number; submitted_at: string; answers: Record<string, string | null> }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toCsv(rows: AnswerRow[], questions: ReportableQuestion[]): string {
  const header = ['Client', 'Date', 'Flow', 'Step', ...questions.map((q) => q.label)]
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = rows.map((r) => [
    r.client_name, fmtDate(r.submitted_at), r.flow_name, String(r.step_number),
    ...questions.map((q) => r.answers[q.id] ?? ''),
  ].map(escape).join(','))
  return [header.map(escape).join(','), ...lines].join('\n')
}

export default function ReportsPage() {
  const [questions, setQuestions] = useState<ReportableQuestion[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(true)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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
        if (list.length > 0) setSelectedIds([list[0].id])
      })
      .finally(() => setLoadingQuestions(false))
  }, [])

  function toggleQuestion(id: string) {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setRows(null)
  }

  const selectedQuestions = questions.filter(q => selectedIds.includes(q.id))

  async function runReport() {
    if (selectedIds.length === 0) return
    setRunning(true)
    const params = new URLSearchParams({ questionIds: selectedIds.join(',') })
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const res = await fetch(`/api/coach/reports/answers?${params.toString()}`)
    const data = await res.json()
    setRows(Array.isArray(data) ? data : [])
    setRunning(false)
  }

  function downloadCsv() {
    if (!rows || rows.length === 0) return
    const blob = new Blob([toCsv(rows, selectedQuestions)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${selectedQuestions.length === 1 ? selectedQuestions[0].label.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'report'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="flex-1 p-6 space-y-6 w-full max-w-4xl">
      <div>
        <a href="/coach/check-ins" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">← Check-ins</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pull every client&apos;s answers across a date range. Select more than one question to see them side by side for the same check-in. Mark a question &quot;Include in reports&quot; in any autoflow builder to make it available here.
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
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Questions ({selectedIds.length} selected)</label>
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-56 overflow-y-auto">
                {questions.map((q) => (
                  <label key={q.id} className="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(q.id)}
                      onChange={() => toggleQuestion(q.id)}
                      className="mt-0.5 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">
                      {q.label}
                      <span className="text-gray-400"> — {q.templateName}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
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
                disabled={running || selectedIds.length === 0}
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
            <p className="text-sm font-semibold text-gray-900">{rows.length} check-in{rows.length !== 1 ? 's' : ''}</p>
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
          ) : selectedQuestions.length === 1 ? (
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {rows.map((r, i) => (
                <div key={i} className="px-5 py-3 flex items-start gap-4">
                  <div className="w-36 flex-shrink-0">
                    <a href={`/coach/clients/${r.client_id}?tab=checkins`} className="text-sm font-medium text-gray-900 hover:underline truncate block">{r.client_name}</a>
                    <p className="text-xs text-gray-400">{fmtDate(r.submitted_at)}</p>
                  </div>
                  <p className="flex-1 text-sm text-gray-700 whitespace-pre-line">{r.answers[selectedQuestions[0].id] || <span className="text-gray-300 italic">No answer</span>}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[600px]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white border-b">
                  <tr>
                    <th className="text-left font-semibold text-gray-700 px-5 py-2.5 whitespace-nowrap">Client</th>
                    <th className="text-left font-semibold text-gray-700 px-3 py-2.5 whitespace-nowrap">Date</th>
                    {selectedQuestions.map((q) => (
                      <th key={q.id} className="text-left font-semibold text-gray-700 px-3 py-2.5 min-w-[200px]">{q.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((r, i) => (
                    <tr key={i} className="align-top">
                      <td className="px-5 py-3 whitespace-nowrap">
                        <a href={`/coach/clients/${r.client_id}?tab=checkins`} className="text-sm font-medium text-gray-900 hover:underline">{r.client_name}</a>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">{fmtDate(r.submitted_at)}</td>
                      {selectedQuestions.map((q) => (
                        <td key={q.id} className="px-3 py-3 text-sm text-gray-700 whitespace-pre-line">
                          {r.answers[q.id] || <span className="text-gray-300 italic">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
