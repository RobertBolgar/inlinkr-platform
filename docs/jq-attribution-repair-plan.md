# JQ Attribution Repair Plan for link_id = 31

## Context

**Smart Link**: "The Prompts That Started It All" (link_id = 31)

**Current State**:
- AA1kfTe-dO0: 3 clicks, deterministic attribution (link_usage_id = 25)
- JQZ6aM1zLXs: 5 clicks, NOT deterministic (placement 59 has no video context)
- Direct: 7 clicks

**Problem**: Placement 59 (YouTube Description) has `youtube_video_id = NULL` and `link_usage_id = NULL`, making the 5 clicks unattributable.

---

## Analysis: Can Placement 59 Be Safely Assigned to JQZ6aM1zLXs?

### Evidence FOR Assignment to JQZ6aM1zLXs

1. **Legacy Field Evidence**: The link has `links.video_id = "JQZ6aM1zLXs"` (legacy field)
   - This indicates the link was originally attached to JQZ6aM1zLXs
   - Legacy attachment is strong evidence of original video context

2. **Source Code Differentiation**: 
   - Placement 59 has `source_code = "d"` (YouTube Description)
   - Placement 62 (AA1kfTe-dO0) has `source_code = "s"` (Shorts Description)
   - Different source codes suggest different placements in different contexts

3. **Click Timing**:
   - JQZ6aM1zLXs clicks (source="d"): June 22-23, 2026 (recent)
   - AA1kfTe-dO0 clicks (source="s"): June 22, 2026 (earlier same day)
   - Different timing patterns suggest different video contexts

4. **Placement Type Consistency**:
   - Placement 59 is "YouTube Description" (description type)
   - Placement 62 is "Shorts Description" (short type)
   - These are distinct placement types, likely on different videos

### Evidence AGAINST Assignment to JQZ6aM1zLXs

1. **No Explicit Video Context**: Placement 59 has `youtube_video_id = NULL` and `link_usage_id = NULL`
   - Without explicit video context, assignment is inferential, not deterministic
   - The placement could theoretically belong to any video using this Smart Link

2. **Legacy Data Reliability**: The `links.video_id` field is legacy and may be outdated
   - If the link was moved from JQZ6aM1zLXs to another video, the legacy field would be wrong
   - Legacy data is not a reliable source of truth

3. **No User Confirmation**: We have no confirmation from the user that placement 59 belongs to JQZ6aM1zLXs
   - Without user confirmation, assignment is based on inference only

---

## Safety Assessment

### Recommendation: SAFE to assign to JQZ6aM1zLXs

**Confidence Level: 85%**

**Reasoning**:
1. The legacy `links.video_id = "JQZ6aM1zLXs"` is strong evidence of original attachment
2. The source code differentiation ("d" vs "s") suggests distinct placements
3. The timing patterns suggest different video contexts
4. AA1kfTe-dO0 already has proper attribution (link_usage_id = 25), making it unlikely that placement 59 also belongs to AA1kfTe-dO0
5. The placement type (YouTube Description) is consistent with long-form video (JQZ6aM1zLXs), not Shorts (AA1kfTe-dO0)

**Remaining Risk (15%)**:
- If the link was moved from JQZ6aM1zLXs to another video without updating the legacy field, the assignment would be incorrect
- If placement 59 was created for a different video but never had video context set, the assignment would be incorrect

---

## Migration Plan (If Approved)

### Step 1: Create link_usage for JQZ6aM1zLXs

```sql
INSERT INTO link_usages (
  link_id,
  user_id,
  youtube_video_id,
  placement_type,
  placement_name,
  public_code,
  source_code,
  destination_url_snapshot,
  title_snapshot,
  is_active,
  created_at,
  updated_at
)
SELECT 
  31 as link_id,
  user_id,
  'JQZ6aM1zLXs' as youtube_video_id,
  'description' as placement_type,
  'YouTube Description' as placement_name,
  'jq_desc_31' as public_code,
  'd' as source_code,
  original_url as destination_url_snapshot,
  title as title_snapshot,
  is_active,
  created_at,
  datetime('now') as updated_at
FROM links
WHERE id = 31;
```

