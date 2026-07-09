/*
  # TubeLinkr Cloudflare D1 Database Schema

  ## Overview
  This schema defines the tables for TubeLinkr on Cloudflare D1, a creator-focused link redirect and tracking tool.

  ## Tables Created
  
  ### 1. users
  - `id` (integer, primary key, auto increment) - Auto-generated user ID
  - `email` (text, unique, not null) - User email address
  - `username` (text, unique, not null, indexed) - Public username used in URLs (e.g., tubelinkr.com/username/slug)
  - `created_at` (text, not null) - Account creation timestamp (ISO format)
  - `updated_at` (text, not null) - Last update timestamp (ISO format)
  - `is_active` (integer, not null, default 1) - Account status flag (1=active, 0=inactive)

  ### 2. links
  - `id` (integer, primary key, auto increment) - Auto-generated link ID
  - `user_id` (integer, not null, indexed, foreign key) - Reference to users table
  - `slug` (text, not null) - URL-friendly slug (e.g., "best-plane")
  - `original_url` (text, not null) - Destination URL for redirect
  - `title` (text, nullable) - Optional link title/description
  - `created_at` (text, not null) - Link creation timestamp (ISO format)
  - `updated_at` (text, not null) - Last update timestamp (ISO format)
  - `is_active` (integer, not null, default 1) - Link active status (1=active, 0=inactive)
  - **Constraint**: UNIQUE(user_id, slug) - Each user has unique slugs

  ### 3. click_events
  - `id` (integer, primary key, auto increment) - Auto-generated event ID
  - `link_id` (integer, not null, indexed, foreign key) - Reference to links table
  - `timestamp` (text, not null, indexed) - Event timestamp (ISO format)
  - `referrer` (text, nullable) - HTTP referrer header
  - `user_agent` (text, nullable) - Browser/client user agent
  - `ip_hash` (text, nullable) - Hashed IP address for privacy
  - `source` (text, nullable) - Custom source parameter (e.g., "pinned-comment", "description")

  ## Indexes
  - users.username (for fast public link lookups)
  - links.user_id (for user link queries)
  - click_events.link_id (for analytics queries)
  - click_events.timestamp (for time-based analytics)

  ## SQL Schema
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- Create index on username for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Create links table
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  slug TEXT NOT NULL,
  original_url TEXT NOT NULL,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, slug),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes on links
CREATE INDEX IF NOT EXISTS idx_links_user_id ON links(user_id);

-- Create click_events table
CREATE TABLE IF NOT EXISTS click_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  ip_hash TEXT,
  source TEXT,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- Create indexes on click_events
CREATE INDEX IF NOT EXISTS idx_click_events_link_id ON click_events(link_id);
CREATE INDEX IF NOT EXISTS idx_click_events_timestamp ON click_events(timestamp);
