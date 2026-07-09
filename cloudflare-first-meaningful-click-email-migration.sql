-- Add first_meaningful_click_email_sent_at column to users table
-- This will store the timestamp when the first meaningful click email was sent
-- Used as a one-time guard to ensure the email is sent only once per user

ALTER TABLE users ADD COLUMN first_meaningful_click_email_sent_at TEXT;
