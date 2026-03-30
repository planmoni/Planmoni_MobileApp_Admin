/*
  # Add function to get active push token count

  1. New Functions
    - `get_active_push_token_count()` - Returns the count of users with active push tokens
      - Uses SECURITY DEFINER to bypass RLS restrictions
      - Returns INTEGER count of distinct user_ids with active tokens
  
  2. Security
    - Function is accessible to authenticated users
    - Uses SECURITY DEFINER to safely query user_push_tokens table
    - Only returns aggregated count, no sensitive data exposed
*/

CREATE OR REPLACE FUNCTION get_active_push_token_count()
RETURNS INTEGER
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT user_id)::INTEGER 
  FROM user_push_tokens 
  WHERE is_active = true;
$$ LANGUAGE sql STABLE;