# Education Admin Hub — concept prototype

Clickable concept prototype of a Microsoft Education admin experience. Not a shipping product; all tenant data is sample data.

Live: https://jesegher.github.io/edu-admin-hub-prototype/

## Try the demo

- **Overview:** sample readiness assessment and recent changes. The student
  age-group count is a saved snapshot, refreshed automatically every 24 hours
  while the demo is open or on the next visit after the snapshot expires.
  **Recalculate now** refreshes it immediately, shows progress, updates the
  last-checked timestamp, and reports the before/after count. Classification
  changes do not silently refresh this snapshot; the banner prompts you to
  recalculate. Student age-group readiness uses the same snapshot, with a direct
  recalculation action in its table row.
- **Guided setup:** review institution type, age classification, nine app settings
  and data connections. Recalculate from the age-group step, review step or
  completion screen without leaving setup. Recalculation checks saved data only;
  it never applies draft selections. Apply only differences.
- **Student safety:** choose classification sources, edit group or grade mappings,
  simulate CSV validation/import, preview illustrative counts and apply sample
  classifications. Recalculation is always available beside the classification
  actions and beside the counts, including before preview, without a loaded CSV,
  and after reaching zero unclassified students. Counts,
  breakdowns, readiness and timestamps all use the same saved assessment.
  No real files are uploaded.
- **Apps & agents:** filter and toggle settings. Disabling Study and Learn also
  clears and disables pre-selection. A purple **New** badge marks the seven
  owner-selected new admin controls in both this page and guided setup:
  Study and Learn agent, Teach module, Educator Insights agent, Reading Progress,
  Search Coach, Speaker Progress and Math Progress. Badges identify new controls in this
  concept, not new apps or shipping availability; all other controls are unmarked.
- **Connectors & data:** review and retry sample sync errors, connect Canvas
  agent data, simulate connector consent and disconnects,
  and control OpenStax availability. Recalculate age-group counts in the School
  Data Sync section after a roster sync. This does not rerun sync, grant agent
  access or apply classification. App toggles and agent connectors keep their
  immediate setting updates; they do not need age-group recalculation.
- **Reset demo:** restore the original sample tenant for another walkthrough.

Applied settings and the sample audit log persist in this browser's local storage.
Guided setup drafts remain in the current tab until reloaded. If storage is
unavailable, the demo displays a warning and changes last only in the tab.
Classification results are fixed illustrations, not eligibility calculations.
Connector consent is simulated; there is no backend, authentication, telemetry,
real student information or live service integration. Custom endpoints are
validated locally and never contacted or stored. Google Fonts is the only
external asset request.

The existing light admin-center look is retained, with an optional dark theme.
The site is marked `noindex`; this is not access control. GitHub Pages and all
repository content are public.

## Run locally

Open `index.html` in a browser, or serve this folder with a static HTTP server.
No dependencies or build step are required.

GitHub Pages publishes the root of `main`. Only the static demo files belong in
this repository; do not add internal documents or workspace files.

## Sources / References

- Owner-provided **Education Admin Hub** North Star concept, October 2026.
  The internal source document is intentionally not included in this public repo.
- The existing Education Admin Hub prototype in this repository.
- Owner feedback, October 19, 2026: age-group counts refresh once every 24 hours;
  admins need an on-demand recalculation after classification, available at
  relevant points throughout the demo rather than only on Overview.
