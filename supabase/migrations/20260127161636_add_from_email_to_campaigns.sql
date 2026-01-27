/*
  # Add From Email ID to Marketing Campaigns
  
  1. Changes
    - Add `from_email_id` column to `marketing_campaigns` table
    - Add foreign key constraint to `sender_email_addresses`
    - Set default value for existing campaigns (use default sender email)
  
  2. Migration
    - Existing campaigns without from_email_id will use the default email
*/

-- Add from_email_id column
ALTER TABLE marketing_campaigns
ADD COLUMN IF NOT EXISTS from_email_id uuid REFERENCES sender_email_addresses(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_campaigns_from_email_id ON marketing_campaigns(from_email_id);

-- Set default from_email_id for existing campaigns
UPDATE marketing_campaigns
SET from_email_id = (
  SELECT id FROM sender_email_addresses WHERE is_default = true LIMIT 1
)
WHERE from_email_id IS NULL;
