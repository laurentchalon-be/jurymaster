-- Set explicit search path to prevent function search_path mutable vulnerability
ALTER FUNCTION public.increment_quota_usage(
  p_user_id text,
  p_device_id text,
  p_date date,
  p_seconds integer,
  p_max integer
) SET search_path = public;
