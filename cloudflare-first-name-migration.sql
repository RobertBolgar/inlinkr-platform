-- Add first_name column to users table
-- This will store the user's first name from Clerk for personalized emails

ALTER TABLE users ADD COLUMN first_name TEXT;
