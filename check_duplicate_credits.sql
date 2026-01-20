-- Query to check for duplicate cost_data entries that might cause credits to be double-counted
-- Run this in your PostgreSQL database to identify the issue

-- Check for duplicate entries (same user, provider, month, year, account_id)
SELECT 
  user_id,
  provider_id,
  account_id,
  month,
  year,
  COUNT(*) as duplicate_count,
  SUM(credits::numeric) as total_credits,
  STRING_AGG(id::text, ', ') as cost_data_ids
FROM cost_data
WHERE credits IS NOT NULL AND credits::numeric != 0
GROUP BY user_id, provider_id, account_id, month, year
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Check all cost_data entries with credits for a specific user (replace USER_ID)
-- SELECT 
--   id,
--   user_id,
--   provider_id,
--   account_id,
--   month,
--   year,
--   credits,
--   current_month_cost,
--   created_at,
--   updated_at
-- FROM cost_data
-- WHERE user_id = USER_ID
--   AND credits IS NOT NULL 
--   AND credits::numeric != 0
-- ORDER BY provider_id, account_id, month, year, created_at;
