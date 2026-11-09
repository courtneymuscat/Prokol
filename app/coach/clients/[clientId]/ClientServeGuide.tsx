'use client'

import { useState, useEffect } from 'react'
import { VEG_KCAL, VEG_RESERVE_CARB_G } from '@/lib/autoAssignNutrition'

// ─── ClientServeGuide ─────────────────────────────────────────────────────────

type ServeFood = {
  id: string; food_name: string; serving_desc: string | null
  calories_per_serve: number | null; protein_per_serve: number | null
  carbs_per_serve: number | null; fat_per_serve: number | null
  serve_category: string; secondary_categories: string[]
}
type ServeTargets = {
  protein_serves: number; carb_serves: number; fat_serves: number
  veg_unlimited: boolean; notes: string | null
} | null

// 'fruit' foods are tagged 'carb' now — a fruit serve is just 20g carbs,
// same unit as any other carb source, so it's folded into the Carbs
// category rather than tracked as its own bucket. If a client should get
// some of their carb serves specifically from fruit, that's a line in the
// notes below, not a separate target.
const CAT_CONFIG: Record<string, { label: string; serve: string; badge: string; color: string }> = {
  protein:   { label: 'Protein',      serve: '1 serve ≈ 30g protein',  badge: 'bg-pink-100 text-pink-700',    color: 'bg-pink-50' },
  carb:      { label: 'Carbs',        serve: '1 serve ≈ 20g carbs (includes fruit)', badge: 'bg-teal-100 text-teal-700',color: 'bg-teal-50' },
  fat:       { label: 'Fats',         serve: '1 serve ≈ 10g fat',      badge: 'bg-green-100 text-green-700',  color: 'bg-green-50' },
  condiment: { label: 'Condiments',   serve: '~1 fat or carb serve',   badge: 'bg-blue-100 text-blue-700',    color: 'bg-blue-50' },
  free:      { label: 'Free Foods',   serve: 'Unlimited',              badge: 'bg-gray-100 text-gray-600',    color: 'bg-gray-50' },
}
const SEC_LABELS: Record<string, string> = { fat: '+ 1 fat', carb: '+ 1 carb', fat_half: '+ ½ fat', carb_half: '+ ½ carb', protein_half: '+ ½ protein', protein: '+ 1 protein' }
const SEC_COLORS: Record<string, string> = { fat: 'bg-green-100 text-green-700', carb: 'bg-teal-100 text-teal-700', fat_half: 'bg-green-50 text-green-600', carb_half: 'bg-teal-50 text-teal-600', protein_half: 'bg-pink-50 text-pink-600', protein: 'bg-pink-100 text-pink-700' }

// Reconstructs the real grams/calories behind a set of serve targets —
// same formula as macrosToServes (lib/autoAssignNutrition.ts) run in
// reverse: 30g protein/serve, 20g carbs/serve (+ the flat veg reserve),
// 10g fat/serve, standard 4/4/9 kcal-per-gram. This is the SAME formula
// the meal plan's own explainer (ServeCalcNote.tsx) uses on real food —
// unified so "X carb serves" always means the same real grams everywhere
// on the platform, whether the target came from a meal plan or a TDEE
// figure (see macrosToServes' own comment for why that used to drift).
function estimateFromServes(protein_serves: number, carb_serves: number, fat_serves: number, veg_unlimited: boolean) {
  const proteinG = protein_serves * 30
  const carbG = carb_serves * 20 + (veg_unlimited ? VEG_RESERVE_CARB_G : 0)
  const fatG = fat_serves * 10
  const kcal = proteinG * 4 + carbG * 4 + fatG * 9
  return { proteinG, carbG, fatG, kcal }
}