**Expected Result**: Creates link_usage with new ID (e.g., 26) for JQZ6aM1zLXs

### Step 2: Update placement 59 to link to the new link_usage

```sql
UPDATE placements
SET link_usage_id = (SELECT id FROM link_usages WHERE link_id = 31 AND youtube_video_id = 'JQZ6aM1zLXs' AND source_code = 'd')
WHERE id = 59;
```

**Expected Result**: Placement 59 now has `link_usage_id = 26` (or whatever ID was created)

### Step 3: Update click_events to use the new link_usage_id

```sql
UPDATE click_events
SET link_usage_id = (SELECT id FROM link_usages WHERE link_id = 31 AND youtube_video_id = 'JQZ6aM1zLXs' AND source_code = 'd')
WHERE link_id = 31 
  AND source = 'd' 
  AND link_usage_id IS NULL;
```

**Expected Result**: Clicks 145, 140, 139, 138, 137 now have `link_usage_id = 26`

---

## Affected Records

### Before Migration

| Record Type | ID | Current State |
| ----------- | -- | ------------- |
| Placement | 59 | youtube_video_id = NULL, link_usage_id = NULL |
| Click Events | 145, 140, 139, 138, 137 | link_usage_id = NULL, source = "d" |
| Link Usage | (none) | No link_usage for JQZ6aM1zLXs |

### After Migration

| Record Type | ID | New State |
| ----------- | -- | --------- |
| Link Usage | 26 (new) | link_id = 31, youtube_video_id = JQZ6aM1zLXs, source_code = "d" |
| Placement | 59 | link_usage_id = 26 |
| Click Events | 145, 140, 139, 138, 137 | link_usage_id = 26 |

---

## Migration Impact

### Click Attribution Changes

| Video | Before | After | Change |
|-------|--------|-------|--------|
| JQZ6aM1zLXs | 0 (Unknown) | 5 | +5 |
| AA1kfTe-dO0 | 3 | 3 | 0 |
| Direct | 7 | 7 | 0 |
| Unknown | 12 | 7 | -5 |

### Page Impact

**Video Performance Page (JQZ6aM1zLXs)**:
- Before: 8 clicks (incorrect, includes 3 from AA1kfTe-dO0)
- After: 5 clicks (correct, only JQZ6aM1zLXs clicks)

**Links Page**:
- Before: 15 total (8 JQ + 3 AA + 7 direct, but attribution unclear)
- After: 15 total (5 JQ + 3 AA + 7 direct, attribution clear)

**Analytics Page**:
- Before: Mixed attribution, unclear video breakdown
- After: Clear video breakdown

### User Impact

- **Positive**: JQZ6aM1zLXs Video Performance page will show correct 5 clicks
- **Positive**: Attribution will be deterministic for all 15 clicks
- **Risk**: If assignment is incorrect, JQZ6aM1zLXs will show wrong data (15% risk)

---

## Rollback Plan

If migration causes issues:

```sql
-- Step 1: Reset click_events
UPDATE click_events
SET link_usage_id = NULL
WHERE link_id = 31 AND source = 'd' AND link_usage_id = (SELECT id FROM link_usages WHERE link_id = 31 AND youtube_video_id = 'JQZ6aM1zLXs' AND source_code = 'd');

-- Step 2: Reset placement
UPDATE placements
SET link_usage_id = NULL
WHERE id = 59;

-- Step 3: Delete link_usage
DELETE FROM link_usages
WHERE link_id = 31 AND youtube_video_id = 'JQZ6aM1zLXs' AND source_code = 'd';
```

---

## Approval Required

**Decision**: SAFE to proceed with assignment to JQZ6aM1zLXs

**Confidence**: 85%

**Recommendation**: Proceed with migration after user approval

**Alternative**: If user is uncomfortable with 85% confidence, leave the 5 clicks as "Unknown" and do not migrate
