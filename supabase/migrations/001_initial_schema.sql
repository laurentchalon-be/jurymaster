-- ============================================================
-- JuryMaster - Schéma de base de données initial
-- ============================================================

-- ============================================================
-- 1. TYPES ENUM
-- ============================================================

CREATE TYPE user_level AS ENUM ('lycee', 'licence', 'master');
CREATE TYPE plan_status AS ENUM ('free', 'active', 'expired');


-- ============================================================
-- 2. TABLE : profiles
-- Extension de auth.users, créée automatiquement via trigger
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT,
  avatar_url    TEXT,
  level         user_level NOT NULL DEFAULT 'licence',
  exam_date     DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Profils publics des utilisateurs, liés à auth.users.';


-- ============================================================
-- 3. TABLE : subscriptions
-- Gestion des abonnements Stripe
-- ============================================================

CREATE TABLE public.subscriptions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id    TEXT UNIQUE,
  plan_status           plan_status NOT NULL DEFAULT 'free',
  current_period_end    TIMESTAMPTZ,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.subscriptions IS 'Abonnements Stripe des utilisateurs.';

-- Index pour les lookups fréquents par user_id
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
-- Index pour les lookups Stripe
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);


-- ============================================================
-- 4. TABLE : sessions
-- Historique des sessions d'entraînement oral
-- ============================================================

CREATE TABLE public.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_name    TEXT NOT NULL,
  transcript      TEXT,
  score_global    INTEGER CHECK (score_global BETWEEN 0 AND 100),
  analysis_json   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.sessions IS 'Historique des sessions d''entraînement oral avec analyse IA.';
COMMENT ON COLUMN public.sessions.analysis_json IS 'Scores détaillés, tics de langage, recommandations stockés en JSONB.';

-- Index pour récupérer rapidement les sessions d'un utilisateur
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
-- Index pour trier par date (usage frequent dans le dashboard)
CREATE INDEX idx_sessions_created_at ON public.sessions(created_at DESC);


-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Activation du RLS sur toutes les tables
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions      ENABLE ROW LEVEL SECURITY;


-- ---- Policies : profiles ----

-- Un utilisateur peut lire uniquement son propre profil
CREATE POLICY "profiles: select own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Un utilisateur peut mettre à jour uniquement son propre profil
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);


-- ---- Policies : subscriptions ----

-- Un utilisateur peut lire uniquement son propre abonnement
CREATE POLICY "subscriptions: select own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Un utilisateur peut mettre à jour uniquement son propre abonnement
-- (normalement géré par un webhook Stripe via une Edge Function sécurisée)
CREATE POLICY "subscriptions: update own"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---- Policies : sessions ----

-- Un utilisateur peut lire uniquement ses propres sessions
CREATE POLICY "sessions: select own"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Un utilisateur peut créer des sessions uniquement pour lui-même
CREATE POLICY "sessions: insert own"
  ON public.sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Un utilisateur peut supprimer uniquement ses propres sessions
CREATE POLICY "sessions: delete own"
  ON public.sessions FOR DELETE
  USING (auth.uid() = user_id);


-- ============================================================
-- 6. TRIGGER : Création automatique d'un profil à l'inscription
-- ============================================================

-- Fonction exécutée après chaque nouvel utilisateur dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- On force search_path pour prévenir les attaques de type search_path injection
SET search_path = public
AS $$
BEGIN
  -- Insère un profil lié au nouvel utilisateur
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    -- Récupère le nom depuis les métadonnées OAuth (Google, etc.)
    NEW.raw_user_meta_data ->> 'full_name',
    -- Récupère l'avatar depuis les métadonnées OAuth
    NEW.raw_user_meta_data ->> 'avatar_url'
  );

  -- Crée également une entrée d'abonnement par défaut (plan free)
  INSERT INTO public.subscriptions (user_id, plan_status)
  VALUES (NEW.id, 'free');

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Crée automatiquement un profil et un abonnement free lors d''une inscription via Supabase Auth.';

-- Attache le trigger à la table auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
