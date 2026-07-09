# TubeLinkr Branch Strategy

## Branches
- `master` = live production branch used by real users
- `free-dev` = staging branch for free-tier updates before release
- `pro-dev` = staging branch for Pro features before release

## Rules
- No direct work on `master` 
- All development happens on `free-dev` or `pro-dev` 
- `master` only receives intentional promotions
- Unfinished Pro work must stay on `pro-dev` 
- Finished Pro work may be merged into `master` only when properly gated for paid access

## Release Paths
- Free changes: `free-dev` -> `master` 
- Pro changes: `pro-dev` -> `master` 

## Safety Principle
Code being on `master` does not mean free users should access it.
All Pro functionality must be gated by plan checks in UI, routes, and APIs.
