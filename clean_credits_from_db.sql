-- Clean credit records from database
-- This script sets all credit values to 0 in the cost_data table
-- Run this after removing credit feature from the application

BEGIN;

-- Update all cost_data records to set credits to 0
UPDATE cost_data
SET credits = 0
WHERE credits IS NOT NULL AND credits::numeric != 0;

-- Verify the update
SELECT 
  COUNT(*) as total_records,
  COUNT(CASE WHEN credits::numeric = 0 THEN 1 END) as records_with_zero_credits,
  COUNT(CASE WHEN credits::numeric != 0 THEN 1 END) as records_with_non_zero_credits
FROM cost_data;

COMMIT;

-- Optional: If you want to see what was changed before committing, run this first:
-- SELECT 
--   id,
--   user_id,
--   provider_id,
--   account_id,
--   month,
--   year,
--   credits as old_credits,
--   0 as new_credits
-- FROM cost_data
-- WHERE credits IS NOT NULL AND credits::numeric != 0;
