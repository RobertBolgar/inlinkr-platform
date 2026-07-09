# TubeLinkr Proofs System Audit

**Date:** June 2, 2026  
**Branch:** pro-dev  
**Scope:** Complete audit of Proofs system architecture and behavior

---

## Executive Summary

The TubeLinkr Proofs system does **not** have a true parent-child relationship in the database. What appears as "parent proofs" and "child snapshots" is a **client-side UI grouping mechanism** only. Each proof is an independent row in the `proof_shares` table, and grouping is performed dynamically in the React UI based on video ID and destination domain.

This architecture creates the fundamental issue: there is no way to disable a "parent proof" because parents don't exist in the data model. Users can only disable individual proof records, which may or may not be the one currently displayed as the "parent" in the UI.

---

## 1. Data Model

### 1.1 Tables

**proof_shares** (primary table)
- `id` - Primary key
- `public_token` - Unique public share token
- `user_id` - Owner
- `link_id` - Associated link (nullable)
- `youtube_video_id` - YouTube video ID (nullable)
- `link_usage_id` - Specific link usage (nullable)
- `title` - Legacy title field
- `human_insight` - User-added insight
- `destination_url` - Destination URL
- `top_source_label` - Top converting placement
- `additional_source_labels` - JSON array of other placements
- `is_enabled` - **Status field: 1 = active, 0 = disabled**
- `created_at` - Creation timestamp
- `last_viewed_at` - Last public view timestamp

**Snapshot fields** (added in migration 004):
- `snapshot_clicks` - Clicks at time of proof creation
- `snapshot_ctr` - CTR at time of proof creation
- `snapshot_views` - Views at time of proof creation
- `snapshot_link_count` - Link count at time of proof creation
- `snapshot_video_title` - Video title at time of proof creation
- `snapshot_thumbnail_url` - Thumbnail at time of proof creation
- `snapshot_destination_domain` - Destination domain at time of proof creation
- `snapshot_destination_url` - Destination URL at time of proof creation
- `snapshot_top_placement_label` - Top placement at time of proof creation
- `snapshot_generated_at` - When snapshot was captured
- `snapshot_converting_placements_json` - JSON of converting placements

**proof_share_events** (analytics table)
- `id` - Primary key
- `proof_share_id` - Reference to proof_shares
- `event_type` - Event type (e.g., 'view')
- `created_at` - Event timestamp
- `referrer` - Referrer URL
- `user_agent` - User agent string
- `ip_hash` - Hashed IP for privacy

### 1.2 What is a "Parent Proof"?

**Answer:** There is no such thing in the database.

The "parent proof" is a UI construct created by the `groupProofs()` function in `ProofsPage.tsx`. It selects the most recently created proof (`sortedProofs[0]`) from a group and displays it as the representative card.

### 1.3 What is a "Snapshot"?

**Answer:** A snapshot is a proof record with snapshot data.

A proof is considered a "snapshot" if `snapshot_clicks` is not null. If `snapshot_clicks` is null, it's a "live" proof. This is determined client-side:

```typescript
const proofMode = proof.snapshot_clicks !== null ? 'snapshot' : 'live';
```

### 1.4 Status Fields

**Active/Disabled status** is determined solely by:
- `is_enabled = 1` → Active
- `is_enabled = 0` → Disabled

There are no other status fields.

---

## 2. Counting Logic

### 2.1 How Counts Are Calculated

Counts are calculated in the UI (`ProofsPage.tsx` lines 361, 371):

```typescript
// Active count
groupProofs(proofs.filter(p => p.is_enabled === 1)).length

// Disabled count
groupProofs(proofs.filter(p => p.is_enabled === 0)).length
```

**Process:**
1. Filter all proofs by `is_enabled` status
2. Group the filtered proofs using `groupProofs()`
3. Count the number of groups

### 2.2 Are Counts Based on Groups or Snapshots?

**Answer:** Counts are based on groups after filtering by individual proof status.

The flow is:
- Filter individual proofs by `is_enabled`
- Group the filtered proofs
- Count the groups

This means:
- If a group has 3 active proofs and 2 disabled proofs, it contributes 1 to the Active count and 0 to the Disabled count
- If a group has 0 active proofs and 3 disabled proofs, it contributes 0 to the Active count and 1 to the Disabled count

