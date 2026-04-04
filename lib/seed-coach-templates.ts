import { createAdminClient } from '@/lib/supabase/admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID()
}

type LibEx = { id: string; name: string; category: string; equipment: string; video_url: string | null }
type ExResolver = (displayName: string) => LibEx | null

// Map from program display names → exact exercise library names
const NAME_TO_LIBRARY: Record<string, string> = {
  'Barbell Back Squat': 'Squat',
  'Flat Barbell Bench Press': 'Bench Press',
  'Bench Press': 'Bench Press',
  'Bent Over Barbell Row': 'Bent Over Row',
  'Barbell Bent Over Row': 'Bent Over Row',
  'Barbell Row': 'Bent Over Row',
  'Overhead Press': 'Overhead Press',
  'Romanian Deadlift': 'Romanian Deadlift',
  'DB Romanian Deadlift': 'Romanian Deadlift',
  'Plank': 'Plank',
  'Conventional Deadlift': 'Deadlift',
  'Deadlift': 'Deadlift',
  'Incline Dumbbell Press': 'Incline Bench Press',
  'Incline DB Press': 'Incline Bench Press',
  'Lat Pulldown': 'Lat Pulldown',
  'Dumbbell Lateral Raise': 'Lateral Raise',
  'Cable Lateral Raise': 'Lateral Raise',
  'Leg Press': 'Leg Press',
  'Goblet Squat': 'Squat',
  'Front Squat': 'Squat',
  'Dumbbell Bench Press': 'Bench Press',
  'Cable Seated Row': 'Seated Cable Row',
  'Bicep Curl': 'Dumbbell Curl',
  'EZ Bar Curl': 'Barbell Curl',
  'Tricep Pushdown': 'Tricep Pushdown',
  'Tricep Pushdown (Rope)': 'Tricep Pushdown',
  'Overhead Tricep Extension': 'Overhead Tricep Extension',
  'Pull-up / Assisted Pull-up': 'Pull-Up',
  'Pull-up': 'Pull-Up',
  'Weighted Pull-up': 'Pull-Up',
  'Face Pull': 'Face Pull',
  'Hammer Curl': 'Hammer Curl',
  'Reverse Curl': 'Barbell Curl',
  'Lying Leg Curl': 'Leg Curl',
  'Leg Curl': 'Leg Curl',
  'Leg Extension': 'Leg Extension',
  'Standing Calf Raise': 'Calf Raise',
  'Seated Calf Raise': 'Calf Raise',
  'Incline DB Curl': 'Dumbbell Curl',
  'DB Shoulder Press': 'Dumbbell Shoulder Press',
  'Bulgarian Split Squat': 'Bulgarian Split Squat',
  'Cable Crunch': 'Cable Crunch',
  'Ab Rollout': 'Hanging Leg Raise',
  'Hollow Body Hold': 'Plank',
  'Tricep Dip': 'Skull Crusher',
  'Dip': 'Skull Crusher',
}

// Fallback metadata for exercises not in the library
const FALLBACK_META: Record<string, { category: string; equipment: string }> = {
  'Hollow Body Hold': { category: 'core', equipment: 'bodyweight' },
  'Ab Rollout': { category: 'core', equipment: 'other' },
  'Reverse Curl': { category: 'arms', equipment: 'barbell' },
  'Tricep Dip': { category: 'arms', equipment: 'bodyweight' },
  'Dip': { category: 'arms', equipment: 'bodyweight' },
  'Goblet Squat': { category: 'legs', equipment: 'dumbbell' },
  'Front Squat': { category: 'legs', equipment: 'barbell' },
  'Weighted Pull-up': { category: 'back', equipment: 'bodyweight' },
  'Pull-up / Assisted Pull-up': { category: 'back', equipment: 'bodyweight' },
  'DB Romanian Deadlift': { category: 'legs', equipment: 'dumbbell' },
  'Incline DB Curl': { category: 'arms', equipment: 'dumbbell' },
}

