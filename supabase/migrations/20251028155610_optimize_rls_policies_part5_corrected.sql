/*
  # Optimize RLS Policies - Part 5 (Payment Methods, KYC, Email Verification)

  1. Performance Improvements
    - Replace auth.uid() with (select auth.uid()) in RLS policies
  
  2. Tables Updated
    - payment_methods: Update all RLS policies (has user_id)
    - kyc_verifications: Update all RLS policies (has user_id)
    - kyc_documents: Update all RLS policies (has user_id)
    - kyc_data: Update all RLS policies (has user_id)
    - email_verification_cache: Skip - no user_id column
    - kyc_progress: Update all RLS policies (has user_id)
*/

-- Payment methods policies
DROP POLICY IF EXISTS "Users can view own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can insert own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can update own payment methods" ON payment_methods;
DROP POLICY IF EXISTS "Users can delete own payment methods" ON payment_methods;

CREATE POLICY "Users can view own payment methods" ON payment_methods
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own payment methods" ON payment_methods
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own payment methods" ON payment_methods
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own payment methods" ON payment_methods
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()));

-- KYC verifications policies
DROP POLICY IF EXISTS "Users can view own kyc verifications" ON kyc_verifications;
DROP POLICY IF EXISTS "Users can insert own kyc verifications" ON kyc_verifications;

CREATE POLICY "Users can view own kyc verifications" ON kyc_verifications
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own kyc verifications" ON kyc_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- KYC documents policies
DROP POLICY IF EXISTS "Users can view own kyc documents" ON kyc_documents;
DROP POLICY IF EXISTS "Users can insert own kyc documents" ON kyc_documents;

CREATE POLICY "Users can view own kyc documents" ON kyc_documents
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own kyc documents" ON kyc_documents
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- KYC data policies
DROP POLICY IF EXISTS "Users can view own kyc data" ON kyc_data;
DROP POLICY IF EXISTS "Users can insert own kyc data" ON kyc_data;
DROP POLICY IF EXISTS "Users can update own kyc data" ON kyc_data;
DROP POLICY IF EXISTS "Admins can view all kyc data" ON kyc_data;
DROP POLICY IF EXISTS "Admins can update kyc data" ON kyc_data;

CREATE POLICY "Users can view own kyc data" ON kyc_data
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own kyc data" ON kyc_data
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own kyc data" ON kyc_data
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all kyc data" ON kyc_data
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can update kyc data" ON kyc_data
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );

-- KYC progress policies
DROP POLICY IF EXISTS "Users can view own kyc progress" ON kyc_progress;
DROP POLICY IF EXISTS "Users can insert own kyc progress" ON kyc_progress;
DROP POLICY IF EXISTS "Users can update own kyc progress" ON kyc_progress;
DROP POLICY IF EXISTS "Admins can view all kyc progress" ON kyc_progress;

CREATE POLICY "Users can view own kyc progress" ON kyc_progress
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own kyc progress" ON kyc_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own kyc progress" ON kyc_progress
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Admins can view all kyc progress" ON kyc_progress
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = (select auth.uid())
      AND r.name IN ('admin', 'super_admin')
    )
  );