/*
  # Update Marketing RLS Policies to Use Permissions
  
  1. Changes
    - Update RLS policies for sender_email_addresses to check marketing permissions
    - Update RLS policies for marketing_campaigns to check marketing permissions
    - Update RLS policies for campaign_segments to check marketing permissions
    - Users with marketing.view permission can now access all marketing features
    - Super admins still have full access through has_permission function
  
  2. Security
    - Users need marketing.view permission to view marketing data
    - Users need marketing.campaigns.create to create campaigns
    - Users need marketing.campaigns.edit to edit campaigns
    - Users need marketing.campaigns.delete to delete campaigns
    - Users need marketing.segments.manage to manage segments
*/

-- ============================================
-- SENDER_EMAIL_ADDRESSES TABLE
-- ============================================

-- Drop old admin-only policies
DROP POLICY IF EXISTS "Admins can view all sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Admins can insert sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Admins can update sender emails" ON sender_email_addresses;
DROP POLICY IF EXISTS "Admins can delete sender emails" ON sender_email_addresses;

-- Create new permission-based policies
CREATE POLICY "Users with marketing permission can view sender emails"
  ON sender_email_addresses
  FOR SELECT
  TO authenticated
  USING (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.create')
    OR has_permission('marketing.campaigns.edit')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can insert sender emails"
  ON sender_email_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.create')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can update sender emails"
  ON sender_email_addresses
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.edit')
    OR is_admin()
  )
  WITH CHECK (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.edit')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can delete sender emails"
  ON sender_email_addresses
  FOR DELETE
  TO authenticated
  USING (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.delete')
    OR is_admin()
  );

-- ============================================
-- MARKETING_CAMPAIGNS TABLE
-- ============================================

-- Drop old admin-only policies
DROP POLICY IF EXISTS "Admins can view all campaigns" ON marketing_campaigns;
DROP POLICY IF EXISTS "Admins can insert campaigns" ON marketing_campaigns;
DROP POLICY IF EXISTS "Admins can update campaigns" ON marketing_campaigns;
DROP POLICY IF EXISTS "Admins can delete campaigns" ON marketing_campaigns;

-- Create new permission-based policies
CREATE POLICY "Users with marketing permission can view campaigns"
  ON marketing_campaigns
  FOR SELECT
  TO authenticated
  USING (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.list')
    OR has_permission('marketing.campaigns.create')
    OR has_permission('marketing.campaigns.edit')
    OR has_permission('marketing.campaigns.send')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can insert campaigns"
  ON marketing_campaigns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_permission('marketing.campaigns.create')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can update campaigns"
  ON marketing_campaigns
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('marketing.campaigns.edit')
    OR is_admin()
  )
  WITH CHECK (
    has_permission('marketing.campaigns.edit')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can delete campaigns"
  ON marketing_campaigns
  FOR DELETE
  TO authenticated
  USING (
    has_permission('marketing.campaigns.delete')
    OR is_admin()
  );

-- ============================================
-- CAMPAIGN_RECIPIENTS TABLE
-- ============================================

-- Drop old admin-only policies
DROP POLICY IF EXISTS "Admins can view all recipients" ON campaign_recipients;
DROP POLICY IF EXISTS "Admins can insert recipients" ON campaign_recipients;
DROP POLICY IF EXISTS "Admins can update recipients" ON campaign_recipients;

-- Create new permission-based policies
CREATE POLICY "Users with marketing permission can view recipients"
  ON campaign_recipients
  FOR SELECT
  TO authenticated
  USING (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.list')
    OR has_permission('marketing.campaigns.send')
    OR has_permission('marketing.stats')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can insert recipients"
  ON campaign_recipients
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_permission('marketing.campaigns.send')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can update recipients"
  ON campaign_recipients
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('marketing.campaigns.send')
    OR is_admin()
  )
  WITH CHECK (
    has_permission('marketing.campaigns.send')
    OR is_admin()
  );

-- ============================================
-- CAMPAIGN_SEGMENTS TABLE
-- ============================================

-- Drop old admin-only policies
DROP POLICY IF EXISTS "Admins can view all segments" ON campaign_segments;
DROP POLICY IF EXISTS "Admins can insert segments" ON campaign_segments;
DROP POLICY IF EXISTS "Admins can update segments" ON campaign_segments;
DROP POLICY IF EXISTS "Admins can delete segments" ON campaign_segments;

-- Create new permission-based policies
CREATE POLICY "Users with marketing permission can view segments"
  ON campaign_segments
  FOR SELECT
  TO authenticated
  USING (
    has_permission('marketing.view')
    OR has_permission('marketing.campaigns.create')
    OR has_permission('marketing.campaigns.edit')
    OR has_permission('marketing.segments.manage')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can insert segments"
  ON campaign_segments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_permission('marketing.segments.manage')
    OR has_permission('marketing.campaigns.create')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can update segments"
  ON campaign_segments
  FOR UPDATE
  TO authenticated
  USING (
    has_permission('marketing.segments.manage')
    OR is_admin()
  )
  WITH CHECK (
    has_permission('marketing.segments.manage')
    OR is_admin()
  );

CREATE POLICY "Users with marketing permission can delete segments"
  ON campaign_segments
  FOR DELETE
  TO authenticated
  USING (
    has_permission('marketing.segments.manage')
    OR is_admin()
  );
