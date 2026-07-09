# Attribution Trace Report for link_id = 31

## Smart Link
- **link_id**: 31
- **Title**: "The Prompts That Started It All"
- **Expected Lifetime Total**: 15 clicks

## Known Totals (from dashboard)
- Direct = 7 clicks
- JQZ6aM1zLXs = 5 clicks
- AA1kfTe-dO0 = 3 clicks
- **Total**: 15 clicks

## Problem
Video Performance page for JQZ6aM1zLXs incorrectly shows 8 clicks instead of 5.

## How to Run This Report

1. Open Cloudflare D1 dashboard
2. Select the TubeLinkr database
3. Run each query from `migrations/trace-link-31-attribution.sql`
4. Export results to CSV or copy to this document

---

## REPORT 1: Click-by-Click Attribution Trace

### Query
Run the first query from `migrations/trace-link-31-attribution.sql`

### Expected Output Format

| Click ID | Timestamp | Link ID | Link Usage ID | Click Source | Placement ID | Placement Source Code | Placement Video ID | Placement Link Usage ID | Usage Video ID | Links Video ID | Final Owner |
| -------- | --------- | ------- | ------------- | ------------ | ------------ | --------------------- | ----------------- | ----------------------- | -------------- | ------------- | ----------- |

### Final Owner Determination Logic

The query uses this priority order to determine the final owner:

1. **Priority 1**: If click has `link_usage_id`, use that `link_usage`'s `youtube_video_id`
2. **Priority 2**: If click has `source`, match to placement and use placement's video context:
   - If placement has `link_usage_id`, use that `link_usage`'s `youtube_video_id`
   - If placement has `youtube_video_id`, use that
   - Otherwise: Unknown
3. **Priority 3**: If click has no `link_usage_id` and no `source`, it's Direct
4. **Priority 4**: Otherwise: Unknown

---

## REPORT 2: Attribution Totals

### Query
Run the second query from `migrations/trace-link-31-attribution.sql`

### Expected Output Format

| Final Owner | Click Count |
| ----------- | ----------- |

### Expected Results

| Final Owner | Click Count |
| ----------- | ----------- |
| JQZ6aM1zLXs | 5 |
| AA1kfTe-dO0 | 3 |
| Direct | 7 |
| Unknown | 0 |
| **Total** | **15** |

---

## REPORT 3: Placements for link_id = 31

### Query
Run the third query from `migrations/trace-link-31-attribution.sql`

### Expected Output Format

| Placement ID | Source Code | Link Usage ID | Youtube Video ID | Placement Name | Placement Type | Click Count |
| ------------ | ----------- | ------------- | ---------------- | -------------- | -------------- | ----------- |

---

## REPORT 4: Link Usages for link_id = 31

### Query
Run the fourth query from `migrations/trace-link-31-attribution.sql`

### Expected Output Format

| Usage ID | Link ID | Youtube Video ID | Placement Type | Placement Name | Source Code | Is Active | Click Count |
| -------- | ------- | ---------------- | -------------- | -------------- | ----------- | --------- | ----------- |

---

## REPORT 5: Click Events with All Possible Owners

### Query
Run the fifth query from `migrations/trace-link-31-attribution.sql`

### Purpose
This report shows all possible owners for each click, helping identify conflicts or ambiguous data.

### Expected Output Format

| Click ID | Timestamp | Link Usage ID | Click Source | Owner from link_usage_id | Owner from placement.youtube_video_id | Owner from placement.link_usage_id | Owner from links.video_id | Current API Owner |
| -------- | --------- | ------------- | ------------ | ------------------------ | ------------------------------------ | ---------------------------------- | ------------------------ | ----------------- |

---

## REPORT 6: Identify Clicks with Conflicting Owners

### Query
Run the sixth query from `migrations/trace-link-31-attribution.sql`

### Purpose
This report identifies clicks where different attribution sources point to different videos.

### Expected Output Format

| Click ID | Timestamp | Link Usage ID | Click Source | Owner from link_usage_id | Owner from placement.youtube_video_id | Owner from links.video_id | Conflict Status |
| -------- | --------- | ------------- | ------------ | ------------------------ | ------------------------------------ | ------------------------ | --------------- |

---

## Questions to Answer After Running Queries

### 1. Which specific click IDs are causing JQZ6aM1zLXs to incorrectly display 8 instead of 5?

**Answer**: [Fill in after running queries]

Look at REPORT 2 totals. If JQZ6aM1zLXs shows more than 5, identify which clicks are incorrectly attributed to JQZ6aM1zLXs by examining REPORT 1 and REPORT 5.

### 2. Is the problem data quality, query logic, or both?

**Answer**: [Fill in after running queries]

- **Data quality**: If clicks have `link_usage_id IS NULL` when they should have it, or if `source` doesn't match placement `source_code`
- **Query logic**: If the API is using `link_id` alone instead of `link_usage_id` or `source` matching
- **Both**: If both issues exist

### 3. Can every click be deterministically attributed today?

**Answer**: [Fill in after running queries]

Check REPORT 6 for conflicts. If there are no conflicts and all clicks have a clear owner, then yes. If there are conflicts or clicks with "Unknown" owner, then no.

### 4. If not, which click IDs are ambiguous?

**Answer**: [Fill in after running queries]

List click IDs from REPORT 6 with `conflict_status = 'CONFLICT'` or from REPORT 1 with `final_owner = 'Unknown'`.

---

## Next Steps

After running the queries and filling in the answers:

1. If data quality is the issue: Run the legacy attribution migration
2. If query logic is the issue: Fix the API queries (but not before migration)
3. If both: Run migration first, then fix queries
4. If clicks are ambiguous: Investigate the specific click IDs to determine correct ownership

---

## Important Notes

- **Do not modify code** until this investigation is complete
- **Do not run migrations** until this investigation is complete
- **Do not patch queries** until this investigation is complete
- The goal is to understand the true state of the data before making any changes
- The totals must equal exactly 15 clicks
