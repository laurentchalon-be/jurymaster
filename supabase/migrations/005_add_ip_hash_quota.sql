-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005 : Ajout du système anti-abus par IP hashée (RGPD-compliant)
--
-- Principe :
--   - L'IP n'est JAMAIS stockée en clair.
--   - On stocke un hash SHA-256 tronqué + salé = pseudonymisation.
--   - Durée de rétention limitée à 7 jours (cleanup automatique probabiliste).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Ajouter la colonne ip_hash sur usage_logs (pour les visiteurs guests)
ALTER TABLE public.usage_logs
  ADD COLUMN IF NOT EXISTS ip_hash TEXT DEFAULT NULL;

-- Index pour les requêtes de comptage par IP hash (performances)
CREATE INDEX IF NOT EXISTS idx_usage_logs_ip_hash
  ON public.usage_logs (ip_hash, created_at)
  WHERE ip_hash IS NOT NULL;

-- 2. Ajouter le type 'ip_hash' dans daily_quota_usage (pour les connectés free)
--    La table existe déjà avec entity_type TEXT, on ajoute juste l'index.
CREATE INDEX IF NOT EXISTS idx_daily_quota_ip_hash
  ON public.daily_quota_usage (entity_id, entity_type, usage_date)
  WHERE entity_type = 'ip_hash';

-- 3. RPC dédiée pour incrémenter le quota IP de façon atomique (évite les race conditions)
CREATE OR REPLACE FUNCTION public.increment_ip_quota_usage(
  p_ip_hash   TEXT,
  p_date      DATE,
  p_seconds   INTEGER,
  p_max       INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.daily_quota_usage (entity_id, entity_type, usage_date, seconds_used)
  VALUES (p_ip_hash, 'ip_hash', p_date, LEAST(p_seconds, p_max))
  ON CONFLICT (entity_id, entity_type, usage_date)
  DO UPDATE SET
    seconds_used = LEAST(
      public.daily_quota_usage.seconds_used + EXCLUDED.seconds_used,
      p_max
    );
END;
$$;

-- Donner accès à la service_role (utilisée par les Edge Functions)
GRANT EXECUTE ON FUNCTION public.increment_ip_quota_usage(TEXT, DATE, INTEGER, INTEGER)
  TO service_role;
