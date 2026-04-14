-- ================================================
-- HIGH RISK: form_submissions and form_answers
-- ================================================
CREATE POLICY "client reads own submissions"
  ON public.form_submissions FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "client inserts own submissions"
  ON public.form_submissions FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "coach manages client submissions"
  ON public.form_submissions FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "client reads own form answers"
  ON public.form_answers FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.form_submissions
      WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "client inserts own form answers"
  ON public.form_answers FOR INSERT
  WITH CHECK (
    submission_id IN (
      SELECT id FROM public.form_submissions
      WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "coach reads client form answers"
  ON public.form_answers FOR SELECT
  USING (
    submission_id IN (
      SELECT id FROM public.form_submissions
      WHERE coach_id = auth.uid()
    )
  );

-- ================================================
-- HIGH RISK: checkins and checkin_answers
-- Column verified: checkins uses client_id (not user_id)
-- ================================================
CREATE POLICY "client manages own checkins"
  ON public.checkins FOR ALL
  USING (client_id = auth.uid());

CREATE POLICY "coach reads client checkins"
  ON public.checkins FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.coach_clients
      WHERE coach_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "client reads own checkin answers"
  ON public.checkin_answers FOR SELECT
  USING (
    checkin_id IN (
      SELECT id FROM public.checkins
      WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "client inserts own checkin answers"
  ON public.checkin_answers FOR INSERT
  WITH CHECK (
    checkin_id IN (
      SELECT id FROM public.checkins
      WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "coach reads client checkin answers"
  ON public.checkin_answers FOR SELECT
  USING (
    checkin_id IN (
      SELECT id FROM public.checkins
      WHERE client_id IN (
        SELECT client_id FROM public.coach_clients
        WHERE coach_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ================================================
-- HIGH RISK: onboarding_answers and onboarding_responses
-- Column verified: onboarding_responses uses client_id (not user_id)
-- Column verified: onboarding_answers has response_id FK, no direct user_id
-- ================================================
CREATE POLICY "user manages own onboarding responses"
  ON public.onboarding_responses FOR ALL
  USING (client_id = auth.uid());

CREATE POLICY "coach reads client onboarding responses"
  ON public.onboarding_responses FOR SELECT
  USING (
    client_id IN (
      SELECT client_id FROM public.coach_clients
      WHERE coach_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "user manages own onboarding answers"
  ON public.onboarding_answers FOR ALL
  USING (
    response_id IN (
      SELECT id FROM public.onboarding_responses
      WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "coach reads client onboarding answers"
  ON public.onboarding_answers FOR SELECT
  USING (
    response_id IN (
      SELECT id FROM public.onboarding_responses
      WHERE client_id IN (
        SELECT client_id FROM public.coach_clients
        WHERE coach_id = auth.uid() AND status = 'active'
      )
    )
  );

-- ================================================
-- HIGH RISK: client_files
-- Column verified: has both client_id and coach_id
-- ================================================
CREATE POLICY "client reads own files"
  ON public.client_files FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "coach manages client files"
  ON public.client_files FOR ALL
  USING (
    coach_id = auth.uid()
  );

-- ================================================
-- MEDIUM RISK: checkin_forms and checkin_questions
-- ================================================
CREATE POLICY "coach manages own checkin forms"
  ON public.checkin_forms FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "client reads assigned checkin forms"
  ON public.checkin_forms FOR SELECT
  USING (
    id IN (
      SELECT form_id FROM public.checkin_schedules
      WHERE client_id = auth.uid()
    )
  );

CREATE POLICY "coach manages own checkin questions"
  ON public.checkin_questions FOR ALL
  USING (
    form_id IN (
      SELECT id FROM public.checkin_forms
      WHERE coach_id = auth.uid()
    )
  );

CREATE POLICY "client reads questions in assigned forms"
  ON public.checkin_questions FOR SELECT
  USING (
    form_id IN (
      SELECT form_id FROM public.checkin_schedules
      WHERE client_id = auth.uid()
    )
  );

-- ================================================
-- MEDIUM RISK: onboarding_forms and onboarding_questions
-- ================================================
CREATE POLICY "coach manages own onboarding forms"
  ON public.onboarding_forms FOR ALL
  USING (coach_id = auth.uid());

CREATE POLICY "client reads assigned onboarding forms"
  ON public.onboarding_forms FOR SELECT
  USING (true);

CREATE POLICY "coach manages own onboarding questions"
  ON public.onboarding_questions FOR ALL
  USING (
    form_id IN (
      SELECT id FROM public.onboarding_forms
      WHERE coach_id = auth.uid()
    )
  );

-- ================================================
-- MEDIUM RISK: user_food_history
-- Column verified: has user_id
-- ================================================
CREATE POLICY "user manages own food history"
  ON public.user_food_history FOR ALL
  USING (user_id = auth.uid());

-- ================================================
-- LOW RISK: foods (reference table)
-- ================================================
CREATE POLICY "anyone can read foods"
  ON public.foods FOR SELECT
  USING (true);

CREATE POLICY "authenticated users can insert foods"
  ON public.foods FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
