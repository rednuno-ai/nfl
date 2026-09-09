# Stability and narrative review — 9 September 2026

## Findings and changes

- Auth/bootstrap and career API requests previously had no deadline. Both now abort after 15 seconds. An expired session and a stalled load have regression coverage.
- Failed career opens previously wrote a toast that career selection never rendered. Selection now displays the error and a retry control.
- Saved JSON previously entered the UI without validation or migration. `src/data/restoreCareer.ts` restores optional legacy fields, validates essential state and pending interactions, and preserves the original storage on failure. Outdated pending narrative events are rechecked against current eligibility.
- Independent autosaves could finish out of order. `src/data/saveQueue.ts` serializes them per user/career; opening waits for pending writes.
- External-store snapshots now read the stable state object before applying selectors. Current selectors were stable; no existing render loop was reproduced. This prevents future object/array selectors from producing an uncached snapshot loop.
- Dialog focus no longer resets every time a parent creates a fresh Escape callback.
- Five core relationships were prepopulated and visible immediately. `src/engine/characters.ts` adds introductions for coach, family, teammate Jordan Reed, rival Dante Cole and agent Morgan Hale, plus the college coaching staff. Visibility and dependent events require persistent introduction flags. Agent introduction requires draft/pro stage and age 20; rival introduction requires two games.
- School/low-fame performance coverage and social posts now stay local. The original generic generator had national outlets and thousands of likes regardless of age/fame.
- High-school finances/nav/dashboard now point to recruiting and college opportunities rather than professional contracts and shopping.
- Coach trust modifies training development by up to 10%; event opportunities also require relationship thresholds. Decision feedback records actual trust/cash/general-attribute changes and the selected choice's implications in both notification and durable history.

## Verification

- Full suite: 196 tests passed, including 12 new continuation tests and the existing balance cohort.
- Two additional Worker repository tests passed (timeout and expired session); auth tests rerun and passed.
- TypeScript and Vite production build passed after fixing a strict-null check in a test fixture.
- Six positional journeys (QB, RB, WR, TE, LB, CB), deterministic progression seed 9122026: age 15 through professional stage; serialized/restored each step, verified every presented event, checked agent age and contract age. This is six full engine journeys, not 10,000 full match-by-match browser careers.
- Local production build, browser 1280×720: login, create player, 24-point disabled start, recommended build, career creation, People hidden until introductions, reload/reopen, coach introduction.
- Local production build, browser 390×844: reopen pending introduction, resolve it, view impact, enter game, reload/reopen pending game, skip/simulate, reach Week 2. No JavaScript error logs in this flow.

## Limits

- The user's exact prior public freeze was not reproduced from their saved payload. The fixes address verified failure paths; they do not prove every historical save is recoverable.
- Essential corrupted save data is rejected, not reconstructed or deleted.
- Existing relationship values/history remain intact, but legacy careers without introduction flags receive introductions before dependent stories resume.
- Six core character introductions are covered; unnamed background roles are not a fully simulated cast.
- Development-server dependency scanning is blocked by this environment's filesystem restrictions; testing used the successfully built production bundle via Vite preview.
- Public deployment verification is recorded separately after publication.
