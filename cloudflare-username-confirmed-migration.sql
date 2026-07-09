-- Add username_confirmed_by_user column to track if user has confirmed their username
ALTER TABLE users ADD COLUMN username_confirmed_by_user BOOLEAN DEFAULT 0;

-- Set existing users to have username_confirmed_by_user = 1 since they already have usernames
UPDATE users SET username_confirmed_by_user = 1 WHERE username IS NOT NULL AND username != '';
