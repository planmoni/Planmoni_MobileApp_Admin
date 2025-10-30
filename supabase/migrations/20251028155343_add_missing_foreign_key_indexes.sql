/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes on all foreign key columns that are missing covering indexes
    - Improves query performance for joins and foreign key constraint checks
  
  2. Tables Updated
    - audit_logs: Add index on user_id
    - custom_payout_dates: Add index on payout_plan_id
    - emergency_withdrawals: Add indexes on bank_account_id and payout_account_id
    - events: Add indexes on payout_plan_id and transaction_id
    - kyc_audit_logs: Add index on previous_log_id
    - notifications: Add index on user_id
    - payout_plans: Add indexes on bank_account_id and payout_account_id
    - permissions: Add index on category_id
    - profiles: Add index on referred_by
    - role_permissions: Add indexes on granted_by and permission_id
    - transactions: Add indexes on bank_account_id and payout_plan_id
    - user_roles: Add indexes on assigned_by and role_id
*/

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);

-- custom_payout_dates
CREATE INDEX IF NOT EXISTS idx_custom_payout_dates_payout_plan_id ON custom_payout_dates(payout_plan_id);

-- emergency_withdrawals
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_bank_account_id ON emergency_withdrawals(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_emergency_withdrawals_payout_account_id ON emergency_withdrawals(payout_account_id);

-- events
CREATE INDEX IF NOT EXISTS idx_events_payout_plan_id ON events(payout_plan_id);
CREATE INDEX IF NOT EXISTS idx_events_transaction_id ON events(transaction_id);

-- kyc_audit_logs
CREATE INDEX IF NOT EXISTS idx_kyc_audit_logs_previous_log_id ON kyc_audit_logs(previous_log_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- payout_plans
CREATE INDEX IF NOT EXISTS idx_payout_plans_bank_account_id ON payout_plans(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_payout_plans_payout_account_id ON payout_plans(payout_account_id);

-- permissions
CREATE INDEX IF NOT EXISTS idx_permissions_category_id ON permissions(category_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by ON profiles(referred_by);

-- role_permissions
CREATE INDEX IF NOT EXISTS idx_role_permissions_granted_by ON role_permissions(granted_by);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account_id ON transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_payout_plan_id ON transactions(payout_plan_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_assigned_by ON user_roles(assigned_by);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);