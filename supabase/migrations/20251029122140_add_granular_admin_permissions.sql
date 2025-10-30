/*
  # Add Granular Admin Panel Permissions

  1. Purpose
    - Replace generic permissions with specific UI component permissions
    - Allow fine-grained control over what each role can see in the admin panel
    - Enable/disable individual cards, stats, and sections

  2. New Permissions Structure
    
    **Dashboard Permissions:**
    - dashboard.stats.new_users - View New Users stat card
    - dashboard.stats.deposits - View Total Deposits stat card
    - dashboard.stats.payouts - View Total Payouts stat card
    - dashboard.stats.new_plans - View New Plans stat card
    - dashboard.stats.kyc_completed - View KYC Completed stat card
    - dashboard.stats.locked_balance - View Locked Balance stat card
    - dashboard.stats.cancelled_plans - View Cancelled Plans stat card
    - dashboard.stats.withdrawals - View Total Withdrawals stat card
    - dashboard.stats.payout_due_today - View Payout Due Today stat card
    - dashboard.charts.transaction_volume - View Transaction Volume chart
    - dashboard.charts.plan_distribution - View Plan Distribution chart
    - dashboard.lists.todays_transactions - View Today's Transactions list
    - dashboard.lists.users_joined_today - View Users Joined Today list
    - dashboard.lists.todays_payout_events - View Today's Payout Events list
    - dashboard.lists.todays_activities - View Today's Activities list

    **Users Page Permissions:**
    - users.list - View users list
    - users.details - View user details
    - users.stats - View user statistics
    - users.search - Search users
    - users.export - Export user data

    **Calendar Page Permissions:**
    - calendar.view - View calendar
    - calendar.events - View payout events

    **Transactions Page Permissions:**
    - transactions.list - View transactions list
    - transactions.details - View transaction details
    - transactions.stats - View transaction statistics
    - transactions.search - Search transactions
    - transactions.filter - Filter transactions
    - transactions.export - Export transactions

    **Analytics Page Permissions:**
    - analytics.overview - View analytics overview
    - analytics.revenue - View revenue analytics
    - analytics.users - View user analytics
    - analytics.charts - View analytics charts
    - analytics.export - Export analytics data

    **Activity Page Permissions:**
    - activity.view - View activity logs
    - activity.filter - Filter activities
    - activity.export - Export activities

    **KYC Data Permissions:**
    - kyc.list - View KYC submissions list
    - kyc.details - View KYC details
    - kyc.approve - Approve KYC
    - kyc.reject - Reject KYC
    - kyc.stats - View KYC statistics

    **Payout Events Permissions:**
    - payout_events.list - View payout events
    - payout_events.details - View event details
    - payout_events.stats - View payout statistics

    **Payout Plans Permissions:**
    - payout_plans.list - View payout plans
    - payout_plans.details - View plan details
    - payout_plans.stats - View plan statistics

    **Banners Permissions:**
    - banners.view - View banners
    - banners.create - Create banners
    - banners.edit - Edit banners
    - banners.delete - Delete banners

    **Super Admin Permissions:**
    - super_admin.roles - Manage roles
    - super_admin.permissions - Manage permissions
    - super_admin.users - Manage user roles
    - super_admin.stats - View admin statistics

  3. Implementation
    - Clear existing permissions
    - Insert new granular permissions
    - Organize by categories
*/

-- Delete existing generic permissions
DELETE FROM role_permissions;
DELETE FROM permissions;
DELETE FROM permission_categories;

-- Recreate permission categories
INSERT INTO permission_categories (id, name, description) VALUES
  (gen_random_uuid(), 'Dashboard', 'Dashboard statistics and data visibility'),
  (gen_random_uuid(), 'Users', 'User management and data access'),
  (gen_random_uuid(), 'Calendar', 'Calendar and events access'),
  (gen_random_uuid(), 'Transactions', 'Transaction data and management'),
  (gen_random_uuid(), 'Analytics', 'Analytics and reporting access'),
  (gen_random_uuid(), 'Activity', 'Activity logs and audit trails'),
  (gen_random_uuid(), 'KYC', 'KYC data and verification'),
  (gen_random_uuid(), 'Payout Events', 'Payout event management'),
  (gen_random_uuid(), 'Payout Plans', 'Payout plan management'),
  (gen_random_uuid(), 'Banners', 'Banner management'),
  (gen_random_uuid(), 'Super Admin', 'Super admin functions')
ON CONFLICT DO NOTHING;

-- Insert granular permissions
INSERT INTO permissions (name, description, category_id, resource, action, is_system) 
SELECT 
  perm.name,
  perm.description,
  (SELECT id FROM permission_categories WHERE name = perm.category),
  perm.resource,
  perm.action,
  true
