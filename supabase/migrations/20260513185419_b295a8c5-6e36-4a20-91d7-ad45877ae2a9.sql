
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own categories" ON public.categories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own categories" ON public.categories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own categories" ON public.categories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER set_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults for new users
CREATE OR REPLACE FUNCTION public.seed_default_categories(_user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.categories (user_id, name, color) VALUES
    (_user_id, 'Food', '#22c55e'),
    (_user_id, 'Transport', '#0ea5e9'),
    (_user_id, 'Housing', '#f59e0b'),
    (_user_id, 'Entertainment', '#a855f7'),
    (_user_id, 'Health', '#ef4444'),
    (_user_id, 'Shopping', '#14b8a6'),
    (_user_id, 'Bills', '#6366f1'),
    (_user_id, 'Other', '#64748b')
  ON CONFLICT (user_id, name) DO NOTHING;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_default_categories(uuid) FROM PUBLIC, anon, authenticated;

-- Hook into existing handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.seed_default_categories(NEW.id);
  RETURN NEW;
END;
$$;

-- Backfill defaults for existing users
DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_default_categories(u.id);
  END LOOP;
END $$;
