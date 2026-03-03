-- ============================================================
-- Auditio - Migration : Limitation à 5 sessions par utilisateur
-- ============================================================

-- Fonction pour limiter le nombre de sessions à 5 par utilisateur
CREATE OR REPLACE FUNCTION public.enforce_session_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supprime toutes les sessions de l'utilisateur SAUF les 5 plus récentes
  DELETE FROM public.sessions
  WHERE user_id = NEW.user_id
  AND id NOT IN (
    SELECT id
    FROM public.sessions
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    LIMIT 5
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_session_limit() IS
  'Purge les anciennes sessions d''un utilisateur pour n''en garder que les 5 plus récentes.';

-- Création du trigger
DROP TRIGGER IF EXISTS on_session_created_enforce_limit ON public.sessions;
CREATE TRIGGER on_session_created_enforce_limit
  AFTER INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_limit();
