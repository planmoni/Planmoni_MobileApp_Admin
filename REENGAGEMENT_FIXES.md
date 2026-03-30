# Re-engagement Notification System Fixes

## Issues Fixed

### Issue 1: Eligible User Counts Showing 0
The re-engagement notification system was showing 0 eligible users for all categories because the database functions had overly restrictive conditions.

### Issue 2: Individual Notifications Not Working Properly
When sending notifications from the User Details page, the system would show "success" even when the user had no push tokens or delivery failed.

### Issue 3: Dispatch Logs Not Displaying
The Notifications page showed "Dispatched Today: 8" but the dispatch logs table was empty with a database error.

## Fixes Applied

### 1. Zero Balance Users (`get_zero_balance_users`)
**Previous Issue:** Required `wallet.updated_at` to be older than 3 days, which excluded users who never had transactions.

**Fix:** Now checks if either:
- Wallet was updated 3+ days ago, OR
- Account was created 3+ days ago (for users who never had wallet activity)

### 2. Deposit Without Plan (`get_deposit_no_plan_users`)
**Previous Issue:** Only found users with balance > 0, missing users who deposited but spent their funds.

**Fix:** Now finds ALL users who:
- Ever made at least one completed deposit
- Never created any payout plan
- Made their last deposit within the last 30 days

### 3. No Plan Created (`get_no_plan_users`)
**Previous Issue:** Basic implementation without detailed user information.

**Fix:** Enhanced to include:
- Users who signed up 3-60 days ago
- Never created any payout plan
- Now includes `has_deposited` flag to show if they made deposits

### 4. Unfunded Vaults (`get_unfunded_vault_users`)
**Previous Issue:** Required vaults created 3+ days ago (too restrictive).

**Fix:** Now finds vaults created 1+ day ago with zero balance, making it more responsive.

### 5. Inactive Users (`get_inactive_users`)
**Previous Issue:** Could fail if `last_sign_in_at` was NULL.

**Fix:** Uses `COALESCE(last_sign_in_at, created_at)` to handle users who never signed in.

## Common Improvements Across All Functions

1. **Better NULL handling** - All functions now handle missing data gracefully
2. **Notification preferences** - Properly checks if preferences are NULL (defaults to enabled)
3. **Cooldown period** - All functions respect 7-day cooldown to avoid spam
4. **Push token requirement** - Only targets users with active push tokens
5. **Clear comments** - All SQL is documented for future maintenance

## Testing the Fixes

### Method 1: Check Stats from Admin Panel
1. Navigate to Notifications page
2. Look at the Re-engagement Alerts section
3. Each category should now show the actual count of eligible users

### Method 2: Test via Supabase SQL Editor
Run these queries to verify each function:

```sql
-- Check zero balance users
SELECT COUNT(*) FROM get_zero_balance_users();

-- Check users who deposited without creating plans
SELECT COUNT(*) FROM get_deposit_no_plan_users();

-- Check users who never created plans
SELECT COUNT(*) FROM get_no_plan_users();

-- Check unfunded vault users
SELECT COUNT(*) FROM get_unfunded_vault_users();

-- Check inactive users
SELECT COUNT(*) FROM get_inactive_users();

-- Get all stats at once
SELECT * FROM get_reengagement_stats();
```

### Method 3: Test Individual Function Details
```sql
-- See actual user details for zero balance
SELECT * FROM get_zero_balance_users() LIMIT 5;

-- See users who deposited but have no plan
SELECT * FROM get_deposit_no_plan_users() LIMIT 5;
```

## Expected Results

Based on your user base, you should see:
- **Deposit Without Plan**: Users who made deposits but never created a payout plan
- **No Plan Created**: Users who signed up but never created any plan
- **Zero Balance**: Users with empty wallets for 3+ days
- **Unfunded Vaults**: Users with active vaults that have no balance
- **Inactive Users**: Users who haven't signed in for 14+ days

## Migration Applied

- **File**: `supabase/migrations/20260330162727_fix_reengagement_functions_v2.sql`
- **Status**: ✅ Applied successfully
- **Changes**: Dropped and recreated all 5 re-engagement functions with improved logic

## Frontend Improvements

### SendReengagementButton Component
Enhanced error handling and user feedback:

1. **Better Success Messages** - Now shows actual delivery count (e.g., "Alert sent successfully to 2 devices")
2. **Zero Delivery Detection** - Throws error if user has no active push tokens or all deliveries failed
3. **Response Validation** - Checks both HTTP status and response.success flag
4. **Clear Error Messages** - Shows specific error when user has no push tokens

### What Happens When Sending Individual Notifications

1. Button checks if user qualifies for any re-engagement categories
2. User selects category and confirms
3. Frontend sends request to `admin-push-notifications` edge function
4. Edge function:
   - Validates user permissions
   - Fetches user's active push tokens
   - If no tokens found: Returns error with status 400
   - If tokens found: Sends to Expo Push API
   - Logs delivery status for each token
5. Frontend now properly handles all response scenarios

## Issue 3 Fix: Dispatch Logs Database Function

### Root Cause
The `get_notification_dispatch_logs()` function had a critical bug - it referenced `p.full_name` which doesn't exist in the profiles table. The profiles table uses `first_name` and `last_name` columns instead.

### Error Message
```
ERROR: column p.full_name does not exist
```

### Fix Applied
Created migration: `fix_notification_dispatch_logs_full_name.sql`

**Changes:**
1. Replaced `p.full_name` with `CONCAT(p.first_name, ' ', p.last_name)` in SELECT clause
2. Updated search filter to use concatenated name instead of full_name
3. Function now properly returns user names in dispatch logs

**Result:**
- Dispatch logs now display correctly with user names
- Search by user name functionality works
- Stats ("Dispatched Today: 8") and logs are now in sync
- No more database errors when viewing notifications

## Known Issues & Notes

### Old Edge Function
There's an old `send-push-notifications` edge function (ID: ca30b4b8-eff4-4a22-acb9-4a354a7eaaad) that still exists in Supabase but has no source code in the project. This function returns 401 errors when called. It's not used by the admin panel but might be called by:
- Database triggers
- Scheduled jobs
- Old mobile app versions

**Recommendation**: Investigate and remove this function if it's no longer needed, or update it to match the current `admin-push-notifications` implementation.

## Next Steps

1. Verify the counts in the admin dashboard
2. Test sending individual notifications from User Details page
3. Verify error messages appear correctly when user has no push tokens
4. Monitor delivery rates and user engagement
5. Adjust time windows if needed (currently 3 days for zero balance, 14 days for inactivity)
6. Clean up old `send-push-notifications` edge function
