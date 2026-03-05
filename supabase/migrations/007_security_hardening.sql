-- ============================================================
-- Migration 007: Security Hardening
-- Issues: subscriptions update policy cleanup,
--         usage_logs RLS formalisation,
--         profiles insert policy for handle_new_user
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- FIX #1: Ensure subscriptions cannot be updated by users
-- Only service_role (Stripe webhooks) should modify subscriptions.
-- (Already applied in production, formalised here for migration tracking)
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "subscriptions: update own" ON public.subscriptions;

-- ─────────────────────────────────────────────────────────────
-- FIX #2: Formalise usage_logs RLS (already active, tracked here)
-- usage_logs must never be readable or writable by anon/authenticated.
-- Only service_role (Edge Functions) can insert/read.
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "usage_logs: no direct user access" ON public.usage_logs;
CREATE POLICY "usage_logs: no direct user access"
  ON public.usage_logs FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
