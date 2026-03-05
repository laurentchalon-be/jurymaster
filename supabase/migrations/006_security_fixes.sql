-- ============================================================
-- Migration 006: Security Fixes
-- Issues: is_pro user-updatable, get_average_radar leaks data,
--         anon can call dangerous functions, ip_hash CHECK missing,
--         RLS performance on daily_quota_usage
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX #1: Prevent users from updating is_pro on their profile
-- RLS cannot compare OLD vs NEW, so we use a BEFORE UPDATE trigger
-- ─────────────────────────────────────────────────────────────
-- Ensure the UPDATE policy uses (SELECT auth.uid()) for perf
DROP POLICY IF EXISTS "profiles: update own" ON public.profiles;
CREATE POLICY "profiles: update own"
  ON public.profiles FOR UPDATE
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Trigger that blocks non-service_role from changing is_pro
CREATE OR REPLACE FUNCTION public.protect_is_pro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_pro IS DISTINCT FROM OLD.is_pro THEN
    IF current_setting('role', true) IS DISTINCT FROM 'service_role'
       AND NOT (SELECT usesuper FROM pg_user WHERE usename = current_user) THEN
      RAISE EXCEPTION 'Modification de is_pro non autorisée'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_is_pro() FROM anon, public, authenticated;

DROP TRIGGER IF EXISTS protect_is_pro_trigger ON public.profiles;
CREATE TRIGGER protect_is_pro_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_is_pro();

-- ─────────────────────────────────────────────────────────────
-- FIX #2: get_average_radar() must filter by calling user
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_average_radar()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'subject', subject,
      'B', avg_a,
      'fullMark', 100
    )
  ) INTO result
  FROM (
    SELECT
      elem->>'subject' AS subject,
      ROUND(AVG((elem->>'A')::numeric)) AS avg_a
    FROM public.sessions s,
    jsonb_array_elements(s.analysis_json->'radarData') AS elem
    WHERE s.user_id = v_uid
      AND s.analysis_json->'radarData' IS NOT NULL
    GROUP BY elem->>'subject'
  ) sub;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_average_radar() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_average_radar() TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- FIX #3: Revoke anon access to dangerous SECURITY DEFINER functions
-- ─────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.increment_ip_quota_usage(TEXT, DATE, INTEGER, INTEGER) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ip_quota_usage(TEXT, DATE, INTEGER, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION public.enforce_session_limit() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.enforce_session_limit() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;

-- ─────────────────────────────────────────────────────────────
-- FIX #4: daily_quota_usage CHECK constraint must allow 'ip_hash'
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.daily_quota_usage
  DROP CONSTRAINT IF EXISTS daily_quota_usage_entity_type_check;

ALTER TABLE public.daily_quota_usage
  ADD CONSTRAINT daily_quota_usage_entity_type_check
  CHECK (entity_type = ANY (ARRAY['user'::text, 'device'::text, 'ip_hash'::text]));

-- ─────────────────────────────────────────────────────────────
-- FIX (perf): Wrap auth.uid() in (SELECT ...) for daily_quota_usage RLS
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users can read own quota" ON public.daily_quota_usage;

CREATE POLICY "users can read own quota"
  ON public.daily_quota_usage FOR SELECT
  TO authenticated
  USING (
    entity_type = 'user'
    AND entity_id = (SELECT auth.uid())::text
  );
