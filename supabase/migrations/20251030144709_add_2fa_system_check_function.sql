/*
  # Add System-Wide 2FA Check Function
  
  1. New Function
    - `is_2fa_enabled_system_wide()` - Public function that returns boolean
    - Returns true if ANY admin has 2FA enabled
    - Does not expose sensitive 2FA data
    - Can be called by any authenticated user during login
  
  2. Purpose
    - Allow login flow to check if 2FA is required without exposing user data
    - Bypass RLS restrictions during authentication flow
*/

-- Create a public function to check if 2FA is enabled system-wide
CREATE OR REPLACE FUNCTION is_2fa_enabled_system_wide()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if any admin has 2FA enabled
  RETURN EXISTS (
    SELECT 1 
    FROM admin_2fa_settings 
    WHERE is_enabled = true
    LIMIT 1
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION is_2fa_enabled_system_wide() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION is_2fa_enabled_system_wide() IS 'Returns true if any admin has enabled 2FA system-wide. Used during login flow.';
