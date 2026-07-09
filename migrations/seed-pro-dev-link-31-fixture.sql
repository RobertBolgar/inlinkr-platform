-- ============================================================================
-- PRO-DEV ONLY: Seed pro-dev with production data for link_id = 31
-- ============================================================================
-- WARNING: DO NOT RUN THIS SCRIPT ON PRODUCTION
-- This script is for pro-dev testing only. It seeds a minimal test fixture
-- to reproduce the JQZ6aM1zLXs attribution bug on pro-dev.
--
-- Dataset: 20 records (1 user, 1 link, 1 link_usage, 2 placements, 15 clicks)
-- Maps production user_id 1 to pro-dev user_id 8
--
-- Usage: npx wrangler d1 execute tubelinkr-db --remote --file migrations/seed-pro-dev-link-31-fixture.sql
-- Reset: npx wrangler d1 execute tubelinkr-db --remote --file migrations/reset-pro-dev-link-31-fixture.sql
-- ============================================================================

-- Insert link 31 (using existing user id 8)
INSERT OR IGNORE INTO links (id, user_id, slug, original_url, title, created_at, updated_at, is_active, video_id, placement_count, is_system, subtitle, public_code)
VALUES (31, 8, 'prompts', 'https://robertbolgar.dev/prompts', 'The Prompts That Started It All', '2026-06-07T20:07:29.043Z', '2026-06-07T20:07:29.043Z', 1, 'JQZ6aM1zLXs', 2, 0, 'Explore the original ChatGPT prompts behind every project, rebuild, and public build journey. See exactly how each idea started before Devin wrote a single line of code.', '2qa0e1');

-- Insert placement 59 (YouTube Description)
INSERT OR IGNORE INTO placements (id, link_id, name, type, source_code, public_code, created_at, updated_at, link_usage_id, youtube_video_id)
VALUES (59, 31, 'YouTube Description', 'description', 'd', 'd', '2026-06-07T20:07:29.181Z', '2026-06-07T20:07:29.181Z', NULL, NULL);

-- Insert placement 62 (Shorts Description)
INSERT OR IGNORE INTO placements (id, link_id, name, type, source_code, public_code, created_at, updated_at, link_usage_id, youtube_video_id)
VALUES (62, 31, 'Shorts Description', 'short', 's', 's', '2026-06-22T02:52:29.170Z', '2026-06-22T02:52:29.170Z', NULL, 'AA1kfTe-dO0');

-- Insert link_usage 25 (AA1kfTe-dO0, using user_id 8)
INSERT OR IGNORE INTO link_usages (id, link_id, user_id, youtube_video_id, placement_type, placement_name, public_code, source_code, destination_url_snapshot, title_snapshot, is_active, created_at, updated_at)
VALUES (25, 31, 8, 'AA1kfTe-dO0', 'short', 'Shorts Description', 's', 's', 'https://robertbolgar.dev/prompts', 'The Prompts That Started It All', 1, '2026-06-22T02:52:29.374Z', '2026-06-22T02:52:29.374Z');

-- Insert click events (14 records)
INSERT OR IGNORE INTO click_events (id, link_id, timestamp, referrer, user_agent, ip_hash, source, link_usage_id)
VALUES 
(111, 31, '2026-06-07T20:09:08.090Z', NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', '155.117.189.109', 'direct', NULL),
(112, 31, '2026-06-07T20:21:26.523Z', NULL, 'Google-Safety', '66.102.6.233', 'direct', NULL),
(113, 31, '2026-06-07T20:21:26.905Z', NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '84.254.110.228', 'direct', NULL),
(114, 31, '2026-06-07T20:21:27.526Z', NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '84.254.110.228', 'direct', NULL),
(115, 31, '2026-06-07T20:21:31.637Z', NULL, 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Google-Safety; +http://www.google.com/bot.html)', '209.85.238.77', 'direct', NULL),
(119, 31, '2026-06-14T19:28:08.444Z', 'https://rob.tubelinkr.com/', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', '155.117.189.109', 'direct', NULL),
(120, 31, '2026-06-14T19:28:12.793Z', 'https://rob.tubelinkr.com/', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', '155.117.189.109', 'direct', NULL),
(134, 31, '2026-06-22T03:05:31.072Z', NULL, 'Google-Safety', '66.102.6.230', 's', 25),
(135, 31, '2026-06-22T03:05:31.918Z', 'https://tubelinkr.com/', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', '84.254.110.229', 's', 25),
(136, 31, '2026-06-22T03:05:32.454Z', 'https://tubelinkr.com/', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '84.254.110.229', 's', 25),
(137, 31, '2026-06-22T21:15:00.482Z', NULL, 'Google-Safety', '192.178.11.98', 'd', NULL),
(138, 31, '2026-06-22T21:15:01.012Z', NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '50.203.161.10', 'd', NULL),
(139, 31, '2026-06-22T21:15:01.777Z', NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36', '63.117.14.71', 'd', NULL),
(140, 31, '2026-06-22T21:15:06.648Z', NULL, 'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.96 Mobile Safari/537.36 (compatible; Google-Safety; +http://www.google.com/bot.html)', '209.85.238.75', 'd', NULL),
(145, 31, '2026-06-23T00:02:09.968Z', NULL, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36', '134.82.68.164', 'd', NULL);

-- Verification: Check fixture was seeded correctly
SELECT 'VERIFICATION: Fixture seeded' as step;
SELECT COUNT(*) as user_count FROM users WHERE id = 8;
SELECT COUNT(*) as link_count FROM links WHERE id = 31;
SELECT COUNT(*) as placement_count FROM placements WHERE id IN (59, 62);
SELECT COUNT(*) as link_usage_count FROM link_usages WHERE id = 25;
SELECT COUNT(*) as click_event_count FROM click_events WHERE id IN (111,112,113,114,115,119,120,134,135,136,137,138,139,140,145);
