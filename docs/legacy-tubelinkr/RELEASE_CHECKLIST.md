> Legacy TubeLinkr reference only.
> This document exists to preserve historical implementation details.
> New platform work should follow the InLinkr documentation.

# TubeLinkr Release Checklist

## Before merging into `master` 

### Branch
- [ ] I am merging from the correct source branch:
  - [ ] `free-dev` 
  - [ ] `pro-dev` 

### Scope
- [ ] Change only includes intended work
- [ ] No unrelated edits were included
- [ ] No unfinished experiments are included
- [ ] No temporary debug code is left in place
- [ ] No test-only UI text remains

### Preview Verification
- [ ] I tested the preview deployment on Cloudflare
- [ ] Core page affected by the change works correctly
- [ ] Mobile layout looks correct
- [ ] Desktop layout looks correct
- [ ] No console-breaking errors are obvious
- [ ] Main user flow still works after the change

### Product Safety
- [ ] Redirect behavior still works
- [ ] Link creation/editing still works
- [ ] Dashboard still loads
- [ ] Auth still works
- [ ] No free-user experience is broken

### If merging from `pro-dev` 
- [ ] Pro features are properly gated
- [ ] Free users cannot see unfinished Pro UI
- [ ] Free users cannot access Pro routes directly
- [ ] Free users cannot use Pro APIs directly
- [ ] Upgrade prompts behave correctly

### Deployment Safety
- [ ] No environment variables were unintentionally changed
- [ ] No Cloudflare config changes are required for this release
- [ ] No Clerk config changes are required for this release unless planned

### Final Review
- [ ] Commit history looks clean enough to understand
- [ ] I am intentionally promoting this branch to production
- [ ] I am prepared to revert the merge if needed