### 2.3 Proof Limit Enforcement

Proof limits are enforced at creation time in `create.js` (lines 69-72):

```javascript
const activeProofsResult = await env.DB.prepare(
  'SELECT COUNT(*) as count FROM proof_shares WHERE user_id = ? AND is_enabled = 1'
).bind(authUser.id).first();
```

This counts **individual proof records**, not groups.

---

## 3. UI Rendering

### 3.1 How Parent Proof Cards Render

Parent proof cards are rendered in `ProofsPage.tsx` (lines 421-429):

```typescript
{groupProofs(proofs.filter(p => activeTab === 'active' ? p.is_enabled === 1 : p.is_enabled === 0)).map((group) => (
  <div key={group.groupKey}>
    {/* Parent card shows group.latestProof */}
  </div>
))}
```

The `group.latestProof` is the most recently created proof in the group (line 240-242):

```typescript
const sortedProofs = groupProofs.sort((a, b) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
);
const latestProof = sortedProofs[0];
```

### 3.2 How Child Snapshots Render

Child snapshots are rendered in an expandable history section (lines 613-702):

```typescript
{expandedGroup === group.groupKey && group.totalSnapshots > 1 && (
  <div className="history-section">
    {group.proofs.map((proof) => (
      <div key={proof.public_token}>
        {/* Individual snapshot row */}
      </div>
    ))}
  </div>
)}
```

This shows **all proofs in the group**, including the one displayed as the parent.

### 3.3 Parent Dropdown/Action Menu Behavior

**Critical Finding:** The parent card itself does NOT have a disable option.

The disable menu only appears on **individual child snapshots** in the history section (lines 674-693):

```typescript
<div className="relative">
  <button onClick={() => setMenuOpen(menuOpen === proof.public_token ? null : proof.public_token)}>
    <MoreVertical />
  </button>
  {menuOpen === proof.public_token && (
    <div className="dropdown">
      <button onClick={() => handleDisable(proof.public_token)}>
        Disable
      </button>
    </div>
  )}
</div>
```

**Parent card actions:**
- If all proofs in group are active: View Proof, Copy Link, Share, History (if >1 snapshot)
- If all proofs in group are disabled: Restore, History (if >1 snapshot)

**Child snapshot actions:**
- If group is active: View, Copy, Disable (via dropdown)
- If group is disabled: Restore

### 3.4 When Does the Parent Dropdown Appear/Disappear?

The parent card never has a disable dropdown. The disable option only appears on individual snapshots in the history section.

The history section (and thus the disable menu) appears when:
- `group.totalSnapshots > 1` (line 595, 613)

---

## 4. Disable Logic

### 4.1 Disabling a Child Snapshot

When a user clicks "Disable" on a child snapshot:

1. UI calls `/api/proof-shares/disable` with `public_token` (line 139)
2. API verifies ownership (lines 46-62)
3. API sets `is_enabled = 0` for that specific proof record (lines 64-67)
4. UI removes the disabled proof from the list (line 149)
5. UI refreshes the proofs list

**Key point:** Only the individual proof record is disabled. No other proofs are affected.

### 4.2 Disabling a Parent Proof

**Answer:** You cannot disable a "parent proof" because parents don't exist in the data model.

The user can only:
1. Disable the individual proof record that happens to be displayed as the parent (by expanding history and disabling it there)
2. Disable all proofs in the group one by one

There is no "disable parent" action in the UI.

### 4.3 Can Parent Proofs Become Impossible to Disable?

**Answer:** No, because there are no parent proofs.

However, the **latest proof in a group** (displayed as the parent) can be disabled by:
1. Expanding the history section
2. Finding the proof with the most recent date
3. Clicking the disable menu on that specific proof

After disabling the latest proof, the next most recent proof becomes the new "parent" in the UI.

### 4.4 Can Orphaned Proof Groups Exist?

**Answer:** Yes.

If all proofs in a group are disabled (`is_enabled = 0`), the group will:
- Disappear from the Active tab
- Appear in the Disabled tab
- Show a "Disabled" badge on the card
- Show a "Restore" button instead of "View Proof"

The group still exists in the database and can be restored.

---

## 5. API Endpoints

### 5.1 Proof-Related Endpoints

