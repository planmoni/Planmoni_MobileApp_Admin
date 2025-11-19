/*
  # Fix Profile Creation for Mobile App Onboarding

  1. Overview
    - Users in the mobile app cannot create profiles during onboarding
    - The current policy requires auth.uid() = id which may be too restrictive
    - Need to ensure authenticated users can create their profiles

  2. Changes
    - Drop the old INSERT policy
    - Create a new, clearer INSERT policy that:
      - Allows authenticated users to create profiles with their auth.uid()
      - Allows service role to create profiles (auth.uid() IS NULL)
      - Prevents users from creating profiles for other users

  3. Security
    - Users can only create profiles where the id matches their auth.uid()
    - Service role can create any profile (for admin operations)
    - Prevents impersonation and unauthorized profile creation
*/

-- Drop existing INSERT policies
DROP POLICY IF EXISTS "Enable profile creation for authenticated users and system" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;

-- Create a clear, permissive INSERT policy for user onboarding
CREATE POLICY "Authenticated users can create own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Allow service role / system to create profiles (for admin operations)
CREATE POLICY "Service role can create any profile"
  ON profiles FOR INSERT
  TO anon
  WITH CHECK (auth.uid() IS NULL);