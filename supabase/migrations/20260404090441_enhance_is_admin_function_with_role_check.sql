/*
  # Enhance is_admin() to check roles system

  1. Changes
    - Updates is_admin() function to check both role system and is_admin flag
    - Ensures consistency with is_user_admin_safe()
    - Checks for Admin (level 50) and Super Admin (level 100) roles

  2. Purpose
    - Fixes RLS policies that use is_admin() to properly recognize Admin role users
    - Ensures dashboard queries work for both role-based and flag-based admins
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
DECLARE
  v_is_admin boolean;
BEGIN
  -- First check via roles table
  SELECT true
    INTO v_is_admin
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = auth.uid()
    AND ur.is_active = true
    AND (r.name ILIKE 'admin' OR r.name ILIKE 'super admin' OR r.level >= 50)
  LIMIT 1;

  IF FOUND THEN
    RETURN true;
  END IF;

  -- Fallback to is_admin flag in profiles table
  SELECT COALESCE(p.is_admin, false)
    INTO v_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  RETURN COALESCE(v_is_admin, false);
END;
$function$;