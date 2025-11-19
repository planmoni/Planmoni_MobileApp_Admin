/*
  # Fix is_admin Function for New User Onboarding

  1. Overview
    - Fixes circular dependency issue where is_admin() queries profiles table
    - When new users create profiles, RLS policies call is_admin() which tries to read profiles
    - This creates a deadlock situation for new users

  2. Changes
    - Update is_admin() to use a direct query that bypasses RLS
    - Add error handling for when profile doesn't exist
    - Ensures new users can create profiles successfully

  3. Security
    - Still uses SECURITY DEFINER to bypass RLS safely
    - Returns false for non-existent profiles (safe default)
*/

-- Drop and recreate is_admin function with better handling
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_status boolean;
BEGIN
  -- Direct query using SECURITY DEFINER to bypass RLS
  -- This prevents circular dependency during profile creation
  SELECT COALESCE(is_admin, false)
  INTO admin_status
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
  
  -- Return false if profile doesn't exist (e.g., during profile creation)
  RETURN COALESCE(admin_status, false);
EXCEPTION
  WHEN OTHERS THEN
    -- If any error occurs (including RLS issues), return false
    RETURN false;
END;
$$;