function ServeMathBreakdown({
  protein_serves, carb_serves, fat_serves, veg_unlimited,
}: {
  protein_serves: number; carb_serves: number; fat_serves: number; veg_unlimited: boolean
}) {
  const { proteinG, carbG, fatG, kcal: totalKcal } = estimateFromServes(protein_serves, carb_serves, fat_serves, veg_unlimited)
  const lines = [
    { label: 'Protein', serves: protein_serves, perServeG: 30, grams: proteinG, kcalPerG: 4 },
    { label: 'Carbs',   serves: carb_serves,    perServeG: 20, grams: carb_serves * 20, kcalPerG: 4 },
    { label: 'Fats',    serves: fat_serves,     perServeG: 10, grams: fatG, kcalPerG: 9 },
  ]
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
            <li><span className="font-semibold">Protein:</span> 30g protein = 1 serve</li>
            <li><span className="font-semibold">Carbs:</span> 20g carbs = 1 serve (includes fruit — same unit)</li>
            <li><span className="font-semibold">Fats:</span> 10g fat = 1 serve</li>
            {veg_unlimited && (
              <li><span className="font-semibold">Veg (∞):</span> ~{VEG_RESERVE_CARB_G}g carbs (~{VEG_KCAL} kcal) held back from the Carbs serve count above</li>
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
                  <td className="py-0.5 pr-2 tabular-nums">{l.serves} × {l.perServeG}g</td>
                  <td className="py-0.5 pr-2 tabular-nums">= {Math.round(l.grams)}g</td>
                  <td className="py-0.5 tabular-nums text-amber-600">{Math.round(l.grams * l.kcalPerG)} kcal</td>
                </tr>
              ))}
              {veg_unlimited && (
                <tr>
                  <td className="py-0.5 pr-2 font-medium">Veg (held back from Carbs)</td>
                  <td className="py-0.5 pr-2 tabular-nums">flat</td>
                  <td className="py-0.5 pr-2 tabular-nums">= {VEG_RESERVE_CARB_G}g</td>
                  <td className="py-0.5 tabular-nums text-amber-600">{VEG_KCAL} kcal</td>
                </tr>
              )}
              <tr className="border-t border-amber-100">
                <td className="py-0.5 pr-2 font-semibold pt-1">Total</td>
                <td className="py-0.5 pr-2" />
                <td className="py-0.5 pr-2" />
                <td className="py-0.5 tabular-nums font-semibold pt-1">= {Math.round(totalKcal)} kcal</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[10px] text-amber-600 mt-1.5 leading-snug">
            These are the real grams each serve count stands for — same formula the meal plan&apos;s own serve breakdown uses. Real food will land close to this but rarely exactly on it (a leaner or fattier choice than average shifts the real total a little either way), which is why this is a close estimate, not an exact prescription.
          </p>
        </div>
      </div>
    </details>
  )
}

