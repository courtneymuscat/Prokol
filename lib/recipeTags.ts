// Shared recipe category/diet/tier vocabulary — single source of truth so
// the client recipe browser (app/recipes/page.tsx) and anywhere else a
// client filters recipes (e.g. the meal-plan recipe swap modal) show the
// exact same filter options and labels.

export const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
]

export const DIET_TAG_LABEL: Record<string, string> = { omnivore: 'Omnivore', vegan: 'Vegan', dairy_free: 'Dairy-free' }

export const TIER_TAG_STYLE: Record<string, { label: string; className: string }> = {
  cal_conscious: { label: 'Cal Conscious', className: 'bg-teal-50 text-teal-700' },
  balanced:      { label: 'Balanced',      className: 'bg-indigo-50 text-indigo-700' },
  bigger:        { label: 'Bigger',        className: 'bg-fuchsia-50 text-fuchsia-700' },
  gainer:        { label: 'Gainer',        className: 'bg-rose-50 text-rose-700' },
}

export const DIET_FILTERS = [
  { value: '', label: 'All diets' },
  { value: 'omnivore', label: 'Omnivore' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'dairy_free', label: 'Dairy-free' },
]

export const TIER_FILTERS = [
  { value: '', label: 'All tiers' },
  { value: 'cal_conscious', label: 'Cal Conscious (~400 cals)' },
  { value: 'balanced', label: 'Balanced (~550 cals)' },
  { value: 'bigger', label: 'Bigger (~700 cals)' },
  { value: 'gainer', label: 'Gainer (~850 cals)' },
]
