-- Add subdomain support for custom subdomains (Pro+ feature)
-- This will enable URLs like: username.tubelinkr.com

ALTER TABLE users ADD COLUMN subdomain TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX idx_users_subdomain ON users(subdomain);
