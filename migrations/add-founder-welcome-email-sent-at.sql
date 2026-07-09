-- Add founder_welcome_email_sent_at column to users table
-- This tracks when the Founder welcome email was sent to prevent duplicate sends
ALTER TABLE users
ADD COLUMN founder_welcome_email_sent_at TEXT;
