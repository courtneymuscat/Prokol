-- Coach supplement library (global built-ins + coach-specific)
CREATE TABLE IF NOT EXISTS public.coach_supplements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  default_dosage text,
  benefits text,
  brand_url text,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.coach_supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated reads global or own supplements" ON public.coach_supplements
  FOR SELECT USING (auth.uid() IS NOT NULL AND (coach_id IS NULL OR auth.uid() = coach_id));
CREATE POLICY "Coach manages own supplements" ON public.coach_supplements
  FOR ALL USING (auth.uid() = coach_id);

-- Per-client supplement assignments
CREATE TABLE IF NOT EXISTS public.client_supplements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  supplement_id uuid REFERENCES public.coach_supplements(id) ON DELETE SET NULL,
  name text NOT NULL,
  dosage text,
  benefits text,
  brand_url text,
  notes text,
  sort_order int DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public.client_supplements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages client supplements" ON public.client_supplements
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own supplements" ON public.client_supplements
  FOR SELECT USING (auth.uid() = client_id);

-- Per-client protocol sections (JSONB)
CREATE TABLE IF NOT EXISTS public.client_protocol (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  coach_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  sections jsonb DEFAULT '[]' NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(client_id, coach_id)
);
ALTER TABLE public.client_protocol ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coach manages client protocol" ON public.client_protocol
  FOR ALL USING (auth.uid() = coach_id);
CREATE POLICY "Client reads own protocol" ON public.client_protocol
  FOR SELECT USING (auth.uid() = client_id);

-- Global built-in supplements
INSERT INTO public.coach_supplements (coach_id, name, default_dosage, benefits)
VALUES
  (NULL, 'Vitamin D3',         '2000–5000 IU daily with a meal',               'Supports bone health, immune function, and mood. Most people are deficient, especially in low-sunlight climates.'),
  (NULL, 'Omega-3 Fish Oil',   '1–3g EPA+DHA daily with food',                 'Reduces systemic inflammation, supports cardiovascular and brain health, and may improve body composition.'),
  (NULL, 'Magnesium Glycinate','200–400mg before bed',                          'Improves sleep quality, reduces muscle cramps and soreness, supports stress resilience.'),
  (NULL, 'Creatine Monohydrate','3–5g daily (no loading needed)',               'Clinically proven to increase strength, power output, and lean muscle mass. Also has cognitive benefits.'),
  (NULL, 'Zinc',               '15–30mg with food (avoid empty stomach)',       'Supports immune function, testosterone production, and wound healing. Depleted by heavy exercise.'),
  (NULL, 'Vitamin B12',        '500–1000mcg daily',                             'Essential for energy metabolism and nerve function. Particularly important for plant-based eaters.'),
  (NULL, 'Probiotics',         '1 capsule daily with a meal',                   'Supports gut microbiome health, immune function, and digestion. Look for multi-strain formulas.'),
  (NULL, 'Collagen Peptides',  '10–15g daily with vitamin C',                   'Supports joint health, skin elasticity, and connective tissue recovery.')
ON CONFLICT DO NOTHING;
