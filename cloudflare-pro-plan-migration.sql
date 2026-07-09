-- Add Pro entitlement fields to users table
-- This migration adds minimal fields needed for plan-based feature gating

ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free' NOT NULL;
ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN subscription_current_period_end TEXT DEFAULT NULL;
