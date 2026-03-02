-- Ajout de la fonction get_average_radar avec SET search_path pour corriger l'avertissement de sécurité Supabase

CREATE OR REPLACE FUNCTION public.get_average_radar()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
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
    WHERE s.analysis_json->'radarData' IS NOT NULL
    GROUP BY elem->>'subject'
  ) sub;
  
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
