'use client'

import { useState, useEffect } from 'react'
import TDEESection from './TDEESection'

// ─── ClientServeGuide ─────────────────────────────────────────────────────────

type ServeFood = {
  id: string; food_name: string; serving_desc: string | null
  calories_per_serve: number | null; protein_per_serve: number | null
  carbs_per_serve: number | null; fat_per_serve: number | null
  serve_category: string; secondary_categories: string[]
}
type ServeTargets = {
  protein_serves: number; carb_serves: number; fat_serves: number
  fruit_serves: number; veg_unlimited: boolean; notes: string | null
} | null

const CAT_CONFIG: Record<string, { label: string; serve: string; badge: string; color: string }> = {
  protein:   { label: 'Protein',      serve: '1 serve ≈ 30g protein',  badge: 'bg-pink-100 text-pink-700',    color: 'bg-pink-50' },
  carb:      { label: 'Carbs',        serve: '1 serve ≈ 20g carbs',    badge: 'bg-teal-100 text-teal-700',color: 'bg-teal-50' },
  fruit:     { label: 'Fruit',        serve: '1 serve ≈ 20g carbs',    badge: 'bg-orange-100 text-orange-700',color: 'bg-orange-50' },
  fat:       { label: 'Fats',         serve: '1 serve ≈ 10g fat',      badge: 'bg-green-100 text-green-700',  color: 'bg-green-50' },
  condiment: { label: 'Condiments',   serve: '~1 fat or carb serve',   badge: 'bg-blue-100 text-blue-700',    color: 'bg-blue-50' },
  free:      { label: 'Free Foods',   serve: 'Unlimited',              badge: 'bg-gray-100 text-gray-600',    color: 'bg-gray-50' },
}
const SEC_LABELS: Record<string, string> = { fat: '+ 1 fat', carb: '+ 1 carb', fat_half: '+ ½ fat', carb_half: '+ ½ carb', protein_half: '+ ½ protein', protein: '+ 1 protein' }
const SEC_COLORS: Record<string, string> = { fat: 'bg-green-100 text-green-700', carb: 'bg-teal-100 text-teal-700', fat_half: 'bg-green-50 text-green-600', carb_half: 'bg-teal-50 text-teal-600', protein_half: 'bg-pink-50 text-pink-600', protein: 'bg-pink-100 text-pink-700' }

// Per-serve calorie / macro assumptions. Kept in one place so the
// "How this is calculated" breakdown and the estimate totals can never
// drift apart.
const SERVE_BUDGET = {
  protein: { kcal: 135, primaryG: 30, primaryMacro: 'P' as const, extras: '+ ~3g fat typical in lean meat/eggs' },
  carb:    { kcal:  90, primaryG: 20, primaryMacro: 'C' as const, extras: '+ ~3g protein typical in grains/legumes' },
  fat:     { kcal:  95, primaryG: 10, primaryMacro: 'F' as const, extras: '+ small protein/carbs in nuts/seeds' },
  fruit:   { kcal:  80, primaryG: 20, primaryMacro: 'C' as const, extras: 'minimal other macros' },
}
const VEG_KCAL = 150

