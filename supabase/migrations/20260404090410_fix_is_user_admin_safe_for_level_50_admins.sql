/*
  # Fix is_user_admin_safe to recognize Admin role (level 50)

  1. Changes
    - Updates is_user_admin_safe function to check for level >= 50 instead of >= 100
    - Makes the role name check case-insensitive using ILIKE
    - This ensures both "Admin" (level 50) and "Super Admin" (level 100) are recognized

  2. Purpose
    - Fixes issue where Admin users couldn't access dashboard data
    - Ensures RLS policies correctly identify Admin role users
*/

CREATE OR REPLACE FUNCTION public.is_user_admin_safe(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_is_admin boolean;
BEGIN
  -- Check via roles table first if present
  -- Updated to check level >= 50 to include both Admin and Super Admin roles
  SELECT true
    INTO v_is_admin
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.is_active = true
    AND (r.name ILIKE 'admin' OR r.name ILIKE 'super admin' OR r.level >= 50)
  LIMIT 1;

  IF FOUND THEN
    RETURN true;
  END IF;

  -- Fallback to profiles.is_admin flag if exists
  SELECT COALESCE(p.is_admin, false)
  INTO v_is_admin
  FROM public.profiles p
  WHERE p.id = p_user_id;

  RETURN COALESCE(v_is_admin, false);
END;
$function$;