CREATE TABLE public.inscription_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  original_filename text NOT NULL,
  original_text text,
  normalized_tamil text,
  edited_tamil text,
  english_translation text,
  readable_translation text,
  translation_notes text,
  script_type text,
  analysis_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inscription_analyses TO authenticated;
GRANT ALL ON public.inscription_analyses TO service_role;
ALTER TABLE public.inscription_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.inscription_analyses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.inscription_analyses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.inscription_analyses FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own delete" ON public.inscription_analyses FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX ON public.inscription_analyses (user_id, created_at DESC);