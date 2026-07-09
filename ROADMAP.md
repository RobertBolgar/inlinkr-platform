# TubeLinkr Roadmap

## Current Status

TubeLinkr is in active beta.

Core systems completed:

* Authentication
* YouTube Integration
* Smart Links
* Placements
* Analytics
* Creator Hubs
* Proofs
* Billing
* Referrals
* Founder Infrastructure
* Admin Dashboard
* Support Contact System

Current focus:

* Real creator usage
* User feedback
* Product validation

---

# Priority 1: User Validation

Goal:
Get real creators using TubeLinkr.

Success Metrics:

* First 10 creators
* First 100 Smart Links
* First referral-generated signup
* First support requests
* First creator feedback cycle

Rule:

No major features should be built unless:

* A user requests them
* A bug blocks usage
* The feature strengthens TubeLinkr's core attribution mission

---

# Priority 2: Attribution Expansion

## Creator Hub Placement Tracking

Status:
Planned

Goal:

Allow TubeLinkr to automatically create/reuse placements when Smart Links are added to Creator Hub sections.

Desired Attribution:

Video
↓
Creator Hub
↓
Hub Section
↓
Smart Link
↓
Click

Requirements:

* Reuse placement if already exists
* Never create duplicates
* Preserve attribution history
* Continue working if links are removed and later re-added

---

# Priority 3: Referral Hardening

Status:
Future

Goals:

* Preserve referral history forever
* Remove dependency on user deletion
* Support future referral rewards
* Support founder perks
* Support referral leaderboards
* Support historical achievements

Future Ideas:

* Ambassador Program
* Founder Badges
* Lifetime Rewards
* Early Access Programs

---

# Priority 4: AI Foundation

Status:
Future

Important:

TubeLinkr AI should be built around attribution data, not generic AI generation.

## Phase 1

Creator Helpers

* Title Ideas
* Hook Ideas
* Description Ideas
* Shorts Ideas

Provider Layer:

* OpenAI
* Gemini
* HuggingFace
* OpenRouter

AI should always be provider-agnostic.

---

## Phase 2

TubeLinkr Data Analysis

Examples:

* Which videos generate the most clicks?
* Which CTA performs best?
* Which placements convert best?

Goal:

Use actual TubeLinkr data.

---

## Phase 3

Creator AI Coach

Examples:

"Analyze my channel."

TubeLinkr AI can use:

* Videos
* Placements
* Clicks
* Proofs
* Hub performance

To provide creator-specific recommendations.

This becomes a competitive moat.

---

# Technical Debt

## Shared Referral Logic

Current:

Referral qualification logic exists in worker.js.

Future:

Move shared referral logic into reusable module.

Reason:

Reduce duplication and maintenance risk.

---

# Long-Term Vision

TubeLinkr is not a link shortener.

TubeLinkr is a creator attribution platform.

The primary question TubeLinkr answers:

"Which content generated the click?"

All future features should strengthen that mission.

---

# Intentionally Deferred

These ideas may be valuable but are not priorities until after user validation.

- Multi-channel YouTube support
- Custom domains
- Advanced AI features
- Team accounts
- White-label solutions
- Enterprise features
- Advanced attribution modeling
- Public API
- Mobile app

Reason:
User validation takes priority over feature expansion.