**POST /api/proof-shares/create**
- Purpose: Create a new proof share
- File: `functions/api/proof-shares/create.js`
- Key logic:
  - Checks proof limit (counts `is_enabled = 1` records)
  - Inserts new proof with `is_enabled = 1`
  - Stores snapshot fields if provided

**GET /api/proof-shares/list**
- Purpose: List all proofs for authenticated user
- File: `functions/api/proof-shares/list.js`
- Query param: `include_disabled=true` to include disabled proofs
- Key logic:
  - Returns all proofs for user
  - Filters by `is_enabled` if `include_disabled` is false
  - Determines proof mode based on `snapshot_clicks`
  - Returns view counts from `proof_share_events`

**GET /api/proof-shares/{token}**
- Purpose: Get public proof data by token
- File: `functions/api/proof-shares/[token].js`
- Key logic:
  - Returns 410 Gone if `is_enabled = 0`
  - Records view event in `proof_share_events`
  - Returns snapshot data if available, otherwise calculates live data

**POST /api/proof-shares/disable**
- Purpose: Disable a proof by token
- File: `functions/api/proof-shares/disable.js`
- Key logic:
  - Verifies ownership
  - Sets `is_enabled = 0` for the specific proof
  - **Affects only the individual proof record**

**POST /api/proof-shares/restore**
- Purpose: Restore a disabled proof
- File: `functions/api/proof-shares/restore.js`
- Key logic:
  - Verifies ownership
  - Sets `is_enabled = 1` for the specific proof
  - **Affects only the individual proof record**

### 5.2 Endpoints Responsible for Disabling

- **Disable:** `POST /api/proof-shares/disable` (sets `is_enabled = 0`)
- **Restore:** `POST /api/proof-shares/restore` (sets `is_enabled = 1`)

Both endpoints operate on individual proof records only. There is no bulk disable or group disable endpoint.

---

## 6. Edge Cases

### 6.1 All Children Disabled

**Scenario:** All proofs in a group have `is_enabled = 0`

**Behavior:**
- Group appears in Disabled tab
- Parent card shows "Disabled" badge
- Actions show "Restore" button
- History section still shows all disabled proofs
- Each disabled proof can be individually restored

### 6.2 No Children Remaining

**Scenario:** A group has only 1 proof

**Behavior:**
- History button does not appear (requires `totalSnapshots > 1`)
- Parent card shows the single proof
- Disable option only available if user expands... but there's nothing to expand
- **Issue:** User cannot disable the proof without expanding history, but history doesn't appear with 1 proof

