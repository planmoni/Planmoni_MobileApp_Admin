# Deploy Marketing Campaigns Edge Function

## Quick Deploy

Run this command to deploy the updated `marketing-campaigns` edge function:

```bash
supabase functions deploy marketing-campaigns --project-ref rqmpnoaavyizlwzfngpr
```

## If You Need to Link First

If you haven't linked your project yet, run:

```bash
supabase link --project-ref rqmpnoaavyizlwzfngpr
```

You'll be prompted for your database password. After linking, deploy:

```bash
supabase functions deploy marketing-campaigns
```

## What Was Fixed

The edge function now includes:
- Better error handling for all recipient queries
- Proper filtering of recipients without valid email addresses
- Improved logging for debugging
- Correct handling of predefined segments vs custom segments
- More descriptive error messages

## Verify Deployment

After deploying, try sending a campaign again. The error messages should now be more specific, helping identify why recipients aren't being found.
