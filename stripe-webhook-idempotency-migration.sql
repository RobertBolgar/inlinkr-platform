-- Add Stripe webhook idempotency table
-- This prevents duplicate webhook event processing

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT,
  processed_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups by event ID
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_id ON stripe_webhook_events(id);

-- Create index for querying by event type (useful for analytics/debugging)
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(type);