function ServeMathBreakdown({
  protein_serves, carb_serves, fat_serves, fruit_serves, veg_unlimited,
}: {
  protein_serves: number; carb_serves: number; fat_serves: number; fruit_serves: number; veg_unlimited: boolean
}) {
  const lines = [
    { label: 'Protein', serves: protein_serves, ...SERVE_BUDGET.protein },
    { label: 'Carbs',   serves: carb_serves,    ...SERVE_BUDGET.carb },
    { label: 'Fats',    serves: fat_serves,     ...SERVE_BUDGET.fat },
    { label: 'Fruit',   serves: fruit_serves,   ...SERVE_BUDGET.fruit },
  ]
  const totalKcal = lines.reduce((s, l) => s + l.serves * l.kcal, 0) + (veg_unlimited ? VEG_KCAL : 0)
  return (
    <details className="group">
      <summary className="text-[11px] text-amber-700 underline cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">How is this calculated?</span>
        <span className="hidden group-open:inline">Hide calculation</span>
      </summary>
      <div className="mt-2 space-y-2.5 bg-white/60 rounded-lg p-2.5 border border-amber-100">
        <div>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Per-serve assumptions</p>
          <ul className="text-[11px] text-amber-800 space-y-0.5">
            {lines.map((l) => (
              <li key={l.label}>
                <span className="font-semibold">{l.label}:</span>{' '}
                {l.kcal} kcal/serve = {l.primaryG}g {l.primaryMacro} ({l.primaryG * (l.primaryMacro === 'F' ? 9 : 4)} kcal) {l.extras}
              </li>
            ))}
            {veg_unlimited && (
              <li><span className="font-semibold">Veg (∞):</span> +{VEG_KCAL} kcal/day flat (~500g/day non-starchy veg)</li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">This client&apos;s breakdown</p>
          <table className="w-full text-[11px] text-amber-800">
            <tbody>
              {lines.filter(l => l.serves > 0).map((l) => (
                <tr key={l.label}>
                  <td className="py-0.5 pr-2 font-medium">{l.label}</td>
                  <td className="py-0.5 pr-2 tabular-nums">{l.serves} × {l.kcal}</td>
                  <td className="py-0.5 pr-2 tabular-nums">= {Math.round(l.serves * l.kcal)} kcal</td>
                  <td className="py-0.5 tabular-nums text-amber-600">{Math.round(l.serves * l.primaryG)}g {l.primaryMacro}</td>
                </tr>
              ))}
              {veg_unlimited && (
                <tr>
                  <td className="py-0.5 pr-2 font-medium">Veg</td>
                  <td className="py-0.5 pr-2 tabular-nums">flat</td>
                  <td className="py-0.5 pr-2 tabular-nums">= {VEG_KCAL} kcal</td>
                  <td className="py-0.5 text-amber-600">—</td>
                </tr>
              )}
              <tr className="border-t border-amber-100">
                <td className="py-0.5 pr-2 font-semibold pt-1">Total</td>
                <td className="py-0.5 pr-2" />
                <td className="py-0.5 pr-2 tabular-nums font-semibold pt-1">= {Math.round(totalKcal)} kcal</td>
                <td />
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-amber-600 mt-1.5 leading-snug">
            The macro figures shown above the breakdown count primary macros only ({SERVE_BUDGET.protein.primaryG}g P/serve, {SERVE_BUDGET.carb.primaryG}g C/serve, {SERVE_BUDGET.fat.primaryG}g F/serve). The kcal total is higher because per-serve kcal also covers the typical &quot;mixed&quot; macros found in real food (fat in protein foods, protein in grains, etc.) — that&apos;s why 120P + 240C + 60F ≠ kcal total exactly.
          </p>
        </div>
      </div>
    </details>
  )
}

function macrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
  const roundHalf = (n: number) => Math.round(n * 2) / 2
  const fruit_serves = 2
  // Reserve carb budget for fruit (2 × 20g) and veg (~150 kcal ÷ 4 kcal/g ≈ 38g carbs)
  const vegCarbG = Math.round(150 / 4)
  const remainingCarbG = Math.max(0, macros.carbG - fruit_serves * 20 - vegCarbG)
  return {
    protein_serves: roundHalf(macros.proteinG / 30),
    carb_serves: roundHalf(remainingCarbG / 20),
    fat_serves: roundHalf(macros.fatG / 10),
    fruit_serves,
    veg_unlimited: true,
  }
}

export default function ClientServeGuide({ clientId }: { clientId: string }) {
  const [foods, setFoods] = useState<ServeFood[]>([])
  const [targets, setTargets] = useState<ServeTargets>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'simple' | 'detailed'>('simple')
  const [editingTargets, setEditingTargets] = useState(false)
  const [draft, setDraft] = useState({ protein_serves: 0, carb_serves: 0, fat_serves: 0, fruit_serves: 0, veg_unlimited: true, notes: '' })
  const [savingTargets, setSavingTargets] = useState(false)
  const [removingTargets, setRemovingTargets] = useState(false)
  const [autoAssign, setAutoAssign] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/coach/food-serves').then(r => r.json()),
      fetch(`/api/coach/clients/serve-targets?clientId=${clientId}`).then(r => r.json()),
    ]).then(([fd, td]) => {
      setFoods(fd.foods ?? [])
      if (td.targets) {
        setTargets(td.targets)
        setDraft({ ...td.targets, notes: td.targets.notes ?? '' })
      }
    }).finally(() => setLoading(false))
  }, [clientId])

  function applyMacrosToServes(macros: { proteinG: number; carbG: number; fatG: number }) {
    const serves = macrosToServes(macros)
    setDraft(d => ({ ...d, ...serves }))
    setEditingTargets(true)
    setAutoAssign(true)
  }

  async function removeTargets() {
    if (!confirm('Remove serve targets for this client? They will no longer see the serve guide in their app.')) return
    setRemovingTargets(true)
    await fetch(`/api/coach/clients/serve-targets?clientId=${clientId}`, { method: 'DELETE' })
    setTargets(null)
    setEditingTargets(false)
    setRemovingTargets(false)
  }

  async function saveTargets() {
    setSavingTargets(true)
    const r = await fetch('/api/coach/clients/serve-targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, ...draft }),
    })
    const d = await r.json()
    setTargets(d.targets)
    setEditingTargets(false)
    setSavingTargets(false)
    setAutoAssign(false)
  }

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading…</div>

  return (
    <div className="space-y-5">
      {/* TDEE calculator */}
      <TDEESection
        clientId={clientId}
        onApplyToServes={applyMacrosToServes}
        onOverrideMealPlan={() => {
          fetch(`/api/coach/clients/${clientId}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targets_source: 'tdee', targets_meal_plan_id: null }),
          })
        }}
      />

      {/* Serve targets panel */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Daily Serve Targets</h3>
            <p className="text-xs text-gray-400 mt-0.5">Set how many serves per day for this client</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/print/client-cheat-sheet/${clientId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1"
              title="Open a printable cheat sheet with this client's serve targets"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              PDF
            </a>
            {targets && !editingTargets && (
              <button onClick={removeTargets} disabled={removingTargets} className="text-xs text-red-500 hover:text-red-600 font-medium disabled:opacity-50">
                {removingTargets ? 'Removing…' : 'Remove'}
              </button>
            )}
            <button onClick={() => setEditingTargets(v => !v)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              {editingTargets ? 'Cancel' : targets ? 'Edit' : 'Set Targets'}
            </button>
          </div>
        </div>

        {editingTargets ? (
          <div className="space-y-4">
            {autoAssign && (
              <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-teal-700">Serves auto-calculated from TDEE — adjust if needed, then save.</p>
              </div>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {([
                { key: 'protein_serves', label: 'Protein', color: 'text-pink-600' },
                { key: 'carb_serves', label: 'Carbs', color: 'text-teal-600' },
                { key: 'fat_serves', label: 'Fats', color: 'text-green-600' },
                { key: 'fruit_serves', label: 'Fruit', color: 'text-orange-500' },
              ] as const).map(({ key, label, color }) => (
                <div key={key}>
                  <label className={`text-xs font-medium block mb-1 ${color}`}>{label} serves</label>
                  <input type="number" min="0" max="20" step="0.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))} />
                </div>
              ))}
            </div>
            {/* Estimated daily calories + macros */}
            {(draft.protein_serves > 0 || draft.carb_serves > 0 || draft.fat_serves > 0) && (() => {
              const vegCal = draft.veg_unlimited ? VEG_KCAL : 0
              const estCal = Math.round(
                draft.protein_serves * SERVE_BUDGET.protein.kcal +
                draft.carb_serves    * SERVE_BUDGET.carb.kcal +
                draft.fat_serves     * SERVE_BUDGET.fat.kcal +
                draft.fruit_serves   * SERVE_BUDGET.fruit.kcal +
                vegCal
              )
              const estP = Math.round(draft.protein_serves * SERVE_BUDGET.protein.primaryG)
              const estC = Math.round(draft.carb_serves * SERVE_BUDGET.carb.primaryG + draft.fruit_serves * SERVE_BUDGET.fruit.primaryG)
              const estF = Math.round(draft.fat_serves * SERVE_BUDGET.fat.primaryG)
              return (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700">Estimated daily <span className="font-normal text-amber-600">(real-food total, incl. ~{vegCal} kcal veg)</span></span>
                    <span className="text-sm font-bold text-amber-800">~{estCal} kcal</span>
                  </div>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-pink-600">~{estP}g P</span>
                    <span className="text-teal-600">~{estC}g C</span>
                    <span className="text-green-600">~{estF}g F</span>
                    <span className="text-gray-400 font-normal">(primary macros only)</span>
                  </div>
                  <p className="text-[11px] text-amber-600">Estimate includes real-food mixed macros (e.g. fat in protein foods, protein in grains) + ~{VEG_KCAL} kcal for veg. Note: the {VEG_KCAL} kcal veg estimate is drawn from the carb budget when auto-assigning from TDEE.</p>
                  <ServeMathBreakdown
                    protein_serves={draft.protein_serves}
                    carb_serves={draft.carb_serves}
                    fat_serves={draft.fat_serves}
                    fruit_serves={draft.fruit_serves}
                    veg_unlimited={draft.veg_unlimited}
                  />
                </div>
              )
            })()}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes for client</label>
              <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="e.g. Choose 2 protein serves at dinner, 1 at lunch…" />
            </div>
            <div className="flex justify-end">
              <button onClick={saveTargets} disabled={savingTargets} className="text-sm font-medium bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {savingTargets ? 'Saving…' : 'Save Targets'}
              </button>
            </div>
          </div>
        ) : targets ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'Protein', value: targets.protein_serves, color: 'bg-pink-50 text-pink-700 border-pink-100' },
                { label: 'Carbs', value: targets.carb_serves, color: 'bg-teal-50 text-teal-700 border-teal-100' },
                { label: 'Fats', value: targets.fat_serves, color: 'bg-green-50 text-green-700 border-green-100' },
                { label: 'Fruit', value: targets.fruit_serves, color: 'bg-orange-50 text-orange-700 border-orange-100' },
                { label: 'Veg', value: targets.veg_unlimited ? '∞' : '—', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl px-4 py-2.5 text-center min-w-[80px] ${s.color}`}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              ~{Math.round(
                targets.protein_serves * SERVE_BUDGET.protein.kcal +
                targets.carb_serves    * SERVE_BUDGET.carb.kcal +
                targets.fat_serves     * SERVE_BUDGET.fat.kcal +
                targets.fruit_serves   * SERVE_BUDGET.fruit.kcal +
                (targets.veg_unlimited ? VEG_KCAL : 0)
              )} kcal/day estimated (real-food total incl. mixed macros + ~{VEG_KCAL} kcal veg) · Veg is unlimited and already included in this estimate.
            </p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <ServeMathBreakdown
                protein_serves={targets.protein_serves}
                carb_serves={targets.carb_serves}
                fat_serves={targets.fat_serves}
                fruit_serves={targets.fruit_serves}
                veg_unlimited={targets.veg_unlimited}
              />
            </div>
            <p className="text-xs text-blue-500">
              Client can now see the &quot;Food Cheat Sheet&quot; link in their food log.
            </p>
            {targets.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{targets.notes}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No targets set yet. Click "Set Targets" above.</p>
        )}
      </div>

      {/* View toggle */}
      <div className="flex items-center gap-3">
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
          <button onClick={() => setView('simple')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'simple' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Simple</button>
          <button onClick={() => setView('detailed')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'detailed' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}>Detailed</button>
        </div>
        <p className="text-xs text-gray-400">Manage the food list in <a href="/coach/cheat-sheet" className="text-blue-500 hover:underline">Cheat Sheet settings</a></p>
      </div>

      {/* Food categories */}
      {foods.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-10 text-center">
          <p className="text-sm text-gray-400">No foods in cheat sheet yet.</p>
          <a href="/coach/cheat-sheet" className="text-xs text-blue-500 hover:underline mt-1 block">Add foods in Cheat Sheet settings →</a>
        </div>
      )}
      {Object.entries(CAT_CONFIG).map(([catId, cfg]) => {
        const catFoods = foods.filter(f => f.serve_category === catId)
        if (catFoods.length === 0) return null
        return (
          <div key={catId} className={`rounded-2xl border border-gray-100 overflow-hidden ${cfg.color}`}>
            <div className="px-5 py-3.5 flex items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900">{cfg.label}</h3>
                <p className="text-xs text-gray-500">{cfg.serve}</p>
              </div>
              <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{catFoods.length}</span>
            </div>
            {view === 'detailed' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-t border-white/60">
                      <th className="text-left px-5 py-2 text-xs font-semibold text-gray-400">Food / Serving</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Cal</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Carbs</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Fat</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right whitespace-nowrap">Protein</th>
                      <th className="px-3 py-2 text-xs font-semibold text-gray-400 text-right">Extra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/60 bg-white/50">
                    {catFoods.map(f => (
                      <tr key={f.id} className="hover:bg-white/80 transition-colors">
                        <td className="px-5 py-2.5">
                          <span className="font-medium text-gray-900">{f.food_name}</span>
                          {f.serving_desc && <span className="text-gray-400 text-xs ml-2">{f.serving_desc}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums text-xs">{f.calories_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-teal-700 font-medium tabular-nums text-xs">{f.carbs_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-green-700 font-medium tabular-nums text-xs">{f.fat_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right text-pink-700 font-medium tabular-nums text-xs">{f.protein_per_serve ?? '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex gap-1 justify-end">
                            {(f.secondary_categories ?? []).map(s => (
                              <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap ${SEC_COLORS[s] ?? 'bg-gray-100 text-gray-500'}`}>
                                {SEC_LABELS[s] ?? s}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 pb-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {catFoods.map(f => (
                  <div key={f.id} className="bg-white rounded-xl px-3.5 py-2.5 flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{f.food_name}</p>
                      {f.serving_desc && <p className="text-xs text-gray-400">{f.serving_desc}</p>}
                      {(f.secondary_categories ?? []).length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {f.secondary_categories.map(s => (
                            <span key={s} className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${SEC_COLORS[s] ?? 'bg-gray-100 text-gray-500'}`}>
                              {SEC_LABELS[s] ?? s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
