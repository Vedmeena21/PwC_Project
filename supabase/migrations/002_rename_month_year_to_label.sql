-- Rename month_year → label on rulebook_versions
-- Run this in Supabase SQL Editor once
ALTER TABLE rulebook_versions RENAME COLUMN month_year TO label;
