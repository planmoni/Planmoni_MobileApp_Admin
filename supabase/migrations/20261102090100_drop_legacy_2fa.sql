-- Remove the old client-side "2FA" (replaced by Supabase MFA in 20261102090000_admin_mfa.sql).
--
-- APPLY THIS ONLY AFTER the new admin frontend is published: the old Login screen still calls
-- is_2fa_enabled_system_wide(), and the old Super Admin card reads admin_2fa_settings.
--
-- The old design stored the TOTP secret and backup codes in plain text in admin_2fa_settings and
-- get_2fa_settings_for_verification() handed that secret to any signed-in user. It was never enabled
-- for anyone (1 row, is_enabled = false), so nothing is lost.

DROP FUNCTION IF EXISTS public.get_2fa_settings_for_verification();
DROP FUNCTION IF EXISTS public.is_2fa_enabled_system_wide();
DROP TABLE IF EXISTS public.admin_2fa_settings;