FROM (VALUES
  -- Dashboard Stats
  ('dashboard.stats.new_users', 'View New Users stat card', 'Dashboard', 'dashboard', 'stats.new_users'),
  ('dashboard.stats.deposits', 'View Total Deposits stat card', 'Dashboard', 'dashboard', 'stats.deposits'),
  ('dashboard.stats.payouts', 'View Total Payouts stat card', 'Dashboard', 'dashboard', 'stats.payouts'),
  ('dashboard.stats.new_plans', 'View New Plans stat card', 'Dashboard', 'dashboard', 'stats.new_plans'),
  ('dashboard.stats.kyc_completed', 'View KYC Completed stat card', 'Dashboard', 'dashboard', 'stats.kyc_completed'),
  ('dashboard.stats.locked_balance', 'View Locked Balance stat card', 'Dashboard', 'dashboard', 'stats.locked_balance'),
  ('dashboard.stats.cancelled_plans', 'View Cancelled Plans stat card', 'Dashboard', 'dashboard', 'stats.cancelled_plans'),
  ('dashboard.stats.withdrawals', 'View Total Withdrawals stat card', 'Dashboard', 'dashboard', 'stats.withdrawals'),
  ('dashboard.stats.payout_due_today', 'View Payout Due Today stat card', 'Dashboard', 'dashboard', 'stats.payout_due_today'),
  
  -- Dashboard Charts
  ('dashboard.charts.transaction_volume', 'View Transaction Volume chart', 'Dashboard', 'dashboard', 'charts.transaction_volume'),
  ('dashboard.charts.plan_distribution', 'View Plan Distribution chart', 'Dashboard', 'dashboard', 'charts.plan_distribution'),
  
  -- Dashboard Lists
  ('dashboard.lists.todays_transactions', 'View Today''s Transactions list', 'Dashboard', 'dashboard', 'lists.todays_transactions'),
  ('dashboard.lists.users_joined_today', 'View Users Joined Today list', 'Dashboard', 'dashboard', 'lists.users_joined_today'),
  ('dashboard.lists.todays_payout_events', 'View Today''s Payout Events list', 'Dashboard', 'dashboard', 'lists.todays_payout_events'),
  ('dashboard.lists.todays_activities', 'View Today''s Activities list', 'Dashboard', 'dashboard', 'lists.todays_activities'),
  
  -- Users
  ('users.list', 'View users list', 'Users', 'users', 'list'),
  ('users.details', 'View user details', 'Users', 'users', 'details'),
  ('users.stats', 'View user statistics', 'Users', 'users', 'stats'),
  ('users.search', 'Search users', 'Users', 'users', 'search'),
  ('users.export', 'Export user data', 'Users', 'users', 'export'),
  
  -- Calendar
  ('calendar.view', 'View calendar', 'Calendar', 'calendar', 'view'),
  ('calendar.events', 'View payout events on calendar', 'Calendar', 'calendar', 'events'),
  
  -- Transactions
  ('transactions.list', 'View transactions list', 'Transactions', 'transactions', 'list'),
  ('transactions.details', 'View transaction details', 'Transactions', 'transactions', 'details'),
  ('transactions.stats', 'View transaction statistics', 'Transactions', 'transactions', 'stats'),
  ('transactions.search', 'Search transactions', 'Transactions', 'transactions', 'search'),
  ('transactions.filter', 'Filter transactions', 'Transactions', 'transactions', 'filter'),
  ('transactions.export', 'Export transaction data', 'Transactions', 'transactions', 'export'),
  
  -- Analytics
  ('analytics.overview', 'View analytics overview', 'Analytics', 'analytics', 'overview'),
  ('analytics.revenue', 'View revenue analytics', 'Analytics', 'analytics', 'revenue'),
  ('analytics.users', 'View user analytics', 'Analytics', 'analytics', 'users'),
  ('analytics.charts', 'View analytics charts', 'Analytics', 'analytics', 'charts'),
  ('analytics.export', 'Export analytics data', 'Analytics', 'analytics', 'export'),
  
  -- Activity
  ('activity.view', 'View activity logs', 'Activity', 'activity', 'view'),
  ('activity.filter', 'Filter activity logs', 'Activity', 'activity', 'filter'),
  ('activity.export', 'Export activity logs', 'Activity', 'activity', 'export'),
  
  -- KYC
  ('kyc.list', 'View KYC submissions list', 'KYC', 'kyc', 'list'),
  ('kyc.details', 'View KYC submission details', 'KYC', 'kyc', 'details'),
  ('kyc.approve', 'Approve KYC submissions', 'KYC', 'kyc', 'approve'),
  ('kyc.reject', 'Reject KYC submissions', 'KYC', 'kyc', 'reject'),
  ('kyc.stats', 'View KYC statistics', 'KYC', 'kyc', 'stats'),
  
  -- Payout Events
  ('payout_events.list', 'View payout events list', 'Payout Events', 'payout_events', 'list'),
  ('payout_events.details', 'View payout event details', 'Payout Events', 'payout_events', 'details'),
  ('payout_events.stats', 'View payout event statistics', 'Payout Events', 'payout_events', 'stats'),
  
  -- Payout Plans
  ('payout_plans.list', 'View payout plans list', 'Payout Plans', 'payout_plans', 'list'),
  ('payout_plans.details', 'View payout plan details', 'Payout Plans', 'payout_plans', 'details'),
  ('payout_plans.stats', 'View payout plan statistics', 'Payout Plans', 'payout_plans', 'stats'),
  
  -- Banners
  ('banners.view', 'View banners', 'Banners', 'banners', 'view'),
  ('banners.create', 'Create new banners', 'Banners', 'banners', 'create'),
  ('banners.edit', 'Edit existing banners', 'Banners', 'banners', 'edit'),
  ('banners.delete', 'Delete banners', 'Banners', 'banners', 'delete'),
  
  -- Super Admin
  ('super_admin.roles', 'Manage roles and permissions', 'Super Admin', 'super_admin', 'roles'),
  ('super_admin.permissions', 'Manage permission assignments', 'Super Admin', 'super_admin', 'permissions'),
  ('super_admin.users', 'Manage user role assignments', 'Super Admin', 'super_admin', 'users'),
  ('super_admin.stats', 'View super admin statistics', 'Super Admin', 'super_admin', 'stats')
) AS perm(name, description, category, resource, action);
