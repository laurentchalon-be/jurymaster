-- ============================================================
-- JuryMaster — Schéma complet de la base de données
-- État au 2026-02-28 | Appliqué via MCP Supabase
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────
CREATE TYPE public.user_level AS ENUM ('lycee', 'licence', 'master');
CREATE TYPE public.plan_status AS ENUM ('free', 'active', 'expired');

-- ── Table : profiles ─────────────────────────────────────────
CREATE TABLE public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  avatar_url  text,
  level       public.user_level NOT NULL DEFAULT 'licence',
  exam_date   date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  is_pro      boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE  public.profiles IS 'Profils publics des utilisateurs, liés à auth.users.';
COMMENT ON COLUMN public.profiles.is_pro IS 'true si accès premium (Mode Stressant, sessions illimitées).';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: select own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: insert own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles: update own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── Table : subscriptions ────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id  text UNIQUE,
  plan_status         public.plan_status NOT NULL DEFAULT 'free',
  current_period_end  timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS 'Abonnements Stripe des utilisateurs.';

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- UPDATE volontairement absent : seul le backend/webhook Stripe doit modifier le statut
CREATE POLICY "subscriptions: select own" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ── Table : sessions ─────────────────────────────────────────
CREATE TABLE public.sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_name  text NOT NULL,
  transcript    text,
  score_global  integer CHECK (score_global >= 0 AND score_global <= 100),
  analysis_json jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.sessions IS 'Historique des sessions d''entraînement oral avec analyse IA.';
COMMENT ON COLUMN public.sessions.analysis_json IS 'Scores détaillés, tics de langage, recommandations stockés en JSONB.';

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions: select own" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "sessions: insert own" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sessions: delete own" ON public.sessions FOR DELETE USING (auth.uid() = user_id);
