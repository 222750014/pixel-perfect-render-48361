CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source text NOT NULL,
  source_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  insights jsonb
);
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  text text NOT NULL,
  author text,
  published_at timestamptz,
  like_count int,
  pos real NOT NULL, neu real NOT NULL, neg real NOT NULL, compound real NOT NULL,
  label text NOT NULL,
  emojis text[] NOT NULL DEFAULT '{}'
);
CREATE INDEX ON public.comments(analysis_id);
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.analyses, public.comments, public.chat_messages TO anon, authenticated;
GRANT ALL ON public.analyses, public.comments, public.chat_messages TO service_role;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read analyses" ON public.analyses FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert analyses" ON public.analyses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public update analyses" ON public.analyses FOR UPDATE TO anon, authenticated USING (true);
CREATE POLICY "public delete analyses" ON public.analyses FOR DELETE TO anon, authenticated USING (true);
CREATE POLICY "public read comments" ON public.comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert comments" ON public.comments FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "public read chat" ON public.chat_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert chat" ON public.chat_messages FOR INSERT TO anon, authenticated WITH CHECK (true);