**Actual behavior:** With 1 proof, the history button is hidden, so the disable menu is inaccessible. The user can only disable by:
- Going to the link card and creating a new proof (which doesn't disable the old one)
- Or... there's no way to disable a single-proof group from the Proofs page

**This is a bug.**

### 6.3 Shared Proofs

**Scenario:** Multiple proofs for the same video+destination combination

**Behavior:**
- All proofs are grouped together by `groupKey`
- The most recent is displayed as parent
- Older proofs appear in history
- Each can be independently disabled
- Disabling the parent just disables that one record; the next oldest becomes the new parent

### 6.4 Snapshot-Only Proofs

**Scenario:** Proof with `snapshot_clicks` populated (snapshot mode)

**Behavior:**
- Displays "Snapshot" badge
- Shows snapshot data (clicks, CTR, views captured at creation time)
- Does not recalculate live data
- Can be disabled/restored like any other proof

### 6.5 Live-Only Proofs

**Scenario:** Proof with `snapshot_clicks = null` (live mode)

**Behavior:**
- Displays "Live" badge
- Calculates live data from click_events table on each view
- Fetches YouTube video stats (views, thumbnail) on each view
- Can be disabled/restored like any other proof

### 6.6 Disabled Parent with Active Children

**Scenario:** The "parent" (latest proof) is disabled, but older proofs in the group are active

**Behavior:**
- Since grouping happens after filtering by status:
  - In Active tab: The group appears with the oldest active proof as the new "parent"
  - In Disabled tab: The disabled proof appears in its own group (or with other disabled proofs from the same video+destination)
- The group effectively splits across tabs based on individual proof status

### 6.7 Active Parent with Disabled Children

**Scenario:** The latest proof is active, but older proofs in the group are disabled

**Behavior:**
- In Active tab: Group appears with the active parent; disabled children are filtered out
- In Disabled tab: Disabled children appear in their own group(s)
- History section on Active tab only shows active children (disabled ones are filtered)

---

## 7. Root Cause of Parent Proof Disable Issue

### 7.1 The Problem

Users expect to be able to "disable a parent proof" which would disable all snapshots in that group. However, this is impossible because:

1. **There is no parent-child relationship in the database**
2. **Each proof is an independent record**
3. **Grouping is a client-side UI construct only**
4. **The disable API operates on individual records only**

### 7.2 Why This Architecture Exists

The current architecture was designed for simplicity:
- Each proof is a standalone shareable link
- Grouping is a convenience feature for the UI
- No complex hierarchy to manage
- Each proof can be independently shared and disabled

However, this creates user experience issues:
- Users can't disable a "group" of proofs
- Users can't disable a single-proof group (no history button)
- The concept of "parent" is confusing because it doesn't exist in the data model
- Disabling the "parent" just disables one record, not the group

### 7.3 The Specific Bug

**Single-proof groups cannot be disabled from the Proofs page** because:
- The disable menu only appears in the history section
- The history section only appears when `totalSnapshots > 1`
- With 1 proof, `totalSnapshots = 1`, so history is hidden
- Therefore, the disable menu is inaccessible

---

## 8. Current Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Database Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  proof_shares table                                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ id │ public_token │ user_id │ is_enabled │ snapshot_*  │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 1  │ abc123       │ 100     │ 1          │ 100 clicks  │  │
│  │ 2  │ def456       │ 100     │ 1          │ 150 clicks  │  │
│  │ 3  │ ghi789       │ 100     │ 0          │ 200 clicks  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  proof_share_events table                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ id │ proof_share_id │ event_type │ created_at          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ API calls (individual records)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                                │
├─────────────────────────────────────────────────────────────────┤
│  POST /api/proof-shares/create  → INSERT single record          │
│  GET  /api/proof-shares/list    → SELECT all records            │
│  POST /api/proof-shares/disable → UPDATE is_enabled = 0         │
│  POST /api/proof-shares/restore → UPDATE is_enabled = 1         │
│  GET  /api/proof-shares/{token} → SELECT single record           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Returns flat array of proofs
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer (React)                          │
├─────────────────────────────────────────────────────────────────┤
│  ProofsPage.tsx                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 1. Fetch all proofs (include_disabled=true)              │  │
│  │ 2. Filter by is_enabled (active or disabled tab)          │  │
│  │ 3. Group by groupProofs() function:                       │  │
│  │    - groupKey = youtube_video_id + destination_domain     │  │
│  │    - Sort by created_at DESC                             │  │
│  │    - latestProof = sortedProofs[0]                        │  │
│  │ 4. Render parent card with latestProof                   │  │
│  │ 5. Render history section with all proofs in group       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Current Disable Flow

```
User clicks "Disable" on child snapshot
                │
                ▼
UI calls POST /api/proof-shares/disable
Body: { public_token: "abc123" }
                │
                ▼
API verifies ownership
                │
                ▼
API executes: UPDATE proof_shares SET is_enabled = 0 WHERE public_token = ?
                │
                ▼
Only that single record is affected
                │
                ▼
UI removes proof from list
                │
                ▼
UI refreshes proofs
                │
                ▼
groupProofs() recalculates groups
                │
                ▼
If disabled proof was the "parent", next oldest becomes new parent
```

---

## 10. Current Count Flow

```
User views Active tab
                │
                ▼
UI filters: proofs.filter(p => p.is_enabled === 1)
                │
                ▼
UI groups: groupProofs(filteredProofs)
                │
                ▼
groupProofs() logic:
  1. Group by youtube_video_id + destination_domain
  2. Sort each group by created_at DESC
  3. Count number of groups
                │
                ▼
Display: "Active (X)" where X = group count
```

---

## 11. Recommended Long-Term Architecture

### 11.1 Option A: Explicit Parent-Child Relationship

**Add a proof_groups table:**

```sql
CREATE TABLE proof_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  youtube_video_id TEXT,
  destination_domain TEXT,
  group_key TEXT UNIQUE NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE proof_shares ADD COLUMN proof_group_id INTEGER;
```

**Benefits:**
- Explicit parent-child relationship
- Can disable entire group by setting `proof_groups.is_enabled = 0`
- Clear data model
- Can add group-level metadata (notes, tags, etc.)

**Drawbacks:**
- Requires migration
- More complex queries
- Need to handle existing data
- Grouping logic moves from UI to database

### 11.2 Option B: Bulk Disable Endpoint

**Add bulk operations without changing schema:**

```
POST /api/proof-shares/disable-group
Body: { group_key: "video123::example.com" }
```

**Logic:**
- Query all proofs with matching group_key
- Set `is_enabled = 0` for all matching proofs
- Maintain current client-side grouping

**Benefits:**
- No schema changes
- Minimal code changes
- Backward compatible
- Solves the user experience issue

**Drawbacks:**
- Still relies on client-side grouping
- Group key logic duplicated (UI + API)
- No explicit parent-child relationship

### 11.3 Option C: Hybrid Approach

**Keep current schema but add group-level operations:**

1. Add `group_key` column to `proof_shares` (computed at creation time)
2. Add bulk disable/restore endpoints that operate on `group_key`
3. Keep UI grouping for display
4. Use database grouping for operations

**Benefits:**
- Best of both worlds
- Explicit group_key in database
- Bulk operations possible
- Minimal schema change

**Drawbacks:**
- Still need migration for group_key column
- Some logic duplication

### 11.4 Recommended Solution: Option B (Short-Term)

For immediate fix of the disable issue:

1. Add `POST /api/proof-shares/disable-group` endpoint
2. Add "Disable Group" button to parent card when `totalSnapshots > 1`
3. Fix single-proof group disable by adding disable button to parent card
4. Keep current architecture otherwise

**Implementation:**
- No schema changes
- Add one new API endpoint
- Add disable button to parent card in UI
- Reuse existing grouping logic

### 11.5 Recommended Solution: Option A (Long-Term)

For robust long-term architecture:

1. Create `proof_groups` table
2. Migrate existing data to assign groups
3. Update create logic to always create/assign group
4. Update disable logic to support group-level operations
5. Update UI to use group-based operations
6. Deprecate client-side grouping

**Benefits:**
- Explicit data model
- Group-level metadata
- Better query performance
- Clearer semantics
- Easier to extend

**Timeline:**
- Phase 1: Add proof_groups table (non-breaking)
- Phase 2: Migrate existing data
- Phase 3: Update create logic
- Phase 4: Update UI to use groups
- Phase 5: Remove client-side grouping

---

## 12. Immediate Fixes Required

### 12.1 Critical: Single-Proof Group Disable Bug

**Issue:** Users cannot disable a group with only 1 proof because the disable menu is hidden.

**Fix:** Add disable button to parent card when `totalSnapshots = 1`

**Location:** `ProofsPage.tsx` lines 546-610

**Change:** Add disable option to parent card actions when group has 1 proof

### 12.2 High Priority: Add Group Disable

**Issue:** Users expect to disable entire groups, not individual snapshots.

**Fix:** Add "Disable Group" button to parent card that disables all proofs in the group.

**Implementation:**
1. Add `POST /api/proof-shares/disable-group` endpoint
2. Query all proofs with matching group_key
3. Set `is_enabled = 0` for all
4. Add "Disable Group" button to parent card UI

### 12.3 Medium Priority: Clarify UI Language

**Issue:** The term "parent proof" is misleading since it doesn't exist in the data model.

**Fix:** Update UI language to use "latest proof" or "primary proof" instead of "parent"

---

## 13. Summary

### Key Findings

1. **No parent-child relationship exists in the database**
2. **Grouping is a client-side UI construct only**
3. **Each proof is an independent record**
4. **Disable operations affect individual records only**
5. **Single-proof groups cannot be disabled (bug)**
6. **No group-level disable functionality exists**

### Root Cause

The architecture was designed for simplicity (independent proof records) but the UI presents a grouped view that implies a parent-child relationship that doesn't exist in the data model.

### Recommended Path Forward

**Short-term (immediate):**
- Fix single-proof group disable bug
- Add bulk disable endpoint for groups
- Add "Disable Group" button to UI

**Long-term (architectural):**
- Implement explicit proof_groups table
- Migrate to group-based data model
- Add group-level metadata and operations
- Deprecate client-side grouping

---

**End of Audit Report**