export default function ClientServeGuide({
  clientId,
  showServeTargets,
  onToggleServeTargets,
  savingVisibility,
}: {
  clientId: string
  // Shared with App Preview's "Show serve targets" toggle — passed down
  // from ClientTabs (same state App Preview reads/writes) rather than
  // fetched independently here, so the two can never disagree about
  // whether the toggle is on, even when both stay mounted at once under
  // ClientTabs' tab-caching.
  showServeTargets: boolean
  onToggleServeTargets: () => void
  savingVisibility: boolean
}) {
  const [foods, setFoods] = useState<ServeFood[]>([])
  const [targets, setTargets] = useState<ServeTargets>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'simple' | 'detailed'>('simple')
  const [editingTargets, setEditingTargets] = useState(false)
  const [draft, setDraft] = useState({ protein_serves: 0, carb_serves: 0, fat_serves: 0, veg_unlimited: true, notes: '' })
  const [savingTargets, setSavingTargets] = useState(false)

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
  }

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading…</div>

  return (
    <div className="space-y-5">
      {/* Points the coach at the Cheat Sheet — where the serve-category
          mechanics (what counts as 1 serve of what) actually live and get
          managed, rather than duplicating that explanation here. */}
      <a
        href="/coach/cheat-sheet"
        className="flex items-center justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 hover:bg-indigo-100 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📋</span>
          <p className="text-xs text-indigo-800">
            <span className="font-semibold">Not sure how the Serve Guide works?</span> The Cheat Sheet explains it and is where you manage which foods count as a serve.
          </p>
        </div>
        <svg className="w-4 h-4 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>

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
            <button onClick={() => setEditingTargets(v => !v)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
              {editingTargets ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        <div className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 mb-4 ${showServeTargets ? 'bg-gray-50 border border-gray-100' : 'bg-amber-50 border border-amber-100'}`}>
          <div className="flex items-center gap-2">
            <span className="text-sm">{showServeTargets ? '👁️' : '🙈'}</span>
            <p className={`text-xs ${showServeTargets ? 'text-gray-500' : 'text-amber-700 font-medium'}`}>
              {showServeTargets ? 'Client can see serve targets in their app' : 'Hidden from client — they won\'t see serve targets in Food Log or Cheat Sheet'}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleServeTargets}
            disabled={savingVisibility}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${showServeTargets ? 'bg-blue-600' : 'bg-gray-300'}`}
            aria-label="Toggle whether the client can see serve targets"
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${showServeTargets ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        {editingTargets ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-teal-50 border border-teal-100 rounded-xl px-3 py-2.5">
              <svg className="w-4 h-4 text-teal-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs text-teal-700">These are auto-calculated from the client&apos;s daily target (TDEE or meal plan) — adjust below if you want to deviate from the formula.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'protein_serves', label: 'Protein', color: 'text-pink-600' },
                { key: 'carb_serves', label: 'Carbs', color: 'text-teal-600' },
                { key: 'fat_serves', label: 'Fats', color: 'text-green-600' },
              ] as const).map(({ key, label, color }) => (
                <div key={key}>
                  <label className={`text-xs font-medium block mb-1 ${color}`}>{label} serves</label>
                  <input type="number" min="0" max="20" step="0.5"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))} />
                  {key === 'carb_serves' && draft.veg_unlimited && (
                    <p className="text-[10px] text-teal-600 mt-1 leading-snug">
                      ~{Math.round(VEG_KCAL / 4)}g (~{VEG_KCAL} kcal) of this is already set aside for veg
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 -mt-2">
              Carbs includes fruit — 1 fruit serve is just 20g carbs, same as any other carb source. If this client should get some carb serves specifically from fruit, say so in the notes below (e.g. &quot;aim for 2 of your carb serves to come from fruit&quot;).
            </p>
            {draft.veg_unlimited && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 -mt-1">
                Veg is flexible, not calorie-free — leave room for it when setting Carbs. A typical day&apos;s veg adds ~{VEG_KCAL} kcal (~{Math.round(VEG_KCAL / 4)}g carbs) on top of meals. A client who fully uses all their carb serves AND eats a lot of veg on top will see a real surplus, not a free pass.
              </p>
            )}
            {/* Estimated daily calories + macros */}
            {(draft.protein_serves > 0 || draft.carb_serves > 0 || draft.fat_serves > 0) && (() => {
              const est = estimateFromServes(draft.protein_serves, draft.carb_serves, draft.fat_serves, draft.veg_unlimited)
              return (
                <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-amber-700">Estimated daily <span className="font-normal text-amber-600">(incl. ~{VEG_RESERVE_CARB_G}g veg carbs)</span></span>
                    <span className="text-sm font-bold text-amber-800">~{Math.round(est.kcal)} kcal</span>
                  </div>
                  <div className="flex gap-3 text-xs font-semibold">
                    <span className="text-pink-600">{Math.round(est.proteinG)}g P</span>
                    <span className="text-teal-600">{Math.round(est.carbG)}g C</span>
                    <span className="text-green-600">{Math.round(est.fatG)}g F</span>
                  </div>
                  <p className="text-[11px] text-amber-600">Real grams these serves stand for, same formula as the meal plan&apos;s own serve breakdown — includes ~{VEG_RESERVE_CARB_G}g carbs (~{VEG_KCAL} kcal) held back for veg.</p>
                  <ServeMathBreakdown
                    protein_serves={draft.protein_serves}
                    carb_serves={draft.carb_serves}
                    fat_serves={draft.fat_serves}
                    veg_unlimited={draft.veg_unlimited}
                  />
                </div>
              )
            })()}
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes for client</label>
              <textarea rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} placeholder="e.g. Choose 2 protein serves at dinner, 1 at lunch. Aim for 2 of your carb serves to come from fruit…" />
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
                { label: 'Veg', value: targets.veg_unlimited ? '∞' : '—', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
              ].map(s => (
                <div key={s.label} className={`border rounded-xl px-4 py-2.5 text-center min-w-[80px] ${s.color}`}>
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-xs mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400">
              ~{Math.round(estimateFromServes(targets.protein_serves, targets.carb_serves, targets.fat_serves, targets.veg_unlimited).kcal)} kcal/day estimated (incl. ~{VEG_KCAL} kcal veg). Carbs includes fruit.
            </p>
            {targets.veg_unlimited && (
              <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                Veg is flexible, not calorie-free — a typical day&apos;s veg adds ~{VEG_KCAL} kcal (~{Math.round(VEG_KCAL / 4)}g carbs), already factored into the estimate above. Fully using all carb serves AND eating a lot of veg on top is a real surplus, not a free pass.
              </p>
            )}
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
              <ServeMathBreakdown
                protein_serves={targets.protein_serves}
                carb_serves={targets.carb_serves}
                fat_serves={targets.fat_serves}
                veg_unlimited={targets.veg_unlimited}
              />
            </div>
            <p className="text-xs text-blue-500">
              Client can now see the &quot;Food Cheat Sheet&quot; link in their food log.
            </p>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5 space-y-1">
              <p className="text-xs font-semibold text-indigo-900">Worth knowing: this is an estimate, on purpose</p>
              <p className="text-[11px] text-indigo-700 leading-relaxed">
                That&apos;s a feature, not a gap — the whole point of serves is to give a client a simple number to hit instead of weighing every gram, which is exactly what reduces overwhelm for someone who&apos;d otherwise be tracking exact macros. The trade-off is that what they actually log will land close to ~{Math.round(estimateFromServes(targets.protein_serves, targets.carb_serves, targets.fat_serves, targets.veg_unlimited).kcal)} kcal, not exactly on it — real food rarely lines up perfectly with a 30g/20g/10g serve boundary, so a day that logs a little either side of this estimate isn&apos;t doing it wrong.
              </p>
            </div>
            {targets.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 whitespace-pre-wrap">{targets.notes}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No daily target set yet for this client — calculate one above and serves will populate automatically. Or click &quot;Edit&quot; to set them directly.</p>
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
