import { createAdminClient } from '@/lib/supabase/admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomUUID()
}

type LibEx = { id: string; name: string; category: string; equipment: string; video_url: string | null }
type ExResolver = (displayName: string) => LibEx | null

// Map from friendly display names → exact exercise library names (only where they differ)
const NAME_TO_LIBRARY: Record<string, string> = {
  'Barbell Bench Press': 'Barbell Bench Press - Medium Grip',
}

function makeEx(resolve: ExResolver, displayName: string, sets: number, reps: string, rest = 90, notes = '') {
  const lib = resolve(displayName)
  return {
    type: 'exercise' as const,
    id: uid(),
    exercise_id: lib?.id ?? null,
    name: displayName,
    category: lib?.category ?? 'other',
    equipment: lib?.equipment ?? 'other',
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

type ScoreType = 'time' | 'reps' | 'rounds' | 'weight' | 'distance' | 'calories' | 'custom'

function section(title: string, notes = '', scoreType: ScoreType | 'none' = 'none', scoreValue = '') {
  return { type: 'section' as const, id: uid(), title, notes, scoreType, scoreValue }
}

type DayItem = ReturnType<typeof makeEx> | ReturnType<typeof section>

function day(name: string, items: DayItem[]) {
  return { id: uid(), name, items }
}

function week(label: string, days: ReturnType<typeof day>[]) {
  return { id: uid(), label, days }
}

// ── Program builders ──────────────────────────────────────────────────────────

function buildPrograms(resolve: ExResolver) {
  const ex = (name: string, sets: number, reps: string, rest = 90, notes = '') =>
    makeEx(resolve, name, sets, reps, rest, notes)
  const sec = (title: string, notes = '', scoreType: ScoreType | 'none' = 'none', scoreValue = '') => section(title, notes, scoreType, scoreValue)

  return [
    // ── 1. Full Body — Beginner 3 Day ────────────────────────────────────────
    {
      name: 'Full Body — Beginner 3 Day',
      description: 'A balanced full-body program for beginners. 3 sessions per week with rest days in between.',
      content: [
        week('Week 1', [
          day('Day 1 — Full Body A', [
            ex('Barbell Squat', 3, '8–10', 120, 'Focus on depth and keeping chest up'),
            ex('Barbell Bench Press', 3, '8–10', 90),
            ex('Bent Over Barbell Row', 3, '8–10', 90, 'Neutral spine, pull to lower chest'),
            ex('Barbell Shoulder Press', 3, '8–10', 90),
            ex('Romanian Deadlift', 3, '10–12', 90, 'Hinge at hips, soft knee bend'),
            ex('Plank', 3, '30–45 sec', 60),
          ]),
          day('Day 2 — Rest', []),
          day('Day 3 — Full Body B', [
            ex('Barbell Deadlift', 3, '5', 180, 'Brace core, push the floor away'),
            ex('Incline Dumbbell Press', 3, '10–12', 90),
            ex('Wide-Grip Lat Pulldown', 3, '10–12', 90, 'Full stretch at top, pull to upper chest'),
            ex('Side Lateral Raise', 3, '12–15', 60),
            ex('Leg Press', 3, '12–15', 90),
            ex('Dead Bug', 3, '10 each side', 60),
          ]),
          day('Day 4 — Rest', []),
          day('Day 5 — Full Body C', [
            ex('Goblet Squat', 3, '12–15', 90, 'Great for learning squat pattern'),
            ex('Dumbbell Bench Press', 3, '10–12', 90),
            ex('Seated Cable Rows', 3, '10–12', 90),
            ex('Romanian Deadlift', 3, '12', 90),
            ex('Barbell Curl', 3, '10–12', 60),
            ex('Triceps Pushdown', 3, '10–12', 60),
          ]),
          day('Day 6 — Rest', []),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    // ── 2. Push Pull Legs — 6 Day (with sections) ────────────────────────────
    {
      name: 'Push Pull Legs — 6 Day',
      description: '6-day PPL split for intermediate lifters. High frequency and volume for hypertrophy. Each session is divided into muscle group sections.',
      content: [
        week('Week 1', [
          day('Day 1 — Push', [
            sec('Chest', 'Prioritise full range of motion and a strong chest stretch at the bottom'),
            ex('Barbell Bench Press', 4, '6–8', 120, 'Primary chest movement — control the descent'),
            ex('Incline Dumbbell Press', 3, '10–12', 90),
            ex('Dumbbell Flyes', 3, '12–15', 60, 'Light weight, emphasise the stretch'),
            sec('Shoulders'),
            ex('Barbell Shoulder Press', 3, '8–10', 90),
            ex('Side Lateral Raise', 3, '15–20', 60),
            ex('Front Dumbbell Raise', 2, '12–15', 45),
            sec('Triceps'),
            ex('Triceps Pushdown', 3, '12–15', 60),
            ex('Cable Rope Overhead Triceps Extension', 3, '12–15', 60),
          ]),
          day('Day 2 — Pull', [
            sec('Back', 'Focus on scapular retraction and keeping elbows close to your sides'),
            ex('Barbell Deadlift', 4, '4–6', 180, 'Full reset each rep'),
            ex('Bent Over Barbell Row', 3, '8–10', 90, 'Brace core, pull to lower chest'),
            ex('Wide-Grip Lat Pulldown', 3, '10–12', 90),
            ex('Seated Cable Rows', 3, '10–12', 90),
            sec('Rear Delts', 'Essential for shoulder health and posture'),
            ex('Face Pull', 3, '15–20', 60),
            ex('Seated Bent-Over Rear Delt Raise', 3, '12–15', 45),
            sec('Biceps'),
            ex('Barbell Curl', 3, '10–12', 60),
            ex('Hammer Curls', 3, '10–12', 60),
          ]),
          day('Day 3 — Legs', [
            sec('Quads & Glutes'),
            ex('Barbell Squat', 4, '6–8', 180, 'Drive knees out and stay tall through the lift'),
            ex('Leg Press', 3, '12–15', 90),
            ex('Leg Extensions', 3, '15–20', 60),
            sec('Hamstrings & Glutes'),
            ex('Romanian Deadlift', 3, '10–12', 90, 'Push hips back, keep bar close'),
            ex('Lying Leg Curls', 3, '12–15', 60),
            ex('Barbell Hip Thrust', 3, '12–15', 90, 'Full hip extension at top, squeeze glutes'),
            sec('Calves & Core'),
            ex('Standing Calf Raises', 4, '15–20', 60, 'Pause at top for 1 sec'),
            ex('Cable Crunch', 3, '15–20', 45),
          ]),
          day('Day 4 — Push (repeat)', [
            sec('Chest'),
            ex('Barbell Bench Press', 4, '6–8', 120),
            ex('Incline Dumbbell Press', 3, '10–12', 90),
            ex('Dumbbell Flyes', 3, '12–15', 60),
            sec('Shoulders'),
            ex('Barbell Shoulder Press', 3, '8–10', 90),
            ex('Side Lateral Raise', 3, '15–20', 60),
            ex('Front Dumbbell Raise', 2, '12–15', 45),
            sec('Triceps'),
            ex('Triceps Pushdown', 3, '12–15', 60),
            ex('Cable Rope Overhead Triceps Extension', 3, '12–15', 60),
          ]),
          day('Day 5 — Pull (repeat)', [
            sec('Back'),
            ex('Barbell Deadlift', 4, '4–6', 180),
            ex('Bent Over Barbell Row', 3, '8–10', 90),
            ex('Wide-Grip Lat Pulldown', 3, '10–12', 90),
            ex('Seated Cable Rows', 3, '10–12', 90),
            sec('Rear Delts'),
            ex('Face Pull', 3, '15–20', 60),
            ex('Seated Bent-Over Rear Delt Raise', 3, '12–15', 45),
            sec('Biceps'),
            ex('Barbell Curl', 3, '10–12', 60),
            ex('Hammer Curls', 3, '10–12', 60),
          ]),
          day('Day 6 — Legs (repeat)', [
            sec('Quads & Glutes'),
            ex('Barbell Squat', 4, '6–8', 180),
            ex('Leg Press', 3, '12–15', 90),
            ex('Leg Extensions', 3, '15–20', 60),
            sec('Hamstrings & Glutes'),
            ex('Romanian Deadlift', 3, '10–12', 90),
            ex('Lying Leg Curls', 3, '12–15', 60),
            ex('Barbell Hip Thrust', 3, '12–15', 90),
            sec('Calves & Core'),
            ex('Standing Calf Raises', 4, '15–20', 60),
            ex('Cable Crunch', 3, '15–20', 45),
          ]),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    // ── 3. Upper Lower — 4 Day (with sections) ───────────────────────────────
    {
      name: 'Upper Lower — 4 Day',
      description: '4-day upper/lower split. Great balance of frequency, volume, and recovery for intermediate lifters. Days are grouped by movement pattern.',
      content: [
        week('Week 1', [
          day('Day 1 — Upper A (Strength)', [
            sec('Horizontal Push & Pull', 'Heavy compound work — aim for progressive overload each week'),
            ex('Barbell Bench Press', 4, '4–6', 120, 'Heavier, lower reps — pause at chest'),
            ex('Bent Over Barbell Row', 4, '4–6', 120, 'Match bench sets/reps for balance'),
            sec('Vertical Push & Pull'),
            ex('Barbell Shoulder Press', 3, '6–8', 90),
            ex('Pullups', 3, '6–10', 90, 'Full range — dead hang to chin over bar'),
            sec('Arms'),
            ex('EZ-Bar Curl', 3, '10–12', 60),
            ex('Close-Grip Barbell Bench Press', 3, '10–12', 60),
          ]),
          day('Day 2 — Lower A (Strength)', [
            sec('Compound Lifts', 'Prioritise depth and bracing — progressive overload weekly'),
            ex('Barbell Squat', 4, '4–6', 180, 'Competition-depth squat'),
            ex('Romanian Deadlift', 3, '8–10', 90, 'Controlled descent, feel the hamstring stretch'),
            sec('Isolation'),
            ex('Leg Press', 3, '10–12', 90),
            ex('Seated Leg Curl', 3, '10–12', 60),
            ex('Standing Calf Raises', 3, '15', 60),
          ]),
          day('Day 3 — Rest', []),
          day('Day 4 — Upper B (Hypertrophy)', [
            sec('Chest & Back', 'Higher reps and shorter rest — focus on the muscle, not the weight'),
            ex('Incline Dumbbell Press', 4, '10–12', 90),
            ex('One-Arm Dumbbell Row', 4, '10–12 each', 90),
            ex('Dumbbell Flyes', 3, '12–15', 60),
            ex('Wide-Grip Lat Pulldown', 3, '10–12', 90),
            sec('Shoulders'),
            ex('Dumbbell Shoulder Press', 3, '12–15', 60),
            ex('Side Lateral Raise', 3, '15–20', 45),
            ex('Face Pull', 3, '15–20', 45, 'Essential for shoulder health'),
            sec('Arms'),
            ex('Hammer Curls', 3, '12', 60),
            ex('Triceps Pushdown - Rope Attachment', 3, '12–15', 60),
          ]),
          day('Day 5 — Lower B (Hypertrophy)', [
            sec('Compound', 'Primary hinge and lunge patterns'),
            ex('Barbell Deadlift', 4, '4–6', 180, 'Drive through the floor — lock out hard'),
            ex('Barbell Lunge', 3, '10–12 each', 90),
            sec('Isolation'),
            ex('Leg Extensions', 3, '12–15', 60),
            ex('Lying Leg Curls', 3, '12–15', 60),
            ex('Standing Calf Raises', 3, '15–20', 45),
            ex('Cable Crunch', 3, '15–20', 45),
          ]),
          day('Day 6 — Rest', []),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    // ── 4. CrossFit Foundations — 5 Day (WOD-style sections with scoring) ────
    {
      name: 'CrossFit Foundations — 5 Day',
      description: '5-day CrossFit program structured around WOD-style sessions. Each day is broken into Warm Up, Skill/Strength, and Metcon sections — every section has a score type so clients can log their result.',
      content: [
        week('Week 1', [
          day('Day 1 — Squat & Conditioning', [
            sec('Warm Up', '3 rounds: 10 air squats, 10 hip circles each side, 5 inchworms, 200m easy row or bike', 'none'),
            sec('Strength — Back Squat', '5 sets of 5 reps\nBuild to a heavy set of 5. Rest 2–3 min between sets.\nRecord your heaviest set.', 'weight'),
            ex('Barbell Squat', 5, '5', 180, 'Build to a heavy 5 — add weight each set'),
            sec('Metcon — AMRAP 12', 'AMRAP 12 min:\n• 10 Goblet Squats (32/24 kg)\n• 10 Hand-Release Push-Ups\n• 5 Pullups\n\nScore = total rounds + reps completed.', 'rounds'),
            ex('Goblet Squat', 3, '10', 0),
            ex('Pullups', 3, '5', 0),
            sec('Cool Down', '400m easy walk, couch stretch 2 min each side, pigeon pose 90 sec each side', 'none'),
          ]),
          day('Day 2 — Deadlift & Sprint', [
            sec('Warm Up', '2 rounds: 10 Romanian deadlifts (empty bar), 10 banded good mornings, 10 hip hinges, 30 sec dead hang', 'none'),
            sec('Strength — Deadlift', '5–3–1+ progression:\n• Set 1: 5 reps @ 65%\n• Set 2: 3 reps @ 75%\n• Set 3: max reps @ 85%+\n\nScore = reps on final set.', 'reps'),
            ex('Barbell Deadlift', 3, '5/3/max', 180, '65 → 75 → 85% of 1RM — go for broke on the last set'),
            sec('Metcon — For Time', '21-15-9 reps for time:\n• Barbell Deadlifts (100/70 kg)\n• Box Jumps (60/50 cm)\n\nTime cap: 10 min. Score = finish time or reps completed at cap.', 'time'),
            ex('Barbell Deadlift', 3, '21-15-9', 0, 'Moderate weight — unbroken sets if possible'),
            ex('Barbell Hip Thrust', 3, '21-15-9', 0, 'Sub for box jumps — full hip extension'),
            sec('Cool Down', 'Foam roll hamstrings and glutes, 90/90 hip stretch, cat-cow 1 min', 'none'),
          ]),
          day('Day 3 — Gymnastics & Row', [
            sec('Warm Up', 'EMOM 6 min (alternating):\nOdd: 5 scapular pull-ups + 5 ring rows\nEven: 10 banded pull-aparts + 10 shoulder circles', 'none'),
            sec('Skill — Strict Pull-Up Ladder', 'Every 2 min for 10 min (5 rounds):\nMax strict pull-ups per round.\n\nScore = total reps across all 5 rounds.', 'reps'),
            ex('Pullups', 5, 'max', 120, 'Strict — no kipping. Rest remainder of 2 min window.'),
            ex('Bent Over Barbell Row', 3, '8–10', 90, 'Horizontal pulling accessory'),
            sec('Metcon — Row / Run Intervals', '5 rounds for time:\n• 400m row (or 400m run)\n• 15 Kettlebell Swings (32/24 kg)\n• 10 Toes to Bar\n\nScore = total time.', 'time'),
            ex('Toes to Bar', 3, '10', 0),
            sec('Cool Down', 'Lat stretch on rig 60 sec each side, thoracic foam roll, doorway chest opener', 'none'),
          ]),
          day('Day 4 — Press & Chipper', [
            sec('Warm Up', '3 rounds: 10 PVC overhead squats, 10 band pull-aparts, 5 wall slides, 10 scap push-ups', 'none'),
            sec('Strength — Push Press', '4 sets of 5 reps\nBuild to a tough set of 5 push press.\nScore = heaviest set completed.', 'weight'),
            ex('Barbell Shoulder Press', 4, '5', 120, 'Push press — use legs to drive the bar overhead'),
            ex('Side Lateral Raise', 3, '15', 60, 'Shoulder health accessory'),
            sec('Metcon — Chipper', 'For time:\n• 50 Double-Unders (or 100 singles)\n• 40 Wall Balls (9/6 kg to 10 ft target)\n• 30 Hand-Release Push-Ups\n• 20 Dumbbell Thrusters (2×22.5/15 kg)\n• 10 Pullups\n\nScore = total time. Cap: 18 min.', 'time'),
            ex('Dumbbell Shoulder Press', 3, '20', 0, 'Sub for dumbbell thrusters'),
            ex('Pullups', 1, '10', 0),
            sec('Cool Down', 'Wrist and shoulder mobility, pigeon stretch, 5 min easy bike or walk', 'none'),
          ]),
          day('Day 5 — Total & Hero WOD', [
            sec('Warm Up', '10 min general warm-up: 500m row, then 2 rounds of 10 air squats, 10 push-ups, 10 sit-ups, 5 pull-ups', 'none'),
            sec('Skill — Handstand / Gymnastics Practice', '10 min EMOM:\nOdd: 30 sec handstand hold (or wall walk)\nEven: 8 ring dips (or dips)\n\nScore = custom note (e.g. "unassisted HS hold", "scaled")', 'custom'),
            ex('Dips - Triceps Version', 5, '8', 60, 'Strict ring dips or bar dips'),
            sec('WOD — "Cindy"', 'AMRAP 20 min:\n• 5 Pull-Ups\n• 10 Push-Ups\n• 15 Air Squats\n\nScore = total rounds + reps. Rx goal: 20+ rounds.', 'rounds'),
            ex('Pullups', 4, '5', 0),
            ex('Barbell Squat', 4, '15', 0, 'Air squat — bodyweight only'),
            sec('Cool Down', '10 min: full-body stretch focusing on hips, hamstrings, and shoulders. Log your Cindy score!', 'none'),
          ]),
          day('Day 6 — Active Recovery', [
            sec('Active Recovery', '30–45 min easy activity: walking, swimming, yoga, or light cycling.\n\nFocus on movement quality, not intensity.\nLog distance or duration as your score.', 'distance'),
          ]),
          day('Day 7 — Rest', []),
        ]),
      ],
    },

    // ── 5. Strength Foundation — 3 Day (linear progression, 4 weeks) ─────────
    {
      name: 'Strength Foundation — 3 Day',
      description: '4-week linear progression program focused on the big compound lifts. Add weight each week. Ideal for strength-focused clients.',
      content: ['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((label, wi) =>
        week(label, [
          day('Day 1 — Squat & Press', [
            ex('Barbell Squat', 5, '5', 180, `Week ${wi + 1} — add 2.5 kg from last week`),
            ex('Barbell Shoulder Press', 5, '5', 120, `Week ${wi + 1} — add 2.5 kg from last week`),
            ex('Bent Over Barbell Row', 3, '8', 90),
            ex('Side Lateral Raise', 3, '12–15', 60),
            ex('Plank', 3, '45 sec', 45),
          ]),
          day('Day 2 — Rest', []),
          day('Day 3 — Deadlift & Bench', [
            ex('Barbell Deadlift', 1, '5', 180, `Week ${wi + 1} — add 5 kg from last week`),
            ex('Barbell Bench Press', 5, '5', 120, `Week ${wi + 1} — add 2.5 kg from last week`),
            ex('Pullups', 3, 'max', 90, 'Full range of motion every rep'),
            ex('Dips - Triceps Version', 3, 'max', 90),
            ex('Hanging Leg Raise', 3, '10–15', 60),
          ]),
          day('Day 4 — Rest', []),
          day('Day 5 — Variation Day', [
            ex('Front Squat', 3, '5', 120, 'Lighter technique work — stay upright'),
            ex('Barbell Bench Press', 5, '5', 120),
            ex('Bent Over Barbell Row', 3, '8', 90),
            ex('Face Pull', 3, '15–20', 45, 'Shoulder health — never skip this'),
            ex('Russian Twist', 3, '20', 45),
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

function meal(label: string, foods: ReturnType<typeof food>[], notes?: string) {
  return { id: uid(), label, foods, ...(notes ? { notes } : {}) }
}

// ── Meal Plans ────────────────────────────────────────────────────────────────

const MEAL_PLANS = [
  {
    name: '1,800 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 1800,
    content: [
      meal('Overnight Oats & Protein Yoghurt', [
        food('Oats (dry)', 60, 228, 7.8, 40.2, 4.2),
        food('Greek Yoghurt (0% fat)', 150, 89, 15, 5.4, 0.6),
        food('Banana', 100, 89, 1.1, 23, 0.3),
        food('Whey Protein', 25, 95, 20, 2.5, 1.5),
      ], 'The night before, combine oats with 150ml water or milk and refrigerate. In the morning, top with Greek yoghurt and sliced banana. Stir in protein powder just before eating for a creamy, no-cook breakfast.'),
      meal('Grilled Chicken & Brown Rice Bowl', [
        food('Chicken Breast (cooked)', 160, 248, 46.4, 0, 5.4),
        food('Brown Rice (cooked)', 150, 168, 3.9, 34.5, 1.4),
        food('Mixed Salad Leaves', 80, 18, 1.4, 2.8, 0.2),
        food('Olive Oil', 10, 88, 0, 0, 10),
      ], 'Season chicken with salt, pepper, garlic powder and smoked paprika. Cook in a non-stick pan over medium-high heat for 6–7 min each side until golden. Slice and serve over rice with salad and a drizzle of olive oil.'),
      meal('Cottage Cheese & Rice Cakes', [
        food('Cottage Cheese', 150, 147, 16.5, 5.1, 6.5),
        food('Rice Cakes', 30, 117, 2.4, 26.4, 0.6),
      ], 'Season cottage cheese with a pinch of salt and pepper — or mix in a little hot sauce or chopped chives for flavour. Spread onto rice cakes for a crunchy, protein-dense snack.'),
      meal('Baked Salmon with Sweet Potato & Broccoli', [
        food('Salmon Fillet', 150, 312, 30, 0, 19.5),
        food('Sweet Potato', 200, 172, 3.2, 40, 0.2),
        food('Broccoli (steamed)', 150, 51, 4.2, 10.5, 0.6),
      ], 'Preheat oven to 200°C. Season salmon with lemon zest, dill, salt and pepper. Bake for 12–15 min until just cooked through. Cube and roast sweet potato with a drizzle of olive oil for 25 min. Steam broccoli until just tender-crisp.'),
    ],
  },

  {
    name: '2,200 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 2200,
    content: [
      meal('Scrambled Eggs on Toast with Avocado', [
        food('Whole Eggs', 150, 233, 19.5, 1.7, 16.5),
        food('Wholegrain Toast', 60, 156, 6.6, 28.8, 2.4),
        food('Avocado', 80, 128, 1.6, 7.2, 12),
        food('Orange Juice', 200, 88, 1.4, 20.4, 0.4),
      ], 'Whisk eggs with a splash of milk, salt and pepper. Cook low and slow in a buttered non-stick pan, gently folding until just set — don\'t rush it. Mash avocado with a squeeze of lemon, season and pile onto toast. Serve with OJ for a quick carb boost.'),
      meal('Chicken Stir-Fry with White Rice', [
        food('Chicken Breast (cooked)', 180, 279, 52.2, 0, 6.1),
        food('White Rice (cooked)', 200, 260, 5.4, 56, 0.6),
        food('Mixed Vegetables (stir-fry)', 150, 98, 4.5, 19.5, 0.8),
        food('Soy Sauce', 15, 9, 1.4, 0.9, 0),
      ], 'Slice chicken into strips and stir-fry in a very hot wok or pan with a little oil for 4–5 min until golden. Add vegetables and toss for 2–3 min. Season with soy sauce and a splash of rice vinegar. Serve immediately over white rice.'),
      meal('Greek Yoghurt Berry Parfait', [
        food('Greek Yoghurt', 200, 118, 13.4, 7.2, 0.8),
        food('Mixed Berries', 100, 57, 0.7, 13.8, 0.3),
        food('Almonds', 25, 145, 5.3, 5.5, 12.5),
      ], 'Layer yoghurt, berries and almonds in a bowl or glass. Simple, tastes like dessert, hits like a snack. Add a drizzle of honey if you need a bit more sweetness.'),
      meal('Beef Bolognese Pasta', [
        food('Lean Beef Mince (5% fat)', 180, 247, 37.8, 0, 9.9),
        food('Pasta (cooked)', 200, 284, 10, 57, 1.4),
        food('Tomato Pasta Sauce', 100, 45, 1.8, 9, 0.5),
        food('Parmesan (grated)', 15, 61, 5.4, 0.2, 4.2),
      ], 'Brown mince over high heat for 5–6 min, breaking it apart. Add pasta sauce, a splash of water and simmer for 10 min. Season well. Toss with cooked pasta and finish with parmesan. Classic comfort food with serious protein.'),
    ],
  },

  {
    name: '2,800 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 2800,
    content: [
      meal('Peanut Butter Protein Oats', [
        food('Oats (dry)', 100, 379, 13, 67, 7),
        food('Whole Milk', 300, 183, 9.6, 14.4, 9.9),
        food('Banana', 130, 116, 1.4, 29.9, 0.4),
        food('Whey Protein', 30, 114, 24, 3, 1.8),
        food('Peanut Butter', 20, 118, 5, 4, 10),
      ], 'Cook oats in whole milk over medium heat, stirring regularly. Remove from heat, stir in protein powder and peanut butter while warm. Top with sliced banana. This bowl is calorie-dense and keeps you fuelled for hours.'),
      meal('Greek Yoghurt & Granola', [
        food('Greek Yoghurt', 200, 118, 13.4, 7.2, 0.8),
        food('Granola', 50, 228, 5, 33, 9),
        food('Apple', 150, 78, 0.4, 20.9, 0.2),
      ], 'Layer yoghurt and granola in a bowl and top with a sliced apple. A quick mid-morning snack to keep calories and energy up between meals.'),
      meal('Chicken & Rice Power Bowl', [
        food('Chicken Breast (cooked)', 200, 310, 58, 0, 6.8),
        food('White Rice (cooked)', 250, 325, 6.8, 70, 0.8),
        food('Broccoli (steamed)', 150, 51, 4.2, 10.5, 0.6),
        food('Olive Oil', 15, 133, 0, 0, 15),
      ], 'Season and grill chicken — season generously with garlic, paprika and salt. Cook rice until fluffy, steam broccoli until just tender. Drizzle olive oil over everything for a calorie-rich, balanced meal.'),
      meal('Tuna & Toast Pre-Workout', [
        food('Wholegrain Bread', 60, 162, 7.2, 28.8, 2.4),
        food('Tuna (canned in water)', 80, 93, 20.8, 0, 0.8),
      ], 'Drain tuna and mash with a little lemon juice, salt and pepper. Spread on wholegrain toast. Easy 30-min pre-workout fuel — carbs for energy, protein to prime muscle protein synthesis.'),
      meal('Pan-Seared Salmon with Asparagus & Sweet Potato', [
        food('Salmon Fillet', 180, 374, 36, 0, 23.4),
        food('Sweet Potato', 250, 215, 4, 50, 0.3),
        food('Asparagus', 120, 26, 2.9, 4.8, 0.1),
        food('Butter', 10, 72, 0.1, 0, 8.1),
      ], 'Cube sweet potato and roast at 200°C with olive oil and salt for 25 min. Pat salmon dry, season with salt and pepper. Sear skin-side down in a hot pan for 4 min, flip and cook 2 min. Finish asparagus in the same pan with butter for 3–4 min.'),
    ],
  },

  {
    name: '2,000 kcal — Omnivore',
    goal: 'omnivore',
    total_calories: 2000,
    content: [
      meal('Egg White Omelette with Oats & Berries', [
        food('Egg Whites', 200, 104, 21.6, 1.4, 0.4),
        food('Whole Eggs', 100, 155, 13, 1.1, 10.6),
        food('Oats (dry)', 50, 190, 6.5, 33.5, 3.5),
        food('Blueberries', 100, 57, 0.7, 13.8, 0.3),
      ], 'Whisk egg whites with whole eggs, salt and pepper. Cook in a non-stick pan over medium heat, folding once. Serve alongside oats cooked in water, topped with fresh blueberries. High protein, moderate carbs — great for a fat-loss phase.'),
      meal('Tuna & Sweet Potato Stack', [
        food('Tuna (canned in water)', 160, 186, 41.6, 0, 1.6),
        food('Sweet Potato', 200, 172, 3.2, 40, 0.2),
        food('Spinach', 100, 23, 2.9, 3.6, 0.4),
        food('Lemon Juice', 15, 4, 0.1, 0.9, 0),
      ], 'Bake or microwave sweet potato until tender. Flake tuna with a squeeze of lemon, salt and pepper. Serve over a bed of fresh spinach with sweet potato alongside. Clean, simple and hits your macro targets perfectly.'),
      meal('Protein Cottage Cheese Bowl', [
        food('Cottage Cheese', 200, 196, 22, 6.8, 8.6),
        food('Whey Protein', 25, 95, 20, 2.5, 1.5),
        food('Rice Cakes', 25, 98, 2, 22, 0.5),
      ], 'Stir protein powder directly into cottage cheese for a thick, creamy, high-protein snack. Season with salt and pepper or a little cinnamon if going sweet. Eat with rice cakes on the side for a carb hit.'),
      meal('Soy Chicken & Brown Rice Stir-Fry', [
        food('Chicken Breast (cooked)', 220, 341, 63.8, 0, 7.5),
        food('Brown Rice (cooked)', 150, 168, 3.9, 34.5, 1.4),
        food('Mixed Vegetables', 200, 130, 6, 26, 1),
        food('Low Sodium Soy Sauce', 10, 6, 0.9, 0.6, 0),
      ], 'Slice chicken and stir-fry in a hot pan with mixed vegetables for 5–6 min. Add soy sauce and toss for 1 min. Serve over brown rice. Season with garlic or ginger if desired — a filling dinner that packs in serious lean protein.'),
    ],
  },

  {
    name: '1,900 kcal — Vegan',
    goal: 'vegan',
    total_calories: 1900,
    content: [
      meal('Chia Oat Bowl with Berries', [
        food('Oats (dry)', 80, 303, 10.4, 53.6, 5.6),
        food('Soy Milk', 250, 108, 8.3, 9.8, 4.5),
        food('Chia Seeds', 20, 97, 3.3, 8.4, 6.1),
        food('Mixed Berries', 120, 68, 0.8, 16.6, 0.4),
        food('Maple Syrup', 10, 26, 0, 6.7, 0),
      ], 'The night before: mix oats, chia seeds and soy milk in a jar and refrigerate. In the morning, top with berries and a drizzle of maple syrup. Thick, creamy and packed with plant-based protein and slow-release carbs.'),
      meal('Chickpea & Quinoa Power Bowl', [
        food('Chickpeas (cooked)', 200, 330, 17.8, 54.4, 5.4),
        food('Quinoa (cooked)', 150, 182, 6.7, 33, 2.9),
        food('Baby Spinach', 80, 18, 2.3, 2.9, 0.3),
        food('Cherry Tomatoes', 100, 18, 0.9, 3.9, 0.2),
        food('Tahini', 15, 89, 2.6, 3.2, 8),
        food('Lemon Juice', 20, 5, 0.2, 1.2, 0),
      ], 'Cook quinoa and let cool slightly. Whisk tahini with lemon juice, a garlic clove and 2 tbsp water to make a smooth dressing. Combine everything and drizzle over. Season generously — this bowl is all about the tahini dressing.'),
      meal('Almond & Apple Protein Snack', [
        food('Almonds', 30, 174, 6.3, 6.5, 15),
        food('Apple', 150, 78, 0.4, 20.9, 0.2),
        food('Vegan Protein Powder', 30, 120, 22, 4, 2),
      ], 'Mix protein powder with 200ml plant milk for a quick shake, and eat alongside almonds and a sliced apple. Portable, satisfying and keeps cravings in check between meals.'),
      meal('Crispy Tofu Stir-Fry with Brown Rice', [
        food('Tofu (firm)', 200, 162, 17.2, 3.6, 9.2),
        food('Brown Rice (cooked)', 180, 202, 4.7, 41.4, 1.6),
        food('Broccoli (steamed)', 150, 51, 4.2, 10.5, 0.6),
        food('Red Bell Pepper', 120, 37, 1.1, 8.4, 0.3),
        food('Sesame Oil', 10, 88, 0, 0, 10),
        food('Soy Sauce', 15, 9, 1.4, 0.9, 0),
      ], 'Press tofu firmly for 10 min, then cube and pan-fry in a hot pan with a little oil for 5–6 min per side until golden and crispy. Add vegetables, soy sauce and a drizzle of sesame oil. Toss and serve over brown rice. Don\'t rush the tofu — the crispiness is everything.'),
    ],
  },
]

// ── Seed function ─────────────────────────────────────────────────────────────

const SENTINEL_PROGRAM = 'Full Body — Beginner 3 Day'
const SENTINEL_PLAN = '1,800 kcal — Omnivore'
const SEEDED_PLAN_NAMES = [
  '1,800 kcal — Omnivore',
  '2,200 kcal — Omnivore',
  '2,800 kcal — Omnivore',
  '2,000 kcal — Omnivore',
  '1,900 kcal — Vegan',
]

const SEEDED_NAMES = [
  'Full Body — Beginner 3 Day',
  'Push Pull Legs — 6 Day',
  'Upper Lower — 4 Day',
  'CrossFit Foundations — 5 Day',
  'Strength Foundation — 3 Day',
]

// Returns true if programs need to be (re)seeded.
// Triggers on: missing sentinel, old format (exercises array), or missing sections.
function needsReseed(prog: { content: unknown } | null): boolean {
  if (!prog) return true
  const weeks = prog.content as { days?: Record<string, unknown>[] }[] | null
  const firstDay = weeks?.[0]?.days?.[0]
  if (!firstDay) return true
  // Old format used an 'exercises' array; new format uses 'items'
  if (Array.isArray((firstDay as { exercises?: unknown[] }).exercises)) return true
  // Programs should now contain sections — reseed if none found
  const allItems = (weeks ?? []).flatMap(w =>
    ((w.days ?? []) as { items?: unknown[] }[]).flatMap(d => d.items ?? [])
  )
  return !allItems.some((item: unknown) => (item as { type?: string })?.type === 'section')
}

function needsMealReseed(plan: { content: unknown } | null): boolean {
  if (!plan) return true
  const slots = plan.content as { notes?: string }[] | null
  return !(slots ?? []).some(s => s.notes)
}

export async function seedCoachTemplates(coachId: string): Promise<void> {
  const admin = createAdminClient()

  const [{ data: existingProg }, { data: existingPlan }, { data: libExercises }] = await Promise.all([
    admin.from('programs').select('id, content').eq('coach_id', coachId).eq('name', SENTINEL_PROGRAM).maybeSingle(),
    admin.from('meal_plans').select('id, content').eq('coach_id', coachId).eq('name', SENTINEL_PLAN).maybeSingle(),
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

  if (needsReseed(existingProg)) {
    // Delete all seeded program templates for this coach and re-insert fresh
    await admin.from('programs').delete().eq('coach_id', coachId).in('name', SEEDED_NAMES)

    const programs = buildPrograms(resolve)
    await admin.from('programs').insert(
      programs.map(p => ({ coach_id: coachId, name: p.name, description: p.description, content: p.content }))
    )
  }

  if (needsMealReseed(existingPlan)) {
    // Fetch all existing seeded plans so we can update in-place (preserves IDs/URLs)
    const { data: existingPlans } = await admin
      .from('meal_plans')
      .select('id, name')
      .eq('coach_id', coachId)
      .in('name', SEEDED_PLAN_NAMES)

    const existingByName = Object.fromEntries((existingPlans ?? []).map(p => [p.name, p.id]))

    await Promise.all(
      MEAL_PLANS.map(p => {
        const existingId = existingByName[p.name]
        if (existingId) {
          // Update content in place — preserves the plan ID so coach URLs don't break
          return admin.from('meal_plans').update({ content: p.content }).eq('id', existingId)
        } else {
          // Plan doesn't exist yet — insert fresh
          return admin.from('meal_plans').insert({ coach_id: coachId, name: p.name, goal: p.goal, total_calories: p.total_calories, content: p.content })
        }
      })
    )
  }
}
