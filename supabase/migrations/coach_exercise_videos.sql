-- Per-coach video URL overrides for the global exercise library.
-- When a coach edits an exercise video, it goes here instead of the shared exercises table.
-- The library query merges both: coach override takes precedence over global URL.

CREATE TABLE IF NOT EXISTS public.coach_exercise_videos (
  coach_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id) ON DELETE CASCADE NOT NULL,
  video_url   text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (coach_id, exercise_id)
);

ALTER TABLE public.coach_exercise_videos ENABLE ROW LEVEL SECURITY;

-- Coaches can only read/write their own overrides
CREATE POLICY "Coach manages own exercise videos" ON public.coach_exercise_videos
  FOR ALL USING (auth.uid() = coach_id);