function makeEx(resolve: ExResolver, displayName: string, sets: number, reps: string, rest = 90, notes = '') {
  const lib = resolve(displayName)
  const fallback = FALLBACK_META[displayName]
  return {
    type: 'exercise' as const,
    id: uid(),
    exercise_id: lib?.id ?? null,
    name: displayName,
    category: lib?.category ?? fallback?.category ?? 'other',
    equipment: lib?.equipment ?? fallback?.equipment ?? 'other',
    video_url: lib?.video_url ?? '',
    metrics: 'weight+reps' as const,
    showRest: rest > 0,
    notes,
    sets: Array.from({ length: sets }, (_, i) => ({
      id: uid(),
      setNumber: i + 1,
      weight: '',
      reps,
      duration: '',
      calories: '',
      rest: String(rest),
    })),
  }
}

function day(name: string, items: ReturnType<typeof makeEx>[]) {
  return { id: uid(), name, items }
}

function week(label: string, days: ReturnType<typeof day>[]) {
  return { id: uid(), label, days }
}

// ── Program builders ──────────────────────────────────────────────────────────

function buildPrograms(resolve: ExResolver) {
  const ex = (name: string, sets: number, reps: string, rest = 90, notes = '') =>
    makeEx(resolve, name, sets, reps, rest, notes)

  return [
    {
      name: 'Full Body — Beginner 3 Day',
      description: 'A balanced full-body program for beginners. 3 sessions per week with rest days in between.',
      content: [
        week('Week 1', [
          day('Day 1 — Full Body A', [
            ex('Barbell Back Squat', 3, '8–10', 120, 'Focus on depth and keeping chest up'),
            ex('Flat Barbell Bench Press', 3, '8–10', 90),
            ex('Bent Over Barbell Row', 3, '8–10', 90, 'Neutral spine, pull to lower chest'),
            ex('Overhead Press', 3, '8–10', 90),
            ex('Romanian Deadlift', 3, '10–12', 90, 'Hinge at hips, slight knee bend'),
            ex('Plank', 3, '30–45 sec', 60),
          ]),
          day('Day 2 — Rest', []),
          day('Day 3 — Full Body B', [
            ex('Conventional Deadlift', 3, '6–8', 180, 'Brace core, push floor away'),
            ex('Incline Dumbbell Press', 3, '10–12', 90),
            ex('Lat Pulldown', 3, '10–12', 90, 'Full stretch at top, pull to upper chest'),
            ex('Dumbbell Lateral Raise', 3, '12–15', 60),
            ex('Leg Press', 3, '12–15', 90),
            ex('Hollow Body Hold', 3, '20–30 sec', 60),
          ]),
          day('Day 4 — Rest', []),
          day('Day 5 — Full Body C', [
            ex('Goblet Squat', 3, '12–15', 90, 'Great for learning squat pattern'),
            ex('Dumbbell Bench Press', 3, '10–12', 90),
            ex('Cable Seated Row', 3, '10–12', 90),
            ex('DB Romanian Deadlift', 3, '12', 90),
            ex('Bicep Curl', 3, '10–12', 60),
            ex('Tricep Pushdown', 3, '10–12', 60),
          ]),
          day('Day 6 — Rest', []),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    {
      name: 'Push Pull Legs — 6 Day',
      description: '6-day PPL split for intermediate lifters. High frequency and volume for hypertrophy.',
      content: [
        week('Week 1', [
          day('Day 1 — Push', [
            ex('Flat Barbell Bench Press', 4, '6–8', 120, 'Primary chest movement'),
            ex('Overhead Press', 3, '8–10', 90),
            ex('Incline Dumbbell Press', 3, '10–12', 90),
            ex('Cable Lateral Raise', 3, '15–20', 60),
            ex('Tricep Pushdown (Rope)', 3, '12–15', 60),
            ex('Overhead Tricep Extension', 3, '12–15', 60),
          ]),
          day('Day 2 — Pull', [
            ex('Deadlift', 4, '4–6', 180, 'Full reset each rep'),
            ex('Pull-up / Assisted Pull-up', 3, '6–10', 90, 'Full range of motion'),
            ex('Barbell Bent Over Row', 3, '8–10', 90),
            ex('Face Pull', 3, '15–20', 60, 'Essential for shoulder health'),
            ex('Hammer Curl', 3, '10–12', 60),
            ex('Reverse Curl', 2, '12–15', 60),
          ]),
          day('Day 3 — Legs', [
            ex('Barbell Back Squat', 4, '6–8', 180),
            ex('Romanian Deadlift', 3, '10–12', 90),
            ex('Leg Press', 3, '12–15', 90),
            ex('Lying Leg Curl', 3, '12–15', 60),
            ex('Standing Calf Raise', 4, '15–20', 60),
            ex('Ab Rollout', 3, '8–10', 60),
          ]),
          day('Day 4 — Push (repeat)', [
            ex('Flat Barbell Bench Press', 4, '6–8', 120),
            ex('Overhead Press', 3, '8–10', 90),
            ex('Incline Dumbbell Press', 3, '10–12', 90),
            ex('Cable Lateral Raise', 3, '15–20', 60),
            ex('Tricep Pushdown (Rope)', 3, '12–15', 60),
            ex('Overhead Tricep Extension', 3, '12–15', 60),
          ]),
          day('Day 5 — Pull (repeat)', [
            ex('Deadlift', 4, '4–6', 180),
            ex('Pull-up / Assisted Pull-up', 3, '6–10', 90),
            ex('Barbell Bent Over Row', 3, '8–10', 90),
            ex('Face Pull', 3, '15–20', 60),
            ex('Hammer Curl', 3, '10–12', 60),
            ex('Reverse Curl', 2, '12–15', 60),
          ]),
          day('Day 6 — Legs (repeat)', [
            ex('Barbell Back Squat', 4, '6–8', 180),
            ex('Romanian Deadlift', 3, '10–12', 90),
            ex('Leg Press', 3, '12–15', 90),
            ex('Lying Leg Curl', 3, '12–15', 60),
            ex('Standing Calf Raise', 4, '15–20', 60),
            ex('Ab Rollout', 3, '8–10', 60),
          ]),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    {
      name: 'Upper Lower — 4 Day',
      description: '4-day upper/lower split. Great balance of frequency, volume, and recovery for intermediate lifters.',
      content: [
        week('Week 1', [
          day('Day 1 — Upper A (Strength)', [
            ex('Flat Barbell Bench Press', 4, '4–6', 120, 'Heavier, lower reps'),
            ex('Barbell Bent Over Row', 4, '4–6', 120),
            ex('Overhead Press', 3, '6–8', 90),
            ex('Weighted Pull-up', 3, '6–8', 90),
            ex('Incline DB Curl', 3, '10–12', 60),
            ex('Tricep Dip', 3, '10–12', 60),
          ]),
          day('Day 2 — Lower A (Strength)', [
            ex('Barbell Back Squat', 4, '4–6', 180),
            ex('Romanian Deadlift', 3, '8–10', 90),
            ex('Leg Press', 3, '10–12', 90),
            ex('Lying Leg Curl', 3, '10–12', 60),
            ex('Standing Calf Raise', 3, '15', 60),
          ]),
          day('Day 3 — Rest', []),
          day('Day 4 — Upper B (Hypertrophy)', [
            ex('Incline Dumbbell Press', 4, '10–12', 90),
            ex('Cable Seated Row', 4, '10–12', 90),
            ex('DB Shoulder Press', 3, '12–15', 60),
            ex('Lat Pulldown', 3, '10–12', 90),
            ex('Cable Lateral Raise', 3, '15–20', 45),
            ex('Face Pull', 3, '15–20', 45),
            ex('EZ Bar Curl', 3, '12', 60),
          ]),
          day('Day 5 — Lower B (Hypertrophy)', [
            ex('Conventional Deadlift', 4, '4–6', 180, 'Primary hinge pattern'),
            ex('Bulgarian Split Squat', 3, '10–12 each', 90),
            ex('Leg Extension', 3, '12–15', 60),
            ex('Leg Curl', 3, '12–15', 60),
            ex('Seated Calf Raise', 3, '15–20', 45),
            ex('Cable Crunch', 3, '15–20', 45),
          ]),
          day('Day 6 — Rest', []),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    {
      name: 'Strength Foundation — 3 Day',
      description: '4-week linear progression program focused on the big 3 lifts. Ideal for strength-focused clients.',
      content: ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((label, wi) =>
        week(label, [
          day('Day 1 — Squat / Press', [
            ex('Barbell Back Squat', 5, '5', 180, `Week ${wi + 1} — add 2.5 kg from last week`),
            ex('Overhead Press', 5, '5', 120),
            ex('Barbell Row', 3, '8', 90),
            ex('Dumbbell Lateral Raise', 3, '12–15', 60),
            ex('Plank', 3, '45 sec', 45),
          ]),
          day('Day 2 — Rest', []),
          day('Day 3 — Deadlift / Bench', [
            ex('Conventional Deadlift', 1, '5', 180, `Week ${wi + 1} — add 5 kg from last week`),
            ex('Flat Barbell Bench Press', 5, '5', 120),
            ex('Pull-up', 3, 'max', 90),
            ex('Tricep Dip', 3, 'max', 90),
            ex('Ab Rollout', 3, '8–10', 60),
          ]),
          day('Day 4 — Rest', []),
          day('Day 5 — Squat / Press (variation)', [
            ex('Front Squat', 3, '5', 120, 'Lighter variation — focus on technique'),
            ex('Bench Press', 5, '5', 120),
            ex('Barbell Row', 3, '8', 90),
            ex('Face Pull', 3, '15–20', 45),
            ex('Hollow Body Hold', 3, '30 sec', 45),
          ]),
          day('Day 6 — Rest', []),
          day('Day 7 — Rest', []),
        ])
      ),
    },
  ]
}

// ── Meal plan helpers ─────────────────────────────────────────────────────────

function food(food_name: string, grams: number, calories: number, protein: number, carbs: number, fat: number) {
  return { food_name, grams, calories: Math.round(calories), protein: Math.round(protein * 10) / 10, carbs: Math.round(carbs * 10) / 10, fat: Math.round(fat * 10) / 10 }
}

function meal(label: string, foods: ReturnType<typeof food>[]) {
  return { id: uid(), label, foods }
}

// ── Meal Plans ────────────────────────────────────────────────────────────────

const MEAL_PLANS = [
  {
    name: '1,800 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 1800,
    content: [
      meal('Breakfast', [
        food('Oats (dry)', 60, 228, 7.8, 40.2, 4.2),
        food('Greek Yoghurt (0% fat)', 150, 89, 15, 5.4, 0.6),
        food('Banana', 100, 89, 1.1, 23, 0.3),
        food('Whey Protein', 25, 95, 20, 2.5, 1.5),
      ]),
      meal('Lunch', [
        food('Chicken Breast (cooked)', 160, 248, 46.4, 0, 5.4),
        food('Brown Rice (cooked)', 150, 168, 3.9, 34.5, 1.4),
        food('Mixed Salad Leaves', 80, 18, 1.4, 2.8, 0.2),
        food('Olive Oil', 10, 88, 0, 0, 10),
      ]),
      meal('Snack', [
        food('Cottage Cheese', 150, 147, 16.5, 5.1, 6.5),
        food('Rice Cakes', 30, 117, 2.4, 26.4, 0.6),
      ]),
      meal('Dinner', [
        food('Salmon Fillet', 150, 312, 30, 0, 19.5),
        food('Sweet Potato', 200, 172, 3.2, 40, 0.2),
        food('Broccoli (steamed)', 150, 51, 4.2, 10.5, 0.6),
      ]),
    ],
  },

  {
    name: '2,200 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 2200,
    content: [
      meal('Breakfast', [
        food('Whole Eggs', 150, 233, 19.5, 1.7, 16.5),
        food('Wholegrain Toast', 60, 156, 6.6, 28.8, 2.4),
        food('Avocado', 80, 128, 1.6, 7.2, 12),
        food('Orange Juice', 200, 88, 1.4, 20.4, 0.4),
      ]),
      meal('Lunch', [
        food('Chicken Breast (cooked)', 180, 279, 52.2, 0, 6.1),
        food('White Rice (cooked)', 200, 260, 5.4, 56, 0.6),
        food('Mixed Vegetables (stir-fry)', 150, 98, 4.5, 19.5, 0.8),
        food('Soy Sauce', 15, 9, 1.4, 0.9, 0),
      ]),
      meal('Snack', [
        food('Greek Yoghurt', 200, 118, 13.4, 7.2, 0.8),
        food('Mixed Berries', 100, 57, 0.7, 13.8, 0.3),
        food('Almonds', 25, 145, 5.3, 5.5, 12.5),
      ]),
      meal('Dinner', [
        food('Lean Beef Mince (5% fat)', 180, 247, 37.8, 0, 9.9),
        food('Pasta (cooked)', 200, 284, 10, 57, 1.4),
        food('Tomato Pasta Sauce', 100, 45, 1.8, 9, 0.5),
        food('Parmesan (grated)', 15, 61, 5.4, 0.2, 4.2),
      ]),
    ],
  },

  {
    name: '2,800 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 2800,
    content: [
      meal('Breakfast', [
        food('Oats (dry)', 100, 379, 13, 67, 7),
        food('Whole Milk', 300, 183, 9.6, 14.4, 9.9),
        food('Banana', 130, 116, 1.4, 29.9, 0.4),
        food('Whey Protein', 30, 114, 24, 3, 1.8),
        food('Peanut Butter', 20, 118, 5, 4, 10),
      ]),
      meal('Mid-Morning Snack', [
        food('Greek Yoghurt', 200, 118, 13.4, 7.2, 0.8),
        food('Granola', 50, 228, 5, 33, 9),
        food('Apple', 150, 78, 0.4, 20.9, 0.2),
      ]),
      meal('Lunch', [
        food('Chicken Breast (cooked)', 200, 310, 58, 0, 6.8),
        food('White Rice (cooked)', 250, 325, 6.8, 70, 0.8),
        food('Broccoli (steamed)', 150, 51, 4.2, 10.5, 0.6),
        food('Olive Oil', 15, 133, 0, 0, 15),
      ]),
      meal('Pre-Workout Snack', [
        food('Wholegrain Bread', 60, 162, 7.2, 28.8, 2.4),
        food('Tuna (canned in water)', 80, 93, 20.8, 0, 0.8),
      ]),
      meal('Dinner', [
        food('Salmon Fillet', 180, 374, 36, 0, 23.4),
        food('Sweet Potato', 250, 215, 4, 50, 0.3),
        food('Asparagus', 120, 26, 2.9, 4.8, 0.1),
        food('Butter', 10, 72, 0.1, 0, 8.1),
      ]),
    ],
  },

  {
    name: '2,000 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 2000,
    content: [
      meal('Breakfast', [
        food('Egg Whites', 200, 104, 21.6, 1.4, 0.4),
        food('Whole Eggs', 100, 155, 13, 1.1, 10.6),
        food('Oats (dry)', 50, 190, 6.5, 33.5, 3.5),
        food('Blueberries', 100, 57, 0.7, 13.8, 0.3),
      ]),
      meal('Lunch', [
        food('Tuna (canned in water)', 160, 186, 41.6, 0, 1.6),
        food('Sweet Potato', 200, 172, 3.2, 40, 0.2),
        food('Spinach', 100, 23, 2.9, 3.6, 0.4),
        food('Lemon Juice', 15, 4, 0.1, 0.9, 0),
      ]),
      meal('Snack', [
        food('Cottage Cheese', 200, 196, 22, 6.8, 8.6),
        food('Whey Protein', 25, 95, 20, 2.5, 1.5),
        food('Rice Cakes', 25, 98, 2, 22, 0.5),
      ]),
      meal('Dinner', [
        food('Chicken Breast (cooked)', 220, 341, 63.8, 0, 7.5),
        food('Brown Rice (cooked)', 150, 168, 3.9, 34.5, 1.4),
        food('Mixed Vegetables', 200, 130, 6, 26, 1),
        food('Low Sodium Soy Sauce', 10, 6, 0.9, 0.6, 0),
      ]),
    ],
  },

  {
    name: '1,900 kcal — Vegan',
    goal: 'vegan',
    total_calories: 1900,
    content: [
      meal('Breakfast', [
        food('Oats (dry)', 80, 303, 10.4, 53.6, 5.6),
        food('Soy Milk', 250, 108, 8.3, 9.8, 4.5),
        food('Chia Seeds', 20, 97, 3.3, 8.4, 6.1),
        food('Mixed Berries', 120, 68, 0.8, 16.6, 0.4),
        food('Maple Syrup', 10, 26, 0, 6.7, 0),
      ]),
      meal('Lunch', [
        food('Chickpeas (cooked)', 200, 330, 17.8, 54.4, 5.4),
        food('Quinoa (cooked)', 150, 182, 6.7, 33, 2.9),
        food('Baby Spinach', 80, 18, 2.3, 2.9, 0.3),
        food('Cherry Tomatoes', 100, 18, 0.9, 3.9, 0.2),
        food('Tahini', 15, 89, 2.6, 3.2, 8),
        food('Lemon Juice', 20, 5, 0.2, 1.2, 0),
      ]),
      meal('Snack', [
        food('Almonds', 30, 174, 6.3, 6.5, 15),
        food('Apple', 150, 78, 0.4, 20.9, 0.2),
        food('Vegan Protein Powder', 30, 120, 22, 4, 2),
      ]),
      meal('Dinner', [
        food('Tofu (firm)', 200, 162, 17.2, 3.6, 9.2),
        food('Brown Rice (cooked)', 180, 202, 4.7, 41.4, 1.6),
        food('Broccoli (steamed)', 150, 51, 4.2, 10.5, 0.6),
        food('Red Bell Pepper', 120, 37, 1.1, 8.4, 0.3),
        food('Sesame Oil', 10, 88, 0, 0, 10),
        food('Soy Sauce', 15, 9, 1.4, 0.9, 0),
      ]),
    ],
  },
]

// ── Seed function ─────────────────────────────────────────────────────────────

const SENTINEL_PROGRAM = 'Full Body — Beginner 3 Day'
const SENTINEL_PLAN = '1,800 kcal — Omnivore'

export async function seedCoachTemplates(coachId: string): Promise<void> {
  const admin = createAdminClient()

  const [{ data: existingProg }, { data: existingPlan }, { data: libExercises }] = await Promise.all([
    admin.from('programs').select('id, content').eq('coach_id', coachId).eq('name', SENTINEL_PROGRAM).maybeSingle(),
    admin.from('meal_plans').select('id').eq('coach_id', coachId).eq('name', SENTINEL_PLAN).maybeSingle(),
    admin.from('exercises').select('id, name, category, equipment, video_url').eq('is_custom', false),
  ])

  // Build name → exercise map (case-insensitive)
  const byName: Record<string, LibEx> = {}
  for (const ex of libExercises ?? []) {
    byName[ex.name.toLowerCase()] = ex
  }

  function resolve(displayName: string): LibEx | null {
    const libName = NAME_TO_LIBRARY[displayName] ?? displayName
    return byName[libName.toLowerCase()] ?? null
  }

  // Detect old-format programs (exercises stored as flat {name,sets,reps,...} without exercise_id)
  function isOldFormat(prog: { content: unknown } | null): boolean {
    if (!prog) return false
    const weeks = prog.content as { days?: { exercises?: unknown[]; items?: unknown[] }[] }[] | null
    const firstDay = weeks?.[0]?.days?.[0]
    if (!firstDay) return false
    // Old format has `exercises` array; new format has `items` array
    return Array.isArray((firstDay as { exercises?: unknown[] }).exercises)
  }

  const needsReseed = !existingProg || isOldFormat(existingProg)

  if (needsReseed) {
    // Delete all seeded program templates for this coach so we can re-insert with linked exercises
    const SEEDED_NAMES = [
      'Full Body — Beginner 3 Day',
      'Push Pull Legs — 6 Day',
      'Upper Lower — 4 Day',
      'Strength Foundation — 3 Day',
    ]
    await admin.from('programs').delete().eq('coach_id', coachId).in('name', SEEDED_NAMES)

    const programs = buildPrograms(resolve)
    await admin.from('programs').insert(
      programs.map((p) => ({ coach_id: coachId, name: p.name, description: p.description, content: p.content }))
    )
  }

  if (!existingPlan) {
    await admin.from('meal_plans').insert(
      MEAL_PLANS.map((p) => ({ coach_id: coachId, name: p.name, goal: p.goal, total_calories: p.total_calories, content: p.content }))
    )
  }
}
