> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# Admin Command Center V2 Design Audit

## Current State Analysis

### Current Layout (V1)
1. **Admin Access** - Admin key input (always visible)
2. **Overview Stats Cards** - 9 stat cards in 3-column grid
3. **Recent Activity** - Simple list below stats
4. **Referral System Controls** - Toggle switches
5. **Founder Access Controls** - Email input + action buttons

### Problem Statement
- Recent Activity is the most valuable section but has low visual priority
- Page feels like a collection of tools rather than a cohesive dashboard
- Activity feed is buried below 9 stat cards
- No visual hierarchy guiding the owner to what matters most
- Static timestamps (toLocaleString) are hard to scan
- Event types are displayed as plain gray badges without semantic meaning

---

## V2 Design Proposal

### Section Order (New Hierarchy)

1. **Admin Access** - Admin key input (always visible, collapsible after auth)
2. **Recent Activity** - HERO SECTION (full width, prominent)
3. **Platform Snapshot** - Compact stat cards (secondary, collapsible)
4. **Operations** - Referral controls, Founder access (below fold)
5. **Revenue Insights** - Reserved for future MRR/ARR metrics

### Layout Hierarchy

```
┌─────────────────────────────────────────────────────────┐
│ Owner Dashboard                           [Admin Key ▼] │
│ Platform activity, snapshot, and operations.           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  📊 RECENT ACTIVITY                          [Refresh]  │
│  ┌───────────────────────────────────────────────────┐ │
│  │ 🟢 user_signed_up  • 2m ago                      │ │
│  │ New user registered                               │ │
│  │ User dustytrailstv@gmail.com signed up            │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ 💰 pro_upgraded  • 15m ago                        │ │
│  │ User upgraded to Pro                              │ │
│  │ User 123 upgraded to pro via Stripe               │ │
│  ├───────────────────────────────────────────────────┤ │
│  │ ⭐ founder_purchased  • 1h ago                     │ │
│  │ Founder purchased                                 │ │
│  │ User 456 purchased Founder access via Stripe      │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
│  📈 PLATFORM SNAPSHOT                    [Collapse ▼] │
│  ┌──────────┬──────────┬──────────┬──────────┐        │
│  │ 1,234    │ 890      │ 344      │ 12       │        │
│  │ Users    │ Free     │ Pro      │ Founder  │        │
│  └──────────┴──────────┴──────────┴──────────┘        │
│                                                         │
│  ⚙️ OPERATIONS                                          │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Referral System Controls                          │ │
│  │ Founder Access Controls                            │ │
│  └───────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Event Badge Color System

### Event Type → Badge Color Mapping

| Event Type | Badge Color | Icon | Rationale |
|------------|-------------|------|-----------|
| `user_signed_up` | Green (bg-green-900/30 text-green-400) | 🟢 | Positive growth event |
| `pro_upgraded` | Blue (bg-blue-900/30 text-blue-400) | 💰 | Revenue event |
| `founder_purchased` | Purple (bg-purple-900/30 text-purple-400) | ⭐ | Premium event |
| `founder_granted_by_admin` | Amber (bg-amber-900/30 text-amber-400) | 🎁 | Manual action |
| `referral_qualified` | Cyan (bg-cyan-900/30 text-cyan-400) | 🔗 | Growth event |
| `referral_reward_unlocked` | Gold (bg-yellow-900/30 text-yellow-400) | 🏆 | Achievement |
| `proof_created` | Pink (bg-pink-900/30 text-pink-400) | 📸 | Content event |
| `error` | Red (bg-red-900/30 text-red-400) | ⚠️ | Critical |
| `warning` | Orange (bg-orange-900/30 text-orange-400) | ⚡ | Attention needed |
| `info` | Gray (bg-gray-800 text-gray-400) | ℹ️ | Default |

### Badge Component
```tsx
function EventBadge({ eventType }: { eventType: string }) {
  const badgeConfig = {
    user_signed_up: { color: 'bg-green-900/30 text-green-400', icon: '🟢' },
    pro_upgraded: { color: 'bg-blue-900/30 text-blue-400', icon: '💰' },
    founder_purchased: { color: 'bg-purple-900/30 text-purple-400', icon: '⭐' },
    // ... etc
  };
  
  const config = badgeConfig[eventType] || { color: 'bg-gray-800 text-gray-400', icon: 'ℹ️' };
  
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded ${config.color}`}>
      <span>{config.icon}</span>
      <span>{eventType}</span>
    </span>
  );
}
```

---

## Relative Timestamps

### Implementation
Replace `new Date(event.created_at).toLocaleString()` with relative time:

```tsx
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
```

### Display Examples
- `2m ago` - 2 minutes ago
- `15m ago` - 15 minutes ago
- `1h ago` - 1 hour ago
- `3d ago` - 3 days ago
- `May 28` - Older than 7 days (show date)

### Tooltip Enhancement
Add full timestamp on hover:
```tsx
<span title={new Date(event.created_at).toLocaleString()}>
  {formatRelativeTime(event.created_at)}
</span>
```

---

## Mobile Layout

### Breakpoints
- **Mobile (< 640px)**: Single column, stacked sections
- **Tablet (640px - 1024px)**: 2-column stat grid, full-width activity
- **Desktop (> 1024px)**: 3-column stat grid, full-width activity

### Mobile Considerations
- Activity feed: Full width, larger touch targets (min 44px height)
- Stat cards: 2-column grid on mobile, 3-column on tablet+
- Admin key input: Full width, sticky to top after auth
- Operations: Collapsible by default on mobile to save space

### Mobile Layout
```
┌─────────────────────────────┐
│ Owner Dashboard   [Key ▼]   │
├─────────────────────────────┤
│ 📊 RECENT ACTIVITY          │
│ ┌─────────────────────────┐ │
│ │ 🟢 user_signed_up 2m   │ │
│ │ New user registered     │ │
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ 💰 pro_upgraded 15m     │ │
│ │ User upgraded to Pro    │ │
│ └─────────────────────────┘ │
├─────────────────────────────┤
│ 📈 SNAPSHOT       [▼]      │
│ ┌──────────┬──────────┐    │
│ │ 1,234    │ 890      │    │
│ │ Users    │ Free     │    │
│ ├──────────┼──────────┤    │
│ │ 344      │ 12       │    │
│ │ Pro      │ Founder  │    │
│ └──────────┴──────────┘    │
├─────────────────────────────┤
│ ⚙️ OPERATIONS     [▼]      │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

---

## Card Hierarchy

### Visual Priority Levels

**Level 1 - Hero (Full Width, Prominent)**
- Recent Activity section
- Larger padding (p-6 vs p-4)
- Subtle gradient background or border highlight
- Refresh button in header
- Larger event cards (more breathing room)

**Level 2 - Secondary (Compact, Collapsible)**
- Platform Snapshot
- 3-column grid (desktop), 2-column (tablet), 2-column (mobile)
- Smaller stat cards (p-3 vs p-4)
- Collapse/expand toggle
- Muted border color

**Level 3 - Tertiary (Below Fold)**
- Operations (Referral, Founder)
- Default collapsed on mobile
- Section dividers with icons
- Action buttons clearly labeled

---

## Future Role Support

### Role-Based Visibility (Reserved for Future)

The layout is designed to support multiple roles without redesign:

**Owner Role (Current)**
- Full access to all sections
- Revenue insights (future)
- User management (future)

**Admin Role (Future)**
- Recent Activity (filtered to admin actions)
- Platform Snapshot (read-only)
- Operations (limited to approved actions)
- No revenue insights

**Support Role (Future)**
- Recent Activity (filtered to support tickets)
- Limited operations (user lookup only)
- No revenue insights
- No platform snapshot

### Implementation Approach
- Add `role` field to activity_events visibility_scope
- API filters events by user role
- UI shows/hides sections based on role
- No layout changes required - only visibility toggles

---

## Implementation Phases

### Phase 1: Activity Hero (Immediate)
- Move Recent Activity to top (below admin key)
- Increase visual prominence (larger padding, border highlight)
- Add refresh button
- Keep current event card design

### Phase 2: Enhanced Event Cards (Short-term)
- Implement event badge color system
- Add icons to badges
- Implement relative timestamps
- Add full timestamp tooltip

### Phase 3: Compact Snapshot (Short-term)
- Reduce stat card padding
- Make Platform Snapshot collapsible
- Move below Activity section
- Consider reducing to 6 key metrics

### Phase 4: Mobile Optimization (Medium-term)
- Implement responsive breakpoints
- Optimize touch targets
- Collapse Operations by default on mobile
- Test on actual devices

### Phase 5: Revenue Section (Future)
- Add Revenue Insights section below Snapshot
- MRR/ARR metrics
- Revenue event filtering
- Chart visualizations

### Phase 6: Role-Based Access (Future)
- Implement role field in activity_events
- Add role filtering to API
- Show/hide sections based on role
- Add role selector for multi-admin accounts

---

## Risks

### Design Risks

**Risk: Activity feed feels empty initially**
- Mitigation: Show "No activity yet" with helpful message
- Mitigation: Add sample events during onboarding
- Mitigation: Show "Last 7 days" timeframe indicator

**Risk: Too much visual hierarchy change confuses users**
- Mitigation: Keep same color scheme and components
- Mitigation: Only reorder sections, don't change component design
- Mitigation: Add "What's new" tooltip for first-time users

**Risk: Relative timestamps less precise for debugging**
- Mitigation: Keep full timestamp in tooltip
- Mitigation: Add "View full details" action
- Mitigation: Show absolute timestamp on event detail modal

### Technical Risks

**Risk: Relative time library adds dependency**
- Mitigation: Use simple custom function (no library needed)
- Mitigation: Keep logic in utility function for easy testing

**Risk: Badge color system requires mapping maintenance**
- Mitigation: Default to gray for unknown event types
- Mitigation: Add TypeScript type for known event types
- Mitigation: Document color choices in code comments

**Risk: Collapsible sections add state complexity**
- Mitigation: Use localStorage to persist collapse state
- Mitigation: Keep collapse state simple (boolean per section)
- Mitigation: Test with rapid expand/collapse interactions

### Migration Risks

**Risk: Breaking existing admin workflow**
- Mitigation: Keep all existing functionality
- Mitigation: Only change layout, not behavior
- Mitigation: Test all admin operations after redesign

**Risk: Mobile layout not tested on actual devices**
- Mitigation: Test on iOS Safari, Chrome Mobile
- Mitigation: Test on various screen sizes
- Mitigation: Use browser dev tools for initial testing

---

## Success Metrics

### User Experience
- Time to locate Recent Activity: < 2 seconds
- Time to locate key stat: < 3 seconds
- User satisfaction with new layout (survey)

### Engagement
- Activity feed refresh rate increase
- Time spent on Admin page increase
- Operations usage rate (should not decrease)

### Technical
- Page load time: < 2 seconds
- Mobile performance score: > 90
- No console errors on any section interaction

---

## Next Steps

1. Review this design with stakeholders
2. Approve Phase 1 implementation
3. Create design tokens for badge colors
4. Implement Phase 1 in pro-dev branch
5. Test with staging data
6. Gather feedback before Phase 2
