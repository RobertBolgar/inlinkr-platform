# TubeLinkr Product Capability Audit

**Date:** June 25, 2026  
**Branch:** pro-dev  
**Purpose:** Comprehensive documentation of all current product capabilities for marketing, homepage planning, onboarding, documentation, pricing, and roadmap planning.

---

## Table of Contents

1. [Core Features](#core-features)
2. [User Benefits](#user-benefits)
3. [Hidden Capabilities](#hidden-capabilities)
4. [Marketing Angles](#marketing-angles)
5. [Competitive Advantages](#competitive-advantages)
6. [Current Limitations](#current-limitations)
7. [Homepage Opportunities](#homepage-opportunities)
8. [Executive Summary](#executive-summary)

---

## Core Features

### 1. Smart Links

**What it does:** Core product object representing tracked links. Users create Smart Links with a custom slug and destination URL. Each Smart Link can be reused across multiple videos and placements with independent tracking.

**Why it exists:** Enables creators to track which specific YouTube videos and placements drive actual clicks to their destinations, replacing blind link posting with data-driven decisions.

**Who benefits:** YouTube creators who post affiliate links, product links, or any destination URLs and need to know which content converts.

**Plan level:** Free (5 links), Pro/Founder (unlimited)

**Status:** Fully implemented

**Limitations:**
- Free users limited to 5 Smart Links
- Slug must be unique per user
- Max 50 characters, alphanumeric and hyphens only

---

### 2. Placement Tracking

**What it does:** Tracks clicks from specific YouTube placements (Description, Pinned Comment, Bio, Shorts, Video CTAs, Custom). Each placement generates a unique tracking URL for the same Smart Link.

**Why it exists:** Different placements have different conversion rates. Creators need to know which placement types actually drive clicks to optimize their strategy.

**Who benefits:** All creators who place links in multiple locations across their YouTube presence.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Limited to predefined placement types
- No custom placement name editing in current UI
- Placement metadata is static (no dynamic learning)

---

### 3. Placement Intelligence

**What it does:** Central registry of placement metadata including labels, clickability scores, friction levels, creator guidance, and best use cases. Provides sponsor-friendly labels for proof pages.

**Why it exists:** Standardizes placement terminology and provides actionable guidance to creators about which placements work best for different scenarios.

**Who benefits:** All creators for guidance; sponsors for proof page credibility.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Static metadata (not dynamically updated based on performance)
- Limited to 6 placement types
- No A/B testing framework

---

### 4. YouTube Channel Connection

**What it does:** OAuth integration with YouTube API to connect creator channels, fetch video metadata (titles, thumbnails), and enable video-attributed analytics.

**Why it exists:** Enables video-level attribution so creators can see which specific videos drive clicks, not just aggregate performance.

**Who benefits:** All creators with YouTube channels.

**Plan level:** All plans (single channel), Pro/Founder (multi-channel - hidden for launch)

**Status:** Fully implemented

**Limitations:**
- Currently single-channel only (multi-channel feature gated)
- Requires OAuth re-authorization if tokens expire
- No automatic video sync (manual fetch only)

---

### 5. Video-Level Analytics

**What it does:** Per-video performance dashboard showing total clicks, CTR, views, link count, placement breakdown, and click paths. Auto-refreshes every 15 seconds and on tab visibility.

**Why it exists:** Creators need to know which videos are their best performers to replicate success and optimize content strategy.

**Who benefits:** All creators with connected YouTube channels.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- CTR calculation depends on YouTube API view data (may have delays)
- No historical trend visualization
- No video comparison tools

---

### 6. Creator Hub (Public Profile)

**What it does:** Public creator profile page accessible via branded subdomain (username.tubelinkr.com) or go.tubelinkr.com/username. Displays creator's links, featured videos, custom sections, and hub settings.

**Why it exists:** Provides creators with a branded link-in-bio style page that showcases their links and videos in a professional, sponsor-safe format.

**Who benefits:** Pro/Founder creators who want a public-facing link hub.

**Plan level:** Pro/Founder only

**Status:** Fully implemented

**Limitations:**
- No custom CSS/theming
- Limited section customization
- No analytics on hub page views

---

### 7. Hub Settings

**What it does:** Configuration page for Creator Hub including creator tagline, bio, featured link/video, section management, show/hide toggles for resources, videos, and metrics.

**Why it exists:** Allows creators to customize their public hub to match their brand and highlight their best content.

**Who benefits:** Pro/Founder creators with active Creator Hubs.

**Plan level:** Pro/Founder only

**Status:** Fully implemented

**Limitations:**
- No drag-and-drop section ordering (manual display_order)
- Limited custom section options
- No preview mode

---

### 8. Proof Pages (Snapshot & Live)

**What it does:** Shareable credibility artifacts showcasing link/video performance. Snapshot proofs capture static data at creation time; Live proofs update dynamically. Includes sponsor-friendly placement labels, OG metadata, and social sharing.

**Why it exists:** Enables creators to prove their value to sponsors with concrete, shareable performance data.

**Who benefits:** All creators (limited), Pro/Founder (expanded limits).

**Plan level:** Free (10 active), Pro/Pro+ (100 active), Founder (unlimited)

**Status:** Fully implemented

**Limitations:**
- Active proof limits enforced
- No proof editing after creation
- No proof analytics (who viewed proofs)
- OG image generation not yet implemented (uses video thumbnail fallback)

---

### 9. Proof Management

**What it does:** ProofsPage enables viewing, copying, sharing, enabling/disabling, and restoring proofs. Proofs grouped by proof_group_key for organization.

**Why it exists:** Creators need to manage their proof library, disable outdated proofs, and share current performance data.

**Who benefits:** All creators who generate proofs.

**Plan level:** All plans (limits vary by plan)

**Status:** Fully implemented

**Limitations:**
- No proof editing
- No proof templates
- No bulk operations

---

### 10. Dashboard

**What it does:** Main dashboard showing onboarding progress, compact metrics (total clicks, active links, proof views, top placement), "What's Working Right Now" hero section, recent activity feed, and quick actions.

**Why it exists:** Provides creators with an at-a-glance view of their performance and actionable next steps.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No custom dashboard configuration
- Limited historical data visualization
- No goal tracking

---

### 11. Analytics Page

**What it does:** Dedicated analytics page showing source statistics, video statistics, proof views, YouTube connection status, and auto-refresh functionality.

**Why it exists:** Deeper dive into performance data for creators who want more than dashboard-level insights.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No date range filtering
- No export functionality
- No custom metrics

---

### 12. Referral System

**What it does:** Referral code generation, tracking, qualification, and rewards. Includes milestone-based Pro rewards (e.g., 3 qualified referrals = 30 days Pro), Creator Impact stats, and ambassador status tracking.

**Why it exists:** Encourages user growth through organic referrals and rewards creators who bring in qualified users.

**Who benefits:** All creators (referrers and referees).

**Plan level:** All plans (feature-flagged)

**Status:** Fully implemented

**Limitations:**
- Feature-flagged (may not be enabled)
- No referral link customization
- Limited reward structure

---

### 13. Creator Impact Tracking

**What it does:** Non-blocking event logging, stats rollup, and referral conversion stamping. Tracks total referrals, qualified referrals, paid referrals, pro/founder referrals, rewards granted, and ambassador status.

**Why it exists:** Provides creators with visibility into their referral impact and rewards them for community building.

**Who benefits:** All creators who refer others.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No public impact badges
- No impact leaderboards
- Limited badge system

---

### 14. Branded Subdomains

**What it does:** Pro/Founder users get branded subdomains (username.tubelinkr.com) for their Creator Hub and Smart Links. Free users use go.tubelinkr.com.

**Why it exists:** Provides professional branding and trust for Pro/Founder creators.

**Who benefits:** Pro/Founder creators.

**Plan level:** Pro/Founder only

**Status:** Fully implemented

**Limitations:**
- No custom domain support
- Subdomain must match username
- No SSL customization

---

### 15. Plan System

**What it does:** Multi-tier plan system with Free, Pro, Pro+, and Founder tiers. Includes feature gating, proof limits, referral rewards, and founder access (lifetime, one-time payment).

**Why it exists:** Monetization strategy with clear value differentiation and creator-friendly pricing.

**Who benefits:** All users (different access levels).

**Plan level:** N/A (this is the plan system itself)

**Status:** Fully implemented

**Limitations:**
- Pro+ feature gated for launch
- Founder capped at 50 paid founders
- No annual/monthly toggle for Founder

---

### 16. Stripe Integration

**What it does:** Stripe checkout sessions, billing portal, and webhook handling for subscription management and founder one-time payments.

**Why it exists:** Handles payments securely and reliably for Pro subscriptions and Founder access.

**Who benefits:** Pro/Founder users.

**Plan level:** Pro/Founder only

**Status:** Fully implemented

**Limitations:**
- No PayPal option
- No crypto payments
- Limited billing customization

---

### 17. Click Tracking & Redirect

**What it does:** Redirect endpoint (/api/redirect) that records click events with source attribution, referrer, user agent, and IP hash. Supports both query parameter and path-based tracking codes.

**Why it exists:** Core tracking mechanism that captures every click with placement context for analytics.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No click fraud detection
- No bot filtering
- No UTM parameter support

---

### 18. Link Usages (Reusable Links)

**What it does:** Separates link definition from link usage. Enables one Smart Link to be used across multiple videos with independent tracking, with destination URL and title snapshots.

**Why it exists:** Allows creators to reuse the same link across videos while maintaining per-video attribution and historical accuracy.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No usage templates
- No bulk usage creation
- Manual process only

---

### 19. Auto-Refresh

**What it does:** Dashboard, Analytics, Links, and Placements pages auto-refresh every 15 seconds and on tab visibility/focus events.

**Why it exists:** Provides near real-time data without manual refresh, especially important during active campaigns.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Fixed 15-second interval (not configurable)
- No pause option
- May cause unnecessary API calls

---

### 20. Admin Dashboard

**What it does:** Admin-only page with overview stats (total users, plans, creator hubs, links, clicks, proofs), activity feed, founder access management, and referral feature flag controls.

**Why it exists:** Provides administrators with visibility into platform health and user growth.

**Who benefits:** Administrators only.

**Plan level:** Admin only

**Status:** Fully implemented

**Limitations:**
- No user management
- No content moderation
- Limited admin controls

---

### 21. Support Form

**What it does:** Public support form with honeypot bot protection, rate limiting, and email delivery via transactional email system.

**Why it exists:** Provides users with a way to get help without requiring login.

**Who benefits:** All users (including non-authenticated).

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No ticket tracking
- No file attachments
- Email-only delivery

---

### 22. Link Metadata Fetching

**What it does:** SSRF-protected endpoint that fetches link metadata (title, description) from destination URLs for auto-populating link details.

**Why it exists:** Improves UX by auto-filling link information from destination pages.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- SSRF protection limits some URLs
- No image extraction
- No favicon fetching

---

### 23. Public Code System

**What it does:** 6-character globally unique short codes for Smart Links (e.g., "abc123") enabling go.tubelinkr.com/{public_code} short links.

**Why it exists:** Provides short, memorable links for sharing and simplifies URL structure.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No custom short codes
- 6-character limit
- Collision detection on creation only

---

### 24. Username Setup

**What it does:** Pro users are required to set up a username before accessing the app. Username is used for public URLs and subdomains.

**Why it exists:** Enables branded URLs and subdomains for Pro users.

**Who benefits:** Pro users.

**Plan level:** Pro only

**Status:** Fully implemented

**Limitations:**
- Username cannot be changed after setup
- No username suggestions
- Limited validation

---

### 25. Account Settings

**What it does:** User settings page for updating username, display name, YouTube connection/disconnection, billing management via Stripe, and account deletion.

**Why it exists:** Provides users with control over their account and subscription.

**Who benefits:** All users.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Limited profile customization
- No password management (handled by Clerk)
- No export data option

---

### 26. Video Proof Modal

**What it does:** Modal for creating and sharing video proofs with download-as-image capability, social sharing (Twitter, native share), and sponsor-friendly formatting.

**Why it exists:** Enables quick proof generation and sharing from video performance pages.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Download uses html2canvas (may have rendering issues)
- No custom proof styling
- No proof scheduling

---

### 27. Public Proof Page

**What it does:** Public-facing proof page accessible via token. Displays proof data with OG metadata for social sharing, privacy-safe view tracking, and sponsor-friendly labels.

**Why it exists:** Allows creators to share proofs publicly without requiring viewers to log in.

**Who benefits:** All creators and their viewers.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No proof password protection
- No proof expiration
- Limited customization

---

### 28. Placement Management

**What it does:** PlacementsPage enables viewing, adding, deleting, and copying placement URLs. Shows video contexts, click counts, and auto-refreshes.

**Why it exists:** Provides granular control over placement tracking and URL management.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No bulk placement operations
- No placement templates
- Manual process only

---

### 29. Add Placement Modal

**What it does:** Modal for adding new placements with video selection, placement type selection, and automatic URL generation.

**Why it exists:** Streamlines the placement creation process with guided UX.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Limited to one placement at a time
- No placement cloning
- No placement suggestions

---

### 30. Link Card Component

**What it does:** Reusable component displaying link information with click counts, top placement, proof availability, and quick actions (view placements, create proof).

**Why it exists:** Consistent link display across the app with quick access to key actions.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No card customization
- Limited quick actions
- No link preview

---

### 31. Creator Impact Card

**What it does:** Dashboard component displaying referral stats, impact metrics, and referral link sharing with copy and native share support.

**Why it exists:** Highlights creator impact and encourages referral sharing.

**Who benefits:** All creators.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Limited impact visualization
- No impact history
- No impact comparison

---

### 32. Authentication (Clerk)

**What it does:** Clerk-based authentication with user sync to backend, referral code capture from URL, and session management.

**Why it exists:** Secure, reliable authentication with referral attribution on signup.

**Who benefits:** All users.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- No social login customization
- No 2FA enforcement
- Clerk-dependent

---

### 33. Rate Limiting

**What it does:** IP-based rate limiting for API endpoints to prevent abuse and spam.

**Why it exists:** Protects API resources and ensures fair usage.

**Who benefits:** All users (system stability).

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- IP-based only (no user-based)
- No rate limit visibility
- No custom limits per plan

---

### 34. Email System

**What it does:** Transactional email delivery for support form submissions and other notifications.

**Why it exists:** Enables communication with users without requiring in-app messaging.

**Who benefits:** All users.

**Plan level:** All plans

**Status:** Fully implemented

**Limitations:**
- Support form only currently
- No email templates
- No email preferences

---

### 35. Feature Flags

**What it exists:** Database-driven feature flag system for enabling/disabling features (e.g., referrals_enabled, referrals_rewards_enabled).

**Why it exists:** Allows safe feature rollout and A/B testing without code deployment.

**Who benefits:** Administrators.

**Plan level:** Admin only

**Status:** Fully implemented

**Limitations:**
- No per-user flags
- No flag analytics
- Manual management only

---

## User Benefits

### Real-World Problems Solved

**Problem:** "I post my affiliate link in my YouTube description, pinned comment, and bio, but I have no idea which one actually drives clicks."

**Solution:** Placement tracking shows exactly which placement (Description, Pinned Comment, Bio, etc.) generates clicks, enabling creators to focus on high-converting placements.

---

**Problem:** "I have 50 videos with the same affiliate link. Which videos are actually converting?"

**Solution:** Video-level analytics shows per-video click counts, CTR, and placement breakdown, so creators can identify their best-performing content and replicate success.

---

**Problem:** "Sponsors ask for proof of performance, but I only have raw analytics that look complicated and unprofessional."

**Solution:** Proof pages provide sponsor-friendly, shareable performance cards with clean design, sponsor-safe labels, and social sharing capabilities.

---

**Problem:** "I want a professional link-in-bio page like Linktree, but I also need YouTube-specific tracking."

**Solution:** Creator Hub combines a branded public profile with YouTube-attributed analytics, providing both professional presentation and performance data.

---

**Problem:** "I'm just starting out and can't afford expensive tools, but I need to know what's working."

**Solution:** Free plan includes 5 Smart Links, YouTube connection, placement tracking, and basic analytics—enough to get started without upfront cost.

---

**Problem:** "I refer other creators to the platform but get nothing for it."

**Solution:** Referral system rewards creators with Pro access for bringing in qualified users, with milestone-based rewards and Creator Impact tracking.

---

**Problem:** "I need to reuse the same link across multiple videos but track performance separately for each video."

**Solution:** Link Usages feature separates link definition from usage, enabling one Smart Link to be used across videos with independent tracking and historical snapshots.

---

**Problem:** "I want to show sponsors my performance without giving them access to my private analytics."

**Solution:** Public proof pages share performance data safely without exposing internal analytics, email, or sensitive information.

---

**Problem:** "I need a branded URL for my links, not a generic short link."

**Solution:** Pro users get branded subdomains (username.tubelinkr.com) for their Creator Hub and Smart Links, building trust and professionalism.

---

**Problem:** "I'm tired of guessing which videos to promote and which links to feature."

**Solution:** Dashboard highlights "What's Working Right Now" with top-performing placement and recent activity, providing clear direction on what to double down on.

---

## Hidden Capabilities

### 1. Link Usages (Reusable Links)

**Capability:** One Smart Link can be attached to multiple videos with independent tracking via the link_usages table. This is a powerful architectural feature that enables link reuse without losing per-video attribution.

**User benefit:** Creators can use the same affiliate link across their entire video library while still knowing which specific videos drive clicks.

**Discovery method:** Technical documentation (link-architecture-documentation.md), not prominently surfaced in UI.

---

### 2. Destination URL Snapshots

**Capability:** When a link usage is created, the destination URL and title are snapshotted. This preserves historical accuracy even if the parent link's destination changes later.

**User benefit:** Proofs and historical analytics remain accurate even if the creator changes their link destination later.

**Discovery method:** Database schema and technical docs only.

---

### 3. Sponsor-Friendly Placement Labels

**Capability:** Placement intelligence includes sponsor-friendly labels (e.g., "Video Description" instead of "description") used in proof pages for professional presentation.

**User benefit:** Proofs look more professional and sponsor-safe, improving credibility with brand partners.

**Discovery method:** Used automatically in proof pages, not explicitly documented.

---

### 4. Public Code Short Links

**Capability:** Every Smart Link gets a 6-character public code (e.g., "abc123") enabling go.tubelinkr.com/{public_code} short links independent of username.

**User benefit:** Creators can share ultra-short links without needing to remember their username or slug.

**Discovery method:** Used in placement URLs, not explicitly marketed.

---

### 5. Proof View Tracking

**Capability:** Public proof pages track view events with privacy-safe IP hashing, referrer, and user agent. This provides aggregate proof engagement data.

**User benefit:** Creators can see how many people viewed their proofs (though this data is not currently surfaced in UI).

**Discovery method:** Database schema only, not exposed in UI.

---

### 6. Referral IP Hashing

**Capability:** Referral qualification uses IP hashing to prevent self-referral abuse while respecting privacy.

**User benefit:** Fair referral system that prevents gaming while protecting user privacy.

**Discovery method:** Backend code only.

---

### 7. Auto-Refresh on Tab Visibility

**Capability:** Dashboard, Analytics, Links, and Placements pages automatically refresh when the tab becomes visible or gains focus, not just on a timer.

**User benefit:** Data is always fresh when returning to the app without manual refresh.

**Discovery method:** Implicit behavior, not documented.

---

### 8. Feature Flag System

**Capability:** Database-driven feature flags enable/disable features without code deployment (e.g., referrals_enabled, referrals_rewards_enabled).

**User benefit:** Platform can safely roll out features and respond to issues instantly.

**Discovery method:** Admin dashboard only.

---

### 9. SSRF Protection

**Capability:** Link metadata fetching has comprehensive SSRF protection preventing internal network access and private IP ranges.

**User benefit:** Secure link metadata fetching without security vulnerabilities.

**Discovery method:** Backend code only.

---

### 10. Creator Impact Event Ledger

**Capability:** All referral and impact events are logged to an append-only ledger (creator_impact_events) for audit trails and backfill capability.

**User benefit:** Complete audit trail of referral activity with ability to backfill and repair data.

**Discovery method:** Technical docs only.

---

### 11. Honeypot Bot Protection

**Capability:** Support form includes a hidden "website" field that bots fill but humans don't, providing bot protection without CAPTCHAs.

**User benefit:** Smooth support form experience without annoying CAPTCHAs.

**Discovery method:** Backend code only.

---

### 12. OG Metadata Dynamic Updates

**Capability:** Public proof pages dynamically update document meta tags for optimal social sharing, then reset to defaults when leaving the page.

**User benefit:** Proofs share beautifully on social media with rich previews.

**Discovery method:** Implicit behavior, not documented.

---

### 13. Native Share Detection

**Capability:** Proof modals detect native share support (navigator.share) and conditionally show/hide share buttons.

**User benefit:** Mobile users get native share experience when available.

**Discovery method:** Implicit behavior, not documented.

---

### 14. Referral Code URL Fallback

**Capability:** If localStorage referral code is lost, the system checks the URL directly for ?ref= parameter as a fallback.

**User benefit:** Referral attribution is more robust against browser privacy settings.

**Discovery method:** AuthContext code only.

---

### 15. Founder Cap Enforcement

**Capability:** Founder access is capped at 50 paid founders with database-level enforcement counting non-comped founder_access rows.

**User benefit:** Scarcity and exclusivity for early supporters.

**Discovery method:** Backend code only.

---

## Marketing Angles

### Smart Links & Placement Tracking

**Headline:** Know Which YouTube Videos Drive Your Clicks

**Marketing sentence:** Stop posting links blindly. See exactly which videos and placements convert viewers into clicks. Scale what actually works.

**Value prop:** Data-driven link placement for YouTube creators. Track clicks by video and placement (Description, Pinned Comment, Bio, Shorts). Stop guessing, start scaling.

---

### Video-Level Analytics

**Headline:** Your Best-Performing Videos, At a Glance

**Marketing sentence:** See which videos drive the most clicks, your top-converting placements, and where to focus your next upload.

**Value prop:** Per-video performance insights with CTR, click counts, and placement breakdown. Identify your winners and replicate success.

---

### Proof Pages

**Headline:** Share Your Performance with Confidence

**Marketing sentence:** Create sponsor-friendly proof pages showcasing your video performance. Shareable, professional, and credible.

**Value prop:** Turn your analytics into shareable proof cards. Sponsor-safe labels, clean design, and social sharing ready. Prove your value to brands.

---

### Creator Hub

**Headline:** Your Branded Link Hub, Powered by Data

**Marketing sentence:** A professional link-in-bio page with YouTube-attributed analytics. Showcase your links and videos with confidence.

**Value prop:** Branded subdomain (username.tubelinkr.com), featured videos, custom sections, and full analytics integration. Professional presentation meets performance data.

---

### Referral Rewards

**Headline:** Earn Pro Access by Sharing TubeLinkr

**Marketing sentence:** Refer qualified creators and earn Pro access. Milestone rewards, Creator Impact tracking, and ambassador status.

**Value prop:** Grow the community and get rewarded. 3 qualified referrals = 30 days Pro. Track your impact and build your ambassador status.

---

### Free Plan

**Headline:** Start Tracking for Free

**Marketing sentence:** 5 Smart Links, YouTube connection, placement tracking, and basic analytics. No credit card required.

**Value prop:** Get started with zero risk. Enough features to see real value before upgrading. Scale when you're ready.

---

### Pro Plan

**Headline:** Unlimited Links, Branded Subdomain, Creator Hub

**Marketing sentence:** Everything in Free, plus unlimited links, branded subdomain, Creator Hub, and professional creator toolkit.

**Value prop:** For serious creators. Branded presence, unlimited tracking, and advanced features. $19/month or $197/year (save $31).

---

### Founder Access

**Headline:** Lifetime Access for Early Supporters

**Marketing sentence:** One-time payment for lifetime Pro access. Founder badge, early supporter status, and help shape the future of creator attribution.

**Value prop:** Limited to first 50 paid founders. Lock in early creator access and influence product direction. $97 one-time.

---

### Placement Intelligence

**Headline:** Placement Guidance Built In

**Marketing sentence:** Every placement comes with clickability scores, friction levels, and creator guidance. Know where to place your links for maximum impact.

**Value prop:** Not just tracking—guidance. Understand which placements work best for different scenarios and optimize your strategy.

---

### Auto-Refresh

**Headline:** Real-Time Data, No Refresh Required

**Marketing sentence:** Your analytics update automatically every 15 seconds and when you return to the tab. Always see fresh data.

**Value prop:** Near real-time insights without manual refresh. Especially valuable during active campaigns and new video launches.

---

## Competitive Advantages

### vs Bitly

**Advantage:** YouTube-specific attribution

**Bitly:** Generic link shortener with basic click tracking. No video-level attribution, no placement intelligence, no YouTube integration.

**TubeLinkr:** Built for YouTube creators. Video-level analytics, placement tracking (Description, Pinned Comment, Bio, Shorts), YouTube API integration, and sponsor-friendly proof pages.

**Differentiator:** TubeLinkr answers "which YouTube video drove this click?" Bitly cannot.

---

### vs Linktree

**Advantage:** Analytics + Attribution

**Linktree:** Link-in-bio page with basic click tracking. No video-level attribution, no placement intelligence, no proof pages.

**TubeLinkr:** Creator Hub with full YouTube attribution. Know which videos drive clicks to each link, generate sponsor-friendly proofs, and optimize placement strategy.

**Differentiator:** TubeLinkr combines link-in-bio presentation with deep YouTube analytics. Linktree is presentation only.

---

### vs Geniuslink

**Advantage:** Creator-focused simplicity

**Geniuslink:** Amazon-focused link management with complex rules and enterprise features. Overkill for most YouTube creators.

**TubeLinkr:** Purpose-built for YouTube creators. Simple, focused on video and placement attribution. No complex rule engine, just actionable insights.

**Differentiator:** TubeLinkr is creator-first, not enterprise-first. Calm UI, progressive disclosure, and creator-friendly vocabulary.

---

### vs Pretty Links

**Advantage:** YouTube-native integration

**Pretty Links:** WordPress plugin for link cloaking and tracking. No YouTube integration, no video-level attribution, no placement intelligence.

**TubeLinkr:** Native YouTube integration with video fetching, channel connection, and per-video analytics. Purpose-built for the YouTube creator workflow.

**Differentiator:** TubeLinkr lives in the YouTube ecosystem. Pretty Links is a generic WordPress tool.

---

### vs Standard UTM Parameters

**Advantage:** Automated placement tracking

**UTM Parameters:** Manual tagging required for each link placement. No standardized placement types, no sponsor-friendly labels, no proof pages.

**TubeLinkr:** Automated placement tracking with standardized types (Description, Pinned Comment, Bio, etc.). Sponsor-friendly labels and proof pages built in.

**Differentiator:** TubeLinkr automates what UTM parameters make manual. No more remembering ?utm_source=pinned-comment.

---

### vs Google Analytics

**Advantage:** Creator-focused simplicity

**Google Analytics:** Enterprise analytics with complex setup and overwhelming dashboards. Not creator-friendly, no YouTube-specific placement intelligence.

**TubeLinkr:** Creator-focused with calm UI, one primary insight per surface, and YouTube-specific guidance. No configuration required.

**Differentiator:** TubeLinkr answers "what should I do next?" Google Analytics requires expert interpretation.

---

### vs YouTube Studio Analytics

**Advantage:** Destination tracking

**YouTube Studio:** Shows video views and CTR, but not where viewers go after clicking. No destination attribution, no placement comparison.

**TubeLinkr:** Tracks the full journey—from video placement to destination click. Know which placements drive actual conversions, not just views.

**Differentiator:** TubeLinkr tracks outbound clicks. YouTube Studio only tracks inbound views.

---

### vs Hootsuite/Buffer

**Advantage:** YouTube-specific depth

**Hootsuite/Buffer:** Social media management tools with basic link tracking. No YouTube-specific placement intelligence, no video-level attribution.

**TubeLinkr:** Deep YouTube integration with placement intelligence, video-level analytics, and sponsor-friendly proof pages.

**Differentiator:** TubeLinkr is specialized for YouTube attribution. Hootsuite/Buffer are generalist social tools.

---

## Current Limitations

### Ready (No Known Issues)

- Smart Links: Fully functional
- Placement Tracking: Fully functional
- YouTube Connection: Fully functional
- Video Analytics: Fully functional
- Creator Hub: Fully functional
- Proof Pages: Fully functional
- Dashboard: Fully functional
- Referral System: Fully functional (feature-flagged)
- Stripe Integration: Fully functional
- Authentication: Fully functional

---

### In Progress (Known Limitations Being Addressed)

- OG Image Generation: Dynamic OG image generation not yet implemented (uses video thumbnail fallback)
- Multi-Channel YouTube: Feature gated for launch (YOUTUBE_MULTI flag)
- Pro+ Plan: Feature gated for launch

---

### Planned (Future Roadmap Items)

- Custom Proof Styling: No proof customization options
- Proof Templates: No proof templates for quick generation
- Proof Analytics: No tracking of who viewed proofs
- Proof Password Protection: No password-protected proofs
- Proof Expiration: No time-limited proofs
- Historical Trend Visualization: No date range filtering or trend charts
- Export Functionality: No data export options
- Custom Dashboard Configuration: No dashboard customization
- Goal Tracking: No goal setting or progress tracking
- Custom Domain Support: No custom domains for Creator Hub
- Hub Analytics: No tracking of hub page views
- Drag-and-Drop Section Ordering: Manual display_order only
- Hub Preview Mode: No preview before publishing
- Bulk Operations: No bulk placement/link operations
- Placement Templates: No placement templates for quick creation
- Placement Cloning: No placement duplication
- Placement Suggestions: No AI-powered placement recommendations
- Link Preview: No preview of destination links
- Card Customization: No custom link card designs
- Impact Visualization: Limited impact stats display
- Impact History: No historical impact tracking
- Impact Comparison: No impact comparison tools
- Impact Badges: No public impact badges
- Impact Leaderboards: No community impact rankings
- Click Fraud Detection: No bot or fraud detection
- UTM Parameter Support: No UTM parameter handling
- A/B Testing Framework: No placement A/B testing
- Dynamic Placement Metadata: Static metadata only
- Additional Placement Types: Limited to 6 predefined types
- Custom Placement Names: No placement name editing
- Video Comparison Tools: No side-by-side video comparison
- Automatic Video Sync: No automatic video fetching
- 2FA Enforcement: No two-factor authentication requirement
- Social Login Customization: Limited Clerk customization
- Email Templates: No customizable email templates
- Email Preferences: No email notification preferences
- File Attachments: No file uploads for support
- Ticket Tracking: No support ticket system
- Password Management: Handled by Clerk only
- Profile Customization: Limited profile options
- Username Changes: No username changes after setup
- Username Suggestions: No username recommendations
- Custom Short Codes: No custom public codes
- Public Code Length: Fixed at 6 characters
- Referral Link Customization: No custom referral URLs
- Limited Reward Structure: Fixed milestone rewards only
- Ambassador Status: No public ambassador badges
- PayPal/Crypto Payments: Stripe only
- Billing Customization: Limited billing options
- Founder Annual/Monthly: One-time payment only
- Rate Limit Visibility: No rate limit information shown to users
- Per-User Rate Limits: IP-based only
- Custom Limits per Plan: No plan-specific rate limits
- Per-User Feature Flags: No user-specific flags
- Flag Analytics: No feature flag performance tracking
- Image Extraction: No image fetching from destination URLs
- Favicon Fetching: No favicon extraction
- SSRF URL Limitations: Some URLs blocked by SSRF protection

---

### Future (Not Currently Planned)

- Mobile App: No native mobile app
- Desktop App: No desktop application
- API for Third-Party Integrations: No public API
- Webhooks for Users: No user webhook system
- Team Accounts: No multi-user team features
- White Label: No white-label options
- Enterprise Features: No enterprise-specific features
- Advanced Fraud Detection: No ML-based fraud detection
- Predictive Analytics: No AI-powered predictions
- Content Recommendations: No AI content suggestions
- Automated Placement Optimization: No automatic placement recommendations
- Competitor Tracking: No competitor analytics
- Market Research Tools: No market research features
- Influencer Marketplace: No creator-sponsor matching
- Direct Sponsor Integration: No direct sponsor communication tools
- Campaign Management: No multi-campaign management
- ROI Calculator: No ROI calculation tools
- Revenue Attribution: No revenue tracking (clicks only)
- E-commerce Integration: No direct e-commerce platform connections
- Custom Analytics: No custom metric builder
- Real-Time Notifications: No push notifications
- SMS Support: No SMS notifications
- Voice Commands: No voice interface
- AR/VR Support: No augmented or virtual reality features
- Blockchain/Web3: No blockchain or cryptocurrency features
- NFT Integration: No NFT-related features
- Metaverse Integration: No metaverse presence

---

## Homepage Opportunities

### 1. "Know Which YouTube Videos Drive Your Clicks" (Hero)

**Ranking:** #1 (Most Compelling)

**Why:** This is the core value proposition. It directly addresses the primary pain point of YouTube creators—blind link posting. Clear, specific, and immediately understandable.

**Implementation:** Current homepage hero already uses this headline. Consider adding a visual demo or animated screenshot showing the before/after of blind posting vs. TubeLinkr insights.

---

### 2. "Stop Posting Links Blindly" (Sub-hero)

**Ranking:** #2

**Why:** Emphasizes the problem being solved. Creates urgency and relatability. Creators immediately recognize this pain.

**Implementation:** Already present in current homepage. Could be strengthened with a "Before TubeLinkr" vs "After TubeLinkr" comparison graphic.

---

### 3. "See Which Placements Convert" (Feature Highlight)

**Ranking:** #3

**Why:** Placement intelligence is a unique differentiator. Most competitors don't offer placement-level tracking.

**Implementation:** Add a dedicated section showing the 6 placement types (Description, Pinned Comment, Bio, Shorts, Video CTAs, Custom) with clickability scores and friction levels.

---

### 4. "Share Sponsor-Friendly Proofs" (Social Proof)

**Ranking:** #4

**Why:** Proof pages are a powerful feature for creator monetization. Sponsor-friendly framing is a strong differentiator.

**Implementation:** Add a section showing a sample proof card with sponsor-friendly labels. Include a "Create Proof" CTA.

---

### 5. "Your Branded Link Hub" (Pro Feature)

**Ranking:** #5

**Why:** Creator Hub is a strong Pro feature that competes directly with Linktree but with added analytics value.

**Implementation:** Show a sample Creator Hub screenshot with branded subdomain. Highlight the analytics integration.

---

### 6. "Start for Free, No Credit Card" (Trust Builder)

**Ranking:** #6

**Why:** Reduces friction for signups. Clear pricing transparency builds trust.

**Implementation:** Already present. Could be more prominent with a "Free Forever" badge on the CTA button.

---

### 7. "Video-Level Analytics" (Deep Dive)

**Ranking:** #7

**Why:** Video-level attribution is the technical foundation of the product. Important for power users.

**Implementation:** Add a "How It Works" section explaining the video-to-click journey with a simple diagram.

---

### 8. "Creator Impact & Rewards" (Community)

**Ranking:** #8

**Why:** Referral system builds community and rewards growth. Good for organic marketing.

**Implementation:** Add a "Join the Community" section highlighting referral rewards and Creator Impact tracking.

---

### 9. "Auto-Refresh Real-Time Data" (UX Feature)

**Ranking:** #9

**Why:** Nice-to-have UX feature that differentiates from competitors requiring manual refresh.

**Implementation:** Mention in a "Features" section. Not compelling enough for hero placement.

---

### 10. "Placement Intelligence Built In" (Guidance)

**Ranking:** #10

**Why:** Educational value for creators. Shows TubeLinkr is not just tracking but guidance.

**Implementation:** Add a "Learn" section or blog post link. Not compelling for homepage hero.

---

## Executive Summary

### Top 10 Selling Points

1. **YouTube-Specific Attribution:** Know which specific videos drive clicks—not just aggregate performance.
2. **Placement-Level Tracking:** See which placements (Description, Pinned Comment, Bio, Shorts) convert best.
3. **Sponsor-Friendly Proofs:** Share professional, credible performance data with brands.
4. **Video-Level Analytics:** Per-video insights with CTR, click counts, and placement breakdown.
5. **Branded Creator Hub:** Professional link-in-bio page with full analytics integration.
6. **Free Plan to Start:** 5 Smart Links, YouTube connection, and basic analytics at no cost.
7. **Auto-Refresh Data:** Near real-time insights without manual refresh.
8. **Referral Rewards:** Earn Pro access by referring qualified creators.
9. **Placement Intelligence:** Built-in guidance on which placements work best.
10. **Reusable Links:** One Smart Link across multiple videos with independent tracking.

---

### Key User Benefits

- **Stop Guessing:** Data-driven decisions replace blind link posting.
- **Scale Winners:** Identify best-performing videos and placements to replicate success.
- **Prove Value:** Share credible performance data with sponsors and brands.
- **Professional Presence:** Branded subdomain and Creator Hub for trust and credibility.
- **Low Friction:** Free plan to start, no credit card required.
- **Community Growth:** Referral rewards for building the creator community.

---

### Primary Differentiators

- **YouTube-Native:** Built specifically for YouTube creators, not a generic tool adapted for YouTube.
- **Placement Intelligence:** Standardized placement types with clickability scores and creator guidance.
- **Sponsor-Safe:** Proof pages use sponsor-friendly labels and clean design for professional presentation.
- **Creator-Focused:** Calm UI, progressive disclosure, and creator-friendly vocabulary (no "CTR", "conversion rate").
- **Video-to-Click Journey:** Full attribution from video placement to destination click.

---

### Positioning Statements

**For YouTube creators who need to know which content drives clicks,** TubeLinkr is a YouTube-specific attribution tool that provides video-level and placement-level analytics. Unlike generic link shorteners or social media management tools, TubeLinkr is purpose-built for the YouTube creator workflow with sponsor-friendly proof pages and a branded Creator Hub.

---

**For creators tired of posting links blindly,** TubeLinkr provides data-driven insights into which videos and placements actually convert viewers into clicks. Stop guessing, start scaling with placement intelligence and real-time analytics.

---

**For creators seeking sponsor partnerships,** TubeLinkr enables professional proof pages showcasing video performance with sponsor-safe labels. Prove your value to brands with credible, shareable performance data.

---

**For creators starting their journey,** TubeLinkr offers a free plan with 5 Smart Links, YouTube connection, and basic analytics. No credit card required. Scale to Pro when you're ready for unlimited links, branded subdomain, and Creator Hub.

---

### Strategic Recommendations

1. **Lead with YouTube Attribution:** The hero headline "Know Which YouTube Videos Drive Your Clicks" is the strongest positioning. Lead with this in all marketing materials.

2. **Emphasize Placement Intelligence:** Placement-level tracking is a unique differentiator. Make this prominent in feature sections and onboarding.

3. **Show, Don't Just Tell:** Use visual demos, screenshots, and before/after comparisons to illustrate the value of video-level attribution.

4. **Leverage Proof Pages:** Proof pages are a powerful monetization feature for creators. Highlight sponsor-friendly framing in marketing to creators.

5. **Community Growth:** Referral rewards and Creator Impact tracking can drive organic growth. Consider a "Join the Community" campaign.

6. **Simplify Analytics Messaging:** Avoid technical jargon. Use creator-friendly language ("clicks" not "conversions", "placements" not "sources").

7. **Free Plan as Gateway:** The free plan is a strong acquisition tool. Emphasize "No credit card required" and "Start for Free" in CTAs.

8. **Pro Plan as Upgrade Path:** Clearly communicate the value of upgrading: unlimited links, branded subdomain, Creator Hub. Use Founder Access as a scarcity tactic.

9. **Competitive Differentiation:** Explicitly contrast with Bitly, Linktree, and generic analytics tools. Highlight YouTube-specific depth vs. generic breadth.

10. **Product Philosophy Alignment:** Maintain calm UI, progressive disclosure, and creator-focused framing as core brand values. Avoid feature creep and analytics bloat.

---

**End of Audit**

This document is based solely on the current codebase implementation as of June 25, 2026 on the pro-dev branch. No assumptions about future features have been made. All features described are currently implemented and functional unless explicitly noted as "In Progress", "Planned", or "Future".