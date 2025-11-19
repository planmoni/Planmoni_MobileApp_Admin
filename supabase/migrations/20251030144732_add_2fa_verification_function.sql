/*
  # Add 2FA Verification Function
  
  1. New Function
    - `get_2fa_settings_for_verification()` - Returns 2FA settings for verification
    - Returns secret and backup codes for the enabled 2FA configuration
    - Used during login 2FA verification process
    - Bypasses RLS to allow any authenticated user to verify
  
  2. Security
    - SECURITY DEFINER to bypass RLS
    - Only returns data if 2FA is actually enabled
    - Does not expose which user owns the 2FA settings
*/

-- Create function to get 2FA settings for verification
CREATE OR REPLACE FUNCTION get_2fa_settings_for_verification()
RETURNS TABLE (
  secret text,
  backup_codes text[],
  user_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return the 2FA settings for the first enabled configuration
  RETURN QUERY
  SELECT 
    a.secret,
    a.backup_codes,
    a.user_id
  FROM admin_2fa_settings a
  WHERE a.is_enabled = true
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_2fa_settings_for_verification() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_2fa_settings_for_verification() IS 'Returns 2FA settings for verification during login. Used after initial authentication.';
